/**
 * Preload script to inject missing Chrome Extension APIs for uBlock Origin Lite
 * This fixes compatibility issues between Electron and Chrome extensions
 */

// Polyfill URL.parse() for Gemini - Chrome 124 doesn't have this yet (needs Chrome 126+)
// NOTE: This runs in preload context, but we need it in page context too
// We'll inject via main.js using executeJavaScript instead

// Just log that preload script loaded
console.log('✅ [Preload] Extension preload script loaded (URL.parse will be injected via main.js)');

// Mock chrome.i18n API if it doesn't exist or is incomplete
if (typeof chrome !== 'undefined') {
  // Backup original chrome.i18n if it exists
  const originalI18n = chrome.i18n || {};

  // Override/extend chrome.i18n with missing methods
  chrome.i18n = chrome.i18n || {};

  // getUILanguage - Returns the UI language of the browser
  if (!chrome.i18n.getUILanguage) {
    chrome.i18n.getUILanguage = function() {
      // Try to get from navigator
      const lang = navigator.language || navigator.userLanguage || 'en';
      console.log('[Preload] chrome.i18n.getUILanguage() called, returning:', lang);
      return lang;
    };
  }

  // getMessage - Gets localized message
  if (!chrome.i18n.getMessage) {
    chrome.i18n.getMessage = function(messageName, substitutions) {
      console.log('[Preload] chrome.i18n.getMessage() called for:', messageName);
      // Return a default fallback
      return messageName;
    };
  }

  // getAcceptLanguages - Gets accept languages
  if (!chrome.i18n.getAcceptLanguages) {
    chrome.i18n.getAcceptLanguages = function(callback) {
      const languages = [navigator.language || 'en'];
      console.log('[Preload] chrome.i18n.getAcceptLanguages() called, returning:', languages);
      if (callback) callback(languages);
    };
  }

  // detectLanguage - Detects language of text
  if (!chrome.i18n.detectLanguage) {
    chrome.i18n.detectLanguage = function(text, callback) {
      const result = {
        isReliable: false,
        languages: [{ language: navigator.language || 'en', percentage: 100 }]
      };
      console.log('[Preload] chrome.i18n.detectLanguage() called');
      if (callback) callback(result);
    };
  }

  console.log('✅ [Preload] chrome.i18n API injected successfully');
}

// Mock other potentially missing APIs
if (typeof chrome !== 'undefined') {
  // Ensure chrome.runtime exists
  chrome.runtime = chrome.runtime || {};

  // Ensure chrome.storage exists
  chrome.storage = chrome.storage || {};
  chrome.storage.local = chrome.storage.local || {};
  chrome.storage.sync = chrome.storage.sync || {};

  console.log('✅ [Preload] Additional Chrome APIs verified');
}

console.log('✅ [Preload] Extension compatibility layer loaded');
