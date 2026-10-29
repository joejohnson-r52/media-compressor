# Changelog

All notable changes to this plugin are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the plugin follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.1.1] - 2026-10-29

### Security

- Added an `Update URI` header, so WordPress never checks WordPress.org for updates to this plugin. Without it, a plugin published there under the same slug would be offered as an update and could replace this one.

### Fixed

- The Settings link on the Plugins screen is only shown to users who can open the settings page; others previously saw a link with no destination.
- The decoded image is now released when compression fails partway, as well as when it succeeds. Previously a failure, such as a photo too large for Safari's canvas, kept the full-size image in memory.
- The dialog now says why an image couldn't be compressed: "Could not read this image", "Too large for this browser to process" (for example a large photo in Safari with no maximum dimension), or "This browser can't produce WebP images".

## [1.1.0] - 2026-10-29

### Added

- Settings → Media Compressor page (administrators only) for the site's default quality, maximum dimension and output format, with a Settings link on the Plugins screen.
- A size threshold: images smaller than it upload without the dialog. Images over the upload limit still always open it.
- The plugin's settings are deleted when the plugin is deleted.

### Changed

- Requires WordPress 6.7, for script module data.

### Removed

- Remembering each browser's last-used settings (added in 1.0.3). It overrode the site settings, so changes on the settings page never reached anyone who had used the dialog. The dialog now always opens with the site's settings.

## [1.0.3] - 2026-10-28

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

[Unreleased]: https://github.com/joejohnson-r52/media-compressor/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/joejohnson-r52/media-compressor/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/joejohnson-r52/media-compressor/compare/v1.0.3...v1.1.0
[1.0.3]: https://github.com/joejohnson-r52/media-compressor/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/joejohnson-r52/media-compressor/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/joejohnson-r52/media-compressor/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/joejohnson-r52/media-compressor/releases/tag/v1.0.0
