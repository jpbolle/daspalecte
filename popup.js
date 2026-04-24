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
    themeCards.forEach(c => c.classList.remove('selected'));
    themeConfirmBtn.disabled = true;
}

function showMainPopup() {
    themeChooser.style.display = 'none';
    mainPopup.style.display = 'flex';
}

// Theme card selection
themeCards.forEach(card => {
    card.addEventListener('click', () => {
        themeCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedTheme = card.getAttribute('data-theme-choice');
        themeConfirmBtn.disabled = false;
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
