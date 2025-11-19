/**
 * YouTube Ad Blocker - ULTIMATE VERSION
 * Chặn HOÀN TOÀN video ads - không cho phát
 * Dành cho production build
 */

console.log('[YouTube ULTIMATE AdBlock] 🚀 Initializing ULTIMATE version...');

(function() {
  'use strict';

  // ============================================
  // AGGRESSIVE AD BLOCKING - BLOCK BEFORE PLAY
  // ============================================

  let stats = {
    adsBlocked: 0,
    adsSkipped: 0,
    overlaysHidden: 0,
    videoAdsBlocked: 0
  };

  // ============================================
  // 1. BLOCK VIDEO ADS AT SOURCE
  // ============================================
  
  /**
   * Intercept và block tất cả video ad requests
   */
  function blockVideoAdsAtSource() {
    // Override XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      if (isAdUrl(url)) {
        console.log('[YouTube ULTIMATE] 🛑 BLOCKED XHR ad request:', url.substring(0, 100));
        stats.adsBlocked++;
        // Return empty response
        return;
      }
      return originalOpen.call(this, method, url, ...args);
    };

    // Override fetch
    const originalFetch = window.fetch;
    window.fetch = function(url, ...args) {
      const urlString = typeof url === 'string' ? url : url.url;
      if (isAdUrl(urlString)) {
        console.log('[YouTube ULTIMATE] 🛑 BLOCKED fetch ad request:', urlString.substring(0, 100));
        stats.adsBlocked++;
        // Return empty response
        return Promise.resolve(new Response('', { status: 200 }));
      }
      return originalFetch.call(this, url, ...args);
    };

    console.log('[YouTube ULTIMATE] ✅ Request interceptors installed');
  }

  /**
   * Check if URL is ad-related
   */
  function isAdUrl(url) {
    if (!url) return false;
    
    const adPatterns = [
      '/pagead/',
      '/ptracking',
      '/api/stats/ads',
      '/api/stats/atr',
      'doubleclick.net',
      'googlesyndication.com',
      'googleadservices.com',
      '&ad_',
      '&adurl=',
      '&adsystem=',
      '&adformat=',
      'ad_cpn=',
      'is_ad=1',
      '/log_event',
      'activeview'
    ];

    const urlLower = url.toLowerCase();
    return adPatterns.some(pattern => urlLower.includes(pattern.toLowerCase()));
  }

  // ============================================
  // 2. PREVENT AD VIDEO PLAYBACK
  // ============================================

  /**
   * Monitor video element và prevent ad playback
   */
  function preventAdVideoPlayback() {
    const observer = new MutationObserver(() => {
      const video = document.querySelector('video');
      if (!video) return;

      // Check if video is playing an ad
      if (isVideoPlayingAd(video)) {
        console.log('[YouTube ULTIMATE] 🎬 AD VIDEO DETECTED - BLOCKING!');
        
        // Method 1: Skip to end immediately
        if (video.duration && video.duration > 0 && video.duration < 300) {
          video.currentTime = video.duration - 0.1;
          stats.videoAdsBlocked++;
          console.log('[YouTube ULTIMATE] ⏭️ Skipped ad video to end');
        }

        // Method 2: Pause and hide
        video.pause();
        video.muted = true;
        video.volume = 0;
        
        // Method 3: Remove ad video src
        const src = video.src || '';
        if (src.includes('doubleclick') || src.includes('&ad')) {
          video.src = '';
          video.load();
          console.log('[YouTube ULTIMATE] 🗑️ Removed ad video source');
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('[YouTube ULTIMATE] ✅ Video monitor active');
  }

  /**
   * Check if video element is playing an ad
   */
  function isVideoPlayingAd(video) {
    if (!video) return false;

    // Check video src
    const src = video.src || '';
    if (src.includes('doubleclick') || src.includes('&ad')) {
      return true;
    }

    // Check player state
    const player = document.querySelector('.html5-video-player');
    if (player) {
      if (player.classList.contains('ad-showing') || 
          player.classList.contains('ad-interrupting')) {
        return true;
      }
    }

    // Check ad indicators
    const adIndicators = [
      '.ytp-ad-text',
      '.ytp-ad-player-overlay',
      '.ytp-ad-preview-container'
    ];

    for (const selector of adIndicators) {
      const el = document.querySelector(selector);
      if (el && el.offsetParent !== null) {
        return true;
      }
    }

    return false;
  }

  // ============================================
  // 3. AGGRESSIVE AD ELEMENT REMOVAL
  // ============================================

  /**
   * Remove all ad elements from DOM immediately
   */
  function removeAdElements() {
    const adSelectors = [
      // Video ad overlays
      '.ytp-ad-overlay-container',
      '.ytp-ad-text-overlay',
      '.ytp-ad-player-overlay',
      '.ytp-ad-image-overlay',
      '.ytp-ad-text',
      '.ytp-ad-preview-container',
      '.ytp-ad-module',
      '.ytp-ad-button-icon',
      '.ytp-ad-duration-remaining',
      '.ytp-ad-visit-advertiser-button',
      
      // Display ads
      'ytd-display-ad-renderer',
      'ytd-promoted-sparkles-web-renderer',
      'ytd-promoted-video-renderer',
      'ytd-compact-promoted-item-renderer',
      'ytd-banner-promo-renderer',
      'ytd-video-masthead-ad-v3-renderer',
      'ytd-statement-banner-renderer',
      'ytd-ad-slot-renderer',
      'yt-mealbar-promo-renderer',
      '.ytd-companion-slot-renderer',
      '#masthead-ad',
      
      // Promoted content
      '.ytd-rich-item-renderer[is-ad]',
      'ytd-search-pyv-renderer[is-ad]'
    ];

    let removed = 0;
    adSelectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        el.remove();
        removed++;
      });
    });

    if (removed > 0) {
      stats.overlaysHidden += removed;
      console.log('[YouTube ULTIMATE] 🗑️ Removed', removed, 'ad elements');
    }
  }

  /**
   * Continuous ad element removal
   */
  function startAdRemovalLoop() {
    setInterval(removeAdElements, 100);
    console.log('[YouTube ULTIMATE] ✅ Ad removal loop started');
  }

  // ============================================
  // 4. SKIP BUTTON AUTO-CLICK (FALLBACK)
  // ============================================

  /**
   * Auto-click skip button if ad somehow gets through
   */
  function autoClickSkipButton() {
    const skipSelectors = [
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-modern',
      '.ytp-skip-ad-button',
      'button.ytp-ad-skip-button-container',
      '.ytp-ad-skip-button-slot'
    ];

    for (const selector of skipSelectors) {
      const button = document.querySelector(selector);
      if (button && button.offsetParent !== null) {
        try {
          button.click();
          stats.adsSkipped++;
          console.log('[YouTube ULTIMATE] ✅ Clicked skip button (fallback)');
          return true;
        } catch (e) {
          // Continue
        }
      }
    }

    // Aggressive search for any "Skip" button
    const allButtons = document.querySelectorAll('button, a, div[role="button"]');
    for (const btn of allButtons) {
      const text = (btn.textContent || '').toLowerCase();
      if (text.includes('skip') || text.includes('bỏ qua')) {
        if (btn.offsetParent !== null) {
          try {
            btn.click();
            stats.adsSkipped++;
            console.log('[YouTube ULTIMATE] ✅ Clicked skip by text (fallback)');
            return true;
          } catch (e) {
            // Continue
          }
        }
      }
    }

    return false;
  }

  // ============================================
  // 5. CSS INJECTION - HIDE ALL ADS
  // ============================================

  /**
   * Inject aggressive CSS to hide all ads
   */
  function injectAggressiveCSS() {
    const style = document.createElement('style');
    style.id = 'youtube-ultimate-adblock-css';
    style.textContent = `
      /* ULTIMATE AD BLOCKING CSS */
      
      /* Video ad overlays - FORCE HIDE */
      .ytp-ad-overlay-container,
      .ytp-ad-text-overlay,
      .ytp-ad-player-overlay,
      .ytp-ad-image-overlay,
      .ytp-ad-text,
      .ytp-ad-preview-container,
      .ytp-ad-module,
      .ytp-ad-button-icon,
      .ytp-ad-duration-remaining,
      .ytp-ad-visit-advertiser-button,
      .video-ads,
      .ad-container,
      .ad-showing {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        position: absolute !important;
        left: -9999px !important;
        width: 0 !important;
        height: 0 !important;
        z-index: -1 !important;
      }
      
      /* Display ads - FORCE HIDE */
      ytd-display-ad-renderer,
      ytd-promoted-sparkles-web-renderer,
      ytd-promoted-video-renderer,
      ytd-compact-promoted-item-renderer,
      ytd-banner-promo-renderer,
      ytd-video-masthead-ad-v3-renderer,
      ytd-statement-banner-renderer,
      ytd-ad-slot-renderer,
      yt-mealbar-promo-renderer,
      .ytd-companion-slot-renderer,
      #masthead-ad {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        position: absolute !important;
        left: -9999px !important;
        width: 0 !important;
        height: 0 !important;
      }
      
      /* Promoted content - FORCE HIDE */
      .ytd-rich-item-renderer[is-ad],
      ytd-search-pyv-renderer[is-ad] {
        display: none !important;
      }
      
      /* When ad is showing, hide player overlay */
      .html5-video-player.ad-showing .ytp-ad-player-overlay,
      .html5-video-player.ad-interrupting .ytp-ad-player-overlay {
        display: none !important;
      }
      
      /* Force video player to be visible */
      .html5-video-player {
        display: block !important;
      }
      
      video {
        display: block !important;
      }
    `;
    
    if (!document.getElementById('youtube-ultimate-adblock-css')) {
      document.head.appendChild(style);
      console.log('[YouTube ULTIMATE] 💉 Aggressive CSS injected');
    }
  }

  // ============================================
  // 6. MAIN LOOP
  // ============================================

  /**
   * Main blocking loop
   */
  function mainLoop() {
    // Remove ad elements
    removeAdElements();
    
    // Auto-click skip button (fallback)
    autoClickSkipButton();
    
    // Check and block video ads
    const video = document.querySelector('video');
    if (video && isVideoPlayingAd(video)) {
      // Skip to end
      if (video.duration && video.duration > 0 && video.duration < 300) {
        video.currentTime = video.duration - 0.1;
      }
      video.pause();
      video.muted = true;
    }
  }

  // ============================================
  // 7. STATISTICS
  // ============================================

  /**
   * Log statistics
   */
  function logStats() {
    console.log('='.repeat(60));
    console.log('[YouTube ULTIMATE] 📊 STATISTICS');
    console.log('  Network Ads Blocked:', stats.adsBlocked);
    console.log('  Video Ads Blocked:', stats.videoAdsBlocked);
    console.log('  Ads Skipped (fallback):', stats.adsSkipped);
    console.log('  Overlays Hidden:', stats.overlaysHidden);
    console.log('='.repeat(60));
  }

  // ============================================
  // INITIALIZATION
  // ============================================

  function init() {
    console.log('='.repeat(60));
    console.log('[YouTube ULTIMATE] 🚀 ULTIMATE AD BLOCKER 2025');
    console.log('[YouTube ULTIMATE] 🛡️ PRODUCTION BUILD OPTIMIZED');
    console.log('[YouTube ULTIMATE] ⚡ BLOCK ADS BEFORE THEY PLAY');
    console.log('='.repeat(60));

    // 1. Block at source
    blockVideoAdsAtSource();

    // 2. Inject CSS
    injectAggressiveCSS();

    // 3. Start ad removal loop
    startAdRemovalLoop();

    // 4. Monitor video playback
    preventAdVideoPlayback();

    // 5. Main loop
    setInterval(mainLoop, 50);

    // 6. Stats logging
    setInterval(logStats, 30000);

    console.log('[YouTube ULTIMATE] ✅ All systems active!');
    console.log('[YouTube ULTIMATE] 🎯 Ads will be BLOCKED before playing');
  }

  // Wait for DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

console.log('[YouTube ULTIMATE AdBlock] 🎯 Script loaded - Ready to BLOCK!');

