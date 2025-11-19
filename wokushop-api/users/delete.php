<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify admin authentication
$user = $auth->requireAdmin();

$userId = $_GET['id'] ?? null;

if (empty($userId)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "User ID is required."
    ]);
    exit();
}

// Prevent deleting yourself
if ($userId == $user->id) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "You cannot delete your own account."
    ]);
    exit();
}

try {
    $query = "DELETE FROM users WHERE id = :id";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':id', $userId);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        http_response_code(200);
        echo json_encode([
            "success" => true,
            "message" => "User deleted successfully."
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
        "message" => "Failed to delete user: " . $e->getMessage()
    ]);
}
?>
