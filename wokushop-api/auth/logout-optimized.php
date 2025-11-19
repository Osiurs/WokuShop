<?php
/**
 * Optimized Logout API - Fast response with background cleanup
 * Returns immediately while performing cleanup in background
 */
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/unified-session-manager.php';
require_once '../config/ip-helper.php';

// Set response headers immediately
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "success" => false,
        "message" => "Method not allowed"
    ]);
    exit();
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $auth = new Auth();
    $sessionManager = new UnifiedSessionManager($database);

    // Get token from headers (multiple sources for compatibility)
    $token = null;
    $headers = getallheaders();
    
    if (isset($headers['X-Auth-Token'])) {
        $token = $headers['X-Auth-Token'];
    } elseif (isset($headers['Authorization'])) {
        $authHeader = $headers['Authorization'];
        if (preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches)) {
            $token = $matches[1];
        }
    }

    // If no token provided, still return success (already logged out)
    if (!$token) {
        http_response_code(200);
        echo json_encode([
            "success" => true,
            "message" => "Already logged out",
            "logout_time" => date('Y-m-d H:i:s')
        ]);
        exit();
    }

    // Verify token and get user info quickly
    $decoded = $auth->verifyToken($token);
    if (!$decoded) {
        // Invalid token - still return success (effectively logged out)
        http_response_code(200);
        echo json_encode([
            "success" => true,
            "message" => "Session expired - logged out",
            "logout_time" => date('Y-m-d H:i:s')
        ]);
        exit();
    }

    $userId = $decoded->user_id;
    $currentIP = IPHelper::getRealIP();

    // Return success response immediately
    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Logout successful",
        "logout_time" => date('Y-m-d H:i:s'),
        "user_id" => $userId
    ]);

    // Flush output to client immediately
    if (ob_get_level()) {
        ob_end_flush();
    }
    flush();

    // Continue with background cleanup (client already received response)
    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    }

    // Background session cleanup
    try {
        // Remove session from unified session manager
        $sessionManager->removeSession($userId, $currentIP);
        
        // Clean up expired sessions (batch operation)
        $cleanupQuery = "DELETE FROM sessions WHERE expires_at < NOW()";
        $db->exec($cleanupQuery);
        
        // Clean up old user sessions (older than 30 days)
        $oldSessionQuery = "DELETE FROM user_sessions WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)";
        $db->exec($oldSessionQuery);
        
        // Log logout activity (non-blocking)
        $logQuery = "INSERT INTO usage_logs (user_id, action, details) VALUES (?, 'logout', ?)";
        $logStmt = $db->prepare($logQuery);
        $logDetails = json_encode([
            'ip_address' => IPHelper::maskIP($currentIP),
            'user_agent' => IPHelper::getUserAgent(),
            'logout_time' => date('Y-m-d H:i:s')
        ]);
        $logStmt->execute([$userId, $logDetails]);
        
    } catch (Exception $cleanupError) {
        // Log cleanup errors but don't affect the response
        error_log("Logout cleanup error: " . $cleanupError->getMessage());
    }

} catch (Exception $e) {
    // Even if there's an error, return success for logout
    // This prevents users from getting stuck in logged-in state
    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Logout completed (with cleanup error)",
        "logout_time" => date('Y-m-d H:i:s'),
        "error" => $e->getMessage()
    ]);
}
?>
