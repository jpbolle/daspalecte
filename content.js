class DaspalecteTranslator {
    constructor() {
        this.isEnabled = false;
        this.isComprehensionEnabled = false;
        this.targetLang = 'en';
        this.nativeLanguage = 'en';
        this.sourceLang = 'auto';
        this.selectedWords = new Set();
        this.translations = new Map();
        this.sidepanelIframe = null;
        this.sidepanelVisible = false;
        this.toggleButton = null;
        this.translatorStateBeforeExercises = false; // Pour restaurer après exercices
        this.sidepanelReady = false;
        this.pendingMessages = [];
        this.comprehensionTestMinimized = false;
        this.comprehensionTestData = null;
        this.comprehensionTestAnswers = { questions: [], matching: [] };
        this.comprehensionTestPairMap = new Map();
        this.studentEmail = '';
        this.init();
    }

    async init() {
        // NE PAS créer automatiquement l'onglet et l'iframe au chargement
        // Ils seront créés uniquement quand l'utilisateur ouvre l'extension
        
        // Charger les paramètres
        await this.loadSettings();

        // Ajouter les gestionnaires d'événements
        this.setupEventListeners();

        // Gérer les hyperliens selon l'état initial
        if (this.isEnabled) {
            this.disableAllLinks();
        }

        // Synchroniser l'état entre les onglets
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            try {
                // Fermeture complète (bouton X) depuis un autre onglet
                if (changes.extensionOpen && changes.extensionOpen.newValue === false) {
                    if (this.toggleButton || this.sidepanelIframe) {
                        this.closeExtension(true);
                    }
                    return;
                }

                // Replier / déplier la sidebar
                if (changes.sidepanelVisible) {
                    const isVisible = changes.sidepanelVisible.newValue;
                    if (isVisible && !this.sidepanelVisible) {
                        this.showExtension();
                    } else if (!isVisible && this.sidepanelVisible) {
                        this.hideSidepanel();
                    }
                }

                // Activation / désactivation du traducteur (sync inter-onglets)
                // Note : la compréhension n'est PAS synchronisée (activation manuelle par onglet)
                if (changes.translatorEnabled) {
                    const wasEnabled = this.isEnabled;
                    this.isEnabled = changes.translatorEnabled.newValue;

                    if (this.isEnabled && !wasEnabled) {
                        this.disableAllLinks();
                    } else if (!this.isEnabled && wasEnabled) {
                        this.enableAllLinks();
                        this.clearAllTranslations();
                    }
                }
            } catch (e) { /* extension context invalidated */ }
        });

        // Écouter les messages
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'TOGGLE_SIDEPANEL') {
                this.toggleSidepanel();
            } else if (message.type === 'SHOW_EXTENSION') {
                this.showExtension();
                this.showSidepanel();
            } else if (message.type === 'SHOW_SIDEPANEL') {
                this.showSidepanel();
            } else if (message.type === 'HIDE_SIDEPANEL') {
                this.hideSidepanel();
            } else if (message.type === 'settingsChanged') {
                const wasEnabled = this.isEnabled;
                const wasComprehensionEnabled = this.isComprehensionEnabled;

                this.isEnabled = message.enabled;
                this.isComprehensionEnabled = message.comprehensionEnabled;
                this.targetLang = message.targetLang;
                this.nativeLanguage = message.nativeLanguage;
                this.sourceLang = message.sourceLang || 'auto';

                // Gérer les hyperliens
                if (this.isEnabled && !wasEnabled) {
                    this.disableAllLinks();
                } else if (!this.isEnabled && wasEnabled) {
                    this.enableAllLinks();
                }

                // Gérer les boutons magiques de compréhension (indépendamment du traducteur)
                if (this.isComprehensionEnabled && !wasComprehensionEnabled) {
                    this.injectMagicButtons();
                } else if (!this.isComprehensionEnabled && wasComprehensionEnabled) {
                    this.removeMagicButtons();
                }

                // Si le traducteur est désactivé, nettoyer UNIQUEMENT les traductions
                // Les boutons magiques sont gérés par la compréhension uniquement
                if (wasEnabled && !this.isEnabled) {
                    console.log('[CONTENT] 🧹 Nettoyage des traductions (traducteur désactivé)');
                    this.clearAllTranslations();
                }
            } else if (message.type === 'GENERATE_EXERCISES') {
                this.handleExerciseGeneration(message.words, message.targetLanguage);
            } else if (message.type === 'WORD_SELECTED') {
                // Transmettre au sidepanel iframe
                this.sendMessageToSidepanel(message);
            }
        });

        // Restaurer l'état de la sidebar si elle était ouverte
        this.restoreSidepanelState();
    }

    createToggleButton() {
        // Créer l'onglet rectangulaire collé à droite
        this.toggleButton = document.createElement('button');
        this.toggleButton.id = 'daspalecte-toggle-btn';
        this.toggleButton.title = 'Ouvrir/Fermer Daspalecte';
        
        // Créer l'image de l'icône
        const icon = document.createElement('img');
        icon.src = chrome.runtime.getURL('icon48.png');
        icon.alt = 'Daspalecte';
        icon.style.width = '24px';
        icon.style.height = '24px';
        
        this.toggleButton.appendChild(icon);
        
        this.toggleButton.addEventListener('click', () => {
            this.toggleSidepanel();
        });

        document.body.appendChild(this.toggleButton);
    }

    createSidepanelIframe() {
        // Créer le conteneur de l'iframe
        const container = document.createElement('div');
        container.id = 'daspalecte-sidepanel-container';
        container.className = 'daspalecte-hidden';

        // Créer l'iframe
        this.sidepanelIframe = document.createElement('iframe');
        this.sidepanelIframe.id = 'daspalecte-sidepanel-iframe';
        this.sidepanelIframe.src = chrome.runtime.getURL('sidepanel.html');
        
        container.appendChild(this.sidepanelIframe);
        document.body.appendChild(container);

        // Écouter les messages depuis l'iframe
        window.addEventListener('message', (event) => {
            // Vérifier que le message vient de notre iframe
            if (event.source === this.sidepanelIframe.contentWindow) {
                this.handleSidepanelMessage(event.data);
            }
        });
    }

    toggleSidepanel() {
        // Si l'extension n'a jamais été ouverte, la créer d'abord
        if (!this.toggleButton || !this.sidepanelIframe) {
            this.showExtension();
            return;
        }
        
        if (this.sidepanelVisible) {
            this.hideSidepanel();
        } else {
            this.showSidepanel();
        }
    }

    showSidepanel() {
        const container = document.getElementById('daspalecte-sidepanel-container');
        if (container) {
            container.classList.remove('daspalecte-hidden');
            container.classList.add('daspalecte-visible');
            this.sidepanelVisible = true;

            // Pousser le contenu de la page
            document.documentElement.classList.add('daspalecte-page-pushed');

            // Déplacer l'onglet à gauche du panneau
            if (this.toggleButton) {
                this.toggleButton.classList.add('panel-open');
            }

            // Persister l'état pour les autres onglets
            try { chrome.storage.local.set({ sidepanelVisible: true }); } catch (e) { /* extension context invalidated */ }
        }
    }

    hideSidepanel() {
        const container = document.getElementById('daspalecte-sidepanel-container');
        if (container) {
            container.classList.remove('daspalecte-visible');
            container.classList.add('daspalecte-hidden');
            this.sidepanelVisible = false;

            // Remettre le contenu de la page en pleine largeur
            document.documentElement.classList.remove('daspalecte-page-pushed');

            // Remettre l'onglet à l'extrémité droite
            if (this.toggleButton) {
                this.toggleButton.classList.remove('panel-open');
            }

            // Persister l'état pour les autres onglets
            try { chrome.storage.local.set({ sidepanelVisible: false }); } catch (e) { /* extension context invalidated */ }
        }
    }

    closeExtension(fromSync = false) {
        // 1. Désactiver tous les outils
        if (this.isEnabled) {
            this.clearAllTranslations();
            this.enableAllLinks();
            this.isEnabled = false;
        }

        if (this.isComprehensionEnabled) {
            this.removeMagicButtons();
            this.isComprehensionEnabled = false;
        }

        // 2. Fermer les overlays si ouverts
        this.translatorStateBeforeExercises = false;
        this.closeExerciseOverlay();
        this.closeComprehensionTestOverlay();

        // 3. Mettre à jour le storage (seulement si action locale, pas sync)
        if (!fromSync) {
            try {
                chrome.storage.local.set({
                    translatorEnabled: false,
                    comprehensionEnabled: false,
                    extensionOpen: false,
                    sidepanelVisible: false
                });
            } catch (e) { /* extension context invalidated */ }
        }

        // 4. Masquer la sidebar visuellement
        const container = document.getElementById('daspalecte-sidepanel-container');
        if (container) {
            container.classList.remove('daspalecte-visible');
            container.classList.add('daspalecte-hidden');
        }
        this.sidepanelVisible = false;
        document.documentElement.classList.remove('daspalecte-page-pushed');

        // 5. SUPPRIMER complètement l'onglet du DOM
        if (this.toggleButton) {
            this.toggleButton.remove();
            this.toggleButton = null;
        }
    }

    showExtension() {
        // Créer l'onglet et l'iframe s'ils n'existent pas encore
        if (!this.toggleButton) {
            this.createToggleButton();
        }

        if (!this.sidepanelIframe) {
            this.createSidepanelIframe();
        }

        // Afficher le panneau
        this.showSidepanel();

        // Marquer l'extension comme ouverte (pour que la fermeture déclenche onChanged)
        try { chrome.storage.local.set({ extensionOpen: true }); } catch (e) { /* extension context invalidated */ }
    }

    async restoreSidepanelState() {
        try {
            const result = await chrome.storage.local.get([
                'sidepanelVisible', 'translatorEnabled'
            ]);
            if (result.sidepanelVisible) {
                this.showExtension();

                // Restaurer le traducteur (la compréhension reste manuelle par onglet)
                if (result.translatorEnabled) {
                    this.isEnabled = true;
                    this.disableAllLinks();
                }
            }
        } catch (e) { /* extension context invalidated */ }
    }

    sendMessageToSidepanel(message) {
        if (!this.sidepanelIframe) return;
        if (this.sidepanelReady && this.sidepanelIframe.contentWindow) {
            this.sidepanelIframe.contentWindow.postMessage(message, '*');
        } else {
            this.pendingMessages.push(message);
        }
    }

    handleSidepanelMessage(message) {
        // Gérer les messages venant du sidepanel iframe
        console.log('[CONTENT] 📨 Message reçu du sidepanel:', message.type);

        if (message.type === 'SIDEPANEL_READY') {
            this.sidepanelReady = true;
            // Envoyer les messages en attente
            this.pendingMessages.forEach(msg => {
                if (this.sidepanelIframe && this.sidepanelIframe.contentWindow) {
                    this.sidepanelIframe.contentWindow.postMessage(msg, '*');
                }
            });
            this.pendingMessages = [];
            return;
        }

        if (message.type === 'CLOSE_EXTENSION') {
            // Le bouton X ferme complètement l'extension (panneau + onglet)
            console.log('[CONTENT] Fermeture complète de l\'extension');
            this.closeExtension();
        } else if (message.type === 'HIDE_SIDEPANEL') {
            // Juste masquer le panneau (garder l'onglet)
            this.hideSidepanel();
        } else if (message.type === 'settingsChanged') {
            const wasEnabled = this.isEnabled;
            const wasComprehensionEnabled = this.isComprehensionEnabled;

            console.log('[CONTENT] 🔍 État AVANT:', {
                wasEnabled,
                wasComprehensionEnabled
            });

            this.isEnabled = message.enabled;
            this.isComprehensionEnabled = message.comprehensionEnabled;
            this.targetLang = message.targetLang;
            this.nativeLanguage = message.nativeLanguage;
            this.sourceLang = message.sourceLang || 'auto';

            console.log('[CONTENT] 🔍 État APRÈS:', {
                isEnabled: this.isEnabled,
                isComprehensionEnabled: this.isComprehensionEnabled,
                nativeLanguage: this.nativeLanguage
            });

            // Gérer les hyperliens
            if (this.isEnabled && !wasEnabled) {
                console.log('[CONTENT] 🔗 Désactivation des liens (traducteur activé)');
                this.disableAllLinks();
            } else if (!this.isEnabled && wasEnabled) {
                console.log('[CONTENT] 🔗 Réactivation des liens (traducteur désactivé)');
                this.enableAllLinks();
            }

            // Gérer les boutons magiques de compréhension (indépendamment du traducteur)
            console.log('[CONTENT] 🧪 Vérification condition injection:', {
                isComprehensionEnabled: this.isComprehensionEnabled,
                wasComprehensionEnabled: wasComprehensionEnabled,
                condition: this.isComprehensionEnabled && !wasComprehensionEnabled
            });

            if (this.isComprehensionEnabled && !wasComprehensionEnabled) {
                console.log('[CONTENT] ✨ INJECTION DES BOUTONS MAGIQUES');
                this.injectMagicButtons();
            } else if (!this.isComprehensionEnabled && wasComprehensionEnabled) {
                console.log('[CONTENT] 🗑️ SUPPRESSION DES BOUTONS MAGIQUES');
                this.removeMagicButtons();
            } else {
                console.log('[CONTENT] ⚠️ AUCUNE ACTION - Condition non remplie');
            }

            // Si le traducteur est désactivé, nettoyer UNIQUEMENT les traductions
            // Les boutons magiques sont gérés par la compréhension uniquement
            if (wasEnabled && !this.isEnabled) {
                console.log('[CONTENT] 🧹 Nettoyage des traductions (traducteur désactivé)');
                this.clearAllTranslations();
            }
        } else if (message.type === 'GENERATE_EXERCISES') {
            this.handleExerciseGeneration(message.words, message.targetLanguage);
        } else if (message.type === 'GENERATE_COMPREHENSION_TEST') {
            this.handleComprehensionTest(message.nativeLanguage, message.studentEmail);
        } else if (message.type === 'CLOSE_COMPREHENSION_TEST') {
            this.closeComprehensionTestOverlay();
        } else if (message.type === 'RESTORE_COMPREHENSION_TEST') {
            this.restoreComprehensionTest();
        }
    }

    speakFrench(text) {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'fr-FR';
        utterance.rate = 0.9;
        speechSynthesis.speak(utterance);
    }

    async loadSettings() {
        console.log('[CONTENT] 🔧 loadSettings() appelée');
        const result = await chrome.storage.local.get([
            'nativeLanguage'
        ]);

        // NE PAS charger translatorEnabled et comprehensionEnabled depuis le storage
        // pour éviter les conflits avec l'initialisation du sidepanel.
        // Les outils sont toujours désactivés au démarrage et activés uniquement
        // par l'utilisateur via le sidepanel.
        this.isEnabled = false;
        this.isComprehensionEnabled = false;
        // Utiliser nativeLanguage pour les deux (traduction et compréhension)
        const lang = result.nativeLanguage || 'en';
        this.targetLang = lang;
        this.nativeLanguage = lang;
        this.sourceLang = 'auto';

        console.log('[CONTENT] 🔧 État initial après loadSettings:', {
            isEnabled: this.isEnabled,
            isComprehensionEnabled: this.isComprehensionEnabled,
            targetLang: this.targetLang,
            nativeLanguage: this.nativeLanguage
        });

        // Forcer le storage à refléter l'état désactivé initial
        chrome.storage.local.set({
            translatorEnabled: false,
            comprehensionEnabled: false
        });
    }

    setupEventListeners() {
        // Changer le curseur quand le traducteur est activé
        document.addEventListener('mouseover', (e) => {
            if (this.isEnabled && e.target.nodeType === Node.ELEMENT_NODE) {
                // Ne pas changer le curseur sur les liens ni sur le bouton speaker
                if (e.target.tagName !== 'A' && !e.target.closest('a') &&
                    !e.target.classList.contains('daspalecte-speak-btn')) {
                    e.target.style.cursor = 'help';
                }
            }
        });

        document.addEventListener('mouseout', (e) => {
            if (e.target.nodeType === Node.ELEMENT_NODE && e.target.style.cursor === 'help') {
                e.target.style.cursor = '';
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.isEnabled) return;

            const target = e.target;

            // Si on clique sur le bouton speaker
            if (target.classList.contains('daspalecte-speak-btn')) {
                e.preventDefault();
                e.stopPropagation();
                this.speakFrench(target.dataset.word);
                return;
            }

            // Si on clique sur une traduction
            if (target.classList.contains('daspalecte-translation')) {
                // Vérifier s'il y a une sélection de texte
                const selection = window.getSelection();
                if (selection && selection.toString().length > 0) {
                    // Il y a une sélection, ne rien faire (permettre la copie)
                    return;
                }
                // Pas de sélection, supprimer la traduction
                e.preventDefault();
                e.stopPropagation();
                this.removeTranslation(target);
                return;
            }

            // Si on clique sur un mot déjà traduit, supprimer sa traduction
            if (target.classList.contains('daspalecte-word') &&
                target.querySelector('.daspalecte-translation')) {
                e.preventDefault();
                e.stopPropagation();
                this.removeTranslation(target.querySelector('.daspalecte-translation'));
                return;
            }

            // Obtenir le mot cliqué (les liens sont déjà désactivés)
            const word = this.getWordAtPosition(e);
            if (word) {
                e.preventDefault();
                e.stopPropagation();
                this.handleWordClick(word, e);
            }
        }, true);
    }

    injectMagicButtons() {
        console.log('[CONTENT] ✨ injectMagicButtons() appelée');
        const paragraphs = document.querySelectorAll('p');
        console.log('[CONTENT] 📊 Paragraphes trouvés:', paragraphs.length);

        let injectedCount = 0;
        paragraphs.forEach((p, index) => {
            if (p.textContent.trim().length < 50) return;
            if (p.closest('.daspalecte-row-container')) return;

            injectedCount++;

            // Créer le conteneur de ligne
            const container = document.createElement('div');
            container.className = 'daspalecte-row-container';

            // Créer les colonnes
            const colActions = document.createElement('div');
            colActions.className = 'daspalecte-col-actions';

            const colSummary = document.createElement('div');
            colSummary.className = 'daspalecte-col-summary';

            const colContent = document.createElement('div');
            colContent.className = 'daspalecte-col-content';

            // Bouton Magique
            const button = document.createElement('button');
            button.className = 'daspalecte-magic-btn';
            button.innerHTML = '✨';
            button.title = 'Simplifier ce paragraphe (FLE)';

            button.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleMagicButtonClick(p, button, colSummary);
            };

            // Assemblage
            colActions.appendChild(button);

            // Insérer le container avant le paragraphe et y déplacer le paragraphe
            p.parentNode.insertBefore(container, p);
            colContent.appendChild(p);

            container.appendChild(colActions);
            container.appendChild(colSummary);
            container.appendChild(colContent);

            p.dataset.daspalecteMagic = "true";
        });

        console.log('[CONTENT] ✅ Boutons magiques injectés:', injectedCount);
    }

    removeMagicButtons() {
        console.log('[CONTENT] 🗑️ removeMagicButtons() appelée');
        const containers = document.querySelectorAll('.daspalecte-row-container');
        console.log('[CONTENT] 📊 Containers trouvés à supprimer:', containers.length);

        containers.forEach(container => {
            const contentCol = container.querySelector('.daspalecte-col-content');
            if (contentCol) {
                const paragraph = contentCol.querySelector('p');
                if (paragraph) {
                    delete paragraph.dataset.daspalecteMagic;
                    // Retirer les styles inline potentiels ajoutés par sécurité
                    paragraph.style.all = '';
                    container.parentNode.insertBefore(paragraph, container);
                }
            }
            container.remove();
        });

        console.log('[CONTENT] ✅ Boutons magiques supprimés');
    }

    async handleMagicButtonClick(paragraph, button, summaryCol) {
        if (button.disabled) return;

        // Si le résumé est déjà affiché, on le masque (toggle)
        if (summaryCol.classList.contains('active')) {
            summaryCol.classList.remove('active');
            summaryCol.innerHTML = '';
            button.innerHTML = '✨';
            return;
        }

        button.disabled = true;
        button.innerHTML = '⏳';

        try {
            // Utiliser targetLang (langue du traducteur) comme langue maternelle de l'étudiant
            const result = await this.getAISummary(paragraph.textContent, this.targetLang);
            console.log('[CONTENT] 📝 Langue utilisée pour la compréhension:', this.targetLang);

            summaryCol.innerHTML = `
                <div class="daspalecte-summary-box">
                    <div class="summary-header">
                        <span>Aide à la compréhension</span>
                        <button class="summary-close">×</button>
                    </div>
                    <div class="summary-content">
                        <div class="summary-section">
                            <div class="section-title">📌 Résumé</div>
                            <div class="section-text">${result.summary || 'Résumé non disponible'}</div>
                        </div>
                        <div class="reformulation-section">
                            <div class="section-title">📝 Reformulation</div>
                            <div class="section-text">${result.reformulation || result.summary || 'Reformulation non disponible'}</div>
                        </div>
                    </div>
                </div>
            `;

            summaryCol.classList.add('active');
            summaryCol.querySelector('.summary-close').onclick = () => {
                summaryCol.classList.remove('active');
                summaryCol.innerHTML = '';
                button.innerHTML = '✨';
            };

            button.innerHTML = '✦'; // Icone alternative pour état "actif"
        } catch (error) {
            console.error('Erreur de résumé AI:', error);
            button.innerHTML = '❌';
            setTimeout(() => { button.innerHTML = '✨'; }, 3000);
        } finally {
            button.disabled = false;
        }
    }

    async getAISummary(text, nativeLang) {
        // URL de votre Cloud Function
        const CLOUD_FUNCTION_URL = 'https://daspalecte-1086562672385.europe-west1.run.app';

        console.log(`Appel API Claude pour résumé FLE (Langue maternelle: ${nativeLang})`);

        try {
            const response = await fetch(CLOUD_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'summarize',
                    text: text,
                    nativeLanguage: nativeLang
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[CONTENT] Erreur backend détaillée:', errorData);
                throw new Error(errorData.message || 'Erreur lors du résumé');
            }

            const data = await response.json();
            // Retourner l'objet complet avec summary et reformulation
            return data;
        } catch (error) {
            console.error('Erreur API Claude:', error);
            throw error;
        }
    }

    async handleExerciseGeneration(words, targetLang) {
        console.log('[CONTENT] 📝 Génération d\'exercices - Désactivation temporaire du traducteur');

        // Sauvegarder l'état actuel du traducteur
        this.translatorStateBeforeExercises = this.isEnabled;

        // Désactiver le traducteur temporairement pendant les exercices
        if (this.isEnabled) {
            this.isEnabled = false;
            this.enableAllLinks();
            // Notifier le sidepanel de la désactivation
            this.sendMessageToSidepanel({
                type: 'TRANSLATOR_DISABLED_FOR_EXERCISES'
            });
        }

        this.showOverlayLoader();

        try {
            const response = await fetch('https://daspalecte-1086562672385.europe-west1.run.app', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generate_exercises',
                    list: words,
                    targetLanguage: targetLang
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[CONTENT] Erreur backend détaillée:', errorData);
                throw new Error('Erreur lors de la génération');
            }

            const data = await response.json();
            this.displayExercises(data.exercises);
        } catch (error) {
            console.error('Erreur exercices:', error);
            alert('Erreur lors de la préparation des exercices.');
            this.closeExerciseOverlay();
        }
    }

    showOverlayLoader() {
        this.closeExerciseOverlay(); // Nettoyage au cas où

        const overlay = document.createElement('div');
        overlay.id = 'daspalecte-exercise-overlay';
        overlay.innerHTML = `
            <div class="overlay-content loader-active">
                <div class="loader-container">
                    <div class="neon-spinner"></div>
                    <p>Claude prépare vos exercices...</p>
                </div>
                <button class="overlay-close">×</button>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('.overlay-close').onclick = () => this.closeExerciseOverlay();
    }

    closeExerciseOverlay() {
        const existing = document.getElementById('daspalecte-exercise-overlay');
        if (existing) {
            existing.remove();

            // Restaurer l'état du traducteur s'il était actif avant les exercices
            if (this.translatorStateBeforeExercises && !this.isEnabled) {
                console.log('[CONTENT] 🔄 Restauration du traducteur après exercices');
                this.isEnabled = true;
                this.disableAllLinks();

                // Notifier le sidepanel de la réactivation
                this.sendMessageToSidepanel({
                    type: 'TRANSLATOR_RESTORED_AFTER_EXERCISES'
                });
            }

            // Réinitialiser la sauvegarde
            this.translatorStateBeforeExercises = false;
        }
    }

    displayExercises(exercises) {
        const overlay = document.getElementById('daspalecte-exercise-overlay');
        if (!overlay) return;

        let currentStep = 0;
        const content = overlay.querySelector('.overlay-content');
        content.classList.remove('loader-active');

        const renderStep = () => {
            const ex = exercises[currentStep];
            content.innerHTML = `
                <div class="exercise-container">
                    <div class="exercise-header">
                        <span class="step-counter">Exercice ${currentStep + 1} / ${exercises.length}</span>
                        <h2>${ex.title}</h2>
                        <p class="ex-desc">${ex.description}</p>
                    </div>
                    <div class="exercise-body" id="ex-body"></div>
                    <div class="exercise-footer">
                        <div class="nav-buttons">
                            <button id="btn-prev" class="ex-btn secondary" ${currentStep === 0 ? 'disabled' : ''}>
                                ← Précédent
                            </button>
                            <button id="btn-skip" class="ex-btn secondary" ${currentStep === exercises.length - 1 ? 'disabled' : ''}>
                                Suivant →
                            </button>
                        </div>
                        <div class="action-buttons">
                            <button id="btn-check" class="ex-btn primary">Vérifier</button>
                            <button id="btn-next" class="ex-btn primary" style="display:none">Continuer</button>
                        </div>
                    </div>
                    <button class="overlay-close">×</button>
                </div>
            `;

            content.querySelector('.overlay-close').onclick = () => this.closeExerciseOverlay();
            const body = content.querySelector('#ex-body');
            const btnNext = content.querySelector('#btn-next');
            const btnCheck = content.querySelector('#btn-check');
            const btnPrev = content.querySelector('#btn-prev');
            const btnSkip = content.querySelector('#btn-skip');

            this.renderExerciseType(ex, body, btnCheck, btnNext);

            // Navigation : Précédent
            btnPrev.onclick = () => {
                if (currentStep > 0) {
                    currentStep--;
                    renderStep();
                }
            };

            // Navigation : Suivant (sauter sans vérifier)
            btnSkip.onclick = () => {
                if (currentStep < exercises.length - 1) {
                    currentStep++;
                    renderStep();
                }
            };

            // Bouton "Continuer" après vérification réussie
            btnNext.onclick = () => {
                currentStep++;
                if (currentStep < exercises.length) {
                    renderStep();
                } else {
                    this.showFinishScreen(content);
                }
            };
        };

        renderStep();
    }

    renderExerciseType(ex, container, btnCheck, btnNext) {
        switch (ex.type) {
            case 'matching': this.renderMatching(ex, container, btnCheck, btnNext); break;
            case 'tags': this.renderTags(ex, container, btnCheck, btnNext); break;
            case 'reading': this.renderReading(ex, container, btnCheck, btnNext); break;
            case 'family': this.renderFamily(ex, container, btnCheck, btnNext); break;
            case 'cloze': this.renderCloze(ex, container, btnCheck, btnNext); break;
        }
    }

    renderMatching(ex, container, btnCheck, btnNext) {
        let selectedFr = null;
        let selectedTr = null;
        let matchesFound = 0;
        const totalPairs = ex.pairs.length;

        container.innerHTML = `
            <div class="matching-container">
                <div class="matching-col" id="col-fr"></div>
                <div class="matching-col" id="col-tr"></div>
            </div>
        `;

        const colFr = container.querySelector('#col-fr');
        const colTr = container.querySelector('#col-tr');

        // Mélanger les tableaux pour le défi
        const frItems = [...ex.pairs].sort(() => Math.random() - 0.5);
        const trItems = [...ex.pairs].sort(() => Math.random() - 0.5);

        frItems.forEach(pair => {
            const el = document.createElement('div');
            el.className = 'match-item';
            el.textContent = pair.fr;
            el.dataset.val = pair.fr;
            el.onclick = () => {
                if (el.classList.contains('matched')) return;
                colFr.querySelectorAll('.match-item').forEach(i => i.classList.remove('selected'));
                el.classList.add('selected');
                selectedFr = pair.fr;
                checkMatch();
            };
            colFr.appendChild(el);
        });

        trItems.forEach(pair => {
            const el = document.createElement('div');
            el.className = 'match-item';
            el.textContent = pair.tr;
            el.dataset.val = pair.fr; // On stocke la clé FR pour vérifier
            el.onclick = () => {
                if (el.classList.contains('matched')) return;
                colTr.querySelectorAll('.match-item').forEach(i => i.classList.remove('selected'));
                el.classList.add('selected');
                selectedTr = pair.fr;
                checkMatch();
            };
            colTr.appendChild(el);
        });

        const checkMatch = () => {
            if (selectedFr && selectedTr) {
                if (selectedFr === selectedTr) {
                    // Succès
                    container.querySelectorAll(`.match-item[data-val="${selectedFr}"]`).forEach(el => {
                        el.classList.remove('selected');
                        el.classList.add('matched');
                    });
                    matchesFound++;
                    if (matchesFound === totalPairs) {
                        btnNext.style.display = 'block';
                    }
                } else {
                    // Erreur temporaire
                    const items = container.querySelectorAll('.match-item.selected');
                    items.forEach(el => el.classList.add('error'));
                    setTimeout(() => {
                        items.forEach(el => {
                            el.classList.remove('selected');
                            el.classList.remove('error');
                        });
                    }, 500);
                }
                selectedFr = null;
                selectedTr = null;
            }
        };

        btnCheck.style.display = 'none';
    }

    renderTags(ex, container, btnCheck, btnNext) {
        let answers = {}; // { itemIndex: selectedWord }
        const totalItems = ex.items.length;

        container.innerHTML = `
            <div class="tags-exercise">
                <div class="sentences-list" id="sentences"></div>
                <div class="tags-pool" id="pool"></div>
            </div>
        `;

        const sentencesDiv = container.querySelector('#sentences');
        const poolDiv = container.querySelector('#pool');

        // Créer les phrases avec des zones de dépôt (drag & drop)
        ex.items.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'sentence-item';

            // On remplace ___ par un span interactif
            const htmlText = item.sentence.replace('___', `<span class="drop-zone" data-idx="${idx}">...</span>`);
            div.innerHTML = `<span class="bullet">${idx + 1}</span> ${htmlText}`;
            sentencesDiv.appendChild(div);

            const dropZone = div.querySelector('.drop-zone');

            // Vérifier que la drop-zone existe (la phrase doit contenir ___)
            if (!dropZone) {
                console.warn(`[CONTENT] ⚠️ Pas de zone de dépôt pour l'item ${idx}: "${item.sentence}"`);
                return; // Passer à l'item suivant
            }

            // Drag & Drop events
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.style.background = 'rgba(0, 243, 255, 0.2)';
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.style.background = '';
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.style.background = '';

                const word = e.dataTransfer.getData('text/plain');
                const tagElement = poolDiv.querySelector(`[data-word="${word}"]`);

                if (tagElement) {
                    // Si la zone contient déjà un mot, le remettre dans le pool
                    if (answers[idx]) {
                        const oldTag = document.createElement('div');
                        oldTag.className = 'tag-item';
                        oldTag.textContent = answers[idx];
                        oldTag.draggable = true;
                        oldTag.dataset.word = answers[idx];
                        setupTagDrag(oldTag);
                        poolDiv.appendChild(oldTag);
                    }

                    // Placer le nouveau mot
                    answers[idx] = word;
                    dropZone.textContent = word;
                    dropZone.classList.add('filled');
                    tagElement.remove();
                }
            });

            // Clic pour retirer un mot
            dropZone.addEventListener('click', () => {
                if (answers[idx]) {
                    // Remettre le mot dans le pool
                    const tag = document.createElement('div');
                    tag.className = 'tag-item';
                    tag.textContent = answers[idx];
                    tag.draggable = true;
                    tag.dataset.word = answers[idx];
                    setupTagDrag(tag);
                    poolDiv.appendChild(tag);

                    delete answers[idx];
                    dropZone.textContent = '...';
                    dropZone.classList.remove('filled');
                }
            });
        });

        // Fonction pour configurer le drag d'une étiquette
        const setupTagDrag = (tag) => {
            tag.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', tag.textContent);
                tag.style.opacity = '0.5';
            });

            tag.addEventListener('dragend', () => {
                tag.style.opacity = '1';
            });
        };

        // Créer le pool d'étiquettes (mélangé) avec drag & drop
        const words = ex.items.map(item => item.word).sort(() => Math.random() - 0.5);
        words.forEach(word => {
            const tag = document.createElement('div');
            tag.className = 'tag-item';
            tag.textContent = word;
            tag.draggable = true;
            tag.dataset.word = word;
            setupTagDrag(tag);
            poolDiv.appendChild(tag);
        });

        btnCheck.style.display = 'block';
        btnCheck.onclick = () => {
            let correctCount = 0;
            ex.items.forEach((item, idx) => {
                const zone = container.querySelector(`.drop-zone[data-idx="${idx}"]`);

                // Vérifier que la zone existe
                if (!zone) {
                    console.warn(`[CONTENT] ⚠️ Pas de zone trouvée pour vérification de l'item ${idx}`);
                    return; // Passer à l'item suivant
                }

                if (answers[idx] === item.word) {
                    zone.classList.add('correct');
                    correctCount++;
                } else {
                    zone.classList.add('error');
                }
            });

            if (correctCount === totalItems) {
                btnNext.style.display = 'block';
                btnCheck.style.display = 'none';
            } else {
                setTimeout(() => {
                    container.querySelectorAll('.drop-zone.error').forEach(z => {
                        z.classList.remove('error');
                    });
                }, 2000);
            }
        };
    }

    renderReading(ex, container, btnCheck, btnNext) {
        container.innerHTML = `<div class="reading-text">${ex.text}</div>`;
        btnNext.style.display = 'block';
        btnCheck.style.display = 'none';
    }

    renderFamily(ex, container, btnCheck, btnNext) {
        container.innerHTML = `
            <div class="family-exercise">
                <div class="families-grid" id="families"></div>
            </div>
        `;

        const familiesDiv = container.querySelector('#families');

        ex.items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'family-card';

            // Gérer "mainWord" ou "word" pour compatibilité
            const mainWord = item.mainWord || item.word || 'Mot';

            card.innerHTML = `
                <div class="main-word-node">${mainWord}</div>
                <div class="related-words-container">
                    ${item.related.map(word => `<span class="related-tag">${word}</span>`).join('')}
                </div>
            `;
            familiesDiv.appendChild(card);
        });

        btnCheck.style.display = 'none';
        btnNext.style.display = 'block';
    }

    renderCloze(ex, container, btnCheck, btnNext) {
        container.innerHTML = `
            <div class="cloze-exercise">
                <div class="cloze-items" id="cloze-list"></div>
            </div>
        `;

        const listDiv = container.querySelector('#cloze-list');

        ex.items.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'cloze-item';

            const html = item.text.replace('___', `<input type="text" class="cloze-input" data-idx="${idx}" autocomplete="off">`);
            div.innerHTML = `<span class="bullet">${idx + 1}</span> <span>${html}</span>`;
            listDiv.appendChild(div);
        });

        btnCheck.style.display = 'block';
        btnCheck.onclick = () => {
            let correctCount = 0;
            ex.items.forEach((item, idx) => {
                const input = container.querySelector(`.cloze-input[data-idx="${idx}"]`);

                // Vérifier que l'input existe (la phrase doit contenir ___)
                if (!input) {
                    console.warn(`[CONTENT] ⚠️ Pas d'input trouvé pour l'item ${idx}: "${item.text}"`);
                    return; // Passer à l'item suivant
                }

                if (input.value.trim().toLowerCase() === item.answer.toLowerCase()) {
                    input.classList.add('correct');
                    correctCount++;
                } else {
                    input.classList.add('error');
                }
            });

            if (correctCount === ex.items.length) {
                btnNext.style.display = 'block';
                btnCheck.style.display = 'none';
            } else {
                setTimeout(() => {
                    container.querySelectorAll('.cloze-input.error').forEach(i => {
                        i.classList.remove('error');
                    });
                }, 2000);
            }
        };
    }

    showFinishScreen(content) {
        content.innerHTML = `
            <div class="finish-screen">
                <div class="neon-trophy">🏆</div>
                <h2>Félicitations !</h2>
                <p>Tu as terminé tous les exercices.</p>
                <button class="ex-btn primary" id="finish-exercises-btn">Terminer</button>
            </div>
        `;

        // Utiliser closeExerciseOverlay() pour restaurer le traducteur si nécessaire
        content.querySelector('#finish-exercises-btn').onclick = () => {
            this.closeExerciseOverlay();
        };
    }

    // ========================================
    // COMPREHENSION TEST (Test de lecture)
    // ========================================

    extractPageText() {
        // Try article, main, [role="main"] first, fallback to body
        const candidates = [
            document.querySelector('article'),
            document.querySelector('main'),
            document.querySelector('[role="main"]'),
            document.body
        ];
        let container = candidates.find(el => el && el.textContent.trim().length > 100) || document.body;

        console.log('[CONTENT] 📄 extractPageText - container:', container.tagName, 'textContent length:', container.textContent.length);

        // Clone to filter out only daspalecte UI elements (not page content)
        const clone = container.cloneNode(true);
        clone.querySelectorAll('#daspalecte-sidepanel-container, #daspalecte-toggle-btn, #daspalecte-exercise-overlay, #daspalecte-comprehension-test-overlay, #daspalecte-ct-floating-btn').forEach(el => el.remove());

        let text = clone.textContent || '';
        // Clean up whitespace
        text = text.replace(/\s+/g, ' ').trim();

        console.log('[CONTENT] 📄 extractPageText - cleaned text length:', text.length);

        // Truncate to 5000 chars
        if (text.length > 5000) {
            text = text.substring(0, 5000);
        }
        return text;
    }

    async handleComprehensionTest(nativeLanguage, studentEmail) {
        this.studentEmail = studentEmail || 'unknown@student';

        const pageText = this.extractPageText();
        if (pageText.length < 100) {
            alert('Le texte de cette page est trop court pour générer un test de lecture.');
            this.sendMessageToSidepanel({ type: 'COMPREHENSION_TEST_CLOSED' });
            return;
        }

        // Show loader overlay
        this.showComprehensionTestLoader();

        try {
            const response = await fetch('https://daspalecte-1086562672385.europe-west1.run.app', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'generate_comprehension_test',
                    text: pageText,
                    nativeLanguage: nativeLanguage || this.nativeLanguage
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[CONTENT] Erreur backend test:', errorData);
                throw new Error('Erreur lors de la génération du test');
            }

            const data = await response.json();
            this.comprehensionTestData = data;
            this.comprehensionTestAnswers = {
                questions: new Array(data.questions ? data.questions.length : 0).fill(null),
                matching: []
            };
            this.displayComprehensionTest(data);
        } catch (error) {
            console.error('Erreur test de lecture:', error);
            alert('Erreur lors de la préparation du test de lecture.');
            this.closeComprehensionTestOverlay();
        }
    }

    showComprehensionTestLoader() {
        // Clean up existing overlay WITHOUT sending close message to sidepanel
        const existing = document.getElementById('daspalecte-comprehension-test-overlay');
        if (existing) existing.remove();
        const existingBtn = document.getElementById('daspalecte-ct-floating-btn');
        if (existingBtn) existingBtn.remove();

        const overlay = document.createElement('div');
        overlay.id = 'daspalecte-comprehension-test-overlay';
        overlay.innerHTML = `
            <div class="ct-overlay-content ct-loader-active">
                <div class="loader-container">
                    <div class="neon-spinner"></div>
                    <p style="color: #aaa; font-family: Inter, sans-serif;">Claude prépare votre test de lecture...</p>
                </div>
                <button class="ct-close-btn" title="Fermer">×</button>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.ct-close-btn').onclick = () => this.closeComprehensionTestOverlay();
    }

    displayComprehensionTest(data) {
        const overlay = document.getElementById('daspalecte-comprehension-test-overlay');
        if (!overlay) return;

        const content = overlay.querySelector('.ct-overlay-content');
        content.classList.remove('ct-loader-active');

        let currentPage = 1;

        content.innerHTML = `
            <div class="ct-container">
                <div class="ct-header">
                    <div>
                        <h2 class="ct-title">Test de lecture</h2>
                        <span class="ct-step-indicator" id="ct-step-indicator">1 / 2</span>
                    </div>
                    <div class="ct-header-actions">
                        <button id="ct-minimize-btn" class="ct-minimize-btn" title="Minimiser">−</button>
                        <button id="ct-close-btn" class="ct-close-btn" title="Fermer">×</button>
                    </div>
                </div>
                <div class="ct-body">
                    <div class="ct-page" id="ct-page-1">
                        <div class="ct-section">
                            <h3 class="ct-section-title">Questions de compréhension</h3>
                            <div id="ct-mcq-container"></div>
                        </div>
                    </div>
                    <div class="ct-page" id="ct-page-2" style="display:none">
                        <div class="ct-section">
                            <h3 class="ct-section-title">Exercice d'appariement</h3>
                            <div id="ct-matching-container"></div>
                        </div>
                    </div>
                </div>
                <div class="ct-footer">
                    <div class="ct-nav">
                        <button class="ex-btn secondary" id="ct-prev-btn" style="display:none">← Précédent</button>
                        <button class="ex-btn primary" id="ct-next-btn">Suivant →</button>
                        <button class="ex-btn primary" id="ct-submit-btn" style="display:none">Soumettre le test</button>
                    </div>
                </div>
            </div>
        `;

        const page1 = content.querySelector('#ct-page-1');
        const page2 = content.querySelector('#ct-page-2');
        const prevBtn = content.querySelector('#ct-prev-btn');
        const nextBtn = content.querySelector('#ct-next-btn');
        const submitBtn = content.querySelector('#ct-submit-btn');
        const stepIndicator = content.querySelector('#ct-step-indicator');

        const showPage = (page) => {
            currentPage = page;
            stepIndicator.textContent = `${page} / 2`;
            page1.style.display = page === 1 ? 'block' : 'none';
            page2.style.display = page === 2 ? 'block' : 'none';
            prevBtn.style.display = page === 2 ? 'inline-block' : 'none';
            nextBtn.style.display = page === 1 ? 'inline-block' : 'none';
            submitBtn.style.display = page === 2 ? 'inline-block' : 'none';
            // Scroll to top of overlay
            overlay.scrollTop = 0;
        };

        nextBtn.onclick = () => showPage(2);
        prevBtn.onclick = () => showPage(1);

        // Render MCQ questions
        if (data.questions && data.questions.length > 0) {
            this.renderMCQQuestions(data.questions, content.querySelector('#ct-mcq-container'));
        }

        // Render matching exercise
        if (data.matching && data.matching.pairs && data.matching.pairs.length > 0) {
            this.renderTestMatchingExercise(data.matching, content.querySelector('#ct-matching-container'));
        }

        // Event listeners — use getElementById from document (overlay is in body)
        document.getElementById('ct-close-btn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.closeComprehensionTestOverlay();
        });
        document.getElementById('ct-minimize-btn').addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[CONTENT] 📝 Minimize clicked');
            this.minimizeComprehensionTest();
        });
        submitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.submitComprehensionTest(data);
        });
    }

    renderMCQQuestions(questions, container) {
        questions.forEach((q, qIdx) => {
            const questionDiv = document.createElement('div');
            questionDiv.className = 'ct-question';
            questionDiv.dataset.idx = qIdx;

            let optionsHTML = '';
            q.options.forEach((opt, oIdx) => {
                optionsHTML += `
                    <label class="ct-option">
                        <input type="radio" name="ct-q-${qIdx}" value="${oIdx}" class="ct-radio">
                        <span class="ct-option-text">${opt}</span>
                    </label>
                `;
            });

            questionDiv.innerHTML = `
                <div class="ct-question-header">
                    <span class="ct-question-number">${qIdx + 1}</span>
                    <span class="ct-question-text">${q.question}</span>
                </div>
                <div class="ct-options">${optionsHTML}</div>
            `;

            // Listen for radio changes
            questionDiv.querySelectorAll('.ct-radio').forEach(radio => {
                radio.addEventListener('change', () => {
                    this.comprehensionTestAnswers.questions[qIdx] = parseInt(radio.value);
                });
            });

            container.appendChild(questionDiv);
        });
    }

    renderTestMatchingExercise(matchingData, container) {
        let selectedFrEl = null;
        let selectedTrEl = null;
        const pairs = matchingData.pairs;

        // Distinct colors for each pair
        const pairColors = ['#00f3ff', '#ff00ff', '#ffa500', '#32cd32', '#ff6b6b', '#9b59b6', '#f1c40f', '#1abc9c'];
        let colorIndex = 0;

        // Map to track pairings: element -> partner element
        // Also store color per element
        this.comprehensionTestPairMap = new Map();
        const pairMap = this.comprehensionTestPairMap;
        const pairColorMap = new Map(); // element -> color

        container.innerHTML = `
            <div class="matching-container" style="position: relative !important;">
                <div class="matching-col" id="ct-col-fr"></div>
                <svg id="ct-matching-svg" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;"></svg>
                <div class="matching-col" id="ct-col-tr"></div>
            </div>
        `;

        const colFr = container.querySelector('#ct-col-fr');
        const colTr = container.querySelector('#ct-col-tr');
        const matchingContainer = container.querySelector('.matching-container');
        const svg = container.querySelector('#ct-matching-svg');

        // Shuffle arrays
        const frItems = [...pairs].sort(() => Math.random() - 0.5);
        const trItems = [...pairs].sort(() => Math.random() - 0.5);

        const drawLines = () => {
            svg.innerHTML = '';
            const containerRect = matchingContainer.getBoundingClientRect();
            const processed = new Set();

            pairMap.forEach((partner, el) => {
                if (processed.has(el)) return;
                processed.add(el);
                processed.add(partner);

                const frEl = colFr.contains(el) ? el : partner;
                const trEl = colFr.contains(el) ? partner : el;

                const frRect = frEl.getBoundingClientRect();
                const trRect = trEl.getBoundingClientRect();
                const color = pairColorMap.get(frEl) || '#00f3ff';

                const x1 = frRect.right - containerRect.left;
                const y1 = frRect.top + frRect.height / 2 - containerRect.top;
                const x2 = trRect.left - containerRect.left;
                const y2 = trRect.top + trRect.height / 2 - containerRect.top;

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', x1);
                line.setAttribute('y1', y1);
                line.setAttribute('x2', x2);
                line.setAttribute('y2', y2);
                line.setAttribute('stroke', color);
                line.setAttribute('stroke-width', '2');
                line.setAttribute('opacity', '0.8');
                svg.appendChild(line);
            });
        };

        const applyPairStyle = (el, color) => {
            el.style.setProperty('border-color', color, 'important');
            el.style.setProperty('color', color, 'important');
            el.style.setProperty('background', `${color}15`, 'important');
            el.classList.add('ct-paired');
        };

        const clearPairStyle = (el) => {
            el.style.removeProperty('border-color');
            el.style.removeProperty('color');
            el.style.removeProperty('background');
            el.classList.remove('ct-paired');
            pairColorMap.delete(el);
        };

        const tryFormPair = () => {
            if (selectedFrEl && selectedTrEl) {
                const color = pairColors[colorIndex % pairColors.length];
                colorIndex++;
                selectedFrEl.classList.remove('selected');
                selectedTrEl.classList.remove('selected');
                applyPairStyle(selectedFrEl, color);
                applyPairStyle(selectedTrEl, color);
                pairColorMap.set(selectedFrEl, color);
                pairColorMap.set(selectedTrEl, color);
                pairMap.set(selectedFrEl, selectedTrEl);
                pairMap.set(selectedTrEl, selectedFrEl);
                selectedFrEl = null;
                selectedTrEl = null;
                drawLines();
            }
        };

        const unpair = (el) => {
            const partner = pairMap.get(el);
            if (partner) {
                clearPairStyle(el);
                clearPairStyle(partner);
                pairMap.delete(el);
                pairMap.delete(partner);
                drawLines();
            }
        };

        frItems.forEach(pair => {
            const el = document.createElement('div');
            el.className = 'match-item';
            el.textContent = pair.fr;
            el.dataset.val = pair.fr;
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (el.classList.contains('ct-paired')) {
                    unpair(el);
                    return;
                }
                if (selectedFrEl) selectedFrEl.classList.remove('selected');
                el.classList.add('selected');
                selectedFrEl = el;
                tryFormPair();
            });
            colFr.appendChild(el);
        });

        trItems.forEach(pair => {
            const el = document.createElement('div');
            el.className = 'match-item';
            el.textContent = pair.tr;
            el.dataset.val = pair.fr;
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (el.classList.contains('ct-paired')) {
                    unpair(el);
                    return;
                }
                if (selectedTrEl) selectedTrEl.classList.remove('selected');
                el.classList.add('selected');
                selectedTrEl = el;
                tryFormPair();
            });
            colTr.appendChild(el);
        });
    }

    submitComprehensionTest(testData) {
        const answers = this.comprehensionTestAnswers;

        // Calculate MCQ score (unanswered = wrong)
        let mcqCorrect = 0;
        const mcqTotal = testData.questions.length;
        testData.questions.forEach((q, idx) => {
            if (answers.questions[idx] === q.correct) {
                mcqCorrect++;
            }
        });

        // Calculate matching score from pairMap
        const pairMap = this.comprehensionTestPairMap || new Map();
        const totalPairs = testData.matching ? testData.matching.pairs.length : 0;
        let matchingCorrect = 0;
        const processed = new Set();

        pairMap.forEach((partner, el) => {
            if (processed.has(el)) return;
            processed.add(el);
            processed.add(partner);

            // Determine which is FR col and which is TR col
            const overlay = document.getElementById('daspalecte-comprehension-test-overlay');
            const colFr = overlay ? overlay.querySelector('#ct-col-fr') : null;
            if (!colFr) return;

            const frEl = colFr.contains(el) ? el : partner;
            const trEl = colFr.contains(el) ? partner : el;

            if (frEl.dataset.val === trEl.dataset.val) {
                frEl.classList.add('ct-correct');
                trEl.classList.add('ct-correct');
                matchingCorrect++;
            } else {
                frEl.classList.add('ct-incorrect');
                trEl.classList.add('ct-incorrect');
            }
        });

        // Mark unpaired items as incorrect
        const overlay = document.getElementById('daspalecte-comprehension-test-overlay');
        if (overlay) {
            overlay.querySelectorAll('#ct-col-fr .match-item, #ct-col-tr .match-item').forEach(el => {
                if (!el.classList.contains('ct-correct') && !el.classList.contains('ct-incorrect')) {
                    el.classList.add('ct-incorrect');
                }
            });
        }

        const totalScore = mcqCorrect + matchingCorrect;
        const totalMax = mcqTotal + totalPairs;
        const percentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

        // Visual feedback on MCQ questions
        if (overlay) {
            // Show page 1 for MCQ feedback
            const page1 = overlay.querySelector('#ct-page-1');
            const page2 = overlay.querySelector('#ct-page-2');
            if (page1) page1.style.display = 'block';
            if (page2) page2.style.display = 'block';

            // Hide step indicator and nav
            const stepIndicator = overlay.querySelector('#ct-step-indicator');
            if (stepIndicator) stepIndicator.textContent = 'Résultats';
            const nav = overlay.querySelector('.ct-nav');
            if (nav) nav.style.display = 'none';

            testData.questions.forEach((q, idx) => {
                const questionDiv = overlay.querySelector(`.ct-question[data-idx="${idx}"]`);
                if (!questionDiv) return;

                const options = questionDiv.querySelectorAll('.ct-option');
                options.forEach((opt, oIdx) => {
                    if (oIdx === q.correct) {
                        opt.classList.add('ct-correct');
                    } else if (oIdx === answers.questions[idx] && oIdx !== q.correct) {
                        opt.classList.add('ct-incorrect');
                    }
                });

                // Disable radio buttons
                questionDiv.querySelectorAll('.ct-radio').forEach(r => r.disabled = true);
            });

            // Show results in footer
            const footer = overlay.querySelector('.ct-footer');
            if (footer) {
                const resultsDiv = document.createElement('div');
                resultsDiv.className = 'ct-results';
                resultsDiv.innerHTML = `
                    <div class="ct-score-display">
                        <div class="ct-score-circle ${percentage >= 70 ? 'ct-score-good' : percentage >= 50 ? 'ct-score-ok' : 'ct-score-bad'}">
                            <span class="ct-score-number">${percentage}%</span>
                        </div>
                        <div class="ct-score-details">
                            <p>QCM : ${mcqCorrect} / ${mcqTotal}</p>
                            <p>Appariement : ${matchingCorrect} / ${totalPairs}</p>
                            <p class="ct-score-total">Total : ${totalScore} / ${totalMax}</p>
                        </div>
                    </div>
                    <button class="ex-btn primary" id="ct-close-results-btn">Fermer le test</button>
                `;
                footer.appendChild(resultsDiv);
                footer.querySelector('#ct-close-results-btn').onclick = () => this.closeComprehensionTestOverlay();
            }
        }

        // Send score via Cloud Function
        console.log('[CONTENT] 📧 Envoi du score au professeur...', { mcqCorrect, mcqTotal, matchingCorrect, totalPairs, percentage });
        this.sendScoreToTeacher(mcqCorrect, mcqTotal, matchingCorrect, totalPairs, percentage);
    }

    async sendScoreToTeacher(mcqCorrect, mcqTotal, matchingScore, matchingTotal, percentage) {
        try {
            await fetch('https://script.google.com/macros/s/AKfycbw-kVeRoxGDjnqy6AoGp3gA8rp68IOCj6_qBwPWURYMoIh15gVCzLrvAx6Wrkv9DJxu8Q/exec', {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    studentEmail: this.studentEmail,
                    mcqScore: mcqCorrect,
                    mcqTotal: mcqTotal,
                    matchingScore: matchingScore,
                    matchingTotal: matchingTotal,
                    percentage: percentage,
                    pageUrl: window.location.href,
                    pageTitle: document.title
                })
            });
            console.log('[CONTENT] ✅ Score envoyé vers Google Sheets');
        } catch (error) {
            console.error('[CONTENT] ❌ Erreur envoi score:', error);
        }
    }

    minimizeComprehensionTest() {
        const overlay = document.getElementById('daspalecte-comprehension-test-overlay');
        if (overlay) {
            overlay.style.setProperty('display', 'none', 'important');
            this.comprehensionTestMinimized = true;
            // Notify sidepanel to show restore button
            this.sendMessageToSidepanel({ type: 'COMPREHENSION_TEST_MINIMIZED' });
        }
    }

    restoreComprehensionTest() {
        const overlay = document.getElementById('daspalecte-comprehension-test-overlay');
        if (overlay) {
            overlay.style.setProperty('display', 'flex', 'important');
            this.comprehensionTestMinimized = false;
            // Notify sidepanel to hide restore button
            this.sendMessageToSidepanel({ type: 'COMPREHENSION_TEST_RESTORED' });
        }
    }

    closeComprehensionTestOverlay() {
        const overlay = document.getElementById('daspalecte-comprehension-test-overlay');
        if (overlay) overlay.remove();

        this.comprehensionTestMinimized = false;
        this.comprehensionTestData = null;
        this.comprehensionTestAnswers = { questions: [], matching: [] };
        this.comprehensionTestPairMap = new Map();

        // Notify sidepanel to reset toggle and hide restore button
        this.sendMessageToSidepanel({ type: 'COMPREHENSION_TEST_CLOSED' });
    }

    disableAllLinks() {
        const links = document.querySelectorAll('a');
        links.forEach(link => {
            link.setAttribute('data-daspalecte-href', link.href);
            link.removeAttribute('href');
            link.style.cursor = 'help';
            link.style.pointerEvents = 'auto';
        });
    }

    enableAllLinks() {
        const links = document.querySelectorAll('a[data-daspalecte-href]');
        links.forEach(link => {
            link.href = link.getAttribute('data-daspalecte-href');
            link.removeAttribute('data-daspalecte-href');
            link.style.cursor = '';
            link.style.pointerEvents = '';
        });
    }

    getWordAtPosition(e) {
        const range = document.caretRangeFromPoint(e.clientX, e.clientY);
        if (!range) return null;

        const textNode = range.startContainer;
        if (textNode.nodeType !== Node.TEXT_NODE) return null;

        const text = textNode.textContent;
        const offset = range.startOffset;

        // Trouver les limites du mot (on évite \b qui gère mal les accents car ils sont vus comme des séparateurs par défaut)
        // On cherche des séquences de caractères alphanumériques incluant accents, ligatures (œ, æ) et apostrophe
        const wordRegex = /[a-zA-Z0-9àâäéèêëïîôùûüÿçœæÀÂÄÉÈÊËÏÎÔÙÛÜŸÇŒÆ']+/g;
        let match;

        while ((match = wordRegex.exec(text)) !== null) {
            // On vérifie si l'offset est à l'intérieur ou juste au bord du mot
            if (offset >= match.index && offset <= match.index + match[0].length) {
                return {
                    text: match[0],
                    node: textNode,
                    start: match.index,
                    end: match.index + match[0].length
                };
            }
        }

        return null;
    }

    async handleWordClick(wordInfo, event) {
        // Créer le wrapper pour le nouveau mot
        const newWrapper = this.wrapWord(wordInfo);

        // Chercher TOUS les mots déjà traduits sur la même ligne
        const sameLineWords = this.findWordsOnSameLine(newWrapper);

        if (sameLineWords.length > 0) {
            console.log('Mots trouvés sur la même ligne:', sameLineWords.map(w => w.text));
            // Fusionner avec les mots de la même ligne
            await this.createGroupTranslation(newWrapper, sameLineWords);
        } else {
            // Mot isolé
            await this.addTranslation(newWrapper, wordInfo.text);
        }
    }

    findWordsOnSameLine(newElement) {
        const newRect = newElement.getBoundingClientRect();
        const sameLineWords = [];

        this.selectedWords.forEach(element => {
            if (element !== newElement) {
                const elementRect = element.getBoundingClientRect();

                // Vérifier si sur la même ligne (tolérance de 20px)
                const heightOverlap = Math.abs(newRect.top - elementRect.top) < 20;

                // Calculer l'espace (gap) horizontal entre les deux mots
                const horizontalGap = Math.max(0, newRect.left - elementRect.right, elementRect.left - newRect.right);
                const isClose = horizontalGap < 25;

                if (heightOverlap && isClose) {
                    sameLineWords.push({
                        element: element,
                        left: elementRect.left,
                        text: this.extractWordText(element)
                    });
                }
            }
        });

        return sameLineWords;
    }

    extractWordText(element) {
        // Extraire juste le mot, pas la traduction
        const childNodes = Array.from(element.childNodes);
        for (let node of childNodes) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                return node.textContent.trim();
            }
        }
        return element.textContent.replace(/\n.*/, '').trim();
    }

    async createGroupTranslation(newElement, sameLineWords) {
        // Ajouter le nouveau mot
        const allWords = [...sameLineWords, {
            element: newElement,
            left: newElement.getBoundingClientRect().left,
            text: newElement.textContent.trim()
        }];

        // Trier de gauche à droite
        allWords.sort((a, b) => a.left - b.left);

        // Créer la phrase complète
        const completeText = allWords.map(w => w.text).join(' ');
        console.log('Texte complet à traduire:', completeText);

        // Supprimer TOUTES les traductions existantes
        allWords.forEach(word => {
            const existingTranslation = word.element.querySelector('.daspalecte-translation');
            if (existingTranslation) {
                existingTranslation.remove();
                console.log('Suppression traduction existante pour:', word.text);
            }
            word.element.classList.remove('selected');
            this.selectedWords.delete(word.element);
        });

        // Ajouter UNE SEULE nouvelle traduction sur le premier mot
        const firstElement = allWords[0].element;
        console.log('Ajout traduction sur le premier élément:', allWords[0].text);

        await this.addTranslation(firstElement, completeText);

        // Marquer tous les éléments comme sélectionnés
        allWords.forEach((word, index) => {
            word.element.classList.add('selected');
            this.selectedWords.add(word.element);

            if (index > 0) {
                word.element.setAttribute('data-group', 'true');
            }
        });
    }

    wrapWord(wordInfo) {
        const wrapper = document.createElement('span');
        wrapper.className = 'daspalecte-word';
        wrapper.style.position = 'relative';

        const range = document.createRange();
        range.setStart(wordInfo.node, wordInfo.start);
        range.setEnd(wordInfo.node, wordInfo.end);

        try {
            range.surroundContents(wrapper);
            return wrapper;
        } catch (e) {
            // Si ça échoue, créer manuellement
            const wordText = wordInfo.text;
            const textBefore = wordInfo.node.textContent.substring(0, wordInfo.start);
            const textAfter = wordInfo.node.textContent.substring(wordInfo.end);

            wrapper.textContent = wordText;

            const parent = wordInfo.node.parentNode;
            const beforeNode = document.createTextNode(textBefore);
            const afterNode = document.createTextNode(textAfter);

            parent.insertBefore(beforeNode, wordInfo.node);
            parent.insertBefore(wrapper, wordInfo.node);
            parent.insertBefore(afterNode, wordInfo.node);
            parent.removeChild(wordInfo.node);

            return wrapper;
        }
    }

    async addTranslation(wordElement, text) {
        // Afficher un indicateur de chargement
        const loadingElement = document.createElement('div');
        loadingElement.className = 'daspalecte-translation daspalecte-loading';
        loadingElement.textContent = '⏳';
        wordElement.appendChild(loadingElement);

        try {
            const translation = await this.translateText(text);

            // Remplacer l'indicateur de chargement par la traduction
            loadingElement.remove();

            const translationElement = document.createElement('div');
            translationElement.className = 'daspalecte-translation';

            const translationText = document.createElement('span');
            translationText.className = 'daspalecte-translation-text';
            translationText.textContent = translation;

            const speakBtn = document.createElement('span');
            speakBtn.className = 'daspalecte-speak-btn';
            speakBtn.textContent = '\u{1F50A}';
            speakBtn.dataset.word = text;

            translationElement.appendChild(translationText);
            translationElement.appendChild(speakBtn);

            wordElement.appendChild(translationElement);
            wordElement.classList.add('selected');

            this.selectedWords.add(wordElement);
            this.translations.set(wordElement, translationElement);

            // Envoyer au sidepanel iframe
            this.sendMessageToSidepanel({
                type: 'WORD_SELECTED',
                word: text,
                translation: translation
            });

        } catch (error) {
            loadingElement.textContent = '❌';
            loadingElement.className = 'daspalecte-translation daspalecte-error';
            console.error('Translation error:', error);
        }
    }

    removeTranslation(translationElement) {
        const wordElement = translationElement.parentElement;

        // Trouver tous les éléments du groupe
        const groupElements = [wordElement];

        // Si c'est un élément principal du groupe, trouver tous les éléments liés
        this.selectedWords.forEach(element => {
            if (element !== wordElement &&
                (element.hasAttribute('data-group') ||
                    wordElement.hasAttribute('data-group'))) {
                groupElements.push(element);
            }
        });

        // Nettoyer tous les éléments du groupe
        groupElements.forEach(element => {
            const translation = element.querySelector('.daspalecte-translation');
            if (translation) {
                translation.remove();
            }

            element.classList.remove('selected');
            element.removeAttribute('data-group');
            this.selectedWords.delete(element);
            this.translations.delete(element);

            // Déwrapper si nécessaire
            if (element.children.length === 0) {
                const parent = element.parentNode;
                if (parent && element.parentNode) {
                    while (element.firstChild) {
                        parent.insertBefore(element.firstChild, element);
                    }
                    parent.removeChild(element);
                }
            }
        });
    }

    clearAllTranslations() {
        // Créer une copie du Set pour éviter les modifications pendant l'itération
        const elementsToClean = Array.from(this.selectedWords);

        elementsToClean.forEach(wordElement => {
            // Supprimer la traduction
            const translationElement = wordElement.querySelector('.daspalecte-translation');
            if (translationElement) {
                translationElement.remove();
            }

            // Nettoyer les classes et attributs
            wordElement.classList.remove('selected');
            wordElement.removeAttribute('data-group');

            // Déwrapper l'élément (remettre le texte original)
            if (wordElement.parentNode) {
                const parent = wordElement.parentNode;

                // Déplacer tous les enfants (texte) vers le parent
                while (wordElement.firstChild) {
                    parent.insertBefore(wordElement.firstChild, wordElement);
                }

                // Supprimer le wrapper maintenant vide
                parent.removeChild(wordElement);
            }
        });

        // Vider les collections
        this.selectedWords.clear();
        this.translations.clear();

        // Réactiver tous les liens au cas où
        this.enableAllLinks();

        console.log('Toutes les traductions ont été supprimées');
    }

    async translateText(text) {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${this.sourceLang}&tl=${this.targetLang}&dt=t&q=${encodeURIComponent(text)}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data && data[0] && data[0][0] && data[0][0][0]) {
                return data[0][0][0];
            } else {
                throw new Error('Réponse invalide de l\'API de traduction');
            }
        } catch (error) {
            throw new Error('Impossible de traduire le texte');
        }
    }
}

// Initialiser l'extension quand le DOM est prêt
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new DaspalecteTranslator();
    });
} else {
    new DaspalecteTranslator();
}
