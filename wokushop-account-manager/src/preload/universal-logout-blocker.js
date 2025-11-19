/**
 * Universal Logout Blocker - Preload Script
 * This runs BEFORE any page scripts, ensuring maximum blocking effectiveness
 */

(function() {
  'use strict';

  console.log('🔒 [Universal Logout Blocker] Initializing EARLY via preload...');

  const logoutPatterns = ['logout', 'signout', 'sign-out', 'log-out', 'sign_out', 'log_out'];

  // Show notification when logout is blocked
  function showLogoutBlockedMessage() {
    try {
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
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          font-size: 14px;
          max-width: 300px;
          animation: slideIn 0.3s ease-out;
        ">
          <strong>🔒 Logout Disabled</strong><br>
          Logout is not allowed for shared accounts.
        </div>
      `;
      document.body.appendChild(notification);
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 5000);
    } catch (e) {
      console.log('🚫 [Logout Blocker] Blocked logout attempt');
    }
  }

  // Check if URL/text contains logout patterns
  function containsLogoutPattern(str) {
    if (!str) return false;
    const lowerStr = str.toLowerCase();
    return logoutPatterns.some(pattern => lowerStr.includes(pattern));
  }

  // ========================================
  // 1. BLOCK FETCH API
  // ========================================
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    const urlStr = typeof url === 'string' ? url : url?.url || '';

    if (containsLogoutPattern(urlStr)) {
      console.log('🚫 [Logout Blocker] BLOCKED fetch to:', urlStr);
      showLogoutBlockedMessage();
      return Promise.reject(new Error('Logout blocked by security policy'));
    }

    return originalFetch.apply(this, args);
  };

  // ========================================
  // 2. BLOCK XMLHttpRequest
  // ========================================
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    if (containsLogoutPattern(url)) {
      console.log('🚫 [Logout Blocker] BLOCKED XHR to:', url);
      showLogoutBlockedMessage();
      throw new Error('Logout blocked by security policy');
    }
    return originalXHROpen.call(this, method, url, ...rest);
  };

  // ========================================
  // 3. BLOCK WINDOW.LOCATION CHANGES
  // ========================================
  const originalAssign = window.location.assign;
  const originalReplace = window.location.replace;

  window.location.assign = function(url) {
    if (containsLogoutPattern(url)) {
      console.log('🚫 [Logout Blocker] BLOCKED location.assign:', url);
      showLogoutBlockedMessage();
      return;
    }
    return originalAssign.call(this, url);
  };

  window.location.replace = function(url) {
    if (containsLogoutPattern(url)) {
      console.log('🚫 [Logout Blocker] BLOCKED location.replace:', url);
      showLogoutBlockedMessage();
      return;
    }
    return originalReplace.call(this, url);
  };

  // Block window.location.href setter
  const originalHrefDescriptor = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
  Object.defineProperty(Location.prototype, 'href', {
    set: function(url) {
      if (containsLogoutPattern(url)) {
        console.log('🚫 [Logout Blocker] BLOCKED location.href:', url);
        showLogoutBlockedMessage();
        return;
      }
      if (originalHrefDescriptor && originalHrefDescriptor.set) {
        originalHrefDescriptor.set.call(this, url);
      }
    },
    get: function() {
      if (originalHrefDescriptor && originalHrefDescriptor.get) {
        return originalHrefDescriptor.get.call(this);
      }
      return '';
    }
  });

  // ========================================
  // 4. BLOCK LOGOUT FUNCTIONS
  // ========================================
  const functionBlocker = {
    apply: function(target, thisArg, args) {
      console.log('🚫 [Logout Blocker] BLOCKED logout function call');
      showLogoutBlockedMessage();
      return false;
    }
  };

  // Override common logout function names
  Object.defineProperty(window, 'logout', {
    set: function() {},
    get: function() { return new Proxy(function(){}, functionBlocker); }
  });

  Object.defineProperty(window, 'signOut', {


    set: function() {},
    get: function() { return new Proxy(function(){}, functionBlocker); }
  });

  Object.defineProperty(window, 'signout', {
    set: function() {},
    get: function() { return new Proxy(function(){}, functionBlocker); }
  });

  // ========================================
  // 5. BLOCK FORM SUBMISSIONS
  // ========================================
  document.addEventListener('submit', function(e) {
    const form = e.target;
    const action = form.action || '';

    if (containsLogoutPattern(action)) {
      console.log('🚫 [Logout Blocker] BLOCKED form submission to:', action);
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      showLogoutBlockedMessage();
      return false;
    }
  }, true);

  // ========================================
  // 6. BLOCK CLICK EVENTS ON LOGOUT ELEMENTS
  // ========================================
  function blockLogoutClicks() {
    document.addEventListener('click', function(e) {
      let target = e.target;

      // Check up to 5 parent levels
      for (let i = 0; i < 5 && target; i++) {
        const text = target.textContent?.toLowerCase() || '';
        const href = target.getAttribute?.('href')?.toLowerCase() || '';
        const className = target.className?.toLowerCase?.() || '';
        const id = target.id?.toLowerCase() || '';

        if (containsLogoutPattern(text) ||
            containsLogoutPattern(href) ||
            containsLogoutPattern(className) ||
            containsLogoutPattern(id)) {

          console.log('🚫 [Logout Blocker] BLOCKED click on logout element:', target.tagName);
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          showLogoutBlockedMessage();
          return false;
        }

        target = target.parentElement;
      }
    }, true); // Use capture phase for highest priority
  }

  // ========================================
  // 7. HIDE AND DISABLE LOGOUT ELEMENTS
  // ========================================
  function hideLogoutElements() {
    try {
      const selectors = [
        'a[href*="logout"]',
        'a[href*="signout"]',
        'button[class*="logout"]',
        'button[class*="signout"]',
        '[data-testid*="logout"]',
        '[data-testid*="signout"]',
        '[id*="logout"]',
        '[id*="signout"]'
      ];

      selectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          if (!el.dataset.logoutBlocked) {
            el.addEventListener('click', function(e) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
              showLogoutBlockedMessage();
              return false;
            }, true);

            el.style.opacity = '0.3';
            el.style.pointerEvents = 'none';
            el.style.cursor = 'not-allowed';
            el.title = 'Logout disabled';

            if (el.tagName === 'A') {
              el.removeAttribute('href');
              el.setAttribute('href', 'javascript:void(0)');
            }

            el.dataset.logoutBlocked = 'true';
            console.log('🔒 [Logout Blocker] Disabled element:', el.tagName, selector);
          }
        });
      });

      // Also check by text content
      const allClickable = document.querySelectorAll('a, button, [role="button"], [role="menuitem"]');
      allClickable.forEach(el => {
        const text = el.textContent?.toLowerCase() || '';
        if (containsLogoutPattern(text) && !el.dataset.logoutBlocked) {
          el.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            showLogoutBlockedMessage();
            return false;
          }, true);

          el.style.opacity = '0.3';
          el.style.pointerEvents = 'none';
          el.dataset.logoutBlocked = 'true';
        }
      });
    } catch (e) {
      // Ignore errors if DOM not ready
    }
  }

  // ========================================
  // 8. INITIALIZE
  // ========================================

  // Block clicks immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', blockLogoutClicks);
  } else {
    blockLogoutClicks();
  }

  // Hide elements when DOM is ready
  function initHiding() {
    hideLogoutElements();

    const observer = new MutationObserver(hideLogoutElements);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    setInterval(hideLogoutElements, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHiding);
  } else {
    setTimeout(initHiding, 100);
  }

  console.log('✅ [Universal Logout Blocker] All protection layers active!');
  console.log('🛡️ [Logout Blocker] Protected: fetch, XHR, location, forms, clicks, functions');

})();
