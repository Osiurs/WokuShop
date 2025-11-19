<?php
/**
 * Strict Login API - Uses StrictSessionManager
 * Only ONE active session per user allowed
 */
require_once '../config/database.php';
require_once '../config/auth.php';
require_once '../config/strict-session-manager.php';
require_once '../config/ip-helper.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();
$sessionManager = new StrictSessionManager($database);

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

            // Get current IP
            $currentIP = IPHelper::getRealIP();

            // Check if user can login (STRICT MODE)
            $loginCheck = $sessionManager->canUserLogin($row['id'], $currentIP);

            if (!$loginCheck['allowed']) {
                http_response_code(409); // Conflict
                echo json_encode([
                    "success" => false,
                    "message" => $loginCheck['reason'],
                    "existing_session" => [
                        "ip" => $loginCheck['existing_ip'],
                        "since" => $loginCheck['existing_since'],
                        "last_activity" => $loginCheck['last_activity'],
                        "instructions" => $loginCheck['instructions']
                    ],
                    "error_code" => "ACTIVE_SESSION_EXISTS",
                    "mode" => "strict"
                ]);
                exit();
            }

            // Generate token
            $token = $auth->generateToken($row['id'], $row['username'], $row['role']);

            // Create session using StrictSessionManager
            $sessionResult = $sessionManager->createSession($row['id'], $token, $currentIP);

            if (!$sessionResult['success']) {
                http_response_code(500);
                echo json_encode([
                    "success" => false,
                    "message" => "Failed to create session: " . $sessionResult['error']
                ]);
                exit();
            }

            // Fetch assigned accounts for the user
            $accountsQuery = "SELECT a.id, a.service_name, a.service_type, a.description, a.partition_id
                             FROM user_accounts ua
                             JOIN accounts a ON ua.account_id = a.id
                             WHERE ua.user_id = :user_id AND ua.is_active = 1";
            $accountsStmt = $db->prepare($accountsQuery);
            $accountsStmt->execute(['user_id' => $row['id']]);
            $accounts = $accountsStmt->fetchAll(PDO::FETCH_ASSOC);

            // Success response
            http_response_code(200);
            echo json_encode([
                "success" => true,
                "message" => "Login successful (STRICT MODE)",
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
                    "device_fingerprint" => IPHelper::generateDeviceFingerprint(),
                    "user_agent" => IPHelper::getUserAgent(),
                    "reason" => $loginCheck['reason'],
                    "mode" => "strict",
                    "note" => "Only one session allowed per user"
                ]
            ]);

        } else {
            http_response_code(401);
            echo json_encode([
                "success" => false,
                "message" => "Invalid credentials."
            ]);
        }
    } else {
        http_response_code(401);
        echo json_encode([
            "success" => false,
            "message" => "Invalid credentials."
        ]);
    }

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Database error occurred.",
        "error" => $e->getMessage()
    ]);
}
?>