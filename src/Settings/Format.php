<?php

namespace MediaCompressor\Settings;

/**
 * Output format for compressed images. Values are the mime types the browser
 * encodes to, or 'original' to keep each image's own format.
 */
enum Format: string
{
    case Original = 'original';
    case WebP = 'image/webp';
    case Jpeg = 'image/jpeg';

    public function label(): string
    {
        return match ($this) {
            self::Original => __('Keep original', 'media-compressor'),
            self::WebP => __('WebP', 'media-compressor'),
            self::Jpeg => __('JPEG', 'media-compressor'),
        };
    }
}
