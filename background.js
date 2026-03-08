chrome.runtime.onInstalled.addListener(() => {
  console.log("Daspalecte extension installed.");
});

// Plus besoin de gérer le sidepanel car maintenant c'est un iframe
// Toute la logique est gérée par content.js

// Capture screenshot for OCR feature
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_VISIBLE_TAB') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('[BG] captureVisibleTab error:', chrome.runtime.lastError.message);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl });
      }
    });
    return true; // async response
  }
});
