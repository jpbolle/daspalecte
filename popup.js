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
