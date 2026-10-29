<?php

/**
 * Remove the plugin's settings when it is deleted from the Plugins screen.
 */

if (! defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

delete_option('media_compressor');
