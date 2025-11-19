<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify authentication
$user = $auth->requireAuth();

$limit = $_GET['limit'] ?? 50;

try {
    if ($user->role === 'admin') {
        // Admin can see all logs
        $query = "SELECT ul.*, u.username
                 FROM usage_logs ul
                 INNER JOIN users u ON ul.user_id = u.id
                 ORDER BY ul.created_at DESC
                 LIMIT :limit";
    } else {
        // Regular users only see their own logs
        $query = "SELECT ul.*, u.username
                 FROM usage_logs ul
                 INNER JOIN users u ON ul.user_id = u.id
                 WHERE ul.user_id = :user_id
                 ORDER BY ul.created_at DESC
                 LIMIT :limit";
    }

    $stmt = $db->prepare($query);
    if ($user->role !== 'admin') {
        $stmt->bindParam(':user_id', $user->id, PDO::PARAM_INT);
    }
    $stmt->bindParam(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $logs
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch logs: " . $e->getMessage()
    ]);
}
?>
