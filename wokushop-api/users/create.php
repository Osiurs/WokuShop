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

if (empty($data->username) || empty($data->password)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Username and password are required."
    ]);
    exit();
}

try {
    // Check if username already exists
    $query = "SELECT id FROM users WHERE username = :username";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':username', $data->username);
    $stmt->execute();

    if ($stmt->rowCount() > 0) {
        http_response_code(400);
        echo json_encode([
            "success" => false,
            "message" => "Username already exists."
        ]);
        exit();
    }

    // Hash password
    $hashedPassword = password_hash($data->password, PASSWORD_BCRYPT);
    $role = $data->role ?? 'user';

    // Insert user
    $query = "INSERT INTO users (username, password, role) VALUES (:username, :password, :role)";
    $stmt = $db->prepare($query);
    $stmt->execute([
        'username' => $data->username,
        'password' => $hashedPassword,
        'role' => $role
    ]);

    http_response_code(201);
    echo json_encode([
        "success" => true,
        "message" => "User created successfully.",
        "id" => $db->lastInsertId()
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Failed to create user: " . $e->getMessage()
    ]);
}
?>
