<?php
require_once 'config/database.php';

header('Content-Type: application/json');

try {
    $database = new Database();
    $db = $database->getConnection();

    $db->beginTransaction();

    // Step 1: Drop the foreign key constraint
    $db->exec('ALTER TABLE `accounts` DROP FOREIGN KEY `accounts_ibfk_1`;');

    // Step 2: Convert tables to utf8mb4
    $db->exec('ALTER TABLE `services` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
    $db->exec('ALTER TABLE `accounts` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');

    // Step 3: Modify columns to use utf8mb4
    $db->exec('ALTER TABLE `services` MODIFY `service_type` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;');
    $db->exec('ALTER TABLE `accounts` MODIFY `service_type` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
    $db->exec("ALTER TABLE `services`
        MODIFY `display_name` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        MODIFY `description` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
        MODIFY `icon_emoji` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");

    // Step 4: Re-create the foreign key constraint
    $db->exec('ALTER TABLE `accounts` ADD CONSTRAINT `accounts_ibfk_1` FOREIGN KEY (`service_type`) REFERENCES `services` (`service_type`) ON DELETE SET NULL ON UPDATE CASCADE;');

    $db->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Database updated successfully. Emoji support is now fully enabled.'
    ]);

} catch (PDOException $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }

    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database update failed: ' . $e->getMessage()
    ]);
}

