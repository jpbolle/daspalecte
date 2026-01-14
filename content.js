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
            
            // Déplacer l'onglet à gauche du panneau
            if (this.toggleButton) {
                this.toggleButton.classList.add('panel-open');
            }
        }
    }

    hideSidepanel() {
        const container = document.getElementById('daspalecte-sidepanel-container');
        if (container) {
            container.classList.remove('daspalecte-visible');
            container.classList.add('daspalecte-hidden');
            this.sidepanelVisible = false;
            
            // Remettre l'onglet à l'extrémité droite
            if (this.toggleButton) {
                this.toggleButton.classList.remove('panel-open');
            }
        }
    }

    closeExtension() {
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

        // 2. Fermer l'overlay d'exercices si ouvert (sans restaurer le traducteur)
        this.translatorStateBeforeExercises = false; // Annuler la restauration
        this.closeExerciseOverlay();

        // 3. Mettre à jour le storage pour refléter l'état désactivé
        chrome.storage.local.set({
            translatorEnabled: false,
            comprehensionEnabled: false
        });

        // 4. Fermer le panneau
        this.hideSidepanel();

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
    }

    sendMessageToSidepanel(message) {
        if (this.sidepanelIframe && this.sidepanelIframe.contentWindow) {
            this.sidepanelIframe.contentWindow.postMessage(message, '*');
        }
    }

    handleSidepanelMessage(message) {
        // Gérer les messages venant du sidepanel iframe
        console.log('[CONTENT] 📨 Message reçu du sidepanel:', message.type);

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
        }
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
                // Ne pas changer le curseur sur les liens
                if (e.target.tagName !== 'A' && !e.target.closest('a')) {
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
            translationElement.textContent = translation;

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
