/**
 * Theme Manager — reads theme from chrome.storage and applies data-daspalecte-theme attribute.
 * Include this script in popup.html, sidepanel.html, and pdfviewer.html.
 * For content.js, the logic is inlined since it runs in the page context.
 */
(function () {
  // Apply theme to current document
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-daspalecte-theme', theme || 'cyberpunk');
  }

  // Read theme from storage and apply
  chrome.storage.local.get(['theme'], (data) => {
    applyTheme(data.theme);
  });

  // Listen for theme changes (live switch)
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.theme) {
      applyTheme(changes.theme.newValue);
    }
  });
})();
