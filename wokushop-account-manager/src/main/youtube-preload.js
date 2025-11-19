/**
 * YouTube Ad Skipper - Direct Implementation (Trusted Types Safe)
 * Runs directly without dynamic script injection to avoid CSP issues
 */

console.log('[YouTube Preload] Starting direct ad skipper...');

// DIRECT AD SKIPPER IMPLEMENTATION - No dynamic injection needed
(function() {
  'use strict';

  console.log('[YouTube Ad Skipper] Initializing...');

  // Configuration
  const CONFIG = {
    checkInterval: 100,
    skipButtonSelectors: [
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-modern',
      '.ytp-skip-ad-button',
      'button.ytp-ad-skip-button-container',
      '.ytp-ad-skip-button-slot',
      '.ytp-skip-ad-button__text',
      'button[class*="skip"]',
      'button[class*="ad-skip"]'
    ],
    adIndicatorSelectors: [
      '.ad-showing',
      '.video-ads',
      '.ytp-ad-player-overlay',
      '.ytp-ad-text',
      '.ytp-ad-preview-container'
    ]
  };

  let stats = {
    adsSkipped: 0,
    overlaysHidden: 0,
    lastAdTime: 0
  };

  /**
   * Check if an ad is currently playing
   */
  function isAdPlaying() {
    const video = document.querySelector('video');
    if (!video) return false;

    // Check player classes
    const player = document.querySelector('.html5-video-player');
    if (player) {
      for (const selector of CONFIG.adIndicatorSelectors) {
        if (player.classList.contains(selector.replace('.', ''))) {
          return true;
        }
      }
    }

    // Check for ad overlay elements
    for (const selector of CONFIG.adIndicatorSelectors) {
      if (document.querySelector(selector)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Try to click the skip button
   */
  function clickSkipButton() {
    for (const selector of CONFIG.skipButtonSelectors) {
      const button = document.querySelector(selector);
      if (button && button.offsetParent !== null) {
        try {
          console.log('[YouTube Ad Skipper] 🎯 Found skip button:', selector);
          button.click();
          stats.adsSkipped++;
          stats.lastAdTime = Date.now();
          console.log('[YouTube Ad Skipper] ✅ Clicked skip button! Total skipped:', stats.adsSkipped);
          return true;
        } catch (e) {
          console.error('[YouTube Ad Skipper] Failed to click button:', e);
        }
      }
    }

    // Aggressive - find ANY button with "Skip" text
    const allButtons = document.querySelectorAll('button, a, div[role="button"]');
    for (const btn of allButtons) {
      const text = (btn.textContent || btn.innerText || '').toLowerCase();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();

      if (text.includes('skip') || text.includes('bỏ qua') ||
          ariaLabel.includes('skip') || ariaLabel.includes('bỏ qua')) {
        if (btn.offsetParent !== null) {
          try {
            console.log('[YouTube Ad Skipper] 🎯 Found skip button by text:', text || ariaLabel);
            btn.click();
            stats.adsSkipped++;
            stats.lastAdTime = Date.now();
            console.log('[YouTube Ad Skipper] ✅ Clicked skip button! Total skipped:', stats.adsSkipped);
            return true;
          } catch (e) {
            // Continue to next button
          }
        }
      }
    }

    return false;
  }

  /**
   * Hide ad overlays
   */
  function hideAdOverlays() {
    const adOverlaySelectors = [
      '.ytp-ad-overlay-container',
      '.ytp-ad-text-overlay',
      'ytd-compact-promoted-item-renderer',
      'ytd-display-ad-renderer',
      'ytd-promoted-sparkles-web-renderer'
    ];

    let hiddenCount = 0;
    for (const selector of adOverlaySelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (el.style.display !== 'none') {
          el.style.display = 'none';
          el.style.visibility = 'hidden';
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          hiddenCount++;
        }
      });
    }

    if (hiddenCount > 0) {
      stats.overlaysHidden += hiddenCount;
      console.log('[YouTube Ad Skipper] 🚫 Hidden', hiddenCount, 'ad overlays. Total:', stats.overlaysHidden);
    }
  }

  /**
   * Main loop - check for ads and skip them
   */
  function checkAndSkipAds() {
    hideAdOverlays();

    if (isAdPlaying()) {
      console.log('[YouTube Ad Skipper] 🎬 Ad detected!');
      const skipped = clickSkipButton();

      if (!skipped) {
        console.log('[YouTube Ad Skipper] ⏳ Waiting for skip button to appear...');
        console.log('[YouTube Ad Skipper] 🛡️ Relying on network blocking for ads');
      }
    }
  }

  /**
   * Initialize when DOM is ready
   */
  function init() {
    console.log('='.repeat(60));
    console.log('[YouTube Ad Skipper] ✅ Direct implementation initialized!');
    console.log('[YouTube Ad Skipper] 🛡️ Trusted Types compatible');
    console.log('[YouTube Ad Skipper] 🔍 Check interval:', CONFIG.checkInterval, 'ms');
    console.log('='.repeat(60));

    // Run periodic checks
    setInterval(checkAndSkipAds, CONFIG.checkInterval);

    // Run initial check immediately
    checkAndSkipAds();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

console.log('[YouTube Preload] Direct ad skipper loaded!');
