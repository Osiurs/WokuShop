<?php
/**
 * Logout API - Uses UnifiedSessionManager for session management
 * Properly handles session cleanup for single session mode
 */
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/unified-session-manager.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();
$sessionManager = new UnifiedSessionManager($database);

// Verify authentication
$user = $auth->requireAuth();

try {
    // Get token from Authorization header
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    $arr = explode(" ", $authHeader);
    $token = isset($arr[1]) ? $arr[1] : '';

    if ($token) {
        // Use UnifiedSessionManager to logout (properly handles session cleanup)
        $logoutResult = $sessionManager->logoutSession($user->id, $token);

        if ($logoutResult['success']) {
            http_response_code(200);
            echo json_encode([
                "success" => true,
                "message" => $logoutResult['message'] ?? "Logout successful.",
                "strategy" => $logoutResult['strategy'] ?? 'unknown'
            ]);
        } else {
            http_response_code(500);
            echo json_encode([
                "success" => false,
                "message" => $logoutResult['error'] ?? "Logout failed."
            ]);
        }
    } else {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Token not provided."
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Logout failed: " . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Logout failed: " . $e->getMessage()
    ]);
}
?>
