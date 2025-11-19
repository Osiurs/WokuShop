const fs = require('fs');
const path = require('path');
const { app, session } = require('electron');
const archiver = require('archiver');
const unzipper = require('unzipper');
const axios = require('axios');
const FormData = require('form-data');
const Store = require('electron-store');

const store = new Store();

class SessionManager {
  constructor() {
    this.partitionsPath = path.join(app.getPath('userData'), 'Partitions');
    this.tempPath = app.getPath('temp');
    this.apiBase = 'https://db.handymancode.com/api/wokushop-api';
  }

  /**
   * Get auth token from store
   */
  getAuthToken() {
    return store.get('authToken');
  }

  /**
   * Check if partition has session data (not empty)
   * @param {string} partitionId - The partition ID to check
   * @returns {boolean} - True if partition has session data
   */
  hasSessionData(partitionId) {
    try {
      const partitionPath = path.join(this.partitionsPath, partitionId);

      console.log('🔍 [Session Manager] Checking partition for session data:', partitionId);
      console.log('📁 [Session Manager] Partition path:', partitionPath);

      // Check if partition directory exists
      if (!fs.existsSync(partitionPath)) {
        console.log('❌ [Session Manager] Partition directory does not exist');
        return false;
      }

      // Check for critical session files
      const criticalFiles = [
        'Network/Cookies',
        'Preferences',
        'Local Storage/leveldb'
      ];

      let hasData = false;

      criticalFiles.forEach(relativePath => {
        const fullPath = path.join(partitionPath, relativePath);
        if (fs.existsSync(fullPath)) {
          console.log('✅ [Session Manager] Found:', relativePath);
          hasData = true;
        }
      });

      console.log('🔍 [Session Manager] Has session data:', hasData);
      return hasData;

    } catch (error) {
      console.error('❌ [Session Manager] Error checking partition data:', error.message);
      return false;
    }
  }

  /**
   * Check if backup exists for account
   * @param {number} accountId - Account ID
   * @returns {Promise<boolean>} - True if backup exists
   */
  async hasBackupAvailable(accountId) {
    try {
      const authToken = this.getAuthToken();
      if (!authToken) {
        console.log('❌ [Session Manager] No auth token for backup check');
        return false;
      }

      console.log('🔍 [Session Manager] Checking if backup exists for account:', accountId);

      // Try existing backup list endpoint as fallback
      try {
        const response = await axios.get(
          `${this.apiBase}/sessions/list.php`,
          {
            params: { account_id: accountId },
            headers: { 'X-Auth-Token': authToken }
          }
        );

        if (response.data.success && response.data.data && response.data.data.length > 0) {
          console.log('🔍 [Session Manager] Found backups via list endpoint:', response.data.data.length);
          return true;
        }
      } catch (listError) {
        console.log('⚠️ [Session Manager] List endpoint failed, trying download test...');

        // Try download endpoint to see if backup exists
        try {
          const downloadResponse = await axios.head(
            `${this.apiBase}/sessions/download.php`,
            {
              params: { account_id: accountId },
              headers: { 'X-Auth-Token': authToken }
            }
          );

          if (downloadResponse.status === 200) {
            console.log('✅ [Session Manager] Backup available via download endpoint');
            return true;
          }
        } catch (downloadError) {
          console.log('⚠️ [Session Manager] Download test failed');
        }
      }

      console.log('❌ [Session Manager] No backup found on server');
      return false;

    } catch (error) {
      // Check for local backup as fallback
      console.log('⚠️ [Session Manager] API check failed, checking local backup...');

      // Simple check for any backup file with this account ID
      try {
        const files = fs.readdirSync(this.tempPath);
        const hasLocalBackup = files.some(file =>
          file.startsWith(`backup_${accountId}_`) && file.endsWith('.zip')
        );
        console.log('🔍 [Session Manager] Local backup available:', hasLocalBackup);
        return hasLocalBackup;
      } catch (localError) {
        console.log('❌ [Session Manager] No backup available anywhere');
        return false;
      }
    }
  }

  /**
   * Backup session partition to ZIP file
   * @param {string} partitionId - The partition ID to backup
   * @returns {Promise<string>} - Path to the created ZIP file
   */
  async backupPartition(partitionId) {
    return new Promise((resolve, reject) => {
      const partitionPath = path.join(this.partitionsPath, partitionId);
      const backupPath = path.join(this.tempPath, `${partitionId}_backup.zip`);

      console.log('🔧 [Session Manager] Starting backup for partition:', partitionId);
      console.log('📁 [Session Manager] Partition path:', partitionPath);
      console.log('💾 [Session Manager] Backup path:', backupPath);

      // Check if partition exists
      if (!fs.existsSync(partitionPath)) {
        return reject(new Error(`Partition directory not found: ${partitionPath}`));
      }

      const output = fs.createWriteStream(backupPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      let fileCount = 0;

      output.on('close', () => {
        const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
        console.log('✅ [Session Manager] Backup created successfully');
        console.log('📊 [Session Manager] Total bytes:', archive.pointer());
        console.log('📊 [Session Manager] Size:', sizeInMB, 'MB');
        console.log('📊 [Session Manager] Files archived:', fileCount);
        resolve(backupPath);
      });

      output.on('error', (err) => {
        console.error('❌ [Session Manager] Output stream error:', err);
        reject(err);
      });

      archive.on('error', (err) => {
        console.error('❌ [Session Manager] Archive error:', err);
        reject(err);
      });

      archive.on('entry', (entry) => {
        fileCount++;
        if (fileCount % 10 === 0) {
          console.log(`📦 [Session Manager] Archived ${fileCount} files...`);
        }
      });

      archive.pipe(output);

      // Critical files to backup (session state)
      const criticalPaths = [
        'Network/Cookies',
        'Network/Cookies-journal',
        'Network/Network Persistent State',
        'Network/TransportSecurity',
        'Preferences'
      ];

      // Add critical files individually
      criticalPaths.forEach(relativePath => {
        const fullPath = path.join(partitionPath, relativePath);
        if (fs.existsSync(fullPath)) {
          archive.file(fullPath, { name: relativePath });
          console.log('📄 [Session Manager] Added:', relativePath);
        }
      });

      // Add Local Storage directory
      const localStoragePath = path.join(partitionPath, 'Local Storage', 'leveldb');
      if (fs.existsSync(localStoragePath)) {
        archive.directory(localStoragePath, 'Local Storage/leveldb');
        console.log('📁 [Session Manager] Added: Local Storage/leveldb');
      }

      // Add Session Storage directory
      const sessionStoragePath = path.join(partitionPath, 'Session Storage');
      if (fs.existsSync(sessionStoragePath)) {
        archive.directory(sessionStoragePath, 'Session Storage');
        console.log('📁 [Session Manager] Added: Session Storage');
      }

      // Add databases directory
      const databasesPath = path.join(partitionPath, 'databases');
      if (fs.existsSync(databasesPath)) {
        archive.directory(databasesPath, 'databases');
        console.log('📁 [Session Manager] Added: databases');
      }

      archive.finalize();
    });
  }

  /**
   * Upload session backup to API server
   * @param {number} accountId - Account ID
   * @param {string} partitionId - Partition ID
   * @param {string} zipPath - Path to ZIP file
   * @returns {Promise<object>} - API response
   */
  async uploadToAPI(accountId, partitionId, zipPath) {
    try {
      console.log('🌐 [Session Manager] Uploading to API...');
      console.log('📋 [Session Manager] Account ID:', accountId);
      console.log('📋 [Session Manager] Partition ID:', partitionId);
      console.log('📋 [Session Manager] ZIP Path:', zipPath);

      const authToken = this.getAuthToken();
      if (!authToken) {
        throw new Error('No auth token found. Please login first.');
      }

      // Create form data
      const formData = new FormData();
      formData.append('account_id', accountId.toString());
      formData.append('partition_id', partitionId);
      formData.append('session_file', fs.createReadStream(zipPath));

      // Get file stats for progress
      const stats = fs.statSync(zipPath);
      const fileSizeInMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log('📊 [Session Manager] Uploading', fileSizeInMB, 'MB...');

      // Upload to API
      const response = await axios.post(
        `${this.apiBase}/sessions/upload.php`,
        formData,
        {
          headers: {
            'X-Auth-Token': authToken,
            ...formData.getHeaders()
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      console.log('✅ [Session Manager] Upload successful:', response.data);

      // Clean up temp file
      fs.unlinkSync(zipPath);
      console.log('🗑️ [Session Manager] Cleaned up temp file');

      return response.data;
    } catch (error) {
      console.error('❌ [Session Manager] Upload failed:', error.message);
      if (error.response) {
        console.error('📋 [Session Manager] Response status:', error.response.status);
        console.error('📋 [Session Manager] Response data:', error.response.data);

        // Throw more detailed error
        const errorData = error.response.data;
        const errorMessage = errorData.message || error.message;
        const errorType = errorData.error_type || 'unknown';

        throw new Error(`${errorMessage} (${errorType})`);
      }
      throw error;
    }
  }

  /**
   * Download session backup from API server
   * @param {number} accountId - Account ID
   * @param {string} partitionId - Partition ID
   * @returns {Promise<string>} - Path to downloaded ZIP file
   */
  async downloadFromAPI(accountId, partitionId) {
    try {
      console.log('🌐 [Session Manager] Downloading from API...');
      console.log('📋 [Session Manager] Account ID:', accountId);

      const authToken = this.getAuthToken();
      if (!authToken) {
        throw new Error('No auth token found. Please login first.');
      }

      const downloadPath = path.join(this.tempPath, `${partitionId}_restore.zip`);

      const response = await axios({
        method: 'GET',
        url: `${this.apiBase}/sessions/download.php`,
        params: { account_id: accountId },
        headers: {
          'X-Auth-Token': authToken
        },
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(downloadPath);
      response.data.pipe(writer);

      return new Promise((resolve, reject) => {
        writer.on('finish', () => {
          const stats = fs.statSync(downloadPath);
          const fileSizeInMB = (stats.size / 1024 / 1024).toFixed(2);
          console.log('✅ [Session Manager] Download successful');
          console.log('📊 [Session Manager] Downloaded', fileSizeInMB, 'MB');
          resolve(downloadPath);
        });
        writer.on('error', reject);
      });
    } catch (error) {
      console.error('❌ [Session Manager] Download failed:', error.message);
      if (error.response) {
        console.error('📋 [Session Manager] Response:', error.response.data);
      }
      throw error;
    }
  }

  /**
   * Restore session partition from ZIP file
   * @param {string} partitionId - Partition ID
   * @param {string} zipPath - Path to ZIP file
   * @returns {Promise<string>} - Path to restored partition
   */
  async restorePartition(partitionId, zipPath) {
    try {
      const partitionPath = path.join(this.partitionsPath, partitionId);

      console.log('🔧 [Session Manager] Starting restore for partition:', partitionId);
      console.log('📁 [Session Manager] Target path:', partitionPath);
      console.log('💾 [Session Manager] ZIP path:', zipPath);

      // Create partition directory if it doesn't exist
      if (!fs.existsSync(partitionPath)) {
        fs.mkdirSync(partitionPath, { recursive: true });
        console.log('📁 [Session Manager] Created partition directory');
      }

      // Extract ZIP
      await fs.createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: partitionPath }))
        .promise();

      console.log('✅ [Session Manager] Restore completed successfully');

      // Clean up temp file
      fs.unlinkSync(zipPath);
      console.log('🗑️ [Session Manager] Cleaned up temp file');

      return partitionPath;
    } catch (error) {
      console.error('❌ [Session Manager] Restore failed:', error.message);
      throw error;
    }
  }

  /**
   * Full backup workflow: backup partition and upload to API
   * @param {number} accountId - Account ID
   * @param {string} partitionId - Partition ID
   * @returns {Promise<object>} - Upload result
   */
  async backupAndUpload(accountId, partitionId) {
    console.log('🚀 [Session Manager] Starting full backup workflow...');
    try {
      const zipPath = await this.backupPartition(partitionId);

      // Try to upload to API
      try {
        const result = await this.uploadToAPI(accountId, partitionId, zipPath);
        console.log('✅ [Session Manager] Full backup workflow completed');
        return result;
      } catch (uploadError) {
        // If upload fails, store locally as fallback
        console.log('⚠️ [Session Manager] API upload failed, storing locally as fallback');
        const localBackupPath = path.join(this.tempPath, `backup_${accountId}_${partitionId}.zip`);

        // Copy to persistent location
        if (fs.existsSync(zipPath)) {
          fs.copyFileSync(zipPath, localBackupPath);
          console.log('💾 [Session Manager] Local backup stored:', localBackupPath);

          // Clean up temp file
          fs.unlinkSync(zipPath);

          return {
            success: true,
            message: 'Session backed up locally (server unavailable)',
            data: {
              local_backup_path: localBackupPath,
              account_id: accountId,
              partition_id: partitionId
            }
          };
        }
        throw uploadError;
      }
    } catch (error) {
      console.error('❌ [Session Manager] Backup workflow failed:', error);
      throw error;
    }
  }

  /**
   * Full restore workflow: download from API and restore partition
   * @param {number} accountId - Account ID
   * @param {string} partitionId - Partition ID
   * @returns {Promise<string>} - Restored partition path
   */
  async downloadAndRestore(accountId, partitionId) {
    console.log('🚀 [Session Manager] Starting full restore workflow...');
    try {
      // Try to download from API first
      try {
        const zipPath = await this.downloadFromAPI(accountId, partitionId);
        const result = await this.restorePartition(partitionId, zipPath);
        console.log('✅ [Session Manager] Full restore workflow completed');
        return result;
      } catch (downloadError) {
        // If API download fails, try local backup
        console.log('⚠️ [Session Manager] API download failed, trying local backup...');
        const localBackupPath = path.join(this.tempPath, `backup_${accountId}_${partitionId}.zip`);

        if (fs.existsSync(localBackupPath)) {
          console.log('💾 [Session Manager] Found local backup, restoring...');
          const result = await this.restorePartition(partitionId, localBackupPath);
          console.log('✅ [Session Manager] Local restore completed');
          return result;
        } else {
          console.log('❌ [Session Manager] No local backup found for account:', accountId);
          throw new Error(`No backup found for account ${accountId}. Please backup the session first.`);
        }
      }
    } catch (error) {
      console.error('❌ [Session Manager] Restore workflow failed:', error);
      throw error;
    }
  }

  /**
   * Enhanced Gemini session restore with verification
   * @param {number} accountId - Account ID
   * @param {string} partitionId - Partition ID
   * @returns {Promise<object>} - Result object
   */
  async enhancedGeminiRestore(accountId, partitionId) {
    try {
      console.log('🔧 [Gemini Fix] Starting comprehensive Gemini restore...');
      console.log('🔧 [Gemini Fix] Account:', accountId, 'Partition:', partitionId);

      // Standard restore first
      const standardResult = await this.downloadAndRestore(accountId, partitionId);
      if (!standardResult.success) {
        throw new Error('Standard restore failed: ' + standardResult.message);
      }

      console.log('✅ [Gemini Fix] Standard restore completed');

      // Verify partition files
      const os = require('os');
      const partitionPath = path.join(
        os.homedir(), 'AppData', 'Roaming', 'wokushop-account-manager', 'Partitions', partitionId
      );

      console.log('📁 [Gemini Fix] Partition path:', partitionPath);

      const criticalPaths = [
        path.join(partitionPath, 'Network', 'Cookies'),
        path.join(partitionPath, 'Local Storage', 'leveldb'),
        path.join(partitionPath, 'Session Storage'),
        path.join(partitionPath, 'Preferences')
      ];

      let filesOK = 0;
      criticalPaths.forEach(criticalPath => {
        if (fs.existsSync(criticalPath)) {
          filesOK++;
          console.log(`✅ [Gemini Fix] Found: ${path.basename(criticalPath)}`);
        } else {
          console.warn(`⚠️ [Gemini Fix] Missing: ${path.basename(criticalPath)}`);
        }
      });

      console.log(`📊 [Gemini Fix] Session files: ${filesOK}/${criticalPaths.length} present`);

      // Schedule window reload
      setTimeout(async () => {
        try {
          const { BrowserWindow } = require('electron');
          const windows = BrowserWindow.getAllWindows();

          for (const window of windows) {
            const partition = window.webContents.session.partition;
            if (partition.includes(partitionId)) {
              console.log('🔄 [Gemini Fix] Reloading Gemini window...');
              window.webContents.reload();

              setTimeout(() => {
                window.webContents.loadURL('https://gemini.google.com/');
              }, 2000);
              break;
            }
          }
        } catch (reloadError) {
          console.error('❌ [Gemini Fix] Window reload error:', reloadError);
        }
      }, 3000);

      console.log('✅ [Gemini Fix] Enhanced restore completed successfully');
      return {
        success: true,
        message: 'Enhanced Gemini restore completed',
        authCookiesFound: filesOK >= 3
      };

    } catch (error) {
      console.error('❌ [Gemini Fix] Enhanced restore failed:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get cookies for a specific partition
   * @param {string} partitionId - The partition ID
   * @returns {Promise<Array>} - Array of cookies
   */
  async getPartitionCookies(partitionId) {
    try {
      const partitionSession = session.fromPartition(`persist:${partitionId}`);
      const cookies = await partitionSession.cookies.get({});
      console.log(`🍪 [Session Manager] Got ${cookies.length} cookies for partition: ${partitionId}`);
      return cookies;
    } catch (error) {
      console.error(`❌ [Session Manager] Failed to get cookies for partition ${partitionId}:`, error);
      return [];
    }
  }

  /**
   * Set cookies for a specific partition
   * @param {string} partitionId - The partition ID
   * @param {Array} cookies - Array of cookies to set
   * @returns {Promise<void>}
   */
  async setPartitionCookies(partitionId, cookies) {
    const partitionSession = session.fromPartition(`persist:${partitionId}`);
    let successCount = 0;

    for (const cookie of cookies) {
      // Create a mutable copy to avoid modifying the original object
      const newCookie = { ...cookie };
      let cookieDetails = null;

      try {
        // --- URL Construction: The URL must be a valid origin that the cookie belongs to. ---
        // We construct the URL directly from the cookie's domain and path.
        const urlHost = newCookie.domain.startsWith('.') ? newCookie.domain.substring(1) : newCookie.domain;
        const url = `${newCookie.secure ? 'https' : 'http'}://${urlHost}${newCookie.path || '/'}`;

        // --- Cookie Details Sanitization ---
        const isSecurePrefixCookie = newCookie.name.startsWith('__Host-') || newCookie.name.startsWith('__Secure-');

        // The `domain` attribute should be consistent with the `hostOnly` flag.
        // Electron's `cookies.set` is strict about this.
        if (newCookie.hostOnly) {
          // For host-only cookies, the domain must NOT start with a dot.
          newCookie.domain = newCookie.domain.replace(/^\./, '');
        } else if (!isSecurePrefixCookie) {
          // For regular domain cookies (not host-only and not secure-prefix), it's safer to ensure it starts with a dot.
          if (!newCookie.domain.startsWith('.')) {
            newCookie.domain = `.${newCookie.domain}`;
          }
        }
        // For secure prefix cookies (__Host- or __Secure-), we DO NOT modify the domain.
        // They have strict path and domain requirements that must be preserved.

        cookieDetails = {
          url,
          name: newCookie.name,
          value: newCookie.value,
          domain: newCookie.domain,
          path: newCookie.path,
          secure: newCookie.secure,
          httpOnly: newCookie.httpOnly,
          expirationDate: newCookie.expirationDate,
        };

        await partitionSession.cookies.set(cookieDetails);
        successCount++;
      } catch (error) {
        console.error(`❌ [Cookie Sync] CRITICAL: Failed to set a cookie for ${partitionId}.`);
        console.error(`   -> Error: ${error.message}`);
        console.error('   -> Offending Cookie (Original):', JSON.stringify(cookie, null, 2));
        if (cookieDetails) {
          console.error('   -> Details Passed to Electron:', JSON.stringify(cookieDetails, null, 2));
        }
      }
    }
    console.log(`🍪 [Cookie Sync] Successfully restored ${successCount} / ${cookies.length} cookies for ${partitionId}`);
  }
}

module.exports = new SessionManager();
