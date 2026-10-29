import { messages } from 'media-compressor/config'

/**
 * Mime types we can decode and re-encode via canvas.
 *
 * GIFs are excluded (canvas would drop animation frames), as are SVGs
 * (vector, nothing to re-encode).
 */
export const COMPRESSIBLE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const EXTENSIONS = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
}

const NAMES = {
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/webp': 'WebP',
}

/** A compression failure whose message is fit to show in the dialog. */
export class CompressError extends Error {}

/**
 * @param {File} file
 * @returns {boolean}
 */
export const isCompressible = (file) => COMPRESSIBLE_TYPES.includes(file.type)

/**
 * Scale dimensions down so the longest edge is at most maxDimension, keeping
 * the aspect ratio. Never scales up.
 *
 * @param {number} width
 * @param {number} height
 * @param {number} maxDimension - 0 keeps the original dimensions
 * @returns {{width: number, height: number}}
 */
export function fitWithin(width, height, maxDimension) {
    const scale =
        maxDimension > 0
            ? Math.min(1, maxDimension / Math.max(width, height))
            : 1

    return {
        width: Math.round(width * scale),
        height: Math.round(height * scale),
    }
}

/**
 * Compresses and resizes images in the browser: decode → resize → draw →
 * encode.
 *
 * Re-encoding through canvas strips EXIF/ICC metadata. Orientation is applied
 * to the pixels when decoding, so images still display upright.
 */
export class ImageCompressor {
    /**
     * @param {File} file
     * @param {import('media-compressor/config').CompressionOptions} options
     * @returns {Promise<File>}
     * @throws {CompressError} with a reason to show in the dialog
     */
    async compress(file, { quality, maxDimension, format }) {
        const type = format === 'original' ? file.type : format
        const bitmap = await this.#decode(file)
        let canvas

        // Release the decoded image as soon as it's drawn, or if drawing
        // fails; it holds the full-size pixels in memory until closed.
        try {
            canvas = this.#draw(
                bitmap,
                fitWithin(bitmap.width, bitmap.height, maxDimension),
                type,
            )
        } finally {
            bitmap.close()
        }

        const blob = await this.#encode(canvas, type, quality)

        return new File([blob], renameForType(file.name, type), {
            type,
            lastModified: Date.now(),
        })
    }

    /**
     * @param {File} file
     * @returns {Promise<ImageBitmap>}
     */
    async #decode(file) {
        try {
            return await createImageBitmap(file, {
                imageOrientation: 'from-image',
            })
        } catch {
            throw new CompressError(messages.couldNotRead)
        }
    }

    /**
     * Canvases over the browser's size limit (about 16.7 megapixels in Safari)
     * fail to create or draw, depending on the browser.
     *
     * @param {ImageBitmap} bitmap
     * @param {{width: number, height: number}} size
     * @param {string} type
     * @returns {OffscreenCanvas}
     */
    #draw(bitmap, { width, height }, type) {
        try {
            const canvas = new OffscreenCanvas(width, height)
            const context = canvas.getContext('2d')

            if (!context) throw new Error('No 2D context')

            // JPEG has no alpha channel, so flatten transparency onto white
            // rather than letting it render black.
            if (type === 'image/jpeg') {
                context.fillStyle = '#fff'
                context.fillRect(0, 0, width, height)
            }

            context.drawImage(bitmap, 0, 0, width, height)

            return canvas
        } catch {
            throw new CompressError(messages.tooLarge)
        }
    }

    /**
     * @param {OffscreenCanvas} canvas
     * @param {string} type
     * @param {number} quality
     * @returns {Promise<Blob>}
     */
    async #encode(canvas, type, quality) {
        let blob

        try {
            blob = await canvas.convertToBlob({ type, quality })
        } catch {
            throw new CompressError(messages.tooLarge)
        }

        // Unsupported output types come back as PNG. Fail rather than upload a
        // PNG labelled as something else, so the original is used instead.
        if (blob.type !== type) {
            throw new CompressError(messages.cannotProduce(NAMES[type] ?? type))
        }

        return blob
    }
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
