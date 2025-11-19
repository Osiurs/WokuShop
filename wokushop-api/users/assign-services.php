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

if (empty($data->user_id) || !isset($data->service_types)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "User ID and service types array are required."
    ]);
    exit();
}

try {
    // Verify user exists
    $userCheck = "SELECT id FROM users WHERE id = :user_id";
    $stmt = $db->prepare($userCheck);
    $stmt->execute(['user_id' => $data->user_id]);
    if (!$stmt->fetch()) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "User not found."
        ]);
        exit();
    }

    // Start transaction
    $db->beginTransaction();

    // Delete existing service assignments for this user
    $deleteQuery = "DELETE FROM user_services WHERE user_id = :user_id";
    $deleteStmt = $db->prepare($deleteQuery);
    $deleteStmt->execute(['user_id' => $data->user_id]);

    // Insert new service assignments
    $insertQuery = "INSERT INTO user_services (user_id, service_type) VALUES (:user_id, :service_type)";
    $insertStmt = $db->prepare($insertQuery);

    foreach ($data->service_types as $service_type) {
        // Verify service exists
        $serviceCheck = "SELECT service_type FROM services WHERE service_type = :service_type";
        $serviceStmt = $db->prepare($serviceCheck);
        $serviceStmt->execute(['service_type' => $service_type]);

        if ($serviceStmt->fetch()) {
            $insertStmt->execute([
                'user_id' => $data->user_id,
                'service_type' => $service_type
            ]);
        }
    }

    // Commit transaction
    $db->commit();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Services assigned successfully."
    ]);
} catch (PDOException $e) {
    // Rollback on error
    if ($db->inTransaction()) {
        $db->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to assign services: " . $e->getMessage()
    ]);
}
?>
