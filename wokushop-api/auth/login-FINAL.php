<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

/**
 * Login API - FINAL VERSION
 * FORCE LOGOUT old sessions automatically - NO BLOCKING
 *
 * When user logs in on device B, device A session is terminated automatically.
 * No "already has session" error - just logout old and create new.
 */

require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/unified-session-manager.php';
require_once '../config/ip-helper.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token");

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();
$sessionManager = new UnifiedSessionManager($database);

// Get posted data
$data = json_decode(file_get_contents("php://input"));

if (empty($data->username) || empty($data->password)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Username and password are required."
    ]);
    exit();
}

try {
    // Query user
    $query = "SELECT id, username, password, role FROM users WHERE username = :username LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':username', $data->username);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (password_verify($data->password, $row['password'])) {
            // Get current IP address
            $currentIP = IPHelper::getRealIP();

            // ⭐ CRITICAL: Force logout ALL existing sessions FIRST
            // This ensures single session per user - no blocking, just auto logout old sessions
            error_log("[LOGIN] Force logging out all sessions for user ID: " . $row['id']);
            $sessionManager->forceLogoutAllUserSessions($row['id']);
            error_log("[LOGIN] All old sessions terminated successfully");

            // Generate new token
            $token = $auth->generateToken($row['id'], $row['username'], $row['role']);

            // Create NEW session (old ones are already logged out)
            error_log("[LOGIN] Creating new session for user ID: " . $row['id']);
            $sessionResult = $sessionManager->createSession($row['id'], $token, $currentIP);

            if (!$sessionResult['success']) {
                http_response_code(500);
                echo json_encode([
                    "success" => false,
                    "message" => "Failed to create session: " . ($sessionResult['error'] ?? 'Unknown error')
                ]);
                exit();
            }

            error_log("[LOGIN] New session created successfully. Session ID: " . ($sessionResult['session_id'] ?? 'N/A'));

            // Fetch assigned accounts for the user
            $accountsQuery = "SELECT a.id, a.service_name, a.service_type, a.description, a.partition_id
                              FROM accounts a
                              INNER JOIN user_accounts ua ON a.id = ua.account_id
                              WHERE ua.user_id = :user_id AND ua.is_active = 1";
            $accountsStmt = $db->prepare($accountsQuery);
            $accountsStmt->execute(['user_id' => $row['id']]);
            $accounts = $accountsStmt->fetchAll(PDO::FETCH_ASSOC);

            // Success response
            http_response_code(200);
            echo json_encode([
                "success" => true,
                "message" => "Login successful. Previous sessions have been terminated.",
                "token" => $token,
                "user" => [
                    "id" => $row['id'],
                    "username" => $row['username'],
                    "role" => $row['role'],
                    "accounts" => $accounts
                ],
                "session_info" => [
                    "ip_address" => IPHelper::maskIP($currentIP),
                    "login_time" => date('Y-m-d H:i:s'),
                    "session_id" => $sessionResult['session_id'] ?? null,
                    "device_fingerprint" => IPHelper::generateDeviceFingerprint(),
                    "user_agent" => IPHelper::getUserAgent(),
                    "strategy" => $sessionResult['strategy'] ?? 'strict',
                    "strategy_description" => $sessionResult['strategy_description'] ?? 'Single session per user'
                ]
            ]);

            error_log("[LOGIN] Login successful for user: " . $row['username']);

        } else {
            http_response_code(401);
            echo json_encode([
                "success" => false,
                "message" => "Invalid username or password."
            ]);
        }
    } else {
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Invalid username or password."
        ]);
    }

} catch (PDOException $e) {
    error_log("[LOGIN ERROR] PDO Exception: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Login failed: " . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("[LOGIN ERROR] Exception: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Login failed: " . $e->getMessage()
    ]);
}
?>
