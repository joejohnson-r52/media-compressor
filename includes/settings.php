<?php

/**
 * Settings → Media Compressor: site-wide defaults for the compressor dialog.
 */

namespace MediaCompressor;

if (! defined('ABSPATH')) {
    exit;
}

const OPTION = 'media_compressor';

/**
 * Built-in defaults, used for anything the site hasn't saved.
 *
 * @return array{quality: int, max_dimension: int, format: string, threshold: int}
 */
function default_settings(): array
{
    return [
        'quality' => 80,
        'max_dimension' => 2560,
        'format' => 'original',
        'threshold' => 0,
    ];
}

/**
 * Output formats the dialog offers, as value => label.
 *
 * @return array<string, string>
 */
function format_labels(): array
{
    return [
        'original' => __('Keep original', 'media-compressor'),
        'image/webp' => __('WebP', 'media-compressor'),
        'image/jpeg' => __('JPEG', 'media-compressor'),
    ];
}

/**
 * The site's settings, with defaults for anything missing.
 *
 * Writes are sanitized via register_setting(); sanitizing again on read fills
 * in keys missing from older stored values and guards against values written
 * straight to the database.
 *
 * @return array{quality: int, max_dimension: int, format: string, threshold: int}
 */
function settings(): array
{
    return sanitize_settings(get_option(OPTION, []));
}

/**
 * Clamp submitted values to what the dialog accepts.
 *
 * @param mixed $input
 * @return array{quality: int, max_dimension: int, format: string, threshold: int}
 */
function sanitize_settings($input): array
{
    $input = is_array($input) ? $input : [];
    $defaults = default_settings();

    // Non-negative integer, or the default when empty or non-numeric (e.g. a
    // cleared field). Not absint(), which turns -5 into 5.
    $count = fn ($key) => is_numeric($input[$key] ?? null)
        ? max(0, (int) $input[$key])
        : $defaults[$key];

    // Match the dialog's quality slider: 10–100 in steps of 5.
    $quality = (int) (round(min(100, max(10, $count('quality'))) / 5) * 5);

    $format = $input['format'] ?? null;

    return [
        'quality' => $quality,
        'max_dimension' => $count('max_dimension'),
        'format' => is_string($format) && array_key_exists($format, format_labels())
            ? $format
            : $defaults['format'],
        'threshold' => $count('threshold'),
    ];
}

/**
 * Pass the settings to the script modules that use them, in their units.
 * WordPress prints each as JSON in #wp-script-module-data-{module id}.
 */
add_filter('script_module_data_media-compressor/compressor', function (array $data): array {
    $settings = settings();

    return array_merge($data, [
        'quality' => $settings['quality'] / 100,
        'maxDimension' => $settings['max_dimension'],
        'format' => $settings['format'],
    ]);
});

add_filter('script_module_data_media-compressor', function (array $data): array {
    return array_merge($data, ['threshold' => settings()['threshold'] * 1024]);
});

/**
 * Registered on init rather than admin_init so the sanitize callback applies
 * to every write, including WP-CLI and other plugins' update_option() calls.
 */
add_action('init', function () {
    register_setting('media_compressor', OPTION, [
        'type' => 'object',
        'sanitize_callback' => __NAMESPACE__ . '\\sanitize_settings',
    ]);
});

add_action('admin_init', function () {
    add_settings_section(
        'media_compressor_defaults',
        __('Defaults', 'media-compressor'),
        function () {
            echo '<p>' . esc_html__(
                'The settings the compressor dialog opens with when images are uploaded. They can still be adjusted for each upload.',
                'media-compressor'
            ) . '</p>';
        },
        'media-compressor'
    );

    $number = __NAMESPACE__ . '\\render_number_field';

    $fields = [
        'quality' => [__('Quality', 'media-compressor'), $number, [
            'min' => 10,
            'max' => 100,
            'step' => 5,
            'unit' => '%',
            'description' => __('10–100. Applies to JPEG and WebP output; PNGs only get smaller by resizing or converting.', 'media-compressor'),
        ]],
        'max_dimension' => [__('Maximum dimension', 'media-compressor'), $number, [
            'unit' => 'px',
            'description' => __('Longest edge after resizing. 0 keeps the original dimensions.', 'media-compressor'),
        ]],
        'format' => [__('Output format', 'media-compressor'), __NAMESPACE__ . '\\render_format_field', [
            'description' => __('Browsers that can\'t produce WebP (Safari) fall back to Keep original.', 'media-compressor'),
        ]],
        'threshold' => [__('Skip images smaller than', 'media-compressor'), $number, [
            'unit' => 'KB',
            'description' => __('Images smaller than this upload straight away without the dialog. 0 shows the dialog for every image.', 'media-compressor'),
        ]],
    ];

    foreach ($fields as $key => [$label, $render, $args]) {
        add_settings_field(
            "media_compressor_{$key}",
            $label,
            $render,
            'media-compressor',
            'media_compressor_defaults',
            $args + ['key' => $key, 'label_for' => "media_compressor_{$key}"]
        );
    }
});

/**
 * @param array{key: string, label_for: string, unit: string, description: string, min?: int, max?: int, step?: int} $args
 * @return void
 */
function render_number_field(array $args)
{
    printf(
        '<input type="number" id="%s" name="%s[%s]" value="%d" min="%d"%s step="%d" class="small-text" /> %s',
        esc_attr($args['label_for']),
        esc_attr(OPTION),
        esc_attr($args['key']),
        settings()[$args['key']],
        $args['min'] ?? 0,
        isset($args['max']) ? sprintf(' max="%d"', $args['max']) : '',
        $args['step'] ?? 1,
        esc_html($args['unit'])
    );
    printf('<p class="description">%s</p>', esc_html($args['description']));
}

/**
 * @param array{key: string, label_for: string, description: string} $args
 * @return void
 */
function render_format_field(array $args)
{
    $current = settings()[$args['key']];

    printf('<select id="%s" name="%s[%s]">', esc_attr($args['label_for']), esc_attr(OPTION), esc_attr($args['key']));

    foreach (format_labels() as $value => $label) {
        printf(
            '<option value="%s" %s>%s</option>',
            esc_attr($value),
            selected($current, $value, false),
            esc_html($label)
        );
    }

    echo '</select>';
    printf('<p class="description">%s</p>', esc_html($args['description']));
}

add_action('admin_menu', function () {
    add_options_page(
        __('Media Compressor', 'media-compressor'),
        __('Media Compressor', 'media-compressor'),
        'manage_options',
        'media-compressor',
        function () {
            ?>
            <div class="wrap">
                <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
                <form action="options.php" method="post">
                    <?php
                    settings_fields('media_compressor');
                    do_settings_sections('media-compressor');
                    submit_button();
                    ?>
                </form>
            </div>
            <?php
        }
    );
});

/**
 * Add a Settings link to the plugin's row on the Plugins screen.
 */
add_filter('plugin_action_links_' . plugin_basename(PLUGIN_FILE), function (array $links): array {
    array_unshift($links, sprintf(
        '<a href="%s">%s</a>',
        menu_page_url('media-compressor', false),
        esc_html__('Settings', 'media-compressor')
    ));

    return $links;
});
