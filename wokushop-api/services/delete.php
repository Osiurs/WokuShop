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
        "message" => "Only admins can delete services"
    ]);
    exit;
}

// Get POST data
$data = json_decode(file_get_contents("php://input"));

if (empty($data->id)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Missing required field: id"
    ]);
    exit;
}

try {
    // Check if service is used by any accounts
    $checkQuery = "SELECT COUNT(*) as count FROM accounts WHERE service_type = (SELECT service_type FROM services WHERE id = :id)";
    $checkStmt = $db->prepare($checkQuery);
    $checkStmt->bindParam(':id', $data->id);
    $checkStmt->execute();
    $result = $checkStmt->fetch(PDO::FETCH_ASSOC);

    if ($result['count'] > 0) {
        http_response_code(409);
        echo json_encode([
            "success" => false,
            "message" => "Cannot delete service: it is being used by " . $result['count'] . " account(s). Delete those accounts first."
        ]);
        exit;
    }

    // Delete the service
    $query = "DELETE FROM services WHERE id = :id";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':id', $data->id);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        http_response_code(200);
        echo json_encode([
            "success" => true,
            "message" => "Service deleted successfully"
        ]);
    } else {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "Service not found"
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to delete service: " . $e->getMessage()
    ]);
}
?>
