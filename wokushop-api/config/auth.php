<?php
require_once 'database.php';

class Auth {
    private $db;
    private $secret_key = "wokushop_secret_key_2024"; // Change this in production

    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }

    // Generate JWT token
    public function generateToken($userId, $username, $role) {
        $issuedAt = time();
        $expirationTime = $issuedAt + (3600 * 24); // 24 hours

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

        $header = base64_decode($tokenParts[0]);
        $payload = base64_decode($tokenParts[1]);
        $signatureProvided = $tokenParts[2];

        $base64UrlHeader = $this->base64UrlEncode($header);
        $base64UrlPayload = $this->base64UrlEncode($payload);
        $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $this->secret_key, true);
        $base64UrlSignature = $this->base64UrlEncode($signature);

        if ($base64UrlSignature !== $signatureProvided) {
            return null;
        }

        $payload = json_decode($payload);

        if ($payload->exp < time()) {
            return null;
        }

        return $payload->data;
    }

    private function base64UrlEncode($data) {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    // Verify token from request
    public function verifyToken() {
        $headers = getallheaders();
        $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';

        if (empty($authHeader)) {
            return null;
        }

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
        return $user;
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
}
?>
