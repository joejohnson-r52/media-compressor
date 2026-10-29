<?php

namespace MediaCompressor\Tests\Settings;

use MediaCompressor\Settings\Format;
use MediaCompressor\Settings\Settings;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class SettingsTest extends TestCase
{
    public function testDefaults(): void
    {
        $settings = new Settings();

        $this->assertSame(80, $settings->quality);
        $this->assertSame(2560, $settings->maxDimension);
        $this->assertSame(Format::Original, $settings->format);
        $this->assertSame(0, $settings->threshold);
    }

    public function testFromInputKeepsValidValues(): void
    {
        $settings = Settings::fromInput([
            'quality' => '70',
            'max_dimension' => '1920',
            'format' => 'image/webp',
            'threshold' => '230',
        ]);

        $this->assertEquals(new Settings(70, 1920, Format::WebP, 230), $settings);
    }

    /**
     * @return iterable<string, array{mixed, Settings}>
     */
    public static function invalidInput(): iterable
    {
        yield 'not an array' => ['junk', new Settings()];
        yield 'empty array' => [[], new Settings()];
        yield 'cleared fields fall back to defaults' => [
            ['quality' => '', 'max_dimension' => '', 'threshold' => 'abc'],
            new Settings(),
        ];
        yield 'negatives become 0, not their absolute value' => [
            ['max_dimension' => '-5', 'threshold' => '-100'],
            new Settings(maxDimension: 0, threshold: 0),
        ];
        yield 'unknown format' => [['format' => 'image/gif'], new Settings()];
        yield 'non-string format' => [['format' => ['image/webp']], new Settings()];
        yield 'non-numeric types' => [
            ['quality' => 'high', 'max_dimension' => [1]],
            new Settings(),
        ];
    }

    #[DataProvider('invalidInput')]
    public function testFromInputFallsBackForInvalidValues(mixed $input, Settings $expected): void
    {
        $this->assertEquals($expected, Settings::fromInput($input));
    }

    /**
     * @return iterable<string, array{string, int}>
     */
    public static function qualities(): iterable
    {
        yield 'above the maximum' => ['999', 100];
        yield 'below the minimum' => ['3', 10];
        yield 'rounds down to the nearest step' => ['72', 70];
        yield 'rounds up to the nearest step' => ['73', 75];
    }

    #[DataProvider('qualities')]
    public function testFromInputClampsQualityToTheSlider(string $input, int $expected): void
    {
        $this->assertSame($expected, Settings::fromInput(['quality' => $input])->quality);
    }

    public function testToArrayUsesTheStoredOptionShape(): void
    {
        $this->assertSame(
            ['quality' => 70, 'max_dimension' => 1920, 'format' => 'image/webp', 'threshold' => 230],
            (new Settings(70, 1920, Format::WebP, 230))->toArray()
        );
    }

    public function testToArrayRoundTripsThroughFromInput(): void
    {
        $settings = new Settings(70, 1920, Format::Jpeg, 230);

        $this->assertEquals($settings, Settings::fromInput($settings->toArray()));
    }

    public function testToScriptDataUsesBrowserUnits(): void
    {
        $this->assertSame(
            ['quality' => 0.7, 'maxDimension' => 1920, 'format' => 'image/webp', 'threshold' => 235520],
            (new Settings(70, 1920, Format::WebP, 230))->toScriptData()
        );
    }
}
