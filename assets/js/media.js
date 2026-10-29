import { config } from 'media-compressor/config'
import { UploaderAdapter } from 'media-compressor/uploader-adapter'
import { openCompressorDialog } from 'media-compressor/compressor-dialog'

/**
 * Media upload compressor: entry point.
 *
 * Decorates wp.Uploader (plupload), which backs the Media Library grid and the
 * wp.media modal, so every WordPress media uploader gets an UploaderAdapter
 * that sends images through the compressor dialog before uploading.
 *
 * Not covered:
 * - the block editor's own Upload button and drag-and-drop onto blocks, which
 *   upload via the REST API rather than plupload
 * - the legacy media-new.php uploader, which uses plupload directly
 *
 * @param {Function} Uploader - wp.Uploader
 * @param {object} plupload - the plupload global
 */
function decorateUploader(Uploader, plupload) {
    const init = Uploader.prototype.init

    Uploader.prototype.init = function (...args) {
        init.apply(this, args)

        UploaderAdapter.attach(this.uploader, {
            plupload,
            threshold: config.threshold,
            review: openCompressorDialog,
        })
    }
}

if (window.wp?.Uploader && window.plupload) {
    decorateUploader(window.wp.Uploader, window.plupload)
}
