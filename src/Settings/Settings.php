<?php

namespace MediaCompressor\Settings;

/**
 * The site's compressor defaults, as set under Settings → Media Compressor.
 *
 * Immutable. Build it from untrusted input (a form submission or the stored
 * option) with fromInput(), which clamps every value to what the dialog
 * accepts.
 */
final class Settings
{
    /** Quality slider range, in percent. The dialog's slider matches it. */
    public const QUALITY_MIN = 10;
    public const QUALITY_MAX = 100;
    public const QUALITY_STEP = 5;

    /**
     * @param int    $quality      Percent, QUALITY_MIN–QUALITY_MAX in QUALITY_STEP steps.
     * @param int    $maxDimension Longest edge in px; 0 keeps the original dimensions.
     * @param Format $format       Output format.
     * @param int    $threshold    In KB; smaller images skip the dialog. 0 holds every image.
     */
    public function __construct(
        public readonly int $quality = 80,
        public readonly int $maxDimension = 2560,
        public readonly Format $format = Format::Original,
        public readonly int $threshold = 0,
    ) {
    }

    /**
     * @param mixed $input Values keyed as in toArray(). Anything missing, empty
     *                     or invalid falls back to the default.
     */
    public static function fromInput(mixed $input): self
    {
        $input = is_array($input) ? $input : [];
        $defaults = new self();
        $format = $input['format'] ?? null;

        return new self(
            quality: self::clampQuality(self::count($input, 'quality', $defaults->quality)),
            maxDimension: self::count($input, 'max_dimension', $defaults->maxDimension),
            format: (is_string($format) ? Format::tryFrom($format) : null) ?? $defaults->format,
            threshold: self::count($input, 'threshold', $defaults->threshold),
        );
    }

    /**
     * The stored option's shape.
     *
     * @return array{quality: int, max_dimension: int, format: string, threshold: int}
     */
    public function toArray(): array
    {
        return [
            'quality' => $this->quality,
            'max_dimension' => $this->maxDimension,
            'format' => $this->format->value,
            'threshold' => $this->threshold,
        ];
    }

    /**
     * Settings for the browser, in the units it uses: quality as 0–1 (canvas
     * encoding) and the threshold in bytes (File.size).
     *
     * @return array{quality: float, maxDimension: int, format: string, threshold: int}
     */
    public function toScriptData(): array
    {
        return [
            'quality' => $this->quality / 100,
            'maxDimension' => $this->maxDimension,
            'format' => $this->format->value,
            'threshold' => $this->threshold * 1024,
        ];
    }

    /**
     * A non-negative integer, or the default when the value is empty or
     * non-numeric (e.g. a cleared field). Not absint(), which turns -5 into 5.
     *
     * @param array<string, mixed> $input
     */
    private static function count(array $input, string $key, int $default): int
    {
        $value = $input[$key] ?? null;

        return is_numeric($value) ? max(0, (int) $value) : $default;
    }

    private static function clampQuality(int $quality): int
    {
        $clamped = min(self::QUALITY_MAX, max(self::QUALITY_MIN, $quality));

        return (int) (round($clamped / self::QUALITY_STEP) * self::QUALITY_STEP);
    }
}
