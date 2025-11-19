<?php
/**
 * Force Login Endpoint
 * Allow users to force login by terminating existing sessions
 *
 * @author Claude Code
 * @date 2025-01-04
 * @version 1.0
 */

require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/ip-helper.php';
require_once '../config/session-manager.php';

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["success" => false, "message" => "Method not allowed"]);
    exit();
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $auth = new Auth();
    $sessionManager = new SessionManager($database);

    $data = json_decode(file_get_contents("php://input"));

    // Validate input
    if (empty($data->username) || empty($data->password) || !isset($data->force) || !$data->force) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Username, password, and force flag are required."
        ]);
        exit();
    }

    // Verify credentials
    $query = "SELECT id, username, password, role FROM users WHERE username = :username LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->execute(['username' => $data->username]);

    if ($stmt->rowCount() != 1) {
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Invalid credentials"
        ]);
        exit();
    }

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!password_verify($data->password, $row['password'])) {
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Invalid credentials"
        ]);
        exit();
    }

    // Get existing session info for logging
    $existingSession = $sessionManager->checkExistingSession($row['id']);

    // Force logout all existing sessions for this user
    $sessionManager->forceLogoutAllUserSessions($row['id']);

    // Create new session
    $currentIP = IPHelper::getRealIP();
    $token = $auth->generateToken($row['id'], $row['username'], $row['role']);
    $sessionResult = $sessionManager->createSession($row['id'], $token, $currentIP);

    if (!$sessionResult['success']) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Failed to create session: " . $sessionResult['error']
        ]);
        exit();
    }

    // Get user's assigned accounts
    $accountsQuery = "SELECT a.id, a.service_name, a.service_type, a.description, a.partition_id
                     FROM accounts a
                     INNER JOIN user_accounts ua ON a.id = ua.account_id
                     WHERE ua.user_id = :user_id";
    $accountsStmt = $db->prepare($accountsQuery);
    $accountsStmt->execute(['user_id' => $row['id']]);
    $accounts = $accountsStmt->fetchAll(PDO::FETCH_ASSOC);

    // Success response
    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Force login successful - previous session terminated",
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
            "session_id" => $sessionResult['session_id'],
            "forced_login" => true,
            "terminated_session" => $existingSession ? [
                "ip_address" => IPHelper::maskIP($existingSession['ip_address']),
                "last_activity" => $existingSession['last_activity']
            ] : null
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Server error: " . $e->getMessage()
    ]);
}
?>