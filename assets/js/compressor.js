/**
 * Mime types we can decode and re-encode via canvas.
 *
 * GIFs are excluded (canvas would drop animation frames), as are SVGs
 * (vector, nothing to re-encode).
 */
export const COMPRESSIBLE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const DEFAULT_OPTIONS = {
    quality: 0.8,
    maxDimension: 2560,
    format: 'original',
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
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`

    return `${(bytes / 1024 ** 2).toFixed(2)} MB`
}
