const wordListContainer = document.getElementById('word-list');
const translatorToggle = document.getElementById('translator-toggle');
const selectAllBtn = document.getElementById('select-all');
const wordsActions = document.getElementById('words-actions');
const deleteSelectedBtn = document.getElementById('delete-selected');
const comprehensionToggle = document.getElementById('comprehension-toggle');
const readingTestToggle = document.getElementById('reading-test-toggle');
const ctRestoreContainer = document.getElementById('ct-restore-container');
const ctRestoreBtn = document.getElementById('ct-restore-btn');
const captureBtn = document.getElementById('capture-btn');
const closePanelBtn = document.getElementById('close-panel-btn');

function speakFrench(text) {
    // Route through background.js using chrome.tts (more reliable than speechSynthesis)
    sendToContentScript({ type: 'SPEAK_FRENCH', text });
}

// Flag pour éviter les cascades d'événements
let isUpdatingToggles = false;

// Variable locale pour la langue maternelle (chargée depuis storage)
let nativeLanguage = 'en'; // Valeur par défaut

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
    } else if (event.data.type === 'COMPREHENSION_TEST_CLOSED') {
        // Le test de lecture a été fermé — reset le toggle
        console.log('[SIDEPANEL] 📝 Test de lecture fermé, reset toggle');
        isUpdatingToggles = true;
        readingTestToggle.checked = false;
        isUpdatingToggles = false;
        ctRestoreContainer.style.display = 'none';
    } else if (event.data.type === 'COMPREHENSION_TEST_MINIMIZED') {
        // Le test est minimisé — afficher le bouton de restauration
        ctRestoreContainer.style.display = 'block';
    } else if (event.data.type === 'COMPREHENSION_TEST_RESTORED') {
        // Le test est restauré — masquer le bouton
        ctRestoreContainer.style.display = 'none';
    }
});

// Bouton de restauration du test de lecture
ctRestoreBtn.addEventListener('click', () => {
    sendToContentScript({ type: 'RESTORE_COMPREHENSION_TEST' });
});

// Helper : sauvegarder la liste de mots du DOM vers le storage
function saveWordListToStorage() {
    const items = wordListContainer.querySelectorAll('.word-item');
    const wordList = Array.from(items).map(item => ({
        word: item.querySelector('.word-text').textContent,
        translation: item.querySelector('.word-translation').textContent
    }));
    try { chrome.storage.local.set({ wordList }); } catch (e) { /* context invalidated */ }
}

// Helper : vérifier si un mot est déjà dans la liste
function isWordInList(word) {
    const items = wordListContainer.querySelectorAll('.word-item');
    return Array.from(items).some(item =>
        item.querySelector('.word-text').textContent === word
    );
}

function addWordToList(word, translation, fromSync = false) {
    // Éviter les doublons
    if (isWordInList(word)) return;

    // Remove empty message if it exists
    const emptyMsg = wordListContainer.querySelector('.empty-msg');
    if (emptyMsg) emptyMsg.remove();

    const wordDiv = document.createElement('div');
    wordDiv.className = 'word-item';
    wordDiv.innerHTML = `
        <input type="checkbox" class="word-checkbox">
        <div class="word-content">
            <span class="word-text">${word}</span>
            <button class="word-speak-btn" data-word="${word}" title="Écouter">\u{1F50A}</button>
            <span class="word-translation">${translation}</span>
        </div>
    `;

    // Écouter le changement sur la checkbox
    const checkbox = wordDiv.querySelector('.word-checkbox');
    checkbox.addEventListener('change', updateActionsBarVisibility);

    // Écouter le clic sur le bouton speaker
    wordDiv.querySelector('.word-speak-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        speakFrench(word);
    });

    wordListContainer.prepend(wordDiv);
    updateActionsBarVisibility();

    // Persister dans le storage (sauf si c'est un sync depuis un autre onglet)
    if (!fromSync) {
        saveWordListToStorage();
    }
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
    saveWordListToStorage(); // Persister la suppression
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
        targetLang: nativeLanguage,
        sourceLang: 'auto',
        comprehensionEnabled: comprehensionToggle.checked,
        nativeLanguage: nativeLanguage
    };

    console.log('[SIDEPANEL] 📤 Envoi message vers content script:', message);
    sendToContentScript(message);

    isUpdatingToggles = false;
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
        targetLang: nativeLanguage,
        sourceLang: 'auto',
        comprehensionEnabled: comprehensionToggle.checked,
        nativeLanguage: nativeLanguage
    };

    console.log('[SIDEPANEL] 📤 Envoi message vers content script:', message);
    sendToContentScript(message);

    isUpdatingToggles = false;
});

// Événements pour le test de lecture
readingTestToggle.addEventListener('change', () => {
    console.log('[SIDEPANEL] 🔵 readingTestToggle.change déclenché, checked =', readingTestToggle.checked);

    if (isUpdatingToggles) {
        console.log('[SIDEPANEL] ⚠️ isUpdatingToggles = true, événement ignoré');
        return;
    }

    if (readingTestToggle.checked) {
        // Récupérer l'email de l'élève via chrome.identity
        chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
            const studentEmail = (userInfo && userInfo.email) ? userInfo.email : 'unknown@student';
            console.log('[SIDEPANEL] 📧 Email élève:', studentEmail);

            sendToContentScript({
                type: 'GENERATE_COMPREHENSION_TEST',
                nativeLanguage: nativeLanguage,
                studentEmail: studentEmail
            });
        });
    } else {
        // Si on désactive manuellement le toggle, fermer le test
        sendToContentScript({
            type: 'CLOSE_COMPREHENSION_TEST'
        });
    }
});

// Initialize state - Charger la langue, les outils et la liste de mots
chrome.storage.local.get(['nativeLanguage', 'translatorEnabled', 'wordList'], (data) => {
    // Restaurer le traducteur depuis le storage (sync inter-onglets)
    translatorToggle.checked = data.translatorEnabled || false;
    // La compréhension reste toujours désactivée au démarrage (activation manuelle par onglet)
    comprehensionToggle.checked = false;

    // Charger la langue maternelle sauvegardée
    if (data.nativeLanguage) {
        nativeLanguage = data.nativeLanguage;
    }

    // Charger la liste de mots accumulés
    if (data.wordList && data.wordList.length > 0) {
        data.wordList.forEach(item => addWordToList(item.word, item.translation, true));
    }

    console.log('[SIDEPANEL] État initial chargé:', {
        nativeLanguage,
        translator: translatorToggle.checked,
        words: (data.wordList || []).length
    });

    // Signaler au content script que le sidepanel est prêt
    // (APRÈS avoir chargé les mots pour que le dédup fonctionne sur les messages en attente)
    window.parent.postMessage({ type: 'SIDEPANEL_READY' }, '*');
});

// Écouter les changements depuis le storage (langue + outils depuis d'autres onglets)
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace !== 'local') return;

    if (changes.nativeLanguage) {
        nativeLanguage = changes.nativeLanguage.newValue;
        console.log('[SIDEPANEL] Langue maternelle mise à jour:', nativeLanguage);
    }

    // Synchroniser le traducteur depuis les autres onglets
    // (la compréhension n'est pas synchronisée — activation manuelle par onglet)
    if (changes.translatorEnabled) {
        isUpdatingToggles = true;
        translatorToggle.checked = changes.translatorEnabled.newValue;
        isUpdatingToggles = false;
    }

    // Synchroniser la liste de mots entre les onglets
    if (changes.wordList) {
        const newList = changes.wordList.newValue || [];
        const currentItems = wordListContainer.querySelectorAll('.word-item');
        const currentWords = new Set(Array.from(currentItems).map(
            item => item.querySelector('.word-text').textContent
        ));
        const newWords = new Set(newList.map(item => item.word));

        // Ajouter les mots présents dans le storage mais pas dans le DOM
        newList.forEach(item => {
            if (!currentWords.has(item.word)) {
                addWordToList(item.word, item.translation, true);
            }
        });

        // Supprimer les mots présents dans le DOM mais plus dans le storage
        currentItems.forEach(item => {
            const word = item.querySelector('.word-text').textContent;
            if (!newWords.has(word)) {
                item.remove();
            }
        });

        // Mettre à jour le message vide et les actions
        if (wordListContainer.querySelectorAll('.word-item').length === 0) {
            if (!wordListContainer.querySelector('.empty-msg')) {
                wordListContainer.innerHTML = '<p class="empty-msg">Aucun mot sélectionné</p>';
            }
        }
        updateActionsBarVisibility();
    }
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
        targetLanguage: nativeLanguage
    });
});

// Capture & Lecture button
captureBtn.addEventListener('click', () => {
    sendToContentScript({
        type: 'START_SCREEN_CAPTURE',
        nativeLanguage: nativeLanguage
    });
});

// Bouton gen-questions supprimé car non présent dans le HTML

