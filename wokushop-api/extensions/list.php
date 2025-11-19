<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify authentication
$user = $auth->requireAuth();

try {
    // Fetch all extensions
    $query = "SELECT * FROM extensions ORDER BY extension_name ASC";
    $stmt = $db->prepare($query);
    $stmt->execute();
    $extensions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // For each extension, fetch services using it
    foreach ($extensions as &$extension) {
        $serviceQuery = "SELECT s.service_type, s.display_name, s.icon_emoji
                        FROM services s
                        INNER JOIN service_extensions se ON s.service_type = se.service_type
                        WHERE se.extension_id = :extension_id
                        ORDER BY s.display_name ASC";
        $serviceStmt = $db->prepare($serviceQuery);
        $serviceStmt->execute(['extension_id' => $extension['extension_id']]);
        $extension['services'] = $serviceStmt->fetchAll(PDO::FETCH_ASSOC);
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $extensions
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch extensions: " . $e->getMessage()
    ]);
}
?>
