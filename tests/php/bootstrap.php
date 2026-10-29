<?php

/**
 * Unit tests run without WordPress: stub the few WordPress functions the
 * tested classes call.
 */

require_once __DIR__ . '/../../vendor/autoload.php';

if (! function_exists('__')) {
    function __(string $text, string $domain = 'default'): string
    {
        return $text;
    }
}
