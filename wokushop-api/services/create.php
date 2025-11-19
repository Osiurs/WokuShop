<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify authentication and admin role
$user = $auth->requireAuth();
if ($user->role !== 'admin') {
    http_response_code(403);
    echo json_encode([
        "success" => false,
        "message" => "Only admins can create services"
    ]);
    exit;
}

// Get POST data
$data = json_decode(file_get_contents("php://input"));

// Validate required fields
if (empty($data->service_type) || empty($data->display_name) || empty($data->login_url)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Missing required fields: service_type, display_name, login_url"
    ]);
    exit;
}

try {
    // Check if service type already exists
    $checkQuery = "SELECT id FROM services WHERE service_type = :service_type";
    $checkStmt = $db->prepare($checkQuery);
    $checkStmt->bindParam(':service_type', $data->service_type);
    $checkStmt->execute();

    if ($checkStmt->rowCount() > 0) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "Service type already exists"
        ]);
        exit;
    }

    // Insert new service
    $query = "INSERT INTO services (service_type, display_name, login_url, description, icon_emoji, is_active)
              VALUES (:service_type, :display_name, :login_url, :description, :icon_emoji, :is_active)";

    $stmt = $db->prepare($query);
    $stmt->bindParam(':service_type', $data->service_type);
    $stmt->bindParam(':display_name', $data->display_name);
    $stmt->bindParam(':login_url', $data->login_url);

    $description = isset($data->description) ? $data->description : null;
    $stmt->bindParam(':description', $description);

    $icon_emoji = isset($data->icon_emoji) ? $data->icon_emoji : '🌐';
    $stmt->bindParam(':icon_emoji', $icon_emoji);

    $is_active = isset($data->is_active) ? $data->is_active : true;
    $stmt->bindParam(':is_active', $is_active, PDO::PARAM_BOOL);

    $stmt->execute();

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "Service created successfully",
        "service_id" => $db->lastInsertId()
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to create service: " . $e->getMessage()
    ]);
}
?>
