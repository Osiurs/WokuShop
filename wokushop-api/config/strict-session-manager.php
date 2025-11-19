<?php
/**
 * Strict Session Manager Class
 * STRICT MODE: Only ONE session per user - no IP restrictions, just ONE session period
 *
 * Difference from SessionManager:
 * - Blocks ALL new logins if user has ANY active session
 * - Doesn't care about IP address - purely session-based blocking
 * - User MUST logout before login on new device
 *
 * @author Claude Code
 * @date 2025-11-08
 * @version 2.0 - STRICT MODE
 */

require_once 'ip-helper.php';

class StrictSessionManager {
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
     * STRICT MODE: Check if user can login (BLOCKS if ANY session exists)
     *
     * @param int $userId User ID
     * @param string $currentIP Current IP address (logged for reference)
     * @return array Decision with reason
     */
    public function canUserLogin($userId, $currentIP) {
        // Check if strict session is enabled
        if (!$this->getSetting('strict_session_enabled', true)) {
            return ['allowed' => true, 'reason' => 'Strict session disabled'];
        }

        // Check for existing session
        $existingSession = $this->checkExistingSession($userId);

        if (!$existingSession) {
            return ['allowed' => true, 'reason' => 'No existing session'];
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
                'reason' => 'Previous session expired',
                'expired_session' => $existingSession
            ];
        }

        // STRICT MODE: Block ANY new login if there's an active session
        // User must logout first before logging in again
        return [
            'allowed' => false,
            'reason' => 'User already has an active session. Please logout first.',
            'existing_ip' => IPHelper::maskIP($existingSession['ip_address']),
            'existing_since' => $existingSession['login_time'],
            'last_activity' => $existingSession['last_activity'],
            'session_id' => $existingSession['id'],
            'current_ip' => IPHelper::maskIP($currentIP),
            'message' => 'Only one active session allowed per user. Logout from other device first.',
            'instructions' => 'Use logout or force logout API, or wait for session timeout (' . $timeoutMinutes . ' minutes)'
        ];
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

            // STRICT MODE: Force logout any existing sessions for this user
            $this->forceLogoutAllUserSessions($userId);

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

            // Also update the original sessions table
            $sessionQuery = "INSERT INTO sessions
                           (user_id, token, ip_address, user_agent, device_info, expires_at, is_active)
                           VALUES (:user_id, :token, :ip_address, :user_agent, :device_info, :expires_at, :is_active)
                           ON DUPLICATE KEY UPDATE
                           ip_address = VALUES(ip_address),
                           last_activity = CURRENT_TIMESTAMP,
                           is_active = TRUE";

            $stmt2 = $this->db->prepare($sessionQuery);
            $stmt2->execute([
                'user_id' => $userId,
                'token' => $token,
                'ip_address' => $ipAddress,
                'user_agent' => IPHelper::getUserAgent(),
                'device_info' => IPHelper::generateDeviceFingerprint(),
                'expires_at' => date('Y-m-d H:i:s', time() + 86400), // 24 hours
                'is_active' => true
            ]);

            $this->db->commit();

            // Log successful session creation
            $this->logSecurityEvent($userId, 'strict_session_created', [
                'ip_address' => $ipAddress,
                'session_id' => $sessionId,
                'user_agent' => IPHelper::getUserAgent(),
                'mode' => 'strict'
            ]);

            return [
                'success' => true,
                'session_id' => $sessionId,
                'message' => 'Session created successfully (STRICT MODE: Only one session allowed)'
            ];

        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("[StrictSessionManager] Create session error: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
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

        // Also update original sessions table
        $query2 = "UPDATE sessions
                  SET last_activity = CURRENT_TIMESTAMP
                  WHERE user_id = :user_id AND ip_address = :ip_address AND is_active = TRUE";

        $stmt2 = $this->db->prepare($query2);
        $stmt2->execute([
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

            // Mark as inactive in sessions table
            $query2 = "UPDATE sessions
                      SET is_active = FALSE, logout_time = CURRENT_TIMESTAMP
                      WHERE user_id = :user_id AND token = :token";

            $stmt2 = $this->db->prepare($query2);
            $stmt2->execute([
                'user_id' => $userId,
                'token' => $token
            ]);

            $this->db->commit();

            // Log logout event
            $this->logSecurityEvent($userId, 'strict_session_logout', [
                'token' => substr($token, 0, 20) . '...', // Partial token for security
                'mode' => 'strict'
            ]);

            return ['success' => true, 'message' => 'Logout successful - other devices can now login'];

        } catch (Exception $e) {
            $this->db->rollBack();
            error_log("[StrictSessionManager] Logout error: " . $e->getMessage());
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
            $this->logSecurityEvent($sessionInfo['user_id'], 'strict_session_force_logout', [
                'session_id' => $sessionId,
                'ip_address' => $sessionInfo['ip_address'],
                'mode' => 'strict'
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
            $this->logSecurityEvent($userId, 'strict_session_force_logout_all', [
                'affected_sessions' => $affectedRows,
                'mode' => 'strict'
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
            error_log("[StrictSessionManager] Log security event error: " . $e->getMessage());
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
}
?>