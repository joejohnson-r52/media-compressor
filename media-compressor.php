<?php

/**
 * Plugin Name: Media Compressor
 * Description: Compress and resize images in the browser before they are uploaded to the Media Library.
 * Version: 1.1.0
 * Requires at least: 6.7
 * Requires PHP: 7.4
 * Author: Joe Johnson
 * License: MIT
 * Text Domain: media-compressor
 */

namespace MediaCompressor;

if (! defined('ABSPATH')) {
    exit;
}

const PLUGIN_FILE = __FILE__;

require_once __DIR__ . '/includes/settings.php';

/**
 * Plugin version, read from the header above so it only lives in one place.
 *
 * @return string
 */
function version(): string
{
    static $version;

    return $version ??= get_file_data(__FILE__, ['Version' => 'Version'])['Version'];
}

/**
 * Cache-busting version for an asset. Outside production the file's mtime is
 * used, so edits reach the browser without a version bump (Safari otherwise
 * keeps serving cached script modules).
 *
 * @param string $path Path relative to the plugin directory.
 * @return string
 */
function asset_version(string $path): string
{
    if (! in_array(wp_get_environment_type(), ['local', 'development'], true)) {
        return version();
    }

    return (string) filemtime(__DIR__ . '/' . $path);
}

/**
 * Load the upload compressor wherever the media uploader is used.
 *
 * wp_enqueue_media fires on the Media Library and any screen that opens the
 * wp.media modal (including the block editor). Script modules are deferred, so
 * they run after core's footer scripts and wp.Uploader is defined by then.
 *
 * @return void
 */
add_action('wp_enqueue_media', function () {
    $url = plugin_dir_url(__FILE__);

    wp_register_script_module(
        'media-compressor/compressor',
        $url . 'assets/js/compressor.js',
        [],
        asset_version('assets/js/compressor.js')
    );

    wp_register_script_module(
        'media-compressor/dialog',
        $url . 'assets/js/dialog.js',
        ['media-compressor/compressor'],
        asset_version('assets/js/dialog.js')
    );

    wp_enqueue_script_module(
        'media-compressor',
        $url . 'assets/js/media.js',
        ['media-compressor/compressor', 'media-compressor/dialog'],
        asset_version('assets/js/media.js')
    );

    wp_enqueue_style(
        'media-compressor',
        $url . 'assets/css/media.css',
        [],
        asset_version('assets/css/media.css')
    );
});
