chrome.runtime.onInstalled.addListener(() => {
  console.log("Daspalecte extension installed.");
});

// Plus besoin de gérer le sidepanel car maintenant c'est un iframe
// Toute la logique est gérée par content.js

// Capture screenshot for OCR feature
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SPEAK_FRENCH') {
    chrome.tts.stop();
    chrome.tts.speak(message.text, {
      lang: 'fr-FR',
      rate: 0.9,
      enqueue: false
    });
    return false;
  }

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
