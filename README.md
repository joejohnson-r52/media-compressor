# Media Compressor

A WordPress plugin that compresses and resizes images in the browser before they are uploaded to the Media Library.

When JPEG, PNG or WebP images are added to the uploader, a dialog opens before anything is sent to the server. In the dialog you can:

- set the quality,
- set a maximum width/height,
- keep the original format or convert to WebP or JPEG,

and see the new size of each image as you change the settings. If compressing doesn't make an image smaller, the original is uploaded instead.

The dialog opens with the site's settings (see [Settings](#settings)) every time.

## Requirements

- WordPress 6.7+ (script modules and script module data)
- PHP 8.1+
- A browser with `OffscreenCanvas` and `createImageBitmap` support

There is no build step: the plugin ships plain ES modules and CSS.

## Installation

### Composer (Bedrock)

The plugin isn't on Packagist, so add this repository as a VCS repository:

```json
"repositories": [
    {
        "type": "vcs",
        "url": "https://github.com/joejohnson-r52/media-compressor.git"
    }
],
"require": {
    "joejohnson-r52/media-compressor": "^1.0"
}
```

### Manually

Copy the folder into `wp-content/plugins/` and activate it.

## Settings

Administrators can set the site's defaults under **Settings → Media Compressor**:

| Setting                  | Default       | Notes                                                                                              |
| ------------------------ | ------------- | -------------------------------------------------------------------------------------------------- |
| Quality                  | 80%           | 10–100 in steps of 5. Ignored for PNG output.                                                      |
| Maximum dimension        | 2560px        | Longest edge after resizing. 0 keeps the original dimensions.                                      |
| Output format            | Keep original | Keep original, WebP or JPEG. Browsers that can't produce WebP (Safari) fall back to Keep original. |
| Skip images smaller than | 0 KB          | Images below this size upload without the dialog. 0 shows the dialog for every image.              |

The dialog opens with these every time, and they can still be adjusted for each upload. Images over the upload limit always open the dialog, whatever the threshold, so they can be compressed to fit.

The settings are stored in the `media_compressor` option.

## Where it works

The compressor only runs in wp-admin. If a theme or plugin opens the media uploader on the front end, uploads there work as normal without the dialog.

It hooks into `wp.Uploader` (plupload), WordPress's own media uploader, so it covers:

- the Media Library grid, including drag-and-drop,
- any `wp.media` modal, including the one in the block editor.

It does not cover:

- the block editor's own Upload button and drag-and-drop onto blocks, which upload through the REST API,
- the legacy `media-new.php` uploader.

## Upload size limit

WordPress normally rejects files over the upload limit in the browser. This plugin lets oversized JPEG/PNG/WebP images through to the dialog, so a large photo can be compressed until it fits. Rows still over the limit are flagged in the dialog. Other files over the limit, and compressed images that are still too large, are rejected with WordPress's usual error. PHP's `upload_max_filesize` / `post_max_size` still apply on the server.

To do this, the plugin takes over the size check only on the WordPress media uploaders it hooks into. Nothing global in plupload is replaced, so other plupload uploaders on the page (such as Gravity Forms file upload fields) and other plugins' plupload filters are unaffected.

## Notes

- Re-encoding through canvas strips EXIF and ICC metadata. Orientation is applied to the pixels first, so images still display the right way up.
- GIFs (animation would be lost) and SVGs are passed through untouched.
- PNG output ignores the quality setting; PNG files only get smaller by resizing or converting to another format.

## Architecture

### PHP (`src/`, PSR-4 `MediaCompressor\`)

| Class                         | Responsibility                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `Plugin`                      | Composition root: builds the components, injects their dependencies, and registers them.                    |
| `Hookable`                    | Interface for components that attach to WordPress hooks. Constructing one has no side effects.              |
| `Settings\Settings`           | Immutable value object. `fromInput()` sanitizes untrusted input; `toScriptData()` converts for the browser. |
| `Settings\Format`             | Enum of output formats.                                                                                     |
| `Settings\SettingsRepository` | Owns the `media_compressor` option: registration, cached reads, deletion on every site.                     |
| `Admin\SettingsPage`          | Settings → Media Compressor, its fields, and the Plugins-screen link.                                       |
| `Assets`                      | Registers the script modules and stylesheet in wp-admin and passes the settings to them.                    |

### JavaScript (`assets/js/`, plain ES modules, no build step)

| Module                          | Responsibility                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `media.js`                      | Entry point. Decorates `wp.Uploader` so each WordPress uploader gets an `UploaderAdapter`.                            |
| `uploader-adapter.js`           | `UploaderAdapter`: adapts one plupload instance; holds images for review, rejects oversized files, re-queues results. |
| `config.js`                     | The site's settings, the formats this browser can produce, and every user-facing message.                             |
| `image-compressor.js`           | `ImageCompressor`: decode → resize → draw → encode. Throws `CompressError` with a reason.                             |
| `dialog/compressor-dialog.js`   | `CompressorDialog`: coordinates the view and session, and the dialog's lifecycle.                                     |
| `dialog/dialog-view.js`         | `DialogView`: the dialog's DOM only.                                                                                  |
| `dialog/compression-session.js` | `CompressionSession` and the `Outcome` value object: compression runs and their results.                              |

Each module is registered as a WordPress script module under the id `media-compressor/<name>` (see `src/Assets.php`), and modules import each other by those ids.

## Development

```sh
composer install   # PHPUnit
composer test      # PHPUnit, then the JS tests
node --test        # the JS tests only (or: npm test)
```

The JS tests need Node 22+ and no npm packages: `package.json` only maps the module ids to files (its `exports`) so Node resolves them as WordPress's import map does. A test checks it stays in step with `src/Assets.php`. Format with Prettier using the bundled `.prettierrc.json`.
