<?php

namespace MediaCompressor\Admin;

use MediaCompressor\Hookable;
use MediaCompressor\Settings\Format;
use MediaCompressor\Settings\Settings;
use MediaCompressor\Settings\SettingsRepository;

/**
 * Settings → Media Compressor: the page, its fields, and the Settings link on
 * the Plugins screen.
 */
final class SettingsPage implements Hookable
{
    public const SLUG = 'media-compressor';

    private const SECTION = 'media_compressor_defaults';

    private const CAPABILITY = 'manage_options';

    public function __construct(
        private readonly SettingsRepository $settings,
        private readonly string $pluginBasename,
    ) {
    }

    public function register(): void
    {
        add_action('admin_menu', [$this, 'addPage']);
        add_action('admin_init', [$this, 'addFields']);
        add_filter('plugin_action_links_' . $this->pluginBasename, [$this, 'addActionLink']);
    }

    public function addPage(): void
    {
        add_options_page(
            __('Media Compressor', 'media-compressor'),
            __('Media Compressor', 'media-compressor'),
            self::CAPABILITY,
            self::SLUG,
            [$this, 'render']
        );
    }

    public function render(): void
    {
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <form action="options.php" method="post">
                <?php
                settings_fields(SettingsRepository::GROUP);
                do_settings_sections(self::SLUG);
                submit_button();
                ?>
            </form>
        </div>
        <?php
    }

    public function addFields(): void
    {
        add_settings_section(self::SECTION, __('Defaults', 'media-compressor'), [$this, 'renderIntro'], self::SLUG);

        foreach ($this->fields() as $key => [$label, $render]) {
            add_settings_field(
                "media_compressor_{$key}",
                $label,
                $render,
                self::SLUG,
                self::SECTION,
                ['label_for' => $this->fieldId($key)]
            );
        }
    }

    public function renderIntro(): void
    {
        $this->description(__(
            'The settings the compressor dialog opens with when images are uploaded. They can still be adjusted for each upload.',
            'media-compressor'
        ));
    }

    /**
     * Add a Settings link to the plugin's row on the Plugins screen, for users
     * who can open the page (menu_page_url() returns '' for anyone else).
     *
     * @param array<int|string, string> $links
     * @return array<int|string, string>
     */
    public function addActionLink(array $links): array
    {
        if (! current_user_can(self::CAPABILITY)) {
            return $links;
        }

        array_unshift($links, sprintf(
            '<a href="%s">%s</a>',
            menu_page_url(self::SLUG, false),
            esc_html__('Settings', 'media-compressor')
        ));

        return $links;
    }

    /**
     * Field key (as stored) => [label, renderer].
     *
     * @return array<string, array{string, callable(): void}>
     */
    private function fields(): array
    {
        return [
            'quality' => [__('Quality', 'media-compressor'), fn () => $this->numberField(
                'quality',
                $this->settings->get()->quality,
                '%',
                sprintf(
                    /* translators: 1: minimum quality, 2: maximum quality */
                    __('%1$d–%2$d. Applies to JPEG and WebP output; PNGs only get smaller by resizing or converting.', 'media-compressor'),
                    Settings::QUALITY_MIN,
                    Settings::QUALITY_MAX
                ),
                min: Settings::QUALITY_MIN,
                max: Settings::QUALITY_MAX,
                step: Settings::QUALITY_STEP,
            )],
            'max_dimension' => [__('Maximum dimension', 'media-compressor'), fn () => $this->numberField(
                'max_dimension',
                $this->settings->get()->maxDimension,
                'px',
                __('Longest edge after resizing. 0 keeps the original dimensions.', 'media-compressor'),
            )],
            'format' => [__('Output format', 'media-compressor'), fn () => $this->formatField(
                $this->settings->get()->format,
                __('Browsers that can\'t produce WebP (Safari) fall back to Keep original.', 'media-compressor'),
            )],
            'threshold' => [__('Skip images smaller than', 'media-compressor'), fn () => $this->numberField(
                'threshold',
                $this->settings->get()->threshold,
                'KB',
                __('Images smaller than this upload straight away without the dialog. 0 shows the dialog for every image.', 'media-compressor'),
            )],
        ];
    }

    private function numberField(
        string $key,
        int $value,
        string $unit,
        string $description,
        int $min = 0,
        ?int $max = null,
        int $step = 1,
    ): void {
        printf(
            '<input type="number" id="%s" name="%s" value="%d" min="%d"%s step="%d" class="small-text" /> %s',
            esc_attr($this->fieldId($key)),
            esc_attr($this->fieldName($key)),
            $value,
            $min,
            $max === null ? '' : sprintf(' max="%d"', $max),
            $step,
            esc_html($unit)
        );
        $this->description($description);
    }

    private function formatField(Format $current, string $description): void
    {
        printf('<select id="%s" name="%s">', esc_attr($this->fieldId('format')), esc_attr($this->fieldName('format')));

        foreach (Format::cases() as $format) {
            printf(
                '<option value="%s" %s>%s</option>',
                esc_attr($format->value),
                selected($current->value, $format->value, false),
                esc_html($format->label())
            );
        }

        echo '</select>';
        $this->description($description);
    }

    private function description(string $text): void
    {
        printf('<p class="description">%s</p>', esc_html($text));
    }

    private function fieldId(string $key): string
    {
        return "media_compressor_{$key}";
    }

    private function fieldName(string $key): string
    {
        return SettingsRepository::OPTION . "[{$key}]";
    }
}
