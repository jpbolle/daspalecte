const wordListContainer = document.getElementById('word-list');
const translatorToggle = document.getElementById('translator-toggle');
const languageSelect = document.getElementById('language-select');
const selectAllBtn = document.getElementById('select-all');
const wordsActions = document.getElementById('words-actions');
const deleteSelectedBtn = document.getElementById('delete-selected');
const comprehensionToggle = document.getElementById('comprehension-toggle');
const nativeLanguageSelect = document.getElementById('native-language-select');
const closePanelBtn = document.getElementById('close-panel-btn');

// Flag pour éviter les cascades d'événements
let isUpdatingToggles = false;

// Fonction pour envoyer des messages au content script (parent window)
function sendToContentScript(message) {
    window.parent.postMessage(message, '*');
}

// Gérer le clic sur le bouton X pour fermer complètement l'extension
if (closePanelBtn) {
    closePanelBtn.addEventListener('click', () => {
        sendToContentScript({ type: 'CLOSE_EXTENSION' });
    });
}

// Écouter les messages du content script
window.addEventListener('message', (event) => {
    if (event.data.type === 'WORD_SELECTED') {
        addWordToList(event.data.word, event.data.translation);
    } else if (event.data.type === 'TRANSLATOR_DISABLED_FOR_EXERCISES') {
        // Le traducteur a été désactivé automatiquement pour les exercices
        console.log('[SIDEPANEL] 🎯 Traducteur désactivé pour exercices');
        isUpdatingToggles = true;
        translatorToggle.checked = false;
        chrome.storage.local.set({ translatorEnabled: false });
        isUpdatingToggles = false;
    } else if (event.data.type === 'TRANSLATOR_RESTORED_AFTER_EXERCISES') {
        // Le traducteur a été réactivé après les exercices
        console.log('[SIDEPANEL] 🔄 Traducteur restauré après exercices');
        isUpdatingToggles = true;
        translatorToggle.checked = true;
        chrome.storage.local.set({ translatorEnabled: true });
        isUpdatingToggles = false;
    }
});

function addWordToList(word, translation) {
    // Remove empty message if it exists
    const emptyMsg = wordListContainer.querySelector('.empty-msg');
    if (emptyMsg) emptyMsg.remove();

    const wordDiv = document.createElement('div');
    wordDiv.className = 'word-item';
    wordDiv.innerHTML = `
        <input type="checkbox" class="word-checkbox">
        <div class="word-content">
            <span class="word-text">${word}</span>
            <span class="word-translation">${translation}</span>
        </div>
    `;

    // Écouter le changement sur la checkbox
    const checkbox = wordDiv.querySelector('.word-checkbox');
    checkbox.addEventListener('change', updateActionsBarVisibility);

    wordListContainer.prepend(wordDiv);
    updateActionsBarVisibility();
}

function updateActionsBarVisibility() {
    const totalCount = wordListContainer.querySelectorAll('.word-item').length;
    const checkedCount = wordListContainer.querySelectorAll('.word-checkbox:checked').length;

    // La barre d'action est visible s'il y a des mots
    wordsActions.style.display = totalCount > 0 ? 'flex' : 'none';

    // Le bouton supprimer est visible uniquement si coché
    if (checkedCount > 0) {
        deleteSelectedBtn.classList.remove('hidden');
    } else {
        deleteSelectedBtn.classList.add('hidden');
    }

    // Mettre à jour le texte du bouton "Tout cocher"
    if (totalCount > 0 && checkedCount === totalCount) {
        selectAllBtn.textContent = 'Tout décocher';
    } else {
        selectAllBtn.textContent = 'Tout cocher';
    }
}

// Fonctionnalité "Tout cocher/décocher"
selectAllBtn.addEventListener('click', () => {
    const checkboxes = wordListContainer.querySelectorAll('.word-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);

    checkboxes.forEach(cb => cb.checked = !allChecked);
    updateActionsBarVisibility();
});

// Suppression des mots sélectionnés
deleteSelectedBtn.addEventListener('click', () => {
    const selectedItems = wordListContainer.querySelectorAll('.word-item:has(.word-checkbox:checked)');
    selectedItems.forEach(item => item.remove());

    // Si la liste est vide, remettre le message
    if (wordListContainer.querySelectorAll('.word-item').length === 0) {
        wordListContainer.innerHTML = '<p class="empty-msg">Aucun mot sélectionné</p>';
    }

    updateActionsBarVisibility();
});

// Sync toggle state with storage so content script knows
translatorToggle.addEventListener('change', () => {
    console.log('[SIDEPANEL] 🔵 translatorToggle.change déclenché, checked =', translatorToggle.checked);

    // Ignorer si c'est une modification programmatique
    if (isUpdatingToggles) {
        console.log('[SIDEPANEL] ⚠️ isUpdatingToggles = true, événement ignoré');
        return;
    }

    isUpdatingToggles = true;

    // NE PLUS désactiver la compréhension - les deux outils peuvent coexister!
    chrome.storage.local.set({ translatorEnabled: translatorToggle.checked });

    // Envoyer l'état complet et cohérent
    const message = {
        type: 'settingsChanged',
        enabled: translatorToggle.checked,
        targetLang: languageSelect.value,
        sourceLang: 'auto',
        comprehensionEnabled: comprehensionToggle.checked,
        nativeLanguage: nativeLanguageSelect.value
    };

    console.log('[SIDEPANEL] 📤 Envoi message vers content script:', message);
    sendToContentScript(message);

    isUpdatingToggles = false;
});

languageSelect.addEventListener('change', () => {
    chrome.storage.local.set({ selectedLanguage: languageSelect.value });

    // Envoyer au content script via postMessage
    sendToContentScript({
        type: 'settingsChanged',
        enabled: translatorToggle.checked,
        targetLang: languageSelect.value,
        sourceLang: 'auto',
        comprehensionEnabled: comprehensionToggle.checked,
        nativeLanguage: nativeLanguageSelect.value
    });
});

// Événements pour la compréhension
comprehensionToggle.addEventListener('change', () => {
    console.log('[SIDEPANEL] 🔵 comprehensionToggle.change déclenché, checked =', comprehensionToggle.checked);

    // Ignorer si c'est une modification programmatique
    if (isUpdatingToggles) {
        console.log('[SIDEPANEL] ⚠️ isUpdatingToggles = true, événement ignoré');
        return;
    }

    isUpdatingToggles = true;

    // NE PLUS désactiver le traducteur - les deux outils peuvent coexister!
    chrome.storage.local.set({ comprehensionEnabled: comprehensionToggle.checked });

    // Envoyer un message complet avec tous les états à jour
    const message = {
        type: 'settingsChanged',
        enabled: translatorToggle.checked,
        targetLang: languageSelect.value,
        sourceLang: 'auto',
        comprehensionEnabled: comprehensionToggle.checked,
        nativeLanguage: nativeLanguageSelect.value
    };

    console.log('[SIDEPANEL] 📤 Envoi message vers content script:', message);
    sendToContentScript(message);

    isUpdatingToggles = false;
});

nativeLanguageSelect.addEventListener('change', () => {
    chrome.storage.local.set({ nativeLanguage: nativeLanguageSelect.value });

    sendToContentScript({
        type: 'settingsChanged',
        enabled: translatorToggle.checked,
        targetLang: languageSelect.value,
        sourceLang: 'auto',
        comprehensionEnabled: comprehensionToggle.checked,
        nativeLanguage: nativeLanguageSelect.value
    });
});

// Initialize state - Charger les langues depuis le storage
chrome.storage.local.get(['selectedLanguage', 'nativeLanguage'], (data) => {
    // Les toggles sont toujours désactivés visuellement au démarrage
    // (le content script gère l'état réel)
    translatorToggle.checked = false;
    comprehensionToggle.checked = false;

    // Charger uniquement les langues sauvegardées
    if (data.selectedLanguage) languageSelect.value = data.selectedLanguage;
    if (data.nativeLanguage) nativeLanguageSelect.value = data.nativeLanguage;
});

// Button triggers (basés sur la sélection)
document.getElementById('gen-exercises').addEventListener('click', () => {
    const selectedWords = Array.from(wordListContainer.querySelectorAll('.word-item:has(.word-checkbox:checked)'))
        .map(item => item.querySelector('.word-text').textContent);

    if (selectedWords.length === 0) {
        alert('Veuillez cocher au moins un mot pour générer des exercices.');
        return;
    }

    sendToContentScript({
        type: 'GENERATE_EXERCISES',
        words: selectedWords,
        targetLanguage: languageSelect.value
    });
});

// Bouton gen-questions supprimé car non présent dans le HTML

