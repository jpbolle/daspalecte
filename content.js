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
        this.currentTheme = 'cyberpunk';
        this.readingRate = 0.85; // vitesse de lecture de l'exercice "Lecture" (synthèse vocale)
        this.initTheme();
        this.init();
    }

    // Apply theme to the page's <html> for CSS variables
    initTheme() {
        chrome.storage.local.get(['theme'], (data) => {
            this.currentTheme = data.theme || 'cyberpunk';
            document.documentElement.setAttribute('data-daspalecte-theme', this.currentTheme);
        });
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.theme) {
                this.currentTheme = changes.theme.newValue || 'cyberpunk';
                document.documentElement.setAttribute('data-daspalecte-theme', this.currentTheme);
            }
        });
    }

    // Get theme-aware colors for inline styles
    getThemeColors() {
        if (this.currentTheme === 'classica') {
            return {
                primary: '#2d6a5a',
                primaryHover: '#357a68',
                accent: '#d4944c',
                bg: '#faf6f0',
                bgCard: '#ffffff',
                text: '#3d3832',
                shadow: '0 2px 8px rgba(0,0,0,0.1)',
                shadowHover: '0 2px 12px rgba(0,0,0,0.15)',
                primaryAlpha20: 'rgba(45, 106, 90, 0.2)',
                primaryAlpha30: 'rgba(45, 106, 90, 0.3)',
                primaryAlpha50: 'rgba(45, 106, 90, 0.5)',
            };
        }
        return {
            primary: '#00f3ff',
            primaryHover: '#4df7ff',
            accent: '#e879f9',
            bg: '#0a0b1e',
            bgCard: '#11122d',
            text: '#ffffff',
            shadow: '0 0 20px rgba(0, 243, 255, 0.3), inset 0 0 20px rgba(0, 243, 255, 0.05)',
            shadowHover: '0 0 30px rgba(0, 243, 255, 0.5), inset 0 0 30px rgba(0, 243, 255, 0.1)',
            primaryAlpha20: 'rgba(0, 243, 255, 0.2)',
            primaryAlpha30: 'rgba(0, 243, 255, 0.3)',
            primaryAlpha50: 'rgba(0, 243, 255, 0.5)',
        };
    }

    // Check if we are inside the Daspalecte PDF viewer
    isPdfViewer() {
        return !!document.getElementById('pdf-container');
    }

    // Detect if the current page is a PDF displayed by the native viewer
    isPDFPage() {
        // Never trigger on our own PDF viewer page
        if (location.href.startsWith('chrome-extension://')) return false;
        if (document.contentType === 'application/pdf') return true;
        if (document.querySelector('embed[type="application/pdf"]')) return true;
        if (location.href.toLowerCase().endsWith('.pdf')) return true;
        return false;
    }

    // Show a floating button to open the PDF in Daspalecte's viewer
    showPDFActivationButton() {
        // Don't show if we're already in our viewer
        if (location.href.includes(chrome.runtime.id)) return;

        // Éviter un doublon si la fonction est appelée plusieurs fois pour la même page
        if (document.getElementById('daspalecte-pdf-btn')) return;

        const btn = document.createElement('div');
        btn.id = 'daspalecte-pdf-btn';
        const tc = this.getThemeColors();
        btn.style.cssText = `
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 2147483647;
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 16px;
            background: ${this.currentTheme === 'classica' ? 'rgba(255,255,255,0.95)' : 'rgba(10, 11, 30, 0.95)'};
            border: 2px solid ${tc.primary};
            border-radius: 12px;
            color: ${tc.primary};
            font-family: 'Inter', 'Segoe UI', sans-serif;
            font-size: 14px;
            font-weight: 600;
            cursor: grab;
            backdrop-filter: blur(10px);
            box-shadow: ${tc.shadow};
            transition: box-shadow 0.3s ease, border-color 0.3s ease;
            user-select: none;
        `;
        btn.innerHTML = `
            <img src="${chrome.runtime.getURL('icon48.png')}" style="width:28px;height:28px;pointer-events:none;">
            <span style="pointer-events:none;">Ouvrir avec Daspalecte</span>
            <span id="daspalecte-pdf-close" style="
                margin-left:6px; font-size:15px; line-height:1; opacity:0.5;
                cursor:pointer; padding:2px 5px; border-radius:4px;
                transition: opacity 0.2s, background 0.2s;
            ">✕</span>
        `;

        // Close button
        const closeBtn = btn.querySelector('#daspalecte-pdf-close');
        closeBtn.addEventListener('mouseenter', () => { closeBtn.style.opacity = '1'; closeBtn.style.background = 'rgba(255,60,60,0.25)'; });
        closeBtn.addEventListener('mouseleave', () => { closeBtn.style.opacity = '0.5'; closeBtn.style.background = 'transparent'; });
        closeBtn.addEventListener('click', (e) => { e.stopPropagation(); btn.remove(); });

        // Drag logic
        let isDragging = false, dragMoved = false, dragOffsetX = 0, dragOffsetY = 0;

        btn.addEventListener('mousedown', (e) => {
            if (e.target.id === 'daspalecte-pdf-close') return;
            isDragging = true;
            dragMoved = false;
            const rect = btn.getBoundingClientRect();
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
            btn.style.cursor = 'grabbing';
            btn.style.transition = 'none';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            dragMoved = true;
            btn.style.left = (e.clientX - dragOffsetX) + 'px';
            btn.style.top  = (e.clientY - dragOffsetY) + 'px';
            btn.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            btn.style.cursor = 'grab';
            btn.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
        });

        // Open PDF viewer on click (not after a drag)
        btn.addEventListener('click', (e) => {
            if (e.target.id === 'daspalecte-pdf-close') return;
            if (dragMoved) { dragMoved = false; return; }
            let pdfUrl = location.href;
            const adobeMatch = pdfUrl.match(/^chrome-extension:\/\/[a-z]+\/(https?:\/\/.+)$/i);
            if (adobeMatch) pdfUrl = adobeMatch[1];
            const viewerUrl = chrome.runtime.getURL('pdfviewer.html') + '?url=' + encodeURIComponent(pdfUrl);
            location.href = viewerUrl;
        });

        btn.addEventListener('mouseenter', () => {
            if (!isDragging) { btn.style.boxShadow = tc.shadowHover; btn.style.borderColor = tc.primaryHover; }
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.boxShadow = tc.shadow; btn.style.borderColor = tc.primary;
        });

        document.body.appendChild(btn);
    }

    async init() {
        // Detect PDF pages — show activation button instead of normal setup
        if (this.isPDFPage()) {
            this.showPDFActivationButton();
            return;
        }

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

        // Listen for PDF viewer ready event — re-inject magic buttons if comprehension is active
        document.addEventListener('daspalecte-pdf-ready', () => {
            if (this.isComprehensionEnabled) {
                this.removeMagicButtons();
                this.injectMagicButtons();
            }
        });

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
            } else if (message.type === 'SHOW_ROADMAP') {
                this.showRoadmapOverlay();
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
        } else if (message.type === 'START_SCREEN_CAPTURE') {
            this.startScreenCapture(message.nativeLanguage);
        } else if (message.type === 'SPEAK_FRENCH') {
            this.speakFrench(message.text);
        } else if (message.type === 'TTS_WORD_BOUNDARY') {
            // La minuterie estimée pilote déjà la surbrillance (voir startReadingTTS) : ces évènements
            // ne servent que de rattrapage si elle a pris du retard, jamais à la faire reculer
            // (voir la garde dans advanceReadingHighlightToCharIndex).
            if (typeof message.charIndex === 'number') {
                this.advanceReadingHighlightToCharIndex(message.charIndex);
            }
        } else if (message.type === 'TTS_READING_ENDED') {
            this.finishReadingAloud();
        }
    }

    // Termine proprement la lecture à voix haute (bouton, surbrillance, révélation de l'enregistrement).
    // Appelé soit par le vrai évènement 'end' du moteur TTS, soit par le filet de sécurité
    // scheduleReadingEndFallback() quand ce moteur ne renvoie jamais cet évènement.
    finishReadingAloud() {
        this.isReadingAloud = false;
        this.isReadingPaused = false;
        this.clearReadingFallbackTimer();
        this.clearReadingHighlight();
        this.refreshReadingPlayButton();
        // Révèle la section d'enregistrement après une première lecture complète (exercice Lecture)
        if (this.onReadingFinishedOnce) this.onReadingFinishedOnce();
    }

    speakFrench(text) {
        chrome.runtime.sendMessage({ type: 'SPEAK_FRENCH', text });
    }

    // ============================================
    // EXERCICE LECTURE — synthèse vocale + surbrillance mot-à-mot
    // ============================================

    escapeHtmlForReading(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Découpe le texte en phrases (une ligne par phrase, chacune avec sa propre synthèse vocale) :
    // un split simple sur la ponctuation forte suivie d'espace/fin de texte suffit pour les textes
    // courts et simples générés pour cet exercice, pas besoin d'une vraie segmentation linguistique.
    splitIntoSentences(text) {
        const matches = text.match(/[^.!?…]+[.!?…]+(\s+|$)|[^.!?…]+$/g) || [text];
        return matches.map(s => s.trim()).filter(Boolean);
    }

    // Découpe le texte en mots (spans individuels), en conservant espaces/ponctuation intacts et
    // en repérant les segments entre parenthèses (traductions) qui ne doivent pas être lus à voix haute.
    buildReadingWordSpans(text) {
        const parenRanges = [];
        const parenRegex = /\([^)]*\)/g;
        let parenMatch;
        while ((parenMatch = parenRegex.exec(text)) !== null) {
            parenRanges.push([parenMatch.index, parenMatch.index + parenMatch[0].length]);
        }
        const isInParens = (pos) => parenRanges.some(([start, end]) => pos >= start && pos < end);

        const regex = /[\p{L}\p{M}'’-]+/gu;
        let html = '';
        let lastIndex = 0;
        let match;
        const words = [];

        while ((match = regex.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            const spoken = !isInParens(start);
            html += this.escapeHtmlForReading(text.slice(lastIndex, start));
            html += `<span class="reading-word${spoken ? '' : ' reading-word-translation'}">${this.escapeHtmlForReading(match[0])}</span>`;
            words.push({ start, end, text: match[0], spoken });
            lastIndex = end;
        }
        html += this.escapeHtmlForReading(text.slice(lastIndex));

        return { html, words };
    }

    // Repère la position (index de caractère) de chaque mot dans le texte réellement envoyé au
    // moteur TTS (parenthèses déjà retirées), dans le même ordre que les mots "spoken" de readingWordsData.
    computeSpokenTextOffsets(spokenText) {
        const regex = /[\p{L}\p{M}'’-]+/gu;
        const offsets = [];
        let match;
        while ((match = regex.exec(spokenText)) !== null) {
            offsets.push({ start: match.index, end: match.index + match[0].length });
        }
        return offsets;
    }

    startReadingTTS(text) {
        this.isReadingAloud = true;
        this.isReadingPaused = false;
        this.readingSpokenIndex = -1;
        this.clearReadingFallbackTimer();
        this.clearReadingHighlight();

        // Ne pas faire lire les traductions entre parenthèses
        const spokenText = text.replace(/\([^)]*\)/g, ' ');
        chrome.runtime.sendMessage({ type: 'SPEAK_TEXT_TRACKED', text: spokenText, rate: this.readingRate });

        // La surbrillance est pilotée par une minuterie estimée (mots/minute), démarrée immédiatement,
        // plutôt que par les évènements de limite de mot du moteur TTS : sur certaines voix (ex. voix
        // systeme via chrome.tts), ces évènements arrivent jusqu'à ~1s après que le mot ait été
        // réellement prononcé, ce qui rendait la surbrillance visiblement en retard sur la voix.
        // Les évènements réels restent utilisés (voir TTS_WORD_BOUNDARY) pour rattraper la minuterie
        // si elle prend du retard, mais ne la font jamais reculer.
        this.startReadingFallbackTimer();
    }

    stopReadingTTS() {
        this.isReadingAloud = false;
        this.isReadingPaused = false;
        this.clearReadingFallbackTimer();
        this.clearReadingHighlight();
        chrome.runtime.sendMessage({ type: 'STOP_TTS_TRACKED' });
    }

    pauseReadingTTS() {
        this.isReadingPaused = true;
        chrome.runtime.sendMessage({ type: 'PAUSE_TTS_TRACKED' });
    }

    resumeReadingTTS() {
        this.isReadingPaused = false;
        chrome.runtime.sendMessage({ type: 'RESUME_TTS_TRACKED' });
    }

    refreshReadingPlayButton() {
        if (!this.currentReadingPlayBtn) return;
        if (!this.isReadingAloud) {
            this.currentReadingPlayBtn.innerHTML = '🔊';
        } else if (this.isReadingPaused) {
            this.currentReadingPlayBtn.innerHTML = '▶';
        } else {
            this.currentReadingPlayBtn.innerHTML = '⏸';
        }
    }

    // Estimation grossière du temps de prononciation d'un mot : proportionnelle à sa longueur
    // (un mot court se dit plus vite qu'un mot long), calée sur ~175 mots/minute à vitesse 1x.
    // Approximation sans aucun retour réel de la voix — ne peut pas être parfaitement synchronisée.
    estimateWordDurationMs(word) {
        const baseMsPerWord = 60000 / (175 * this.readingRate);
        const lengthFactor = Math.max(0.6, Math.min(2, word.length / 5));
        return baseMsPerWord * lengthFactor;
    }

    // Estimation de la progression par minuterie, pour les voix qui ne remontent pas
    // d'évènements de limite de mot (fallback silencieux, pas d'échec visible pour l'élève)
    startReadingFallbackTimer() {
        this.clearReadingFallbackTimer();

        const scheduleNext = () => {
            if (this.isReadingPaused) {
                this.readingFallbackTimer = setTimeout(scheduleNext, 150);
                return;
            }
            this.advanceReadingHighlight();
            if (!this.readingWordsData || this.readingSpokenIndex >= this.readingWordsData.length - 1) {
                this.readingFallbackTimer = null;
                return;
            }
            const currentWord = this.readingWordsData[this.readingSpokenIndex];
            const nextWord = this.readingWordsData[this.readingSpokenIndex + 1];
            const pauseMs = currentWord && currentWord.pauseAfterMs ? currentWord.pauseAfterMs / this.readingRate : 0;
            this.readingFallbackTimer = setTimeout(scheduleNext, this.estimateWordDurationMs(nextWord.text) + pauseMs);
        };

        scheduleNext();
    }

    clearReadingFallbackTimer() {
        if (this.readingFallbackTimer) {
            clearTimeout(this.readingFallbackTimer);
            this.readingFallbackTimer = null;
        }
        if (this.readingEndFallbackTimer) {
            clearTimeout(this.readingEndFallbackTimer);
            this.readingEndFallbackTimer = null;
        }
    }

    // Filet de sécurité : certaines voix ne renvoient jamais d'évènement 'end' (ni 'interrupted',
    // ni 'error') après avoir prononcé le dernier mot, ce qui bloquait la suite de l'exercice
    // (bouton coincé sur "Pause", enregistrement jamais révélé). On force la fin de lecture nous-même
    // peu après avoir surligné le dernier mot, si aucun véritable évènement de fin n'est arrivé entretemps.
    scheduleReadingEndFallback() {
        if (this.readingEndFallbackTimer) clearTimeout(this.readingEndFallbackTimer);
        const lastWord = this.readingWordsData[this.readingWordsData.length - 1];
        const buffer = (lastWord ? this.estimateWordDurationMs(lastWord.text) : 600) + 900;
        this.readingEndFallbackTimer = setTimeout(() => {
            this.readingEndFallbackTimer = null;
            if (this.isReadingAloud) this.finishReadingAloud();
        }, buffer);
    }

    // Avance la surbrillance au mot suivant réellement prononcé (parenthèses déjà exclues en amont)
    advanceReadingHighlight() {
        if (!this.readingWordsData || !this.readingWordsData.length) return;
        this.readingSpokenIndex++;
        this.clearReadingHighlight();
        const word = this.readingWordsData[this.readingSpokenIndex];
        if (word && word.element) {
            word.element.classList.add('reading-word-active');
            word.element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        if (this.readingSpokenIndex >= this.readingWordsData.length - 1) {
            this.scheduleReadingEndFallback();
        }
    }

    clearReadingHighlight() {
        if (!this.readingWordsData) return;
        this.readingWordsData.forEach(w => w.element.classList.remove('reading-word-active'));
    }

    // Rattrapage : ne fait avancer la surbrillance (pilotée par la minuterie estimée) que si la
    // position rapportée par le moteur TTS est déjà plus avancée que la minuterie ; ne la fait
    // jamais reculer, car ces évènements peuvent arriver après coup (voir startReadingTTS).
    advanceReadingHighlightToCharIndex(charIndex) {
        if (!this.readingWordsData || !this.readingWordsData.length) return;
        let idx = this.readingWordsData.findIndex(w => w.spokenStart !== undefined && w.spokenStart > charIndex);
        idx = idx === -1 ? this.readingWordsData.length - 1 : Math.max(0, idx - 1);
        if (idx <= this.readingSpokenIndex) return; // ne jamais revenir en arrière
        this.readingSpokenIndex = idx;
        this.clearReadingHighlight();
        const word = this.readingWordsData[idx];
        if (word && word.element) {
            word.element.classList.add('reading-word-active');
            word.element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        if (idx >= this.readingWordsData.length - 1) {
            this.scheduleReadingEndFallback();
        }
    }

    // Arrête toute lecture/enregistrement en cours (changement d'exercice, fermeture de l'overlay)
    stopReadingActivity() {
        if (this.isReadingAloud) {
            this.stopReadingTTS();
        }
        if (this.isRecordingReading && this.currentReadingRecognition) {
            this.currentReadingRecognition.stop();
        }
        if (this.readingRevealTimeout) {
            clearTimeout(this.readingRevealTimeout);
            this.readingRevealTimeout = null;
        }
        this.onReadingFinishedOnce = null;
    }

    // --- Enregistrement de la lecture de l'élève (reconnaissance vocale + alignement) ---

    toggleReadingRecording(button, feedbackEl, onComplete) {
        if (this.isRecordingReading) {
            this.currentReadingRecognition && this.currentReadingRecognition.stop();
            return;
        }
        this.startReadingRecording(button, feedbackEl, onComplete);
    }

    startReadingRecording(button, feedbackEl, onComplete) {
        const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognitionCtor) {
            feedbackEl.style.display = 'block';
            feedbackEl.textContent = "La reconnaissance vocale n'est pas disponible sur ce navigateur.";
            return;
        }

        // Une seule activité (lecture ou enregistrement) à la fois
        this.stopReadingTTS();
        this.refreshReadingPlayButton();

        const recognition = new SpeechRecognitionCtor();
        recognition.lang = 'fr-FR';
        recognition.continuous = true;
        recognition.interimResults = false;

        let finalTranscript = '';

        recognition.onresult = (event) => {
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                }
            }
        };

        recognition.onerror = (event) => {
            console.error('[CONTENT] Erreur reconnaissance vocale:', event.error);
            feedbackEl.style.display = 'block';
            feedbackEl.textContent = event.error === 'not-allowed'
                ? "Micro refusé — autorise l'accès au micro pour utiliser cette fonction."
                : 'Erreur de reconnaissance vocale, réessaie.';
        };

        recognition.onend = () => {
            this.isRecordingReading = false;
            this.currentReadingRecognition = null;
            button.classList.remove('recording');
            button.innerHTML = '🎤 Enregistrer ma lecture';
            if (finalTranscript.trim()) {
                this.showReadingPronunciationFeedback(finalTranscript.trim(), feedbackEl);
            }
            // L'élève s'est enregistré (que la reconnaissance ait ou non capté du texte)
            if (onComplete) onComplete();
        };

        this.currentReadingRecognition = recognition;
        this.isRecordingReading = true;
        button.classList.add('recording');
        button.innerHTML = "⏹ Arrêter l'enregistrement";
        feedbackEl.style.display = 'none';
        recognition.start();
    }

    normalizeReadingWord(word) {
        return word
            .toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9']/g, '');
    }

    // Alignement mot-à-mot (plus longue sous-séquence commune) entre le texte de référence
    // et la transcription reconnue — ne nécessite aucun appel IA.
    alignReadingWords(referenceWords, recognizedWords) {
        const ref = referenceWords.map(w => this.normalizeReadingWord(w));
        const rec = recognizedWords.map(w => this.normalizeReadingWord(w));
        const m = ref.length, n = rec.length;
        const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                if (ref[i - 1] && ref[i - 1] === rec[j - 1]) {
                    dp[i][j] = dp[i - 1][j - 1] + 1;
                } else {
                    dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
                }
            }
        }

        const matched = new Array(m).fill(false);
        let i = m, j = n;
        while (i > 0 && j > 0) {
            if (ref[i - 1] && ref[i - 1] === rec[j - 1]) {
                matched[i - 1] = true;
                i--; j--;
            } else if (dp[i - 1][j] >= dp[i][j - 1]) {
                i--;
            } else {
                j--;
            }
        }
        return matched;
    }

    showReadingPronunciationFeedback(transcript, feedbackEl) {
        // Référence = TOUT le texte (toutes les phrases), indépendamment de la dernière phrase
        // écoutée individuellement — voir this.readingFullTextWordsData dans renderReading().
        if (!this.readingFullTextWordsData) return;

        const recognizedWords = transcript.split(/\s+/).filter(Boolean);
        const referenceWords = this.readingFullTextWordsData.map(w => w.text);
        const matched = this.alignReadingWords(referenceWords, recognizedWords);

        this.readingFullTextWordsData.forEach((w, idx) => {
            w.element.classList.remove('reading-correct', 'reading-incorrect');
            w.element.classList.add(matched[idx] ? 'reading-correct' : 'reading-incorrect');
        });

        const correctCount = matched.filter(Boolean).length;
        feedbackEl.style.display = 'block';
        feedbackEl.textContent = `${correctCount} / ${referenceWords.length} mots bien reconnus`;
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
            const target = e.target;

            // Speaker buttons work regardless of translator state
            if (target.classList.contains('daspalecte-speak-btn') || target.classList.contains('capture-speak-btn')) {
                e.preventDefault();
                e.stopPropagation();
                this.speakFrench(target.dataset.word);
                return;
            }

            if (!this.isEnabled) return;

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

            // PDF margin annotation: remove by clicking on highlighted word again
            if (target.classList.contains('daspalecte-word') &&
                target.dataset.annotationId) {
                e.preventDefault();
                e.stopPropagation();
                const aid = target.dataset.annotationId;
                const annot = document.querySelector(`.pdf-margin-annotation[data-word-id="${aid}"]`);
                if (annot) annot.remove();
                const hl = document.querySelector(`.pdf-word-highlight[data-annotation-id="${aid}"]`);
                if (hl) hl.remove();
                target.classList.remove('selected');
                this.selectedWords.delete(target);
                this.translations.delete(target);
                delete target.dataset.annotationId;
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

        // PDF viewer mode — use left-margin buttons instead of DOM reorganization
        if (this.isPdfViewer()) {
            this.injectPdfMagicButtons();
            return;
        }

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

        // PDF viewer mode — remove left-margin buttons
        if (this.isPdfViewer()) {
            document.querySelectorAll('.pdf-page-margin-left').forEach(m => m.remove());
            document.querySelectorAll('.pdf-comprehension-card').forEach(c => c.remove());
            console.log('[CONTENT] ✅ PDF magic buttons supprimés');
            return;
        }

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

    // Inject magic buttons in the LEFT margin of PDF pages
    injectPdfMagicButtons() {
        const wrappers = document.querySelectorAll('.pdf-page-wrapper');
        let total = 0;

        wrappers.forEach(wrapper => {
            const paragraphs = wrapper._paragraphs;
            if (!paragraphs || paragraphs.length === 0) return;

            // Create left margin container
            let leftMargin = wrapper.querySelector('.pdf-page-margin-left');
            if (!leftMargin) {
                leftMargin = document.createElement('div');
                leftMargin.className = 'pdf-page-margin-left';
                wrapper.appendChild(leftMargin);
            }

            paragraphs.forEach((para, idx) => {
                const btn = document.createElement('button');
                btn.className = 'pdf-magic-btn';
                btn.innerHTML = '✨';
                btn.title = 'Aide à la compréhension';
                btn.style.top = para.y + 'px';
                btn.dataset.paraIdx = idx;

                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.handlePdfMagicClick(wrapper, para, btn, leftMargin);
                });

                leftMargin.appendChild(btn);
                total++;
            });
        });

        console.log('[CONTENT] ✅ PDF magic buttons injectés:', total);
    }

    // Collapse a PDF comprehension card into a bubble
    collapsePdfComprehension(card) {
        if (card.classList.contains('collapsed')) return;
        card.classList.add('collapsed');
        card._fullContent = card.innerHTML;
        card.innerHTML = '<span class="pdf-comprehension-bubble" title="Aide à la compréhension">📖</span>';
        card.querySelector('.pdf-comprehension-bubble').addEventListener('click', (e) => {
            e.stopPropagation();
            this.expandPdfComprehension(card);
        });
    }

    // Expand a collapsed comprehension card
    expandPdfComprehension(card) {
        if (!card.classList.contains('collapsed')) return;
        // Collapse all other expanded cards
        document.querySelectorAll('.pdf-comprehension-card:not(.collapsed)').forEach(c => {
            if (c !== card) this.collapsePdfComprehension(c);
        });
        card.classList.remove('collapsed');
        card.innerHTML = card._fullContent;
        // Re-attach buttons
        const closeBtn = card.querySelector('.pdf-comprehension-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                card.remove();
            });
        }
        const minimizeBtn = card.querySelector('.pdf-comprehension-minimize');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
                this.collapsePdfComprehension(card);
            });
        }
    }

    // Handle magic button click on PDF — call Claude, show result in left margin
    async handlePdfMagicClick(wrapper, para, button, leftMargin) {
        if (button.disabled) return;

        // If there's already a card for this paragraph, toggle it
        const existingCard = leftMargin.querySelector(`.pdf-comprehension-card[data-para-y="${para.y}"]`);
        if (existingCard) {
            if (existingCard.classList.contains('collapsed')) {
                this.expandPdfComprehension(existingCard);
            } else {
                this.collapsePdfComprehension(existingCard);
            }
            return;
        }

        // Collapse all other expanded comprehension cards
        document.querySelectorAll('.pdf-comprehension-card:not(.collapsed)').forEach(c => {
            this.collapsePdfComprehension(c);
        });

        button.disabled = true;
        button.innerHTML = '⏳';

        // Create card in left margin
        const card = document.createElement('div');
        card.className = 'pdf-comprehension-card';
        card.style.top = para.y + 'px';
        card.dataset.paraY = para.y;
        card.innerHTML = '<div class="pdf-annotation-loading">⏳</div>';
        leftMargin.appendChild(card);

        try {
            const result = await this.getAISummary(para.text, this.targetLang);

            card.innerHTML = `
                <div class="pdf-comprehension-header">
                    <span>Aide à la compréhension</span>
                    <div class="pdf-comprehension-actions">
                        <button class="pdf-comprehension-minimize" title="Réduire">—</button>
                        <button class="pdf-comprehension-close" title="Fermer">✕</button>
                    </div>
                </div>
                <div class="pdf-comprehension-body">
                    <div class="pdf-comprehension-section">
                        <div class="pdf-comprehension-label">Résumé</div>
                        <div class="pdf-comprehension-text">${result.summary || 'Non disponible'}</div>
                    </div>
                    <div class="pdf-comprehension-section">
                        <div class="pdf-comprehension-label">Reformulation</div>
                        <div class="pdf-comprehension-text">${result.reformulation || result.summary || 'Non disponible'}</div>
                    </div>
                </div>
            `;

            card.querySelector('.pdf-comprehension-close').addEventListener('click', () => {
                card.remove();
            });
            card.querySelector('.pdf-comprehension-minimize').addEventListener('click', () => {
                this.collapsePdfComprehension(card);
            });

            button.innerHTML = '✦';
        } catch (error) {
            console.error('[CONTENT] PDF comprehension error:', error);
            card.innerHTML = `
                <div class="pdf-comprehension-header">
                    <span>Erreur</span>
                    <button class="pdf-comprehension-close" title="Fermer">✕</button>
                </div>
                <div class="pdf-comprehension-text" style="color:#ff6b6b;">Impossible de charger l'aide</div>
            `;
            card.querySelector('.pdf-comprehension-close').addEventListener('click', () => {
                card.remove();
            });
            button.innerHTML = '✨';
        } finally {
            button.disabled = false;
        }
    }

    async handleMagicButtonClick(paragraph, button, summaryCol) {
        if (button.disabled) return;

        // Si le résumé est déjà affiché (ouvert ou réduit), on le referme complètement (toggle)
        if (summaryCol.classList.contains('active')) {
            summaryCol.classList.remove('active', 'collapsed');
            summaryCol.innerHTML = '';
            button.innerHTML = '✨';
            button.style.removeProperty('display');
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
                        <div class="summary-actions">
                            <button class="summary-minimize" title="Réduire">—</button>
                            <button class="summary-close" title="Fermer">×</button>
                        </div>
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
            this.attachSummaryBoxHandlers(summaryCol, button);

            // Une seule bulle d'action à la fois par paragraphe : l'encadré (ouvert ou réduit)
            // remplace le bouton magique tant qu'il existe.
            button.innerHTML = '✦'; // Icone alternative pour état "actif"
            button.style.setProperty('display', 'none', 'important');
        } catch (error) {
            console.error('Erreur de résumé AI:', error);
            button.innerHTML = '❌';
            setTimeout(() => { button.innerHTML = '✨'; }, 3000);
        } finally {
            button.disabled = false;
        }
    }

    // Attache les handlers close/réduire de la boîte de compréhension (page web)
    attachSummaryBoxHandlers(summaryCol, button) {
        const closeBtn = summaryCol.querySelector('.summary-close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                summaryCol.classList.remove('active', 'collapsed');
                summaryCol.innerHTML = '';
                button.innerHTML = '✨';
                button.style.removeProperty('display');
            };
        }
        const minimizeBtn = summaryCol.querySelector('.summary-minimize');
        if (minimizeBtn) {
            minimizeBtn.onclick = () => {
                this.collapseSummaryBox(summaryCol, button);
            };
        }
    }

    // Réduit la boîte de compréhension en une petite bulle (garde le contenu pour la ré-ouvrir)
    collapseSummaryBox(summaryCol, button) {
        summaryCol._fullContent = summaryCol.innerHTML;
        summaryCol.classList.add('collapsed');
        summaryCol.innerHTML = '<span class="summary-bubble" title="Aide à la compréhension">📖</span>';
        summaryCol.querySelector('.summary-bubble').addEventListener('click', (e) => {
            e.stopPropagation();
            this.expandSummaryBox(summaryCol, button);
        });
    }

    // Ré-ouvre une boîte de compréhension réduite
    expandSummaryBox(summaryCol, button) {
        if (!summaryCol.classList.contains('collapsed')) return;
        summaryCol.classList.remove('collapsed');
        summaryCol.innerHTML = summaryCol._fullContent;
        this.attachSummaryBoxHandlers(summaryCol, button);
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
            // Deux exercices sont construits côté client, sans génération Claude supplémentaire :
            // l'appariement à l'écoute (mêmes paires que l'exercice "matching", inséré après la
            // lecture) et la phrase avec le vocabulaire (ajoutée en dernier).
            const orderedExercises = [...data.exercises];
            const matchingEx = orderedExercises.find(e => e.type === 'matching');
            const listeningEx = this.buildListeningMatchingExercise(matchingEx);
            if (listeningEx) {
                const readingIdx = orderedExercises.findIndex(e => e.type === 'reading');
                const insertAt = readingIdx === -1 ? orderedExercises.length : readingIdx + 1;
                orderedExercises.splice(insertAt, 0, listeningEx);
            }
            orderedExercises.push(this.buildSentenceExercise(words));
            this.renumberExerciseTitles(orderedExercises);

            this.displayExercises(orderedExercises, words, targetLang);
        } catch (error) {
            console.error('Erreur exercices:', error);
            alert('Erreur lors de la préparation des exercices.');
            this.closeExerciseOverlay();
        }
    }

    // Corrige le préfixe "Exercice N : " de chaque titre selon la position réelle dans le tableau
    // final — les titres viennent en partie de Claude, en partie construits côté client, et
    // l'insertion d'exercices supplémentaires décale forcément la numérotation des suivants.
    renumberExerciseTitles(exercises) {
        exercises.forEach((ex, idx) => {
            if (typeof ex.title === 'string') {
                ex.title = ex.title.replace(/^Exercice\s*\d*\s*:/, `Exercice ${idx + 1} :`);
            }
        });
        return exercises;
    }

    // Construit l'exercice d'appariement à l'écoute : mêmes paires mot/traduction que l'exercice
    // "Associez les mots", mais l'élève doit écouter chaque mot français (synthèse vocale) avant de
    // l'associer, plutôt que le lire. Pas de génération IA nécessaire, les paires existent déjà.
    buildListeningMatchingExercise(matchingExercise) {
        if (!matchingExercise || !Array.isArray(matchingExercise.pairs) || !matchingExercise.pairs.length) return null;
        return {
            type: 'listening_matching',
            title: 'Exercice : Écoute et associe',
            description: 'Écoute chaque mot français (🔊) et relie-le à sa traduction.',
            pairs: matchingExercise.pairs
        };
    }

    // Construit l'exercice de phrase avec le vocabulaire : pas de génération IA nécessaire,
    // la liste de mots imposés est déjà connue côté client. Seule la vérification grammaticale
    // de la phrase produite par l'élève passe par Claude (action verify_sentence).
    buildSentenceExercise(words) {
        const required = Math.max(1, Math.ceil(words.length / 2));
        return {
            type: 'sentence',
            title: 'Exercice : Phrase avec le vocabulaire',
            description: `Écris une phrase en français qui utilise au moins ${required} mot${required > 1 ? 's' : ''} parmi les ${words.length} appris (soit la moitié).`,
            words
        };
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
            this.stopReadingActivity();
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

    displayExercises(exercises, words, targetLang) {
        const overlay = document.getElementById('daspalecte-exercise-overlay');
        if (!overlay) return;

        let currentStep = 0;
        const completedSteps = new Set(); // exercices déjà réussis au moins une fois
        const content = overlay.querySelector('.overlay-content');
        content.classList.remove('loader-active');

        const renderStep = () => {
            this.stopReadingActivity();
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
                        </div>
                        <div class="exercise-dots" id="exercise-dots"></div>
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
            const dotsEl = content.querySelector('#exercise-dots');

            // Capturé maintenant (pas lu depuis la variable `currentStep`, qui peut avoir changé d'ici
            // là) : chaque exercice appelle ceci dès qu'il se sait réussi, plutôt que de compter sur
            // la navigation pour le déduire après coup — sinon un exercice réussi sans jamais être
            // quitté explicitement via "Continuer" pouvait laisser son point de navigation injoignable.
            const stepBeingRendered = currentStep;
            const markCompleted = () => completedSteps.add(stepBeingRendered);

            // Navigue vers un autre exercice en marquant le pas courant comme réussi s'il l'était déjà
            // (bouton "Continuer" visible), même sans clic explicite dessus. Sinon un exercice réussi
            // puis quitté via un point de navigation (au lieu de "Continuer") redevenait injoignable :
            // son point restait désactivé pour toujours, y compris pour le tout dernier exercice.
            const goToStep = (idx) => {
                if (btnNext.style.display !== 'none') {
                    completedSteps.add(currentStep);
                }
                if (idx >= exercises.length) {
                    this.showFinishScreen(content);
                    return;
                }
                currentStep = idx;
                renderStep();
            };

            // Points de navigation : cliquables pour l'exercice courant, déjà réussi, ou le tout
            // premier exercice non encore réussi (le "prochain" naturel de la progression) — sinon
            // revenir en arrière pour consulter un exercice réussi rendait le suivant injoignable
            // sans repasser par "Continuer" sur chaque exercice entre-temps.
            const maxCompletedIdx = completedSteps.size ? Math.max(...completedSteps) : -1;
            exercises.forEach((_, idx) => {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'exercise-dot';
                if (idx === currentStep) dot.classList.add('active');
                if (completedSteps.has(idx)) dot.classList.add('completed');
                const clickable = idx === currentStep || completedSteps.has(idx) || idx === maxCompletedIdx + 1;
                dot.disabled = !clickable;
                dot.setAttribute('aria-label', `Exercice ${idx + 1}${completedSteps.has(idx) ? ' (terminé)' : ''}`);
                dot.addEventListener('click', () => {
                    if (!clickable) return;
                    goToStep(idx);
                });
                dotsEl.appendChild(dot);
            });

            // Régénère uniquement l'exercice courant via le Cloud Function existant (generate_exercises),
            // sans réinitialiser la progression sur les autres exercices.
            const regenerateCurrentExercise = async () => {
                body.innerHTML = `
                    <div class="loader-container">
                        <div class="neon-spinner"></div>
                        <p>Claude régénère cet exercice...</p>
                    </div>
                `;
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
                    if (!response.ok) throw new Error('Erreur lors de la régénération');
                    const data = await response.json();
                    const currentType = exercises[currentStep].type;
                    exercises[currentStep] = data.exercises.find(e => e.type === currentType) || data.exercises[currentStep];
                    renderStep();
                } catch (error) {
                    console.error('[CONTENT] Erreur régénération exercice:', error);
                    body.innerHTML = '<p class="ex-score ex-score-fail">Impossible de régénérer l\'exercice, réessaie.</p>';
                }
            };

            this.renderExerciseType(ex, body, btnCheck, btnNext, regenerateCurrentExercise, markCompleted);

            // Un exercice déjà réussi ne redevient pas obligatoire en y revenant :
            // "Continuer" reste disponible même si l'élève ne le refait pas.
            if (completedSteps.has(currentStep)) {
                btnNext.style.display = 'block';
            }

            // Navigation : Précédent (toujours possible)
            btnPrev.onclick = () => {
                if (currentStep > 0) {
                    goToStep(currentStep - 1);
                }
            };

            // Bouton "Continuer" — n'apparaît que lorsque l'exercice courant est réussi
            btnNext.onclick = () => {
                goToStep(currentStep + 1);
            };
        };

        renderStep();
    }

    renderExerciseType(ex, container, btnCheck, btnNext, regenerateCurrentExercise, markCompleted) {
        switch (ex.type) {
            case 'matching': this.renderMatching(ex, container, btnCheck, btnNext, markCompleted); break;
            case 'listening_matching': this.renderMatching(ex, container, btnCheck, btnNext, markCompleted); break;
            case 'tags': this.renderTags(ex, container, btnCheck, btnNext, regenerateCurrentExercise, markCompleted); break;
            case 'reading': this.renderReading(ex, container, btnCheck, btnNext, markCompleted); break;
            case 'family': this.renderFamily(ex, container, btnCheck, btnNext, markCompleted); break;
            case 'cloze': this.renderCloze(ex, container, btnCheck, btnNext, undefined, markCompleted); break;
            case 'sentence': this.renderSentence(ex, container, btnCheck, btnNext, markCompleted); break;
        }
    }

    renderMatching(ex, container, btnCheck, btnNext, markCompleted = () => {}) {
        // Variante "écoute et associe" : la colonne française n'affiche pas le texte, seulement un
        // bouton d'écoute — l'élève doit reconnaître le mot à l'oreille avant de l'associer.
        const audioOnly = ex.type === 'listening_matching';
        let selectedFr = null;
        let selectedTr = null;
        let selectedFrEl = null;
        let selectedTrEl = null;
        let matchesFound = 0;
        const totalPairs = ex.pairs.length;

        container.innerHTML = `
            <div class="matching-container" style="position: relative !important;">
                <div class="matching-col" id="col-fr"></div>
                <svg id="matching-svg" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;"></svg>
                <div class="matching-col" id="col-tr"></div>
            </div>
        `;

        const colFr = container.querySelector('#col-fr');
        const colTr = container.querySelector('#col-tr');
        const matchingContainer = container.querySelector('.matching-container');
        const svg = container.querySelector('#matching-svg');

        // Ligne colorée reliant chaque paire trouvée (comme dans le test de lecture), en plus du
        // surlignage des cases : redessinée à chaque nouvelle paire trouvée.
        const matchedLines = [];
        const drawLines = () => {
            svg.innerHTML = '';
            const containerRect = matchingContainer.getBoundingClientRect();
            matchedLines.forEach(({ frEl, trEl }) => {
                const frRect = frEl.getBoundingClientRect();
                const trRect = trEl.getBoundingClientRect();
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', frRect.right - containerRect.left);
                line.setAttribute('y1', frRect.top + frRect.height / 2 - containerRect.top);
                line.setAttribute('x2', trRect.left - containerRect.left);
                line.setAttribute('y2', trRect.top + trRect.height / 2 - containerRect.top);
                line.setAttribute('stroke-width', '2');
                line.setAttribute('opacity', '0.8');
                line.style.setProperty('stroke', 'var(--t-success)');
                svg.appendChild(line);
            });
        };

        // Mélanger les tableaux pour le défi
        const frItems = [...ex.pairs].sort(() => Math.random() - 0.5);
        const trItems = [...ex.pairs].sort(() => Math.random() - 0.5);

        frItems.forEach((pair, idx) => {
            const el = document.createElement('div');
            el.className = 'match-item';
            el.dataset.val = pair.fr;
            el.tabIndex = 0;
            el.setAttribute('role', 'button');
            if (audioOnly) {
                el.classList.add('match-item-audio');
                el.innerHTML = `<span class="match-item-audio-icon">🔊</span><span class="match-item-audio-label">Mot ${idx + 1}</span>`;
                el.setAttribute('aria-label', `Écouter le mot ${idx + 1} et l'associer à sa traduction`);
            } else {
                el.textContent = pair.fr;
                el.setAttribute('aria-label', pair.fr);
            }
            const handleSelect = () => {
                if (el.classList.contains('matched')) return;
                if (audioOnly) this.speakFrench(pair.fr);
                colFr.querySelectorAll('.match-item').forEach(i => i.classList.remove('selected'));
                el.classList.add('selected');
                selectedFr = pair.fr;
                selectedFrEl = el;
                checkMatch();
            };
            el.onclick = handleSelect;
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect();
                }
            });
            colFr.appendChild(el);
        });

        trItems.forEach(pair => {
            const el = document.createElement('div');
            el.className = 'match-item';
            el.textContent = pair.tr;
            el.dataset.val = pair.fr; // On stocke la clé FR pour vérifier
            el.tabIndex = 0;
            el.setAttribute('role', 'button');
            el.setAttribute('aria-label', pair.tr);
            const handleSelect = () => {
                if (el.classList.contains('matched')) return;
                colTr.querySelectorAll('.match-item').forEach(i => i.classList.remove('selected'));
                el.classList.add('selected');
                selectedTr = pair.fr;
                selectedTrEl = el;
                checkMatch();
            };
            el.onclick = handleSelect;
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect();
                }
            });
            colTr.appendChild(el);
        });

        const checkMatch = () => {
            if (selectedFr && selectedTr) {
                if (selectedFr === selectedTr) {
                    // Succès : on relie les deux mots par une ligne, comme dans le test de lecture
                    container.querySelectorAll(`.match-item[data-val="${selectedFr}"]`).forEach(el => {
                        el.classList.remove('selected');
                        el.classList.add('matched');
                    });
                    matchedLines.push({ frEl: selectedFrEl, trEl: selectedTrEl });
                    drawLines();
                    matchesFound++;
                    if (matchesFound === totalPairs) {
                        btnNext.style.display = 'block';
                        markCompleted();
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
                selectedFrEl = null;
                selectedTrEl = null;
            }
        };

        btnCheck.style.display = 'none';
        btnNext.style.display = 'none';
    }

    renderTags(ex, container, btnCheck, btnNext, regenerateExercise, markCompleted = () => {}) {
        let answers = {}; // { itemIndex: selectedWord }
        let selectedTag = null; // étiquette armée pour un placement au clic/clavier
        const totalItems = ex.items.length;

        container.innerHTML = `
            <div class="tags-exercise">
                <div class="sentences-list" id="sentences"></div>
                <div class="tags-pool" id="pool"></div>
            </div>
            <div class="ex-result" id="tags-result" style="display:none;"></div>
        `;

        const sentencesDiv = container.querySelector('#sentences');
        const poolDiv = container.querySelector('#pool');

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

        // Sélectionner/désélectionner une étiquette (mode clic/clavier, alternative au drag & drop)
        const selectTag = (tag) => {
            if (selectedTag === tag) {
                tag.classList.remove('selected');
                selectedTag = null;
                return;
            }
            if (selectedTag) {
                selectedTag.classList.remove('selected');
            }
            selectedTag = tag;
            tag.classList.add('selected');
        };

        // Crée une étiquette (pool initial + remise dans le pool) avec drag, clic et clavier
        const createTag = (word) => {
            const tag = document.createElement('div');
            tag.className = 'tag-item';
            tag.textContent = word;
            tag.draggable = true;
            tag.dataset.word = word;
            tag.tabIndex = 0;
            tag.setAttribute('role', 'button');
            tag.setAttribute('aria-label', `Étiquette : ${word}`);
            setupTagDrag(tag);
            tag.addEventListener('click', () => selectTag(tag));
            tag.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    selectTag(tag);
                }
            });
            return tag;
        };

        // Placer l'étiquette sélectionnée dans une zone, ou en retirer le mot déjà présent
        const placeOrClear = (idx, dropZone) => {
            if (selectedTag) {
                const word = selectedTag.dataset.word;
                if (answers[idx]) {
                    poolDiv.appendChild(createTag(answers[idx]));
                }
                answers[idx] = word;
                dropZone.textContent = word;
                dropZone.classList.add('filled');
                selectedTag.remove();
                selectedTag = null;
                return;
            }
            if (answers[idx]) {
                poolDiv.appendChild(createTag(answers[idx]));
                delete answers[idx];
                dropZone.textContent = '...';
                dropZone.classList.remove('filled');
            }
        };

        // Créer les phrases avec des zones de dépôt (drag & drop, clic ou clavier)
        ex.items.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'sentence-item';

            // On remplace ___ par un span interactif
            const htmlText = item.sentence.replace('___', `<span class="drop-zone" data-idx="${idx}" tabindex="0" role="button" aria-label="Zone à compléter">...</span>`);
            div.innerHTML = `<span class="bullet">${idx + 1}</span> ${htmlText}`;
            sentencesDiv.appendChild(div);

            const dropZone = div.querySelector('.drop-zone');

            // Vérifier que la drop-zone existe (la phrase doit contenir ___)
            if (!dropZone) {
                console.warn(`[CONTENT] ⚠️ Pas de zone de dépôt pour l'item ${idx}: "${item.sentence}"`);
                return; // Passer à l'item suivant
            }

            // Drag & Drop events (souris)
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.style.background = this.getThemeColors().primaryAlpha20;
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.style.background = '';
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.style.background = '';

                if (selectedTag) {
                    selectedTag.classList.remove('selected');
                    selectedTag = null;
                }

                const word = e.dataTransfer.getData('text/plain');
                const tagElement = poolDiv.querySelector(`[data-word="${word}"]`);

                if (tagElement) {
                    // Si la zone contient déjà un mot, le remettre dans le pool
                    if (answers[idx]) {
                        poolDiv.appendChild(createTag(answers[idx]));
                    }

                    // Placer le nouveau mot
                    answers[idx] = word;
                    dropZone.textContent = word;
                    dropZone.classList.add('filled');
                    tagElement.remove();
                }
            });

            // Clic ou clavier (Entrée/Espace) : placer l'étiquette sélectionnée, ou retirer le mot présent
            dropZone.addEventListener('click', () => placeOrClear(idx, dropZone));
            dropZone.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    placeOrClear(idx, dropZone);
                }
            });
        });

        // Créer le pool d'étiquettes (mélangé) avec drag & drop, clic et clavier
        const words = ex.items.map(item => item.word).sort(() => Math.random() - 0.5);
        words.forEach(word => {
            poolDiv.appendChild(createTag(word));
        });

        const resultEl = container.querySelector('#tags-result');

        btnCheck.style.display = 'block';
        btnCheck.onclick = async () => {
            btnCheck.disabled = true;
            let correctCount = 0;
            const wrongItems = []; // réponses ne correspondant pas au mot exact attendu

            ex.items.forEach((item, idx) => {
                const zone = container.querySelector(`.drop-zone[data-idx="${idx}"]`);

                // Vérifier que la zone existe
                if (!zone) {
                    console.warn(`[CONTENT] ⚠️ Pas de zone trouvée pour vérification de l'item ${idx}`);
                    return; // Passer à l'item suivant
                }

                zone.classList.remove('correct', 'error');
                if (answers[idx] === item.word) {
                    zone.classList.add('correct');
                    correctCount++;
                } else {
                    zone.classList.add('error');
                    if (answers[idx]) {
                        wrongItems.push({ zone, sentence: item.sentence.replace('___', answers[idx]) });
                    }
                }
            });

            // Un mot différent du mot exact attendu peut être un synonyme valide (ex. "hommes"/"personnes") :
            // on demande un second avis à Claude avant de trancher, plutôt que de rejeter en bloc.
            if (wrongItems.length > 0) {
                resultEl.style.display = 'block';
                resultEl.innerHTML = '<p class="ex-score">Claude vérifie tes réponses...</p>';
                try {
                    const response = await fetch('https://daspalecte-1086562672385.europe-west1.run.app', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'verify_tags_answers',
                            items: wrongItems.map(w => ({ sentence: w.sentence }))
                        })
                    });
                    if (response.ok) {
                        const data = await response.json();
                        (data.results || []).forEach((result, i) => {
                            if (result && result.valid) {
                                wrongItems[i].zone.classList.remove('error');
                                wrongItems[i].zone.classList.add('correct');
                                correctCount++;
                            }
                        });
                    }
                } catch (error) {
                    console.error('[CONTENT] Erreur vérification IA des étiquettes:', error);
                    // Pas de blocage : on garde le résultat de la vérification stricte en cas d'échec
                }
            }

            btnCheck.disabled = false;
            const accuracy = totalItems > 0 ? correctCount / totalItems : 1;

            if (accuracy >= 0.7) {
                btnNext.style.display = 'block';
                markCompleted();
                btnCheck.style.display = 'none';
                // .ex-result a un `display: flex !important` en CSS qui écraserait un simple
                // style.display = 'none' : la boîte resterait visible avec son dernier contenu
                // (ex. "Claude vérifie tes réponses..."). setProperty(...'important') est nécessaire.
                resultEl.style.setProperty('display', 'none', 'important');
                resultEl.innerHTML = '';
            } else {
                setTimeout(() => {
                    container.querySelectorAll('.drop-zone.error').forEach(z => {
                        z.classList.remove('error');
                    });
                }, 2000);

                resultEl.style.display = 'block';
                resultEl.innerHTML = `
                    <p class="ex-score ex-score-fail">${Math.round(accuracy * 100)}% de bonnes réponses — il faut au moins 70% pour continuer.</p>
                    <button type="button" class="ex-btn secondary ex-regenerate-btn">✨ Régénérer l'exercice</button>
                `;
                resultEl.querySelector('.ex-regenerate-btn').onclick = () => {
                    if (regenerateExercise) regenerateExercise();
                };
            }
        };
    }

    // Bulle de traduction au clic sur un mot de la lecture silencieuse (réutilise le style
    // de bulle du traducteur principal, sans toucher à son état interne)
    attachReadingWordTranslation(container) {
        const translationCache = new Map();
        container.querySelectorAll('.reading-word:not(.reading-word-translation)').forEach(wordEl => {
            wordEl.addEventListener('click', async () => {
                const existing = wordEl.querySelector('.daspalecte-translation');
                if (existing) {
                    existing.remove();
                    return;
                }
                // Une seule bulle affichée à la fois
                container.querySelectorAll('.daspalecte-translation').forEach(b => b.remove());

                const word = wordEl.textContent;
                if (!translationCache.has(word)) {
                    try {
                        translationCache.set(word, await this.translateText(word));
                    } catch (e) {
                        translationCache.set(word, null);
                    }
                }
                const translation = translationCache.get(word);
                if (!translation) return;

                const bubble = document.createElement('span');
                bubble.className = 'daspalecte-translation';
                bubble.textContent = translation;
                wordEl.appendChild(bubble);
            });
        });

        // Filet de sécurité : un clic ailleurs dans l'exercice referme aussi la bulle ouverte
        container.addEventListener('click', (e) => {
            if (e.target.closest('.reading-word')) return; // déjà géré par le mot cliqué lui-même
            container.querySelectorAll('.daspalecte-translation').forEach(b => b.remove());
        });
    }

    renderReading(ex, container, btnCheck, btnNext, markCompleted = () => {}) {
        // Une ligne par phrase, chacune avec son propre bouton d'écoute : plus le texte est long,
        // plus l'estimation de surbrillance (basée sur la durée par mot) dérivait par rapport à la
        // voix au fil du texte. En limitant chaque lecture à une seule phrase courte, la dérive
        // repart de zéro à chaque clic et reste imperceptible.
        const sentences = this.splitIntoSentences(ex.text);

        const sentenceHtml = sentences.map((sentenceText, idx) => {
            const { html } = this.buildReadingWordSpans(sentenceText);
            return `
                <div class="reading-sentence" data-idx="${idx}">
                    <button type="button" class="reading-sentence-play" data-idx="${idx}" aria-label="Écouter cette phrase" style="visibility:hidden;">🔊</button>
                    <span class="reading-sentence-content">${html}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="reading-text" id="reading-text-content">${sentenceHtml}</div>

            <div class="reading-toolbar" id="reading-toolbar" style="display:none;">
                <span class="reading-toolbar-hint">🔊 Clique sur une phrase pour l'écouter</span>
                <div class="reading-speed-control">
                    <button type="button" class="reading-speed-btn" data-dir="-1" title="Ralentir">🐢</button>
                    <span class="reading-speed-value">${this.readingRate.toFixed(2)}x</span>
                    <button type="button" class="reading-speed-btn" data-dir="1" title="Accélérer">🐇</button>
                </div>
            </div>

            <div class="reading-stage" id="reading-stage-record" style="display:none;">
                <button type="button" class="ex-btn secondary reading-record-btn">🎤 Enregistrer ma lecture</button>
            </div>

            <div class="reading-feedback" id="reading-feedback" style="display:none;"></div>
        `;

        // a) Lecture silencieuse : traduction au clic sur chaque mot (comme le traducteur principal)
        this.attachReadingWordTranslation(container);

        // Construit, pour chaque phrase, ses propres données de surbrillance/timing (indépendantes
        // des autres phrases), et cumule en parallèle la référence sur TOUT le texte — nécessaire
        // pour l'alignement de l'enregistrement final, qui porte sur le texte entier.
        const sentenceData = [];
        const fullTextWordsData = [];
        container.querySelectorAll('.reading-sentence').forEach((sentenceEl, idx) => {
            const sentenceText = sentences[idx];
            const { words } = this.buildReadingWordSpans(sentenceText);
            const spans = sentenceEl.querySelectorAll('.reading-word');
            const wordsWithEl = words
                .map((w, i) => ({ ...w, element: spans[i] }))
                .filter(w => w.spoken);

            // Positions dans le texte réellement envoyé au moteur TTS pour CETTE phrase (parenthèses
            // retirées) : permet de resynchroniser sur la position exacte plutôt que de compter les
            // évènements un par un.
            const spokenText = sentenceText.replace(/\([^)]*\)/g, ' ');
            const spokenOffsets = this.computeSpokenTextOffsets(spokenText);
            wordsWithEl.forEach((w, i) => {
                if (spokenOffsets[i]) {
                    w.spokenStart = spokenOffsets[i].start;
                    w.spokenEnd = spokenOffsets[i].end;
                }
            });

            // Pause estimée après un signe de ponctuation forte, pour compenser le temps d'arrêt
            // qu'une vraie voix marque et que le calcul par mot seul ne capture pas.
            wordsWithEl.forEach((w, i) => {
                if (w.spokenEnd === undefined) { w.pauseAfterMs = 0; return; }
                const nextStart = wordsWithEl[i + 1] ? wordsWithEl[i + 1].spokenStart : spokenText.length;
                const between = spokenText.slice(w.spokenEnd, nextStart);
                if (/[.!?…]/.test(between)) w.pauseAfterMs = 450;
                else if (/[,;:]/.test(between)) w.pauseAfterMs = 200;
                else w.pauseAfterMs = 0;
            });

            sentenceData.push({
                text: sentenceText,
                wordsData: wordsWithEl,
                playBtn: sentenceEl.querySelector('.reading-sentence-play')
            });
            fullTextWordsData.push(...wordsWithEl);
        });

        // Référence utilisée uniquement par l'alignement de l'enregistrement final (texte entier) —
        // distincte de this.readingWordsData, qui ne porte que sur la phrase en cours d'écoute.
        this.readingFullTextWordsData = fullTextWordsData;
        this.readingWordsData = null;

        this.isReadingAloud = false;
        this.isReadingPaused = false;
        this.isRecordingReading = false;
        this.currentReadingRecognition = null;
        this.currentReadingPlayBtn = null;
        // Réinitialisé à chaque nouveau rendu : sinon un enregistrement déjà fait lors d'un rendu
        // précédent (même exercice régénéré, ou révisite via les points de navigation) empêche
        // silencieusement la révélation de l'étape d'enregistrement sur ce nouveau rendu.
        this.hasListenedToReading = false;

        btnCheck.style.display = 'none';
        btnNext.style.display = 'none';

        const toolbarEl = container.querySelector('#reading-toolbar');
        const recordStage = container.querySelector('#reading-stage-record');
        const feedbackEl = container.querySelector('#reading-feedback');

        // b) Après 20 secondes de lecture silencieuse, révéler l'accès à l'écoute phrase par phrase
        this.readingRevealTimeout = setTimeout(() => {
            toolbarEl.style.display = 'flex';
            sentenceData.forEach(s => { s.playBtn.style.visibility = 'visible'; });
        }, 20000);

        const playedSentences = new Set();
        // c) Une fois TOUTES les phrases écoutées au moins une fois, révéler l'enregistrement
        const checkAllSentencesPlayed = () => {
            if (this.hasListenedToReading) return;
            if (playedSentences.size < sentenceData.length) return;
            this.hasListenedToReading = true;
            recordStage.style.display = 'block';
        };

        // Démarre (ou redémarre depuis le début) la lecture d'une phrase donnée, en arrêtant
        // proprement celle en cours s'il y en a une.
        const startSentencePlayback = (idx) => {
            const s = sentenceData[idx];
            if (!s) return;
            if (this.isReadingAloud) {
                this.stopReadingTTS();
            }
            this.readingWordsData = s.wordsData;
            this.currentReadingPlayBtn = s.playBtn;
            this.onReadingFinishedOnce = () => {
                playedSentences.add(idx);
                s.playBtn.classList.add('reading-sentence-played');
                checkAllSentencesPlayed();
            };
            this.startReadingTTS(s.text);
            this.refreshReadingPlayButton();
        };

        sentenceData.forEach((s, idx) => {
            s.playBtn.onclick = () => {
                // Reclique sur la phrase déjà en cours : pause/reprise plutôt que redémarrage
                if (this.isReadingAloud && this.currentReadingPlayBtn === s.playBtn) {
                    if (this.isReadingPaused) {
                        this.resumeReadingTTS();
                    } else {
                        this.pauseReadingTTS();
                    }
                    this.refreshReadingPlayButton();
                    return;
                }
                startSentencePlayback(idx);
            };
        });

        container.querySelectorAll('.reading-speed-btn').forEach(btn => {
            btn.onclick = () => {
                const dir = parseInt(btn.dataset.dir, 10);
                this.readingRate = Math.max(0.5, Math.min(1.5, Math.round((this.readingRate + dir * 0.15) * 100) / 100));
                container.querySelector('.reading-speed-value').textContent = `${this.readingRate.toFixed(2)}x`;
                // Une phrase en cours de lecture reprend immédiatement depuis son début à la nouvelle vitesse
                if (this.isReadingAloud && this.currentReadingPlayBtn) {
                    const idx = sentenceData.findIndex(s => s.playBtn === this.currentReadingPlayBtn);
                    if (idx !== -1) startSentencePlayback(idx);
                }
            };
        });

        const recordBtn = container.querySelector('.reading-record-btn');
        recordBtn.onclick = () => {
            this.toggleReadingRecording(recordBtn, feedbackEl, () => {
                // "Continuer" n'apparaît qu'une fois l'élève enregistré
                btnNext.style.display = 'block';
                markCompleted();
            });
        };
    }

    renderFamily(ex, container, btnCheck, btnNext, markCompleted = () => {}) {
        container.innerHTML = `
            <div class="family-exercise">
                <div class="families-grid" id="families"></div>
                <p class="ex-hint" id="family-hint">Retourne chaque carte (🔄) pour tester tes connaissances, puis clique sur « Vérifier ». Tu peux revoir le recto à tout moment.</p>
                <div class="ex-result" id="family-result" style="display:none;"></div>
            </div>
        `;

        const familiesDiv = container.querySelector('#families');
        const hintEl = container.querySelector('#family-hint');
        const resultEl = container.querySelector('#family-result');
        const totalCards = ex.items.length;
        const flippedOnce = new Set(); // cartes retournées au moins une fois (pour débloquer Vérifier)

        btnCheck.style.display = 'none';
        btnNext.style.display = 'none';

        ex.items.forEach((item, cardIdx) => {
            // Gérer "mainWord" ou "word" pour compatibilité
            const mainWord = item.mainWord || item.word || 'Mot';

            const card = document.createElement('div');
            card.className = 'family-card';
            card.dataset.idx = cardIdx;
            card.innerHTML = `
                <div class="family-card-inner">
                    <div class="family-card-front">
                        <button type="button" class="family-flip-icon-btn family-flip-btn" title="Tester mes connaissances" aria-label="Tester mes connaissances">🔄</button>
                        <div class="main-word-node">${mainWord}</div>
                        <div class="related-words-container">
                            ${item.related.map(word => `<span class="related-tag" data-word="${word}">${word}</span>`).join('')}
                        </div>
                    </div>
                    <div class="family-card-back">
                        <button type="button" class="family-flip-icon-btn family-flip-back-btn" title="Revoir le recto" aria-label="Revoir le recto">🔄</button>
                        <div class="main-word-node">${mainWord}</div>
                        <div class="family-inputs-container">
                            ${item.related.map((word, i) => `<input type="text" class="family-input" placeholder="Mot lié ${i + 1}" autocomplete="off">`).join('')}
                        </div>
                    </div>
                </div>
            `;
            familiesDiv.appendChild(card);

            card.querySelector('.family-flip-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                card.classList.add('flipped');
                flippedOnce.add(cardIdx);
                if (flippedOnce.size === totalCards) {
                    hintEl.style.display = 'none';
                    btnCheck.style.display = 'block';
                }
            });

            // Toujours possible de revoir le recto (exercice formatif, pas de pénalité)
            card.querySelector('.family-flip-back-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                card.classList.remove('flipped');
            });
        });

        // Bulle de traduction (langue maternelle) au survol de chaque étiquette de mot lié
        const familyTranslationCache = new Map();
        familiesDiv.querySelectorAll('.related-tag').forEach(tag => {
            tag.addEventListener('mouseenter', async () => {
                const word = tag.dataset.word;
                if (!familyTranslationCache.has(word)) {
                    try {
                        familyTranslationCache.set(word, await this.translateText(word));
                    } catch (e) {
                        familyTranslationCache.set(word, null);
                    }
                }
                const translation = familyTranslationCache.get(word);
                // La souris peut être repartie pendant l'appel réseau
                if (!translation || !tag.matches(':hover') || tag.querySelector('.related-tag-translation')) return;
                const bubble = document.createElement('span');
                bubble.className = 'related-tag-translation';
                bubble.textContent = translation;
                tag.appendChild(bubble);
            });
            tag.addEventListener('mouseleave', () => {
                const bubble = tag.querySelector('.related-tag-translation');
                if (bubble) bubble.remove();
            });
        });

        // Vérification : compare les mots tapés au dos de chaque carte aux mots liés attendus
        // (comparaison insensible aux accents/casse, ordre libre)
        btnCheck.onclick = () => {
            let totalWords = 0;
            let correctWords = 0;

            familiesDiv.querySelectorAll('.family-card').forEach((card) => {
                const item = ex.items[parseInt(card.dataset.idx, 10)];
                const expected = item.related.map(w => this.normalizeReadingWord(w));
                card.querySelectorAll('.family-input').forEach(input => {
                    totalWords++;
                    input.classList.remove('correct', 'incorrect');
                    const value = input.value ? this.normalizeReadingWord(input.value) : '';
                    const matchIdx = value ? expected.indexOf(value) : -1;
                    if (matchIdx !== -1) {
                        correctWords++;
                        expected.splice(matchIdx, 1); // évite de compter deux fois le même mot
                        input.classList.add('correct');
                    } else {
                        input.classList.add('incorrect');
                    }
                });
            });

            // Formatif : trouver au moins 2 mots suffit pour continuer (ou tous s'il y en a moins de 2 au total)
            const requiredWords = Math.min(2, totalWords);
            const passed = correctWords >= requiredWords;
            resultEl.style.display = 'block';

            if (passed) {
                btnNext.style.display = 'block';
                markCompleted();
                resultEl.innerHTML = `<p class="ex-score ex-score-success">Bravo ! ${correctWords} / ${totalWords} mots retrouvés — pas grave pour le reste, tu peux continuer.</p>`;
            } else {
                resultEl.innerHTML = `<p class="ex-score ex-score-fail">${correctWords} / ${totalWords} mots retrouvés — trouve au moins ${requiredWords} mots pour continuer. Corrige tes réponses et vérifie à nouveau.</p>`;
            }
        };
    }

    // Approximation simple de la première syllabe (indice), pas une syllabification linguistique exacte
    getFirstSyllableHint(word) {
        const match = word.match(/^[^aeiouyàâäéèêëïîôöùûüy]*[aeiouyàâäéèêëïîôöùûüy]+[^aeiouyàâäéèêëïîôöùûüy]*/i);
        return match ? match[0] : word.slice(0, Math.min(2, word.length));
    }

    // hintIndices : Set des index d'items pour lesquels afficher l'indice syllabique (uniquement
    // les réponses fausses lors de la tentative précédente, pas les bonnes déjà trouvées).
    renderCloze(ex, container, btnCheck, btnNext, hintIndices = new Set(), markCompleted = () => {}) {
        container.innerHTML = `
            <div class="cloze-exercise">
                <div class="cloze-items" id="cloze-list"></div>
            </div>
            <div class="ex-result" id="cloze-result" style="display:none;"></div>
        `;

        const listDiv = container.querySelector('#cloze-list');
        const resultEl = container.querySelector('#cloze-result');

        ex.items.forEach((item, idx) => {
            const div = document.createElement('div');
            div.className = 'cloze-item';

            const hint = hintIndices.has(idx) ? ` placeholder="${this.getFirstSyllableHint(item.answer)}…"` : '';
            const html = item.text.replace('___', `<input type="text" class="cloze-input" data-idx="${idx}" autocomplete="off"${hint}>`);
            div.innerHTML = `<span class="bullet">${idx + 1}</span> <span>${html}</span>`;
            listDiv.appendChild(div);
        });

        btnCheck.style.display = 'block';
        btnNext.style.display = 'none';
        btnCheck.onclick = () => {
            let correctCount = 0;
            const wrongIndices = new Set();
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
                    wrongIndices.add(idx);
                }
            });

            const accuracy = ex.items.length > 0 ? correctCount / ex.items.length : 1;

            if (accuracy >= 0.7) {
                btnNext.style.display = 'block';
                markCompleted();
                btnCheck.style.display = 'none';
                resultEl.style.setProperty('display', 'none', 'important');
                resultEl.innerHTML = '';
            } else {
                setTimeout(() => {
                    container.querySelectorAll('.cloze-input.error').forEach(i => {
                        i.classList.remove('error');
                    });
                }, 2000);

                resultEl.style.display = 'block';
                resultEl.innerHTML = `
                    <p class="ex-score ex-score-fail">${Math.round(accuracy * 100)}% de bonnes réponses — il faut au moins 70% pour continuer.</p>
                    <button type="button" class="ex-btn secondary ex-retry-btn">💡 Recommencer avec indice</button>
                `;
                resultEl.querySelector('.ex-retry-btn').onclick = () => {
                    this.renderCloze(ex, container, btnCheck, btnNext, wrongIndices, markCompleted);
                };
            }
        };
    }

    // ========================================
    // EXERCICE 6 — PHRASE AVEC LE VOCABULAIRE
    // ========================================

    // Extrait les "mots" d'une phrase (même découpage que la lecture) pour une comparaison
    // insensible à la casse et aux accents avec la liste de vocabulaire imposée.
    normalizeSentenceWord(str) {
        return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }

    // Réduit un mot déjà normalisé à une forme insensible au genre/nombre (retire un -s/-x final de
    // pluriel puis un -e final de féminin), pour reconnaître "ignorant" == "ignorante" == "ignorants".
    // Approximation simple (ne gère pas le doublement de consonne type chat/chatte), volontairement
    // pas une vraie lemmatisation.
    stripGenderNumber(word) {
        let w = word;
        if (w.length > 3 && /[sx]$/.test(w)) w = w.slice(0, -1);
        if (w.length > 3 && /e$/.test(w)) w = w.slice(0, -1);
        return w;
    }

    wordMatchKey(str) {
        return this.stripGenderNumber(this.normalizeSentenceWord(str));
    }

    extractSentenceWords(text) {
        const regex = /[\p{L}\p{M}'’-]+/gu;
        const found = [];
        let match;
        while ((match = regex.exec(text)) !== null) {
            found.push(this.wordMatchKey(match[0]));
        }
        return found;
    }

    renderSentence(ex, container, btnCheck, btnNext, markCompleted = () => {}) {
        const required = Math.max(1, Math.ceil(ex.words.length / 2));
        container.innerHTML = `
            <div class="sentence-exercise">
                <div class="tags-pool" id="sentence-words-pool">
                    ${ex.words.map(w => `<span class="tag-item sentence-word-chip" data-word="${this.escapeHtmlForReading(w)}">${this.escapeHtmlForReading(w)}</span>`).join('')}
                </div>
                <textarea class="sentence-textarea" id="sentence-input" rows="3" placeholder="Écris ta phrase ici…" autocomplete="off"></textarea>
                <p class="sentence-counter" id="sentence-counter"></p>
            </div>
            <div class="ex-result" id="sentence-result" style="display:none;"></div>
        `;

        const textarea = container.querySelector('#sentence-input');
        const counterEl = container.querySelector('#sentence-counter');
        const resultEl = container.querySelector('#sentence-result');
        const chips = Array.from(container.querySelectorAll('.sentence-word-chip'));

        // Recalcule les mots utilisés à chaque frappe et met à jour le compteur + les étiquettes.
        const updateUsedWords = () => {
            const sentenceWords = new Set(this.extractSentenceWords(textarea.value));
            const used = ex.words.filter(w => sentenceWords.has(this.wordMatchKey(w)));
            const usedSet = new Set(used);
            chips.forEach(chip => {
                chip.classList.toggle('sentence-word-used', usedSet.has(chip.dataset.word));
            });
            counterEl.textContent = `${used.length} / ${ex.words.length} mots utilisés (il en faut au moins ${required})`;
            return used;
        };

        textarea.addEventListener('input', updateUsedWords);
        updateUsedWords();

        btnCheck.style.display = 'block';
        btnCheck.disabled = false;
        btnCheck.textContent = 'Vérifier';
        btnNext.style.display = 'none';

        btnCheck.onclick = async () => {
            const sentence = textarea.value.trim();
            if (!sentence) {
                resultEl.style.display = 'block';
                resultEl.innerHTML = '<p class="ex-score ex-score-fail">Écris une phrase avant de vérifier.</p>';
                return;
            }

            const used = updateUsedWords();
            if (used.length < required) {
                resultEl.style.display = 'block';
                resultEl.innerHTML = `<p class="ex-score ex-score-fail">Tu utilises ${used.length} mot${used.length > 1 ? 's' : ''} sur ${ex.words.length} — il en faut au moins ${required}. Continue !</p>`;
                return;
            }

            // Seuil de mots atteint : la correction grammaticale passe par Claude (backend)
            btnCheck.disabled = true;
            btnCheck.textContent = 'Vérification...';
            resultEl.style.display = 'block';
            resultEl.innerHTML = '<p class="ex-hint">Claude relit ta phrase…</p>';

            try {
                const verdict = await this.verifySentenceWithAI(sentence, used);
                const wordsFeedback = Array.isArray(verdict.wordsFeedback) ? verdict.wordsFeedback : [];
                const allWordsCorrect = wordsFeedback.every(w => w.correct);
                const overallValid = !!verdict.sentenceValid && allWordsCorrect;

                let html = '';

                // a) Emploi de chaque mot, avec explication
                if (wordsFeedback.length) {
                    html += '<ul class="sentence-word-feedback-list">';
                    wordsFeedback.forEach(w => {
                        const ok = !!w.correct;
                        html += `<li class="${ok ? 'sentence-word-feedback-ok' : 'sentence-word-feedback-bad'}">
                            <strong>${this.escapeHtmlForReading(w.word || '')}</strong> ${ok ? '✅' : '❌'}
                            ${w.explanation ? `— ${this.escapeHtmlForReading(w.explanation)}` : ''}
                        </li>`;
                    });
                    html += '</ul>';
                }

                // b) Grammaire de la phrase entière, avec exemple corrigé en couleur si besoin
                html += `<p class="ex-score ${verdict.sentenceValid ? 'ex-score-success' : 'ex-score-fail'}">${this.escapeHtmlForReading(verdict.sentenceFeedback || (verdict.sentenceValid ? 'Bravo, ta phrase est correcte !' : 'Ta phrase contient une erreur.'))}</p>`;
                if (!verdict.sentenceValid && verdict.correctedSentence) {
                    html += `<p class="sentence-corrected-example">✏️ ${this.escapeHtmlForReading(verdict.correctedSentence)}</p>`;
                }

                resultEl.innerHTML = html;

                if (overallValid) {
                    btnNext.style.display = 'block';
                    markCompleted();
                    btnCheck.style.display = 'none';
                } else {
                    btnCheck.disabled = false;
                    btnCheck.textContent = 'Vérifier';
                }
            } catch (error) {
                console.error('[CONTENT] Erreur vérification phrase:', error);
                resultEl.innerHTML = '<p class="ex-score ex-score-fail">Impossible de vérifier ta phrase pour le moment, réessaie.</p>';
                btnCheck.disabled = false;
                btnCheck.textContent = 'Vérifier';
            }
        };
    }

    async verifySentenceWithAI(sentence, words) {
        const response = await fetch('https://daspalecte-1086562672385.europe-west1.run.app', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'verify_sentence',
                sentence,
                words
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || 'Erreur lors de la vérification de la phrase');
        }

        return response.json();
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
        clone.querySelectorAll('#daspalecte-sidepanel-container, #daspalecte-toggle-btn, #daspalecte-exercise-overlay, #daspalecte-comprehension-test-overlay, #daspalecte-ct-floating-btn, #daspalecte-capture-overlay, #daspalecte-capture-result-overlay').forEach(el => el.remove());

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
        const tc = this.getThemeColors();
        const pairColors = this.currentTheme === 'classica'
            ? ['#2d6a5a', '#d4944c', '#c4862e', '#2d8a4e', '#b44040', '#7a5fa0', '#c4a022', '#1a8a6e']
            : ['#00f3ff', '#e879f9', '#ffa500', '#32cd32', '#ff6b6b', '#9b59b6', '#f1c40f', '#1abc9c'];
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
                const color = pairColorMap.get(frEl) || tc.primary;

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
            el.tabIndex = 0;
            el.setAttribute('role', 'button');
            el.setAttribute('aria-label', pair.fr);
            const handleSelect = (e) => {
                e.stopPropagation();
                if (el.classList.contains('ct-paired')) {
                    unpair(el);
                    return;
                }
                if (selectedFrEl) selectedFrEl.classList.remove('selected');
                el.classList.add('selected');
                selectedFrEl = el;
                tryFormPair();
            };
            el.addEventListener('click', handleSelect);
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(e);
                }
            });
            colFr.appendChild(el);
        });

        trItems.forEach(pair => {
            const el = document.createElement('div');
            el.className = 'match-item';
            el.textContent = pair.tr;
            el.dataset.val = pair.fr;
            el.tabIndex = 0;
            el.setAttribute('role', 'button');
            el.setAttribute('aria-label', pair.tr);
            const handleSelect = (e) => {
                e.stopPropagation();
                if (el.classList.contains('ct-paired')) {
                    unpair(el);
                    return;
                }
                if (selectedTrEl) selectedTrEl.classList.remove('selected');
                el.classList.add('selected');
                selectedTrEl = el;
                tryFormPair();
            };
            el.addEventListener('click', handleSelect);
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelect(e);
                }
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

            // Hide step indicator, nav and submit button
            const stepIndicator = overlay.querySelector('#ct-step-indicator');
            if (stepIndicator) stepIndicator.textContent = 'Résultats';
            const nav = overlay.querySelector('.ct-nav');
            if (nav) nav.style.display = 'none';
            const submitBtn = overlay.querySelector('#ct-submit-btn');
            if (submitBtn) submitBtn.style.display = 'none';

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

    // ========================================
    // CAPTURE & LECTURE (Screenshot OCR)
    // ========================================

    startScreenCapture(nativeLanguage) {
        if (nativeLanguage) this.nativeLanguage = nativeLanguage;

        // Save UI state for restoration
        const uiState = {
            sidepanelVisible: this.sidepanelVisible,
            toggleButtonVisible: this.toggleButton && this.toggleButton.style.display !== 'none'
        };

        // Hide sidepanel and toggle button so they don't appear in screenshot
        if (this.sidepanelVisible) {
            const container = document.getElementById('daspalecte-sidepanel-container');
            if (container) container.style.setProperty('display', 'none', 'important');
        }
        if (this.toggleButton) {
            this.toggleButton.style.setProperty('display', 'none', 'important');
        }
        document.documentElement.classList.remove('daspalecte-page-pushed');

        // Create selection overlay
        const overlay = document.createElement('div');
        overlay.id = 'daspalecte-capture-overlay';

        const instructions = document.createElement('div');
        instructions.className = 'capture-instructions';
        instructions.textContent = 'Dessinez un rectangle sur la zone à capturer — Échap pour annuler';
        overlay.appendChild(instructions);

        document.body.appendChild(overlay);

        let isDrawing = false;
        let startX, startY;
        let selectionRect = null;

        const onMouseDown = (e) => {
            if (e.target.closest('.capture-action-buttons')) return;
            isDrawing = true;
            startX = e.clientX;
            startY = e.clientY;

            // Remove previous selection rect and buttons
            const existingRect = document.getElementById('daspalecte-selection-rect');
            if (existingRect) existingRect.remove();
            const existingBtns = overlay.querySelector('.capture-action-buttons');
            if (existingBtns) existingBtns.remove();

            selectionRect = document.createElement('div');
            selectionRect.id = 'daspalecte-selection-rect';
            document.body.appendChild(selectionRect);
        };

        const onMouseMove = (e) => {
            if (!isDrawing || !selectionRect) return;
            const x = Math.min(e.clientX, startX);
            const y = Math.min(e.clientY, startY);
            const w = Math.abs(e.clientX - startX);
            const h = Math.abs(e.clientY - startY);

            selectionRect.style.setProperty('left', x + 'px', 'important');
            selectionRect.style.setProperty('top', y + 'px', 'important');
            selectionRect.style.setProperty('width', w + 'px', 'important');
            selectionRect.style.setProperty('height', h + 'px', 'important');
        };

        const onMouseUp = (e) => {
            if (!isDrawing) return;
            isDrawing = false;

            const rect = {
                x: Math.min(e.clientX, startX),
                y: Math.min(e.clientY, startY),
                width: Math.abs(e.clientX - startX),
                height: Math.abs(e.clientY - startY)
            };

            // Minimum size check
            if (rect.width < 20 || rect.height < 20) {
                if (selectionRect) selectionRect.remove();
                return;
            }

            this.showCaptureConfirmation(overlay, selectionRect, rect, uiState);
        };

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                this.cancelCapture(overlay, uiState);
                cleanup();
            }
        };

        const cleanup = () => {
            overlay.removeEventListener('mousedown', onMouseDown);
            overlay.removeEventListener('mousemove', onMouseMove);
            overlay.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('keydown', onKeyDown);
        };

        overlay.addEventListener('mousedown', onMouseDown);
        overlay.addEventListener('mousemove', onMouseMove);
        overlay.addEventListener('mouseup', onMouseUp);
        document.addEventListener('keydown', onKeyDown);

        // Store cleanup for external cancel
        overlay._cleanup = cleanup;
    }

    showCaptureConfirmation(overlay, selectionRect, rect, uiState) {
        // Position buttons below the selection
        const btnsContainer = document.createElement('div');
        btnsContainer.className = 'capture-action-buttons';
        btnsContainer.style.setProperty('left', rect.x + 'px', 'important');
        btnsContainer.style.setProperty('top', (rect.y + rect.height + 10) + 'px', 'important');

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'capture-confirm-btn';
        confirmBtn.textContent = '📷 Capturer';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'capture-cancel-btn';
        cancelBtn.textContent = 'Annuler';

        btnsContainer.appendChild(confirmBtn);
        btnsContainer.appendChild(cancelBtn);
        overlay.appendChild(btnsContainer);

        confirmBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (overlay._cleanup) overlay._cleanup();
            this.executeCapture(selectionRect, overlay, rect, uiState);
        });

        cancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (overlay._cleanup) overlay._cleanup();
            this.cancelCapture(overlay, uiState);
        });
    }

    async executeCapture(selectionRect, overlay, rect, uiState) {
        // Remove selection UI
        if (selectionRect) selectionRect.remove();
        if (overlay) overlay.remove();

        // Wait for UI to clear before screenshot
        await new Promise(resolve => setTimeout(resolve, 100));

        // Ask background to capture visible tab
        chrome.runtime.sendMessage({ type: 'CAPTURE_VISIBLE_TAB' }, async (response) => {
            // Restore UI immediately
            this.restoreUIAfterCapture(uiState);

            if (!response || response.error) {
                console.error('[CONTENT] Screenshot error:', response?.error);
                alert('Erreur lors de la capture d\'écran.');
                return;
            }

            // Crop the screenshot
            const dpr = window.devicePixelRatio || 1;
            try {
                const croppedDataUrl = await this.cropScreenshot(response.dataUrl, rect, dpr);

                // Show loader
                this.showCaptureResultLoader();

                // Analyze with Claude Vision
                await this.analyzeScreenshot(croppedDataUrl);
            } catch (error) {
                console.error('[CONTENT] Crop/analyze error:', error);
                alert('Erreur lors du traitement de la capture.');
                this.closeCaptureResultOverlay();
            }
        });
    }

    cropScreenshot(dataUrl, rect, dpr) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // Scale rect by device pixel ratio
                const sx = rect.x * dpr;
                const sy = rect.y * dpr;
                const sw = rect.width * dpr;
                const sh = rect.height * dpr;

                canvas.width = sw;
                canvas.height = sh;
                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

                // Resize if larger than 1568px on any side (Claude limit)
                const maxDim = 1568;
                if (sw > maxDim || sh > maxDim) {
                    const scale = Math.min(maxDim / sw, maxDim / sh);
                    const newW = Math.round(sw * scale);
                    const newH = Math.round(sh * scale);
                    const resizedCanvas = document.createElement('canvas');
                    resizedCanvas.width = newW;
                    resizedCanvas.height = newH;
                    const rctx = resizedCanvas.getContext('2d');
                    rctx.drawImage(canvas, 0, 0, newW, newH);
                    resolve(resizedCanvas.toDataURL('image/png'));
                } else {
                    resolve(canvas.toDataURL('image/png'));
                }
            };
            img.onerror = reject;
            img.src = dataUrl;
        });
    }

    cancelCapture(overlay, uiState) {
        const selectionRect = document.getElementById('daspalecte-selection-rect');
        if (selectionRect) selectionRect.remove();
        if (overlay) overlay.remove();
        this.restoreUIAfterCapture(uiState);
    }

    restoreUIAfterCapture(uiState) {
        if (this.toggleButton) {
            this.toggleButton.style.removeProperty('display');
        }

        if (uiState.sidepanelVisible) {
            const container = document.getElementById('daspalecte-sidepanel-container');
            if (container) container.style.removeProperty('display');
            document.documentElement.classList.add('daspalecte-page-pushed');
        }
    }

    showCaptureResultLoader() {
        const existing = document.getElementById('daspalecte-capture-result-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'daspalecte-capture-result-overlay';
        overlay.innerHTML = `
            <div class="capture-result-content capture-loader-active">
                <div class="loader-container">
                    <div class="neon-spinner"></div>
                    <p style="color: #aaa; font-family: Inter, sans-serif;">Claude analyse l'image...</p>
                </div>
                <button class="capture-result-close" title="Fermer">×</button>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.capture-result-close').onclick = () => this.closeCaptureResultOverlay();
    }

    closeCaptureResultOverlay() {
        const overlay = document.getElementById('daspalecte-capture-result-overlay');
        if (overlay) overlay.remove();
    }

    async analyzeScreenshot(croppedDataUrl) {
        const CLOUD_FUNCTION_URL = 'https://daspalecte-1086562672385.europe-west1.run.app';

        // Strip data URL prefix to get raw base64
        const base64 = croppedDataUrl.split(',')[1];

        try {
            const response = await fetch(CLOUD_FUNCTION_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'analyze_screenshot',
                    image: base64,
                    nativeLanguage: this.nativeLanguage
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('[CONTENT] Erreur analyze_screenshot:', errorData);
                throw new Error('Erreur analyse image');
            }

            const data = await response.json();
            this.displayCaptureResult(data, croppedDataUrl);
        } catch (error) {
            console.error('[CONTENT] Erreur analyzeScreenshot:', error);
            alert('Erreur lors de l\'analyse de l\'image.');
            this.closeCaptureResultOverlay();
        }
    }

    displayCaptureResult(data, screenshotDataUrl) {
        const overlay = document.getElementById('daspalecte-capture-result-overlay');
        if (!overlay) return;

        const content = overlay.querySelector('.capture-result-content');
        content.classList.remove('capture-loader-active');

        const annotatedHTML = this.buildAnnotatedHTML(data);

        // Build difficult words list with speaker buttons
        let wordsHTML = '';
        if (data.difficultWords && data.difficultWords.length > 0) {
            wordsHTML = `
                <div class="capture-words-section">
                    <span class="capture-text-label">Mots difficiles</span>
                    <div class="capture-words-list">
                        ${data.difficultWords.map(w => `
                            <div class="capture-word-item">
                                <div>
                                    <span class="capture-word-fr">${w.word}</span>
                                    <span class="capture-speak-btn" data-word="${w.word}" title="Écouter">\u{1F50A}</span>
                                    <span class="capture-word-tr"> — ${w.translation}</span>
                                    ${w.definition ? `<div class="capture-word-def">${w.definition}</div>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        content.innerHTML = `
            <div class="capture-result-header">
                <h2 class="capture-result-title">Capture & Lecture</h2>
                <div class="capture-header-actions">
                    <div class="capture-translator-toggle">
                        <span class="capture-toggle-label">Traducteur</span>
                        <label class="capture-switch">
                            <input type="checkbox" id="capture-translator-toggle-input">
                            <span class="capture-slider"></span>
                        </label>
                    </div>
                    <button class="capture-result-close" title="Fermer">×</button>
                </div>
            </div>
            <div class="capture-result-body">
                <div class="capture-result-left">
                    <img src="${screenshotDataUrl}" alt="Capture" class="capture-screenshot-img">
                </div>
                <div class="capture-result-right">
                    <span class="capture-text-label">Texte extrait</span>
                    <div class="capture-text-container" id="capture-text-content">
                        ${annotatedHTML}
                    </div>
                    ${wordsHTML}
                </div>
            </div>
        `;

        content.querySelector('.capture-result-close').onclick = () => this.closeCaptureResultOverlay();

        // Toggle translator in overlay
        const toggleInput = content.querySelector('#capture-translator-toggle-input');
        const textContainer = content.querySelector('#capture-text-content');
        let captureTranslatorEnabled = false;

        toggleInput.addEventListener('change', () => {
            captureTranslatorEnabled = toggleInput.checked;
            textContainer.style.setProperty('cursor', captureTranslatorEnabled ? 'help' : 'default', 'important');
        });

        // Click-to-translate controlled by toggle
        textContainer.addEventListener('click', (e) => {
            if (!captureTranslatorEnabled) return;
            const word = this.getWordAtPosition(e);
            if (word) {
                e.preventDefault();
                e.stopPropagation();
                this.handleWordClick(word, e);
            }
        }, true);

        // Wire up speaker buttons
        content.querySelectorAll('.capture-speak-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.speakFrench(btn.dataset.word);
            });
        });
    }

    showRoadmapOverlay() {
        // Remove existing if any
        const existing = document.getElementById('daspalecte-roadmap-overlay');
        if (existing) { existing.remove(); return; }

        const overlay = document.createElement('div');
        overlay.id = 'daspalecte-roadmap-overlay';
        overlay.innerHTML = `
            <div class="daspalecte-roadmap-card">
                <div class="daspalecte-roadmap-header">
                    <h2 class="daspalecte-roadmap-title">Daspalecte</h2>
                    <button class="daspalecte-roadmap-close">&times;</button>
                </div>
                <div class="daspalecte-roadmap-section">
                    <h3 class="daspalecte-roadmap-section-title">Nouveautes</h3>
                    <ul class="daspalecte-roadmap-list">
                        <li class="daspalecte-roadmap-item">
                            <span class="daspalecte-roadmap-icon">🎨</span>
                            <span>Choix du theme visuel (Cyberpunk / Classica)</span>
                        </li>
                        <li class="daspalecte-roadmap-item">
                            <span class="daspalecte-roadmap-icon">📄</span>
                            <span>Test de lecture sur PDF</span>
                        </li>
                        <li class="daspalecte-roadmap-item">
                            <span class="daspalecte-roadmap-icon">✏️</span>
                            <span>Exercices sur PDF</span>
                        </li>
                    </ul>
                </div>
                <div class="daspalecte-roadmap-section">
                    <h3 class="daspalecte-roadmap-section-title">A venir</h3>
                    <ul class="daspalecte-roadmap-list">
                        <li class="daspalecte-roadmap-item">
                            <span class="daspalecte-roadmap-icon">🎨</span>
                            <span>CSS a ameliorer</span>
                        </li>
                        <li class="daspalecte-roadmap-item">
                            <span class="daspalecte-roadmap-icon">📝</span>
                            <span>Test de lecture : email au prof + ameliorations</span>
                        </li>
                        <li class="daspalecte-roadmap-item">
                            <span class="daspalecte-roadmap-icon">👩‍🏫</span>
                            <span>Interface professeur</span>
                        </li>
                        <li class="daspalecte-roadmap-item">
                            <span class="daspalecte-roadmap-icon">📊</span>
                            <span>Adaptation par niveau CECR (A1 → C2)</span>
                        </li>
                        <li class="daspalecte-roadmap-item">
                            <span class="daspalecte-roadmap-icon">📈</span>
                            <span>Suivi pedagogique & revisions espacees</span>
                        </li>
                    </ul>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Close on X button
        overlay.querySelector('.daspalecte-roadmap-close').addEventListener('click', () => overlay.remove());
        // Close on click outside card
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    buildAnnotatedHTML(data) {
        const text = data.annotatedText || data.transcription || '';
        // Split into paragraphs and wrap with <p> tags
        return text.split('\n').filter(line => line.trim()).map(line =>
            `<p style="margin: 0 0 12px 0 !important; color: var(--t-text) !important; font-family: Inter, sans-serif !important;">${line}</p>`
        ).join('');
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
        // PDF viewer: use margin annotations instead of inline bubbles
        if (this.isPdfViewer()) {
            return this.addPdfMarginAnnotation(wordElement, text);
        }

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

    // Collapse a PDF annotation into a small bubble icon
    collapsePdfAnnotation(annotation) {
        if (annotation.classList.contains('collapsed')) return;
        annotation.classList.add('collapsed');
        // Store full content for later expansion
        annotation._fullContent = annotation.innerHTML;
        const word = annotation.querySelector('.pdf-annotation-word')?.textContent || '?';
        annotation.innerHTML = `<span class="pdf-annotation-bubble" title="${word}">💬</span>`;
        annotation.querySelector('.pdf-annotation-bubble').addEventListener('click', (e) => {
            e.stopPropagation();
            this.expandPdfAnnotation(annotation);
        });
        this.layoutCollapsedBubbles();
    }

    // Expand a collapsed PDF annotation back to full card
    expandPdfAnnotation(annotation) {
        if (!annotation.classList.contains('collapsed')) return;
        // Collapse all other expanded annotations first
        document.querySelectorAll('.pdf-margin-annotation:not(.collapsed)').forEach(a => {
            if (a !== annotation) this.collapsePdfAnnotation(a);
        });
        annotation.classList.remove('collapsed');
        annotation.innerHTML = annotation._fullContent;
        // Reset horizontal offset
        annotation.style.left = '';
        // Re-attach event listeners
        const closeBtn = annotation.querySelector('.pdf-annotation-close');
        const speakBtn = annotation.querySelector('.pdf-annotation-speak');
        const wordId = annotation.dataset.wordId;
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                const highlight = document.querySelector(`.pdf-word-highlight[data-annotation-id="${wordId}"]`);
                if (highlight) highlight.remove();
                annotation.remove();
                this.layoutCollapsedBubbles();
            });
        }
        if (speakBtn) {
            speakBtn.addEventListener('click', () => {
                this.speakFrench(speakBtn.dataset.word);
            });
        }
        const minimizeBtn = annotation.querySelector('.pdf-annotation-minimize');
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
                this.collapsePdfAnnotation(annotation);
            });
        }
        this.layoutCollapsedBubbles();
    }

    // Arrange collapsed bubbles on the same line horizontally
    layoutCollapsedBubbles() {
        document.querySelectorAll('.pdf-page-margin').forEach(marginContainer => {
            const collapsed = [...marginContainer.querySelectorAll('.pdf-margin-annotation.collapsed')];
            if (collapsed.length === 0) return;

            // Group by similar top position (within 15px = same line)
            const lines = [];
            collapsed.forEach(ann => {
                const top = parseInt(ann.style.top) || 0;
                const line = lines.find(l => Math.abs(l.top - top) < 15);
                if (line) {
                    line.items.push(ann);
                } else {
                    lines.push({ top, items: [ann] });
                }
            });

            // For each line group, offset bubbles horizontally
            lines.forEach(line => {
                line.items.forEach((ann, i) => {
                    ann.style.left = (i * 36) + 'px';
                });
            });
        });
    }

    // PDF margin annotation — like Google Docs comments
    async addPdfMarginAnnotation(wordElement, text) {
        // Find the closest pdf-page-wrapper to position annotation relative to it
        const pageWrapper = wordElement.closest('.pdf-page-wrapper');
        if (!pageWrapper) return;

        // Collapse all existing expanded annotations
        document.querySelectorAll('.pdf-margin-annotation:not(.collapsed)').forEach(a => {
            this.collapsePdfAnnotation(a);
        });

        // Ensure margin container exists for this page
        let marginContainer = pageWrapper.querySelector('.pdf-page-margin');
        if (!marginContainer) {
            marginContainer = document.createElement('div');
            marginContainer.className = 'pdf-page-margin';
            pageWrapper.appendChild(marginContainer);
        }

        // Get word position relative to the page wrapper
        const wrapperRect = pageWrapper.getBoundingClientRect();
        const wordRect = wordElement.getBoundingClientRect();
        const wordTop = wordRect.top - wrapperRect.top;

        // Create highlight overlay at exact word position
        const highlight = document.createElement('div');
        highlight.className = 'pdf-word-highlight';
        highlight.style.left = (wordRect.left - wrapperRect.left) + 'px';
        highlight.style.top = (wordRect.top - wrapperRect.top) + 'px';
        highlight.style.width = wordRect.width + 'px';
        highlight.style.height = wordRect.height + 'px';
        pageWrapper.appendChild(highlight);

        // Create annotation card
        const annotationId = Date.now().toString();
        const annotation = document.createElement('div');
        annotation.className = 'pdf-margin-annotation';
        annotation.style.top = wordTop + 'px';
        annotation.dataset.wordId = annotationId;

        // Loading state
        annotation.innerHTML = '<div class="pdf-annotation-loading">⏳</div>';
        marginContainer.appendChild(annotation);

        // Link for cleanup
        wordElement.dataset.annotationId = annotationId;
        highlight.dataset.annotationId = annotationId;

        const cleanup = () => {
            highlight.remove();
            annotation.remove();
            this.selectedWords.delete(wordElement);
            this.translations.delete(wordElement);
            delete wordElement.dataset.annotationId;
            this.layoutCollapsedBubbles();
        };

        try {
            const translation = await this.translateText(text);

            annotation.innerHTML = `
                <div class="pdf-annotation-header">
                    <span class="pdf-annotation-word">${text}</span>
                    <div class="pdf-annotation-actions">
                        <button class="pdf-annotation-speak" data-word="${text}" title="Écouter">🔊</button>
                        <button class="pdf-annotation-minimize" title="Réduire">—</button>
                        <button class="pdf-annotation-close" title="Fermer">✕</button>
                    </div>
                </div>
                <div class="pdf-annotation-translation">${translation}</div>
            `;

            annotation.querySelector('.pdf-annotation-close').addEventListener('click', cleanup);
            annotation.querySelector('.pdf-annotation-minimize').addEventListener('click', () => {
                this.collapsePdfAnnotation(annotation);
            });
            annotation.querySelector('.pdf-annotation-speak').addEventListener('click', () => {
                this.speakFrench(text);
            });

            this.selectedWords.add(wordElement);
            this.translations.set(wordElement, annotation);

            this.sendMessageToSidepanel({
                type: 'WORD_SELECTED',
                word: text,
                translation: translation
            });

        } catch (error) {
            annotation.innerHTML = `
                <div class="pdf-annotation-header">
                    <span class="pdf-annotation-word">${text}</span>
                    <button class="pdf-annotation-close" title="Fermer">✕</button>
                </div>
                <div class="pdf-annotation-translation" style="color:#ff6b6b;">Erreur</div>
            `;
            annotation.querySelector('.pdf-annotation-close').addEventListener('click', cleanup);
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
