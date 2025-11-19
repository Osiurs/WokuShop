<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify authentication
$user = $auth->requireAuth();

// Get posted data
$data = json_decode(file_get_contents("php://input"));

if (empty($data->account_id) || !isset($data->cookies)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Account ID and cookies are required."
    ]);
    exit();
}

try {
    $query = "INSERT INTO service_account_cookies (account_id, cookies) 
              VALUES (:account_id, :cookies) 
              ON DUPLICATE KEY UPDATE cookies = :cookies";
    
    $stmt = $db->prepare($query);
    
    $stmt->execute([
        'account_id' => $data->account_id,
        'cookies' => json_encode($data->cookies)
    ]);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Cookies saved successfully."
    ]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to save cookies: " . $e->getMessage()
    ]);
}
?>
