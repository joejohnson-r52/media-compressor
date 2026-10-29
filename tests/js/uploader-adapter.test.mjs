import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldHold, UploaderAdapter } from 'media-compressor/uploader-adapter'

const FILE_SIZE_ERROR = -600

const plupload = {
    parseSize: (value) => (typeof value === 'string' ? parseInt(value) : value),
    translate: (text) => text,
    FILE_SIZE_ERROR,
}

/**
 * Enough of a plupload uploader to drive FilesAdded: handlers run by
 * priority, highest first, and returning false stops the rest.
 */
class FakeUploader {
    options = { filters: { max_file_size: '1000b' } }
    handlers = []
    errors = []

    getOption(name) {
        return this.options[name]
    }

    setOption(name, value) {
        if (name === 'max_file_size') this.options.filters.max_file_size = value
    }

    bind(event, fn, scope, priority = 0) {
        this.handlers.push({ fn, priority })
        this.handlers.sort((a, b) => b.priority - a.priority)
    }

    trigger(event, error) {
        this.errors.push(error)
    }

    removeFile() {}

    addFile(natives) {
        const files = [natives].flat().map((native) => ({
            name: native.name,
            size: native.size,
            getNative: () => native,
        }))

        for (const { fn } of this.handlers) {
            if (fn(this, files) === false) return
        }
    }
}

const file = (name, type, size) => ({ name, type, size })
const settle = () => new Promise((resolve) => setTimeout(resolve))

/** An uploader with WordPress's own handler, and an adapter that "compresses" to 40%. */
function setUp() {
    const up = new FakeUploader()
    const uploaded = []
    const reviewed = []

    up.bind(
        'FilesAdded',
        (_, files) => uploaded.push(...files.map((f) => f.name)),
        null,
        0,
    )

    UploaderAdapter.attach(up, {
        plupload,
        threshold: 500,
        review: async (natives, { maxSize }) => {
            reviewed.push(...natives.map((n) => `${n.name} (limit ${maxSize})`))

            return natives.map((n) =>
                file(`${n.name}*`, n.type, Math.round(n.size * 0.4)),
            )
        },
    })

    return { up, uploaded, reviewed }
}

test('shouldHold: images at or over the threshold, or over the limit', () => {
    assert.ok(shouldHold(file('a', 'image/jpeg', 500), 500, 1000))
    assert.ok(!shouldHold(file('a', 'image/jpeg', 499), 500, 1000))
    assert.ok(shouldHold(file('a', 'image/jpeg', 100), 5000, 50))
    assert.ok(!shouldHold(file('a', 'application/pdf', 5000), 0, 0))
})

test('turns off the size limit on this uploader only', () => {
    const { up } = setUp()

    assert.equal(up.options.filters.max_file_size, 0)
})

test('routes each file: upload, review, or reject', async () => {
    const { up, uploaded, reviewed } = setUp()

    up.addFile([
        file('icon.jpg', 'image/jpeg', 100),
        file('photo.jpg', 'image/jpeg', 800),
        file('huge.jpg', 'image/jpeg', 5000),
        file('big.pdf', 'application/pdf', 5000),
        file('small.pdf', 'application/pdf', 200),
    ])
    await settle()

    assert.deepEqual(reviewed, [
        'photo.jpg (limit 1000)',
        'huge.jpg (limit 1000)',
    ])
    assert.deepEqual(uploaded, ['icon.jpg', 'small.pdf', 'photo.jpg*'])
    assert.deepEqual(
        up.errors.map((error) => [error.file.name, error.code]),
        [
            ['big.pdf', FILE_SIZE_ERROR],
            ['huge.jpg*', FILE_SIZE_ERROR],
        ],
    )
})

test('stops WordPress starting an empty upload when every file is held', () => {
    const { up, uploaded } = setUp()

    up.addFile([file('photo.jpg', 'image/jpeg', 800)])

    assert.deepEqual(uploaded, [])
})
