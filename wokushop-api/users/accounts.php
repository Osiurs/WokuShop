<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify authentication
$user = $auth->requireAuth();

$userId = $_GET['user_id'] ?? null;

if (empty($userId)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "User ID is required."
    ]);
    exit();
}

// Only admin can view other users' accounts
if ($user->role !== 'admin' && $userId != $user->id) {
    http_response_code(403);
    echo json_encode([
        "success" => false,
        "message" => "Forbidden."
    ]);
    exit();
}

try {
    $query = "SELECT a.* FROM accounts a
             INNER JOIN user_accounts ua ON a.id = ua.account_id
             WHERE ua.user_id = :user_id
             ORDER BY a.created_at DESC";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':user_id', $userId);
    $stmt->execute();
    $accounts = $stmt->fetchAll(PDO::FETCH_ASSOC);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $accounts
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch accounts: " . $e->getMessage()
    ]);
}
?>
