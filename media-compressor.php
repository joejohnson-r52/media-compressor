<?php

/**
 * Plugin Name: Media Compressor
 * Description: Compress and resize images in the browser before they are uploaded to the Media Library.
 * Version: 1.0.1
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Author: Joe Johnson
 * License: MIT
 */

namespace MediaCompressor;

if (! defined('ABSPATH')) {
    exit;
}

const VERSION = '1.0.1';

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
        VERSION
    );

    wp_register_script_module(
        'media-compressor/dialog',
        $url . 'assets/js/dialog.js',
        ['media-compressor/compressor'],
        VERSION
    );

    wp_enqueue_script_module(
        'media-compressor',
        $url . 'assets/js/media.js',
        ['media-compressor/compressor', 'media-compressor/dialog'],
        VERSION
    );

    wp_enqueue_style(
        'media-compressor',
        $url . 'assets/css/media.css',
        [],
        VERSION
    );
});
