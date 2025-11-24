<?php
/**
 * Check Session Validity API
 * Validates if the current session token is still active
 * Used for detecting when user has been logged out on another device
 */
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/unified-session-manager.php';

header('Content-Type: application/json');

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();
$sessionManager = new UnifiedSessionManager($database);

// Get token from headers
$headers = getallheaders();
$token = null;

if (isset($headers['X-Auth-Token'])) {
    $token = $headers['X-Auth-Token'];
} elseif (isset($headers['Authorization'])) {
    $token = str_replace('Bearer ', '', $headers['Authorization']);
}

if (empty($token)) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "valid" => false,
        "message" => "No token provided"
    ]);
    exit();
}

try {
    // Verify and decode token
    $decoded = $auth->verifyToken($token);

    if (!$decoded) {
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "valid" => false,
            "message" => "Invalid token"
        ]);
        exit();
    }

    // Check if session is still active in database
    $sessionInfo = $sessionManager->validateSessionToken($token);

    if ($sessionInfo === false) {
        // Session is not active (logged out on another device)
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "valid" => false,
            "message" => "Session has been terminated. You may have logged in on another device.",
            "reason" => "session_terminated"
        ]);
        exit();
    }

    // Session is valid
    http_response_code(200);
    echo json_encode([
        "success" => true,
        "valid" => true,
        "message" => "Session is active",
        "session_info" => [
            "user_id" => $decoded->user_id,
            "username" => $decoded->username,
            "role" => $decoded->role,
            "last_activity" => $sessionInfo['last_activity'] ?? null,
            "strategy" => $sessionInfo['strategy'] ?? 'unknown'
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "valid" => false,
        "message" => "Session check failed: " . $e->getMessage()
    ]);
}
?>
