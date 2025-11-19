<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify user authentication
$user = $auth->requireAuth();

// Get service_type from query parameter (optional)
$service_type = isset($_GET['service_type']) ? $_GET['service_type'] : null;

try {
    if ($service_type) {
        // Get specific service account for this user
        $query = "SELECT a.*, s.display_name as service_display_name, s.icon_emoji, s.requires_user_credentials
                 FROM accounts a
                 INNER JOIN user_accounts ua ON a.id = ua.account_id
                 INNER JOIN services s ON a.service_type = s.service_type
                 WHERE ua.user_id = :user_id AND a.service_type = :service_type
                 AND a.created_by = :user_id_created";

        $stmt = $db->prepare($query);
        $stmt->execute([
            'user_id' => $user['id'],
            'service_type' => $service_type,
            'user_id_created' => $user['id']
        ]);

        $account = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($account) {
            http_response_code(200);
            echo json_encode([
                "success" => true,
                "account" => $account
            ]);
        } else {
            http_response_code(404);
            echo json_encode([
                "success" => false,
                "message" => "No account found for this service."
            ]);
        }
    } else {
        // Get all accounts created by this user
        $query = "SELECT a.*, s.display_name as service_display_name, s.icon_emoji, s.requires_user_credentials
                 FROM accounts a
                 INNER JOIN services s ON a.service_type = s.service_type
                 WHERE a.created_by = :user_id
                 ORDER BY a.created_at DESC";

        $stmt = $db->prepare($query);
        $stmt->execute(['user_id' => $user['id']]);

        $accounts = $stmt->fetchAll(PDO::FETCH_ASSOC);

        http_response_code(200);
        echo json_encode([
            "success" => true,
            "accounts" => $accounts
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to retrieve accounts: " . $e->getMessage()
    ]);
}
?>
