chrome.runtime.onInstalled.addListener(() => {
  console.log("Daspalecte extension installed.");
});

// Plus besoin de gérer le sidepanel car maintenant c'est un iframe
// Toute la logique est gérée par content.js
