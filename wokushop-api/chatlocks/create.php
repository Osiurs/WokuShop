<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify admin authentication
$user = $auth->requireAdmin();

// Get posted data
$data = json_decode(file_get_contents("php://input"));

if (empty($data->account_id) || empty($data->user_id) || empty($data->chat_id)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Account ID, User ID, and Chat ID are required."
    ]);
    exit();
}

try {
    $query = "INSERT INTO chat_locks (account_id, user_id, chat_id)
             VALUES (:account_id, :user_id, :chat_id)";

    $stmt = $db->prepare($query);
    $stmt->execute([
        'account_id' => $data->account_id,
        'user_id' => $data->user_id,
        'chat_id' => $data->chat_id
    ]);

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Chat lock created successfully.",
        "id" => $db->lastInsertId()
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to create chat lock: " . $e->getMessage()
    ]);
}
?>
