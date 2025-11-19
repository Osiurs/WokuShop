<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify authentication
$user = $auth->requireAuth();

// Get posted data
$data = json_decode(file_get_contents("php://input"));

if (empty($data->action)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Action is required."
    ]);
    exit();
}

try {
    $query = "INSERT INTO usage_logs (user_id, action, details) VALUES (:user_id, :action, :details)";
    $stmt = $db->prepare($query);
    $stmt->execute([
        'user_id' => $user->id,
        'action' => $data->action,
        'details' => $data->details ?? null
    ]);

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Log created successfully.",
        "id" => $db->lastInsertId()
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to create log: " . $e->getMessage()
    ]);
}
?>
