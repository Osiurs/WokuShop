/**
 * YouTube Ad Blocker - Enhanced Version 2025
 * Chặn quảng cáo YouTube hiệu quả với các phương pháp mới nhất
 * Compatible với Trusted Types và CSP
 */

console.log('[YouTube Enhanced AdBlock] 🚀 Initializing...');

(function() {
  'use strict';

  // ============================================
  // CONFIGURATION
  // ============================================
  const CONFIG = {
    // Tốc độ kiểm tra (ms)
    checkInterval: 50,
    aggressiveCheckInterval: 25,
    
    // Selectors cho nút Skip
    skipButtonSelectors: [
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-modern',
      '.ytp-skip-ad-button',
      'button.ytp-ad-skip-button-container',
      '.ytp-ad-skip-button-slot',
      '.ytp-skip-ad-button__text',
      'button[class*="skip"]',
      'button[class*="ad-skip"]',
      '.ytp-ad-skip-button-icon',
      '.videoAdUiSkipButton',
      '.skip-button',
      '.skipButton'
    ],
    
    // Selectors cho Ad indicators
    adIndicatorSelectors: [
      '.ad-showing',
      '.video-ads',
      '.ytp-ad-player-overlay',
      '.ytp-ad-text',
      '.ytp-ad-preview-container',
      '.ytp-ad-image-overlay',
      '.ytp-ad-overlay-container',
      '.ad-container',
      '.video-ads-overlay'
    ],
    
    // Selectors cho Ad overlays cần ẩn
    adOverlaySelectors: [
      '.ytp-ad-overlay-container',
      '.ytp-ad-text-overlay',
      '.ytp-ad-overlay-image',
      'ytd-compact-promoted-item-renderer',
      'ytd-display-ad-renderer',
      'ytd-promoted-sparkles-web-renderer',
      'ytd-promoted-video-renderer',
      'ytd-banner-promo-renderer',
      'ytd-video-masthead-ad-v3-renderer',
      'ytd-statement-banner-renderer',
      '#masthead-ad',
      '.ytd-rich-item-renderer[is-ad]',
      'ytd-ad-slot-renderer',
      'yt-mealbar-promo-renderer',
      '.ytd-companion-slot-renderer',
      '.ytp-ad-module',
      '.ytp-ad-button-icon',
      '.ytp-ad-text',
      '.ytp-ad-duration-remaining',
      '.ytp-ad-visit-advertiser-button'
    ],
    
    // Selectors cho video player
    videoSelectors: [
      'video.html5-main-video',
      'video.video-stream',
      'video'
    ],
    
    // Từ khóa để nhận diện nút skip
    skipKeywords: ['skip', 'bỏ qua', 'pular', 'überspringen', 'saltar', 'passer', 'スキップ', '건너뛰기', '跳过', '跳過']
  };

  // ============================================
  // STATE MANAGEMENT
  // ============================================
  let stats = {
    adsSkipped: 0,
    adsBlocked: 0,
    overlaysHidden: 0,
    lastAdTime: 0,
    totalAdTime: 0
  };

  let isAdPlaying = false;
  let adStartTime = 0;
  let checkIntervalId = null;

  // ============================================
  // CORE FUNCTIONS
  // ============================================

  /**
   * Kiểm tra xem có quảng cáo đang phát không
   */
  function detectAdPlaying() {
    // Phương pháp 1: Kiểm tra player classes
    const player = document.querySelector('.html5-video-player');
    if (player) {
      if (player.classList.contains('ad-showing') || 
          player.classList.contains('ad-interrupting')) {
        return true;
      }
    }

    // Phương pháp 2: Kiểm tra ad indicator elements
    for (const selector of CONFIG.adIndicatorSelectors) {
      const element = document.querySelector(selector);
      if (element && element.offsetParent !== null) {
        return true;
      }
    }

    // Phương pháp 3: Kiểm tra ad text/countdown
    const adText = document.querySelector('.ytp-ad-text');
    if (adText && adText.offsetParent !== null) {
      return true;
    }

    // Phương pháp 4: Kiểm tra video element có thuộc tính ad
    const video = document.querySelector('video');
    if (video) {
      const src = video.src || '';
      if (src.includes('doubleclick.net') || 
          src.includes('googlevideo.com/videoplayback') && src.includes('&ad')) {
        return true;
      }
    }

    // Phương pháp 5: Kiểm tra ad module
    const adModule = document.querySelector('.ytp-ad-module');
    if (adModule && adModule.offsetParent !== null) {
      return true;
    }

    return false;
  }

  /**
   * Click nút skip ad
   */
  function clickSkipButton() {
    // Thử tất cả selectors
    for (const selector of CONFIG.skipButtonSelectors) {
      const buttons = document.querySelectorAll(selector);
      for (const button of buttons) {
        if (button && button.offsetParent !== null) {
          try {
            console.log('[YouTube Enhanced AdBlock] 🎯 Found skip button:', selector);
            button.click();
            stats.adsSkipped++;
            console.log('[YouTube Enhanced AdBlock] ✅ Clicked! Total skipped:', stats.adsSkipped);
            return true;
          } catch (e) {
            console.warn('[YouTube Enhanced AdBlock] Failed to click:', e.message);
          }
        }
      }
    }

    // Tìm kiếm aggressive - bất kỳ button nào có text "skip"
    const allClickables = document.querySelectorAll('button, a, div[role="button"], span[role="button"]');
    for (const element of allClickables) {
      const text = (element.textContent || element.innerText || '').toLowerCase();
      const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
      const title = (element.getAttribute('title') || '').toLowerCase();
      
      const combinedText = `${text} ${ariaLabel} ${title}`;
      
      for (const keyword of CONFIG.skipKeywords) {
        if (combinedText.includes(keyword.toLowerCase())) {
          if (element.offsetParent !== null) {
            try {
              console.log('[YouTube Enhanced AdBlock] 🎯 Found skip by keyword:', keyword);
              element.click();
              stats.adsSkipped++;
              console.log('[YouTube Enhanced AdBlock] ✅ Clicked! Total skipped:', stats.adsSkipped);
              return true;
            } catch (e) {
              // Continue searching
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Ẩn tất cả ad overlays
   */
  function hideAdOverlays() {
    let hiddenCount = 0;
    
    for (const selector of CONFIG.adOverlaySelectors) {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        if (el.style.display !== 'none') {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('opacity', '0', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
          el.style.setProperty('position', 'absolute', 'important');
          el.style.setProperty('left', '-9999px', 'important');
          el.setAttribute('hidden', 'true');
          hiddenCount++;
        }
      });
    }

    if (hiddenCount > 0) {
      stats.overlaysHidden += hiddenCount;
      console.log('[YouTube Enhanced AdBlock] 🚫 Hidden', hiddenCount, 'overlays. Total:', stats.overlaysHidden);
    }

    return hiddenCount;
  }

  /**
   * Tăng tốc video ad (nếu không skip được)
   */
  function speedUpAd() {
    const video = document.querySelector('video');
    if (video && isAdPlaying) {
      try {
        // Tăng tốc độ phát
        if (video.playbackRate < 16) {
          video.playbackRate = 16;
          console.log('[YouTube Enhanced AdBlock] ⚡ Speeding up ad to 16x');
        }
        
        // Mute ad
        if (!video.muted) {
          video.muted = true;
          console.log('[YouTube Enhanced AdBlock] 🔇 Muted ad');
        }
        
        // Giảm volume
        if (video.volume > 0) {
          video.volume = 0;
        }
      } catch (e) {
        console.warn('[YouTube Enhanced AdBlock] Could not speed up ad:', e.message);
      }
    }
  }

  /**
   * Khôi phục tốc độ video bình thường
   */
  function restoreVideoSpeed() {
    const video = document.querySelector('video');
    if (video && !isAdPlaying) {
      try {
        if (video.playbackRate !== 1) {
          video.playbackRate = 1;
          console.log('[YouTube Enhanced AdBlock] ✅ Restored normal playback speed');
        }
      } catch (e) {
        // Ignore
      }
    }
  }

  /**
   * Chặn ad bằng cách skip video đến cuối
   */
  function skipAdByTime() {
    const video = document.querySelector('video');
    if (video && isAdPlaying) {
      try {
        if (video.duration && video.duration > 0 && video.duration < 300) {
          // Chỉ skip nếu video ngắn hơn 5 phút (tránh skip video chính)
          const remainingTime = video.duration - video.currentTime;
          if (remainingTime > 0.5) {
            video.currentTime = video.duration - 0.1;
            console.log('[YouTube Enhanced AdBlock] ⏭️ Skipped ad by time manipulation');
            stats.adsBlocked++;
            return true;
          }
        }
      } catch (e) {
        console.warn('[YouTube Enhanced AdBlock] Could not skip by time:', e.message);
      }
    }
    return false;
  }

  /**
   * Main loop - kiểm tra và chặn ads
   */
  function checkAndBlockAds() {
    // Luôn ẩn overlays
    hideAdOverlays();

    // Kiểm tra ad
    const adDetected = detectAdPlaying();

    if (adDetected && !isAdPlaying) {
      // Ad mới bắt đầu
      isAdPlaying = true;
      adStartTime = Date.now();
      console.log('[YouTube Enhanced AdBlock] 🎬 AD DETECTED! Starting blocking...');
    } else if (!adDetected && isAdPlaying) {
      // Ad kết thúc
      isAdPlaying = false;
      const adDuration = Date.now() - adStartTime;
      stats.totalAdTime += adDuration;
      console.log('[YouTube Enhanced AdBlock] ✅ Ad ended. Duration:', adDuration, 'ms');
      restoreVideoSpeed();
    }

    if (isAdPlaying) {
      // Thử click skip button
      const skipped = clickSkipButton();
      
      if (!skipped) {
        // Nếu không skip được, thử các phương pháp khác
        speedUpAd();
        
        // Sau 2 giây, thử skip bằng time manipulation
        const adPlayTime = Date.now() - adStartTime;
        if (adPlayTime > 2000) {
          skipAdByTime();
        }
      }
    }
  }

  /**
   * Inject CSS để ẩn ads
   */
  function injectAdBlockCSS() {
    const style = document.createElement('style');
    style.id = 'youtube-enhanced-adblock-css';
    style.textContent = `
      /* Hide all ad overlays */
      .ytp-ad-overlay-container,
      .ytp-ad-text-overlay,
      .ytp-ad-overlay-image,
      ytd-compact-promoted-item-renderer,
      ytd-display-ad-renderer,
      ytd-promoted-sparkles-web-renderer,
      ytd-promoted-video-renderer,
      ytd-banner-promo-renderer,
      ytd-video-masthead-ad-v3-renderer,
      ytd-statement-banner-renderer,
      #masthead-ad,
      ytd-ad-slot-renderer,
      yt-mealbar-promo-renderer,
      .ytd-companion-slot-renderer,
      .ytp-ad-module,
      .ytp-ad-button-icon,
      .ytp-ad-text,
      .ytp-ad-duration-remaining,
      .ytp-ad-visit-advertiser-button {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        pointer-events: none !important;
        position: absolute !important;
        left: -9999px !important;
        width: 0 !important;
        height: 0 !important;
      }

      /* Hide promoted items in search/feed */
      .ytd-rich-item-renderer[is-ad],
      ytd-search-pyv-renderer[is-ad] {
        display: none !important;
      }

      /* Ensure video player is visible */
      .html5-video-player {
        display: block !important;
      }
    `;
    
    if (!document.getElementById('youtube-enhanced-adblock-css')) {
      document.head.appendChild(style);
      console.log('[YouTube Enhanced AdBlock] 💉 Injected blocking CSS');
    }
  }

  /**
   * Setup MutationObserver để theo dõi DOM changes
   */
  function setupMutationObserver() {
    const observer = new MutationObserver((mutations) => {
      // Kiểm tra nếu có ad elements mới được thêm vào
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          hideAdOverlays();
        }
      }
    });

    // Observe toàn bộ document
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log('[YouTube Enhanced AdBlock] 👁️ MutationObserver active');
  }

  /**
   * Log statistics
   */
  function logStats() {
    console.log('='.repeat(60));
    console.log('[YouTube Enhanced AdBlock] 📊 STATISTICS');
    console.log('  Ads Skipped:', stats.adsSkipped);
    console.log('  Ads Blocked:', stats.adsBlocked);
    console.log('  Overlays Hidden:', stats.overlaysHidden);
    console.log('  Total Ad Time:', (stats.totalAdTime / 1000).toFixed(2), 'seconds');
    console.log('='.repeat(60));
  }

  // ============================================
  // INITIALIZATION
  // ============================================
  function init() {
    console.log('='.repeat(60));
    console.log('[YouTube Enhanced AdBlock] 🚀 ENHANCED VERSION 2025');
    console.log('[YouTube Enhanced AdBlock] ✅ Trusted Types Compatible');
    console.log('[YouTube Enhanced AdBlock] ✅ Multi-layer Protection');
    console.log('[YouTube Enhanced AdBlock] 🔍 Check interval:', CONFIG.checkInterval, 'ms');
    console.log('='.repeat(60));

    // Inject CSS
    injectAdBlockCSS();

    // Setup MutationObserver
    setupMutationObserver();

    // Start checking loop
    checkIntervalId = setInterval(checkAndBlockAds, CONFIG.checkInterval);

    // Initial check
    checkAndBlockAds();

    // Log stats every 30 seconds
    setInterval(logStats, 30000);

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      if (checkIntervalId) {
        clearInterval(checkIntervalId);
      }
      logStats();
    });

    console.log('[YouTube Enhanced AdBlock] ✅ Initialization complete!');
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

console.log('[YouTube Enhanced AdBlock] 🎯 Script loaded successfully!');

