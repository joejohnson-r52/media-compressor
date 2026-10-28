# Changelog

All notable changes to this plugin are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the plugin follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- The dialog remembers the settings from the last "Compress & upload" in that browser. Saved settings the browser can't use, such as WebP in Safari, fall back to the defaults.
- A summary line under the image list shows the batch's total size before and after compression, and how many images are still over the upload limit.

### Changed

- The plugin version is read from the plugin header, so a release only needs the `Version:` line updated.
- Added `.prettierrc.json` and `.editorconfig` matching the base theme, and formatted the code.

### Fixed

- Accessibility of the compressor dialog:
    - The dialog is now labelled by its heading.
    - Totals and upload-limit warnings are announced to screen readers through a live region, once per settings change.
    - Keyboard focus stays on "Compress & upload" while compression runs.
- Thumbnails in the dialog are decoded asynchronously and lazy-loaded.

## [1.0.2] - 2026-10-28

### Fixed

- Safari: converting to WebP uploaded a PNG with a `.webp` name. Safari can't encode WebP from a canvas, so the WebP option is now hidden in browsers that can't produce it, and any file that doesn't come out as the requested type falls back to the original. This also covers WebP images uploaded with "Keep original".

### Changed

- In local and development environments, scripts and styles are versioned by file modification time, so changes reach the browser without a version bump.

## [1.0.1] - 2026-10-28

### Fixed

- "Compress & upload" could upload nothing after a double-click, or when settings changed just before clicking. It now compresses with the current settings and locks the dialog while it runs.
- The upload size limit was skipped for other plupload uploaders on the same page, such as Gravity Forms multi-file upload fields. Only uploaders the plugin compresses for now let oversized images through.

## [1.0.0] - 2026-10-28

### Added

- Compress and resize JPEG, PNG and WebP images in the browser before they are uploaded through the Media Library or the `wp.media` modal.
- Dialog with quality, maximum dimension and output format settings, with a live preview of each image's new size.
- The original is uploaded whenever compressing wouldn't make it smaller.
- Images over the upload limit can be compressed until they fit, instead of being rejected before the dialog opens.

[Unreleased]: https://github.com/joejohnson-r52/media-compressor/compare/v1.0.2...HEAD
[1.0.2]: https://github.com/joejohnson-r52/media-compressor/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/joejohnson-r52/media-compressor/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/joejohnson-r52/media-compressor/releases/tag/v1.0.0
