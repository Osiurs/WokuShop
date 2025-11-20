<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Require admin (only admins need global assignment counts)
$auth->requireAdmin();

try {
    // Get counts of users assigned to each account
    $query = "SELECT account_id, COUNT(*) AS user_count FROM user_accounts GROUP BY account_id";
    $stmt = $db->prepare($query);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Shape as mapping: { [account_id]: count }
    $counts = [];
    foreach ($rows as $row) {
        $counts[(int)$row['account_id']] = (int)$row['user_count'];
    }

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'data' => $counts
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Failed to fetch assigned user counts: ' . $e->getMessage()
    ]);
}

