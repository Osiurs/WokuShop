<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify admin authentication
$user = $auth->requireAdmin();

try {
    // Get parameters
    $accountId = isset($_GET['account_id']) ? $_GET['account_id'] : null;
    $partitionId = isset($_GET['partition_id']) ? $_GET['partition_id'] : null;

    if (!$accountId && !$partitionId) {
        http_response_code(400);
        header('Content-Type: application/json');
        echo json_encode([
            "success" => false,
            "message" => "Missing required parameter: account_id or partition_id"
        ]);
        exit();
    }

    // Query to get latest backup
    if ($accountId) {
        $query = "SELECT * FROM session_backups
                  WHERE account_id = :account_id
                  ORDER BY created_at DESC
                  LIMIT 1";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':account_id', $accountId);
    } else {
        $query = "SELECT * FROM session_backups
                  WHERE partition_id = :partition_id
                  ORDER BY created_at DESC
                  LIMIT 1";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':partition_id', $partitionId);
    }

    $stmt->execute();
    $backup = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$backup) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode([
            "success" => false,
            "message" => "No backup found for this account"
        ]);
        exit();
    }

    // Check if backup file exists
    $filePath = $backup['backup_path'];
    if (!file_exists($filePath)) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode([
            "success" => false,
            "message" => "Backup file not found on server"
        ]);
        exit();
    }

    // Send file to client
    $filename = basename($filePath);
    $fileSize = filesize($filePath);

    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . $fileSize);
    header('Cache-Control: no-cache, must-revalidate');
    header('Expires: 0');

    // Output file
    readfile($filePath);
    exit();

} catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage()
    ]);
} catch (Exception $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        "success" => false,
        "message" => "Error: " . $e->getMessage()
    ]);
}
?>
