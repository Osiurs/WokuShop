<?php
/**
 * Unified Session Manager Wrapper
 * Provides a single interface to work with different session management strategies
 *
 * This wrapper automatically routes calls to the appropriate session manager
 * based on the current configuration, avoiding conflicts and confusion.
 *
 * @author Claude Code
 * @date 2025-11-08
 * @version 1.0
 */

require_once 'session-config.php';
require_once 'session-managers/ip-based-session-manager.php';
require_once 'session-managers/strict-session-manager.php';

class UnifiedSessionManager {
    private $sessionManager;
    private $database;

    public function __construct($database) {
        $this->database = $database;
        $this->initializeSessionManager();
    }

    /**
     * Initialize the appropriate session manager based on configuration
     */
    private function initializeSessionManager() {
        $strategy = SessionConfig::getActiveStrategy();

        switch ($strategy) {
            case SessionConfig::STRATEGY_IP_BASED:
                $this->sessionManager = new IPBasedSessionManager($this->database);
                break;
            case SessionConfig::STRATEGY_STRICT:
                $this->sessionManager = new StrictSessionManager($this->database);
                break;
            default:
                throw new Exception("Unknown session strategy: $strategy");
        }
    }

    /**
     * Get current session management strategy information
     *
     * @return array Strategy information
     */
    public function getSessionInfo() {
        return [
            'strategy' => SessionConfig::getActiveStrategy(),
            'manager_class' => get_class($this->sessionManager),
            'table' => SessionConfig::getSessionTable(),
            'description' => $this->getStrategyDescription()
        ];
    }

    /**
     * Get description of current strategy
     *
     * @return string Strategy description
     */
    private function getStrategyDescription() {
        switch (SessionConfig::getActiveStrategy()) {
            case SessionConfig::STRATEGY_IP_BASED:
                return 'Multiple devices allowed per user from different IPs';
            case SessionConfig::STRATEGY_STRICT:
                return 'Only one active session per user across all devices';
            default:
                return 'Unknown strategy';
        }
    }

    /**
     * Check if user can login from current IP
     *
     * @param int $userId User ID
     * @param string $currentIP Current IP address
     * @return array Decision with reason
     */
    public function canUserLogin($userId, $currentIP) {
        $result = $this->sessionManager->canUserLogin($userId, $currentIP);

        // Add strategy info to result
        $result['strategy'] = SessionConfig::getActiveStrategy();
        $result['strategy_description'] = $this->getStrategyDescription();

        return $result;
    }

    /**
     * Create new user session
     *
     * @param int $userId User ID
     * @param string $token Session token
     * @param string $ipAddress IP address
     * @return array Result with success status
     */
    public function createSession($userId, $token, $ipAddress) {
        $result = $this->sessionManager->createSession($userId, $token, $ipAddress);

        // Add strategy info to result
        if ($result['success']) {
            $result['strategy'] = SessionConfig::getActiveStrategy();
            $result['strategy_description'] = $this->getStrategyDescription();
        }

        return $result;
    }

    /**
     * Check if user has existing active session
     *
     * @param int $userId User ID
     * @return array|false Session data or false if none
     */
    public function checkExistingSession($userId) {
        return $this->sessionManager->checkExistingSession($userId);
    }

    /**
     * Update last activity timestamp for session
     *
     * @param int $userId User ID
     * @param string $ipAddress IP address
     */
    public function updateLastActivity($userId, $ipAddress) {
        return $this->sessionManager->updateLastActivity($userId, $ipAddress);
    }

    /**
     * Logout user session
     *
     * @param int $userId User ID
     * @param string $token Session token
     * @return array Result with success status
     */
    public function logoutSession($userId, $token) {
        $result = $this->sessionManager->logoutSession($userId, $token);

        // Add strategy info to result
        if ($result['success']) {
            $result['strategy'] = SessionConfig::getActiveStrategy();
        }

        return $result;
    }

    /**
     * Force logout specific session
     *
     * @param int $sessionId Session ID
     */
    public function forceLogoutSession($sessionId) {
        return $this->sessionManager->forceLogoutSession($sessionId);
    }

    /**
     * Force logout all user sessions
     *
     * @param int $userId User ID
     */
    public function forceLogoutAllUserSessions($userId) {
        return $this->sessionManager->forceLogoutAllUserSessions($userId);
    }

    /**
     * Cleanup expired sessions
     *
     * @return int Number of cleaned up sessions
     */
    public function cleanupExpiredSessions() {
        return $this->sessionManager->cleanupExpiredSessions();
    }

    /**
     * Get active sessions for admin view
     *
     * @return array Active sessions
     */
    public function getActiveSessions() {
        $sessions = $this->sessionManager->getActiveSessions();

        // Add strategy info to each session
        foreach ($sessions as &$session) {
            $session['strategy'] = SessionConfig::getActiveStrategy();
        }

        return $sessions;
    }

    /**
     * Get session statistics for dashboard
     *
     * @return array Session statistics
     */
    public function getSessionStats() {
        $activeSessions = $this->getActiveSessions();
        $totalSessions = count($activeSessions);

        $stats = [
            'strategy' => SessionConfig::getActiveStrategy(),
            'strategy_description' => $this->getStrategyDescription(),
            'total_active_sessions' => $totalSessions,
            'unique_users' => count(array_unique(array_column($activeSessions, 'user_id'))),
            'unique_ips' => count(array_unique(array_column($activeSessions, 'ip_address'))),
            'cleanup_count' => $this->cleanupExpiredSessions()
        ];

        if (SessionConfig::isIPBasedStrategy()) {
            // For IP-based strategy, show sessions per user
            $usersWithMultipleSessions = [];
            $userSessions = [];
            foreach ($activeSessions as $session) {
                $userId = $session['user_id'];
                if (!isset($userSessions[$userId])) {
                    $userSessions[$userId] = 0;
                }
                $userSessions[$userId]++;
            }

            foreach ($userSessions as $userId => $count) {
                if ($count > 1) {
                    $usersWithMultipleSessions[] = [
                        'user_id' => $userId,
                        'session_count' => $count
                    ];
                }
            }

            $stats['users_with_multiple_sessions'] = $usersWithMultipleSessions;
            $stats['max_sessions_per_user'] = !empty($userSessions) ? max($userSessions) : 0;
        }

        return $stats;
    }

    /**
     * Validate session token and get session info
     *
     * @param string $token Session token
     * @return array|false Session info or false if invalid
     */
    public function validateSessionToken($token) {
        $table = SessionConfig::getSessionTable();
        $tokenField = SessionConfig::isStrictStrategy() ? 'token' : 'session_token';

        $query = "SELECT * FROM $table
                 WHERE $tokenField = :token AND is_active = TRUE
                 ORDER BY last_activity DESC LIMIT 1";

        $stmt = $this->database->getConnection()->prepare($query);
        $stmt->execute(['token' => $token]);
        $session = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($session) {
            // Check if session is expired
            $timeoutMinutes = $this->getSetting('session_timeout_minutes', 120);
            $lastActivity = strtotime($session['last_activity']);
            $timeoutTime = $lastActivity + ($timeoutMinutes * 60);

            if (time() > $timeoutTime) {
                // Session expired
                $this->forceLogoutSession($session['id']);
                return false;
            }

            // Update last activity
            $this->updateLastActivity($session['user_id'], $session['ip_address']);

            // Add strategy info
            $session['strategy'] = SessionConfig::getActiveStrategy();
            $session['strategy_description'] = $this->getStrategyDescription();

            return $session;
        }

        return false;
    }

    /**
     * Change session strategy (admin only)
     *
     * @param string $newStrategy New strategy
     * @return array Result
     */
    public function changeStrategy($newStrategy) {
        try {
            $oldStrategy = SessionConfig::getActiveStrategy();

            if ($oldStrategy === $newStrategy) {
                return [
                    'success' => false,
                    'message' => 'Strategy is already set to ' . $newStrategy
                ];
            }

            // Logout all active sessions when changing strategy
            $this->logoutAllActiveSessions();

            // Change strategy
            SessionConfig::setActiveStrategy($newStrategy);
            $this->initializeSessionManager();

            return [
                'success' => true,
                'message' => "Session strategy changed from $oldStrategy to $newStrategy",
                'old_strategy' => $oldStrategy,
                'new_strategy' => $newStrategy,
                'sessions_logged_out' => 'All active sessions were terminated'
            ];

        } catch (Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Logout all active sessions (used when changing strategy)
     */
    private function logoutAllActiveSessions() {
        $table = SessionConfig::getSessionTable();

        $query = "UPDATE $table SET is_active = FALSE, logout_time = CURRENT_TIMESTAMP
                 WHERE is_active = TRUE";

        $stmt = $this->database->getConnection()->prepare($query);
        $stmt->execute();

        return $stmt->rowCount();
    }

    /**
     * Get system setting value (helper method)
     */
    private function getSetting($key, $default = null) {
        $query = "SELECT setting_value, setting_type FROM system_settings
                 WHERE setting_key = :key AND is_active = TRUE";
        $stmt = $this->database->getConnection()->prepare($query);
        $stmt->execute(['key' => $key]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$result) {
            return $default;
        }

        switch ($result['setting_type']) {
            case 'boolean':
                return filter_var($result['setting_value'], FILTER_VALIDATE_BOOLEAN);
            case 'integer':
                return intval($result['setting_value']);
            case 'json':
                return json_decode($result['setting_value'], true);
            default:
                return $result['setting_value'];
        }
    }

    /**
     * Get debug information for troubleshooting
     *
     * @return array Debug information
     */
    public function getDebugInfo() {
        return [
            'config' => SessionConfig::getDebugInfo(),
            'manager_class' => get_class($this->sessionManager),
            'session_info' => $this->getSessionInfo(),
            'stats' => $this->getSessionStats()
        ];
    }
}
?>