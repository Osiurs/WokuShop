<?php
/**
 * Optimized Database Class - Enhanced performance with caching and connection pooling
 */
require_once __DIR__ . '/env.php';

header("Access-Control-Allow-Origin: " . Env::get('CORS_ORIGIN', '*'));
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

class OptimizedDatabase {
    private static $instance = null;
    private $host;
    private $db_name;
    private $username;
    private $password;
    public $conn;
    
    // Performance optimizations
    private static $queryCache = [];
    private static $cacheTimeout = 300; // 5 minutes
    private static $connectionPool = [];
    private static $maxConnections = 5;

    private function __construct() {
        $this->host = Env::get('DB_HOST', 'localhost');
        $this->db_name = Env::get('DB_NAME', 'wokushop_db');
        $this->username = Env::get('DB_USER', 'root');
        $this->password = Env::get('DB_PASS', '');
    }

    /**
     * Singleton pattern for connection reuse
     */
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Optimized connection with pooling
     */
    public function getConnection() {
        // Try to reuse existing connection
        if ($this->conn && $this->isConnectionAlive($this->conn)) {
            return $this->conn;
        }

        // Create new optimized connection
        try {
            $dsn = "mysql:host=" . $this->host . ";dbname=" . $this->db_name . ";charset=utf8mb4";
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_PERSISTENT => true, // Connection pooling
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
                PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => true,
                PDO::ATTR_TIMEOUT => 10 // 10 second timeout
            ];

            $this->conn = new PDO($dsn, $this->username, $this->password, $options);
            
            // Optimize MySQL settings for performance
            $this->conn->exec("SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO'");
            $this->conn->exec("SET SESSION innodb_lock_wait_timeout = 5");
            
            return $this->conn;
            
        } catch(PDOException $exception) {
            echo json_encode([
                "success" => false,
                "message" => "Connection error: " . $exception->getMessage()
            ]);
            die();
        }
    }

    /**
     * Check if connection is still alive
     */
    private function isConnectionAlive($conn) {
        try {
            $conn->query('SELECT 1');
            return true;
        } catch (PDOException $e) {
            return false;
        }
    }

    /**
     * Cached query execution
     */
    public function cachedQuery($sql, $params = [], $cacheKey = null, $ttl = null) {
        if (!$cacheKey) {
            $cacheKey = md5($sql . serialize($params));
        }
        
        $ttl = $ttl ?: self::$cacheTimeout;
        
        // Check cache
        if (isset(self::$queryCache[$cacheKey])) {
            $cached = self::$queryCache[$cacheKey];
            if (time() - $cached['timestamp'] < $ttl) {
                return $cached['data'];
            }
        }

        // Execute query
        $conn = $this->getConnection();
        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        $result = $stmt->fetchAll();

        // Cache result
        self::$queryCache[$cacheKey] = [
            'data' => $result,
            'timestamp' => time()
        ];

        return $result;
    }

    /**
     * Fast user authentication query
     */
    public function authenticateUser($username) {
        $sql = "SELECT id, username, password, role FROM users WHERE username = ? LIMIT 1";
        return $this->cachedQuery($sql, [$username], "user_auth_" . $username, 60); // 1 minute cache
    }

    /**
     * Fast user accounts query
     */
    public function getUserAccounts($userId) {
        $sql = "SELECT a.id, a.service_name, a.service_type, a.description, a.partition_id
                FROM accounts a
                INNER JOIN user_accounts ua ON a.id = ua.account_id
                WHERE ua.user_id = ? AND ua.is_active = 1";
        return $this->cachedQuery($sql, [$userId], "user_accounts_" . $userId, 120); // 2 minutes cache
    }

    /**
     * Fast services list query
     */
    public function getActiveServices() {
        $sql = "SELECT service_type, display_name, login_url, icon_emoji 
                FROM services WHERE is_active = 1 ORDER BY display_name";
        return $this->cachedQuery($sql, [], "active_services", 300); // 5 minutes cache
    }

    /**
     * Optimized session cleanup
     */
    public function cleanupExpiredSessions() {
        $conn = $this->getConnection();
        
        // Use single query for cleanup
        $sql = "DELETE s, us FROM sessions s 
                LEFT JOIN user_sessions us ON s.user_id = us.user_id 
                WHERE s.expires_at < NOW() OR us.expires_at < NOW()";
        
        return $conn->exec($sql);
    }

    /**
     * Batch insert for better performance
     */
    public function batchInsert($table, $data, $onDuplicate = false) {
        if (empty($data)) return false;

        $conn = $this->getConnection();
        $columns = array_keys($data[0]);
        $placeholders = '(' . str_repeat('?,', count($columns) - 1) . '?)';
        $values = str_repeat($placeholders . ',', count($data) - 1) . $placeholders;
        
        $sql = "INSERT INTO {$table} (" . implode(',', $columns) . ") VALUES {$values}";
        
        if ($onDuplicate) {
            $updates = array_map(function($col) { return "{$col}=VALUES({$col})"; }, $columns);
            $sql .= " ON DUPLICATE KEY UPDATE " . implode(',', $updates);
        }

        $stmt = $conn->prepare($sql);
        
        $params = [];
        foreach ($data as $row) {
            foreach ($columns as $col) {
                $params[] = $row[$col];
            }
        }
        
        return $stmt->execute($params);
    }

    /**
     * Clear query cache
     */
    public static function clearCache($pattern = null) {
        if ($pattern) {
            foreach (self::$queryCache as $key => $value) {
                if (strpos($key, $pattern) !== false) {
                    unset(self::$queryCache[$key]);
                }
            }
        } else {
            self::$queryCache = [];
        }
    }

    /**
     * Get cache statistics
     */
    public static function getCacheStats() {
        return [
            'cached_queries' => count(self::$queryCache),
            'cache_timeout' => self::$cacheTimeout,
            'memory_usage' => memory_get_usage(true)
        ];
    }
}
?>
