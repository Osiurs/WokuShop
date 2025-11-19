<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify user authentication (both admin and regular users can create their own accounts)
$user = $auth->requireAuth();

// Get posted data
$data = json_decode(file_get_contents("php://input"));

if (empty($data->service_type)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Service type is required."
    ]);
    exit();
}

try {
    // Check if service requires user credentials
    $serviceQuery = "SELECT requires_user_credentials, display_name FROM services WHERE service_type = :service_type";
    $serviceStmt = $db->prepare($serviceQuery);
    $serviceStmt->execute(['service_type' => $data->service_type]);
    $service = $serviceStmt->fetch(PDO::FETCH_ASSOC);

    if (!$service) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Service not found."
        ]);
        exit();
    }

    if (!$service['requires_user_credentials']) {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "This service does not allow users to create their own accounts."
        ]);
        exit();
    }

    // Check if user has been assigned this service
    $assignQuery = "SELECT id FROM user_services WHERE user_id = :user_id AND service_type = :service_type";
    $assignStmt = $db->prepare($assignQuery);
    $assignStmt->execute([
        'user_id' => $user['id'],
        'service_type' => $data->service_type
    ]);

    if (!$assignStmt->fetch()) {
        http_response_code(403);
        echo json_encode([
            "success" => false,
            "message" => "You have not been assigned this service. Please contact admin."
        ]);
        exit();
    }

    // Check if user already has an account for this service
    $checkQuery = "SELECT id FROM accounts WHERE service_type = :service_type AND created_by = :user_id";
    $checkStmt = $db->prepare($checkQuery);
    $checkStmt->execute([
        'service_type' => $data->service_type,
        'user_id' => $user['id']
    ]);

    if ($checkStmt->fetch()) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "You already have an account for this service."
        ]);
        exit();
    }

    // Generate unique partition_id for this user+service
    $partition_id = $data->service_type . '_user_' . $user['id'] . '_' . time();
    $service_name = $data->service_name ?? ($service['display_name'] . ' - ' . $user['username']);

    // Create account
    $query = "INSERT INTO accounts (service_name, service_type, description, partition_id, created_by)
             VALUES (:service_name, :service_type, :description, :partition_id, :created_by)";

    $stmt = $db->prepare($query);
    $stmt->execute([
        'service_name' => $service_name,
        'service_type' => $data->service_type,
        'description' => $data->description ?? '',
        'partition_id' => $partition_id,
        'created_by' => $user['id']
    ]);

    $account_id = $db->lastInsertId();

    // Auto-assign this account to the creator
    $assignQuery = "INSERT INTO user_accounts (user_id, account_id) VALUES (:user_id, :account_id)";
    $assignStmt = $db->prepare($assignQuery);
    $assignStmt->execute([
        'user_id' => $user['id'],
        'account_id' => $account_id
    ]);

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Account created successfully.",
        "account" => [
            "id" => $account_id,
            "service_name" => $service_name,
            "service_type" => $data->service_type,
            "partition_id" => $partition_id
        ]
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to create account: " . $e->getMessage()
    ]);
}
?>
