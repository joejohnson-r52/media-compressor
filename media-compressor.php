<?php

/**
 * Plugin Name: Media Compressor
 * Description: Compress and resize images in the browser before they are uploaded to the Media Library.
 * Version: 1.0.2
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Author: Joe Johnson
 * License: MIT
 */

namespace MediaCompressor;

if (! defined('ABSPATH')) {
    exit;
}

const VERSION = '1.0.2';

/**
 * Cache-busting version for an asset. Outside production the file's mtime is
 * used, so edits reach the browser without bumping VERSION (Safari otherwise
 * keeps serving cached script modules).
 *
 * @param string $path Path relative to the plugin directory.
 * @return string
 */
function asset_version(string $path): string
{
    if (! in_array(wp_get_environment_type(), ['local', 'development'], true)) {
        return VERSION;
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
