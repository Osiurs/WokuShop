<?php
/**
 * IP-Based Session Manager Class
 * Allows multiple sessions per user from different IPs
 * Handles session lifecycle, IP tracking, and concurrent session management
 *
 * @author Claude Code
 * @date 2025-11-08
 * @version 2.0 (Reorganized from original session-manager.php)
 */

require_once __DIR__ . '/../ip-helper.php';

class IPBasedSessionManager {
    private $db;

    public function __construct($database) {
        $this->db = $database->getConnection();
    }

    /**
     * Check if user has existing active session
     *
     * @param int $userId User ID
     * @return array|false Session data or false if none
     */
    public function checkExistingSession($userId) {
        $query = "SELECT * FROM user_ip_sessions
                 WHERE user_id = :user_id AND is_active = TRUE
                 ORDER BY last_activity DESC LIMIT 1";

        $stmt = $this->db->prepare($query);
        $stmt->execute(['user_id' => $userId]);

        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Check if user can login from current IP
     * IP-Based Strategy: Allows multiple devices per user
     *
     * @param int $userId User ID
     * @param string $currentIP Current IP address
     * @return array Decision with reason
     */
    public function canUserLogin($userId, $currentIP) {
        // Check if single session is enabled
        if (!$this->getSetting('single_session_enabled', true)) {
            return ['allowed' => true, 'reason' => 'Single session disabled'];
        }

        // Check if IP restriction is enabled
        if (!$this->getSetting('ip_restriction_enabled', true)) {
            return ['allowed' => true, 'reason' => 'IP restriction disabled'];
        }

        // Check IP whitelist
        $whitelist = json_decode($this->getSetting('ip_whitelist', '[]'), true);
        if (IPHelper::isIPWhitelisted($currentIP, $whitelist)) {
            return ['allowed' => true, 'reason' => 'IP whitelisted'];
        }

        // Check for existing session FROM SAME IP
        $existingSession = $this->checkExistingSessionFromIP($userId, $currentIP);

        if (!$existingSession) {
            return ['allowed' => true, 'reason' => 'No existing session from this IP'];
        }

        // Check session timeout
        $timeoutMinutes = $this->getSetting('session_timeout_minutes', 120);
        $lastActivity = strtotime($existingSession['last_activity']);
        $timeoutTime = $lastActivity + ($timeoutMinutes * 60);

        if (time() > $timeoutTime) {
            // Session expired - force logout existing session
            $this->forceLogoutSession($existingSession['id']);
            return [
                'allowed' => true,
                'reason' => 'Previous session from this IP expired',
                'expired_session' => $existingSession
            ];
        }

        // Allow login - just update existing session
        return [
            'allowed' => true,
            'reason' => 'Updating existing session from same IP',
            'existing_session' => $existingSession
        ];
    }

    /**
     * Check for existing session from specific IP
     *
     * @param int $userId User ID
     * @param string $ipAddress IP address
     * @return array|false Session data or false
     */
    private function checkExistingSessionFromIP($userId, $ipAddress) {
        $query = "SELECT * FROM user_ip_sessions
                 WHERE user_id = :user_id AND ip_address = :ip_address AND is_active = TRUE
                 ORDER BY last_activity DESC LIMIT 1";

        $stmt = $this->db->prepare($query);
        $stmt->execute([
            'user_id' => $userId,
            'ip_address' => $ipAddress
        ]);

        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Create new user session with IP tracking
     *
     * @param int $userId User ID
     * @param string $token Session token
     * @param string $ipAddress IP address
     * @return array Result with success status
     */
    public function createSession($userId, $token, $ipAddress) {
        try {
            $this->db->beginTransaction();

            // Only logout sessions from same IP (not all sessions)
            $this->logoutSessionsFromIP($userId, $ipAddress);

            // Create new session record in user_ip_sessions
            $query = "INSERT INTO user_ip_sessions
                     (user_id, ip_address, session_token, user_agent, device_fingerprint)
                     VALUES (:user_id, :ip_address, :session_token, :user_agent, :device_fingerprint)";

            $stmt = $this->db->prepare($query);
            $success = $stmt->execute([
                'user_id' => $userId,
                'ip_address' => $ipAddress,
                'session_token' => $token,
                'user_agent' => IPHelper::getUserAgent(),
                'device_fingerprint' => IPHelper::generateDeviceFingerprint()
            ]);

            $sessionId = $this->db->lastInsertId();

            $this->db->commit();

            // Log successful session creation
            $this->logSecurityEvent($userId, 'ip_session_created', [
                'ip_address' => $ipAddress,
                'session_id' => $sessionId,
                'user_agent' => IPHelper::getUserAgent()
            ]);

            return [
                'success' => true,
                'session_id' => $sessionId,
                'message' => 'IP-based session created successfully'
            ];

        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("[IPBasedSessionManager] Create session error: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Logout sessions from specific IP only
     *
     * @param int $userId User ID
     * @param string $ipAddress IP address
     */
    private function logoutSessionsFromIP($userId, $ipAddress) {
        $query = "UPDATE user_ip_sessions
                 SET is_active = FALSE, logout_time = CURRENT_TIMESTAMP
                 WHERE user_id = :user_id AND ip_address = :ip_address AND is_active = TRUE";

        $stmt = $this->db->prepare($query);
        $stmt->execute([
            'user_id' => $userId,
            'ip_address' => $ipAddress
        ]);
    }

    /**
     * Update last activity timestamp for session
     *
     * @param int $userId User ID
     * @param string $ipAddress IP address
     */
    public function updateLastActivity($userId, $ipAddress) {
        $query = "UPDATE user_ip_sessions
                 SET last_activity = CURRENT_TIMESTAMP
                 WHERE user_id = :user_id AND ip_address = :ip_address AND is_active = TRUE";

        $stmt = $this->db->prepare($query);
        $stmt->execute([
            'user_id' => $userId,
            'ip_address' => $ipAddress
        ]);
    }

    /**
     * Logout user session
     *
     * @param int $userId User ID
     * @param string $token Session token
     * @return array Result with success status
     */
    public function logoutSession($userId, $token) {
        try {
            $this->db->beginTransaction();

            // Mark session as inactive in user_ip_sessions
            $query1 = "UPDATE user_ip_sessions
                      SET is_active = FALSE, logout_time = CURRENT_TIMESTAMP
                      WHERE user_id = :user_id AND session_token = :token";

            $stmt1 = $this->db->prepare($query1);
            $stmt1->execute([
                'user_id' => $userId,
                'token' => $token
            ]);

            $this->db->commit();

            // Log logout event
            $this->logSecurityEvent($userId, 'ip_session_logout', [
                'token' => substr($token, 0, 20) . '...' // Partial token for security
            ]);

            return ['success' => true, 'message' => 'Logout successful'];

        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("[IPBasedSessionManager] Logout error: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Force logout specific session
     *
     * @param int $sessionId Session ID
     */
    public function forceLogoutSession($sessionId) {
        $query = "UPDATE user_ip_sessions
                 SET is_active = FALSE, logout_time = CURRENT_TIMESTAMP, forced_logout = TRUE
                 WHERE id = :session_id";

        $stmt = $this->db->prepare($query);
        $stmt->execute(['session_id' => $sessionId]);

        // Get session info for logging
        $infoQuery = "SELECT user_id, ip_address FROM user_ip_sessions WHERE id = :session_id";
        $infoStmt = $this->db->prepare($infoQuery);
        $infoStmt->execute(['session_id' => $sessionId]);
        $sessionInfo = $infoStmt->fetch(PDO::FETCH_ASSOC);

        if ($sessionInfo) {
            $this->logSecurityEvent($sessionInfo['user_id'], 'ip_session_force_logout', [
                'session_id' => $sessionId,
                'ip_address' => $sessionInfo['ip_address']
            ]);
        }
    }

    /**
     * Force logout all user sessions
     *
     * @param int $userId User ID
     */
    public function forceLogoutAllUserSessions($userId) {
        $query = "UPDATE user_ip_sessions
                 SET is_active = FALSE, logout_time = CURRENT_TIMESTAMP, forced_logout = TRUE
                 WHERE user_id = :user_id AND is_active = TRUE";

        $stmt = $this->db->prepare($query);
        $stmt->execute(['user_id' => $userId]);

        $affectedRows = $stmt->rowCount();

        if ($affectedRows > 0) {
            $this->logSecurityEvent($userId, 'ip_session_force_logout_all', [
                'affected_sessions' => $affectedRows
            ]);
        }
    }

    /**
     * Get system setting value
     *
     * @param string $key Setting key
     * @param mixed $default Default value
     * @return mixed Setting value
     */
    private function getSetting($key, $default = null) {
        $query = "SELECT setting_value, setting_type FROM system_settings
                 WHERE setting_key = :key AND is_active = TRUE";
        $stmt = $this->db->prepare($query);
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
     * Log security event
     *
     * @param int $userId User ID
     * @param string $action Action performed
     * @param array $details Additional details
     */
    private function logSecurityEvent($userId, $action, $details = []) {
        try {
            $query = "INSERT INTO usage_logs (user_id, action, details)
                     VALUES (:user_id, :action, :details)";

            $stmt = $this->db->prepare($query);
            $stmt->execute([
                'user_id' => $userId,
                'action' => $action,
                'details' => json_encode($details)
            ]);
        } catch (Exception $e) {
            error_log("[IPBasedSessionManager] Log security event error: " . $e->getMessage());
        }
    }

    /**
     * Cleanup expired sessions (call this periodically)
     */
    public function cleanupExpiredSessions() {
        $timeoutMinutes = $this->getSetting('session_timeout_minutes', 120);
        $cutoffTime = date('Y-m-d H:i:s', time() - ($timeoutMinutes * 60));

        $query = "UPDATE user_ip_sessions
                 SET is_active = FALSE, logout_time = CURRENT_TIMESTAMP
                 WHERE is_active = TRUE AND last_activity < :cutoff_time";

        $stmt = $this->db->prepare($query);
        $stmt->execute(['cutoff_time' => $cutoffTime]);

        return $stmt->rowCount(); // Return number of cleaned up sessions
    }

    /**
     * Get active sessions for admin view
     *
     * @return array Active sessions
     */
    public function getActiveSessions() {
        $query = "SELECT uis.*, u.username
                 FROM user_ip_sessions uis
                 INNER JOIN users u ON uis.user_id = u.id
                 WHERE uis.is_active = TRUE
                 ORDER BY uis.last_activity DESC";

        $stmt = $this->db->prepare($query);
        $stmt->execute();

        $sessions = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Mask IP addresses for privacy
        foreach ($sessions as &$session) {
            $session['ip_address_masked'] = IPHelper::maskIP($session['ip_address']);
        }

        return $sessions;
    }

    /**
     * Get sessions count per user (for monitoring)
     *
     * @return array Sessions count per user
     */
    public function getSessionsCountPerUser() {
        $query = "SELECT u.username, u.id as user_id, COUNT(uis.id) as active_sessions
                 FROM users u
                 LEFT JOIN user_ip_sessions uis ON u.id = uis.user_id AND uis.is_active = TRUE
                 GROUP BY u.id, u.username
                 HAVING active_sessions > 0
                 ORDER BY active_sessions DESC";

        $stmt = $this->db->prepare($query);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
?>