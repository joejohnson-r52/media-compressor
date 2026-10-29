<?php

namespace MediaCompressor;

use MediaCompressor\Admin\SettingsPage;
use MediaCompressor\Settings\SettingsRepository;

/**
 * Composition root: builds the plugin's components, injecting their
 * dependencies, and attaches each to WordPress.
 */
final class Plugin
{
    public static function boot(string $pluginFile): void
    {
        $settings = new SettingsRepository();

        $components = [
            $settings,
            new SettingsPage($settings, plugin_basename($pluginFile)),
            new Assets($settings, $pluginFile),
        ];

        foreach ($components as $component) {
            $component->register();
        }
    }
}
