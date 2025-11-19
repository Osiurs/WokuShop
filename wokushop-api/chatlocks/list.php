<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify admin authentication
$user = $auth->requireAdmin();

try {
    $query = "SELECT cl.*, a.service_name as account_name, u.username
             FROM chat_locks cl
             INNER JOIN accounts a ON cl.account_id = a.id
             INNER JOIN users u ON cl.user_id = u.id
             ORDER BY cl.created_at DESC";

    $stmt = $db->prepare($query);
    $stmt->execute();
    $locks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $locks
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch chat locks: " . $e->getMessage()
    ]);
}
?>
