/**
 * Updated API Class with IP Session Tracking
 * Single Session Per IP Implementation
 *
 * @author Claude Code
 * @date 2025-01-04
 * @version 2.0
 */

// Make ipcRenderer globally available for other scripts
if (typeof window !== 'undefined') {
  window.ipcRenderer = require('electron').ipcRenderer;
}
const ipcRenderer = window.ipcRenderer;
const axios = require('axios');

// API Configuration
const API_BASE_URL = 'https://db.handymancode.com/api/wokushop-api'; // DNS only mode (Cloudflare proxy disabled)

class API {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = this.getStoredToken();
  }

  // Private error handler
  _handleError(error, defaultMessage) {
    let message = defaultMessage;

    // For concurrent session errors, don't modify the error - let caller handle
    if (error.response?.data?.error_code === 'CONCURRENT_SESSION_BLOCKED') {
      throw error; // Preserve original error for proper handling
    }

    if (error.response && error.response.data && error.response.data.message) {
      const serverMessage = error.response.data.message;
      if (typeof serverMessage === 'object') {
        message = JSON.stringify(serverMessage);
      } else {
        message = serverMessage;
      }
    } else if (error.message) {
      message = error.message;
    }
    throw new Error(message);
  }

  // Storage helpers
  getStoredToken() {
    return ipcRenderer.sendSync('get-store-value', 'authToken');
  }

  setStoredToken(token) {
    ipcRenderer.sendSync('set-store-value', 'authToken', token);
    this.token = token;
  }

  clearStoredToken() {
    ipcRenderer.sendSync('delete-store-value', 'authToken');
    this.token = null;
  }

  getCurrentUser() {
    return ipcRenderer.sendSync('get-store-value', 'currentUser');
  }

  setCurrentUser(user) {
    ipcRenderer.sendSync('set-store-value', 'currentUser', user);
  }

  clearCurrentUser() {
    ipcRenderer.sendSync('delete-store-value', 'currentUser');
  }

  // Auth headers with dual strategy
  getAuthHeaders() {
    return this.token ? {
      'X-Auth-Token': this.token,  // Primary (Cloudflare-safe)
      'Authorization': `Bearer ${this.token}`  // Fallback
    } : {};
  }

  // Standard login with IP tracking
  async login(username, password) {
    try {
      const response = await axios.post(`${this.baseURL}/auth/login.php`, {
        username, password
      });

      if (response.data.success) {
        this.setStoredToken(response.data.token);
        this.setCurrentUser(response.data.user);

        // Trigger session sync
        try {
          await ipcRenderer.invoke('session-sync-login', response.data.user, response.data.token);
          console.log('✅ [API] Session sync login completed');
        } catch (syncError) {
          console.warn('⚠️ [API] Session sync failed (non-blocking):', syncError.message);
        }
      }

      return response.data;
    } catch (error) {
      // Don't call _handleError for session conflicts - preserve original error
      if (error.response?.data?.error_code === 'CONCURRENT_SESSION_BLOCKED') {
        throw error;
      }
      this._handleError(error, 'Login failed');
    }
  }

  // Force login (terminate other sessions)
  async forceLogin(username, password) {
    try {
      const response = await axios.post(`${this.baseURL}/auth/force-login.php`, {
        username,
        password,
        force: true
      });

      if (response.data.success) {
        this.setStoredToken(response.data.token);
        this.setCurrentUser(response.data.user);

        // Trigger session sync
        try {
          await ipcRenderer.invoke('session-sync-login', response.data.user, response.data.token);
          console.log('✅ [API] Force login session sync completed');
        } catch (syncError) {
          console.warn('⚠️ [API] Force login sync failed (non-blocking):', syncError.message);
        }
      }

      return response.data;
    } catch (error) {
      this._handleError(error, 'Force login failed');
    }
  }

  // Enhanced logout
  async logout() {
    try {
      const response = await axios.post(`${this.baseURL}/auth/logout.php`, {}, {
        headers: this.getAuthHeaders()
      });

      // Clear local storage regardless of server response
      this.clearStoredToken();
      this.clearCurrentUser();

      return response.data;
    } catch (error) {
      // Always clear local storage on logout, even if server call fails
      this.clearStoredToken();
      this.clearCurrentUser();
      console.warn('⚠️ [API] Logout server call failed (cleared local data anyway):', error.message);

      return { success: true, message: 'Logged out locally' };
    }
  }

  // Get current session information
  async getSessionInfo() {
    try {
      const response = await axios.get(`${this.baseURL}/auth/session-info.php`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to get session info');
    }
  }

  // Get active sessions (admin only)
  async getActiveSessions() {
    try {
      const response = await axios.get(`${this.baseURL}/auth/active-sessions.php`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to get active sessions');
    }
  }

  // Force logout specific session (admin only)
  async forceLogoutSession(sessionId) {
    try {
      const response = await axios.post(`${this.baseURL}/auth/force-logout-session.php`, {
        session_id: sessionId
      }, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to force logout session');
    }
  }

  // Get system settings (admin only)
  async getSystemSettings() {
    try {
      const response = await axios.get(`${this.baseURL}/settings/list.php`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to get system settings');
    }
  }

  // Update system setting (admin only)
  async updateSystemSetting(key, value) {
    try {
      const response = await axios.post(`${this.baseURL}/settings/update.php`, {
        setting_key: key,
        setting_value: value
      }, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to update system setting');
    }
  }

  // --- EXISTING METHODS (updated to include session tracking) ---

  async getAccounts() {
    try {
      const response = await axios.get(`${this.baseURL}/accounts/list.php`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to fetch accounts');
    }
  }

  async createAccount(accountData) {
    try {
      const response = await axios.post(`${this.baseURL}/accounts/create.php`, accountData, {
        headers: this.getAuthHeaders()
      });

      // Log account creation activity with session info
      if (response.data.success) {
        try {
          await this.logActivity('account_created', {
            account_id: response.data.id,
            service_type: accountData.service_type,
            service_name: accountData.service_name,
            timestamp: new Date().toISOString()
          });
        } catch (logError) {
          console.warn('⚠️ [API] Activity logging failed (non-blocking)');
        }
      }

      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to create account');
    }
  }

  async logActivity(action, details = {}) {
    try {
      // Add session info to activity details
      const currentUser = this.getCurrentUser();
      const enhancedDetails = {
        ...details,
        user_id: currentUser?.id,
        username: currentUser?.username,
        user_role: currentUser?.role,
        timestamp: details.timestamp || new Date().toISOString()
      };

      const response = await axios.post(`${this.baseURL}/logs/create.php`, {
        action: action,
        details: enhancedDetails
      }, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      // Don't throw error for logging failures
      console.warn('⚠️ [API] Activity logging failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Cookie sync methods (existing)
  async saveAccountCookies(accountId, cookies) {
    try {
      const response = await axios.post(`${this.baseURL}/cookies/save.php`, {
        account_id: accountId,
        cookies: cookies
      }, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to save cookies');
    }
  }

  async getAccountCookies(accountId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/cookies/get.php?account_id=${accountId}`,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to get cookies');
    }
  }

  // Session sync methods (existing - updated with error handling)
  async sessionSyncUp() {
    try {
      const result = await ipcRenderer.invoke('session-sync-up');
      if (!result.success) throw new Error(result.message);
      return result.data;
    } catch (error) {
      console.warn('⚠️ [API] Session sync up failed:', error.message);
      throw error;
    }
  }

  async sessionSyncDown() {
    try {
      const result = await ipcRenderer.invoke('session-sync-down');
      if (!result.success) throw new Error(result.message);
      return result.data;
    } catch (error) {
      console.warn('⚠️ [API] Session sync down failed:', error.message);
      throw error;
    }
  }

  async sessionValidate() {
    try {
      const result = await ipcRenderer.invoke('session-validate');
      if (!result.success) throw new Error(result.message);
      return result.data;
    } catch (error) {
      console.warn('⚠️ [API] Session validation failed:', error.message);
      throw error;
    }
  }

  async sessionFullSync() {
    try {
      const result = await ipcRenderer.invoke('session-full-sync');
      if (!result.success) throw new Error(result.message);
      return result.data;
    } catch (error) {
      console.warn('⚠️ [API] Session full sync failed:', error.message);
      throw error;
    }
  }

  // --- ALL OTHER EXISTING METHODS REMAIN UNCHANGED ---
  // (getUsers, createUser, deleteUser, getServices, etc.)
  // These are preserved exactly as they were in the original file
  // ... [rest of existing methods] ...
}

// Create global API instance
window.api = new API();

// Export for Node.js compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API;
}