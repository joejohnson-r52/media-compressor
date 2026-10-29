import { messages } from 'media-compressor/config'
import { CompressError } from 'media-compressor/image-compressor'

/** Quality slider range, in percent; matches Settings::QUALITY_* in PHP. */
const QUALITY = { min: 10, max: 100, step: 5 }

/**
 * The compressor dialog's DOM: building it, reading the settings form, and
 * showing results. Holds no compression state; CompressorDialog drives it.
 */
export class DialogView {
    static #count = 0

    #dialog
    #form
    #summary
    #qualityOutput
    #maxSize
    #previewUrls

    /**
     * @param {File[]} files
     * @param {object} options
     * @param {{value: string, label: string}[]} options.formats
     * @param {import('media-compressor/config').CompressionOptions} options.defaults
     * @param {number} options.maxSize - upload limit in bytes, 0 for none
     */
    constructor(files, { formats, defaults, maxSize }) {
        // Unique per dialog, as more than one can be open.
        const titleId = `media-compressor-title-${++DialogView.#count}`

        this.#maxSize = maxSize
        this.#dialog = document.createElement('dialog')
        this.#dialog.className = 'media-compressor'
        this.#dialog.setAttribute('aria-labelledby', titleId)
        this.#dialog.innerHTML = template(files, titleId, formats, defaults)
        this.#form = this.#dialog.querySelector('form')
        this.#summary = this.#dialog.querySelector('[data-summary]')
        this.#qualityOutput = this.#dialog.querySelector(
            '[data-quality-output]',
        )
        this.#previewUrls = files.map((file) => URL.createObjectURL(file))

        this.#rows().forEach((row, index) => {
            row.querySelector('img').src = this.#previewUrls[index]
        })

        // Enter in the number input implicitly submits the form, and a
        // method="dialog" submission closes the dialog without resolving,
        // dropping the held images. Settings apply via onChange instead.
        this.#form.addEventListener('submit', (event) => event.preventDefault())
    }

    open() {
        document.body.append(this.#dialog)
        this.#dialog.showModal()
    }

    close() {
        this.#previewUrls.forEach((url) => URL.revokeObjectURL(url))
        this.#dialog.close()
        this.#dialog.remove()
    }

    /** @param {() => void} handler - called when any setting changes */
    onChange(handler) {
        this.#form.addEventListener('input', handler)
    }

    /** @param {(action: string, button: HTMLElement) => void} handler */
    onAction(handler) {
        this.#dialog.addEventListener('click', (event) => {
            const button = event.target.closest('[data-action]')

            if (button) handler(button.dataset.action, button)
        })
    }

    /**
     * Escape key. The dialog stays open; the handler decides whether to close.
     *
     * @param {() => void} handler
     */
    onDismiss(handler) {
        this.#dialog.addEventListener('cancel', (event) => {
            event.preventDefault()
            handler()
        })
    }

    /**
     * Read before showBusy(): FormData skips disabled fields.
     *
     * @returns {import('media-compressor/config').CompressionOptions}
     */
    readOptions() {
        const data = new FormData(this.#form)

        return {
            quality: Number(data.get('quality')) / 100,
            maxDimension: Number(data.get('maxDimension')) || 0,
            format: data.get('format'),
        }
    }

    /** @param {number} quality - 0–1 */
    showQuality(quality) {
        this.#qualityOutput.textContent = `${Math.round(quality * 100)}%`
    }

    /** @param {import('media-compressor/compression-session').Outcome[]} outcomes */
    showOutcomes(outcomes) {
        this.#rows().forEach((row, index) => {
            row.querySelector('[data-result]').textContent = this.#describe(
                outcomes[index],
            )
        })

        // Rows aren't a live region (announcing every row on each settings
        // change is too noisy), so the summary carries the announcement.
        this.#summary.textContent = this.#summarise(outcomes)
    }

    /**
     * Lock the dialog while compressing for upload.
     *
     * @param {HTMLElement} button - the button that started it
     */
    showBusy(button) {
        this.#form
            .querySelectorAll('input, select')
            .forEach((field) => (field.disabled = true))

        // aria-disabled rather than disabled: disabling the focused button
        // would drop keyboard focus out of the dialog. CompressorDialog ignores
        // clicks while busy.
        this.#dialog
            .querySelectorAll('button')
            .forEach((each) => each.setAttribute('aria-disabled', 'true'))

        button.textContent = messages.compressing
        this.#summary.textContent = messages.compressingForUpload
    }

    /** @returns {HTMLElement[]} */
    #rows() {
        return [...this.#dialog.querySelectorAll('[data-row]')]
    }

    /**
     * @param {import('media-compressor/compression-session').Outcome} outcome
     * @returns {string}
     */
    #describe(outcome) {
        const message = outcome.compressed
            ? messages.saved(formatBytes(outcome.file.size), outcome.saving)
            : messages.originalUsed(
                  outcome.error
                      ? reason(outcome.error)
                      : messages.alreadyOptimal,
              )

        // Oversized originals are let through to the dialog (see
        // UploaderAdapter), so flag anything WordPress will still reject.
        return this.#overLimit(outcome.file)
            ? messages.overLimit(message, formatBytes(this.#maxSize))
            : message
    }

    /**
     * @param {import('media-compressor/compression-session').Outcome[]} outcomes
     * @returns {string}
     */
    #summarise(outcomes) {
        const before = total(outcomes.map((outcome) => outcome.original))
        const after = total(outcomes.map((outcome) => outcome.file))
        const over = outcomes.filter((outcome) =>
            this.#overLimit(outcome.file),
        ).length
        const text = messages.total(
            formatBytes(before),
            formatBytes(after),
            Math.round((1 - after / before) * 100),
        )

        return over
            ? `${text}. ${messages.imagesOverLimit(over, formatBytes(this.#maxSize))}`
            : text
    }

    /** @param {File} file */
    #overLimit(file) {
        return this.#maxSize > 0 && file.size > this.#maxSize
    }
}

/**
 * @param {Error} error
 * @returns {string}
 */
function reason(error) {
    return error instanceof CompressError
        ? error.message
        : messages.couldNotCompress
}

/**
 * @param {File[]} files
 * @returns {number} bytes
 */
function total(files) {
    return files.reduce((sum, file) => sum + file.size, 0)
}

/**
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`

    return `${(bytes / 1024 ** 2).toFixed(2)} MB`
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
    const div = document.createElement('div')
    div.textContent = value

    return div.innerHTML
}

/**
 * @param {File[]} files
 * @param {string} titleId
 * @param {{value: string, label: string}[]} formats
 * @param {import('media-compressor/config').CompressionOptions} defaults
 * @returns {string}
 */
function template(files, titleId, formats, defaults) {
    const options = formats
        .map(
            ({ value, label }) =>
                `<option value="${value}"${value === defaults.format ? ' selected' : ''}>${escapeHtml(label)}</option>`,
        )
        .join('')

    const rows = files
        .map(
            (file, index) => `
                <li class="media-compressor__row" data-row="${index}">
                    <img alt="" decoding="async" loading="lazy" />
                    <span class="media-compressor__name">${escapeHtml(file.name)}</span>
                    <span>${formatBytes(file.size)}</span>
                    <span data-result>${messages.compressing}</span>
                </li>
            `,
        )
        .join('')

    return `
        <h2 id="${titleId}">${messages.title}</h2>
        <form method="dialog" class="media-compressor__settings">
            <label>
                ${messages.quality} <output data-quality-output></output>
                <input type="range" name="quality" min="${QUALITY.min}" max="${QUALITY.max}" step="${QUALITY.step}"
                    value="${Math.round(defaults.quality * 100)}" />
            </label>
            <label>
                ${messages.maxDimension}
                <input type="number" name="maxDimension" min="0" step="1"
                    value="${defaults.maxDimension}" />
            </label>
            <label>
                ${messages.format}
                <select name="format">${options}</select>
            </label>
        </form>
        <ul class="media-compressor__list">${rows}</ul>
        <p class="media-compressor__summary" role="status" data-summary></p>
        <div class="media-compressor__actions">
            <button type="button" class="button" data-action="cancel">${messages.cancel}</button>
            <button type="button" class="button" data-action="original">${messages.uploadOriginal}</button>
            <button type="button" class="button button-primary" data-action="compress">${escapeHtml(messages.compressAndUpload)}</button>
        </div>
    `
}
