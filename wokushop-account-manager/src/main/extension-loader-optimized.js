/**
 * Optimized Extension Loader - Fast loading with caching and preloading
 */
const { app, session } = require('electron');
const path = require('path');
const fs = require('fs');

class OptimizedExtensionLoader {
  constructor() {
    this.isDev = !app.isPackaged;
    this.extensionCache = new Map();
    this.loadedExtensions = new Set();
    this.preloadPromises = new Map();
    
    // Optimized extension paths
    this.extensionPaths = this.getExtensionPaths();
    
    // Preload extensions on startup
    this.preloadExtensions();
  }

  /**
   * Get all possible extension paths (cached)
   */
  getExtensionPaths() {
    const basePaths = [
      path.join(app.getAppPath(), 'extensions'),
      path.join(path.dirname(app.getAppPath()), 'extensions'),
      path.join(process.resourcesPath, 'extensions'),
      path.join(__dirname, '../../extensions')
    ];

    const extensionPaths = {};
    
    basePaths.forEach(basePath => {
      try {
        if (fs.existsSync(basePath)) {
          const extensions = fs.readdirSync(basePath);
          extensions.forEach(ext => {
            const extPath = path.join(basePath, ext);
            if (fs.statSync(extPath).isDirectory() && 
                fs.existsSync(path.join(extPath, 'manifest.json'))) {
              extensionPaths[ext] = extPath;
            }
          });
        }
      } catch (error) {
        // Silent fail for non-existent paths
      }
    });

    console.log('🔍 [Extension Loader] Found extensions:', Object.keys(extensionPaths));
    return extensionPaths;
  }

  /**
   * Preload extensions for faster access
   */
  async preloadExtensions() {
    const extensionNames = ['woku-ad-blocker', 'ublock-origin-lite'];
    
    extensionNames.forEach(name => {
      if (this.extensionPaths[name]) {
        this.preloadPromises.set(name, this.validateExtension(this.extensionPaths[name]));
      }
    });

    console.log('⚡ [Extension Loader] Preloading extensions...');
  }

  /**
   * Fast extension validation
   */
  async validateExtension(extensionPath) {
    try {
      const manifestPath = path.join(extensionPath, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        throw new Error('Manifest not found');
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (!manifest.name || !manifest.version) {
        throw new Error('Invalid manifest');
      }

      return { valid: true, manifest, path: extensionPath };
    } catch (error) {
      console.warn('⚠️ [Extension Loader] Invalid extension:', extensionPath, error.message);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Optimized extension loading with caching
   */
  async loadExtensionFast(sessionPartition, extensionName = 'woku-ad-blocker') {
    const cacheKey = `${sessionPartition}_${extensionName}`;
    
    // Check if already loaded
    if (this.loadedExtensions.has(cacheKey)) {
      console.log('✅ [Extension Loader] Using cached extension:', extensionName);
      return { success: true, cached: true };
    }

    try {
      const ses = session.fromPartition(sessionPartition);
      
      // Get extension path
      const extensionPath = this.extensionPaths[extensionName];
      if (!extensionPath) {
        throw new Error(`Extension ${extensionName} not found`);
      }

      // Use preloaded validation if available
      let validation;
      if (this.preloadPromises.has(extensionName)) {
        validation = await this.preloadPromises.get(extensionName);
      } else {
        validation = await this.validateExtension(extensionPath);
      }

      if (!validation.valid) {
        throw new Error(`Extension validation failed: ${validation.error}`);
      }

      // Load extension
      const extension = await ses.loadExtension(extensionPath, {
        allowFileAccess: true
      });

      // Cache successful load
      this.loadedExtensions.add(cacheKey);
      this.extensionCache.set(cacheKey, {
        extension,
        loadTime: Date.now(),
        manifest: validation.manifest
      });

      console.log('✅ [Extension Loader] Loaded extension:', extension.name);
      return { 
        success: true, 
        extension,
        manifest: validation.manifest 
      };

    } catch (error) {
      console.error('❌ [Extension Loader] Failed to load extension:', error.message);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Batch load multiple extensions
   */
  async loadExtensionsBatch(sessionPartition, extensionNames = ['woku-ad-blocker']) {
    const loadPromises = extensionNames.map(name => 
      this.loadExtensionFast(sessionPartition, name)
    );

    const results = await Promise.allSettled(loadPromises);
    
    const summary = {
      loaded: 0,
      failed: 0,
      cached: 0,
      extensions: []
    };

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        summary.loaded++;
        if (result.value.cached) summary.cached++;
        summary.extensions.push({
          name: extensionNames[index],
          status: 'loaded',
          cached: result.value.cached
        });
      } else {
        summary.failed++;
        summary.extensions.push({
          name: extensionNames[index],
          status: 'failed',
          error: result.reason || result.value?.error
        });
      }
    });

    console.log('📊 [Extension Loader] Batch load summary:', summary);
    return summary;
  }

  /**
   * Remove extension from session
   */
  async removeExtension(sessionPartition, extensionName) {
    const cacheKey = `${sessionPartition}_${extensionName}`;
    
    try {
      const ses = session.fromPartition(sessionPartition);
      const cached = this.extensionCache.get(cacheKey);
      
      if (cached && cached.extension) {
        await ses.removeExtension(cached.extension.id);
        console.log('🗑️ [Extension Loader] Removed extension:', extensionName);
      }

      // Clear cache
      this.loadedExtensions.delete(cacheKey);
      this.extensionCache.delete(cacheKey);

      return { success: true };
    } catch (error) {
      console.error('❌ [Extension Loader] Failed to remove extension:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get extension info from cache
   */
  getExtensionInfo(sessionPartition, extensionName) {
    const cacheKey = `${sessionPartition}_${extensionName}`;
    return this.extensionCache.get(cacheKey) || null;
  }

  /**
   * Clear extension cache
   */
  clearCache() {
    this.extensionCache.clear();
    this.loadedExtensions.clear();
    console.log('🧹 [Extension Loader] Cache cleared');
  }

  /**
   * Get loader statistics
   */
  getStats() {
    return {
      availableExtensions: Object.keys(this.extensionPaths).length,
      loadedExtensions: this.loadedExtensions.size,
      cachedExtensions: this.extensionCache.size,
      extensionPaths: this.extensionPaths
    };
  }
}

module.exports = OptimizedExtensionLoader;
