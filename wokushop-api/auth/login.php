<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

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
            // Generate token
            $token = $auth->generateToken($row['id'], $row['username'], $row['role']);

            // Store session
            $expiresAt = date('Y-m-d H:i:s', time() + (3600 * 24));
            $deviceInfo = $_SERVER['HTTP_USER_AGENT'] ?? 'Unknown';

            $query = "INSERT INTO sessions (user_id, token, device_info, expires_at)
                     VALUES (:user_id, :token, :device_info, :expires_at)";
            $stmt = $db->prepare($query);
            $stmt->execute([
                'user_id' => $row['id'],
                'token' => $token,
                'device_info' => $deviceInfo,
                'expires_at' => $expiresAt
            ]);

            http_response_code(200);
            echo json_encode([
                "success" => true,
                "message" => "Login successful.",
                "token" => $token,
                "user" => [
                    "id" => $row['id'],
                    "username" => $row['username'],
                    "role" => $row['role']
                ]
            ]);
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
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Login failed: " . $e->getMessage()
    ]);
}
?>
