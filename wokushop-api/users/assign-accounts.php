<?php
require_once '../config/database.php';
require_once '../config/auth.php';

$database = new Database();
$db = $database->getConnection();
$auth = new Auth();

// Verify admin authentication
$user = $auth->requireAdmin();

// Get posted data
$data = json_decode(file_get_contents("php://input"));

if (empty($data->user_id) || !isset($data->account_ids)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "User ID and account IDs are required."
    ]);
    exit();
}

try {
    // Start transaction
    $db->beginTransaction();

    // First, delete all existing assignments for this user
    $query = "DELETE FROM user_accounts WHERE user_id = :user_id";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':user_id', $data->user_id);
    $stmt->execute();

    // Insert new assignments
    if (is_array($data->account_ids) && count($data->account_ids) > 0) {
        $query = "INSERT INTO user_accounts (user_id, account_id) VALUES (:user_id, :account_id)";
        $stmt = $db->prepare($query);

        foreach ($data->account_ids as $accountId) {
            $stmt->execute([
                'user_id' => $data->user_id,
                'account_id' => $accountId
            ]);
        }
    }

    // Commit transaction
    $db->commit();

    http_response_code(200);
    echo json_encode([
        "success" => true,
        "message" => "Accounts assigned successfully."
    ]);
} catch (PDOException $e) {
    $db->rollBack();
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to assign accounts: " . $e->getMessage()
    ]);
}
?>
