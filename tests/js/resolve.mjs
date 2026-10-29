/**
 * Module resolve hook: maps the plugin's script module ids to files, matching
 * the ids registered in src/Assets.php.
 */
const MODULES = {
    'media-compressor/config': 'config.js',
    'media-compressor/image-compressor': 'image-compressor.js',
    'media-compressor/uploader-adapter': 'uploader-adapter.js',
    'media-compressor/compression-session': 'dialog/compression-session.js',
    'media-compressor/dialog-view': 'dialog/dialog-view.js',
    'media-compressor/compressor-dialog': 'dialog/compressor-dialog.js',
}

export async function resolve(specifier, context, next) {
    if (specifier in MODULES) {
        const url = new URL(
            `../../assets/js/${MODULES[specifier]}`,
            import.meta.url,
        )

        return next(url.href, context)
    }

    return next(specifier, context)
}
