import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
    CompressError,
    fitWithin,
    ImageCompressor,
    isCompressible,
} from 'media-compressor/image-compressor'

test('fitWithin scales the longest edge down, keeping the aspect ratio', () => {
    assert.deepEqual(fitWithin(8000, 6000, 2000), { width: 2000, height: 1500 })
    assert.deepEqual(fitWithin(3000, 6000, 2000), { width: 1000, height: 2000 })
})

test('fitWithin never scales up, and 0 keeps the dimensions', () => {
    assert.deepEqual(fitWithin(800, 600, 2000), { width: 800, height: 600 })
    assert.deepEqual(fitWithin(8000, 6000, 0), { width: 8000, height: 6000 })
})

test('isCompressible accepts JPEG, PNG and WebP only', () => {
    const file = (type) => ({ type })

    assert.ok(isCompressible(file('image/jpeg')))
    assert.ok(isCompressible(file('image/png')))
    assert.ok(isCompressible(file('image/webp')))
    assert.ok(!isCompressible(file('image/gif')))
    assert.ok(!isCompressible(file('image/svg+xml')))
    assert.ok(!isCompressible(file('application/pdf')))
})

// Browser APIs, stubbed so each step can be made to fail in turn.
let failAt
let bitmapClosed

beforeEach(() => {
    failAt = null
    bitmapClosed = null

    globalThis.createImageBitmap = async () => {
        if (failAt === 'decode') throw new Error('decode')
        bitmapClosed = false

        return { width: 8000, height: 6000, close: () => (bitmapClosed = true) }
    }

    globalThis.OffscreenCanvas = class {
        constructor() {
            if (failAt === 'canvas') throw new RangeError('too big')
        }

        getContext() {
            if (failAt === 'context') return null

            return {
                fillRect() {},
                drawImage() {
                    if (failAt === 'draw') throw new Error('draw')
                },
            }
        }

        async convertToBlob({ type }) {
            if (failAt === 'encode') throw new Error('encode')

            return new Blob(['x'], {
                type: failAt === 'type' ? 'image/png' : type,
            })
        }
    }
})

const photo = new File(['abc'], 'photo.jpg', { type: 'image/jpeg' })
const options = { quality: 0.8, maxDimension: 2560, format: 'original' }

test('compresses, keeping the name and type, and releases the bitmap', async () => {
    const result = await new ImageCompressor().compress(photo, options)

    assert.equal(result.name, 'photo.jpg')
    assert.equal(result.type, 'image/jpeg')
    assert.equal(bitmapClosed, true)
})

test('renames the file to match a converted format', async () => {
    const result = await new ImageCompressor().compress(photo, {
        ...options,
        format: 'image/webp',
    })

    assert.equal(result.name, 'photo.webp')
    assert.equal(result.type, 'image/webp')
})

const failures = [
    ['decode', 'Could not read this image', null],
    ['canvas', 'Too large for this browser to process', true],
    ['context', 'Too large for this browser to process', true],
    ['draw', 'Too large for this browser to process', true],
    ['encode', 'Too large for this browser to process', true],
    ['type', "This browser can't produce JPEG images", true],
]

for (const [step, message, closed] of failures) {
    test(`a ${step} failure throws "${message}" and leaves no bitmap open`, async () => {
        failAt = step

        await assert.rejects(
            new ImageCompressor().compress(photo, options),
            (error) =>
                error instanceof CompressError && error.message === message,
        )
        assert.equal(bitmapClosed, closed)
    })
}
