// Optimized API class for faster login/logout performance
if (typeof window !== 'undefined') {
  window.ipcRenderer = require('electron').ipcRenderer;
}
const ipcRenderer = window.ipcRenderer;
const axios = require('axios');

// API Configuration with connection pooling
const API_BASE_URL = 'https://db.handymancode.com/api/wokushop-api';

// Create axios instance with optimized settings
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 second timeout
  maxRedirects: 2,
  keepAlive: true,
  maxSockets: 10,
  headers: {
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache'
  }
});

// Request interceptor for auth headers
axiosInstance.interceptors.request.use((config) => {
  const token = ipcRenderer.sendSync('get-store-value', 'authToken');
  if (token) {
    config.headers['X-Auth-Token'] = token;
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Auto logout on unauthorized
      ipcRenderer.sendSync('delete-store-value', 'authToken');
      ipcRenderer.sendSync('delete-store-value', 'currentUser');
    }
    return Promise.reject(error);
  }
);

class OptimizedAPI {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.loginPromise = null; // Prevent concurrent login attempts
    this.logoutPromise = null; // Prevent concurrent logout attempts
  }

  // Optimized error handler
  _handleError(error, defaultMessage) {
    const message = error.response?.data?.message || error.message || defaultMessage;
    throw new Error(typeof message === 'object' ? JSON.stringify(message) : message);
  }

  // Fast storage operations (cached)
  getStoredToken() {
    return ipcRenderer.sendSync('get-store-value', 'authToken');
  }

  setStoredToken(token) {
    ipcRenderer.sendSync('set-store-value', 'authToken', token);
  }

  clearStoredToken() {
    ipcRenderer.sendSync('delete-store-value', 'authToken');
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

  // Optimized login with debouncing
  async login(username, password) {
    // Prevent concurrent login attempts
    if (this.loginPromise) {
      return this.loginPromise;
    }

    this.loginPromise = this._performLogin(username, password);
    
    try {
      const result = await this.loginPromise;
      return result;
    } finally {
      this.loginPromise = null;
    }
  }

  async _performLogin(username, password) {
    try {
      const response = await axiosInstance.post('/auth/login.php', {
        username,
        password
      });

      if (response.data.success) {
        // Store credentials immediately for faster access
        this.setStoredToken(response.data.token);
        this.setCurrentUser(response.data.user);

        // Non-blocking session sync (don't wait for it)
        this._performSessionSyncAsync(response.data.user, response.data.token);

        return response.data;
      } else {
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (error) {
      this._handleError(error, 'Login failed');
    }
  }

  // Async session sync (non-blocking)
  async _performSessionSyncAsync(user, token) {
    try {
      await ipcRenderer.invoke('session-sync-login', user, token);
      console.log('✅ [API] Session sync completed');
    } catch (syncError) {
      console.warn('⚠️ [API] Session sync failed (non-blocking):', syncError.message);
    }
  }

  // Fast logout with immediate UI update
  async logout() {
    // Prevent concurrent logout attempts
    if (this.logoutPromise) {
      return this.logoutPromise;
    }

    this.logoutPromise = this._performLogout();
    
    try {
      await this.logoutPromise;
    } finally {
      this.logoutPromise = null;
    }
  }

  async _performLogout() {
    // Clear local storage immediately for instant UI update
    this.clearStoredToken();
    this.clearCurrentUser();

    // Send logout request in background (non-blocking)
    this._performServerLogoutAsync();
  }

  // Async server logout (non-blocking)
  async _performServerLogoutAsync() {
    try {
      await axiosInstance.post('/auth/logout.php', {});
      console.log('✅ [API] Server logout completed');
    } catch (error) {
      console.warn('⚠️ [API] Server logout failed (non-blocking):', error.message);
    }
  }

  // Fast login-as with optimizations
  async loginAsUser(userId) {
    try {
      const response = await axiosInstance.post('/auth/login-as.php', {
        user_id: userId
      });

      if (response.data.success) {
        this.setStoredToken(response.data.token);
        this.setCurrentUser(response.data.user);

        // Non-blocking session sync
        this._performSessionSyncAsync(response.data.user, response.data.token);

        return response.data;
      } else {
        throw new Error(response.data.message || 'Login as user failed');
      }
    } catch (error) {
      this._handleError(error, 'Login as user failed');
    }
  }

  // Cached service methods
  async getServices(activeOnly = false) {
    try {
      const url = activeOnly ? '/services/list.php?active_only=true' : '/services/list.php';
      const response = await axiosInstance.get(url);
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to fetch services');
    }
  }

  // Fast account methods
  async getAccounts() {
    try {
      const response = await axiosInstance.get('/accounts/list.php');
      return response.data;
    } catch (error) {
      this._handleError(error, 'Failed to fetch accounts');
    }
  }
}

// Create global optimized API instance
const optimizedApi = new OptimizedAPI();
