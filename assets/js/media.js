import { isCompressible, readModuleData } from 'media-compressor/compressor'
import { openCompressorDialog } from 'media-compressor/dialog'

/**
 * Media upload compressor.
 *
 * Hooks into wp.Uploader (plupload), which backs the Media Library grid and the
 * wp.media modal. Images are pulled from the queue before WordPress starts the
 * upload, shown in the compressor dialog, then re-added as compressed files.
 *
 * Only WordPress's own uploaders are touched: nothing global in plupload is
 * replaced, so other plupload users on the page (e.g. Gravity Forms) and other
 * plugins' filters keep working as they were.
 *
 * Not covered:
 * - the block editor's own Upload button and drag-and-drop onto blocks, which
 *   upload via the REST API rather than plupload
 * - the legacy media-new.php uploader, which uses plupload directly
 */

/**
 * Native files we have already processed. When they are re-added to the
 * queue they must pass straight through rather than reopening the dialog.
 */
const processed = new WeakSet()

/**
 * Upload size limit in bytes for each plupload instance we've bound to (see
 * extendUploader). 0 means no limit.
 */
const limits = new WeakMap()

/**
 * Images smaller than this many bytes skip the dialog; 0 holds every image.
 * Set under Settings → Media Compressor.
 */
const { threshold = 0 } = readModuleData('media-compressor')

/**
 * Whether an added image goes through the compressor dialog. Images under the
 * site's size threshold upload untouched, unless they're over the upload limit
 * and need compressing to fit.
 *
 * @param {File|null} native
 * @param {number} maxSize - upload limit in bytes, 0 for none
 * @returns {boolean}
 */
const shouldHold = (native, maxSize) =>
    Boolean(native) &&
    !processed.has(native) &&
    isCompressible(native) &&
    (native.size >= threshold || (maxSize > 0 && native.size > maxSize))

const extendUploader = () => {
    const Uploader = window.wp?.Uploader

    if (!Uploader) return

    const init = Uploader.prototype.init

    Uploader.prototype.init = function (...args) {
        init.apply(this, args)

        const up = this.uploader

        // Take over this uploader's size check, so images over the limit can
        // reach the dialog and be compressed to fit. plupload's per-instance
        // option is used rather than replacing its global max_file_size
        // filter, which other plugins may rely on or replace themselves.
        // WordPress passes the limit as filters.max_file_size; setOption()
        // updates that same value.
        limits.set(
            up,
            window.plupload.parseSize(up.getOption('filters')?.max_file_size) ||
                0,
        )
        up.setOption('max_file_size', 0)

        // Priority 100 runs before WordPress's own FilesAdded handler (priority
        // 0), which builds attachment models and calls up.start().
        up.bind('FilesAdded', onFilesAdded, null, 100)
    }
}

/**
 * Remove a file from both the uploader's queue and the array the remaining
 * FilesAdded handlers receive.
 *
 * @param {plupload.Uploader} up
 * @param {plupload.File[]} files
 * @param {plupload.File} file
 */
function dequeue(up, files, file) {
    files.splice(files.indexOf(file), 1)
    up.removeFile(file)
}

/**
 * @param {plupload.Uploader} up
 * @param {plupload.File[]} files
 */
function onFilesAdded(up, files) {
    const maxSize = limits.get(up) ?? 0
    const held = files.filter((file) => shouldHold(file.getNative(), maxSize))

    // The uploader's own size check is off (see extendUploader), so reject
    // everything else over the limit here, with plupload's usual error so
    // WordPress shows its normal "exceeds the maximum upload size" message.
    files
        .filter(
            (file) => !held.includes(file) && maxSize && file.size > maxSize,
        )
        .forEach((file) => {
            up.trigger('Error', {
                code: window.plupload.FILE_SIZE_ERROR,
                message: window.plupload.translate('File size error.'),
                file,
            })
            dequeue(up, files, file)
        })

    if (held.length) {
        // Grab the native files first: removeFile() destroys the plupload
        // File's source, after which getNative() throws.
        const natives = held.map((file) => file.getNative())

        held.forEach((file) => dequeue(up, files, file))

        openCompressorDialog(natives, { maxSize }).then((toUpload) => {
            if (!toUpload.length) return

            toUpload.forEach((file) => processed.add(file))
            up.addFile(toUpload)
        })
    }

    // Nothing left in this batch, so skip WordPress's handler, which would
    // otherwise start an empty upload.
    if (!files.length) return false
}

extendUploader()
