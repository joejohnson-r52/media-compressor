import { isCompressible } from 'media-compressor/image-compressor'

/**
 * Whether an added image goes through the compressor dialog. Images under the
 * size threshold upload untouched, unless they're over the upload limit and
 * need compressing to fit.
 *
 * @param {File} file
 * @param {number} threshold - bytes; 0 holds every compressible image
 * @param {number} maxSize - upload limit in bytes, 0 for none
 * @returns {boolean}
 */
export const shouldHold = (file, threshold, maxSize) =>
    isCompressible(file) &&
    (file.size >= threshold || (maxSize > 0 && file.size > maxSize))

/**
 * Adapts one WordPress media uploader (a plupload instance) for compression:
 * pulls images out of the queue before WordPress starts uploading, sends them
 * for review, then re-adds what comes back.
 *
 * Only this instance is changed; nothing global in plupload is replaced, so
 * other plupload users on the page (e.g. Gravity Forms) and other plugins'
 * filters keep working as they were.
 */
export class UploaderAdapter {
    #up
    #plupload
    #threshold
    #review
    #maxSize

    /** Files we've already reviewed; re-added, they upload straight through. */
    #reviewed = new WeakSet()

    /**
     * @param {plupload.Uploader} up
     * @param {object} options
     * @param {object} options.plupload - the plupload global
     * @param {number} options.threshold - bytes; see shouldHold()
     * @param {(files: File[], options: {maxSize: number}) => Promise<File[]>} options.review
     *     shows the images to the user; resolves with the files to upload
     */
    constructor(up, { plupload, threshold, review }) {
        this.#up = up
        this.#plupload = plupload
        this.#threshold = threshold
        this.#review = review

        // Take over this uploader's size check, so images over the limit can
        // reach the dialog and be compressed to fit. WordPress passes the
        // limit as filters.max_file_size; setOption() updates that same value.
        this.#maxSize =
            plupload.parseSize(up.getOption('filters')?.max_file_size) || 0
        up.setOption('max_file_size', 0)

        // Priority 100 runs before WordPress's own FilesAdded handler (priority
        // 0), which builds attachment models and calls up.start().
        up.bind(
            'FilesAdded',
            (_, files) => this.#onFilesAdded(files),
            null,
            100,
        )
    }

    /**
     * @param {plupload.Uploader} up
     * @param {ConstructorParameters<typeof UploaderAdapter>[1]} options
     * @returns {UploaderAdapter}
     */
    static attach(up, options) {
        return new UploaderAdapter(up, options)
    }

    /**
     * @param {plupload.File[]} files - mutated: what's left goes to WordPress
     * @returns {false|undefined} false stops the remaining handlers
     */
    #onFilesAdded(files) {
        const held = files.filter((file) => this.#holds(file.getNative()))

        files
            .filter((file) => !held.includes(file) && this.#overLimit(file))
            .forEach((file) => this.#reject(files, file))

        if (held.length) this.#hold(files, held)

        // Nothing left in this batch, so skip WordPress's handler, which would
        // otherwise start an empty upload.
        if (!files.length) return false
    }

    /** @param {File|null} native */
    #holds(native) {
        return (
            Boolean(native) &&
            !this.#reviewed.has(native) &&
            shouldHold(native, this.#threshold, this.#maxSize)
        )
    }

    /** @param {{size: number}} file */
    #overLimit(file) {
        return this.#maxSize > 0 && file.size > this.#maxSize
    }

    /**
     * The uploader's own size check is off (see the constructor), so reject
     * files over the limit here, with plupload's usual error so WordPress shows
     * its normal "exceeds the maximum upload size" message.
     *
     * @param {plupload.File[]} files
     * @param {plupload.File} file
     */
    #reject(files, file) {
        this.#up.trigger('Error', {
            code: this.#plupload.FILE_SIZE_ERROR,
            message: this.#plupload.translate('File size error.'),
            file,
        })
        this.#dequeue(files, file)
    }

    /**
     * @param {plupload.File[]} files
     * @param {plupload.File[]} held
     */
    #hold(files, held) {
        // Grab the native files first: removeFile() destroys the plupload
        // File's source, after which getNative() throws.
        const natives = held.map((file) => file.getNative())

        held.forEach((file) => this.#dequeue(files, file))

        this.#review(natives, { maxSize: this.#maxSize }).then((toUpload) =>
            this.#requeue(toUpload),
        )
    }

    /** @param {File[]} natives */
    #requeue(natives) {
        if (!natives.length) return

        natives.forEach((file) => this.#reviewed.add(file))
        this.#up.addFile(natives)
    }

    /**
     * Remove a file from both the uploader's queue and the array the remaining
     * FilesAdded handlers receive.
     *
     * @param {plupload.File[]} files
     * @param {plupload.File} file
     */
    #dequeue(files, file) {
        files.splice(files.indexOf(file), 1)
        this.#up.removeFile(file)
    }
}
