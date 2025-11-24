const { app, BrowserWindow, ipcMain, session } = require('electron');
const { dialog } = require('electron');
const log = require('electron-log');

// Defer loading electron-updater until after app is ready and only in production
let autoUpdater = null;
function setupAutoUpdater() {
  if (autoUpdater) return; // already set up
  try {
    const { autoUpdater: updater } = require('electron-updater');
    autoUpdater = updater;

    // Configure logging
    autoUpdater.logger = log;
    if (autoUpdater.logger && autoUpdater.logger.transports) {
      autoUpdater.logger.transports.file.level = 'info';
    }

    // Wire events
    autoUpdater.on('update-available', () => log.info('An update is available. Downloading...'));
    autoUpdater.on('update-not-available', () => log.info('No new update available.'));
    autoUpdater.on('error', (err) => log.error('Error in auto-updater: ' + err.toString()));
    autoUpdater.on('download-progress', (p) => log.info(`Download speed: ${p.bytesPerSecond} - Downloaded ${p.percent}% (${p.transferred}/${p.total})`));
    autoUpdater.on('update-downloaded', (info) => {
      log.info('Update downloaded successfully.');
      const dialogOpts = {
        type: 'info',
        buttons: ['Restart Now', 'Later'],
        title: 'Application Update',
        message: process.platform === 'win32' ? (info.releaseNotes || 'A new version is available.') : info.releaseName,
        detail: 'A new version has been downloaded. Restart the application to apply the updates.'
      };
      dialog.showMessageBox(dialogOpts).then((ret) => {
        if (ret.response === 0) autoUpdater.quitAndInstall();
      });
    });

    log.info('✅ electron-updater loaded and configured');
  } catch (error) {
    log.warn('⚠️ electron-updater not available:', error.message);
    autoUpdater = null; // keep null so we can skip later without mocks
  }
}

const path = require('path');
const fs = require('fs');
const Store = require('electron-store');
const config = require('../../config/config');
const adDomains = require('./ad-domains');

const logger = require('./logger');
const sessionManager = require('./session-manager');
const sessionSyncManager = require('./session-sync-manager');

// Auto deployment manager - optional dependency
let AutoDeploymentManager = null;
try {
  AutoDeploymentManager = require('./auto-deployment-manager');
} catch (error) {
  console.log('⚠️ Auto deployment manager not available (missing dependencies)');
}

// Initialize electron-store for local data persistence
// CRITICAL FIX: Specify explicit path for both dev and production builds
const isDev = !app.isPackaged;
const storeOptions = {
  name: 'woku-app-store',
  cwd: isDev 
    ? path.join(app.getAppPath(), 'config') 
    : path.join(app.getPath('userData'), 'config'),
  // Ensure directory exists
  clearInvalidConfig: true,
  serialize: JSON.stringify,
  deserialize: JSON.parse
};

// Ensure store directory exists
const storeDir = storeOptions.cwd;
if (!fs.existsSync(storeDir)) {
  fs.mkdirSync(storeDir, { recursive: true });
  console.log('💾 [Store] Created store directory:', storeDir);
}

const store = new Store(storeOptions);
console.log('💾 [Store] Initialized at:', store.path);

// CRITICAL FIX: Migrate data from dev path to production path on first run
function migrateStoreDataIfNeeded() {
  try {
    // Try to find old store location (from dev mode)
    const oldDevPath = path.join(app.getAppPath(), 'config', 'woku-app-store.json');
    const currentStorePath = store.path;
    
    // If we're in production and old dev data exists, migrate it
    if (!isDev && fs.existsSync(oldDevPath) && oldDevPath !== currentStorePath) {
      console.log('🔄 [Store Migration] Found old dev store data, migrating...');
      console.log('   From:', oldDevPath);
      console.log('   To:', currentStorePath);
      
      try {
        const oldData = JSON.parse(fs.readFileSync(oldDevPath, 'utf8'));
        
        // Merge old data with current store
        Object.keys(oldData).forEach(key => {
          if (!store.has(key)) {
            store.set(key, oldData[key]);
            console.log('   ✅ Migrated key:', key);
          }
        });
        
        console.log('✅ [Store Migration] Data migration completed successfully');
      } catch (migrationError) {
        console.warn('⚠️ [Store Migration] Failed to migrate data:', migrationError.message);
      }
    }
  } catch (error) {
    console.warn('⚠️ [Store Migration] Migration check failed:', error.message);
  }
}

migrateStoreDataIfNeeded();

let mainWindow;
let sessionWindows = new Map(); // Track all active session windows

// Initialize auto deployment manager (if available)
const deploymentManager = AutoDeploymentManager ? new AutoDeploymentManager() : null;

// uBlock Origin Lite extension path
const UBLOCK_EXTENSION_PATH = isDev
  ? path.join(app.getAppPath(), 'extensions/woku-ad-blocker') // Development: Correctly points to root
  : path.join(path.dirname(app.getAppPath()), 'extensions/woku-ad-blocker'); // Production: Correctly points to the folder outside app.asar

// Function to load uBlock Origin Lite extension for a session
async function loadUBlockExtension(sessionPartition) {
  console.log('🎯 [Force Extension] Starting enhanced extension loading...');

  try {
    // Multiple fallback paths for production builds
    const possiblePaths = [
      path.join(app.getAppPath(), 'extensions/woku-ad-blocker'),
      path.join(path.dirname(app.getAppPath()), 'extensions/woku-ad-blocker'),
      path.join(process.resourcesPath, 'extensions/woku-ad-blocker'),
      path.join(process.resourcesPath, 'app/extensions/ublock-origin-lite'),
      path.join(__dirname, '../../extensions/ublock-origin-lite'),
      path.join(path.dirname(process.execPath), 'extensions/woku-ad-blocker')
    ];

    let foundExtensionPath = null;

    for (const testPath of possiblePaths) {
      console.log('🔍 [Force Extension] Testing path:', testPath);
      try {
        if (fs.existsSync(testPath)) {
          const manifestPath = path.join(testPath, 'manifest.json');
          if (fs.existsSync(manifestPath)) {
            // Verify manifest.json is valid
            const manifestContent = fs.readFileSync(manifestPath, 'utf8');
            const manifest = JSON.parse(manifestContent);
            console.log('✅ [Force Extension] Found valid extension:', manifest.name, 'v' + manifest.version);
            console.log('📍 [Force Extension] Extension path:', testPath);
            foundExtensionPath = testPath;
            break;
          } else {
            console.log('❌ [Force Extension] No manifest.json at:', manifestPath);
          }
        } else {
          console.log('❌ [Force Extension] Path does not exist:', testPath);
        }
      } catch (e) {
        console.log('❌ [Force Extension] Error checking path:', testPath, '-', e.message);
      }
    }

    if (!foundExtensionPath) {
      console.error('❌ [Force Extension] Extension not found in any location');
      console.log('📋 [Force Extension] Searched paths:', possiblePaths);
      return false;
    }

    const ses = session.fromPartition(sessionPartition);

    // Clean up existing extensions
    const existingExtensions = ses.getAllExtensions();
    for (const ext of existingExtensions) {
      if (ext.name && (ext.name.includes('uBlock') || ext.name.includes('uBO'))) {
        console.log('🔄 [Force Extension] Removing existing extension:', ext.name);
        try {
          ses.removeExtension(ext.id);
        } catch (e) {
          console.warn('⚠️ [Force Extension] Could not remove extension:', e.message);
        }
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));

    const extension = await ses.loadExtension(foundExtensionPath, { allowFileAccess: true });
    console.log('✅ [Extension] uBlock Origin Lite loaded:', extension.name);
    console.log('📝 [Force Extension] Extension ID:', extension.id);

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify extension is working
    const finalExtensions = ses.getAllExtensions();
    const activeExtension = finalExtensions.find(ext => ext.id === extension.id);

    if (activeExtension) {
      console.log('🎯 [Force Extension] Extension verified and active');
      console.log('📊 [Force Extension] Total active extensions:', finalExtensions.length);
      return true;
    } else {
      console.error('❌ [Force Extension] Extension not found after loading');
      return false;
    }

  } catch (error) {
    console.error('💥 [Force Extension] Error:', error);
    console.error('🔍 [Force Extension] Error stack:', error.stack);
    return false;
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, '../assets/images/icon.png'),
    show: false
  });

  // Disable DevTools shortcuts in production
  if (!isDev) {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (
        (input.control && input.shift && (input.key.toLowerCase() === 'i' || input.key.toLowerCase() === 'j')) ||
        input.key.toLowerCase() === 'f12'
      ) {
        event.preventDefault();
        console.log('🔒 DevTools shortcut blocked in production mode.');
      }
    });
  }


  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    // Close all session windows when main window closes
    sessionWindows.forEach(win => {
      if (!win.isDestroyed()) win.close();
    });
    sessionWindows.clear();
  });

  // Open DevTools in development mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// Helper function to extract chat ID from URL based on service type
function extractChatId(url, serviceType) {
  try {
    const urlObj = new URL(url);

    switch (serviceType) {
      case 'chatgpt':
        // ChatGPT: https://chat.openai.com/c/abc123 or https://chatgpt.com/c/abc123
        const chatgptMatch = urlObj.pathname.match(/\/c\/([^\/\?]+)/);
        return chatgptMatch ? chatgptMatch[1] : null;

      case 'gemini':
        // Gemini: https://gemini.google.com/app/abc123 or similar
        const geminiMatch = urlObj.pathname.match(/\/app\/([^\/\?]+)/);
        if (geminiMatch) return geminiMatch[1];
        // Also check for chat parameter
        const chatParam = urlObj.searchParams.get('chat');
        return chatParam || null;

      case 'youtube':
        // YouTube: https://youtube.com/watch?v=abc123
        return urlObj.searchParams.get('v');

      default:
        // Generic: try to extract from path or query
        const pathMatch = urlObj.pathname.match(/\/([a-zA-Z0-9_-]{8,})/);
        if (pathMatch) return pathMatch[1];

        // Check common query params
        const chatId = urlObj.searchParams.get('chat') ||
                      urlObj.searchParams.get('conversation') ||
                      urlObj.searchParams.get('thread');
        return chatId;
    }
  } catch (e) {
    console.error('Error extracting chat ID:', e);
    return null;
  }
}

// Helper function to check if user can access locked chat
function canAccessLockedChat(chatId, chatLocks, userId, userRole) {
  // Admin can access all chats
  if (userRole === 'admin') {
    return true;
  }

  // Handle null/undefined chatLocks
  if (!chatLocks || !Array.isArray(chatLocks)) {
    return true; // If no locks loaded, allow access
  }

  // Find if this chat is locked
  const lock = chatLocks.find(l => l.chat_id === chatId);

  // If chat is not locked, everyone can access
  if (!lock) {
    return true;
  }

  // If chat is locked, only the owner can access
  return lock.user_id == userId;
}

// Create isolated session window for accounts
async function createSessionWindow(accountData) {
  const { accountId, serviceName, serviceType, partitionId, allowedDomains: rawAllowedDomains, loginUrl, userRole, userId } = accountData;

  logger.info(`Creating session window for: ${serviceName} (Service: ${serviceType}, User: ${userId})`);

  // Clean up allowed domains - remove https:// or http:// prefix
  // Enforce single window per account (non-configurable)
  const existingWin = sessionWindows.get(accountId);
  if (existingWin && !existingWin.isDestroyed()) {
    console.log('🚫 [Single-Window] Prevented opening a second window for account:', accountId);
    try {
      existingWin.focus();
      if (typeof existingWin.flashFrame === 'function') {
        existingWin.flashFrame(true);
        setTimeout(() => { try { existingWin.flashFrame(false); } catch (e) {} }, 1500);
      }
    } catch (_) {}
    return; // Block creating a new window
  }

  if (existingWin && existingWin.isDestroyed()) {
    sessionWindows.delete(accountId);
  }

  const blockSettingsPages = true; // Always block settings pages

  let allowedDomains = rawAllowedDomains;
  if (Array.isArray(rawAllowedDomains)) {
    allowedDomains = rawAllowedDomains.map(domain => {
      if (typeof domain === 'string') {
        // Remove protocol (https:// or http://)
        return domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
      }
      return domain;
    });
  }

  // Load chat locks for this account from API
  let chatLocks = [];
  const axios = require('axios');
  const Store = require('electron-store');
  const userStore = new Store();
  const authToken = userStore.get('authToken');

  // Auto-retry chat locks loading with smart fallback
  async function loadChatLocksWithRetry() {
    const endpoints = [
      // Try user endpoint first (fixed version)
      { url: 'https://db.handymancode.com/api/wokushop-api/chatlocks/list.php', desc: 'User endpoint' },
      // Fallback to admin endpoint if needed
      { url: 'https://db.handymancode.com/api/wokushop-api/chatlocks/admin-list.php', desc: 'Admin endpoint' }
    ];

    for (let i = 0; i < endpoints.length; i++) {
      const endpoint = endpoints[i];
      try {
        console.log(`🔄 [Auto-Retry ${i + 1}/${endpoints.length}] Trying ${endpoint.desc}...`);

        const response = await axios.get(endpoint.url, {
          headers: { Authorization: `Bearer ${authToken}` },
          timeout: 5000 // 5 second timeout
        });

        console.log('✅ API Response Success:', response.data);

        if (response.data.success && response.data.data && Array.isArray(response.data.data)) {
          console.log('📊 Total chat locks from API:', response.data.data.length);

          // Filter chat locks for this account (handle type conversion)
          const filteredLocks = response.data.data.filter(lock => lock.account_id == accountId);

          console.log('✅ Chat locks loaded for account', accountId, ':', filteredLocks.length, 'locks');
          console.log('🔍 Chat locks details:', filteredLocks);
          return filteredLocks;
        } else {
          console.log('⚠️ API returned success but no valid data');
          continue; // Try next endpoint
        }
      } catch (error) {
        console.log(`❌ [${endpoint.desc}] Failed:`, error.message);

        if (error.response?.status === 403) {
          console.log('🔐 [Auto-Fix] 403 Forbidden detected - API needs requireAuth() instead of requireAdmin()');

          // Auto-detect if this is the admin permission issue
          if (error.response?.data?.message?.includes('Admin access required')) {
            console.log('💡 [Auto-Fix] Detected admin permission issue - app will work with degraded functionality');
            console.log('🔧 [Auto-Fix] Solution: Change API list.php line 10: requireAdmin() → requireAuth()');
          }
        } else if (error.response?.status === 404) {
          console.log('📂 [Auto-Retry] Endpoint not found, trying next...');
        } else {
          console.log('🔍 Error details:', error.response?.data || error);
        }

        // Continue to next endpoint unless it's the last one
        if (i < endpoints.length - 1) {
          console.log('🔄 [Auto-Retry] Trying alternative endpoint...');
          continue;
        }
      }
    }

    // All endpoints failed - graceful degradation
    console.log('⚠️ [Graceful Degradation] All chat lock endpoints failed');
    console.log('🔓 [Fallback Mode] Chat locks disabled - all chats accessible');
    return []; // Return empty array so app continues working
  }

  // Fetch chat locks with auto-retry
  try {
    console.log('🚀 Loading chat locks for account:', accountId, 'type:', typeof accountId);
    chatLocks = await loadChatLocksWithRetry();
  } catch (error) {
    console.error('💥 [Critical Error] All retry attempts failed:', error.message);
    console.log('🔓 [Emergency Mode] Disabling chat locks - all access allowed');
    chatLocks = []; // Emergency fallback
  }

  // Create isolated session using partition
  console.log('🔧 [SESSION] Creating session partition:', `persist:${partitionId}`);
  const ses = session.fromPartition(`persist:${partitionId}`);
  console.log('🔧 [SESSION] Session created successfully');

  // Inject preload script for Chrome API compatibility
  const preloadScripts = [path.join(__dirname, 'extension-preload.js')];

  // Add YouTube ad blocker preload for YouTube sessions (ULTIMATE VERSION 2025)
  if (serviceType === 'youtube') {
    // Use ULTIMATE version - blocks ads BEFORE they play
    preloadScripts.push(path.join(__dirname, 'youtube-preload-ultimate.js'));
    console.log('🔧 [SESSION] Adding YouTube ULTIMATE ad blocker (Block before play)');
  }

  // Add ChatGPT logout blocker preload for ChatGPT sessions (non-admin users only)
  if (serviceType === 'chatgpt' && userRole !== 'admin') {
    preloadScripts.push(path.join(__dirname, 'chatgpt-logout-blocker.js'));
    console.log('🔒 [SESSION] Adding ChatGPT logout blocker preload');
  }

  // Note: Quillbot logout blocker will be injected via executeJavaScript after page load
  // to avoid contextIsolation issues with Storage.prototype

  ses.setPreloads(preloadScripts);
  console.log('🔧 [SESSION] Preload scripts set:', preloadScripts);

  // ========================================
  // UNIVERSAL AD BLOCKING - NO ROLE CHECKS
  // ========================================

  // FORCE enable ad blocking for ALL users (admin + regular)
  if (serviceType !== 'gemini') {
    console.log('🛡️ [Universal AdBlock] ENFORCING ad blocking regardless of role...');

    // COMPREHENSIVE AD BLOCKING DOMAINS - MAXIMUM PROTECTION
    const allAdDomains = [
      // YouTube Ads - Complete Coverage
      '*://www.youtube.com/api/stats/ads*',
      '*://www.youtube.com/api/stats/qoe*',
      '*://www.youtube.com/pagead/*',
      '*://www.youtube.com/ptracking*',
      '*://www.youtube.com/youtubei/v1/log_event*',
      '*://www.youtube.com/api/stats/watchtime*',
      '*://s.youtube.com/api/stats/qoe*',
      '*://*.ytimg.com/generate_204*',
      '*://www.youtube.com/get_video_info*',
      '*://youtube.com/get_video_info*',

      // Google Ads Networks - Maximum Block
      '*://*.doubleclick.net/*',
      '*://googleads.g.doubleclick.net/*',
      '*://securepubads.g.doubleclick.net/*',
      '*://pubads.g.doubleclick.net/*',
      '*://static.doubleclick.net/*',
      '*://ad.doubleclick.net/*',
      '*://stats.g.doubleclick.net/*',
      '*://cm.g.doubleclick.net/*',
      '*://www.googletagservices.com/*',
      '*://googletagservices.com/*',
      '*://www.google-analytics.com/collect*',
      '*://google-analytics.com/collect*',

      // Google Syndication - Complete
      '*://*.googlesyndication.com/*',
      '*://pagead2.googlesyndication.com/*',
      '*://tpc.googlesyndication.com/*',
      '*://www.googleadservices.com/*',
      '*://googleadservices.com/*',
      '*://partner.googleadservices.com/*',
      '*://www.gstatic.com/ads/*',
      '*://gstatic.com/ads/*',

      // Lazada & Shopping Ads - Enhanced
      '*://*.lazada.vn/lazada-media/*',
      '*://*.lazada.vn/ads/*',
      '*://pages.lazada.vn/*',
      '*://lzd-img-global.slatic.net/g/tps/*ad*',
      '*://aeu-tpc.googlesyndication.com/*',
      '*://googleads4.g.doubleclick.net/*',
      '*://*.lazada.com/ads/*',
      '*://*.lazada.sg/ads/*',
      '*://*.alicdn.com/tps/*ad*',

      // Social Media Ads
      '*://*.facebook.com/tr*',
      '*://*.facebook.com/ads/*',
      '*://connect.facebook.net/*/fbevents.js',
      '*://www.facebook.com/tr*',
      '*://facebook.com/tr*',

      // Popular Ad Networks
      '*://outbrain.com/*',
      '*://widgets.outbrain.com/*',
      '*://taboola.com/*',
      '*://*.taboola.com/*',
      '*://amazon-adsystem.com/*',
      '*://*.amazon-adsystem.com/*',

      // Tracking & Analytics
      '*://www.google-analytics.com/*',
      '*://google-analytics.com/*',
      '*://googletagmanager.com/*',
      '*://www.googletagmanager.com/*',
      '*://hotjar.com/*',
      '*://*.hotjar.com/*',

      // Vietnamese Ad Networks
      '*://coccoc.com/ads/*',
      '*://*.coccoc.com/ads/*',
      '*://admicro.vn/*',
      '*://*.admicro.vn/*',
      '*://adsystem.vn/*',
      '*://*.adsystem.vn/*',

      // Generic Ad Patterns - Catch All
      '*://*/ads/*',
      '*://*/advertisements/*',
      '*://*/adservice/*',
      '*://*/adserver/*',
      '*://*/adsense/*',
      '*://*/adnxs/*',
      '*://*/doubleclick/*',
      '*://*/googlesyndication/*',
      '*://*/googleadservices/*',
      '*://*/gpt.js*',
      '*://*/prebid*',
      '*://*/amazon-adsystem*',
      '*://*/outbrain*',
      '*://*/taboola*'
    ];

    console.log(`📊 [Universal AdBlock] Loaded ${allAdDomains.length} ad patterns`);

    // ENHANCED PATTERN MATCHING
    function enhancedAdBlockMatch(url, pattern) {
      try {
        let regexPattern = pattern
          .replace(/\*/g, '.*')
          .replace(/\?/g, '\\?')
          .replace(/\(/g, '\\(')
          .replace(/\)/g, '\\)')
          .replace(/\./g, '\\.')
          .replace(/\[/g, '\\[')
          .replace(/\]/g, '\\]');

        regexPattern = regexPattern.replace(/\.\*:\/\//, '(https?|http)://');
        const regex = new RegExp('^' + regexPattern + '$', 'i');
        const matches = regex.test(url);

        // if (matches) {
        //   console.log(`🎯 [Universal AdBlock] MATCH: "${pattern}" blocks "${url.substring(0, 100)}..."`);
        // }

        return matches;
      } catch (error) {
        return false;
      }
    }

    // MULTI-LAYER BLOCKING
    let blockCount = 0;

    // Layer 1: Primary blocking
    ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
      const url = details.url;
      const shouldBlock = allAdDomains.some(pattern => enhancedAdBlockMatch(url, pattern));

      if (shouldBlock) {
        blockCount++;
        // console.log(`🚫 [Universal AdBlock] #${blockCount} BLOCKED: ${url.substring(0, 80)}...`);
        callback({ cancel: true });
        return;
      }
      callback({});
    });

    // Layer 2: Header blocking
    ses.webRequest.onHeadersReceived({ urls: ['<all_urls>'] }, (details, callback) => {
      const url = details.url;
      const shouldBlock = allAdDomains.some(pattern => enhancedAdBlockMatch(url, pattern));

      if (shouldBlock) {
        // console.log(`🛑 [Universal AdBlock] HEADER-BLOCKED: ${url.substring(0, 80)}...`);
        callback({ cancel: true });
        return;
      }

      let responseHeaders = details.responseHeaders || {};

      // Fix X-Frame-Options conflicts for YouTube
      if (serviceType === 'youtube' && url.includes('youtube.com')) {
        // Remove existing X-Frame-Options to prevent conflicts
        delete responseHeaders['x-frame-options'];
        delete responseHeaders['X-Frame-Options'];
        // Set a single, clean X-Frame-Options header
        responseHeaders['X-Frame-Options'] = [{ name: 'X-Frame-Options', value: 'SAMEORIGIN' }];
      }

      callback({ responseHeaders });
    });

    console.log('✅ [Universal AdBlock] Multi-layer protection ACTIVE for all users!');
    console.log(`📊 [Universal AdBlock] Monitoring ${allAdDomains.length} ad patterns`);
    console.log('👤 [Universal AdBlock] No role restrictions - ALL users protected');
  } else {
    // For Gemini: SELECTIVE CSP bypass - only for Gemini's own content, preserve OAuth security
    ses.webRequest.onHeadersReceived((details, callback) => {
      const url = details.url;
      let responseHeaders = details.responseHeaders || {};

      // SELECTIVE CSP BYPASS: Only bypass for Gemini UI, NOT for auth/API endpoints
      const shouldBypassCSP = url.includes('gemini.google.com') &&
                             !url.includes('accounts.google.com') &&
                             !url.includes('oauth') &&
                             !url.includes('/auth') &&
                             !url.includes('signaler-pa') &&
                             !url.includes('googleapis.com');

      if (shouldBypassCSP) {
        // Only remove UI-blocking CSP, keep security for auth
        delete responseHeaders['content-security-policy'];
        delete responseHeaders['content-security-policy-report-only'];
        console.log('🔓 [Selective CSP] Bypassed CSP for Gemini UI:', url.substring(0, 50) + '...');
      } else {
        // PRESERVE CSP for Google auth endpoints to maintain OAuth security
        console.log('🔒 [Selective CSP] Preserved CSP for auth/API:', url.substring(0, 50) + '...');
      }

      // Fix X-Frame-Options conflicts for Google services
      if (url.includes('google.com')) {
        delete responseHeaders['x-frame-options'];
        delete responseHeaders['X-Frame-Options'];
        responseHeaders['X-Frame-Options'] = [{ name: 'X-Frame-Options', value: 'SAMEORIGIN' }];
      }

      callback({ responseHeaders });
    });

    console.log('✅ [Gemini] Selective CSP bypass enabled - preserves OAuth security');
  }



  // LOGOUT PREVENTION: Block logout URLs for all services except admin users
  if (userRole !== 'admin') {
    console.log('🔒 [Logout Prevention] Setting up logout URL blocking for user:', userRole);

    const logoutUrls = [
      // Google Services (YouTube, Gemini)
      '*://accounts.google.com/logout*',
      '*://accounts.google.com/SignOutOptions*',
      '*://accounts.google.com/Logout*',
      '*://myaccount.google.com/signout*',
      '*://gemini.google.com/logout*',
      '*://youtube.com/logout*',
      '*://www.youtube.com/logout*',

      // ChatGPT / OpenAI - Multiple patterns
      '*://chat.openai.com/auth/logout*',
      '*://chat.openai.com/logout*',
      '*://chatgpt.com/logout*',
      '*://chatgpt.com/auth/logout*',
      '*://openai.com/logout*',
      '*://auth0.openai.com/logout*',
      '*://auth0.openai.com/v2/logout*',

      // Netflix
      '*://www.netflix.com/SignOut*',
      '*://www.netflix.com/logout*',
      '*://netflix.com/SignOut*',
      '*://netflix.com/logout*',

      // Spotify
      '*://open.spotify.com/logout*',
      '*://accounts.spotify.com/logout*',
      '*://spotify.com/logout*',
      '*://www.spotify.com/logout*',

      // QuillBot
      '*://quillbot.com/logout*',
      '*://quillbot.com/signout*',
      '*://quillbot.com/sign-out*',
      '*://quillbot.com/api/logout*',
      '*://quillbot.com/api/signout*',
      '*://*.quillbot.com/logout*',
      '*://*.quillbot.com/signout*',

      // Universal Logout Patterns - Catch all other services
      '*://*/*logout*',
      '*://*/*signout*',
      '*://*/*log-out*',
      '*://*/*sign-out*'
    ];

    ses.webRequest.onBeforeRequest({ urls: logoutUrls }, (details, callback) => {
      console.log('🚫 [Logout Prevention] BLOCKED logout attempt:', details.url);
      console.log('👤 [Logout Prevention] User role:', userRole, '- Logout denied');

      // Redirect to homepage instead of logout
      const currentDomain = new URL(details.url).hostname;
      let redirectUrl = 'https://' + currentDomain;

      // Service-specific redirects
      if (currentDomain.includes('youtube.com')) {
        redirectUrl = 'https://www.youtube.com';
      } else if (currentDomain.includes('netflix.com')) {
        redirectUrl = 'https://www.netflix.com/browse';
      } else if (currentDomain.includes('spotify.com')) {
        redirectUrl = 'https://open.spotify.com';
      } else if (currentDomain.includes('quillbot.com')) {
        redirectUrl = 'https://quillbot.com';
        console.log('📝 [Logout Prevention] QuillBot logout blocked, redirecting to home');
      } else if (currentDomain.includes('openai.com') || currentDomain.includes('chatgpt.com')) {
        redirectUrl = 'https://chat.openai.com';
        console.log('🤖 [Logout Prevention] ChatGPT logout blocked, redirecting to chat home');
      } else if (currentDomain.includes('gemini.google.com')) {
        redirectUrl = 'https://gemini.google.com';
      } else if (currentDomain.includes('auth0.openai.com')) {
        redirectUrl = 'https://chat.openai.com';
        console.log('🔐 [Logout Prevention] ChatGPT Auth0 logout blocked');
      }

      callback({ redirectUrl: redirectUrl });
    });

    console.log('✅ [Logout Prevention] Active - Blocking', logoutUrls.length, 'logout URL patterns');
  } else {
    console.log('👑 [Logout Prevention] Skipped - Admin user has full access');
  }

  // Conditionally load uBlock Origin Lite extension
  if (serviceType !== 'gemini') {
    console.log('🔧 [uBlock] Attempting to load extension for service type:', serviceType);
    console.log('🔧 [uBlock] About to call loadUBlockExtension function...');

    try {
      const extensionLoaded = await loadUBlockExtension(`persist:${partitionId}`);
      if (extensionLoaded) {
        console.log('✅ [uBlock] Extension successfully loaded for', serviceType);
        // Add a delay to allow the extension to initialize its filter lists
        console.log('⏳ [uBlock] Waiting 1 second for extension to initialize...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('👍 [uBlock] Extension initialization period finished.');
      } else {
        console.log('❌ [uBlock] Failed to load extension for', serviceType);
        console.log('🔧 [uBlock] Using enhanced fallback ad-blocking instead');
      }
    } catch (error) {
      console.error('💥 [uBlock] Exception while loading extension:', error);
      console.log('🔧 [uBlock] Extension loading failed, proceeding with enhanced network blocking');
    }

    // ENHANCED FALLBACK AD-BLOCKING: Multi-layer network blocking for YouTube
    if (serviceType === 'youtube') {
      console.log('🛡️ [Enhanced AdBlock] Setting up MULTI-LAYER YouTube ad blocking...');

      const youtubeAdUrls = [
        // Video ads - Comprehensive patterns
        '*://*.googlevideo.com/videoplayback*&dur=*&gir=yes*',
        '*://*.googlevideo.com/videoplayback*&adsystem=*',
        '*://*.googlevideo.com/videoplayback*&adformat=*',
        '*://*.googlevideo.com/ptracking*',
        '*://*.googlevideo.com/*&ad_*',
        '*://*.googlevideo.com/*&adurl=*',

        // Ad networks - Complete coverage
        '*://*.doubleclick.net/*',
        '*://googleads.g.doubleclick.net/*',
        '*://securepubads.g.doubleclick.net/*',
        '*://pubads.g.doubleclick.net/*',
        '*://static.doubleclick.net/*',
        '*://ad.doubleclick.net/*',
        '*://stats.g.doubleclick.net/*',
        '*://*.googleadservices.com/*',
        '*://partner.googleadservices.com/*',
        '*://*.googlesyndication.com/*',
        '*://tpc.googlesyndication.com/*',
        '*://pagead2.googlesyndication.com/*',
        '*://www.googletagservices.com/*',
        '*://googletagservices.com/*',

        // YouTube ad APIs - All endpoints
        '*://www.youtube.com/api/stats/ads*',
        '*://www.youtube.com/api/stats/watchtime*',
        '*://www.youtube.com/api/stats/qoe*',
        '*://www.youtube.com/pagead/*',
        '*://www.youtube.com/ptracking*',
        '*://www.youtube.com/youtubei/v1/log_event*',
        '*://www.youtube.com/youtubei/v1/player/ad_*',
        '*://www.youtube.com/get_video_info*&adformat=*',
        '*://s.youtube.com/api/stats/qoe*',
        '*://*.ytimg.com/generate_204*',

        // Additional ad patterns
        '*://static.doubleclick.net/*',
        '*://www.googletagmanager.com/*',
        '*://*.youtube.com/get_video_info*&ad*',
        '*://*.youtube.com/*&ad_*',
        '*://*.youtube.com/api/stats/atr*',
        '*://www.gstatic.com/ads/*',

        // Tracking and analytics
        '*://www.google-analytics.com/collect*',
        '*://www.google-analytics.com/j/collect*',
        '*://ssl.google-analytics.com/*'
      ];

      // Block ad requests
      ses.webRequest.onBeforeRequest({ urls: youtubeAdUrls }, (details, callback) => {
        console.log('🛑 [Enhanced AdBlock] BLOCKED ad request:', details.url.substring(0, 100) + '...');
        callback({ cancel: true });
      });

      // Block ad-related headers
      ses.webRequest.onHeadersReceived({ urls: ['*://*.youtube.com/*', '*://*.googlevideo.com/*'] }, (details, callback) => {
        const url = details.url.toLowerCase();

        // Check for ad indicators in URL
        if (url.includes('&adsystem=') ||
            url.includes('&adformat=') ||
            url.includes('pagead') ||
            url.includes('/ads/') ||
            url.includes('&ad_') ||
            url.includes('&adurl=') ||
            url.includes('doubleclick') ||
            url.includes('googlesyndication')) {

          console.log('🛑 [Enhanced AdBlock] BLOCKED ad by header:', details.url.substring(0, 100));
          callback({ cancel: true });
          return;
        }

        callback({});
      });

      // Block ad-related response headers
      ses.webRequest.onBeforeSendHeaders({ urls: ['*://*.youtube.com/*', '*://*.googlevideo.com/*'] }, (details, callback) => {
        const url = details.url.toLowerCase();

        if (url.includes('pagead') || url.includes('/ads/') || url.includes('doubleclick')) {

          console.log('🛑 [Enhanced AdBlock] BLOCKED ad send header:', details.url.substring(0, 100));
          callback({ cancel: true });
          return;
        }

        callback({});
      });

      console.log('✅ [Enhanced AdBlock] Multi-layer network blocking active!');
      console.log('📊 [Enhanced AdBlock] Blocking', youtubeAdUrls.length, 'URL patterns');
      console.log('🎯 [Enhanced AdBlock] Layer 1: uBlock Origin Lite (25+ rulesets)');
      console.log('🎯 [Enhanced AdBlock] Layer 2: Network-level blocking');
      console.log('🎯 [Enhanced AdBlock] Layer 3: Enhanced preload script');
    }
  } else {
    console.log('ℹ️ [uBlock] Skipping uBlock Origin extension for Gemini service.');
  }



  // Configure webPreferences based on service type
  const webPreferences = {
      partition: `persist:${partitionId}`,
      nodeIntegration: false,
      contextIsolation: true,
    sandbox: false,
    webSecurity: serviceType === 'gemini' ? false : true, // Disable for Gemini, enable for others
    allowRunningInsecureContent: false
  };



  // For Gemini, we need additional settings to bypass CSP
  if (serviceType === 'gemini') {
    console.log('🔧 [Gemini] Applying special configuration for Gemini');
    console.log('✅ [Gemini] webSecurity is DISABLED to allow proper functionality');
  }

  const sessionWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: webPreferences,
    title: `${serviceName} - ${serviceType}`,
    icon: path.join(__dirname, '../assets/images/icon.png')
  });

  // Disable DevTools shortcuts in production
  if (!isDev) {
    sessionWindow.webContents.on('before-input-event', (event, input) => {
      if (
        (input.control && input.shift && (input.key.toLowerCase() === 'i' || input.key.toLowerCase() === 'j')) ||
        input.key.toLowerCase() === 'f12'
      ) {
        event.preventDefault();
        console.log('🔒 DevTools shortcut blocked in session window.');
      }
    });
  }


  // Set proper User-Agent for Gemini
  if (serviceType === 'gemini') {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
    ses.setUserAgent(userAgent);
    console.log('🔧 [Gemini] Set User-Agent:', userAgent);

    // Inject URL.parse polyfill on EVERY navigation to gemini.google.com
    sessionWindow.webContents.on('did-start-navigation', (event, url, isInPlace, isMainFrame) => {
      if (isMainFrame && url.includes('gemini.google.com')) {
        console.log('🎯 [Gemini] Navigation detected, injecting URL.parse polyfill ASAP');

        // Inject immediately when navigation starts
      sessionWindow.webContents.executeJavaScript(`
        (function() {
            // Set up comprehensive error logging
            window.addEventListener('error', function(e) {
              console.error('🔴 [Gemini ERROR]', e.message, 'at', e.filename, ':', e.lineno);
            });

            window.addEventListener('unhandledrejection', function(e) {
              console.error('🔴 [Gemini PROMISE REJECTION]', e.reason);
            });

            if (!window.URL.parse) {
              window.URL.parse = function(url, base) {
                try {
                  return new URL(url, base);
                } catch (e) {
                  return null;
                }
              };
              console.log('🎯 [NAVIGATION INJECT] URL.parse() polyfill injected');
            }

            // Log when DOM is ready
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', function() {
                console.log('📄 [Gemini] DOM Content Loaded');
                console.log('📄 [Gemini] Body innerHTML length:', document.body ? document.body.innerHTML.length : 'no body');
              });
            } else {
              console.log('📄 [Gemini] DOM already loaded');
              console.log('📄 [Gemini] Body innerHTML length:', document.body ? document.body.innerHTML.length : 'no body');
            }
          })();
        `).catch(err => console.error('Failed to inject on navigation:', err));
      }
    });

    // Also inject on frame-created (even earlier)
    sessionWindow.webContents.on('frame-created', (event, details) => {
      const frame = details.frame;
      if (frame) {
        frame.executeJavaScript(`
          (function() {
            if (!window.URL.parse) {
              window.URL.parse = function(url, base) {
                try {
                  return new URL(url, base);
                } catch (e) {
                  return null;
                }
              };
              console.log('🎯 [FRAME INJECT] URL.parse() polyfill injected in frame');
            }
        })();
        `).catch(() => {}); // Ignore errors for frames
      }
    });

    // Add console message listener to capture all console logs from the page
    sessionWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      const levelSymbol = ['📘', '⚠️', '🔴', '🐛'][level] || '📘';
      console.log(`${levelSymbol} [Gemini Console] ${message}`);

      // OAUTH ERROR MONITORING for 401 Unauthorized errors
      if (message.includes('401') && (message.includes('signaler-pa') || message.includes('googleapis') || message.includes('google.com'))) {
        console.log('🚨 [OAuth Monitor] Detected 401 Unauthorized error from Google services');
        console.log('🔑 [OAuth Monitor] This indicates Google OAuth tokens are invalid or expired');
        console.log('💡 [OAuth Monitor] User may need to clear session and re-authenticate manually');

        // Show notification to user about OAuth issue
        sessionWindow.webContents.executeJavaScript(`
          console.warn('🚨 OAuth Authentication Issue Detected');
          console.warn('Google services returned 401 Unauthorized. Session may need refresh.');
        `).catch(() => {});
      }
    });

    console.log('✅ [Gemini] URL.parse polyfill will be injected on navigation + frame creation');
    console.log('✅ [Gemini] Console logging and error tracking enabled');
  }

  // Load the service URL (passed from renderer or use fallback)
  const url = loginUrl || 'https://www.google.com';

  // Restore cookies from database before loading URL
  (async () => {
    try {
      console.log('🍪 [Cookie Sync] Attempting to restore cookies for account:', accountId);

      const authToken = store.get('authToken');
      if (!authToken) {
        console.log('⚠️ [Cookie Sync] No auth token, skipping cookie restore');
        sessionWindow.loadURL(url);
        return;
      }

      const axios = require('axios');
      const response = await axios.get(`https://db.handymancode.com/api/wokushop-api/cookies/get.php?account_id=${accountId}`, {
        headers: {
          'X-Auth-Token': authToken,
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (response.data.success && response.data.cookies && response.data.cookies.length > 0) {
        const cookies = response.data.cookies;
        console.log('🍪 [Cookie Sync] Found', cookies.length, 'cookies in database');

        let successCount = 0;
        for (const cookie of cookies) {
          try {
            // SPECIAL HANDLING FOR GOOGLE OAUTH COOKIES (Gemini)
            const isGoogleOAuthCookie = ['SAPISID', 'HSID', 'SID', '__Secure-1PSID', '__Secure-3PSID', 'SSID', 'APISID'].includes(cookie.name);
            const isGoogleDomain = cookie.domain.includes('google.com') || cookie.domain.includes('googleapis.com');

            // Fix domain format: remove leading dot for URL, keep original domain format for cookie
            const domainForUrl = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;

            // CRITICAL: For Google OAuth cookies, preserve EXACT original domain format
            // Don't add dots automatically - this breaks Google authentication!
            let cookieDomain = cookie.domain;

            // Only add leading dot for non-Google cookies if needed for wildcard support
            if (!isGoogleDomain && !cookieDomain.startsWith('.') && cookieDomain.includes('.')) {
              cookieDomain = '.' + cookieDomain;
            }

            const cookieDetails = {
              url: `http${cookie.secure ? 's' : ''}://${domainForUrl}${cookie.path}`,
              name: cookie.name,
              value: cookie.value,
              domain: cookieDomain,
              path: cookie.path,
              secure: cookie.secure,
              httpOnly: cookie.httpOnly,
              expirationDate: cookie.expirationDate,
              // Add missing Google OAuth cookie attributes
              sameSite: cookie.sameSite || (isGoogleOAuthCookie ? 'none' : 'lax'),
              priority: cookie.priority || 'medium'
            };

            console.log('🔧 [Cookie Debug] Setting cookie:', cookie.name, 'Domain:', cookieDomain, 'URL:', cookieDetails.url);

            await ses.cookies.set(cookieDetails);
            successCount++;
            console.log('✅ [Cookie Debug] Successfully set:', cookie.name);
          } catch (cookieError) {
            console.warn('⚠️ [Cookie Sync] Failed to set cookie:', cookie.name, cookieError.message);
            console.warn('   Cookie details:', JSON.stringify(cookie, null, 2));
          }
        }

        console.log('✅ [Cookie Sync] Restored', successCount, '/', cookies.length, 'cookies');

        // OAUTH TOKEN VALIDATION for Gemini after cookie restoration
        if (serviceType === 'gemini') {
          console.log('🔍 [OAuth Validation] Checking Google OAuth tokens for Gemini...');

          const oauthCookies = cookies.filter(cookie =>
            ['SAPISID', 'HSID', 'SID', '__Secure-1PSID', '__Secure-3PSID'].includes(cookie.name)
          );

          if (oauthCookies.length > 0) {
            console.log(`🔑 [OAuth Validation] Found ${oauthCookies.length} OAuth cookies`);

            // Check if OAuth tokens are expired or invalid
            const now = Math.floor(Date.now() / 1000);
            const expiredTokens = oauthCookies.filter(cookie =>
              cookie.expirationDate && cookie.expirationDate < now
            );

            if (expiredTokens.length > 0) {
              console.log('⚠️ [OAuth Validation] Found expired OAuth tokens:', expiredTokens.map(c => c.name));
              console.log('🔄 [OAuth Validation] May need to re-authenticate with Google if 401 errors occur');
            } else {
              console.log('✅ [OAuth Validation] OAuth tokens appear valid');
            }
          } else {
            console.log('⚠️ [OAuth Validation] No OAuth cookies found - Gemini may not be authenticated');
          }
        }
      } else {
        console.log('ℹ️ [Cookie Sync] No cookies found in database for this account');
      }
    } catch (error) {
      console.warn('⚠️ [Cookie Sync] Failed to restore cookies:', error.message);
    } finally {
      // Always load URL regardless of cookie restore success
      sessionWindow.loadURL(url);
    }
  })();

  // Monitor loading progress
  sessionWindow.webContents.on('did-start-loading', () => {
    console.log('🔄 [Loading] Started loading:', url);
  });

  sessionWindow.webContents.on('did-stop-loading', () => {
    console.log('✅ [Loading] Stopped loading');
  });

  sessionWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('❌ [Loading] Failed to load:', errorCode, errorDescription, validatedURL);

    // OAUTH ERROR DETECTION for Gemini
    if (serviceType === 'gemini' && (errorCode === -3 || errorDescription.includes('AUTH'))) {
      console.log('🔍 [OAuth Error] Detected potential OAuth authentication failure for Gemini');
      console.log('💡 [OAuth Error] This may be due to expired or invalid Google OAuth tokens');
      console.log('🔄 [OAuth Error] Recommendation: Clear Gemini session and re-authenticate manually');
    }
  });

  // Track the session window
  sessionWindows.set(accountId, sessionWindow);

  // DOM-based ad blocking for maximum coverage
  if (serviceType !== 'gemini') {
    sessionWindow.webContents.on('did-finish-load', () => {
      sessionWindow.webContents.executeJavaScript(`
        (function() {
          console.log('🧹 [DOM AdBlock] Injecting aggressive DOM ad blocker...');

          // SMART DOM ad removal - only target actual ads
          function removeAds() {
            let removedCount = 0;

            // SAFE ad selectors - only remove actual ads, preserve video functionality
            const specificAdSelectors = [
              '.ytd-ad-slot-renderer',
              '.ytd-promoted-sparkles-text-search-renderer',
              '.ytd-in-feed-ad-layout-renderer',
              '[data-ad-slot]',
              '[data-ad-unit]',
              'iframe[src*="doubleclick"]',
              'iframe[src*="googlesyndication"]',
              'iframe[src*="googleadservices"]',
              'iframe[src*="lazada"]',
              '.masthead-ad',
              '.video-ads .ytp-ad-text',
              '.ytp-ad-skip-button-container'
            ];

            // Remove specific ad elements
            specificAdSelectors.forEach(selector => {
              try {
                const elements = document.querySelectorAll(selector);
            elements.forEach(el => {
                  el.remove();
                  removedCount++;
                  console.log('🗑️ [Smart AdBlock] Removed specific ad:', el.tagName, el.className);
                });
              } catch (e) {
                // Ignore errors
              }
            });

            // CAREFUL removal of elements with 'ad' in class/id
            // Only if they contain actual ad content
            const suspiciousElements = document.querySelectorAll('[id*="ad"], [class*="ad"]');
            suspiciousElements.forEach(el => {
              try {
                const text = el.textContent?.toLowerCase() || '';
                const className = el.className?.toLowerCase() || '';
                const id = el.id?.toLowerCase() || '';

                // CRITICAL: Skip essential YouTube elements & video player
                if (className.includes('masthead') ||
                    className.includes('style-scope') ||
                    className.includes('ytd-') ||
                    className.includes('html5-video-player') ||
                    className.includes('ytp-') ||
                    className.includes('video-stream') ||
                    id.includes('container') ||
                    id.includes('content') ||
                    id.includes('page') ||
                    id.includes('movie_player') ||
                    id.includes('player') ||
                    el.tagName === 'SCRIPT' ||
                    el.tagName === 'STYLE' ||
                    el.tagName === 'VIDEO' ||
                    el.tagName === 'IFRAME') {
                  return; // Don't remove essential elements
                }

                // STRICT ad detection - only remove obvious ads
                const isRealAd = (text.includes('advertisement') && text.length < 100) ||
                               (text.includes('sponsored') && text.length < 100) ||
                               el.getAttribute('src')?.includes('doubleclick') ||
                               el.getAttribute('src')?.includes('googlesyndication') ||
                               el.getAttribute('href')?.includes('lazada') ||
                               (className.includes('ad-banner') ||
                                className.includes('ad-slot') ||
                                className.includes('ad-container') ||
                                className.includes('ad-wrapper'));

                if (isRealAd) {
                  el.remove();
                  removedCount++;
                  console.log('🗑️ [Smart AdBlock] Removed suspicious ad:', el.tagName, className || id);
                }
              } catch (e) {
                // Ignore errors
              }
            });

            // Remove Lazada specific elements
            const lazadaElements = document.querySelectorAll('[href*="lazada"], [src*="lazada"], [data-url*="lazada"]');
            lazadaElements.forEach(el => {
              el.remove();
              removedCount++;
              console.log('🗑️ [DOM AdBlock] Removed Lazada ad:', el.tagName);
            });

            if (removedCount > 0) {
              console.log(\`✅ [DOM AdBlock] Removed \${removedCount} ad elements\`);
            }
          }

          // Run immediately
          removeAds();

          // Run on DOM changes
          const observer = new MutationObserver(removeAds);
          observer.observe(document.body, { childList: true, subtree: true });

          // Run periodically as backup
          setInterval(removeAds, 3000);

          console.log('✅ [Smart AdBlock] Intelligent DOM ad blocker active');
        })();
      `).catch(err => console.error('❌ [DOM AdBlock] Injection failed:', err));
    });

    console.log('🧹 [Smart AdBlock] Intelligent DOM ad removal will be injected on page load');
  }

  // YouTube Ad Skipper is now injected via preload script (youtube-preload.js)
  // This avoids Trusted Types issues
  if (serviceType === 'youtube') {
    console.log('✅ [YouTube Ad Skipper] Will be injected via preload script');
  }

  sessionWindow.webContents.on('did-finish-load', () => {
    const currentUrl = sessionWindow.webContents.getURL();
    console.log('=== did-finish-load event ===');
    console.log('URL:', currentUrl);

    // Auto-redirect Gemini homepage to app
    if (serviceType === 'gemini') {
      const urlObj = new URL(currentUrl);
      // If we're on the Gemini homepage (not /app), redirect to /app
      if (urlObj.hostname.includes('gemini.google.com') && urlObj.pathname === '/') {
        console.log('🔄 [Gemini] Detected homepage, redirecting to /app...');
        sessionWindow.loadURL('https://gemini.google.com/app');
        return; // Don't run other checks while redirecting
      }
    }

    // UNIVERSAL LOGOUT PREVENTION: Inject DOM-level logout blocking for all services
    if (userRole !== 'admin') {
      console.log('🔒 [DOM Blocker] Injecting universal DOM logout blocking...');
      sessionWindow.webContents.executeJavaScript(`
        (function() {
          console.log('🔒 [DOM Blocker] Scanning for logout elements...');

          const logoutTexts = ['log out', 'sign out', 'logout', 'signout', 'đăng xuất'];

          // Show notification when logout is blocked
          function showLogoutBlockedMessage() {
            const notification = document.createElement('div');
            notification.innerHTML = \`
              <div style="
                position: fixed;
                top: 20px;
                right: 20px;
                background: #f56565;
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                font-size: 14px;
                max-width: 300px;
              ">
                <strong>🔒 Logout Disabled</strong><br>
                Logout is not allowed for shared accounts.
              </div>
            \`;
            document.body.appendChild(notification);
            setTimeout(() => {
              if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
              }
            }, 5000);
          }

          function blockLogoutElements() {
            let blockedCount = 0;
            // Select all potential clickable elements including class-based selectors
            const elements = document.querySelectorAll('a, button, [role="button"], [role="menuitem"], [class*="logout"], [class*="signout"]');

            elements.forEach(el => {
              if (el.dataset.logoutBlocked) return; // Already processed

              const text = el.textContent.toLowerCase().trim();
              const href = el.getAttribute('href')?.toLowerCase() || '';
              const className = el.className?.toLowerCase() || '';

              let isLogoutElement = false;

              // Check text content
              if (logoutTexts.some(t => text.includes(t))) {
                isLogoutElement = true;
              }

              // Check href attribute
              if (logoutTexts.some(t => href.includes(t))) {
                isLogoutElement = true;
              }

              // Check class name
              if (logoutTexts.some(t => className.includes(t))) {
                isLogoutElement = true;
              }

              if (isLogoutElement) {
                // BLOCK CLICK EVENTS - Most important!
                el.addEventListener('click', function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  e.stopImmediatePropagation();
                  console.log('🚫 [DOM Blocker] BLOCKED logout click on:', el.tagName);
                  showLogoutBlockedMessage();
                  return false;
                }, true);

                // Remove href to prevent navigation
                if (el.tagName === 'A') {
                  el.removeAttribute('href');
                  el.setAttribute('href', 'javascript:void(0)');
                }

                // Visual indicator
                el.style.opacity = '0.5';
                el.style.cursor = 'not-allowed';
                el.title = 'Logout is disabled for shared accounts';

                el.dataset.logoutBlocked = 'true';
                console.log('🚫 [DOM Blocker] Blocked logout element:', el.tagName, text.substring(0, 30));
                blockedCount++;
              }
            });

            if (blockedCount > 0) {
              console.log('🔒 [DOM Blocker] Blocked', blockedCount, 'logout elements on this scan.');
            }
          }

          // Override JavaScript logout functions
          if (window.logout) {
            window.logout = function() {
              console.log('🚫 [DOM Blocker] Blocked window.logout()');
              showLogoutBlockedMessage();
              return false;
            };
          }

          if (window.signOut) {
            window.signOut = function() {
              console.log('🚫 [DOM Blocker] Blocked window.signOut()');
              showLogoutBlockedMessage();
              return false;
            };
          }

          // Block location changes to logout URLs
          const originalAssign = window.location.assign;
          const originalReplace = window.location.replace;

          window.location.assign = function(url) {
            if (url && (url.includes('logout') || url.includes('signout'))) {
              console.log('🚫 [DOM Blocker] Blocked location.assign:', url);
              showLogoutBlockedMessage();
              return;
            }
            return originalAssign.call(this, url);
          };

          window.location.replace = function(url) {
            if (url && (url.includes('logout') || url.includes('signout'))) {
              console.log('🚫 [DOM Blocker] Blocked location.replace:', url);
              showLogoutBlockedMessage();
              return;
            }
            return originalReplace.call(this, url);
          }

          // Run initial block at different intervals
          setTimeout(blockLogoutElements, 500);
          setTimeout(blockLogoutElements, 2000);
          setTimeout(blockLogoutElements, 5000);

          // Monitor for new elements appearing in the DOM
          const observer = new MutationObserver(() => {
            blockLogoutElements();
          });

          observer.observe(document.body, {
            childList: true,
            subtree: true
          });

          // Periodic recheck every 5 seconds
          setInterval(blockLogoutElements, 5000);

          console.log('✅ [DOM Blocker] Universal logout blocker is active and monitoring.');
        })();
      `);
    }

    // Inject Quillbot-specific logout blocker if it's a Quillbot session for a non-admin user
    if (serviceType === 'quillbot' && userRole !== 'admin') {
      const quillbotBlockerPath = path.join(__dirname, 'quillbot-logout-blocker.js');
      fs.readFile(quillbotBlockerPath, 'utf8', (err, data) => {
        if (err) {
          console.error('Failed to read Quillbot logout blocker script:', err);
          return;
        }
        sessionWindow.webContents.executeJavaScript(data)
          .then(() => console.log('✅ [MAIN] Quillbot logout blocker script injected.'))
          .catch(err => console.error('Failed to inject Quillbot logout blocker script:', err));
      });
    }

    // Check chat lock
    checkChatLock(currentUrl);
  });

  sessionWindow.on('closed', async () => {
    // Auto-save cookies before closing
    try {
      console.log('🍪 [Cookie Sync] Auto-saving cookies before window close for account:', accountId);

      const cookies = await ses.cookies.get({});


      if (cookies.length > 0) {
        const authToken = store.get('authToken');
        if (authToken) {
          const axios = require('axios');

          // Save ALL cookies, including session cookies, with enhanced metadata
          const allCookiesWithMetadata = cookies.map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expirationDate,
            session: cookie.session, // Preserve the session flag
            sameSite: cookie.sameSite || 'lax',
            priority: cookie.priority || 'medium',
            sourceScheme: cookie.sourceScheme || 'Secure',
            sourcePort: cookie.sourcePort || 443,
            isGoogleOAuth: ['SAPISID', 'HSID', 'SID', '__Secure-1PSID', '__Secure-3PSID', 'SSID', 'APISID'].includes(cookie.name)
          }));

          await axios.post('https://db.handymancode.com/api/wokushop-api/cookies/save.php', {
            account_id: accountId,
            cookies: allCookiesWithMetadata // Send all cookies
          }, {
            headers: {
              'X-Auth-Token': authToken,
              'Authorization': `Bearer ${authToken}`
            }
          });
          console.log('✅ [Cookie Sync] Auto-saved', cookies.length, 'cookies with enhanced metadata to database');
        }
      }
    } catch (error) {
      console.warn('⚠️ [Cookie Sync] Auto-save failed:', error.message);
    }

    sessionWindows.delete(accountId);
  });

  // Periodic cookie save every 5 minutes
  const cookieSaveInterval = setInterval(async () => {
    if (sessionWindow.isDestroyed()) {
      clearInterval(cookieSaveInterval);
      return;
    }

    try {
      console.log('🍪 [Cookie Sync] Periodic save for account:', accountId);

      const cookies = await ses.cookies.get({});

      if (cookies.length > 0) {
        const authToken = store.get('authToken');
        if (authToken) {
          const axios = require('axios');

          // ENHANCED COOKIE METADATA for periodic saves (same as auto-save)
          const enhancedCookies = cookies.map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expirationDate,
            // Add critical metadata for Google OAuth cookies
            sameSite: cookie.sameSite || 'lax',
            priority: cookie.priority || 'medium',
            sourceScheme: cookie.sourceScheme || 'Secure',
            sourcePort: cookie.sourcePort || 443,
            // Mark Google OAuth cookies for special handling
            isGoogleOAuth: ['SAPISID', 'HSID', 'SID', '__Secure-1PSID', '__Secure-3PSID', 'SSID', 'APISID'].includes(cookie.name)
          }));

          await axios.post('https://db.handymancode.com/api/wokushop-api/cookies/save.php', {
            account_id: accountId,
            cookies: enhancedCookies
          }, {
            headers: {
              'X-Auth-Token': authToken,
              'Authorization': `Bearer ${authToken}`
            }
          });
          console.log('✅ [Cookie Sync] Periodic save completed:', cookies.length, 'cookies with enhanced metadata');
        }
      }
    } catch (error) {
      console.warn('⚠️ [Cookie Sync] Periodic save failed:', error.message);
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  // Handle window.open() and target="_blank" links
  sessionWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;

      // Admin can open new windows freely
      if (userRole === 'admin') {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            webPreferences: {
              partition: `persist:${partitionId}`,
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: true
            }
          }
        };
      }

      // For users: Check if domain is allowed
      let isDomainAllowed = false;

      if (!allowedDomains || allowedDomains.length === 0) {
        // If no allowed domains, check against login URL
        try {
          const loginUrlObj = new URL(loginUrl);
          const loginHostname = loginUrlObj.hostname;
          isDomainAllowed = hostname === loginHostname || hostname.endsWith(`.${loginHostname}`);
        } catch (e) {
          isDomainAllowed = false;
        }
      } else {
        // Check against allowed domains
        isDomainAllowed = allowedDomains.some(domain => {
          return hostname === domain || hostname.endsWith(`.${domain}`);
        });
      }

      if (isDomainAllowed) {
        // Navigate in the same window instead of opening new window
        console.log('User tried to open new window to:', url, '- Navigating in same window instead');
        sessionWindow.loadURL(url);
        return { action: 'deny' };
      } else {
        // Block completely and redirect to login URL
        console.log('Blocked user from opening new window to:', hostname, '- Redirecting to login URL');
        sessionWindow.loadURL(loginUrl);
        return { action: 'deny' };
      }
    } catch (error) {
      console.error('Error handling window open:', error);
      return { action: 'deny' };
    }
  });

  // Helper function to get service homepage URL
  const getServiceHomepage = (serviceType) => {
    switch (serviceType) {
      case 'gemini':
        return 'https://gemini.google.com/app';
      case 'chatgpt':
        return 'https://chatgpt.com/';
      case 'youtube':
        return 'https://www.youtube.com/';
      case 'facebook':
        return 'https://www.facebook.com/';
      case 'instagram':
        return 'https://www.instagram.com/';
      case 'twitter':
      case 'x':
        return 'https://x.com/';
      case 'tiktok':
        return 'https://www.tiktok.com/';
      default:
        // Fallback to login URL if service type unknown
        return loginUrl || 'https://www.google.com';
    }
  };

  // Helper function to check chat lock for a URL
  const checkChatLock = (url, event = null) => {
    console.log('=== Chat Lock Check ===');
    console.log('URL:', url);
    console.log('User ID:', userId, '| Role:', userRole);

    // CHAT LOCK CHECK: Check if navigating to a locked chat
    const chatId = extractChatId(url, serviceType);
    console.log('Extracted chat ID:', chatId, '| Service type:', serviceType);
    console.log('Total chat locks loaded:', chatLocks.length);

    if (chatId) {
      console.log('Checking chat lock for chat ID:', chatId);

      // Log all locks for debugging
      chatLocks.forEach(lock => {
        console.log('  - Lock:', lock.chat_id, '→ User:', lock.user_id);
      });

      const canAccess = canAccessLockedChat(chatId, chatLocks, userId, userRole);
      console.log('Can access:', canAccess);

      if (!canAccess) {
        console.log('🔒 [Chat Lock] BLOCKED access to locked chat:', chatId, '- User ID:', userId);

        if (event) {
          event.preventDefault();
        }

        // Redirect to service homepage instead of login page
        const homepageUrl = getServiceHomepage(serviceType);
        console.log('🔄 [Chat Lock] Redirecting to service homepage:', homepageUrl);
        sessionWindow.loadURL(homepageUrl);

        // Show notification to user
        sessionWindow.webContents.executeJavaScript(`
          alert('⚠️ This chat is locked to another user. You do not have permission to access it. Redirecting to homepage...');
        `);
        return false;
      } else if (chatId && chatLocks.find(l => l.chat_id === chatId)) {
        console.log('✅ [Chat Lock] ALLOWED access to locked chat:', chatId, '- User is owner or admin');
      } else {
        console.log('ℹ️ [Chat Lock] Chat not locked:', chatId);
      }
    } else {
      console.log('ℹ️ No chat ID extracted from URL');
    }
    return true;
  };

  // Prevent navigation to external domains (full page navigation)
  sessionWindow.webContents.on('will-navigate', (event, url) => {
    console.log('=== will-navigate event ===');
    console.log('URL:', url);
    console.log('User ID:', userId, '| Role:', userRole);

    // Check chat lock first
    if (!checkChatLock(url, event)) {
      return; // Already blocked by chat lock
    }

    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Admin can navigate freely to any domain (after chat lock check)
    if (userRole === 'admin') {
      return;
    }

    // For users (non-admin), STRICTLY enforce domain restrictions
    // Users can ONLY navigate to domains in allowedDomains list

    // If no domain restrictions set, only allow the login URL domain
    if (!allowedDomains || allowedDomains.length === 0) {
      try {
        const loginUrlObj = new URL(loginUrl);
        const loginHostname = loginUrlObj.hostname;

        if (hostname === loginHostname || hostname.endsWith(`.${loginHostname}`)) {
          return;
        }
      } catch (e) {
        console.error('Error parsing login URL:', e);
      }

      // Block and redirect
      console.log('Prevented navigation to:', hostname, '(user restricted, no allowed domains)');
      event.preventDefault();
      sessionWindow.loadURL(loginUrl);
      return;
    }

    // Check if domain is in allowed list for users
    const isAllowed = allowedDomains.some(domain => {
      return hostname === domain || hostname.endsWith(`.${domain}`);
    });

    if (!isAllowed) {
      console.log('Prevented navigation to:', hostname, '- User restricted to:', allowedDomains.join(', '));
      event.preventDefault();
      sessionWindow.loadURL(loginUrl);
    }
  });

  // Handle in-page navigation (SPA routing - for Gemini, ChatGPT, etc.)
  sessionWindow.webContents.on('did-navigate-in-page', (event, url, isMainFrame) => {
    if (!isMainFrame) return; // Only check main frame

    console.log('=== did-navigate-in-page event ===');
    console.log('URL:', url);

    // Check chat lock for SPA navigation
    checkChatLock(url);
  });

  // Also check on page load
  sessionWindow.webContents.on('did-finish-load', () => {
    const currentUrl = sessionWindow.webContents.getURL();
    console.log('=== did-finish-load event ===');
    console.log('URL:', currentUrl);

    // Check chat lock
    checkChatLock(currentUrl);
  });

  return sessionWindow;
}

// Create Gemini window following best practices from reference project
function createGeminiWindow() {
  const geminiWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Changed from true - sandbox can cause issues with some sites
      enableRemoteModule: false,
      partition: 'persist:gemini-session' // Use persistent session
    },
    title: 'Gemini AI - Woku App',
    icon: path.join(__dirname, '../assets/images/icon.png'),
    show: false
  });

  // Set User-Agent through session instead of webRequest
  const ses = geminiWindow.webContents.session;
  ses.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

  // Setup security for Gemini domains
  const allowedGeminiDomains = [
    'gemini.google.com',
    'ai.google.dev',
    'accounts.google.com',
    'google.com',
    'gstatic.com'
  ];

  geminiWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      const domain = parsedUrl.hostname.toLowerCase();

      const isAllowed = allowedGeminiDomains.some(allowedDomain =>
        domain === allowedDomain || domain.endsWith('.' + allowedDomain)
      );

      if (!isAllowed) {
        event.preventDefault();
        console.log(`Blocked navigation to: ${navigationUrl}`);
      }
    } catch (error) {
      console.error('Error checking navigation:', error);
    }
  });

  geminiWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsedUrl = new URL(url);
      const domain = parsedUrl.hostname.toLowerCase();

      const isAllowed = allowedGeminiDomains.some(allowedDomain =>
        domain === allowedDomain || domain.endsWith('.' + allowedDomain)
      );

      if (isAllowed) {
        return {
          action: 'allow',
          overrideBrowserWindowOptions: {
            webPreferences: {
              partition: 'persist:gemini-session'
            }
          }
        };
      }
    } catch (error) {
      console.error('Error checking window open:', error);
    }

    return { action: 'deny' };
  });

  geminiWindow.once('ready-to-show', () => {
    geminiWindow.show();
  });

  geminiWindow.loadURL('https://gemini.google.com');

  return geminiWindow;
}

// IPC Handlers
ipcMain.on('create-session-window', (event, accountData) => {
  console.log('📡 [IPC] Received create-session-window request');
  console.log('📡 [IPC] Account data:', JSON.stringify(accountData, null, 2));
  createSessionWindow(accountData);
});

ipcMain.on('create-gemini-window', () => {
  createGeminiWindow();
});

ipcMain.on('close-session-window', (event, accountId) => {
  const sessionWindow = sessionWindows.get(accountId);
  if (sessionWindow && !sessionWindow.isDestroyed()) {
    sessionWindow.close();
  }
  sessionWindows.delete(accountId);
});

ipcMain.on('get-store-value', (event, key) => {
  event.returnValue = store.get(key);
});

ipcMain.on('set-store-value', (event, key, value) => {
  store.set(key, value);
  event.returnValue = true;
});

ipcMain.on('delete-store-value', (event, key) => {
  store.delete(key);
  event.returnValue = true;
});

ipcMain.on('navigate-to-dashboard', () => {
  if (mainWindow) {
    mainWindow.loadFile(path.join(__dirname, '../renderer/dashboard.html'));
  }
});

ipcMain.on('navigate-to-login', () => {
  if (mainWindow) {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
});

// Calls the backend logout endpoint. This is the most critical part for quitting.
async function notifyBackendOfLogout(token) {
  if (!token) return;
  try {
    const axios = require('axios');
    const API_BASE_URL = 'https://db.handymancode.com/api/wokushop-api';
    console.log('🚀 [Quit] Notifying backend to terminate session...');
    await axios.post(`${API_BASE_URL}/auth/logout.php`, {}, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 2500 // Give it 2.5 seconds to complete
    });
    console.log('✅ [Quit] Backend session termination request sent.');
  } catch (apiError) {
    console.error('❌ [Quit] Failed to notify backend of logout:', apiError.message);
  }
}

// Centralized logout function for UI-triggered logout
async function performUICleanup() {
  console.log('🧹 [Cleanup] Performing local UI cleanup...');
  stopHeartbeat();

  // Close all session windows
  sessionWindows.forEach(win => {
    if (win && !win.isDestroyed()) win.close();
  });
  sessionWindows.clear();

  // Clear local data
  store.delete('authToken');
  store.delete('currentUser');
  console.log('✅ [Cleanup] Local data cleared.');
}

// ========================================
// SESSION HEARTBEAT
// ========================================
let heartbeatInterval = null;

function startHeartbeat() {
  // Stop any existing heartbeat
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  console.log('❤️ [Heartbeat] Starting session heartbeat every 30 seconds.');

  heartbeatInterval = setInterval(async () => {
    const authToken = store.get('authToken');
    if (!authToken) {
      console.log('💔 [Heartbeat] No auth token, stopping heartbeat.');
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
      return;
    }

    try {
      const axios = require('axios');
      const API_BASE_URL = 'https://db.handymancode.com/api/wokushop-api';
      await axios.post(`${API_BASE_URL}/auth/heartbeat.php`, {}, {
        headers: { 'Authorization': `Bearer ${authToken}` },
        timeout: 5000
      });
      console.log('❤️ [Heartbeat] Session pulse sent successfully.');
    } catch (error) {
      console.error('❌ [Heartbeat] Failed to send heartbeat:', error.message);
      // If token is invalid (e.g., 401, 403), stop the heartbeat
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        console.log('🛑 [Heartbeat] Invalid session, stopping heartbeat.');
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    }
  }, 30000); // Send heartbeat every 30 seconds
}

// Stop heartbeat on logout
function stopHeartbeat() {
  if (heartbeatInterval) {
    console.log('💔 [Heartbeat] Stopping session heartbeat.');
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}


ipcMain.on('logout', async () => {
  const token = store.get('authToken');
  await notifyBackendOfLogout(token);
  await performUICleanup();

  // Navigate to login screen
  if (mainWindow) {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
});

// Session Management IPC Handlers
ipcMain.handle('backup-session', async (event, accountId, partitionId) => {
  try {
    console.log('📡 [IPC] Received backup-session request');
    console.log('📋 [IPC] Account ID:', accountId, '| Partition ID:', partitionId);

    const result = await sessionManager.backupAndUpload(accountId, partitionId);

    console.log('✅ [IPC] Backup successful:', result);
    return {
      success: true,
      message: 'Session backed up successfully',
      data: result
    };
  } catch (error) {
    console.error('❌ [IPC] Backup failed:', error.message);
    return {
      success: false,
      message: error.message || 'Failed to backup session'
    };
  }
});

ipcMain.handle('restore-session', async (event, accountId, partitionId) => {
  try {
    console.log('📡 [IPC] Received restore-session request');
    console.log('📋 [IPC] Account ID:', accountId, '| Partition ID:', partitionId);

    const result = await sessionManager.downloadAndRestore(accountId, partitionId);

    console.log('✅ [IPC] Restore successful:', result);
    return {
      success: true,
      message: 'Session restored successfully. Please reopen the account.',
      data: { partition_path: result }
    };
  } catch (error) {
    console.error('❌ [IPC] Restore failed:', error.message);
    return {
      success: false,
      message: error.message || 'Failed to restore session'
    };
  }
});

// Enhanced Gemini Restore IPC Handler
ipcMain.handle('enhanced-gemini-restore', async (event, accountId, partitionId) => {
  try {
    console.log('📡 [IPC] Enhanced Gemini restore request');
    console.log('📋 [IPC] Account ID:', accountId, '| Partition ID:', partitionId);

    const result = await sessionManager.enhancedGeminiRestore(accountId, partitionId);
    console.log('✅ [IPC] Enhanced Gemini restore completed:', result);

    return result;
  } catch (error) {
    console.error('❌ [IPC] Enhanced Gemini restore failed:', error.message);
    return {
      success: false,
      message: error.message || 'Failed to perform enhanced Gemini restore'
    };
  }
});

// Session Sync IPC Handlers
ipcMain.handle('session-sync-login', async (event, user, authToken) => {
  try {
    console.log('📡 [IPC] Session sync login for user:', user.username);
    await sessionSyncManager.onLogin(user, authToken);

    // Start the session heartbeat after successful login
    startHeartbeat();

    return { success: true, message: 'Session sync login successful' };
  } catch (error) {
    console.error('❌ [IPC] Session sync login failed:', error.message);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('session-sync-up', async (event) => {
  try {
    console.log('📡 [IPC] Session sync up request');
    const result = await sessionSyncManager.syncUp();
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ [IPC] Session sync up failed:', error.message);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('session-sync-down', async (event) => {
  try {
    console.log('📡 [IPC] Session sync down request');
    const result = await sessionSyncManager.syncDown();
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ [IPC] Session sync down failed:', error.message);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('session-validate', async (event) => {
  try {
    console.log('📡 [IPC] Session validation request');
    const result = await sessionSyncManager.validateSession();
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ [IPC] Session validation failed:', error.message);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('session-full-sync', async (event) => {
  try {
    console.log('📡 [IPC] Full session sync request');
    const result = await sessionSyncManager.fullSync();
    return { success: true, data: result };
  } catch (error) {
    console.error('❌ [IPC] Full session sync failed:', error.message);
    return { success: false, message: error.message };
  }
});

// Auto-Restore Session IPC Handlers
ipcMain.handle('check-partition-data', async (event, partitionId) => {
  try {
    console.log('📡 [IPC] Check partition data for:', partitionId);
    const hasData = sessionManager.hasSessionData(partitionId);
    console.log('📡 [IPC] Partition has data:', hasData);
    return hasData;
  } catch (error) {
    console.error('❌ [IPC] Check partition data failed:', error.message);
    return false;
  }
});

ipcMain.handle('check-backup-available', async (event, accountId) => {
  try {
    console.log('📡 [IPC] Check backup available for account:', accountId);
    const hasBackup = await sessionManager.hasBackupAvailable(accountId);
    console.log('📡 [IPC] Backup available:', hasBackup);
    return hasBackup;
  } catch (error) {
    console.error('❌ [IPC] Check backup available failed:', error.message);
    return false;
  }
});

ipcMain.handle('auto-restore-session', async (event, accountId, partitionId) => {
  try {
    console.log('📡 [IPC] Auto-restore session for account:', accountId, 'partition:', partitionId);
    const result = await sessionManager.downloadAndRestore(accountId, partitionId);
    console.log('✅ [IPC] Auto-restore completed:', result);
    return { success: true, path: result };
  } catch (error) {
    console.error('❌ [IPC] Auto-restore failed:', error.message);
    throw error; // Re-throw to let the renderer handle it
  }
});

// Cookie Sync IPC Handlers
ipcMain.handle('save-cookies-to-db', async (event, accountId, partitionId) => {
  try {
    console.log('📡 [IPC] Save cookies for account:', accountId, 'partition:', partitionId);

    const ses = session.fromPartition(`persist:${partitionId}`);
    const cookies = await ses.cookies.get({});

    console.log('📊 [IPC] Extracted', cookies.length, 'cookies from session');

    // Get auth token from store
    const authToken = store.get('authToken');
    if (!authToken) {
      throw new Error('No auth token found');
    }

    // Save to database via API
    const axios = require('axios');
    const response = await axios.post('https://db.handymancode.com/api/wokushop-api/cookies/save.php', {
      account_id: accountId,
      cookies: cookies
    }, {
      headers: {
        'X-Auth-Token': authToken,
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (response.data.success) {
      console.log('✅ [IPC] Cookies saved to database successfully');
      return { success: true, count: cookies.length };
    } else {
      throw new Error(response.data.message || 'Failed to save cookies');
    }
  } catch (error) {
    console.error('❌ [IPC] Save cookies failed:', error.message);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('restore-cookies-from-db', async (event, accountId, partitionId) => {
  try {
    console.log('📡 [IPC] Restore cookies for account:', accountId, 'partition:', partitionId);

    // Get auth token from store
    const authToken = store.get('authToken');
    if (!authToken) {
      throw new Error('No auth token found');
    }

    // Get cookies from database via API
    const axios = require('axios');
    const response = await axios.get(`https://db.handymancode.com/api/wokushop-api/cookies/get.php?account_id=${accountId}`, {
      headers: {
        'X-Auth-Token': authToken,
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.data.success || !response.data.cookies) {
      console.log('ℹ️ [IPC] No cookies found in database for account:', accountId);
      return { success: false, message: 'No cookies found' };
    }

    const cookies = response.data.cookies;
    console.log('📊 [IPC] Retrieved', cookies.length, 'cookies from database');

    // Inject cookies into session
    const ses = session.fromPartition(`persist:${partitionId}`);

    let successCount = 0;
    for (const cookie of cookies) {
      try {
        // Prepare cookie for injection
        const cookieDetails = {
          url: `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`,
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path,
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          expirationDate: cookie.expirationDate
        };

        await ses.cookies.set(cookieDetails);
        successCount++;
      } catch (cookieError) {
        console.warn('⚠️ [IPC] Failed to set cookie:', cookie.name, cookieError.message);
      }
    }

    console.log('✅ [IPC] Injected', successCount, '/', cookies.length, 'cookies into session');
    return { success: true, count: successCount, total: cookies.length };
  } catch (error) {
    console.error('❌ [IPC] Restore cookies failed:', error.message);
    return { success: false, message: error.message };
  }
});

// App lifecycle events
app.whenReady().then(() => {
  createMainWindow();

  // Check for updates only when the app is packaged
  if (!isDev) {
    // Lazily set up auto-updater; if the module is missing, this will fail silently (caught inside)
    setupAutoUpdater();
    if (autoUpdater && autoUpdater.checkForUpdatesAndNotify) {
      try {
    log.info('Checking for updates...');
    autoUpdater.checkForUpdatesAndNotify();
      } catch (error) {
        log.error('Failed to check for updates:', error.message);
      }
  } else {
      log.warn('Auto-updater unavailable or not configured; skipping update check');
    }
  }
});

// ========================================
// APP QUIT HANDLER - AUTO LOGOUT
// ========================================
let isQuitting = false;

app.on('before-quit', async (event) => {
  // Only run once
  if (isQuitting) return;

  // Prevent immediate quit so we can cleanup
  event.preventDefault();
  isQuitting = true;

  console.log('🚪 [App Quit] User is closing the app. Performing auto-logout...');

  try {
    // Get auth token before cleanup
    const token = store.get('authToken');

    // Notify backend of logout
    if (token) {
      await notifyBackendOfLogout(token);
    }

    // Perform UI cleanup
    await performUICleanup();

    console.log('✅ [App Quit] Auto-logout completed successfully.');
  } catch (error) {
    console.error('❌ [App Quit] Error during auto-logout:', error);
  } finally {
    // Now allow the app to quit
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// ========================================
// AUTO DEPLOYMENT IPC HANDLERS
// ========================================

// Get saved deployment config
ipcMain.handle('deployment-get-config', async () => {
  try {
    if (!deploymentManager) {
      return {
        success: false,
        error: 'Auto deployment feature not available (missing dependencies)'
      };
    }
    return {
      success: true,
      config: deploymentManager.getSavedConfig()
    };
  } catch (error) {
    return {
      success: false,


      error: error.message
    };
  }
});

// Start deployment
ipcMain.handle('deployment-start', async (event, config) => {
  try {
    if (!deploymentManager) {
      return {


        success: false,
        error: 'Auto deployment feature not available (missing dependencies)'
      };
    }

    console.log('🚀 [Deployment] Starting deployment with config:', {
      host: config.host,
      username: config.username,
      remotePath: config.remotePath
    });

    // Setup progress callback























    const progressCallback = (progress, status) => {



      event.sender.send('deployment-progress', { progress, status });
    };

    // Setup log callback
    deploymentManager.onLogUpdate = (logEntry) => {
      event.sender.send('deployment-log', logEntry);
    };

    const result = await deploymentManager.deploy(config, progressCallback);

    console.log('✅ [Deployment] Deployment completed:', result.success ? 'SUCCESS' : 'FAILED');

    return result;

  } catch (error) {
    console.error('❌ [Deployment] Deployment error:', error);
    return {
      success: false,
      error: error.message,
      log: deploymentManager ? deploymentManager.getDeploymentLog() : []
    };
  }
});

// Check deployment status
ipcMain.handle('deployment-status', async () => {
  if (!deploymentManager) {
    return {
      inProgress: false,
      log: [],
      error: 'Auto deployment feature not available (missing dependencies)'
    };
  }
  return {
    inProgress: deploymentManager.isDeploymentInProgress(),
    log: deploymentManager.getDeploymentLog()
  };
});

// Test SSH connection
ipcMain.handle('deployment-test-connection', async (event, config) => {
  try {
    if (!AutoDeploymentManager) {
      return {
        success: false,
        error: 'Auto deployment feature not available (missing dependencies)'
      };
    }
    const testManager = new AutoDeploymentManager();
    await testManager.connectSSH(config);
    testManager.ssh.end();

    return {
      success: true,
      message: 'SSH connection successful'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

// Handle app errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
