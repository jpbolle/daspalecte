// ============================================
// THEME CHOOSER
// ============================================
const themeChooser = document.getElementById('theme-chooser');
const mainPopup = document.getElementById('main-popup');
const themeConfirmBtn = document.getElementById('theme-confirm');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const themeCards = document.querySelectorAll('.theme-card');
let selectedTheme = null;

function showThemeChooser() {
    themeChooser.style.display = 'flex';
    mainPopup.style.display = 'none';
    selectedTheme = null;
    themeCards.forEach(c => {
        c.classList.remove('selected');
        c.setAttribute('aria-checked', 'false');
    });
    themeConfirmBtn.disabled = true;
}

function showMainPopup() {
    themeChooser.style.display = 'none';
    mainPopup.style.display = 'flex';
}

// Theme card selection (souris, tactile, clic clavier via Entrée/Espace, et flèches entre les 2 cartes)
themeCards.forEach(card => {
    const selectCard = () => {
        themeCards.forEach(c => {
            c.classList.remove('selected');
            c.setAttribute('aria-checked', 'false');
        });
        card.classList.add('selected');
        card.setAttribute('aria-checked', 'true');
        selectedTheme = card.getAttribute('data-theme-choice');
        themeConfirmBtn.disabled = false;
    };

    card.addEventListener('click', selectCard);

    card.addEventListener('keydown', (e) => {
        const cards = Array.from(themeCards);
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectCard();
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            cards[(cards.indexOf(card) + 1) % cards.length].focus();
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            cards[(cards.indexOf(card) - 1 + cards.length) % cards.length].focus();
        }
    });
});

// Confirm theme choice
themeConfirmBtn.addEventListener('click', () => {
    if (!selectedTheme) return;
    chrome.storage.local.set({ theme: selectedTheme });
    document.documentElement.setAttribute('data-daspalecte-theme', selectedTheme);
    showMainPopup();
});

// Theme toggle button in header
themeToggleBtn.addEventListener('click', () => {
    showThemeChooser();
});

// On popup open: check if theme is already set
try {
    chrome.storage.local.get(['theme'], (data) => {
        if (chrome.runtime.lastError) {
            console.error('[POPUP] Storage error:', chrome.runtime.lastError);
            showMainPopup(); // Fallback: show main popup
            return;
        }
        if (data && data.theme) {
            showMainPopup();
        } else {
            showThemeChooser();
        }
    });
} catch (e) {
    console.error('[POPUP] Init error:', e);
    showMainPopup(); // Fallback
}

// ============================================
// LANGUAGE SELECTOR
// ============================================
const nativeLanguagePopup = document.getElementById('native-language-popup');

chrome.storage.local.get(['nativeLanguage'], (data) => {
    if (data.nativeLanguage) {
        nativeLanguagePopup.value = data.nativeLanguage;
    } else {
        nativeLanguagePopup.value = 'en';
    }
});

nativeLanguagePopup.addEventListener('change', () => {
    chrome.storage.local.set({ nativeLanguage: nativeLanguagePopup.value });
    console.log('[POPUP] Langue maternelle changée:', nativeLanguagePopup.value);
});

// ============================================
// ROADMAP & INFO BUTTONS
// ============================================
document.getElementById('btn-roadmap').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: 'SHOW_ROADMAP' });
        window.close();
    }
});

document.getElementById('btn-info').addEventListener('click', () => {
    window.open('https://www.pedagokit.be/notre-kit/outils-pistes-disciplinaires/fran%C3%A7ais/fran-daspalecte', '_blank');
});

// ============================================
// BUTTONS
// ============================================
document.getElementById('btn-gem').addEventListener('click', () => {
    window.open('https://gemini.google.com/gem/1MhsoBryecLbHB0E55FniFfNUpHz7L443?usp=sharing', '_blank');
});

document.getElementById('btn-sidepanel').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) {
        chrome.tabs.sendMessage(tab.id, { type: 'SHOW_EXTENSION' });
        window.close();
    }
});

// ============================================
// PDF DETECTION
// ============================================
function extractPdfUrl(url) {
    const adobeMatch = url.match(/^chrome-extension:\/\/[a-z]+\/(https?:\/\/.+)$/i);
    if (adobeMatch) return adobeMatch[1];
    return url;
}

function isPdfUrl(url) {
    const lower = url.toLowerCase();
    return lower.endsWith('.pdf') ||
           lower.includes('.pdf?') ||
           lower.includes('.pdf#') ||
           lower.includes('content-type=application/pdf');
}

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

// ============================================================
// COMPTE — la connexion Google conditionne l'accès à l'extension
// ============================================================
//
// La popup est la porte d'entrée : tant que l'élève n'est pas identifié, elle
// n'affiche que l'écran de connexion. C'est aussi le seul endroit de
// l'extension où une fenêtre de consentement Google peut s'ouvrir ;
// background.js ne demande ensuite que des jetons silencieux.
//
// Un point délibéré : si le service worker ne répond pas du tout (message en
// erreur, extension en cours de rechargement), on laisse passer. Verrouiller un
// élève dehors à cause d'un hoquet technique serait pire que le laisser entrer.

const loginScreen = document.getElementById('login-screen');
const loginText = document.getElementById('login-text');
const loginBtn = document.getElementById('login-btn');
const appScreen = document.getElementById('app-screen');
const accountLine = document.getElementById('account-line');
const accountStatus = document.getElementById('account-status');
const accountBtn = document.getElementById('btn-account');
const accountSignOutBtn = document.getElementById('account-signout-btn');

const LOGIN_PROMPT = 'Connecte-toi avec ton compte de l’école pour utiliser Daspalecte.';

// Traduit le message brut de chrome.identity en explication utilisable.
function describeSignInFailure(reason) {
    const raw = String(reason || '').toLowerCase();
    if (raw.includes('not granted') || raw.includes('rejected') || raw.includes('canceled') || raw.includes('cancelled')) {
        return 'Connexion annulée. Réessaie quand tu veux.';
    }
    if (raw.includes('not signed in')) {
        return 'Ce profil Chrome n’est connecté à aucun compte Google.';
    }
    if (raw) {
        return 'Google a refusé la connexion. Vérifie que tu utilises bien le compte de ton école.';
    }
    return 'La connexion a échoué. Réessaie.';
}

function showLogin(message, isError) {
    loginText.textContent = message || LOGIN_PROMPT;
    loginText.classList.toggle('is-error', Boolean(isError));
    loginScreen.style.display = 'flex';
    appScreen.style.display = 'none';
    // L'icône du coin n'a pas de sens tant qu'il n'y a pas de compte.
    if (accountBtn) accountBtn.style.display = 'none';
    if (accountLine) accountLine.style.display = 'none';
}

function showApp(account, blocked) {
    loginScreen.style.display = 'none';
    appScreen.style.display = 'block';
    if (accountBtn) accountBtn.style.display = 'flex';

    if (account && account.email) {
        accountStatus.textContent = blocked
            ? `${account.email} — non inscrit par un professeur, tes résultats ne sont pas enregistrés.`
            : account.email;
    } else {
        accountStatus.textContent = 'Compte non identifié';
    }
}

function refreshAccount() {
    if (!loginScreen) return;
    try {
        chrome.runtime.sendMessage({ type: 'ANALYTICS_ACCOUNT' }, (state) => {
            if (chrome.runtime.lastError) {
                // Le service worker n'a pas répondu : on n'enferme personne dehors.
                console.warn('[POPUP] état du compte indisponible, accès laissé ouvert.');
                showApp(null, false);
                return;
            }
            if (state && state.account && state.account.email) {
                showApp(state.account, state.blocked);
            } else {
                showLogin(LOGIN_PROMPT, false);
            }
        });
    } catch (e) {
        showApp(null, false);
    }
}

if (loginBtn) {
    loginBtn.addEventListener('click', () => {
        loginBtn.disabled = true;
        showLogin('Connexion en cours…', false);
        try {
            chrome.runtime.sendMessage({ type: 'ANALYTICS_SIGN_IN' }, (result) => {
                loginBtn.disabled = false;
                if (chrome.runtime.lastError || !result || !result.ok) {
                    // Le motif du refus est décisif : un compte hors de l'école est
                    // bloqué par Google, ce qui n'a rien à voir avec un échec réseau.
                    const reason = (result && result.error)
                        || (chrome.runtime.lastError && chrome.runtime.lastError.message)
                        || '';
                    console.warn('[POPUP] connexion refusée :', reason);
                    showLogin(describeSignInFailure(reason), true);
                    return;
                }
                refreshAccount();
            });
        } catch (e) {
            loginBtn.disabled = false;
            showLogin('La connexion a échoué. Réessaie.', true);
        }
    });
}

if (accountBtn) {
    accountBtn.addEventListener('click', () => {
        const open = accountLine.style.display !== 'none';
        accountLine.style.display = open ? 'none' : 'flex';
        accountBtn.setAttribute('aria-expanded', String(!open));
    });
}

if (accountSignOutBtn) {
    accountSignOutBtn.addEventListener('click', () => {
        try {
            chrome.runtime.sendMessage({ type: 'ANALYTICS_SIGN_OUT' }, () => {
                void chrome.runtime.lastError;
                accountLine.style.display = 'none';
                if (accountBtn) accountBtn.setAttribute('aria-expanded', 'false');
                showLogin(LOGIN_PROMPT, false);
            });
        } catch (e) { /* extension context invalidated */ }
    });
}

refreshAccount();

// Bouton « Mes résultats » : ouvre l'app web. L'URL vient du service worker
// pour qu'elle ne soit definie qu'a un seul endroit (analytics.js), et qu'un
// basculement local / production n'oblige pas a toucher deux fichiers.
const siteBtn = document.getElementById('btn-site');

if (siteBtn) {
    siteBtn.addEventListener('click', () => {
        try {
            chrome.runtime.sendMessage({ type: 'ANALYTICS_APP_URL' }, (result) => {
                if (chrome.runtime.lastError || !result || !result.url) {
                    console.warn('[POPUP] URL du site indisponible.');
                    return;
                }
                chrome.tabs.create({ url: result.url });
                window.close();
            });
        } catch (e) { /* extension context invalidated */ }
    });
}
