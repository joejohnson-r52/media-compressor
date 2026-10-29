import './setup.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createConfig } from 'media-compressor/config'

const everything = () => true
const noWebp = (type) => type !== 'image/webp'

test('uses the site settings', () => {
    const config = createConfig(
        {
            quality: 0.7,
            maxDimension: 1920,
            format: 'image/webp',
            threshold: 1024,
        },
        everything,
    )

    assert.deepEqual(config.defaults, {
        quality: 0.7,
        maxDimension: 1920,
        format: 'image/webp',
    })
    assert.equal(config.threshold, 1024)
})

test('falls back to the built-in defaults when data is missing', () => {
    const config = createConfig({}, everything)

    assert.deepEqual(config.defaults, {
        quality: 0.8,
        maxDimension: 2560,
        format: 'original',
    })
    assert.equal(config.threshold, 0)
})

test('ignores values that are not non-negative numbers', () => {
    const config = createConfig(
        { quality: '"><script>', maxDimension: -5, threshold: null },
        everything,
    )

    assert.equal(config.defaults.quality, 0.8)
    assert.equal(config.defaults.maxDimension, 2560)
    assert.equal(config.threshold, 0)
})

test('only offers formats the browser can produce, original first', () => {
    const formats = createConfig({}, noWebp).formats.map(({ value }) => value)

    assert.deepEqual(formats, ['original', 'image/jpeg'])
})

test('falls back to original when the site format is unsupported', () => {
    const config = createConfig({ format: 'image/webp' }, noWebp)

    assert.equal(config.defaults.format, 'original')
})

test('rejects unknown formats', () => {
    const config = createConfig({ format: 'image/gif' }, everything)

    assert.equal(config.defaults.format, 'original')
})
