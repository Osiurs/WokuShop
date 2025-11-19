<?php
header('Content-Type: application/json');
require_once '../config/database.php';
require_once '../config/auth.php';

$auth = new Auth();
$user = $auth->requireAuth();
$data = json_decode(file_get_contents("php://input"), true);

if (empty($data['account_id']) || !isset($data['cookies'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Account ID and cookies are required.']);
    exit();
}

$accountId = $data['account_id'];
$cookies = $data['cookies'];

$db = (new Database())->getConnection();

// Use a transaction to ensure atomicity
$db->beginTransaction();

try {
    // Delete old cookies for this account
    $stmt = $db->prepare("DELETE FROM user_sessions WHERE account_id = :account_id");
    $stmt->execute(['account_id' => $accountId]);

    // Insert new cookies
    $query = "INSERT INTO user_sessions (user_id, account_id, session_blob, checksum) VALUES (:user_id, :account_id, :cookie, :checksum)";
    $stmt = $db->prepare($query);

    foreach ($cookies as $cookie) {
        $cookieJson = json_encode($cookie);
        $checksum = hash('sha256', $cookieJson);
        $stmt->execute([
            'user_id' => $user->id,
            'account_id' => $accountId,
            'cookie' => $cookieJson,
            'checksum' => $checksum
        ]);
    }

    $db->commit();

    http_response_code(200);
    echo json_encode(['success' => true, 'message' => 'Cookies synced successfully.']);

} catch (Exception $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
}
?>