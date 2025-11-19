<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Require admin authentication
$adminUser = $auth->requireAdmin();

// Get posted data
$data = json_decode(file_get_contents("php://input"));

if (empty($data->user_id)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "User ID is required."
    ]);
    exit();
}

try {
    // Query target user
    $query = "SELECT id, username, role FROM users WHERE id = :user_id LIMIT 1";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':user_id', $data->user_id);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        // Prevent admin from logging in as another admin (optional security)
        if ($row['role'] === 'admin') {
            http_response_code(403);
            echo json_encode([
                "success" => false,
                "message" => "Cannot login as another admin user."
            ]);
            exit();
        }

        // Generate token for the target user
        $token = $auth->generateToken($row['id'], $row['username'], $row['role']);

        // Store session
        $expiresAt = date('Y-m-d H:i:s', time() + (3600 * 24));
        $deviceInfo = ($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown') . ' (Admin Login As)';

        $query = "INSERT INTO sessions (user_id, token, device_info, expires_at)
                 VALUES (:user_id, :token, :device_info, :expires_at)";
        $stmt = $db->prepare($query);
        $stmt->execute([
            'user_id' => $row['id'],
            'token' => $token,
            'device_info' => $deviceInfo,
            'expires_at' => $expiresAt
        ]);

        // Log the activity
        $logQuery = "INSERT INTO usage_logs (user_id, action, details)
                     VALUES (:admin_id, :action, :details)";
        $logStmt = $db->prepare($logQuery);
        $logStmt->execute([
            'admin_id' => $adminUser->id,
            'action' => 'admin_login_as',
            'details' => json_encode([
                'target_user_id' => $row['id'],
                'target_username' => $row['username']
            ])
        ]);

        http_response_code(200);
        echo json_encode([
            "success" => true,
            "message" => "Successfully logged in as " . $row['username'],
            "token" => $token,
            "user" => [
                "id" => $row['id'],
                "username" => $row['username'],
                "role" => $row['role']
            ],
            "is_admin_session" => true,
            "original_admin" => $adminUser->username
        ]);
    } else {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "User not found."
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Login failed: " . $e->getMessage()
    ]);
}
?>
