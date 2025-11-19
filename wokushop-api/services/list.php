<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify authentication
$user = $auth->requireAuth();

try {
    // Fetch all services (with optional filter for active only)
    $activeOnly = isset($_GET['active_only']) && $_GET['active_only'] === 'true';

    if ($activeOnly) {
        $query = "SELECT * FROM services WHERE is_active = 1 ORDER BY display_name ASC";
    } else {
        $query = "SELECT * FROM services ORDER BY display_name ASC";
    }

    $stmt = $db->prepare($query);
    $stmt->execute();
    $services = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // For each service, fetch its allowed domains and extensions
    foreach ($services as &$service) {
        // Add alias for frontend compatibility
        $service['requires_login'] = (int)$service['requires_user_credentials'];

        // Fetch allowed domains
        $domainQuery = "SELECT domain FROM domain_restrictions WHERE service_type = :service_type ORDER BY domain ASC";
        $domainStmt = $db->prepare($domainQuery);
        $domainStmt->bindParam(':service_type', $service['service_type']);
        $domainStmt->execute();
        $domains = $domainStmt->fetchAll(PDO::FETCH_COLUMN);
        $service['allowed_domains'] = $domains;

        // Fetch extensions
        $extensionQuery = "SELECT e.* FROM extensions e
                          INNER JOIN service_extensions se ON e.extension_id = se.extension_id
                          WHERE se.service_type = :service_type AND e.is_active = 1
                          ORDER BY e.extension_name ASC";
        $extensionStmt = $db->prepare($extensionQuery);
        $extensionStmt->bindParam(':service_type', $service['service_type']);
        $extensionStmt->execute();
        $extensions = $extensionStmt->fetchAll(PDO::FETCH_ASSOC);
        $service['extensions'] = $extensions;

        // Debug logging
        error_log("Service: " . $service['service_type'] . " - Found " . count($domains) . " domains: " . implode(", ", $domains));
        error_log("Service: " . $service['service_type'] . " - Found " . count($extensions) . " extensions");
    }

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "data" => $services
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch services: " . $e->getMessage()
    ]);
}
?>
