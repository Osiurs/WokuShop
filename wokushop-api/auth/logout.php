<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify authentication
$user = $auth->requireAuth();

try {
    // Delete session
    $headers = getallheaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    $arr = explode(" ", $authHeader);
    $token = isset($arr[1]) ? $arr[1] : '';

    if ($token) {
        $query = "DELETE FROM sessions WHERE token = :token AND user_id = :user_id";
        $stmt = $db->prepare($query);
        $stmt->execute([
            'token' => $token,
            'user_id' => $user->id
        ]);
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Logout successful."
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Logout failed: " . $e->getMessage()
    ]);
}
?>
