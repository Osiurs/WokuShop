const fs = require('fs');
const path = require('path');
const { app, session } = require('electron');
const Store = require('electron-store');

const store = new Store();

class OptimizedSessionManager {
  constructor() {
    this.partitionsPath = path.join(app.getPath('userData'), 'Partitions');
    this.tempPath = app.getPath('temp');
    this.apiBase = 'https://db.handymancode.com/api/wokushop-api';
    
    // Performance optimizations
    this.sessionCache = new Map(); // Cache session states
    this.partitionCache = new Map(); // Cache partition info
    this.cacheTimeout = 30000; // 30 seconds cache
    
    // Ensure directories exist
    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  ensureDirectories() {
    if (!fs.existsSync(this.partitionsPath)) {
      fs.mkdirSync(this.partitionsPath, { recursive: true });
    }
  }

  /**
   * Fast auth token retrieval
   */
  getAuthToken() {
    return store.get('authToken');
  }

  /**
   * Optimized session data check with caching
   */
  hasSessionData(partitionId) {
    const cacheKey = `session_${partitionId}`;
    const cached = this.sessionCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.hasData;
    }

    try {
      const partitionPath = path.join(this.partitionsPath, partitionId);
      
      if (!fs.existsSync(partitionPath)) {
        this.sessionCache.set(cacheKey, { hasData: false, timestamp: Date.now() });
        return false;
      }

      // Quick check for essential files only
      const essentialFiles = [
        'Network/Cookies',
        'Preferences'
      ];

      const hasData = essentialFiles.some(file => 
        fs.existsSync(path.join(partitionPath, file))
      );

      // Cache result
      this.sessionCache.set(cacheKey, { hasData, timestamp: Date.now() });
      return hasData;

    } catch (error) {
      console.error('❌ [Optimized Session] Error checking partition:', error.message);
      return false;
    }
  }

  /**
   * Fast partition creation/retrieval
   */
  async getOrCreatePartition(partitionId) {
    const cacheKey = `partition_${partitionId}`;
    const cached = this.partitionCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.partition;
    }

    try {
      const partition = session.fromPartition(`persist:${partitionId}`);
      
      // Cache the partition
      this.partitionCache.set(cacheKey, { 
        partition, 
        timestamp: Date.now() 
      });

      return partition;
    } catch (error) {
      console.error('❌ [Optimized Session] Error creating partition:', error.message);
      throw error;
    }
  }

  /**
   * Optimized session backup (async, non-blocking)
   */
  async backupSessionAsync(partitionId, accountId) {
    // Return immediately, perform backup in background
    setImmediate(async () => {
      try {
        await this._performBackup(partitionId, accountId);
        console.log('✅ [Optimized Session] Background backup completed');
      } catch (error) {
        console.warn('⚠️ [Optimized Session] Background backup failed:', error.message);
      }
    });
    
    return { success: true, message: 'Backup started in background' };
  }

  /**
   * Internal backup method
   */
  async _performBackup(partitionId, accountId) {
    const partitionPath = path.join(this.partitionsPath, partitionId);
    if (!fs.existsSync(partitionPath)) {
      throw new Error('Partition not found');
    }

    // Create minimal backup (only essential files)
    const backupPath = path.join(this.tempPath, `backup_${partitionId}_${Date.now()}.zip`);
    const archiver = require('archiver');
    
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(backupPath);
      const archive = archiver('zip', { zlib: { level: 1 } }); // Fast compression

      output.on('close', () => resolve(backupPath));
      archive.on('error', reject);

      archive.pipe(output);
      
      // Only backup essential files for speed
      const essentialPaths = [
        'Network/Cookies',
        'Preferences',
        'Local Storage'
      ];

      essentialPaths.forEach(relativePath => {
        const fullPath = path.join(partitionPath, relativePath);
        if (fs.existsSync(fullPath)) {
          if (fs.statSync(fullPath).isDirectory()) {
            archive.directory(fullPath, relativePath);
          } else {
            archive.file(fullPath, { name: relativePath });
          }
        }
      });

      archive.finalize();
    });
  }

  /**
   * Fast session restore with minimal validation
   */
  async restoreSessionFast(partitionId, accountId) {
    try {
      console.log('⚡ [Optimized Session] Fast restore for:', partitionId);
      
      // Check if session already exists locally
      if (this.hasSessionData(partitionId)) {
        console.log('✅ [Optimized Session] Using existing local session');
        return { success: true, source: 'local' };
      }

      // Try to restore from server (non-blocking)
      this._restoreFromServerAsync(partitionId, accountId);
      
      // Return immediately with empty session
      return { 
        success: true, 
        source: 'new',
        message: 'New session created, server restore in progress'
      };

    } catch (error) {
      console.error('❌ [Optimized Session] Fast restore failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Async server restore (non-blocking)
   */
  async _restoreFromServerAsync(partitionId, accountId) {
    try {
      const authToken = this.getAuthToken();
      if (!authToken) return;

      const axios = require('axios');
      const response = await axios.get(
        `${this.apiBase}/sessions/download.php`,
        {
          params: { account_id: accountId },
          headers: { 'X-Auth-Token': authToken },
          responseType: 'stream',
          timeout: 10000 // 10 second timeout
        }
      );

      if (response.status === 200) {
        await this._extractBackup(response.data, partitionId);
        console.log('✅ [Optimized Session] Server restore completed');
        
        // Clear cache to force refresh
        this.sessionCache.delete(`session_${partitionId}`);
      }
    } catch (error) {
      console.warn('⚠️ [Optimized Session] Server restore failed:', error.message);
    }
  }

  /**
   * Fast backup extraction
   */
  async _extractBackup(stream, partitionId) {
    const partitionPath = path.join(this.partitionsPath, partitionId);
    
    // Ensure directory exists
    if (!fs.existsSync(partitionPath)) {
      fs.mkdirSync(partitionPath, { recursive: true });
    }

    return new Promise((resolve, reject) => {
      stream
        .pipe(require('unzipper').Extract({ path: partitionPath }))
        .on('close', resolve)
        .on('error', reject);
    });
  }

  /**
   * Clear all caches
   */
  clearCache() {
    this.sessionCache.clear();
    this.partitionCache.clear();
    console.log('🧹 [Optimized Session] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      sessionCache: this.sessionCache.size,
      partitionCache: this.partitionCache.size,
      cacheTimeout: this.cacheTimeout
    };
  }
}

module.exports = OptimizedSessionManager;
