<?php
/**
 * IP Helper Class
 * Handles IP address detection and device fingerprinting
 *
 * @author Claude Code
 * @date 2025-01-04
 * @version 1.0
 */

class IPHelper {

    /**
     * Get real client IP address with multi-layer detection
     * Handles Cloudflare, proxies, load balancers
     *
     * @return string IP address
     */
    public static function getRealIP() {
        // Priority order for getting real IP
        $ipKeys = [
            'HTTP_CF_CONNECTING_IP',     // Cloudflare
            'HTTP_CLIENT_IP',            // Proxy
            'HTTP_X_FORWARDED_FOR',      // Load balancer/proxy
            'HTTP_X_FORWARDED',          // Proxy
            'HTTP_X_CLUSTER_CLIENT_IP',  // Cluster
            'HTTP_FORWARDED_FOR',        // Proxy
            'HTTP_FORWARDED',            // Proxy
            'REMOTE_ADDR'                // Direct connection
        ];

        foreach ($ipKeys as $key) {
            if (isset($_SERVER[$key]) && !empty($_SERVER[$key])) {
                $ip = $_SERVER[$key];

                // Handle comma-separated IPs (X-Forwarded-For can have multiple IPs)
                if (strpos($ip, ',') !== false) {
                    $ip = trim(explode(',', $ip)[0]);
                }

                // Validate IP and prefer public IPs
                if (filter_var($ip, FILTER_VALIDATE_IP,
                    FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    return $ip;
                }
            }
        }

        // Fallback - allow private IPs for development
        $fallbackIP = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

        // Log for debugging in development
        if (defined('DEBUG_MODE') && DEBUG_MODE) {
            error_log("[IPHelper] Using fallback IP: " . $fallbackIP);
        }

        return $fallbackIP;
    }

    /**
     * Get user agent string
     *
     * @return string User agent
     */
    public static function getUserAgent() {
        return $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
    }

    /**
     * Generate device fingerprint from browser headers
     *
     * @return string MD5 hash of device characteristics
     */
    public static function generateDeviceFingerprint() {
        $userAgent = self::getUserAgent();
        $acceptLanguage = $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '';
        $acceptEncoding = $_SERVER['HTTP_ACCEPT_ENCODING'] ?? '';
        $acceptCharset = $_SERVER['HTTP_ACCEPT_CHARSET'] ?? '';

        // Create fingerprint from browser characteristics
        $fingerprint = $userAgent . '|' . $acceptLanguage . '|' . $acceptEncoding . '|' . $acceptCharset;

        return md5($fingerprint);
    }

    /**
     * Check if IP is in whitelist (for admin access, etc.)
     *
     * @param string $ip IP address to check
     * @param array $whitelist Array of whitelisted IPs/ranges
     * @return boolean
     */
    public static function isIPWhitelisted($ip, $whitelist = []) {
        if (empty($whitelist)) {
            return false;
        }

        foreach ($whitelist as $whitelistedIP) {
            // Direct match
            if ($ip === $whitelistedIP) {
                return true;
            }

            // CIDR range match (e.g., 192.168.1.0/24)
            if (strpos($whitelistedIP, '/') !== false) {
                if (self::ipInRange($ip, $whitelistedIP)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if IP is in CIDR range
     *
     * @param string $ip IP to check
     * @param string $range CIDR range (e.g., 192.168.1.0/24)
     * @return boolean
     */
    private static function ipInRange($ip, $range) {
        list($subnet, $bits) = explode('/', $range);

        $ip = ip2long($ip);
        $subnet = ip2long($subnet);
        $mask = -1 << (32 - $bits);
        $subnet &= $mask;

        return ($ip & $mask) == $subnet;
    }

    /**
     * Mask IP address for privacy (show only first 3 octets)
     *
     * @param string $ip IP address to mask
     * @return string Masked IP
     */
    public static function maskIP($ip) {
        // IPv4 masking: 192.168.1.100 -> 192.168.1.***
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $parts = explode('.', $ip);
            if (count($parts) === 4) {
                return $parts[0] . '.' . $parts[1] . '.' . $parts[2] . '.***';
            }
        }

        // IPv6 masking: 2001:db8::1 -> 2001:db8::***
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            $parts = explode(':', $ip);
            if (count($parts) >= 3) {
                return $parts[0] . ':' . $parts[1] . ':***';
            }
        }

        return 'unknown';
    }

    /**
     * Get location info from IP (if GeoIP is available)
     *
     * @param string $ip IP address
     * @return array Location info
     */
    public static function getLocationInfo($ip) {
        // Placeholder for GeoIP integration
        // Can be implemented with MaxMind GeoIP2 or similar
        return [
            'country' => 'Unknown',
            'city' => 'Unknown',
            'region' => 'Unknown'
        ];
    }
}
?>