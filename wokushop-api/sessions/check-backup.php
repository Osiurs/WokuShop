<?php
require_once '../config/database.php';
require_once '../config/auth.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: X-Auth-Token, Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    // Initialize auth
    $auth = new Auth($pdo);

    // Require authentication
    $user = $auth->requireAuth();

    // Get account_id from query parameters
    $accountId = $_GET['account_id'] ?? null;

    if (!$accountId) {
        throw new Exception('Account ID is required');
    }

    // Check if backup exists for this account
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as backup_count,
               MAX(created_at) as latest_backup
        FROM session_backups
        WHERE account_id = ?
        AND file_path IS NOT NULL
    ");
    $stmt->execute([$accountId]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    $hasBackup = $result['backup_count'] > 0;

    // If backup exists, check if file actually exists on filesystem
    if ($hasBackup) {
        $fileStmt = $pdo->prepare("
            SELECT file_path
            FROM session_backups
            WHERE account_id = ?
            AND file_path IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1
        ");
        $fileStmt->execute([$accountId]);
        $fileResult = $fileStmt->fetch(PDO::FETCH_ASSOC);

        if ($fileResult && !file_exists($fileResult['file_path'])) {
            $hasBackup = false;
        }
    }

    echo json_encode([
        'success' => true,
        'has_backup' => $hasBackup,
        'backup_count' => (int)$result['backup_count'],
        'latest_backup' => $result['latest_backup'],
        'message' => $hasBackup ? 'Backup available' : 'No backup found'
    ]);

} catch (Exception $e) {
    error_log("Check backup error: " . $e->getMessage());

    http_response_code(400);
    echo json_encode([
        'success' => false,
        'has_backup' => false,
        'message' => $e->getMessage()
    ]);
}
?>