<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify authentication
$user = $auth->requireAuth();

// Get account ID from query string
$accountId = $_GET['account_id'] ?? null;

if (empty($accountId)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Account ID is required."
    ]);
    exit();
}

try {
    $query = "SELECT cookies FROM service_account_cookies WHERE account_id = :account_id";
    
    $stmt = $db->prepare($query);
    $stmt->execute(['account_id' => $accountId]);

    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($row) {
        http_response_code(200);
        echo json_encode([
            "success" => true,
            "cookies" => json_decode($row['cookies'])
        ]);
    } else {
        http_response_code(404);
        echo json_encode([
            "success" => false,
            "message" => "No cookies found for this account."
        ]);
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to retrieve cookies: " . $e->getMessage()
    ]);
}
?>
