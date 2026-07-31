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

  // Lecture d'un texte complet avec relais des limites de mot (surbrillance au fil de la lecture)
  if (message.type === 'SPEAK_TEXT_TRACKED') {
    const tabId = sender.tab && sender.tab.id;
    chrome.tts.stop();
    chrome.tts.speak(message.text, {
      lang: 'fr-FR',
      rate: typeof message.rate === 'number' ? message.rate : 0.85,
      enqueue: false,
      onEvent: (event) => {
        if (!tabId) return;
        if (event.type === 'word') {
          chrome.tabs.sendMessage(tabId, { type: 'TTS_WORD_BOUNDARY', charIndex: event.charIndex }, () => {
            void chrome.runtime.lastError; // ignorer si l'onglet/overlay n'existe plus
          });
        } else if (event.type === 'end' || event.type === 'interrupted' || event.type === 'cancelled' || event.type === 'error') {
          chrome.tabs.sendMessage(tabId, { type: 'TTS_READING_ENDED' }, () => {
            void chrome.runtime.lastError;
          });
        }
      }
    });
    return false;
  }

  if (message.type === 'STOP_TTS_TRACKED') {
    chrome.tts.stop();
    return false;
  }

  if (message.type === 'PAUSE_TTS_TRACKED') {
    chrome.tts.pause();
    return false;
  }

  if (message.type === 'RESUME_TTS_TRACKED') {
    chrome.tts.resume();
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
