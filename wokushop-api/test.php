<?php
/**
 * API Test Script
 * Tests database connection and basic functionality
 */

require_once 'config/database.php';

echo "<h1>Wokushop API Test</h1>";

try {
    $database = new Database();
    $conn = $database->getConnection();

    echo "<p style='color: green;'>✓ Database connection successful!</p>";

    // Test tables
    $tables = ['users', 'accounts', 'user_accounts', 'usage_logs', 'domain_restrictions', 'chat_locks', 'sessions'];
    echo "<h2>Database Tables:</h2>";
    echo "<ul>";

    foreach ($tables as $table) {
        $query = "SHOW TABLES LIKE '$table'";
        $stmt = $conn->prepare($query);
        $stmt->execute();

        if ($stmt->rowCount() > 0) {
            echo "<li style='color: green;'>✓ $table</li>";
        } else {
            echo "<li style='color: red;'>✗ $table (missing)</li>";
        }
    }

    echo "</ul>";

    // Count records
    echo "<h2>Database Records:</h2>";
    echo "<ul>";

    $query = "SELECT COUNT(*) as count FROM users";
    $stmt = $conn->prepare($query);
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "<li>Users: " . $result['count'] . "</li>";

    $query = "SELECT COUNT(*) as count FROM accounts";
    $stmt = $conn->prepare($query);
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "<li>Accounts: " . $result['count'] . "</li>";

    $query = "SELECT COUNT(*) as count FROM domain_restrictions";
    $stmt = $conn->prepare($query);
    $stmt->execute();
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "<li>Domain Restrictions: " . $result['count'] . "</li>";

    echo "</ul>";

    echo "<h2>API Endpoints:</h2>";
    echo "<ul>";
    echo "<li><a href='auth/login.php' target='_blank'>POST /auth/login.php</a></li>";
    echo "<li><a href='auth/logout.php' target='_blank'>POST /auth/logout.php</a></li>";
    echo "<li><a href='accounts/list.php' target='_blank'>GET /accounts/list.php</a></li>";
    echo "<li><a href='users/list.php' target='_blank'>GET /users/list.php</a></li>";
    echo "<li><a href='logs/list.php' target='_blank'>GET /logs/list.php</a></li>";
    echo "<li><a href='stats/dashboard.php' target='_blank'>GET /stats/dashboard.php</a></li>";
    echo "</ul>";

    echo "<p style='color: blue;'><strong>Note:</strong> Most endpoints require authentication and will return 401 without a valid token.</p>";

} catch (PDOException $e) {
    echo "<p style='color: red;'>✗ Database connection failed: " . $e->getMessage() . "</p>";
}
?>
