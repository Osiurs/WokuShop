<?php
/**
 * Database Initialization Script
 * Run this file once to set up the database and tables
 */

require_once 'config/database.php';

echo "<h1>Wokushop Database Initialization</h1>";

$result = Database::initialize();

if ($result['success']) {
    echo "<p style='color: green;'>" . $result['message'] . "</p>";
    echo "<h2>Database Setup Complete!</h2>";
    echo "<p>Default Admin Credentials:</p>";
    echo "<ul>";
    echo "<li><strong>Username:</strong> admin</li>";
    echo "<li><strong>Password:</strong> admin123</li>";
    echo "</ul>";
    echo "<p style='color: orange;'><strong>Important:</strong> Please change the default password after first login!</p>";
} else {
    echo "<p style='color: red;'>Error: " . $result['message'] . "</p>";
}

echo "<hr>";
echo "<p><a href='test.php'>Test API Connection</a></p>";
?>
