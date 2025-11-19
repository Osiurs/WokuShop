<?php
// Simple .env file parser
class Env {
    private static $loaded = false;
    private static $vars = [];

    public static function load($path) {
        if (self::$loaded) {
            return;
        }

        if (!file_exists($path)) {
            return;
        }

        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        foreach ($lines as $line) {
            // Skip comments
            if (strpos(trim($line), '#') === 0) {
                continue;
            }

            // Parse KEY=VALUE
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                $key = trim($key);
                $value = trim($value);

                // Remove quotes if present
                if (preg_match('/^(["\'])(.*)\1$/', $value, $matches)) {
                    $value = $matches[2];
                }

                self::$vars[$key] = $value;

                // Also set in $_ENV and putenv for compatibility
                $_ENV[$key] = $value;
                putenv("$key=$value");
            }
        }

        self::$loaded = true;
    }

    public static function get($key, $default = null) {
        // Try from our vars first
        if (isset(self::$vars[$key])) {
            return self::$vars[$key];
        }

        // Try from $_ENV
        if (isset($_ENV[$key])) {
            return $_ENV[$key];
        }

        // Try from getenv
        $value = getenv($key);
        if ($value !== false) {
            return $value;
        }

        return $default;
    }
}

// Auto-load .env file from project root
$envPath = __DIR__ . '/../.env';
Env::load($envPath);
?>
