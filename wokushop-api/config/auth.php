<?php
require_once 'database.php';
require_once __DIR__ . '/env.php';

class Auth {
    private $db;
    private $secret_key;

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
        $this->secret_key = Env::get('JWT_SECRET', 'wokushop_secret_key_2024');
    }

    // Generate JWT token
    public function generateToken($userId, $username, $role) {
        $issuedAt = time();
        $expiry = (int) Env::get('JWT_EXPIRY', 86400); // Default 24 hours
        $expirationTime = $issuedAt + $expiry;

        $payload = [
            'iat' => $issuedAt,
            'exp' => $expirationTime,
            'data' => [
                'id' => $userId,
                'username' => $username,
                'role' => $role
            ]
        ];

        return $this->encode($payload);
    }

    // Simple JWT encode
    private function encode($payload) {
        $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = json_encode($payload);

        $base64UrlHeader = $this->base64UrlEncode($header);
        $base64UrlPayload = $this->base64UrlEncode($payload);

        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $this->secret_key, true);
        $base64UrlSignature = $this->base64UrlEncode($signature);

        return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
    }

    // Simple JWT decode
    public function decode($jwt) {
        $tokenParts = explode('.', $jwt);

        if (count($tokenParts) != 3) {
            return null;
        }

        $base64UrlHeader = $tokenParts[0];
        $base64UrlPayload = $tokenParts[1];
        $signatureProvided = $tokenParts[2];

        // Verify signature
        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $this->secret_key, true);
        $base64UrlSignature = $this->base64UrlEncode($signature);

        if ($base64UrlSignature !== $signatureProvided) {
            return null;
        }

        // Decode payload
        $payload = base64_decode(strtr($base64UrlPayload, '-_', '+/'));
        $payload = json_decode($payload);

        if (!$payload || $payload->exp < time()) {
            return null;
        }

        return $payload->data;
    }

    private function base64UrlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    // Verify token from request
    public function verifyToken() {
        $authHeader = '';

        // WORKAROUND for Cloudflare stripping Authorization header
        // Try X-Auth-Token first (custom header that Cloudflare doesn't strip)
        if (function_exists('getallheaders')) {
            $headers = getallheaders();

            // Method 0: Custom header (Cloudflare-safe)
            if (isset($headers['X-Auth-Token']) && !empty($headers['X-Auth-Token'])) {
                // X-Auth-Token contains token directly (no "Bearer " prefix)
                return $this->decode($headers['X-Auth-Token']);
            }
            if (isset($headers['x-auth-token']) && !empty($headers['x-auth-token'])) {
                return $this->decode($headers['x-auth-token']);
            }

            // Method 1: Standard Authorization header
            $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] :
                         (isset($headers['authorization']) ? $headers['authorization'] : '');
        }

        // Method 2: Apache-specific
        if (empty($authHeader) && isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
        }

        // Method 3: nginx-specific
        if (empty($authHeader) && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
        }

        // Method 4: Custom header via $_SERVER
        if (empty($authHeader) && isset($_SERVER['HTTP_X_AUTH_TOKEN'])) {
            return $this->decode($_SERVER['HTTP_X_AUTH_TOKEN']);
        }

        if (empty($authHeader)) {
            return null;
        }

        // Parse "Bearer <token>" format
        $arr = explode(" ", $authHeader);
        $jwt = isset($arr[1]) ? $arr[1] : '';

        if ($jwt) {
            return $this->decode($jwt);
        }

        return null;
    }

    // Check if user is admin
    public function isAdmin() {
        $user = $this->verifyToken();
        return $user && $user->role === 'admin';
    }

    // Get current user
    public function getCurrentUser() {
        return $this->verifyToken();
    }

    // Require authentication
    public function requireAuth() {
        $user = $this->verifyToken();
        if (!$user) {
            http_response_code(401);
            echo json_encode([
                "success" => false,
                "message" => "Unauthorized. Please login."
            ]);
            die();
        }

        // ⭐ NEW: Check if session is still active in database
        $token = $this->getTokenFromHeaders();
        if ($token && !$this->isSessionActive($token)) {
            http_response_code(401);
            echo json_encode([
                "success" => false,
                "message" => "Session has been terminated. You may have logged in on another device.",
                "reason" => "session_terminated"
            ]);
            die();
        }

        return $user;
    }

    // ⭐ NEW: Check if session is still active in database
    private function isSessionActive($token) {
        // Check in sessions table (strict strategy)
        $query = "SELECT id FROM sessions WHERE token = :token AND is_active = TRUE LIMIT 1";
        $stmt = $this->db->prepare($query);
        $stmt->execute(['token' => $token]);
        if ($stmt->rowCount() > 0) {
            return true;
        }

        // Check in user_ip_sessions table (ip-based strategy)
        $query = "SELECT id FROM user_ip_sessions WHERE session_token = :token AND is_active = TRUE LIMIT 1";
        $stmt = $this->db->prepare($query);
        $stmt->execute(['token' => $token]);
        return $stmt->rowCount() > 0;
    }

    // Require admin
    public function requireAdmin() {
        $user = $this->requireAuth();
        if ($user->role !== 'admin') {
            http_response_code(403);
            echo json_encode([
                "success" => false,
                "message" => "Forbidden. Admin access required."
            ]);
            die();
        }
        return $user;
    }

    public function getTokenFromHeaders() {
        $authHeader = '';
        if (function_exists('getallheaders')) {
            $headers = getallheaders();
            if (isset($headers['X-Auth-Token']) && !empty($headers['X-Auth-Token'])) {
                return $headers['X-Auth-Token'];
            }
            if (isset($headers['x-auth-token']) && !empty($headers['x-auth-token'])) {
                return $headers['x-auth-token'];
            }
            $authHeader = $headers['Authorization'] ?? ($headers['authorization'] ?? '');
        }
        if (empty($authHeader) && isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $authHeader = $_SERVER['HTTP_AUTHORIZATION'];
        }
        if (empty($authHeader)) {
            return null;
        }
        $arr = explode(" ", $authHeader);
        return $arr[1] ?? null;
    }
}
