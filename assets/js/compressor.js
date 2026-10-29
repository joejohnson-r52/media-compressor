/**
 * Mime types we can decode and re-encode via canvas.
 *
 * GIFs are excluded (canvas would drop animation frames), as are SVGs
 * (vector, nothing to re-encode).
 */
export const COMPRESSIBLE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Site settings from Settings → Media Compressor, printed by WordPress as
 * script module data (already validated server-side). Anything missing keeps
 * the built-in defaults below.
 */
const site = readModuleData('media-compressor/compressor')
const format = site.format ?? 'original'

export const DEFAULT_OPTIONS = {
    quality: 0.8,
    maxDimension: 2560,
    ...site,
    // Fall back when this browser can't produce the site's format (WebP in
    // Safari), so the defaults are always usable here.
    format: format === 'original' || canEncode(format) ? format : 'original',
}

const EXTENSIONS = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
}

/**
 * @param {File} file
 * @returns {boolean}
 */
export const isCompressible = (file) => COMPRESSIBLE_TYPES.includes(file.type)

/**
 * Whether the browser can encode a mime type from a canvas. Unsupported types
 * silently fall back to PNG (e.g. WebP in Safari).
 *
 * @param {string} type
 * @returns {boolean}
 */
export function canEncode(type) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1

    return canvas.toDataURL(type).startsWith(`data:${type}`)
}

/**
 * Compress an image file in the browser.
 *
 * Note: re-encoding through canvas strips EXIF/ICC metadata. Orientation is
 * applied to the pixels by createImageBitmap, so images still display upright.
 *
 * @param {File} file
 * @param {object} options
 * @param {number} options.quality - 0–1, ignored for PNG output
 * @param {number} options.maxDimension - longest edge in px, 0 to disable
 * @param {'original'|'image/jpeg'|'image/webp'} options.format
 * @returns {Promise<File>}
 */
export async function compressImage(file, options = {}) {
    const { quality, maxDimension, format } = { ...DEFAULT_OPTIONS, ...options }
    const type = format === 'original' ? file.type : format

    const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
    })

    const scale =
        maxDimension > 0
            ? Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
            : 1
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = new OffscreenCanvas(width, height)
    const context = canvas.getContext('2d')

    // JPEG has no alpha channel, so flatten transparency onto white
    // rather than letting it render black.
    if (type === 'image/jpeg') {
        context.fillStyle = '#fff'
        context.fillRect(0, 0, width, height)
    }

    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await canvas.convertToBlob({ type, quality })

    // Unsupported output types come back as PNG. Fail rather than upload a
    // PNG labelled as something else, so the original is used instead.
    if (blob.type !== type) {
        throw new Error(`This browser cannot encode ${type}`)
    }

    return new File([blob], renameForType(file.name, type), {
        type,
        lastModified: Date.now(),
    })
}

/**
 * Swap a filename's extension to match the output mime type.
 *
 * @param {string} name
 * @param {string} type
 * @returns {string}
 */
function renameForType(name, type) {
    const base = name.replace(/\.[^.]+$/, '')

    return `${base}.${EXTENSIONS[type]}`
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
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`

    return `${(bytes / 1024 ** 2).toFixed(2)} MB`
}
