<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify admin authentication
$user = $auth->requireAdmin();

$accountId = $_GET['id'] ?? null;

if (empty($accountId)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Account ID is required."
    ]);
    exit();
}

try {
    $query = "DELETE FROM accounts WHERE id = :id";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':id', $accountId);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        http_response_code(200);
        echo json_encode([
            "success" => true,
            "message" => "Account deleted successfully."
        ]);
    } else {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Account not found."
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to delete account: " . $e->getMessage()
    ]);
}
?>
