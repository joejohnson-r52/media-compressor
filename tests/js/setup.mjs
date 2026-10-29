/**
 * Test setup, loaded with `node --import ./tests/js/setup.mjs --test`.
 *
 * - Resolves the plugin's script module ids as WordPress's import map does.
 * - Provides the little of `document` the modules touch at import time.
 */
import { register } from 'node:module'

register('./resolve.mjs', import.meta.url)

globalThis.document = {
    getElementById: () => null,
    createElement: () => ({ toDataURL: (type) => `data:${type};base64,` }),
}
