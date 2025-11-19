// WokuShop YouTube AdBlocker - Background Script
chrome.runtime.onInstalled.addListener(() => {
    console.log('🛡️ [WokuShop AdBlocker] Extension installed');
});

// Update badge to show blocking status
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (tab.url && tab.url.includes('youtube.com')) {
        chrome.action.setBadgeText({
            tabId: tabId,
            text: 'ON'
        });
        chrome.action.setBadgeBackgroundColor({
            tabId: tabId,
            color: '#4CAF50'
        });
    }
});
