<?php

namespace MediaCompressor\Tests\Settings;

use MediaCompressor\Settings\Format;
use PHPUnit\Framework\TestCase;

final class FormatTest extends TestCase
{
    public function testValuesAreWhatTheBrowserEncodesTo(): void
    {
        $this->assertSame(
            ['original', 'image/webp', 'image/jpeg'],
            array_map(fn (Format $format) => $format->value, Format::cases())
        );
    }

    public function testEveryFormatHasALabel(): void
    {
        $this->assertSame('Keep original', Format::Original->label());
        $this->assertSame('WebP', Format::WebP->label());
        $this->assertSame('JPEG', Format::Jpeg->label());
    }
}
