/**
 * Quillbot Logout Blocker - Prevent JavaScript-based logout
 * Inject this into Quillbot sessions to block logout attempts
 * VERSION 2.0 - With localStorage and function call protection
 */

(function() {
  'use strict';

  console.log('🛡️ [Quillbot Logout Blocker v2.0] Initializing...');

  const CONFIG = {
    blockLogout: true,
    showWarnings: false,
  };

  const AUTH_KEYS = ['auth', 'token', 'user', 'jwt', 'session', 'quillbot', 'q_is_premium'];

  function showLogoutBlockedMessage(reason) {
    console.warn(`🚫 [Logout Blocker] Blocked logout attempt. Reason: ${reason}`);
    if (!CONFIG.showWarnings) return;

    let notification = document.getElementById('logout-blocker-notification');
    if (notification) {
        notification.style.display = 'block';
        return;
    }

    notification = document.createElement('div');
    notification.id = 'logout-blocker-notification';
    notification.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        background: #d9534f;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.4);
        z-index: 9999999;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 14px;
        max-width: 320px;
        border-left: 5px solid #c9302c;
        animation: slideInRight 0.5s ease-out;
      ">
        <strong>🔒 Logout Disabled</strong><br>
        Client-side logout has been blocked to protect the shared account.
      </div>
      <style>
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      </style>
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification) {
        notification.style.display = 'none';
      }
    }, 5000);
  }

  // ===========================================
  // 1. STORAGE PROTECTION (CRITICAL)
  // ===========================================
  function protectStorage(storageObj, storageName) {
    const originalRemoveItem = storageObj.removeItem;
    const originalClear = storageObj.clear;

    storageObj.removeItem = function(key) {
      if (typeof key === 'string' && AUTH_KEYS.some(authKey => key.toLowerCase().includes(authKey))) {
        showLogoutBlockedMessage(`Attempt to remove sensitive key '${key}' from ${storageName}`);
        return;
      }
      return originalRemoveItem.apply(this, arguments);
    };

    storageObj.clear = function() {
      showLogoutBlockedMessage(`Attempt to clear ${storageName}`);
      // Instead of blocking completely, we selectively remove non-auth keys
      console.warn(`[Logout Blocker] Intercepted ${storageName}.clear(). Performing safe clear.`);
      for (let i = this.length - 1; i >= 0; i--) {
        const key = this.key(i);
        if (typeof key === 'string' && !AUTH_KEYS.some(authKey => key.toLowerCase().includes(authKey))) {
            originalRemoveItem.call(this, key);
        }
      }
    };

    console.log(`✅ [Quillbot Logout Blocker] ${storageName} protection is active.`);
  }

  // Protect localStorage and sessionStorage directly
  protectStorage(window.localStorage, 'localStorage');
  protectStorage(window.sessionStorage, 'sessionStorage');

  // ===========================================
  // 2. CLICK & EVENT BLOCKING
  // ===========================================
  function blockLogoutEvents() {
    const logoutSelectors = [
      'button[data-cy*="logout"]', '[data-cy*="signout"]',
      '[role="menuitem"]:has-text("Log Out")', '[role="menuitem"]:has-text("Sign Out")',
      'a[href*="logout"]', 'a[href*="signout"]',
      'button:contains("Log out")', 'button:contains("Sign out")',
      '[id*="logout"]', '[id*="signout"]',
      '[class*="logout"]', '[class*="signout"]',
      '[aria-label*="Logout"]', '[aria-label*="Sign out"]',
      // Generic selectors
      '[data-testid*="logout"]', '[data-testid*="sign-out"]',
      'div:has(> svg[data-icon*="logout"])',
    ];

    const blockEventHandler = function(e) {
        let target = e.target;
        for (let i = 0; i < 5 && target && target.matches; i++) {
            try {
                if (logoutSelectors.some(selector => target.matches(selector))) {
                    showLogoutBlockedMessage(`Blocked event on element matching '${selector}'`);
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                }
                const text = target.textContent?.toLowerCase() || '';
                if (text.includes('log out') || text.includes('sign out') || text.includes('đăng xuất')) {
                    showLogoutBlockedMessage('Blocked event on element with logout text');
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                }
            } catch (err) { /* ignore invalid selectors */ }
            target = target.parentElement;
        }
    };

    // Listen to multiple events on the capture phase to be first
    ['click', 'mousedown', 'pointerdown', 'submit'].forEach(eventType => {
        document.addEventListener(eventType, blockEventHandler, { capture: true });
    });

    console.log('✅ [Quillbot Logout Blocker] Aggressive event blocking is active.');
  }

  // ===========================================
  // 3. FUNCTION OVERRIDES
  // ===========================================
  function overrideGlobalFunctions() {
    const functionBlocker = {
      apply: function(target, thisArg, args) {
        showLogoutBlockedMessage(`Blocked call to function ${target.name || '(anonymous)'}`);
        return false;
      }
    };

    const functionsToBlock = ['logout', 'signOut', 'logOut', 'sign_out'];
    functionsToBlock.forEach(funcName => {
      try {
        Object.defineProperty(window, funcName, {
          value: new Proxy(function(){}, functionBlocker),
          writable: false,
          configurable: true
        });
      } catch (e) {}
    });

    console.log('✅ [Quillbot Logout Blocker] Global function overrides are active.');
  }

  // ===========================================
  // 4. HIDE & DISABLE ELEMENTS (VISUAL)
  // ===========================================
  function hideLogoutElements() {
      const selectors = [
        'a[href*="logout"]', 'a[href*="signout"]',
        'button[class*="logout"]', 'button[class*="signout"]',
        '[data-testid*="logout"]', '[data-testid*="signout"]',
        '[id*="logout"]', '[id*="signout"]'
      ];

      const allClickable = document.querySelectorAll('a, button, [role="button"], [role="menuitem"]');

      allClickable.forEach(el => {
        if (el.dataset.logoutBlocked) return;

        const text = el.textContent?.toLowerCase() || '';
        const href = el.getAttribute?.('href')?.toLowerCase() || '';

        if (text.includes('log out') || text.includes('sign out') || href.includes('logout') || href.includes('signout')) {
            el.style.opacity = '0.4';
            el.style.pointerEvents = 'none';
            el.style.cursor = 'not-allowed';
            el.title = 'Logout is disabled for this account.';
            el.dataset.logoutBlocked = 'true';
        }
      });
  }

  // ===========================================
  // 5. HISTORY API OVERRIDE (CRITICAL!)
  // ===========================================
  // Block client-side navigation to login/logout pages
  function overrideHistoryAPI() {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function(state, title, url) {
      const urlString = String(url);
      if (urlString && (urlString.includes('/login') || urlString.includes('/logout') || urlString.includes('/sign-out'))) {
        console.warn('🚫 [Logout Blocker] BLOCKED history.pushState to:', urlString);
        showLogoutBlockedMessage('Client-side navigation to login page blocked');
        return;
      }
      return originalPushState.apply(this, arguments);
    };

    window.history.replaceState = function(state, title, url) {
      const urlString = String(url);
      if (urlString && (urlString.includes('/login') || urlString.includes('/logout') || urlString.includes('/sign-out'))) {
        console.warn('🚫 [Logout Blocker] BLOCKED history.replaceState to:', urlString);
        showLogoutBlockedMessage('Client-side navigation to login page blocked');
        return;
      }
      return originalReplaceState.apply(this, arguments);
    };

    // Monitor popstate events (back/forward navigation)
    window.addEventListener('popstate', function(event) {
      const currentUrl = window.location.href;
      if (currentUrl.includes('/login') || currentUrl.includes('/logout') || currentUrl.includes('/sign-out')) {
        console.warn('🚫 [Logout Blocker] BLOCKED popstate navigation to:', currentUrl);
        showLogoutBlockedMessage('Browser navigation to login page blocked');
        // Immediately navigate back to the home page to prevent the login page from loading
        window.history.pushState({}, '', '/'); 
      }
    }, true); // Use capture phase

    console.log('✅ [Quillbot Logout Blocker] History API protection is active.');
  }

  // ===========================================
  // INITIALIZATION
  // ===========================================
  function init() {
    overrideGlobalFunctions();
    blockLogoutEvents();
    overrideHistoryAPI(); // Add history protection

    // Run visual hiding on DOM ready and periodically
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideLogoutElements);
    } else {
        hideLogoutElements();
    }

    const observer = new MutationObserver(hideLogoutElements);
    observer.observe(document.documentElement, { childList: true, subtree: true });

    setInterval(hideLogoutElements, 2000); // Re-scan periodically

    console.log('🎉 [Quillbot Logout Blocker v2.0] All protection layers are active!');
  }

  init();

})();