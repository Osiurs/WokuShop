<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify authentication
$user = $auth->requireAuth();

try {
    $stats = [];

    // Total accounts
    if ($user->role === 'admin') {
        $query = "SELECT COUNT(*) as count FROM accounts";
        $stmt = $db->prepare($query);
    } else {
        $query = "SELECT COUNT(*) as count FROM user_accounts WHERE user_id = :user_id";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':user_id', $user->id);
    }
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $stats['totalAccounts'] = (int)$result['count'];

    // Total users (admin only)
    if ($user->role === 'admin') {
        $query = "SELECT COUNT(*) as count FROM users";
        $stmt = $db->prepare($query);
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $stats['totalUsers'] = (int)$result['count'];
    } else {
        $stats['totalUsers'] = 0;
    }

    // Active sessions (simplified - count active session records)
    $query = "SELECT COUNT(*) as count FROM sessions WHERE expires_at > NOW()";
    $stmt = $db->prepare($query);
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $stats['activeSessions'] = (int)$result['count'];

    // Today's activity
    if ($user->role === 'admin') {
        $query = "SELECT COUNT(*) as count FROM usage_logs WHERE DATE(created_at) = CURDATE()";
        $stmt = $db->prepare($query);
    } else {
        $query = "SELECT COUNT(*) as count FROM usage_logs WHERE user_id = :user_id AND DATE(created_at) = CURDATE()";
        $stmt = $db->prepare($query);
        $stmt->bindParam(':user_id', $user->id);
    }
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    $stats['todayActivity'] = (int)$result['count'];

    http_response_code(200);
    echo json_encode($stats);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to fetch stats: " . $e->getMessage()
    ]);
}
?>
