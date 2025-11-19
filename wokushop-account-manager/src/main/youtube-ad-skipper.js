/**
 * YouTube Ad Skipper - Auto-skip ads in YouTube player
 * Injected as content script into YouTube session windows
 */

(function() {
  'use strict';

  console.log('[YouTube Ad Skipper] Initializing...');

  // Configuration
  const CONFIG = {
    checkInterval: 100, // Check every 100ms (faster detection)
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
    ],
    adOverlaySelectors: [
      '.ytp-ad-overlay-container',
      '.ytp-ad-text-overlay',
      'ytd-compact-promoted-item-renderer',
      'ytd-display-ad-renderer',
      'ytd-promoted-sparkles-web-renderer'
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
    // Check for ad indicator classes
    const video = document.querySelector('video');
    if (!video) return false;

    // Method 1: Check player classes
    const player = document.querySelector('.html5-video-player');
    if (player) {
      for (const selector of CONFIG.adIndicatorSelectors) {
        if (player.classList.contains(selector.replace('.', ''))) {
          return true;
        }
      }
    }

    // Method 2: Check for ad overlay elements
    for (const selector of CONFIG.adIndicatorSelectors) {
      if (document.querySelector(selector)) {
        return true;
      }
    }

    // Method 3: Check ad preview text
    const adText = document.querySelector('.ytp-ad-preview-text');
    if (adText && adText.textContent.trim().length > 0) {
      return true;
    }

    return false;
  }

  /**
   * Try to click the skip button
   */
  function clickSkipButton() {
    // Method 1: Try specific selectors
    for (const selector of CONFIG.skipButtonSelectors) {
      const button = document.querySelector(selector);
      if (button && button.offsetParent !== null) { // Check if visible
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

    // Method 2: Aggressive - find ANY button with "Skip" text
    const allButtons = document.querySelectorAll('button, a, div[role="button"]');
    for (const btn of allButtons) {
      const text = (btn.textContent || btn.innerText || '').toLowerCase();
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();

      if (text.includes('skip') || text.includes('bỏ qua') ||
          ariaLabel.includes('skip') || ariaLabel.includes('bỏ qua')) {
        if (btn.offsetParent !== null) { // Visible
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
   * Hide ad overlays (banner ads, display ads)
   */
  function hideAdOverlays() {
    let hiddenCount = 0;

    for (const selector of CONFIG.adOverlaySelectors) {
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
   * DISABLED - Try to skip ad by seeking video forward
   * This function is disabled to prevent interference with normal videos
   */
  function trySeekPastAd() {
    // DISABLED: Video seeking can interfere with normal playback
    console.log('[YouTube Ad Skipper] ⚠️ Video seeking disabled to prevent playback issues');
    return false;
  }

  /**
   * DISABLED - Mute video during ads
   * This function is disabled to prevent interference with normal videos
   */
  function muteAdAudio() {
    // DISABLED: Audio muting can interfere with user preferences
    console.log('[YouTube Ad Skipper] ⚠️ Audio muting disabled to prevent audio issues');
    return;
  }

  /**
   * Main loop - check for ads and skip them
   */
  let lastCheckTime = 0;
  let checkCount = 0;

  function checkAndSkipAds() {
    checkCount++;

    // Log every 50 checks for debugging
    if (checkCount % 50 === 0) {
      console.log('[YouTube Ad Skipper] 🔄 Check #' + checkCount + ' - Still monitoring...');
    }

    // Hide ad overlays first
    hideAdOverlays();

    // Check if ad is playing
    if (isAdPlaying()) {
      console.log('[YouTube Ad Skipper] 🎬 Ad detected!');
      console.log('[YouTube Ad Skipper] 🕒 Current time:', new Date().toLocaleTimeString());

      // ONLY try to click skip button - no video manipulation
      const skipped = clickSkipButton();

      if (skipped) {
        console.log('[YouTube Ad Skipper] ✅ Successfully clicked skip button');
      } else {
        console.log('[YouTube Ad Skipper] ⏳ Waiting for skip button to appear...');
        console.log('[YouTube Ad Skipper] 🛡️ Relying on uBlock Origin Lite for blocking');
      }
    }

    lastCheckTime = Date.now();
  }

  /**
   * Enhanced ad detection using MutationObserver
   */
  function setupAdObserver() {
    const player = document.querySelector('.html5-video-player');
    if (!player) {
      // Retry in 1 second if player not found yet
      setTimeout(setupAdObserver, 1000);
      return;
    }

    console.log('[YouTube Ad Skipper] 👁️ Setting up ad observer...');

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Check if ad-related classes were added
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const classList = mutation.target.classList;
          if (classList.contains('ad-showing') || classList.contains('ad-interrupting')) {
            console.log('[YouTube Ad Skipper] 🚨 Ad class detected via observer!');
            checkAndSkipAds();
          }
        }

        // Check if ad elements were added to DOM
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element node
              // Check if added node is an ad
              const isAd = CONFIG.adIndicatorSelectors.some(selector =>
                node.matches && node.matches(selector)
              );
              if (isAd) {
                console.log('[YouTube Ad Skipper] 🚨 Ad element added to DOM!');
                checkAndSkipAds();
              }
            }
          });
        }
      }
    });

    // Observe player for changes
    observer.observe(player, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true
    });

    console.log('[YouTube Ad Skipper] ✅ Ad observer active!');
  }

  /**
   * Print statistics
   */
  function printStats() {
    console.log('[YouTube Ad Skipper] 📊 Statistics:');
    console.log('  - Ads skipped:', stats.adsSkipped);
    console.log('  - Overlays hidden:', stats.overlaysHidden);
    console.log('  - Last ad:', stats.lastAdTime ? new Date(stats.lastAdTime).toLocaleTimeString() : 'None');
  }

  /**
   * Initialize the ad skipper
   */
  function init() {
    console.log('='.repeat(60));
    console.log('[YouTube Ad Skipper] ✅ Initialized successfully!');
    console.log('[YouTube Ad Skipper] 🛡️ Protecting your YouTube experience...');
    console.log('[YouTube Ad Skipper] 🔍 Check interval:', CONFIG.checkInterval, 'ms');
    console.log('[YouTube Ad Skipper] 📍 Page URL:', window.location.href);
    console.log('[YouTube Ad Skipper] 🎯 Total skip button selectors:', CONFIG.skipButtonSelectors.length);
    console.log('='.repeat(60));

    // Setup mutation observer for better ad detection
    setupAdObserver();

    // Run periodic checks
    const intervalId = setInterval(checkAndSkipAds, CONFIG.checkInterval);
    console.log('[YouTube Ad Skipper] ⏰ Check interval started (ID:', intervalId, ')');

    // Print stats every 5 minutes
    setInterval(printStats, 5 * 60 * 1000);

    // Run initial check immediately
    checkAndSkipAds();

    // Run another check after 1 second
    setTimeout(checkAndSkipAds, 1000);

    console.log('[YouTube Ad Skipper] 🚀 All systems ready!');
  }

  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose to global scope for debugging
  window.YouTubeAdSkipper = {
    stats: () => stats,
    check: checkAndSkipAds,
    config: CONFIG
  };

})();
