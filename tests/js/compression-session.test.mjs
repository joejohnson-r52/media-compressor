import './setup.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
    CompressionSession,
    Outcome,
} from 'media-compressor/compression-session'

const file = (name, size) => ({ name, size })

/** Compresses each file to the size given for it, or fails if none is given. */
const fakeCompressor = (sizes) => ({
    compress: async (original) => {
        if (!(original.name in sizes)) throw new Error('failed')

        return file(`${original.name}*`, sizes[original.name])
    },
})

test('uploads the compressed file only when it is smaller', async () => {
    const big = file('big.jpg', 1000)
    const small = file('small.jpg', 100)
    const session = new CompressionSession(
        [big, small],
        fakeCompressor({ 'big.jpg': 400, 'small.jpg': 150 }),
    )

    const [shrunk, kept] = await session.compressAll({})

    assert.equal(shrunk.compressed, true)
    assert.equal(shrunk.file.size, 400)
    assert.equal(shrunk.saving, 60)
    assert.equal(kept.compressed, false)
    assert.equal(kept.file, small)
})

test('keeps the original and the error when compression fails', async () => {
    const broken = file('broken.jpg', 1000)
    const session = new CompressionSession([broken], fakeCompressor({}))

    const [outcome] = await session.compressAll({})

    assert.equal(outcome.file, broken)
    assert.equal(outcome.error.message, 'failed')
})

test('discards a preview overtaken by a newer one', async () => {
    const session = new CompressionSession(
        [file('a.jpg', 1000)],
        fakeCompressor({ 'a.jpg': 500 }),
    )

    const first = session.preview({})
    const second = session.preview({})

    assert.equal(await first, null)
    assert.ok(Array.isArray(await second))
})

test('cancel() discards a running preview', async () => {
    const session = new CompressionSession(
        [file('a.jpg', 1000)],
        fakeCompressor({ 'a.jpg': 500 }),
    )

    const preview = session.preview({})
    session.cancel()

    assert.equal(await preview, null)
})

/** Records how many compressions run at once, and which files were started. */
const trackingCompressor = () => {
    const tracker = { active: 0, peak: 0, started: [] }

    tracker.compress = async (original) => {
        tracker.started.push(original.name)
        tracker.peak = Math.max(tracker.peak, ++tracker.active)
        await new Promise((resolve) => setTimeout(resolve))
        tracker.active--

        return file(`${original.name}*`, original.size / 2)
    }

    return tracker
}

const batch = (count) =>
    Array.from({ length: count }, (_, index) => file(`${index}.jpg`, 1000))

test('compresses two images at a time, in order', async () => {
    const compressor = trackingCompressor()
    const files = batch(5)
    const session = new CompressionSession(files, compressor)

    const outcomes = await session.compressAll({})

    assert.equal(compressor.peak, 2)
    assert.deepEqual(
        outcomes.map((outcome) => outcome.original),
        files,
    )
    assert.ok(outcomes.every((outcome) => outcome.compressed))
})

test('a cancelled preview starts no more images', async () => {
    const compressor = trackingCompressor()
    const session = new CompressionSession(batch(5), compressor)

    const preview = session.preview({})
    session.cancel()

    assert.equal(await preview, null)
    assert.deepEqual(compressor.started, ['0.jpg', '1.jpg'])
})

test('Outcome is immutable', () => {
    const outcome = new Outcome(file('a.jpg', 10))

    assert.ok(Object.isFrozen(outcome))
})
