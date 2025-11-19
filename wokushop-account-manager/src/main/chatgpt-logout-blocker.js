/**
 * ChatGPT Logout Blocker - Prevent JavaScript-based logout
 * Inject this into ChatGPT sessions to block logout attempts
 */

(function() {
  'use strict';

  console.log('[ChatGPT Logout Blocker] Initializing...');

  // Configuration
  const CONFIG = {
    blockLogout: true,
    showWarnings: false,
    redirectHome: 'https://chat.openai.com'
  };

  /**
   * Block logout button clicks
   */
  function blockLogoutButtons() {
    // Common logout selectors for ChatGPT
    const logoutSelectors = [
      'button[data-testid*="logout"]',
      'button[data-testid*="signout"]',
      'button[data-testid*="sign-out"]',
      '[role="button"]:has-text("Log out")',
      '[role="button"]:has-text("Sign out")',
      'a[href*="logout"]',
      'a[href*="signout"]',
      'button:contains("Log out")',
      'button:contains("Sign out")',
      '.logout-button',
      '.signout-button'
    ];

    logoutSelectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
          // Remove existing click handlers
          element.onclick = null;
          element.removeAttribute('href');

          // Add our blocking handler
          element.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            console.log('🚫 [ChatGPT Logout Blocker] Blocked logout button click');

            if (CONFIG.showWarnings) {
              // Show user-friendly message
              showLogoutBlockedMessage();
            }

            return false;
          }, true);

          // Visual indicator that logout is blocked
          element.style.opacity = '0.5';
          element.style.cursor = 'not-allowed';
          element.title = 'Logout is disabled for shared accounts';

          console.log('[ChatGPT Logout Blocker] 🔒 Blocked logout element:', selector);
        });
      } catch (e) {
        // Ignore errors for selectors that don't exist
      }
    });
  }

  /**
   * Show user-friendly message when logout is blocked
   */
  function showLogoutBlockedMessage() {
    // Create notification element
    const notification = document.createElement('div');
    notification.innerHTML = `
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
        Logout is not allowed for shared accounts. Contact admin if you need assistance.
      </div>
    `;

    document.body.appendChild(notification);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  /**
   * Override logout-related JavaScript functions
   */
  function overrideLogoutFunctions() {
    // Override common logout functions
    if (window.logout) {
      window.logout = function() {
        console.log('🚫 [ChatGPT Logout Blocker] Blocked window.logout()');
        showLogoutBlockedMessage();
        return false;
      };
    }

    if (window.signOut) {
      window.signOut = function() {
        console.log('🚫 [ChatGPT Logout Blocker] Blocked window.signOut()');
        showLogoutBlockedMessage();
        return false;
      };
    }

    // Block navigation to logout URLs
    const originalAssign = window.location.assign;
    const originalReplace = window.location.replace;

    window.location.assign = function(url) {
      if (url && (url.includes('logout') || url.includes('signout'))) {
        console.log('🚫 [ChatGPT Logout Blocker] Blocked location.assign:', url);
        showLogoutBlockedMessage();
        return;
      }
      return originalAssign.call(this, url);
    };

    window.location.replace = function(url) {
      if (url && (url.includes('logout') || url.includes('signout'))) {
        console.log('🚫 [ChatGPT Logout Blocker] Blocked location.replace:', url);
        showLogoutBlockedMessage();
        return;
      }
      return originalReplace.call(this, url);
    };

    console.log('✅ [ChatGPT Logout Blocker] JavaScript functions overridden');
  }

  /**
   * Monitor for dynamically added logout buttons
   */
  function setupLogoutObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldCheckButtons = false;

      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1) { // Element node
              const text = node.textContent?.toLowerCase() || '';
              if (text.includes('log out') || text.includes('sign out') ||
                  node.querySelector && (
                    node.querySelector('button[data-testid*="logout"]') ||
                    node.querySelector('a[href*="logout"]')
                  )) {
                shouldCheckButtons = true;
                break;
              }
            }
          }
        }
      });

      if (shouldCheckButtons) {
        console.log('[ChatGPT Logout Blocker] 🔍 New logout elements detected, applying blocks...');
        setTimeout(blockLogoutButtons, 100);
      }
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('✅ [ChatGPT Logout Blocker] Mutation observer active');
  }

  /**
   * Initialize the logout blocker
   */
  function init() {
    console.log('🔒 [ChatGPT Logout Blocker] Starting initialization...');
    console.log('🌐 [ChatGPT Logout Blocker] URL:', window.location.href);

    // Override JavaScript logout functions
    overrideLogoutFunctions();

    // Block existing logout buttons
    blockLogoutButtons();

    // Monitor for new logout buttons
    setupLogoutObserver();

    // Recheck logout buttons every 5 seconds
    setInterval(blockLogoutButtons, 5000);

    console.log('✅ [ChatGPT Logout Blocker] Initialization complete!');
    console.log('🛡️ [ChatGPT Logout Blocker] ChatGPT logout protection active');
  }

  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also run after a short delay to catch late-loading elements
  setTimeout(init, 2000);

  // Expose to global scope for debugging
  window.ChatGPTLogoutBlocker = {
    block: blockLogoutButtons,
    config: CONFIG,
    showMessage: showLogoutBlockedMessage
  };

})();