/**
 * Comprehensive Ad Blocking Domains List
 * Used by session.webRequest to block ads at network level
 */

module.exports = {
  // YouTube Ad Domains - COMPREHENSIVE LIST
  youtube: [
    // YouTube Ad API Endpoints
    '*://www.youtube.com/api/stats/ads*',
    '*://www.youtube.com/api/stats/qoe*',
    '*://www.youtube.com/pagead/*',
    '*://www.youtube.com/ptracking*',
    '*://www.youtube.com/get_video_info*adformat*',
    '*://youtube.com/api/stats/ads*',
    '*://youtube.com/pagead/*',

    // YouTube Ad Servers
    '*://s.youtube.com/api/stats/qoe*',
    '*://*.ytimg.com/generate_204*',
    '*://i.ytimg.com/generate_204*',

    // YouTube Video Ads
    '*://www.youtube.com/get_midroll_info*',
    '*://www.youtube.com/yt/about/en-GB/paid*',
  ],

  // Google Ads - MAIN AD NETWORK
  google: [
    // DoubleClick (Primary Google Ad Server)
    '*://*.doubleclick.net/*',
    '*://googleads.g.doubleclick.net/*',
    '*://static.doubleclick.net/*',
    '*://pubads.g.doubleclick.net/*',
    '*://ad.doubleclick.net/*',
    '*://doubleclick.com/*',

    // Google Syndication (AdSense)
    '*://*.googlesyndication.com/*',
    '*://pagead2.googlesyndication.com/*',
    '*://tpc.googlesyndication.com/*',
    '*://video-ad-stats.googlesyndication.com/*',

    // Google Ad Services
    '*://*.googleadservices.com/*',
    '*://www.googleadservices.com/*',

    // Google Tag Manager & Ad Scripts
    '*://www.googletagmanager.com/gtag/js*',
    '*://www.googletagservices.com/tag/js/gpt.js*',

    // Google Marketing Platform
    '*://*.2mdn.net/*',
    '*://s0.2mdn.net/*',
  ],

  // Spotify Ad Domains
  spotify: [
    '*://*.audio-ak-spotify-com.akamaized.net/audio/*/ad/*',
    '*://adeventtracker.spotify.com/*',
    '*://adstudio.spotify.com/*',
    '*://ads-fa.spotify.com/*',
    '*://spclient.wg.spotify.com/ads/*',
    '*://spclient.wg.spotify.com/ad-logic/*',
    '*://audio-ak-spotify-com.akamaized.net/audio/*/ad/*',
    '*://heads-fa.spotify.com/*',
    '*://*.pscdn.co/audio/*/ad/*', // Fixed: removed invalid wildcard from middle of domain
  ],

  // Generic Ad Networks
  adNetworks: [
    // Major Ad Networks
    '*://*.advertising.com/*',
    '*://*.admob.com/*',
    '*://*.adcolony.com/*',
    '*://*.adsrvr.org/*',
    '*://*.amazon-adsystem.com/*',
    '*://*.criteo.com/*',
    '*://*.outbrain.com/*',
    '*://*.taboola.com/*',
    '*://*.pubmatic.com/*',
    '*://*.revcontent.com/*',

    // Ad Servers
    '*://adserver.*',
    '*://ads.*',
    '*://*.adnxs.com/*',
    '*://*.rubiconproject.com/*',
    '*://*.openx.net/*',
    '*://*.casalemedia.com/*',

    // Video Ad Networks
    '*://*.spotxchange.com/*',
    '*://*.freewheel.tv/*',
    '*://*.videohub.tv/*',
  ],

  // Tracking & Analytics
  tracking: [
    // Google Analytics
    '*://www.google-analytics.com/*',
    '*://*.analytics.google.com/*',
    '*://ssl.google-analytics.com/*',
    '*://stats.g.doubleclick.net/*',

    // Ad Verification & Measurement
    '*://*.adsafeprotected.com/*',
    '*://*.moatads.com/*',
    '*://*.scorecardresearch.com/*',
    '*://*.quantserve.com/*',

    // Facebook Tracking
    '*://pixel.facebook.com/*',
    '*://connect.facebook.net/*/fbevents.js*',

    // Other Trackers
    '*://*.hotjar.com/*',
    '*://*.mouseflow.com/*',
    '*://*.crazyegg.com/*',
  ],

  // Malware & Suspicious Domains
  malware: [
    '*://*.popcash.net/*',
    '*://*.popads.net/*',
    '*://*.adcash.com/*',
    '*://*.propellerads.com/*',
    '*://*.revcontent.com/*',
  ],

  // Get all domains combined
  getAll() {
    return [
      ...this.youtube,
      ...this.google,
      ...this.spotify,
      ...this.adNetworks,
      ...this.tracking,
      ...this.malware,
    ];
  },

  // Get domains for specific service
  getForService(serviceType) {
    switch (serviceType) {
      case 'youtube':
        return [...this.youtube, ...this.google, ...this.tracking];
      case 'spotify':
        return [...this.spotify, ...this.google, ...this.tracking];
      case 'netflix':
        return [...this.google, ...this.tracking, ...this.adNetworks];
      case 'chatgpt':
      case 'gemini':
        return [...this.tracking];
      default:
        return this.getAll();
    }
  },

  // Get count
  getTotalCount() {
    return this.getAll().length;
  }
};
