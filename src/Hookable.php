<?php

namespace MediaCompressor;

/**
 * A component that attaches itself to WordPress hooks.
 *
 * Constructing a component has no side effects; nothing touches WordPress
 * until register() is called (see Plugin::boot()).
 */
interface Hookable
{
    public function register(): void;
}
