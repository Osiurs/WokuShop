<?php
require_once __DIR__ . '/env.php';

header("Access-Control-Allow-Origin: " . Env::get('CORS_ORIGIN', '*'));
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

class Database {
    private $host;
    private $db_name;
    private $username;
    private $password;
    public $conn;

    public function __construct() {
        $this->host = Env::get('DB_HOST', 'localhost');
        $this->db_name = Env::get('DB_NAME', 'wokushop_db');
        $this->username = Env::get('DB_USER', 'root');
        $this->password = Env::get('DB_PASS', '');
    }

    public function getConnection() {
        $this->conn = null;

        try {
            $this->conn = new PDO(
                "mysql:host=" . $this->host . ";dbname=" . $this->db_name,
                $this->username,
                $this->password
            );
            $this->conn->exec("set names utf8");
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        } catch(PDOException $exception) {
            echo json_encode([
                "success" => false,
                "message" => "Connection error: " . $exception->getMessage()
            ]);
            die();
        }

        return $this->conn;
    }

    // Initialize database and tables
    public static function initialize() {
        $host = Env::get('DB_HOST', 'localhost');
        $username = Env::get('DB_USER', 'root');
        $password = Env::get('DB_PASS', '');
        $db_name = Env::get('DB_NAME', 'wokushop_db');

        try {
            // Create database if not exists
            $conn = new PDO("mysql:host=" . $host, $username, $password);
            $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            $sql = "CREATE DATABASE IF NOT EXISTS " . $db_name . " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";
            $conn->exec($sql);

            // Connect to the database
            $conn = new PDO("mysql:host=" . $host . ";dbname=" . $db_name, $username, $password);
            $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

            // Create Users table
            $sql = "CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('admin', 'user') DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
            $conn->exec($sql);

            // Create Services table
            $sql = "CREATE TABLE IF NOT EXISTS services (
                id INT AUTO_INCREMENT PRIMARY KEY,
                service_type VARCHAR(50) UNIQUE NOT NULL,
                display_name VARCHAR(100) NOT NULL,
                login_url VARCHAR(500) NOT NULL,
                description TEXT,
                icon_emoji VARCHAR(10) DEFAULT '🌐',
                is_active BOOLEAN DEFAULT TRUE,
                requires_user_credentials BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
            $conn->exec($sql);

            // Add requires_user_credentials column if table already exists
            try {
                $conn->exec("ALTER TABLE services ADD COLUMN requires_user_credentials BOOLEAN DEFAULT FALSE");
            } catch(PDOException $e) {
                // Column already exists, ignore
            }

            // Create Accounts table (updated to reference services)
            $sql = "CREATE TABLE IF NOT EXISTS accounts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                service_name VARCHAR(100) NOT NULL,
                service_type VARCHAR(50) NOT NULL,
                description TEXT,
                partition_id VARCHAR(255) UNIQUE NOT NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (service_type) REFERENCES services(service_type) ON DELETE CASCADE ON UPDATE CASCADE,
                FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
            $conn->exec($sql);

            // Add created_by column if table already exists
            try {
                $conn->exec("ALTER TABLE accounts ADD COLUMN created_by INT NULL");
                $conn->exec("ALTER TABLE accounts ADD FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE");
            } catch(PDOException $e) {
                // Column already exists, ignore
            }

            // Create UserAccounts (junction table)
            $sql = "CREATE TABLE IF NOT EXISTS user_accounts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                account_id INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_account (user_id, account_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
            $conn->exec($sql);

            // Create UserServices (junction table for service assignment)
            $sql = "CREATE TABLE IF NOT EXISTS user_services (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                service_type VARCHAR(50) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (service_type) REFERENCES services(service_type) ON DELETE CASCADE,
                UNIQUE KEY unique_user_service (user_id, service_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
            $conn->exec($sql);

            // Create Extensions table
            $sql = "CREATE TABLE IF NOT EXISTS extensions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                extension_name VARCHAR(100) NOT NULL,
                extension_id VARCHAR(255) UNIQUE NOT NULL,
                description TEXT,
                download_url VARCHAR(500),
                version VARCHAR(50),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
            $conn->exec($sql);

            // Create ServiceExtensions (junction table)
            $sql = "CREATE TABLE IF NOT EXISTS service_extensions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                service_type VARCHAR(50) NOT NULL,
                extension_id VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (service_type) REFERENCES services(service_type) ON DELETE CASCADE,
                FOREIGN KEY (extension_id) REFERENCES extensions(extension_id) ON DELETE CASCADE,
                UNIQUE KEY unique_service_extension (service_type, extension_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
            $conn->exec($sql);

            // Create UsageLogs table
            $sql = "CREATE TABLE IF NOT EXISTS usage_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                action VARCHAR(50) NOT NULL,
                details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
            $conn->exec($sql);

            // Create DomainRestrictions table
            $sql = "CREATE TABLE IF NOT EXISTS domain_restrictions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                service_type VARCHAR(50) NOT NULL,
                domain VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_service_domain (service_type, domain)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
            $conn->exec($sql);

            // Create ChatLocks table
            $sql = "CREATE TABLE IF NOT EXISTS chat_locks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                account_id INT NOT NULL,
                user_id INT NOT NULL,
                chat_id VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE KEY unique_chat_lock (account_id, chat_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
            $conn->exec($sql);

            // Create Service Account Cookies table
            $sql = "CREATE TABLE IF NOT EXISTS service_account_cookies (
                id INT AUTO_INCREMENT PRIMARY KEY,
                account_id INT NOT NULL,
                cookies TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                UNIQUE KEY unique_account_cookie (account_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
            $conn->exec($sql);

            // Create Sessions table for JWT tokens
            $sql = "CREATE TABLE IF NOT EXISTS sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                token VARCHAR(500) NOT NULL,
                device_info TEXT,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_token (token),
                INDEX idx_expires (expires_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
            $conn->exec($sql);

            // Create User Sessions table for cross-machine session sync
            $sql = "CREATE TABLE IF NOT EXISTS user_sessions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                machine_id VARCHAR(255) NOT NULL,
                session_token VARCHAR(255) NOT NULL,
                session_data TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                expires_at TIMESTAMP NOT NULL,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_machine (user_id, machine_id),
                INDEX idx_session_token (session_token),
                INDEX idx_expires (expires_at),
                INDEX idx_last_active (last_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
            $conn->exec($sql);

            // Create Session Sync Log table for tracking sync operations
            $sql = "CREATE TABLE IF NOT EXISTS session_sync_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                machine_id VARCHAR(255) NOT NULL,
                action VARCHAR(50) NOT NULL,
                session_token VARCHAR(255),
                success BOOLEAN DEFAULT TRUE,
                error_message TEXT,
                sync_data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                INDEX idx_user_action (user_id, action),
                INDEX idx_machine_action (machine_id, action),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci";
            $conn->exec($sql);

            // Insert default admin user
            $defaultPassword = password_hash('admin123', PASSWORD_BCRYPT);
            $sql = "INSERT IGNORE INTO users (username, password, role) VALUES ('admin', :password, 'admin')";
            $stmt = $conn->prepare($sql);
            $stmt->bindParam(':password', $defaultPassword);
            $stmt->execute();

            // Insert default services
            // NOTE: All services use admin pre-login (requires_user_credentials = false)
            // Admin logs in once, all users share the same session via partition_id
            $services = [
                ['youtube', 'YouTube', 'https://www.youtube.com', 'Video streaming platform', '📺', false],
                ['spotify', 'Spotify', 'https://open.spotify.com', 'Music streaming service', '🎵', false],
                ['netflix', 'Netflix', 'https://www.netflix.com', 'Movie and TV streaming', '🎬', false],
                ['gemini', 'Gemini AI', 'https://gemini.google.com/app', 'Google AI assistant', '✨', false],
                ['chatgpt', 'ChatGPT', 'https://chat.openai.com', 'OpenAI chatbot', '🤖', false]
            ];

            $sql = "INSERT IGNORE INTO services (service_type, display_name, login_url, description, icon_emoji, requires_user_credentials)
                    VALUES (:service_type, :display_name, :login_url, :description, :icon_emoji, :requires_user_credentials)";
            $stmt = $conn->prepare($sql);
            foreach ($services as $service) {
                $stmt->execute([
                    'service_type' => $service[0],
                    'display_name' => $service[1],
                    'login_url' => $service[2],
                    'description' => $service[3],
                    'icon_emoji' => $service[4],
                    'requires_user_credentials' => $service[5]
                ]);
            }

            // Update all existing services to use admin pre-login (shared session)
            $conn->exec("UPDATE services SET requires_user_credentials = FALSE");

            // Insert default extensions
            $extensions = [
                [
                    'ublock-origin-lite',
                    'uBlock Origin Lite',
                    'Ad blocker for Chromium browsers (Manifest V3)',
                    'https://chromewebstore.google.com/detail/ublock-origin-lite/ddkjiahejlhfcafbddmgiahcphecmpfh',
                    '2025.1012.1712'
                ]
            ];

            $sql = "INSERT IGNORE INTO extensions (extension_id, extension_name, description, download_url, version)
                    VALUES (:extension_id, :extension_name, :description, :download_url, :version)";
            $stmt = $conn->prepare($sql);
            foreach ($extensions as $ext) {
                $stmt->execute([
                    'extension_id' => $ext[0],
                    'extension_name' => $ext[1],
                    'description' => $ext[2],
                    'download_url' => $ext[3],
                    'version' => $ext[4]
                ]);
            }

            // Assign uBlock Origin Lite to YouTube and Spotify
            $serviceExtensions = [
                ['youtube', 'ublock-origin-lite'],
                ['spotify', 'ublock-origin-lite']
            ];

            $sql = "INSERT IGNORE INTO service_extensions (service_type, extension_id) VALUES (:service_type, :extension_id)";
            $stmt = $conn->prepare($sql);
            foreach ($serviceExtensions as $se) {
                $stmt->execute(['service_type' => $se[0], 'extension_id' => $se[1]]);
            }

            // Insert default domain restrictions
            $domains = [
                ['youtube', 'youtube.com'],
                ['youtube', 'www.youtube.com'],
                ['youtube', 'm.youtube.com'],
                ['youtube', 'youtu.be'],
                ['youtube', 'accounts.google.com'],
                ['youtube', 'accounts.youtube.com'],
                ['spotify', 'spotify.com'],
                ['spotify', 'www.spotify.com'],
                ['spotify', 'open.spotify.com'],
                ['spotify', 'accounts.spotify.com'],
                ['netflix', 'netflix.com'],
                ['netflix', 'www.netflix.com'],
                ['gemini', 'gemini.google.com'],
                ['gemini', 'aistudio.google.com'],
                ['gemini', 'accounts.google.com'],
                ['gemini', 'google.com'],
                ['gemini', 'www.google.com'],
                ['chatgpt', 'chat.openai.com'],
                ['chatgpt', 'chatgpt.com'],
                ['chatgpt', 'auth0.openai.com'],
                ['chatgpt', 'auth.openai.com']
            ];

            $sql = "INSERT IGNORE INTO domain_restrictions (service_type, domain) VALUES (:service_type, :domain)";
            $stmt = $conn->prepare($sql);
            foreach ($domains as $domain) {
                $stmt->execute(['service_type' => $domain[0], 'domain' => $domain[1]]);
            }

            return [
                "success" => true,
                "message" => "Database initialized successfully"
            ];

        } catch(PDOException $exception) {
            return [
                "success" => false,
                "message" => "Database initialization error: " . $exception->getMessage()
            ];
        }
    }
}
?>
