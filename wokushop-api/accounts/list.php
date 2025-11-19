<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify authentication
$user = $auth->requireAuth();

try {
    if ($user->role === 'admin') {
        // Admin can see all accounts with creator info
        $query = "SELECT a.*, u.username as created_by_username, s.requires_user_credentials
                 FROM accounts a
                 LEFT JOIN users u ON a.created_by = u.id
                 LEFT JOIN services s ON a.service_type = s.service_type
                 ORDER BY a.created_at DESC";
        $stmt = $db->prepare($query);
    } else {
        // Regular users only see their assigned accounts with creator info
        $query = "SELECT a.*, u.username as created_by_username, s.requires_user_credentials
                 FROM accounts a
                 INNER JOIN user_accounts ua ON a.id = ua.account_id
                 LEFT JOIN users u ON a.created_by = u.id
                 LEFT JOIN services s ON a.service_type = s.service_type
                 WHERE ua.user_id = :user_id
                 ORDER BY a.created_at DESC";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':user_id', $user->id);
    }

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
