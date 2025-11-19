<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify admin authentication
$user = $auth->requireAdmin();

// Get posted data
$data = json_decode(file_get_contents("php://input"));

if (empty($data->service_name) || empty($data->service_type) || empty($data->partition_id)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Service name, type, and partition ID are required."
    ]);
    exit();
}

try {
    // Admin can optionally set created_by when creating accounts
    $created_by = isset($data->created_by) ? $data->created_by : null;

    $query = "INSERT INTO accounts (service_name, service_type, description, partition_id, created_by)
             VALUES (:service_name, :service_type, :description, :partition_id, :created_by)";

    $stmt = $db->prepare($query);
    $stmt->execute([
        'service_name' => $data->service_name,
        'service_type' => $data->service_type,
        'description' => $data->description ?? '',
        'partition_id' => $data->partition_id,
        'created_by' => $created_by
    ]);

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Account created successfully.",
        "id" => $db->lastInsertId()
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to create account: " . $e->getMessage()
    ]);
}
?>
