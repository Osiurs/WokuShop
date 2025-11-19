<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify authentication
$currentUser = $auth->requireAuth();

// Get user_id from query parameter
$user_id = isset($_GET['user_id']) ? $_GET['user_id'] : null;

// Access control: admins can view any user, regular users can only view themselves
if ($currentUser->role !== 'admin') {
    $user_id = $currentUser->id;
} elseif (!$user_id) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "User ID is required."
    ]);
    exit();
}

try {
    // Get services assigned to user with full service details
    $query = "SELECT s.*, us.created_at as assigned_at
             FROM services s
             INNER JOIN user_services us ON s.service_type = us.service_type
             WHERE us.user_id = :user_id
             ORDER BY s.display_name ASC";

    $stmt = $db->prepare($query);
    $stmt->execute(['user_id' => $user_id]);
    $services = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // For each service, get additional info
    foreach ($services as &$service) {
        // Get allowed domains
        $domainQuery = "SELECT domain FROM domain_restrictions WHERE service_type = :service_type ORDER BY domain ASC";
        $domainStmt = $db->prepare($domainQuery);
        $domainStmt->execute(['service_type' => $service['service_type']]);
        $service['allowed_domains'] = $domainStmt->fetchAll(PDO::FETCH_COLUMN);

        // Get extensions
        $extensionQuery = "SELECT e.* FROM extensions e
                          INNER JOIN service_extensions se ON e.extension_id = se.extension_id
                          WHERE se.service_type = :service_type AND e.is_active = 1
                          ORDER BY e.extension_name ASC";
        $extensionStmt = $db->prepare($extensionQuery);
        $extensionStmt->execute(['service_type' => $service['service_type']]);
        $service['extensions'] = $extensionStmt->fetchAll(PDO::FETCH_ASSOC);

        // If requires_user_credentials, check if user has created account
        if ($service['requires_user_credentials']) {
            $accountQuery = "SELECT a.* FROM accounts a
                           WHERE a.service_type = :service_type AND a.created_by = :user_id";
            $accountStmt = $db->prepare($accountQuery);
            $accountStmt->execute([
                'service_type' => $service['service_type'],
                'user_id' => $user_id
            ]);
            $account = $accountStmt->fetch(PDO::FETCH_ASSOC);
            $service['user_account'] = $account ?: null;
            $service['has_account'] = $account ? true : false;
        } else {
            // Get assigned accounts for this service
            $accountQuery = "SELECT a.* FROM accounts a
                           INNER JOIN user_accounts ua ON a.id = ua.account_id
                           WHERE ua.user_id = :user_id AND a.service_type = :service_type";
            $accountStmt = $db->prepare($accountQuery);
            $accountStmt->execute([
                'user_id' => $user_id,
                'service_type' => $service['service_type']
            ]);
            $service['assigned_accounts'] = $accountStmt->fetchAll(PDO::FETCH_ASSOC);
        }
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "services" => $services
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch services: " . $e->getMessage()
    ]);
}
?>
