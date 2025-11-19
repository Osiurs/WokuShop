/**
 * Enhanced YouTube Ad Blocker - Ultimate Version
 * Comprehensive ad-blocking with modern YouTube support
 */

(function() {
  'use strict';

  console.log('🛡️ [Enhanced YouTube Ad Blocker] Initializing...');

  // Configuration
  const CONFIG = {
    checkInterval: 50, // Even faster - every 50ms
    aggressiveMode: true,
    debugMode: true,
    skipButtonSelectors: [
      // 2024-2025 YouTube selectors
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-modern',
      '.ytp-skip-ad-button',
      'button.ytp-ad-skip-button-container',
      '.ytp-ad-skip-button-slot',
      '.ytp-skip-ad-button__text',
      '.ytp-ad-skip-button-text',
      'button[class*="skip"]',
      'button[class*="ad-skip"]',
      'button[aria-label*="Skip"]',
      'button[aria-label*="Bỏ qua"]',

      // New 2025 patterns
      '.yt-spec-button-shape-next--size-m[aria-label*="Skip"]',
      'button[data-purpose*="skip"]',
      'button.ytp-ad-overlay-close-button',
      '.ytp-ad-overlay .ytp-ad-button'
    ],
    adIndicatorSelectors: [
      '.ad-showing',
      '.video-ads',
      '.ytp-ad-player-overlay',
      '.ytp-ad-text',
      '.ytp-ad-preview-container',
      '.ytp-ad-overlay-container',
      '.ytp-ad-module',
      '.ytd-display-ad-renderer',
      '.ytd-promoted-sparkles-text-search-renderer',

      // New patterns
      '[class*="ad-container"]',
      '[id*="ad-container"]',
      '.masthead-ad-control',
      '.ytd-compact-promoted-item-renderer'
    ],
    adContainerSelectors: [
      '.ytp-ad-overlay-container',
      '.ytp-ad-text-overlay',
      '.ytd-display-ad-renderer',
      '.ytd-promoted-sparkles-web-renderer',
      '.ytd-compact-promoted-item-renderer',
      '.ytd-in-feed-ad-layout-renderer',
      '.googima-ad-div',
      '.video-ads',

      // Aggressive patterns
      'div[id*="google_ads"]',
      'div[class*="GoogleActiveViewClass"]',
      'iframe[src*="doubleclick"]',
      'iframe[src*="googlesyndication"]'
    ]
  };

  let stats = {
    adsSkipped: 0,
    adsBlocked: 0,
    containersRemoved: 0,
    lastAdTime: 0
  };

  /**
   * Enhanced ad detection with multiple methods
   */
  function isAdPlaying() {
    const video = document.querySelector('video');
    if (!video) return false;

    // Method 1: Player class detection
    const player = document.querySelector('.html5-video-player');
    if (player) {
      for (const selector of CONFIG.adIndicatorSelectors) {
        if (player.querySelector(selector) || player.classList.contains(selector.replace('.', ''))) {
          return true;
        }
      }
    }

    // Method 2: Ad overlay detection
    for (const selector of CONFIG.adIndicatorSelectors) {
      if (document.querySelector(selector)) {
        return true;
      }
    }

    // Method 3: Video URL analysis (backup)
    if (video.src && video.src.includes('googleads')) {
      return true;
    }

    // Method 4: Timeline analysis
    const timeDisplay = document.querySelector('.ytp-time-display');
    if (timeDisplay && timeDisplay.textContent.includes('Ad')) {
      return true;
    }

    return false;
  }

  /**
   * Enhanced skip button detection and clicking
   */
  function clickSkipButton() {
    let clicked = false;

    // Method 1: Specific selectors
    for (const selector of CONFIG.skipButtonSelectors) {
      const buttons = document.querySelectorAll(selector);
      buttons.forEach(button => {
        if (button && button.offsetParent !== null && !button.disabled) {
          try {
            console.log('🎯 [Enhanced AdBlock] Found skip button:', selector);

            // Multiple click methods for reliability
            button.click();
            button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

            stats.adsSkipped++;
            stats.lastAdTime = Date.now();
            clicked = true;

            console.log('✅ [Enhanced AdBlock] Clicked skip button! Total:', stats.adsSkipped);
          } catch (e) {
            console.error('[Enhanced AdBlock] Click error:', e);
          }
        }
      });
    }

    // Method 2: Text-based detection (more reliable)
    const allClickables = document.querySelectorAll('button, a, div[role="button"], span[role="button"]');
    allClickables.forEach(element => {
      const text = (element.textContent || element.innerText || '').toLowerCase().trim();
      const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();

      if ((text.includes('skip') || text.includes('bỏ qua') ||
           ariaLabel.includes('skip') || ariaLabel.includes('bỏ qua')) &&
          element.offsetParent !== null && !element.disabled) {

        try {
          console.log('🎯 [Enhanced AdBlock] Found skip by text:', text || ariaLabel);
          element.click();
          element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          stats.adsSkipped++;
          clicked = true;
        } catch (e) {
          // Continue to next
        }
      }
    });

    return clicked;
  }

  /**
   * Aggressive ad container removal
   */
  function removeAdContainers() {
    let removed = 0;

    CONFIG.adContainerSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        if (element && element.parentNode) {
          try {
            // Check if it's actually an ad
            const content = element.textContent?.toLowerCase() || '';
            const classes = element.className?.toLowerCase() || '';

            if (content.includes('ad') || classes.includes('ad') ||
                selector.includes('ad') || element.querySelector('[id*="google"]')) {

              element.remove();
              removed++;
              stats.containersRemoved++;

              console.log('🗑️ [Enhanced AdBlock] Removed ad container:', selector);
            }
          } catch (e) {
            // Continue
          }
        }
      });
    });

    return removed;
  }

  /**
   * Video seek past ads (when skip button unavailable)
   */
  function seekPastAd() {
    const video = document.querySelector('video');
    if (!video || !isAdPlaying()) return false;

    try {
      const duration = video.duration;
      const currentTime = video.currentTime;

      // If ad is short (< 30 seconds), try to seek past it
      if (duration && duration < 30 && duration !== Infinity) {
        console.log('⏩ [Enhanced AdBlock] Attempting to seek past short ad...');
        video.currentTime = Math.min(duration - 0.1, currentTime + 15);
        return true;
      }

      // For longer ads, try small increments
      if (duration && currentTime < duration - 5) {
        video.currentTime = currentTime + 5;
        console.log('⏩ [Enhanced AdBlock] Incremental seek past ad...');
        return true;
      }
    } catch (e) {
      console.error('[Enhanced AdBlock] Seek error:', e);
    }

    return false;
  }

  /**
   * Mute ads and speed them up
   */
  function processAdVideo() {
    const video = document.querySelector('video');
    if (!video || !isAdPlaying()) return;

    try {
      // Mute ad
      if (!video.muted) {
        video.muted = true;
        video.volume = 0;
        console.log('🔇 [Enhanced AdBlock] Muted ad');
      }

      // Speed up ad (when possible)
      if (video.playbackRate < 16) {
        video.playbackRate = 16; // Maximum speed
        console.log('⚡ [Enhanced AdBlock] Speeded up ad to 16x');
      }

      // Try to pause and skip quickly
      setTimeout(() => {
        if (video.paused) {
          video.play();
        }
      }, 100);

    } catch (e) {
      console.error('[Enhanced AdBlock] Video processing error:', e);
    }
  }

  /**
   * Block ad network requests (additional layer)
   */
  function setupNetworkBlocking() {
    // Override XMLHttpRequest for ad domains
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      if (typeof url === 'string') {
        const adDomains = [
          'doubleclick.net',
          'googlesyndication.com',
          'googleadservices.com',
          'youtube.com/api/stats/ads',
          'youtube.com/pagead'
        ];

        if (adDomains.some(domain => url.includes(domain))) {
          console.log('🛑 [Enhanced AdBlock] Blocked ad request:', url.substring(0, 80));
          return; // Block the request
        }
      }
      return originalOpen.apply(this, [method, url, ...args]);
    };

    // Override fetch for ad requests
    const originalFetch = window.fetch;
    window.fetch = function(resource, options) {
      if (typeof resource === 'string') {
        const adPatterns = ['doubleclick', 'googlesyndication', 'googleadservices', '/ads/', '/pagead/'];

        if (adPatterns.some(pattern => resource.includes(pattern))) {
          console.log('🛑 [Enhanced AdBlock] Blocked fetch request:', resource.substring(0, 80));
          return Promise.reject(new Error('Ad request blocked'));
        }
      }
      return originalFetch.apply(this, arguments);
    };

    console.log('✅ [Enhanced AdBlock] Network blocking active');
  }

  /**
   * Main blocking loop - enhanced version
   */
  function performAdBlocking() {
    let actionsThisCycle = 0;

    // 1. Remove ad containers first
    actionsThisCycle += removeAdContainers();

    // 2. Check if ad is playing
    if (isAdPlaying()) {
      console.log('🎬 [Enhanced AdBlock] Ad detected at', new Date().toLocaleTimeString());

      // 3. Process ad video (mute, speed up)
      processAdVideo();

      // 4. Try to click skip button
      if (clickSkipButton()) {
        console.log('✅ [Enhanced AdBlock] Successfully skipped ad');
        actionsThisCycle++;
      } else {
        // 5. If skip not available, try seeking
        if (seekPastAd()) {
          console.log('✅ [Enhanced AdBlock] Seeked past ad');
          actionsThisCycle++;
        }
      }

      stats.adsBlocked++;
    }

    // Debug logging every 10 seconds
    if (CONFIG.debugMode && Date.now() % 10000 < CONFIG.checkInterval) {
      console.log(`📊 [Enhanced AdBlock] Stats - Skipped: ${stats.adsSkipped}, Blocked: ${stats.adsBlocked}, Containers: ${stats.containersRemoved}`);
    }
  }

  /**
   * Enhanced mutation observer for dynamic content
   */
  function setupAdvancedObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;

      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              const nodeText = node.textContent?.toLowerCase() || '';
              const nodeClass = node.className?.toLowerCase() || '';

              // Check for ad-related additions
              if (nodeText.includes('ad') || nodeClass.includes('ad') ||
                  node.querySelector && (
                    node.querySelector('.ytp-ad-skip-button') ||
                    node.querySelector('.video-ads') ||
                    node.querySelector('[id*="google_ads"]')
                  )) {
                shouldCheck = true;
              }
            }
          });
        }

        // Watch for class changes that might indicate ads
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const target = mutation.target;
          if (target.className?.includes('ad')) {
            shouldCheck = true;
          }
        }
      });

      if (shouldCheck) {
        console.log('🔍 [Enhanced AdBlock] DOM changes detected, checking for ads...');
        setTimeout(performAdBlocking, 10);
      }
    });

    // Observe with comprehensive settings
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'src']
    });

    console.log('👁️ [Enhanced AdBlock] Advanced observer active');
  }

  /**
   * Initialize enhanced ad blocker
   */
  function init() {
    console.log('🚀 [Enhanced YouTube Ad Blocker] Starting initialization...');
    console.log('🌐 URL:', window.location.href);
    console.log('⚡ Mode: Aggressive');
    console.log('🕐 Check interval:', CONFIG.checkInterval, 'ms');

    // Setup network blocking
    setupNetworkBlocking();

    // Setup advanced observer
    setupAdvancedObserver();

    // Start main blocking loop
    const intervalId = setInterval(performAdBlocking, CONFIG.checkInterval);
    console.log('⏰ [Enhanced AdBlock] Main loop started (ID:', intervalId, ')');

    // Run initial check
    performAdBlocking();

    // Additional checks at different timings
    setTimeout(performAdBlocking, 500);
    setTimeout(performAdBlocking, 1500);
    setTimeout(performAdBlocking, 3000);

    // Stats reporting
    setInterval(() => {
      console.log('📈 [Enhanced AdBlock] Session stats:', {
        adsSkipped: stats.adsSkipped,
        adsBlocked: stats.adsBlocked,
        containersRemoved: stats.containersRemoved,
        lastAdTime: stats.lastAdTime ? new Date(stats.lastAdTime).toLocaleTimeString() : 'None'
      });
    }, 60000); // Every minute

    console.log('✅ [Enhanced YouTube Ad Blocker] Fully initialized and active!');
  }

  // Start when ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Also run after short delay to catch late-loading content
  setTimeout(init, 1000);
  setTimeout(init, 3000);

  // Expose for debugging
  window.EnhancedYouTubeAdBlocker = {
    stats: () => stats,
    config: CONFIG,
    block: performAdBlocking,
    skipAd: clickSkipButton,
    removeAds: removeAdContainers
  };

  console.log('💪 [Enhanced YouTube Ad Blocker] Ready to fight ads!');

})();