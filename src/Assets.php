<?php

namespace MediaCompressor;

use MediaCompressor\Settings\SettingsRepository;

/**
 * Loads the compressor's script modules and stylesheet wherever WordPress's
 * media uploader is used in wp-admin, and passes the site's settings to them.
 */
final class Assets implements Hookable
{
    /** The entry module WordPress enqueues; it also names the stylesheet. */
    private const ENTRY = 'media-compressor';

    private const ENTRY_PATH = 'assets/js/media.js';

    /** The module that receives the site's settings as script module data. */
    private const CONFIG = 'media-compressor/config';

    /**
     * Script module id => path. Each is imported by its id, so the entry
     * depends on all of them and WordPress adds every one to the import map,
     * each with its own cache-busting version.
     */
    private const MODULES = [
        self::CONFIG => 'assets/js/config.js',
        'media-compressor/image-compressor' => 'assets/js/image-compressor.js',
        'media-compressor/uploader-adapter' => 'assets/js/uploader-adapter.js',
        'media-compressor/compression-session' => 'assets/js/dialog/compression-session.js',
        'media-compressor/dialog-view' => 'assets/js/dialog/dialog-view.js',
        'media-compressor/compressor-dialog' => 'assets/js/dialog/compressor-dialog.js',
    ];

    private const STYLE_PATH = 'assets/css/media.css';

    private ?string $releaseVersion = null;

    public function __construct(
        private readonly SettingsRepository $settings,
        private readonly string $pluginFile,
    ) {
    }

    public function register(): void
    {
        add_action('wp_enqueue_media', [$this, 'enqueue']);
        add_filter('script_module_data_' . self::CONFIG, [$this, 'addScriptData']);
    }

    /**
     * wp_enqueue_media fires on the Media Library and any screen that opens the
     * wp.media modal (including the block editor). Script modules are deferred,
     * so they run after core's footer scripts, once wp.Uploader is defined.
     */
    public function enqueue(): void
    {
        // Admin only: themes and plugins can open the media uploader on the
        // front end too, where the dialog isn't wanted (and admin styles aren't
        // loaded).
        if (! is_admin()) {
            return;
        }

        foreach (self::MODULES as $id => $path) {
            wp_register_script_module($id, $this->url($path), [], $this->version($path));
        }

        wp_enqueue_script_module(
            self::ENTRY,
            $this->url(self::ENTRY_PATH),
            array_keys(self::MODULES),
            $this->version(self::ENTRY_PATH)
        );

        wp_enqueue_style(self::ENTRY, $this->url(self::STYLE_PATH), [], $this->version(self::STYLE_PATH));
    }

    /**
     * WordPress prints this as JSON in #wp-script-module-data-media-compressor/config.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function addScriptData(array $data): array
    {
        return array_merge($data, $this->settings->get()->toScriptData());
    }

    private function url(string $path): string
    {
        return plugins_url($path, $this->pluginFile);
    }

    /**
     * Cache-busting version for an asset. Outside production the file's mtime
     * is used, so edits reach the browser without a version bump (Safari
     * otherwise keeps serving cached script modules).
     */
    private function version(string $path): string
    {
        if (in_array(wp_get_environment_type(), ['local', 'development'], true)) {
            return (string) filemtime(dirname($this->pluginFile) . '/' . $path);
        }

        return $this->releaseVersion ??= get_file_data($this->pluginFile, ['Version' => 'Version'])['Version'];
    }
}
