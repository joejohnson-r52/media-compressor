import {
    canEncode,
    CompressError,
    compressImage,
    DEFAULT_OPTIONS,
    formatBytes,
} from 'media-compressor/compressor'

/** Counter for unique heading ids, as more than one dialog can be open. */
let dialogCount = 0

/** Output formats, as [value, label]. Filtered by browser support on use. */
const FORMATS = [
    ['original', 'Keep original'],
    ['image/webp', 'WebP'],
    ['image/jpeg', 'JPEG'],
]

/**
 * Open the compression dialog for a batch of images.
 *
 * Resolves with the files to upload: compressed versions, the originals,
 * or an empty array if the user cancels.
 *
 * @param {File[]} files
 * @param {object} [options]
 * @param {number} [options.maxSize] - upload limit in bytes, 0 for none
 * @returns {Promise<File[]>}
 */
export function openCompressorDialog(files, { maxSize = 0 } = {}) {
    return new Promise((resolve) => {
        const titleId = `media-compressor-title-${++dialogCount}`
        const formats = FORMATS.filter(
            ([type]) => type === 'original' || canEncode(type),
        )
        const dialog = document.createElement('dialog')
        dialog.className = 'media-compressor'
        dialog.setAttribute('aria-labelledby', titleId)
        dialog.innerHTML = template(files, titleId, formats, DEFAULT_OPTIONS)
        document.body.append(dialog)

        const form = dialog.querySelector('form')
        const qualityOutput = dialog.querySelector('[data-quality-output]')
        const summary = dialog.querySelector('[data-summary]')
        const previewUrls = []
        let run = 0
        let busy = false

        files.forEach((file, index) => {
            const url = URL.createObjectURL(file)
            previewUrls.push(url)
            dialog.querySelector(`[data-row="${index}"] img`).src = url
        })

        const readOptions = () => {
            const data = new FormData(form)

            return {
                quality: Number(data.get('quality')) / 100,
                maxDimension: Number(data.get('maxDimension')) || 0,
                format: data.get('format'),
            }
        }

        /**
         * @param {object} options
         * @returns {Promise<Array<[File, string]>>}
         */
        const compressAll = async (options) => {
            const settled = await Promise.allSettled(
                files.map((file) => compressImage(file, options)),
            )

            return settled.map((result, index) => outcome(result, files[index]))
        }

        // Re-run the preview whenever settings change. A run counter discards
        // results from stale runs that finish after a newer one has started.
        const update = async () => {
            const current = ++run
            const options = readOptions()
            qualityOutput.textContent = `${Math.round(options.quality * 100)}%`

            const outcomes = await compressAll(options)

            if (current !== run) return

            outcomes.forEach(([file, message], index) => {
                const cell = dialog.querySelector(
                    `[data-row="${index}"] [data-result]`,
                )

                // Oversized originals are let through to the dialog (see
                // media.js), so flag anything WordPress will still reject.
                cell.textContent =
                    maxSize && file.size > maxSize
                        ? `${message}. Over the ${formatBytes(maxSize)} upload limit`
                        : message
            })

            // Rows aren't a live region (announcing every row on each settings
            // change is too noisy), so the summary carries the announcement.
            summary.textContent = summarise(
                files,
                outcomes.map(([file]) => file),
                maxSize,
            )
        }

        const debouncedUpdate = debounce(update, 200)

        const close = (value) => {
            run++
            debouncedUpdate.cancel()
            previewUrls.forEach((url) => URL.revokeObjectURL(url))
            dialog.close()
            dialog.remove()
            resolve(value)
        }

        form.addEventListener('input', debouncedUpdate)

        // Enter in the number input implicitly submits the form, and a
        // method="dialog" submission closes the dialog without resolving,
        // dropping the held images. Settings apply via the input listener.
        form.addEventListener('submit', (event) => event.preventDefault())

        dialog.addEventListener('click', (event) => {
            if (busy) return

            const action = event.target.closest('[data-action]')?.dataset.action

            if (action === 'compress') {
                // Compress with the current settings rather than reusing the
                // preview, which may be stale or still running. Lock the
                // dialog so a second click or Escape can't close it first.
                // Read settings first: FormData skips disabled fields.
                const options = readOptions()

                busy = true
                debouncedUpdate.cancel()
                form.querySelectorAll('input, select').forEach(
                    (element) => (element.disabled = true),
                )
                // aria-disabled rather than disabled: disabling the focused
                // button would drop keyboard focus out of the dialog. Clicks
                // are already ignored while busy.
                dialog
                    .querySelectorAll('button')
                    .forEach((button) =>
                        button.setAttribute('aria-disabled', 'true'),
                    )
                event.target.closest('[data-action]').textContent =
                    'Compressing…'
                summary.textContent = 'Compressing images for upload…'

                compressAll(options).then((outcomes) =>
                    close(outcomes.map(([file]) => file)),
                )
            }
            if (action === 'original') close(files)
            if (action === 'cancel') close([])
        })

        // Escape key
        dialog.addEventListener('cancel', (event) => {
            event.preventDefault()

            if (!busy) close([])
        })

        dialog.showModal()
        update()
    })
}

/**
 * Pick the file to upload from a compression result, with a status message.
 *
 * @param {PromiseSettledResult<File>} result
 * @param {File} original
 * @returns {[File, string]}
 */
function outcome(result, original) {
    if (result.status === 'rejected') {
        const reason =
            result.reason instanceof CompressError
                ? result.reason.message
                : 'Could not compress'

        return [original, `${reason}, original will be used`]
    }

    const compressed = result.value

    // Never upload something bigger than what we started with.
    if (compressed.size >= original.size) {
        return [original, 'Already optimal, original will be used']
    }

    const saving = Math.round((1 - compressed.size / original.size) * 100)

    return [compressed, `${formatBytes(compressed.size)} (−${saving}%)`]
}

/**
 * Describe the batch's total saving, and how many files are still too large.
 *
 * @param {File[]} originals
 * @param {File[]} uploads
 * @param {number} maxSize
 * @returns {string}
 */
function summarise(originals, uploads, maxSize) {
    const total = (files) => files.reduce((sum, file) => sum + file.size, 0)
    const before = total(originals)
    const after = total(uploads)
    const saving = Math.round((1 - after / before) * 100)
    const over = maxSize
        ? uploads.filter((file) => file.size > maxSize).length
        : 0

    let text = `Total ${formatBytes(before)} → ${formatBytes(after)} (−${saving}%)`

    if (over) {
        text += `. ${over} ${over === 1 ? 'image is' : 'images are'} over the ${formatBytes(maxSize)} upload limit`
    }

    return text
}

/**
 * @param {File[]} files
 * @param {string} titleId
 * @param {Array<[string, string]>} formats
 * @param {{quality: number, maxDimension: number, format: string}} settings
 * @returns {string}
 */
function template(files, titleId, formats, settings) {
    const options = formats
        .map(
            ([type, label]) =>
                `<option value="${type}"${type === settings.format ? ' selected' : ''}>${label}</option>`,
        )
        .join('')

    const rows = files
        .map(
            (file, index) => `
                <li class="media-compressor__row" data-row="${index}">
                    <img alt="" decoding="async" loading="lazy" />
                    <span class="media-compressor__name">${escapeHtml(file.name)}</span>
                    <span>${formatBytes(file.size)}</span>
                    <span data-result>Compressing…</span>
                </li>
            `,
        )
        .join('')

    return `
        <h2 id="${titleId}">Compress images before upload</h2>
        <form method="dialog" class="media-compressor__settings">
            <label>
                Quality <output data-quality-output></output>
                <input type="range" name="quality" min="10" max="100" step="5"
                    value="${Math.round(settings.quality * 100)}" />
            </label>
            <label>
                Max dimension (px)
                <input type="number" name="maxDimension" min="0" step="1"
                    value="${settings.maxDimension}" />
            </label>
            <label>
                Format
                <select name="format">${options}</select>
            </label>
        </form>
        <ul class="media-compressor__list">${rows}</ul>
        <p class="media-compressor__summary" role="status" data-summary></p>
        <div class="media-compressor__actions">
            <button type="button" class="button" data-action="cancel">Cancel</button>
            <button type="button" class="button" data-action="original">Upload original</button>
            <button type="button" class="button button-primary" data-action="compress">Compress &amp; upload</button>
        </div>
    `
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
 * @param {Function} fn
 * @param {number} wait
 * @returns {Function}
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
