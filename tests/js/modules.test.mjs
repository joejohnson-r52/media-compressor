import './setup.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../../', import.meta.url)

/**
 * The browser resolves module ids through the import map WordPress builds from
 * src/Assets.php; the tests resolve them through package.json "exports". Keep
 * the two in step, or tests could pass while a module fails to load in the
 * browser.
 */
test('package.json exports match the modules registered in Assets.php', async () => {
    const assets = await readFile(new URL('src/Assets.php', root), 'utf8')
    const pkg = JSON.parse(
        await readFile(new URL('package.json', root), 'utf8'),
    )

    // Entries look like 'media-compressor/<id>' => '<path>', except the
    // config module, which is keyed by the self::CONFIG constant.
    const entries = assets.matchAll(
        /(?:'media-compressor\/([\w-]+)'|self::CONFIG) => '([^']+)'/g,
    )
    const registered = Object.fromEntries(
        [...entries].map(([, id = 'config', path]) => [`./${id}`, `./${path}`]),
    )

    assert.deepEqual(pkg.exports, registered)
})
