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

if (empty($data->service_type) || !isset($data->extension_ids)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Service type and extension IDs array are required."
    ]);
    exit();
}

try {
    // Verify service exists
    $serviceCheck = "SELECT service_type FROM services WHERE service_type = :service_type";
    $stmt = $db->prepare($serviceCheck);
    $stmt->execute(['service_type' => $data->service_type]);
    if (!$stmt->fetch()) {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Service not found."
        ]);
        exit();
    }

    // Start transaction
    $db->beginTransaction();

    // Delete existing extension assignments for this service
    $deleteQuery = "DELETE FROM service_extensions WHERE service_type = :service_type";
    $deleteStmt = $db->prepare($deleteQuery);
    $deleteStmt->execute(['service_type' => $data->service_type]);

    // Insert new extension assignments
    $insertQuery = "INSERT INTO service_extensions (service_type, extension_id) VALUES (:service_type, :extension_id)";
    $insertStmt = $db->prepare($insertQuery);

    foreach ($data->extension_ids as $extension_id) {
        // Verify extension exists
        $extCheck = "SELECT extension_id FROM extensions WHERE extension_id = :extension_id";
        $extStmt = $db->prepare($extCheck);
        $extStmt->execute(['extension_id' => $extension_id]);

        if ($extStmt->fetch()) {
            $insertStmt->execute([
                'service_type' => $data->service_type,
                'extension_id' => $extension_id
            ]);
        }
    }

    // Commit transaction
    $db->commit();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Extensions assigned successfully."
    ]);
} catch (PDOException $e) {
    // Rollback on error
    if ($db->inTransaction()) {
        $db->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to assign extensions: " . $e->getMessage()
    ]);
}
?>
