/**
 * Imported first by every test: provides the little of `document` the modules
 * touch at import time. Module ids resolve through package.json "exports".
 */
globalThis.document = {
    getElementById: () => null,
    createElement: () => ({ toDataURL: (type) => `data:${type};base64,` }),
}
