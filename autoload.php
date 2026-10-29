<?php

/**
 * PSR-4 autoloader for MediaCompressor\ => src/, for installs without
 * Composer. Composer installs use the "autoload" section of composer.json.
 */

spl_autoload_register(static function (string $class): void {
    $prefix = 'MediaCompressor\\';

    if (! str_starts_with($class, $prefix)) {
        return;
    }

    $path = __DIR__ . '/src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';

    if (is_file($path)) {
        require $path;
    }
});
