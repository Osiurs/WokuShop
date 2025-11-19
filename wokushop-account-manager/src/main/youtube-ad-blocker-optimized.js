/**
 * Optimized YouTube Ad Blocker - Ultra Fast Version
 * Focused on performance and minimal resource usage
 */

(function() {
  'use strict';

  console.log('⚡ [Optimized YouTube Ad Blocker] Initializing...');

  // Optimized configuration for performance
  const CONFIG = {
    checkInterval: 100, // Balanced performance vs responsiveness
    fastMode: true,
    maxRetries: 3,
    // Cached selectors for better performance
    skipSelectors: [
      '.ytp-ad-skip-button',
      '.ytp-skip-ad-button',
      'button[aria-label*="Skip"]',
      'button[class*="skip"]'
    ],
    adSelectors: [
      '.ad-showing',
      '.ytp-ad-player-overlay',
      '.video-ads'
    ]
  };

  let stats = { skipped: 0, blocked: 0 };
  let lastAdCheck = 0;
  let isProcessing = false;

  // Cached DOM elements for performance
  let cachedVideo = null;
  let cachedPlayer = null;
  let cacheTime = 0;

  /**
   * Fast DOM element caching
   */
  function getCachedElements() {
    const now = Date.now();
    if (now - cacheTime > 5000) { // Refresh cache every 5 seconds
      cachedVideo = document.querySelector('video');
      cachedPlayer = document.querySelector('.html5-video-player');
      cacheTime = now;
    }
    return { video: cachedVideo, player: cachedPlayer };
  }

  /**
   * Ultra-fast ad detection
   */
  function isAdPlaying() {
    const { video, player } = getCachedElements();
    if (!video || !player) return false;

    // Fast class-based detection
    for (const selector of CONFIG.adSelectors) {
      if (player.classList.contains(selector.replace('.', '')) || 
          player.querySelector(selector)) {
        return true;
      }
    }

    // Quick URL check
    return video.src && video.src.includes('googleads');
  }

  /**
   * Optimized skip button clicking
   */
  function fastSkipAd() {
    if (isProcessing) return false;
    isProcessing = true;

    try {
      // Use cached selectors for speed
      for (const selector of CONFIG.skipSelectors) {
        const button = document.querySelector(selector);
        if (button && button.offsetParent && !button.disabled) {
          button.click();
          stats.skipped++;
          console.log('⚡ [Optimized] Skipped ad instantly!');
          return true;
        }
      }

      // Fast text-based fallback
      const skipButtons = document.querySelectorAll('button, [role="button"]');
      for (const btn of skipButtons) {
        const text = (btn.textContent || '').toLowerCase();
        if ((text.includes('skip') || text.includes('bỏ qua')) && 
            btn.offsetParent && !btn.disabled) {
          btn.click();
          stats.skipped++;
          return true;
        }
      }
    } finally {
      isProcessing = false;
    }
    return false;
  }

  /**
   * Fast ad container removal
   */
  function removeAdContainers() {
    const adContainers = [
      '.ytp-ad-overlay-container',
      '.ytd-display-ad-renderer',
      '.video-ads'
    ];

    let removed = 0;
    for (const selector of adContainers) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (el.parentNode) {
          el.remove();
          removed++;
        }
      }
    }
    
    if (removed > 0) {
      stats.blocked += removed;
      console.log(`⚡ [Optimized] Removed ${removed} ad containers`);
    }
    return removed;
  }

  /**
   * Optimized video processing
   */
  function processAdVideo() {
    const { video } = getCachedElements();
    if (!video || !isAdPlaying()) return;

    try {
      // Instant mute and speed up
      if (!video.muted) {
        video.muted = true;
        video.volume = 0;
      }
      
      // Max speed for ads
      if (video.playbackRate < 16) {
        video.playbackRate = 16;
      }

      // Try to seek past short ads
      if (video.duration && video.duration < 30 && video.duration !== Infinity) {
        video.currentTime = Math.min(video.duration - 0.1, video.currentTime + 10);
      }
    } catch (e) {
      // Silent fail for performance
    }
  }

  /**
   * Main optimized blocking function
   */
  function performOptimizedBlocking() {
    const now = Date.now();
    
    // Throttle checks for performance
    if (now - lastAdCheck < CONFIG.checkInterval) return;
    lastAdCheck = now;

    // Quick ad container removal
    removeAdContainers();

    // Process ads if detected
    if (isAdPlaying()) {
      processAdVideo();
      
      // Try to skip immediately
      if (!fastSkipAd()) {
        // Retry after short delay
        setTimeout(fastSkipAd, 200);
      }
    }
  }

  /**
   * Lightweight mutation observer
   */
  function setupLightweightObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === 1 && 
                (node.className?.includes('ad') || 
                 node.querySelector?.('.ytp-ad-skip-button'))) {
              shouldCheck = true;
              break;
            }
          }
        }
        if (shouldCheck) break;
      }

      if (shouldCheck) {
        setTimeout(performOptimizedBlocking, 10);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('👁️ [Optimized] Lightweight observer active');
  }

  /**
   * Network request blocking (minimal overhead)
   */
  function setupFastNetworkBlocking() {
    const originalFetch = window.fetch;
    window.fetch = function(resource, options) {
      if (typeof resource === 'string' && 
          (resource.includes('doubleclick') || 
           resource.includes('googlesyndication') ||
           resource.includes('/ads/'))) {
        return Promise.reject(new Error('Ad blocked'));
      }
      return originalFetch.apply(this, arguments);
    };
  }

  /**
   * Initialize optimized ad blocker
   */
  function init() {
    console.log('🚀 [Optimized YouTube Ad Blocker] Starting...');
    
    // Setup lightweight blocking
    setupFastNetworkBlocking();
    setupLightweightObserver();

    // Start optimized main loop
    setInterval(performOptimizedBlocking, CONFIG.checkInterval);
    
    // Initial run
    performOptimizedBlocking();
    
    // Stats every 30 seconds (reduced frequency)
    setInterval(() => {
      if (stats.skipped > 0 || stats.blocked > 0) {
        console.log(`⚡ [Optimized] Stats - Skipped: ${stats.skipped}, Blocked: ${stats.blocked}`);
      }
    }, 30000);

    console.log('✅ [Optimized YouTube Ad Blocker] Ready!');
  }

  // Fast initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

  // Expose minimal API
  window.OptimizedYouTubeAdBlocker = {
    stats: () => stats,
    block: performOptimizedBlocking
  };

})();
