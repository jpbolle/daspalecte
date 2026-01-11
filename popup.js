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
