const Store = require('electron-store');
const axios = require('axios');
const { machineIdSync } = require('node-machine-id');
const { BrowserWindow, session } = require('electron');
const crypto = require('crypto');
const sessionManager = require('./session-manager');

class SessionSyncManager {
  constructor() {
    this.store = new Store();
    this.apiBase = 'https://db.handymancode.com/api/wokushop-api';
    this.machineId = null;
    this.sessionToken = null;
    this.syncInterval = null;
    this.isInitialized = false;
  }

  /**
   * Initialize session sync manager
   */
  async initialize() {
    try {
      // Get unique machine ID
      this.machineId = machineIdSync();
      console.log('🔧 [Session Sync] Machine ID:', this.machineId);

      // Get or create session token
      this.sessionToken = this.store.get('sessionToken') || this.generateSessionToken();
      this.store.set('sessionToken', this.sessionToken);

      this.isInitialized = true;
      console.log('✅ [Session Sync] Manager initialized');
      console.log('⚠️ [Session Sync] Note: Server endpoints not yet available - sync will fail gracefully');
    } catch (error) {
      console.error('❌ [Session Sync] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Generate unique session token
   */
  generateSessionToken() {
    return `session_${this.machineId}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Get auth headers for API requests
   */
  getAuthHeaders() {
    const authToken = this.store.get('authToken');
    if (!authToken) {
      throw new Error('No auth token found. Please login first.');
    }
    return {
      'X-Auth-Token': authToken,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Get current session data from local store
   */
  getCurrentSessionData() {
    return {
      currentUser: this.store.get('currentUser'),
      authToken: this.store.get('authToken'),
      sessionToken: this.sessionToken,
      machineId: this.machineId,
      lastSync: new Date().toISOString(),
      appSettings: this.store.get('appSettings'),
      windowState: this.store.get('windowState'),
      userPreferences: this.store.get('userPreferences')
    };
  }

  /**
   * Apply session data to local store
   */
  applySessionData(sessionData) {
    console.log('📥 [Session Sync] Applying session data to local store');

    if (sessionData.currentUser) {
      this.store.set('currentUser', sessionData.currentUser);
      console.log('👤 [Session Sync] Updated current user:', sessionData.currentUser.username);
    }

    if (sessionData.authToken) {
      this.store.set('authToken', sessionData.authToken);
      console.log('🔑 [Session Sync] Updated auth token');
    }

    if (sessionData.appSettings) {
      this.store.set('appSettings', sessionData.appSettings);
      console.log('⚙️ [Session Sync] Updated app settings');
    }

    if (sessionData.windowState) {
      this.store.set('windowState', sessionData.windowState);
      console.log('🪟 [Session Sync] Updated window state');
    }

    if (sessionData.userPreferences) {
      this.store.set('userPreferences', sessionData.userPreferences);
      console.log('👀 [Session Sync] Updated user preferences');
    }

    // Update session token if provided
    if (sessionData.sessionToken) {
      this.sessionToken = sessionData.sessionToken;
      this.store.set('sessionToken', sessionData.sessionToken);
    }

    console.log('✅ [Session Sync] Session data applied successfully');
  }

  /**
   * Save account cookies to the server (shared across users)
   * @param {number} accountId - The account ID
   * @param {Array} cookies - The cookies to save
   */
  async saveAccountCookies(accountId, cookies) {
    try {
      // Use cookies/save.php for shared cookie storage (admin and users share same cookies)
      await axios.post(
        `${this.apiBase}/cookies/save.php`,
        {
          account_id: accountId,
          cookies: cookies,
        },
        {
          headers: this.getAuthHeaders(),
        }
      );
      console.log(`🍪 [Session Sync] Saved cookies for account ${accountId}`);
    } catch (error) {
      console.error(`❌ [Session Sync] Failed to save cookies for account ${accountId}:`, error.message);
    }
  }

  /**
   * Get account cookies from the server (shared across users)
   * @param {number} accountId - The account ID
   * @returns {Promise<Array|null>}
   */
  async getAccountCookies(accountId) {
    try {
      // Use cookies/get.php for shared cookie retrieval (admin and users share same cookies)
      const response = await axios.get(`${this.apiBase}/cookies/get.php`, {
        params: { account_id: accountId },
        headers: this.getAuthHeaders(),
      });
      if (response.data.success) {
        console.log(`🍪 [Session Sync] Got cookies for account ${accountId}`);
        return response.data.cookies;
      }
      return null;
    } catch (error) {
      if (error.response && error.response.status !== 404) {
        console.error(`❌ [Session Sync] Failed to get cookies for account ${accountId}:`, error.message);
      }
      return null;
    }
  }

  /**
   * Sync session data up to server
   */
  async syncUp() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('📤 [Session Sync] Syncing session data to server...');

      const sessionData = this.getCurrentSessionData();

      const response = await axios.post(
        `${this.apiBase}/sessions/sync-up.php`,
        {
          machine_id: this.machineId,
          session_token: this.sessionToken,
          session_data: sessionData
        },
        {
          headers: this.getAuthHeaders(),
          timeout: 30000
        }
      );

      if (response.data.success) {
        // Update session token if server provided a new one
        if (response.data.data.session_token && response.data.data.session_token !== this.sessionToken) {
          this.sessionToken = response.data.data.session_token;
          this.store.set('sessionToken', this.sessionToken);
        }

        console.log('✅ [Session Sync] Sync up successful');

        // Sync cookies for assigned accounts
        const currentUser = this.store.get('currentUser');
        if (currentUser && currentUser.accounts && Array.isArray(currentUser.accounts)) {
          console.log(`🍪 [Session Sync] Syncing cookies up for ${currentUser.accounts.length} accounts...`, currentUser.accounts.map(a => a.service_name));
          for (const account of currentUser.accounts) {
            if (account.id && account.partition_id) {
              console.log(`   -> Checking account: ${account.service_name} (ID: ${account.id})`);
              const cookies = await sessionManager.getPartitionCookies(account.partition_id);
              if (cookies && cookies.length > 0) {
                console.log(`      Found ${cookies.length} cookies. Saving to server...`);
                await this.saveAccountCookies(account.id, cookies);
              } else {
                console.log(`      No cookies found locally for this account.`);
              }
            }
          }
        }

        return response.data;
      } else {
        throw new Error(response.data.message || 'Sync up failed');
      }
    } catch (error) {
      console.error('❌ [Session Sync] Sync up failed:', error.message);
      if (error.response) {
        console.error('📋 [Session Sync] Response:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Sync session data down from server
   */
  async syncDown() {
    if (!this.isInitialized) await this.initialize();
    try {
      console.log('📥 [Session Sync] Syncing cookies FROM server...');
      const currentUser = this.store.get('currentUser');
      const accounts = this.store.get('assignedAccounts') || [];

      if (!currentUser || accounts.length === 0) {
        console.log('ℹ️ [Session Sync] No user or accounts to sync down.');
        return;
      }

      for (const account of accounts) {
        if (account.id && account.partition_id) {
          const cookies = await this.getAccountCookies(account.id);
          if (cookies && cookies.length > 0) {
            console.log(`   -> Found ${cookies.length} cookies on server for ${account.service_name}. Applying...`);
            // DO NOT clear storage data - this would wipe out existing session state
            // Just restore cookies on top of existing session
            await sessionManager.setPartitionCookies(account.partition_id, cookies);
          } else {
            console.log(`   -> No server cookies found for ${account.service_name}.`);
          }
        }
      }
      console.log('✅ [Session Sync] Cookie sync down process completed.');
    } catch (error) {
      console.error('❌ [Session Sync] Sync down failed:', error.message);
      throw error;
    }
  }

  /**
   * Validate current session with server
   */
  async validateSession() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      console.log('🔍 [Session Sync] Validating session with server...');

      const response = await axios.post(
        `${this.apiBase}/sessions/validate.php`,
        {
          machine_id: this.machineId,
          session_token: this.sessionToken
        },
        {
          headers: this.getAuthHeaders(),
          timeout: 30000
        }
      );

      if (response.data.success) {
        const validation = response.data.data;

        console.log('🔍 [Session Sync] Validation result:', {
          isValid: validation.is_valid,
          needsSync: validation.needs_sync,
          sessionExists: validation.session_exists,
          assignedAccountsCount: validation.assigned_accounts?.length || 0
        });

        // Store assigned accounts for later use
        if (validation.assigned_accounts) {
          this.store.set('assignedAccounts', validation.assigned_accounts);
        }

        return validation;
      } else {
        throw new Error(response.data.message || 'Session validation failed');
      }
    } catch (error) {
      console.error('❌ [Session Sync] Session validation failed:', error.message);
      if (error.response) {
        console.error('📋 [Session Sync] Response:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Start automatic sync (every 5 minutes)
   */
  startAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    console.log('🔄 [Session Sync] Starting auto sync (every 5 minutes)');

    this.syncInterval = setInterval(async () => {
      try {
        await this.validateSession();
        await this.syncUp();
      } catch (error) {
        console.error('❌ [Session Sync] Auto sync failed:', error.message);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('⏹️ [Session Sync] Auto sync stopped');
    }
  }

  /**
   * Perform full sync (validate, sync down, then sync up)
   */
  async fullSync() {
    try {
      console.log('🔄 [Session Sync] Starting full cookie sync...');

      // 1. Validate session to get assigned accounts
      await this.validateSession();

      // 2. Sync down cookies from server
      await this.syncDown();

      // 3. Sync up local cookies to server
      await this.syncUp();

      console.log('✅ [Session Sync] Full cookie sync completed successfully');
      return true;
    } catch (error) {
      console.error('❌ [Session Sync] Full sync failed:', error.message);
      throw error;
    }
  }

  /**
   * Handle login event
   */
  async onLogin(user, authToken) {
    try {
      console.log('👤 [Session Sync] Handling login event for user:', user.username);

      // Update local store
      this.store.set('currentUser', user);
      this.store.set('authToken', authToken);

      // Initialize if not already done
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Perform initial sync
      await this.fullSync();

      // Start auto sync
      this.startAutoSync();

      console.log('✅ [Session Sync] Login sync completed');
    } catch (error) {
      console.error('❌ [Session Sync] Login sync failed:', error.message);
      // Re-throw the error to notify the renderer process that sync failed
      throw error;
    }
  }

  /**
   * Handle logout event
   */
  async onLogout() {
    try {
      console.log('👋 [Session Sync] Handling logout event');

      // Stop auto sync
      this.stopAutoSync();

      // Clear session data
      this.store.delete('currentUser');
      this.store.delete('authToken');
      this.store.delete('sessionToken');
      this.sessionToken = null;
      this.isInitialized = false;

      console.log('✅ [Session Sync] Logout cleanup completed');
    } catch (error) {
      console.error('❌ [Session Sync] Logout cleanup failed:', error.message);
    }
  }
}

module.exports = new SessionSyncManager();