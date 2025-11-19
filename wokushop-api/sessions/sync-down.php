<?php
header('Content-Type: application/json');
require_once '../config/database.php';
require_once '../config/auth.php';

$auth = new Auth();
$user = $auth->requireAuth();

if (empty($_GET['account_id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Account ID is required.']);
    exit();
}

$accountId = $_GET['account_id'];

$db = (new Database())->getConnection();

try {
    $stmt = $db->prepare("SELECT session_blob FROM user_sessions WHERE account_id = :account_id AND user_id = :user_id");
    $stmt->execute(['account_id' => $accountId, 'user_id' => $user->id]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($results)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'No cookies found for this account.']);
        exit();
    }

    $cookies = array_map(function($row) {
        return json_decode($row['session_blob'], true);
    }, $results);

    http_response_code(200);
    echo json_encode(['success' => true, 'cookies' => $cookies]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>