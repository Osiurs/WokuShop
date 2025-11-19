<?php
// Enable error logging for debugging
error_reporting(E_ALL);
ini_set('display_errors', 0); // Don't display errors to client
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/upload_errors.log');

// Disable output buffering to ensure response is sent
if (ob_get_level()) ob_end_clean();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Log request start
error_log("=== Upload request started ===");
error_log("Method: " . $_SERVER['REQUEST_METHOD']);
error_log("Content-Type: " . ($_SERVER['CONTENT_TYPE'] ?? 'not set'));

try {
    require_once '../config/database.php';
    require_once '../config/auth.php';

    $database = new Database();
    $db = $database->getConnection();
    $auth = new Auth();

    // Verify admin authentication
    error_log("Checking authentication...");
    $user = $auth->requireAdmin();
    error_log("Auth successful. User ID: " . $user->id);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Authentication error: " . $e->getMessage(),
        "error_type" => "auth_error"
    ]);
    error_log("Auth error in upload.php: " . $e->getMessage());
    exit();
}

try {
    // Validate required fields
    if (!isset($_POST['account_id']) || !isset($_POST['partition_id'])) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Missing required fields: account_id, partition_id"
        ]);
        exit();
    }

    // Validate file upload
    if (!isset($_FILES['session_file']) || $_FILES['session_file']['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "No file uploaded or upload error occurred"
        ]);
        exit();
    }

    $accountId = $_POST['account_id'];
    $partitionId = $_POST['partition_id'];
    $file = $_FILES['session_file'];

    // Validate file type (only accept ZIP files)
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    if ($mimeType !== 'application/zip' && $mimeType !== 'application/x-zip-compressed') {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Invalid file type. Only ZIP files are allowed."
        ]);
        exit();
    }

    // Create sessions directory if it doesn't exist
    $uploadDir = __DIR__ . '/backups/';
    if (!file_exists($uploadDir)) {
        if (!mkdir($uploadDir, 0755, true)) {
            http_response_code(500);
            echo json_encode([
                "success" => false,
                "message" => "Failed to create backups directory",
                "error_type" => "directory_error",
                "path" => $uploadDir
            ]);
            error_log("Failed to create directory: " . $uploadDir);
            exit();
        }
        error_log("Created backups directory: " . $uploadDir);
    }

    // Check if directory is writable
    if (!is_writable($uploadDir)) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Backups directory is not writable",
            "error_type" => "permission_error",
            "path" => $uploadDir
        ]);
        error_log("Directory not writable: " . $uploadDir);
        exit();
    }

    // Generate unique filename
    $timestamp = time();
    $filename = "session_{$accountId}_{$partitionId}_{$timestamp}.zip";
    $uploadPath = $uploadDir . $filename;

    error_log("Attempting to save file to: " . $uploadPath);
    error_log("Temp file: " . $file['tmp_name']);
    error_log("File size: " . $file['size']);

    // Move uploaded file
    if (!move_uploaded_file($file['tmp_name'], $uploadPath)) {
        $error = error_get_last();
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Failed to save uploaded file",
            "error_type" => "file_move_error",
            "php_error" => $error ? $error['message'] : 'Unknown error'
        ]);
        error_log("Failed to move uploaded file: " . print_r($error, true));
        exit();
    }

    error_log("File saved successfully: " . $uploadPath);

    // Get file size
    $fileSize = filesize($uploadPath);

    // Save to database
    error_log("Attempting to save to database...");
    $query = "INSERT INTO session_backups (account_id, partition_id, backup_path, file_size, created_by)
              VALUES (:account_id, :partition_id, :backup_path, :file_size, :created_by)";

    try {
        $stmt = $db->prepare($query);
        $stmt->bindParam(':account_id', $accountId);
        $stmt->bindParam(':partition_id', $partitionId);
        $stmt->bindParam(':backup_path', $uploadPath);
        $stmt->bindParam(':file_size', $fileSize);
        $stmt->bindParam(':created_by', $user->id);

        if (!$stmt->execute()) {
            $errorInfo = $stmt->errorInfo();
            throw new Exception("Database insert failed: " . $errorInfo[2]);
        }

        $backupId = $db->lastInsertId();
        error_log("Database insert successful. Backup ID: " . $backupId);

        http_response_code(200);
        echo json_encode([
            "success" => true,
            "message" => "Session backup uploaded successfully",
            "data" => [
                "backup_id" => $backupId,
                "account_id" => $accountId,
                "partition_id" => $partitionId,
                "file_size" => $fileSize,
                "timestamp" => date('Y-m-d H:i:s', $timestamp)
            ]
        ]);
    } catch (Exception $dbError) {
        // Delete uploaded file if database insert fails
        if (file_exists($uploadPath)) {
            unlink($uploadPath);
        }

        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Failed to save backup information to database: " . $dbError->getMessage(),
            "error_type" => "database_error"
        ]);
        error_log("Database error: " . $dbError->getMessage());
        error_log("Database error trace: " . $dbError->getTraceAsString());
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Database error: " . $e->getMessage(),
        "error_type" => "pdo_error"
    ]);
    error_log("PDO error: " . $e->getMessage());
    error_log("PDO error trace: " . $e->getTraceAsString());
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Error: " . $e->getMessage(),
        "error_type" => "general_error"
    ]);
    error_log("General error: " . $e->getMessage());
    error_log("General error trace: " . $e->getTraceAsString());
}
?>
