import { config } from 'media-compressor/config'
import { ImageCompressor } from 'media-compressor/image-compressor'
import { CompressionSession } from 'media-compressor/compression-session'
import { DialogView } from 'media-compressor/dialog-view'

/** Delay before re-running the preview after a settings change, in ms. */
const PREVIEW_DELAY = 200

/**
 * Coordinates one compressor dialog: the view (DOM), the session (compression
 * runs) and the dialog's lifecycle.
 */
export class CompressorDialog {
    #files
    #view
    #session
    #schedulePreview
    #busy = false
    #resolve = () => {}

    /**
     * @param {File[]} files
     * @param {object} [options]
     * @param {number} [options.maxSize] - upload limit in bytes, 0 for none
     * @param {{compress: Function}} [options.compressor]
     */
    constructor(
        files,
        { maxSize = 0, compressor = new ImageCompressor() } = {},
    ) {
        this.#files = files
        this.#view = new DialogView(files, {
            formats: config.formats,
            defaults: config.defaults,
            maxSize,
        })
        this.#session = new CompressionSession(files, compressor)
        this.#schedulePreview = debounce(() => this.#preview(), PREVIEW_DELAY)
    }

    /**
     * Show the dialog.
     *
     * @returns {Promise<File[]>} the files to upload: compressed versions, the
     *     originals, or none if the user cancels
     */
    open() {
        return new Promise((resolve) => {
            this.#resolve = resolve

            this.#view.onChange(this.#schedulePreview)
            this.#view.onAction((action, button) => this.#act(action, button))
            this.#view.onDismiss(() => this.#act('cancel'))
            this.#view.open()
            this.#preview()
        })
    }

    /**
     * @param {string} action
     * @param {HTMLElement} [button]
     */
    #act(action, button) {
        if (this.#busy) return

        const actions = {
            compress: () => this.#compressAndUpload(button),
            original: () => this.#close(this.#files),
            cancel: () => this.#close([]),
        }

        actions[action]?.()
    }

    async #preview() {
        const options = this.#view.readOptions()
        this.#view.showQuality(options.quality)

        const outcomes = await this.#session.preview(options)

        if (outcomes) this.#view.showOutcomes(outcomes)
    }

    /**
     * Compress with the current settings rather than reusing the preview,
     * which may be stale or still running. The dialog is locked meanwhile so a
     * second click or Escape can't close it first.
     *
     * @param {HTMLElement} button
     */
    async #compressAndUpload(button) {
        // Read before showBusy() disables the fields.
        const options = this.#view.readOptions()

        this.#busy = true
        this.#schedulePreview.cancel()
        this.#session.cancel()
        this.#view.showBusy(button)

        const outcomes = await this.#session.compressAll(options)

        this.#close(outcomes.map((outcome) => outcome.file))
    }

    /** @param {File[]} files */
    #close(files) {
        this.#schedulePreview.cancel()
        this.#session.cancel()
        this.#view.close()
        this.#resolve(files)
    }
}

/**
 * Open a compressor dialog for a batch of images.
 *
 * @param {File[]} files
 * @param {{maxSize?: number}} [options]
 * @returns {Promise<File[]>}
 */
export const openCompressorDialog = (files, options) =>
    new CompressorDialog(files, options).open()

/**
 * @param {Function} fn
 * @param {number} wait
 * @returns {Function & {cancel: () => void}}
 */
function debounce(fn, wait) {
    let timeout

    const debounced = (...args) => {
        clearTimeout(timeout)
        timeout = setTimeout(() => fn(...args), wait)
    }

    debounced.cancel = () => clearTimeout(timeout)

    return debounced
}
