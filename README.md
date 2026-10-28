# Media Compressor

A WordPress plugin that compresses and resizes images in the browser before they are uploaded to the Media Library.

When JPEG, PNG or WebP images are added to the uploader, a dialog opens before anything is sent to the server. In the dialog you can:

- set the quality,
- set a maximum width/height,
- keep the original format or convert to WebP or JPEG,

and see the new size of each image as you change the settings. If compressing doesn't make an image smaller, the original is uploaded instead.

## Requirements

- WordPress 6.5+ (script modules)
- A browser with `OffscreenCanvas` and `createImageBitmap` support

There is no build step: the plugin ships plain ES modules and CSS.

## Installation

### Composer (Bedrock)

The repository is private, so add it as a VCS repository. Composer reads it over SSH.

```json
"repositories": [
    {
        "type": "vcs",
        "url": "git@github.com:joejohnson-r52/media-compressor.git"
    }
],
"require": {
    "joejohnson-r52/media-compressor": "^1.0"
}
```

### Manually

Copy the folder into `wp-content/plugins/` and activate it.

## Where it works

The compressor hooks into `wp.Uploader` (plupload), so it covers:

- the Media Library grid, including drag-and-drop,
- any `wp.media` modal, including the one in the block editor.

It does not cover:

- the block editor's own Upload button and drag-and-drop onto blocks, which upload through the REST API,
- the legacy `media-new.php` uploader.

## Upload size limit

WordPress normally rejects files over the upload limit in the browser. This plugin lets oversized JPEG/PNG/WebP images through to the dialog, so a large photo can be compressed until it fits. Rows still over the limit are flagged in the dialog. The limit is checked again when the compressed file is added, and PHP's `upload_max_filesize` / `post_max_size` still apply on the server.

## Notes

- Re-encoding through canvas strips EXIF and ICC metadata. Orientation is applied to the pixels first, so images still display the right way up.
- GIFs (animation would be lost) and SVGs are passed through untouched.
- PNG output ignores the quality setting; PNG files only get smaller by resizing or converting to another format.
