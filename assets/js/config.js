/**
 * Plugin configuration: the site's settings (from Settings → Media Compressor,
 * printed by WordPress as script module data), the output formats this browser
 * can produce, and every user-facing message.
 */

/** Output formats as [value, label]. 'original' stays first: always available. */
const FORMATS = [
    ['original', 'Keep original'],
    ['image/webp', 'WebP'],
    ['image/jpeg', 'JPEG'],
]

/** Built-in defaults, for anything missing from the site's data. */
const DEFAULTS = {
    quality: 0.8,
    maxDimension: 2560,
    format: 'original',
    threshold: 0,
}

/** canEncode() results; support can't change during a page load. */
const encodable = new Map()

/**
 * Whether this browser can encode a mime type from a canvas. Unsupported types
 * silently fall back to PNG (e.g. WebP in Safari).
 *
 * @param {string} type
 * @returns {boolean}
 */
export function canEncode(type) {
    if (!encodable.has(type)) {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        encodable.set(type, canvas.toDataURL(type).startsWith(`data:${type}`))
    }

    return encodable.get(type)
}

/**
 * Read the JSON data WordPress prints for a script module.
 *
 * @param {string} id - script module id
 * @returns {object}
 */
export function readModuleData(id) {
    try {
        const element = document.getElementById(`wp-script-module-data-${id}`)

        return JSON.parse(element?.textContent || '{}')
    } catch {
        return {}
    }
}

/**
 * @typedef {object} CompressionOptions
 * @property {number} quality - 0–1, ignored for PNG output
 * @property {number} maxDimension - longest edge in px, 0 to disable
 * @property {string} format - 'original' or an output mime type
 */

/**
 * @typedef {object} Config
 * @property {CompressionOptions} defaults - what the dialog opens with
 * @property {{value: string, label: string}[]} formats - formats this browser can produce
 * @property {number} threshold - images smaller than this many bytes skip the dialog
 */

/**
 * Build the configuration from the site's data. Values that aren't numbers, or
 * a format this browser can't produce (WebP in Safari), fall back to the
 * built-in defaults.
 *
 * @param {object} data - the site's settings, as printed by WordPress
 * @param {(type: string) => boolean} [isEncodable]
 * @returns {Config}
 */
export function createConfig(data, isEncodable = canEncode) {
    const number = (value, fallback) =>
        Number.isFinite(value) && value >= 0 ? value : fallback
    const formats = FORMATS.filter(
        ([type]) => type === 'original' || isEncodable(type),
    ).map(([value, label]) => Object.freeze({ value, label }))
    const supported = (type) => formats.some(({ value }) => value === type)

    return Object.freeze({
        defaults: Object.freeze({
            quality: number(data.quality, DEFAULTS.quality),
            maxDimension: number(data.maxDimension, DEFAULTS.maxDimension),
            format: supported(data.format) ? data.format : DEFAULTS.format,
        }),
        formats: Object.freeze(formats),
        threshold: number(data.threshold, DEFAULTS.threshold),
    })
}

/** This page's configuration. */
export const config = createConfig(readModuleData('media-compressor/config'))

/** Every user-facing message, in one place. */
export const messages = Object.freeze({
    title: 'Compress images before upload',
    quality: 'Quality',
    maxDimension: 'Max dimension (px)',
    format: 'Format',
    cancel: 'Cancel',
    uploadOriginal: 'Upload original',
    compressAndUpload: 'Compress & upload',
    compressing: 'Compressing…',
    compressingForUpload: 'Compressing images for upload…',
    couldNotRead: 'Could not read this image',
    tooLarge: 'Too large for this browser to process',
    cannotProduce: (format) => `This browser can't produce ${format} images`,
    couldNotCompress: 'Could not compress',
    alreadyOptimal: 'Already optimal',
    originalUsed: (reason) => `${reason}, original will be used`,
    saved: (size, percent) => `${size} (−${percent}%)`,
    overLimit: (message, limit) => `${message}. Over the ${limit} upload limit`,
    total: (before, after, percent) =>
        `Total ${before} → ${after} (−${percent}%)`,
    imagesOverLimit: (count, limit) =>
        `${count} ${count === 1 ? 'image is' : 'images are'} over the ${limit} upload limit`,
})
