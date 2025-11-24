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

  // Get auth headers
  getAuthHeaders() {
    // Use X-Auth-Token instead of Authorization to avoid Cloudflare stripping
    // Backend supports both for compatibility
    return this.token ? {
      'X-Auth-Token': this.token,
      'Authorization': `Bearer ${this.token}` // Keep as fallback
    } : {};
  }

  // API Methods
  async login(username, password) {
    try {
      const response = await axios.post(`${this.baseURL}/auth/login.php`, {
        username,
        password
      });

      if (response.data.success) {
        this.setStoredToken(response.data.token);
        // The user object now contains the assigned accounts array
        this.setCurrentUser(response.data.user);

        // Trigger session sync login
        try {
          // Wait for the session sync to complete before proceeding
          await ipcRenderer.invoke('session-sync-login', response.data.user, response.data.token);
          console.log('✅ [API] Session sync login completed');
        } catch (syncError) {
          console.error('⚠️ [API] Session sync login failed (non-blocking):', syncError.message);
          // Don't throw error to prevent login failure
        }

        return response.data;
      } else {
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (error) {
      this._handleError(error, 'Login failed');
    }
  }

  async logout() {
    try {
      await axios.post(`${this.baseURL}/auth/logout.php`, {}, {
        headers: this.getAuthHeaders()
      });
    } catch (error) {
    } finally {
      this.clearStoredToken();
      this.clearCurrentUser();
    }
  }

  async loginAsUser(userId) {
    try {

      const response = await axios.post(`${this.baseURL}/auth/login-as.php`, {
        user_id: userId
      }, {
        headers: this.getAuthHeaders()
      });


      if (response.data.success) {
        this.setStoredToken(response.data.token);
        this.setCurrentUser(response.data.user);

        // Trigger session sync login
        try {
          await ipcRenderer.invoke('session-sync-login', response.data.user, response.data.token);
          console.log('✅ [API] Session sync login completed for login-as');
        } catch (syncError) {
          console.error('⚠️ [API] Session sync login failed for login-as (non-blocking):', syncError.message);
        }

        return response.data;
      } else {
        throw new Error(response.data.message || 'Login as user failed');
      }
    } catch (error) {
      this._handleError(error, 'Login as user failed');
    }
  }

  // Account methods
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
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to create account');
    }
  }

  async updateAccount(accountId, accountData) {
    try {
      const response = await axios.put(`${this.baseURL}/accounts/update.php?id=${accountId}`, accountData, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to update account');
    }
  }

  async deleteAccount(accountId) {
    try {
      const response = await axios.delete(`${this.baseURL}/accounts/delete.php?id=${accountId}`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to delete account');
    }
  }

  // User methods
  async getUsers() {
    try {
      const response = await axios.get(`${this.baseURL}/users/list.php`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to fetch users');
    }
  }

  async createUser(userData) {
    try {
      const response = await axios.post(`${this.baseURL}/users/create.php`, userData, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to create user');
    }
  }

  async updateUser(userId, userData) {
    try {
      const response = await axios.put(`${this.baseURL}/users/update.php?id=${userId}`, userData, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to update user');
    }
  }

  async deleteUser(userId) {
    try {
      const response = await axios.delete(`${this.baseURL}/users/delete.php?id=${userId}`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to delete user');
    }
  }

  async assignAccounts(userId, accountIds) {
    try {
      const response = await axios.post(`${this.baseURL}/users/assign-accounts.php`, {
        user_id: userId,
        account_ids: accountIds
      }, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to assign accounts');
    }
  }

  async getUserAccounts(userId) {
    try {
      const response = await axios.get(`${this.baseURL}/users/accounts.php?user_id=${userId}`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to fetch user accounts');
    }
  }

  async getAccountUserCounts() {
    try {
      const usersResponse = await this.getUsers();
      if (!usersResponse.success || !usersResponse.data) {
        console.warn('Could not fetch users to count assignments.');
        return { success: true, data: {} };
      }

      const users = usersResponse.data || [];
      const allAssignments = await Promise.all(
        users.map(user => this.getUserAccounts(user.id).catch(() => ({ data: [] })))
      );

      const userCounts = {};
      for (const assignmentResponse of allAssignments) {
        const assignedAccounts = assignmentResponse.data || [];
        for (const account of assignedAccounts) {
          if (userCounts[account.id]) {
            userCounts[account.id]++;
          } else {
            userCounts[account.id] = 1;
          }
        }
      }

      return { success: true, data: userCounts };
    } catch (error) {
      console.error('Error calculating account user counts:', error);
      return { success: true, data: {} }; // Return empty data on failure
    }
  }

  // Usage log methods
  async getUsageLogs(limit = 50) {
    try {
      const response = await axios.get(`${this.baseURL}/logs/list.php?limit=${limit}`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to fetch logs');
    }
  }

  async logActivity(action, details = {}) {
    try {
      const response = await axios.post(`${this.baseURL}/logs/create.php`, {
        action,
        details: JSON.stringify(details)
      }, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
    }
  }

  // Chat lock methods
  async getChatLocks() {
    try {
      const response = await axios.get(`${this.baseURL}/chatlocks/list.php`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to fetch chat locks');
    }
  }

  async createChatLock(lockData) {
    try {
      const response = await axios.post(`${this.baseURL}/chatlocks/create.php`, lockData, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to create chat lock');
    }
  }

  async deleteChatLock(lockId) {
    try {
      const response = await axios.delete(`${this.baseURL}/chatlocks/delete.php?id=${lockId}`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to delete chat lock');
    }
  }

  // Stats
  async getStats() {
    try {
      const response = await axios.get(`${this.baseURL}/stats/dashboard.php`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to fetch stats');
    }
  }

  // Service methods
  async getServices(activeOnly = false) {
    try {
      const url = activeOnly ? `${this.baseURL}/services/list.php?active_only=true` : `${this.baseURL}/services/list.php`;
      const response = await axios.get(url, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to fetch services');
    }
  }

  async createService(serviceData) {
    try {
      const response = await axios.post(`${this.baseURL}/services/create.php`, serviceData, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to create service');
    }
  }

  async updateService(serviceId, serviceData) {
    try {
      const response = await axios.post(`${this.baseURL}/services/update.php`, {
        id: serviceId,
        ...serviceData
      }, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to update service');
    }
  }

  async deleteService(serviceId) {
    try {
      const response = await axios.post(`${this.baseURL}/services/delete.php`, {
        id: serviceId
      }, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to delete service');
    }
  }

  async getServiceDomains(serviceType) {
    try {
      const response = await axios.get(`${this.baseURL}/services/domains.php?service_type=${serviceType}`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to fetch service domains');
    }
  }

  async addServiceDomain(serviceType, domain) {
    try {
      const response = await axios.post(`${this.baseURL}/services/domains.php`, {
        service_type: serviceType,
        domain: domain
      }, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to add domain');
    }
  }

  async deleteServiceDomain(domainId) {
    try {
      const response = await axios.delete(`${this.baseURL}/services/domains.php`, {
        headers: this.getAuthHeaders(),
        data: { id: domainId }
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to delete domain');
    }
  }

  // Service Account Cookie Methods
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
      this._handleError(error, 'Failed to save account cookies');
    }
  }

  async getAccountCookies(accountId) {
    try {
      const response = await axios.get(`${this.baseURL}/cookies/get.php?account_id=${accountId}`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to get account cookies');
    }
  }

  // Session Sync Methods
  async sessionSyncUp() {
    try {
      const result = await ipcRenderer.invoke('session-sync-up');
      if (!result.success) {
        throw new Error(result.message);
      }
      return result.data;
    } catch (error) {
      this._handleError(error, 'Session sync up failed');
    }
  }

  async sessionSyncDown() {
    try {
      const result = await ipcRenderer.invoke('session-sync-down');
      if (!result.success) {
        throw new Error(result.message);
      }
      return result.data;
    } catch (error) {
      this._handleError(error, 'Session sync down failed');
    }
  }

  async sessionValidate() {
    try {
      const result = await ipcRenderer.invoke('session-validate');
      if (!result.success) {
        throw new Error(result.message);
      }
      return result.data;
    } catch (error) {
      this._handleError(error, 'Session validation failed');
    }
  }

  async sessionFullSync() {
    try {
      const result = await ipcRenderer.invoke('session-full-sync');
      if (!result.success) {
        throw new Error(result.message);
      }
      return result.data;
    } catch (error) {
      this._handleError(error, 'Full session sync failed');
    }
  }

  // Cookie sync methods
  async saveCookies(accountId, cookies) {
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

  async getCookies(accountId) {
    try {
      const response = await axios.get(`${this.baseURL}/cookies/get.php?account_id=${accountId}`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      // Don't throw error if cookies not found - return null instead
      if (error.response && error.response.status === 404) {
        return { success: false, cookies: null };
      }
      this._handleError(error, 'Failed to get cookies');
    }
  }
}

// Create global API instance
const api = new API();
