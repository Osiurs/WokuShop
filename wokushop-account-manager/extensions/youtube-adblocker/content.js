// WokuShop YouTube AdBlocker - Content Script
(function() {
    'use strict';

    console.log('🚫 [WokuShop AdBlocker] Content script loaded');

    // Comprehensive ad selectors for YouTube (stable version)
    const adSelectors = [
        'ytd-ad-slot-renderer', 'ytd-promoted-sparkles-web-renderer', 'ytd-in-feed-ad-layout-renderer',
        'ytd-promoted-video-renderer', 'ytd-display-ad-renderer', 'ytd-compact-promoted-video-renderer',
        'ytd-promoted-sparkles-text-search-renderer', 'ytd-statement-banner-renderer', 'ytd-banner-promo-renderer',
        '.video-ads', '.ytp-ad-module', '.ytp-ad-overlay-container', '#masthead-ad', 'ytd-masthead-ad-renderer',
        '#player-ads', '.ytd-companion-slot-renderer'
    ];

    // Function to hide ads
    function hideAds() {
        adSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                if (el.style.display !== 'none') {
                    el.style.display = 'none';
                }
            });
        });
    }

    // Function to skip/close video ads
    function processVideoAds() {
        const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
        if (skipButton) skipButton.click();

        const closeButton = document.querySelector('.ytp-ad-overlay-close-button');
        if (closeButton) closeButton.click();
    }

    // Main handler for all ad processing
    function handleAds() {
        hideAds();
        processVideoAds();
    }

    // Initialize ad blocker
    function init() {
        handleAds(); // Initial run

        // Use MutationObserver for efficient, event-driven ad blocking
        const observer = new MutationObserver(handleAds);

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('✅ [WokuShop AdBlocker] Active and monitoring with stable version.');
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
