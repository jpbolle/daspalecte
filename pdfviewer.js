import * as pdfjsLib from './lib/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.mjs');

const state = {
    pdf: null,
    currentScale: 1.5,
    renderedPages: new Set(),
    rendering: false
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

// Render a single page
async function renderPage(pageNum) {
    if (state.renderedPages.has(pageNum)) return;

    const page = await state.pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: state.currentScale });

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'pdf-page-wrapper';
    wrapper.dataset.pageNum = pageNum;
    wrapper.style.width = viewport.width + 'px';
    wrapper.style.height = viewport.height + 'px';

    // Canvas for rendering
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width * window.devicePixelRatio;
    canvas.height = viewport.height * window.devicePixelRatio;
    canvas.style.width = viewport.width + 'px';
    canvas.style.height = viewport.height + 'px';
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    wrapper.appendChild(canvas);

    // Text layer
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'pdf-text-layer';
    wrapper.appendChild(textLayerDiv);

    container.appendChild(wrapper);

    // Render canvas
    await page.render({ canvasContext: ctx, viewport }).promise;

    // Render text layer
    const textContent = await page.getTextContent();

    // Check for scanned PDF (first page only)
    if (pageNum === 1) {
        const totalChars = textContent.items.reduce((sum, item) => sum + item.str.trim().length, 0);
        if (totalChars < 10) {
            scannedWarning.style.display = 'inline';
        }
    }

    // Place text spans (visual overlay for click-to-translate)
    let lastY = null;
    let lineTexts = [];
    let paragraphLines = [];
    let paragraphStartY = 0;

    textContent.items.forEach(item => {
        if (!item.str.trim()) return;

        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);

        const span = document.createElement('span');
        span.textContent = item.str;

        // Position and size from transform
        const fontSize = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
        const left = tx[4];
        const top = tx[5] - fontSize;

        span.style.left = left + 'px';
        span.style.top = top + 'px';
        span.style.fontSize = fontSize + 'px';
        span.style.fontFamily = item.fontName || 'sans-serif';

        // Width matching
        if (item.width > 0) {
            const scaledWidth = item.width * state.currentScale;
            span.style.width = scaledWidth + 'px';
            span.style.letterSpacing = 'normal';
        }

        textLayerDiv.appendChild(span);

        // Group lines into paragraphs for comprehension/test features
        const currentY = Math.round(top);
        if (lastY !== null && Math.abs(currentY - lastY) > fontSize * 1.8) {
            // Big gap = new paragraph
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

    // Add structured paragraphs to the hidden text container
    const textContainer = document.getElementById('pdf-text-content');
    paragraphLines.forEach(item => {
        if (item.text.trim().length > 10) {
            const p = document.createElement('p');
            p.textContent = item.text.trim();
            textContainer.appendChild(p);
        }
    });

    state.renderedPages.add(pageNum);
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

    for (let i = 1; i <= numPages; i++) {
        await renderPage(i);
    }

    // Notify content.js that PDF text is ready (for magic buttons, test de lecture, etc.)
    document.dispatchEvent(new CustomEvent('daspalecte-pdf-ready'));
}

// Re-render all at new scale
async function rerender() {
    container.innerHTML = '';
    const textContainer = document.getElementById('pdf-text-content');
    textContainer.innerHTML = '';
    state.renderedPages.clear();
    zoomLevel.textContent = Math.round(state.currentScale / 1.5 * 100) + '%';
    await renderAllPages();
}

// Fit to width
function fitToWidth() {
    if (!state.pdf) return;
    state.pdf.getPage(1).then(page => {
        const unscaledViewport = page.getViewport({ scale: 1 });
        const availableWidth = window.innerWidth - 560; // padding for left+right margins
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
