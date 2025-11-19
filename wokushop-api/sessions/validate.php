<?php
// API endpoint để validate session across machines
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Enable error logging
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/session_sync_errors.log');

try {
    require_once '../config/database.php';
    require_once '../config/auth.php';

    $database = new Database();
    $db = $database->getConnection();
    $auth = new Auth();

    // Verify authentication
    $user = $auth->requireAuth();

    // Get posted data
    $data = json_decode(file_get_contents("php://input"), true);

    $machineId = $data['machine_id'] ?? null;
    $sessionToken = $data['session_token'] ?? null;

    if (empty($machineId)) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Machine ID is required."
        ]);
        exit();
    }

    error_log("Session validate for user {$user->id} on machine {$machineId}");

    // Check if session exists and is valid
    $query = "SELECT s.*, u.username, u.role
             FROM user_sessions s
             INNER JOIN users u ON s.user_id = u.id
             WHERE s.user_id = :user_id
             AND s.is_active = TRUE
             AND s.expires_at > NOW()";

    $params = ['user_id' => $user->id];

    // If session token provided, validate specific session
    if ($sessionToken) {
        $query .= " AND s.session_token = :session_token";
        $params['session_token'] = $sessionToken;
    }

    $query .= " ORDER BY s.last_active DESC LIMIT 1";

    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $session = $stmt->fetch(PDO::FETCH_ASSOC);

    $isValid = false;
    $needsSync = false;
    $sessionData = null;

    if ($session) {
        $isValid = true;
        $sessionData = json_decode($session['session_data'], true);

        // Check if this machine needs sync (different machine or old session)
        $timeDiff = strtotime($session['last_active']);
        $currentTime = time();
        $hoursSinceLastActive = ($currentTime - $timeDiff) / 3600;

        // Need sync if:
        // 1. Session from different machine, OR
        // 2. Last active more than 1 hour ago
        $needsSync = ($session['machine_id'] !== $machineId || $hoursSinceLastActive > 1);

        // Update last active
        $updateQuery = "UPDATE user_sessions
                       SET last_active = NOW()
                       WHERE id = :session_id";
        $updateStmt = $db->prepare($updateQuery);
        $updateStmt->execute(['session_id' => $session['id']]);
    } else {
        // No valid session found
        $needsSync = true;
    }

    // Get user's assigned accounts for validation
    $accountsQuery = "SELECT a.id, a.service_name, a.service_type, a.partition_id
                     FROM accounts a
                     INNER JOIN user_accounts ua ON a.id = ua.account_id
                     WHERE ua.user_id = :user_id";
    $accountsStmt = $db->prepare($accountsQuery);
    $accountsStmt->execute(['user_id' => $user->id]);
    $assignedAccounts = $accountsStmt->fetchAll(PDO::FETCH_ASSOC);

    // Log validation
    $logQuery = "INSERT INTO session_sync_log
                (user_id, machine_id, action, session_token, success, sync_data)
                VALUES (:user_id, :machine_id, 'validate', :session_token, TRUE, :sync_data)";
    $logStmt = $db->prepare($logQuery);
    $logStmt->execute([
        'user_id' => $user->id,
        'machine_id' => $machineId,
        'session_token' => $sessionToken,
        'sync_data' => json_encode([
            'is_valid' => $isValid,
            'needs_sync' => $needsSync,
            'assigned_accounts_count' => count($assignedAccounts),
            'session_machine' => $session['machine_id'] ?? null
        ])
    ]);

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Session validation completed",
        "data" => [
            "is_valid" => $isValid,
            "needs_sync" => $needsSync,
            "session_exists" => $session ? true : false,
            "session_token" => $session['session_token'] ?? null,
            "session_machine_id" => $session['machine_id'] ?? null,
            "current_machine_id" => $machineId,
            "user" => [
                'id' => $user->id,
                'username' => $user->username,
                'role' => $user->role
            ],
            "assigned_accounts" => $assignedAccounts,
            "session_data" => $sessionData,
            "expires_at" => $session['expires_at'] ?? null,
            "last_active" => $session['last_active'] ?? null
        ]
    ]);

} catch (Exception $e) {
    // Log error
    try {
        $logQuery = "INSERT INTO session_sync_log
                    (user_id, machine_id, action, success, error_message)
                    VALUES (:user_id, :machine_id, 'validate', FALSE, :error_message)";
        $logStmt = $db->prepare($logQuery);
        $logStmt->execute([
            'user_id' => $user->id ?? 0,
            'machine_id' => $machineId ?? 'unknown',
            'error_message' => $e->getMessage()
        ]);
    } catch (Exception $logError) {
        error_log("Failed to log validation error: " . $logError->getMessage());
    }

    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to validate session: " . $e->getMessage(),
        "error_type" => "validation_error"
    ]);
    error_log("Session validation error: " . $e->getMessage());
}
?>