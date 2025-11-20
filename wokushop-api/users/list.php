<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify admin authentication
$user = $auth->requireAdmin();

try {
    $search = isset($_GET['search']) ? trim($_GET['search']) : '';

    $query = "SELECT id, username, role, created_at, updated_at FROM users";
    $params = [];

    if (!empty($search)) {
        $query .= " WHERE username LIKE :search";
        $params[':search'] = '%' . $search . '%';
    }

    $query .= " ORDER BY created_at DESC";

    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $users
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch users: " . $e->getMessage()
    ]);
}
?>
