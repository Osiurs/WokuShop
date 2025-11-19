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
        "message" => "Only admins can update services"
    ]);
    exit;
}

// Get POST data
$data = json_decode(file_get_contents("php://input"));

// Validate required fields
if (empty($data->id)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Missing required field: id"
    ]);
    exit;
}

try {
    // Build dynamic update query
    $updates = [];
    $params = [':id' => $data->id];

    if (isset($data->display_name)) {
        $updates[] = "display_name = :display_name";
        $params[':display_name'] = $data->display_name;
    }

    if (isset($data->login_url)) {
        $updates[] = "login_url = :login_url";
        $params[':login_url'] = $data->login_url;
    }

    if (isset($data->description)) {
        $updates[] = "description = :description";
        $params[':description'] = $data->description;
    }

    if (isset($data->icon_emoji)) {
        $updates[] = "icon_emoji = :icon_emoji";
        $params[':icon_emoji'] = $data->icon_emoji;
    }

    if (isset($data->is_active)) {
        $updates[] = "is_active = :is_active";
        $params[':is_active'] = $data->is_active;
    }

    if (empty($updates)) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "No fields to update"
        ]);
        exit;
    }

    $query = "UPDATE services SET " . implode(', ', $updates) . " WHERE id = :id";
    $stmt = $db->prepare($query);

    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }

    $stmt->execute();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Service updated successfully"
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to update service: " . $e->getMessage()
    ]);
}
?>
