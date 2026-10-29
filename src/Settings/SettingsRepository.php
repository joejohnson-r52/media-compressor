<?php

namespace MediaCompressor\Settings;

use MediaCompressor\Hookable;

/**
 * Owns the stored option: registering it with WordPress, reading it as a
 * Settings object, and deleting it.
 */
final class SettingsRepository implements Hookable
{
    public const OPTION = 'media_compressor';

    /** Settings API group, used by the settings page form. */
    public const GROUP = 'media_compressor';

    private ?Settings $cached = null;

    public function register(): void
    {
        add_action('init', [$this, 'registerSetting']);

        // Drop the cached copy whenever the option changes during a request.
        foreach (['add_option_', 'update_option_', 'delete_option_'] as $hook) {
            add_action($hook . self::OPTION, [$this, 'forget']);
        }
    }

    /**
     * Registered on init rather than admin_init so the sanitize callback
     * applies to every write, including WP-CLI and other plugins'
     * update_option() calls.
     */
    public function registerSetting(): void
    {
        register_setting(self::GROUP, self::OPTION, [
            'type' => 'object',
            'sanitize_callback' => static fn (mixed $input): array => Settings::fromInput($input)->toArray(),
        ]);
    }

    /**
     * The site's settings. Sanitized on read as well as on save: this fills in
     * keys missing from older stored values and guards against values written
     * straight to the database.
     */
    public function get(): Settings
    {
        return $this->cached ??= Settings::fromInput(get_option(self::OPTION, []));
    }

    public function forget(): void
    {
        $this->cached = null;
    }

    /**
     * Delete the option on every site in the network (or the only site), for
     * uninstall.
     */
    public function deleteFromAllSites(): void
    {
        if (! is_multisite()) {
            delete_option(self::OPTION);

            return;
        }

        foreach (get_sites(['fields' => 'ids', 'number' => 0]) as $siteId) {
            switch_to_blog($siteId);
            delete_option(self::OPTION);
            restore_current_blog();
        }
    }
}
