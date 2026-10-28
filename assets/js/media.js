import { isCompressible } from 'media-compressor/compressor'
import { openCompressorDialog } from 'media-compressor/dialog'

/**
 * Media upload compressor.
 *
 * Hooks into wp.Uploader (plupload), which backs the Media Library grid and the
 * wp.media modal. Images are pulled from the queue before WordPress starts the
 * upload, shown in the compressor dialog, then re-added as compressed files.
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
 * plupload instances we have bound to. The size filter is global, so other
 * plupload users on the page (e.g. Gravity Forms) must keep the normal check.
 */
const extended = new WeakSet()

/**
 * Replace plupload's max_file_size filter so images over the upload limit
 * reach the compressor instead of being rejected outright. The limit is still
 * applied when the compressed file is re-added, and PHP enforces it server-side.
 */
const extendSizeFilter = () => {
    const plupload = window.plupload

    if (!plupload) return

    plupload.addFileFilter('max_file_size', function (maxSize, file, cb) {
        const native = file.getNative()

        if (
            extended.has(this) &&
            native &&
            !processed.has(native) &&
            isCompressible(native)
        ) {
            return cb(true)
        }

        // Mirrors plupload's built-in filter.
        const limit = plupload.parseSize(maxSize)

        if (file.size !== undefined && limit && file.size > limit) {
            this.trigger('Error', {
                code: plupload.FILE_SIZE_ERROR,
                message: plupload.translate('File size error.'),
                file,
            })

            return cb(false)
        }

        cb(true)
    })
}

const extendUploader = () => {
    const Uploader = window.wp?.Uploader

    if (!Uploader) return

    const init = Uploader.prototype.init

    Uploader.prototype.init = function (...args) {
        init.apply(this, args)

        extended.add(this.uploader)

        // Priority 100 runs before WordPress's own FilesAdded handler (priority
        // 0), which builds attachment models and calls up.start().
        this.uploader.bind('FilesAdded', onFilesAdded, null, 100)
    }
}

/**
 * @param {plupload.Uploader} up
 * @param {plupload.File[]} files
 */
function onFilesAdded(up, files) {
    const held = files.filter((file) => {
        const native = file.getNative()

        return native && !processed.has(native) && isCompressible(native)
    })

    if (!held.length) return

    // Grab the native files first: removeFile() destroys the plupload File's
    // source, after which getNative() throws.
    const natives = held.map((file) => file.getNative())

    // Remove held images from both the queue and the array the remaining
    // handlers receive, so WordPress only starts uploading everything else.
    held.forEach((file) => {
        files.splice(files.indexOf(file), 1)
        up.removeFile(file)
    })

    const maxSize = window.plupload.parseSize(
        up.settings.filters?.max_file_size,
    )

    openCompressorDialog(natives, { maxSize }).then((toUpload) => {
        if (!toUpload.length) return

        toUpload.forEach((file) => processed.add(file))
        up.addFile(toUpload)
    })

    // Every file in this batch was held, so skip WordPress's handler entirely.
    if (!files.length) return false
}

extendSizeFilter()
extendUploader()
