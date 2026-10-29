<?php

/**
 * Remove the plugin's settings, on every site, when it is deleted from the
 * Plugins screen.
 */

use MediaCompressor\Settings\SettingsRepository;

if (! defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

if (! class_exists(SettingsRepository::class)) {
    require_once __DIR__ . '/autoload.php';
}

(new SettingsRepository())->deleteFromAllSites();
