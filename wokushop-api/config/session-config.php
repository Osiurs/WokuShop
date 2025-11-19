<?php
/**
 * Session Management Configuration
 * Defines which session strategy to use across the application
 *
 * Created: 2025-11-08
 * Purpose: Avoid conflicts between different session managers
 */

class SessionConfig {
    // Session Strategy Options
    const STRATEGY_IP_BASED = 'ip_based';      // Multiple devices allowed per user
    const STRATEGY_STRICT = 'strict';          // Single session per user

    // Current active strategy - CHANGE THIS TO SWITCH SESSION MODES
    private static $activeStrategy = self::STRATEGY_STRICT;

    // Session Manager Classes
    private static $managers = [
        self::STRATEGY_IP_BASED => 'IPBasedSessionManager',
        self::STRATEGY_STRICT => 'StrictSessionManager'
    ];

    /**
     * Get the currently active session strategy
     */
    public static function getActiveStrategy() {
        return self::$activeStrategy;
    }

    /**
     * Set the active session strategy
     * @param string $strategy - Either 'ip_based' or 'strict'
     */
    public static function setActiveStrategy($strategy) {
        if (!array_key_exists($strategy, self::$managers)) {
            throw new Exception("Invalid session strategy: $strategy");
        }
        self::$activeStrategy = $strategy;
    }

    /**
     * Get the session manager class for current strategy
     */
    public static function getActiveManagerClass() {
        return self::$managers[self::$activeStrategy];
    }

    /**
     * Check if current strategy is IP-based
     */
    public static function isIPBasedStrategy() {
        return self::$activeStrategy === self::STRATEGY_IP_BASED;
    }

    /**
     * Check if current strategy is strict
     */
    public static function isStrictStrategy() {
        return self::$activeStrategy === self::STRATEGY_STRICT;
    }

    /**
     * Get session table name for current strategy
     */
    public static function getSessionTable() {
        return self::isStrictStrategy() ? 'sessions' : 'user_ip_sessions';
    }

    /**
     * Get configuration for debugging
     */
    public static function getDebugInfo() {
        return [
            'active_strategy' => self::$activeStrategy,
            'manager_class' => self::getActiveManagerClass(),
            'session_table' => self::getSessionTable(),
            'available_strategies' => array_keys(self::$managers)
        ];
    }
}

// Auto-include required session manager based on strategy
$managerClass = SessionConfig::getActiveManagerClass();
switch ($managerClass) {
    case 'IPBasedSessionManager':
        require_once __DIR__ . '/session-managers/ip-based-session-manager.php';
        break;
    case 'StrictSessionManager':
        require_once __DIR__ . '/session-managers/strict-session-manager.php';
        break;
}

?>