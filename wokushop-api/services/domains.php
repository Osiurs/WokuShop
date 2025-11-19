<?php
// Debug: Log that this file is loaded
error_log("domains.php loaded - timestamp: " . date('Y-m-d H:i:s'));
error_log("REQUEST_METHOD: " . $_SERVER['REQUEST_METHOD']);

require_once '../config/database.php';
require_once '../config/auth.php';

// CORS headers
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    error_log("OPTIONS request - responding with 200");
    http_response_code(200);
    exit;
}

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify authentication for all methods
$user = $auth->requireAuth();

$method = $_SERVER['REQUEST_METHOD'];

// Debug logging
error_log("=== domains.php Request ===");
error_log("Method: " . $method);
error_log("User: " . $user->username);
error_log("Role: " . $user->role);
error_log("Service Type: " . (isset($_GET['service_type']) ? $_GET['service_type'] : 'NOT SET'));

try {
    if ($method === 'GET') {
        // GET is allowed for all authenticated users
        error_log("Processing GET request for service_type: " . ($_GET['service_type'] ?? 'MISSING'));
        if (!isset($_GET['service_type'])) {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "Missing required parameter: service_type"
            ]);
            exit;
        }

        $query = "SELECT * FROM domain_restrictions WHERE service_type = :service_type ORDER BY domain ASC";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':service_type', $_GET['service_type']);
        $stmt->execute();
        $domains = $stmt->fetchAll(PDO::FETCH_ASSOC);

        http_response_code(200);
        echo json_encode([
            "success" => true,
            "data" => $domains
        ]);

    } elseif ($method === 'POST') {
        // Admin check for POST
        if ($user->role !== 'admin') {
            http_response_code(403);
            echo json_encode(["success" => false, "message" => "Only admins can manage service domains"]);
            exit;
        }

        $data = json_decode(file_get_contents("php://input"));

        if (empty($data->service_type) || empty($data->domain)) {
            http_response_code(400);
            echo json_encode([
                "success" => false,
                "message" => "Missing required fields: service_type, domain"
            ]);
            exit;
        }

        $query = "INSERT INTO domain_restrictions (service_type, domain) VALUES (:service_type, :domain)";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':service_type', $data->service_type);
        $stmt->bindParam(':domain', $data->domain);
        $stmt->execute();

        http_response_code(201);
        echo json_encode([
            "success" => true,
            "message" => "Domain added successfully"
        ]);

    } elseif ($method === 'DELETE') {
        // Admin check for DELETE
        if ($user->role !== 'admin') {
            http_response_code(403);
            echo json_encode(["success" => false, "message" => "Only admins can manage service domains"]);
            exit;
        }

        // The original code used file_get_contents for DELETE which is not standard.
        // A better approach is to get ID from query string, e.g., ?id=123
        // For now, we'll assume the client sends it in the body as per original code.
        $data = json_decode(file_get_contents("php://input"));

        if (empty($data->id)) {
            // Let's also support query string for DELETE
            if (isset($_GET['id'])) {
                $data->id = $_GET['id'];
            } else {
                 http_response_code(400);
                echo json_encode([
                    "success" => false,
                    "message" => "Missing required field: id"
                ]);
                exit;
            }
        }

        $query = "DELETE FROM domain_restrictions WHERE id = :id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':id', $data->id);
        $stmt->execute();

        http_response_code(200);
        echo json_encode([
            "success" => true,
            "message" => "Domain deleted successfully"
        ]);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to manage domains: " . $e->getMessage()
    ]);
}
?>