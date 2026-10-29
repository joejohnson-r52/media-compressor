<?php

/**
 * Plugin Name: Media Compressor
 * Description: Compress and resize images in the browser before they are uploaded to the Media Library.
 * Version: 1.2.2
 * Requires at least: 6.7
 * Requires PHP: 8.1
 * Author: Joe Johnson
 * License: MIT
 * Text Domain: media-compressor
 * Update URI: https://github.com/joejohnson-r52/media-compressor
 */

namespace MediaCompressor;

if (! defined('ABSPATH')) {
    exit;
}

// Composer installs (e.g. Bedrock) autoload src/ already; manual installs use
// the bundled autoloader.
if (! class_exists(Plugin::class)) {
    require_once __DIR__ . '/autoload.php';
}

Plugin::boot(__FILE__);
