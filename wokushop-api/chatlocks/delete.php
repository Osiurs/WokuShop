<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify admin authentication
$user = $auth->requireAdmin();

$lockId = $_GET['id'] ?? null;

if (empty($lockId)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Lock ID is required."
    ]);
    exit();
}

try {
    $query = "DELETE FROM chat_locks WHERE id = :id";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':id', $lockId);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        http_response_code(200);
        echo json_encode([
            "success" => true,
            "message" => "Chat lock deleted successfully."
        ]);
    } else {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Chat lock not found."
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to delete chat lock: " . $e->getMessage()
    ]);
}
?>
