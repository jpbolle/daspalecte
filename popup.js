// Initialiser le sélecteur de langue depuis le storage
const nativeLanguagePopup = document.getElementById('native-language-popup');

// Charger la langue sauvegardée au démarrage
chrome.storage.local.get(['nativeLanguage'], (data) => {
    if (data.nativeLanguage) {
        nativeLanguagePopup.value = data.nativeLanguage;
    } else {
        // Valeur par défaut : Anglais
        nativeLanguagePopup.value = 'en';
    }
});

// Sauvegarder la langue quand elle change
nativeLanguagePopup.addEventListener('change', () => {
    chrome.storage.local.set({ nativeLanguage: nativeLanguagePopup.value });
    console.log('[POPUP] Langue maternelle changée:', nativeLanguagePopup.value);
});

document.getElementById('btn-gem').addEventListener('click', () => {
    window.open('https://gemini.google.com/gem/1MhsoBryecLbHB0E55FniFfNUpHz7L443?usp=sharing', '_blank');
});

document.getElementById('btn-sidepanel').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) {
        // Envoyer un message au content script pour afficher l'extension (onglet + panneau)
        chrome.tabs.sendMessage(tab.id, { type: 'SHOW_EXTENSION' });
        window.close(); // Ferme la popup
    }
});

// Extract the real PDF URL (strip Adobe Acrobat or other extension wrappers)
function extractPdfUrl(url) {
    // Adobe Acrobat wraps URLs as: chrome-extension://<id>/https://example.com/file.pdf
    const adobeMatch = url.match(/^chrome-extension:\/\/[a-z]+\/(https?:\/\/.+)$/i);
    if (adobeMatch) return adobeMatch[1];
    return url;
}

// Check if a URL points to a PDF
function isPdfUrl(url) {
    const lower = url.toLowerCase();
    return lower.endsWith('.pdf') ||
           lower.includes('.pdf?') ||
           lower.includes('.pdf#') ||
           lower.includes('content-type=application/pdf');
}

// Detect PDF tab and show PDF button
(async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab && tab.url) {
        const realUrl = extractPdfUrl(tab.url);
        if (isPdfUrl(realUrl)) {
            document.getElementById('btn-pdf').style.display = 'flex';
        }
    }
})();

document.getElementById('btn-pdf').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab && tab.url) {
        const realUrl = extractPdfUrl(tab.url);
        const viewerUrl = chrome.runtime.getURL('pdfviewer.html') + '?url=' + encodeURIComponent(realUrl);
        chrome.tabs.update(tab.id, { url: viewerUrl });
        window.close();
    }
});
