import * as pdfjsLib from './lib/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.mjs');

const state = {
    pdf: null,
    currentScale: 1.5,
    renderedPages: new Set(), // texte extrait + emplacement posé (léger, pour toutes les pages)
    visuallyRendered: new Set(), // canvas effectivement dessiné (seulement les pages visibles)
    rendering: false,
    pageObserver: null
};

// DOM elements
const container = document.getElementById('pdf-container');
const prevBtn = document.getElementById('pdf-prev');
const nextBtn = document.getElementById('pdf-next');
const pageInput = document.getElementById('pdf-page-input');
const pageCount = document.getElementById('pdf-page-count');
const zoomIn = document.getElementById('pdf-zoom-in');
const zoomOut = document.getElementById('pdf-zoom-out');
const zoomFit = document.getElementById('pdf-zoom-fit');
const zoomLevel = document.getElementById('pdf-zoom-level');
const scannedWarning = document.getElementById('pdf-scanned-warning');

// Get PDF URL from query params
function getPdfUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('url');
}

// Show loading
function showLoading() {
    const loader = document.createElement('div');
    loader.id = 'pdf-loading';
    loader.innerHTML = '<div class="spinner"></div><div>Chargement du PDF...</div>';
    document.body.appendChild(loader);
}

function hideLoading() {
    const loader = document.getElementById('pdf-loading');
    if (loader) loader.remove();
}

// Pose l'emplacement de la page (dimensions correctes pour le scroll) et en extrait le texte.
// Léger : pas de rasterisation de canvas — se fait pour TOUTES les pages dès le chargement,
// pour que la compréhension / le test de lecture disposent du texte complet immédiatement.
async function createPagePlaceholder(pageNum) {
    if (state.renderedPages.has(pageNum)) return;

    const page = await state.pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: state.currentScale });

    const wrapper = document.createElement('div');
    wrapper.className = 'pdf-page-wrapper pending';
    wrapper.dataset.pageNum = pageNum;
    wrapper.style.width = viewport.width + 'px';
    wrapper.style.height = viewport.height + 'px';
    container.appendChild(wrapper);

    const textContent = await page.getTextContent();

    // Check for scanned PDF (first page only)
    if (pageNum === 1) {
        const totalChars = textContent.items.reduce((sum, item) => sum + item.str.trim().length, 0);
        if (totalChars < 10) {
            scannedWarning.style.display = 'inline';
        }
    }

    // Regroupe les lignes en paragraphes (pour boutons magiques / test de lecture)
    let lastY = null;
    let lineTexts = [];
    let paragraphLines = [];
    let paragraphStartY = 0;

    textContent.items.forEach(item => {
        if (!item.str.trim()) return;

        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const fontSize = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
        const currentY = Math.round(tx[5] - fontSize);

        if (lastY !== null && Math.abs(currentY - lastY) > fontSize * 1.8) {
            if (lineTexts.length > 0) {
                paragraphLines.push({ text: lineTexts.join(' '), y: paragraphStartY });
                lineTexts = [];
                paragraphStartY = currentY;
            }
        }
        if (lineTexts.length === 0) paragraphStartY = currentY;
        lineTexts.push(item.str);
        lastY = currentY;
    });

    if (lineTexts.length > 0) {
        paragraphLines.push({ text: lineTexts.join(' '), y: paragraphStartY });
    }

    // Store paragraph data on the wrapper for magic buttons
    wrapper._paragraphs = paragraphLines
        .filter(p => p.text.trim().length > 50)
        .map(p => ({ text: p.text.trim(), y: p.y }));

    // Add structured paragraphs to the hidden text container (un seul appendChild groupé)
    const textContainer = document.getElementById('pdf-text-content');
    const textFragment = document.createDocumentFragment();
    paragraphLines.forEach(item => {
        if (item.text.trim().length > 10) {
            const p = document.createElement('p');
            p.textContent = item.text.trim();
            textFragment.appendChild(p);
        }
    });
    textContainer.appendChild(textFragment);

    state.renderedPages.add(pageNum);
}

// Rendu visuel réel d'une page (canvas + calque de texte cliquable) — coûteux,
// déclenché uniquement quand la page approche de la zone visible (voir observeVisiblePages).
async function renderPageVisual(pageNum) {
    if (state.visuallyRendered.has(pageNum)) return;
    state.visuallyRendered.add(pageNum);

    const wrapper = container.querySelector(`.pdf-page-wrapper[data-page-num="${pageNum}"]`);
    if (!wrapper) return;

    const page = await state.pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: state.currentScale });

    // Canvas for rendering
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width * window.devicePixelRatio;
    canvas.height = viewport.height * window.devicePixelRatio;
    canvas.style.width = viewport.width + 'px';
    canvas.style.height = viewport.height + 'px';
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    wrapper.appendChild(canvas);

    // Text layer (overlay cliquable pour la traduction, positions recalculées à l'échelle actuelle)
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'pdf-text-layer';
    wrapper.appendChild(textLayerDiv);

    await page.render({ canvasContext: ctx, viewport }).promise;

    const textContent = await page.getTextContent();
    const spanFragment = document.createDocumentFragment();

    textContent.items.forEach(item => {
        if (!item.str.trim()) return;

        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);

        const span = document.createElement('span');
        span.textContent = item.str;

        const fontSize = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
        const left = tx[4];
        const top = tx[5] - fontSize;

        span.style.left = left + 'px';
        span.style.top = top + 'px';
        span.style.fontSize = fontSize + 'px';
        span.style.fontFamily = item.fontName || 'sans-serif';

        if (item.width > 0) {
            span.style.width = (item.width * state.currentScale) + 'px';
            span.style.letterSpacing = 'normal';
        }

        spanFragment.appendChild(span);
    });

    textLayerDiv.appendChild(spanFragment);
    wrapper.classList.remove('pending');
}

// Observe les emplacements de page et ne déclenche le rendu visuel (coûteux) que
// pour celles qui approchent de la zone visible — évite de garder des dizaines
// de canvas pleine résolution en mémoire sur un long PDF.
function observeVisiblePages() {
    if (state.pageObserver) {
        state.pageObserver.disconnect();
    }

    state.pageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const pageNum = parseInt(entry.target.dataset.pageNum, 10);
                renderPageVisual(pageNum);
                state.pageObserver.unobserve(entry.target);
            }
        });
    }, {
        root: null,
        rootMargin: '600px 0px', // pré-rend un peu avant que la page n'entre à l'écran
        threshold: 0.01
    });

    container.querySelectorAll('.pdf-page-wrapper').forEach(wrapper => {
        state.pageObserver.observe(wrapper);
    });
}

// Render all pages
async function renderAllPages() {
    const numPages = state.pdf.numPages;

    // Add title to text section
    const textContainer = document.getElementById('pdf-text-content');
    if (!textContainer.querySelector('#pdf-text-content-title')) {
        const title = document.createElement('div');
        title.id = 'pdf-text-content-title';
        title.textContent = 'Texte extrait du PDF';
        textContainer.prepend(title);
    }

    // Emplacements + texte pour toutes les pages (léger, nécessaire pour compréhension/test de lecture)
    for (let i = 1; i <= numPages; i++) {
        await createPagePlaceholder(i);
    }

    // Rendu visuel (canvas) uniquement pour les pages qui approchent de l'écran
    observeVisiblePages();

    // Notify content.js that PDF text is ready (for magic buttons, test de lecture, etc.)
    document.dispatchEvent(new CustomEvent('daspalecte-pdf-ready'));
}

// Re-render all at new scale
async function rerender() {
    if (state.rendering) return; // évite les rendus concurrents (double zoom rapide, resize pendant un rendu)
    state.rendering = true;
    try {
        if (state.pageObserver) {
            state.pageObserver.disconnect();
            state.pageObserver = null;
        }
        container.innerHTML = '';
        const textContainer = document.getElementById('pdf-text-content');
        textContainer.innerHTML = '';
        state.renderedPages.clear();
        state.visuallyRendered.clear();
        zoomLevel.textContent = Math.round(state.currentScale / 1.5 * 100) + '%';
        await renderAllPages();
    } finally {
        state.rendering = false;
    }
}

// Fit to width
function fitToWidth() {
    if (!state.pdf) return;
    state.pdf.getPage(1).then(page => {
        const unscaledViewport = page.getViewport({ scale: 1 });
        // Lit la marge réelle (elle varie selon les breakpoints CSS) plutôt qu'une valeur figée
        const containerStyle = window.getComputedStyle(container);
        const horizontalPadding = parseFloat(containerStyle.paddingLeft) + parseFloat(containerStyle.paddingRight);
        const availableWidth = window.innerWidth - horizontalPadding;
        state.currentScale = availableWidth / unscaledViewport.width;
        rerender();
    });
}

// Navigate to page
function scrollToPage(num) {
    const wrapper = container.querySelector(`.pdf-page-wrapper[data-page-num="${num}"]`);
    if (wrapper) {
        wrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        pageInput.value = num;
    }
}

// Track current visible page on scroll
function updateCurrentPage() {
    const wrappers = container.querySelectorAll('.pdf-page-wrapper');
    const toolbarHeight = 48;
    let currentPage = 1;

    for (const w of wrappers) {
        const rect = w.getBoundingClientRect();
        if (rect.top < window.innerHeight / 2 && rect.bottom > toolbarHeight) {
            currentPage = parseInt(w.dataset.pageNum);
        }
    }
    pageInput.value = currentPage;
}

// Setup controls
function setupControls() {
    const numPages = state.pdf.numPages;
    pageCount.textContent = numPages;
    pageInput.max = numPages;

    prevBtn.addEventListener('click', () => {
        const cur = parseInt(pageInput.value);
        if (cur > 1) scrollToPage(cur - 1);
    });

    nextBtn.addEventListener('click', () => {
        const cur = parseInt(pageInput.value);
        if (cur < numPages) scrollToPage(cur + 1);
    });

    pageInput.addEventListener('change', () => {
        let val = parseInt(pageInput.value);
        val = Math.max(1, Math.min(numPages, val || 1));
        pageInput.value = val;
        scrollToPage(val);
    });

    zoomIn.addEventListener('click', () => {
        state.currentScale *= 1.2;
        rerender();
    });

    zoomOut.addEventListener('click', () => {
        state.currentScale /= 1.2;
        rerender();
    });

    zoomFit.addEventListener('click', fitToWidth);

    window.addEventListener('scroll', updateCurrentPage);

    // Recalcule la mise en page à chaque redimensionnement (rotation, fenêtre réduite, etc.)
    let resizeTimeout = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(fitToWidth, 300);
    });
}

// Main
async function loadPdf() {
    const url = getPdfUrl();
    if (!url) {
        container.innerHTML = '<p style="color:#ff6b6b;text-align:center;margin-top:100px;">Aucune URL de PDF fournie.</p>';
        return;
    }

    showLoading();

    try {
        // Set document title
        const filename = decodeURIComponent(url.split('/').pop().split('?')[0]) || 'PDF';
        document.title = filename + ' — Daspalecte';

        state.pdf = await pdfjsLib.getDocument({
            url: url,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/cmaps/',
            cMapPacked: true
        }).promise;

        hideLoading();
        setupControls();
        zoomLevel.textContent = '100%';
        await renderAllPages();

        // Auto-open the Daspalecte sidepanel after PDF loads
        setTimeout(() => {
            chrome.storage.local.set({ extensionOpen: true, sidepanelVisible: true });
        }, 500);

    } catch (err) {
        hideLoading();
        console.error('[PDF Viewer] Error loading PDF:', err);
        container.innerHTML = `
            <div style="color:#ff6b6b;text-align:center;margin-top:100px;font-family:'Inter',sans-serif;">
                <p style="font-size:1.2rem;margin-bottom:10px;">Impossible de charger le PDF</p>
                <p style="color:#888;font-size:0.85rem;">${err.message || 'Erreur inconnue'}</p>
                <p style="color:#888;font-size:0.85rem;margin-top:10px;">URL: ${url}</p>
            </div>`;
    }
}

loadPdf();
