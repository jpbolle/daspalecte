# INIT.md — Vue d'ensemble du projet Daspalecte

## Qu'est-ce que Daspalecte ?
Une extension Chrome d'aide à la lecture pour les élèves **FLE** (Français Langue Etrangere), en particulier ceux du dispositif **DASPA** (Dispositif d'Accueil et de Scolarisation des eleves Primo-Arrivants) en Belgique.

## Les fonctionnalites principales

### 1. Traducteur mot a mot
- Clic sur un mot de n'importe quelle page web -> traduction instantanee (via Google Translate API)
- 11 langues : arabe, anglais, dari, espagnol, kurde, pashto, polonais, roumain, russe, turc, ukrainien
- Bulle au-dessus du mot, gestion des ligatures francaises (oe, ae)

### 2. Gestion de vocabulaire
- Les mots traduits s'ajoutent automatiquement a une liste personnelle (Chrome Storage)
- Selection, suppression, persistance locale

### 3. Capture & Lecture (OCR)
- Bouton dans la section Traducteur du sidepanel
- Selection rectangulaire d'une zone de l'ecran (masquage du sidepanel pendant la capture)
- Analyse par Claude Vision : transcription fidele, mots difficiles traduits, texte annote
- Overlay resultat : image a gauche, texte a droite, liste de mots difficiles avec audio
- Toggle traducteur integre : clic sur un mot du texte extrait → traduction instantanee
- Crop intelligent (devicePixelRatio, redimensionnement si > 1568px)

### 4. Aide a la comprehension (IA)
- Boutons magiques sur les paragraphes > 50 caracteres
- Resume (max 30 mots) + reformulation simplifiee avec traductions des mots difficiles
- Propulse par **Claude Sonnet 4.5** via une Cloud Function

### 5. Generation d'exercices
5 types progressifs a partir des mots de vocabulaire collectes, avec seuils de reussite et navigation par points (dots) cliquables si exercice deja reussi (retour arriere ne force plus a refaire) :
1. **Associations** — relier mot francais / traduction (correction immediate paire par paire, pas de seuil)
2. **Famille de mots** — carte a effet flip (icone 🔄 seule, recto toujours accessible), saisie des mots lies au verso, traduction au survol des etiquettes recto, seuil : au moins 2 mots trouves
3. **Etiquettes** — glisser-deposer le bon mot dans la phrase (+ fallback clic/clavier), seuil 80%, bouton "Regenerer" (rappelle Claude) si en dessous, **verification des synonymes par Claude** si une reponse est jugee fausse (evite de rejeter des synonymes valides)
4. **Lecture** — revelation progressive : texte silencieux cliquable (traduction mot-a-mot) → apres 20s, section Ecouter (synthese vocale avec surbrillance mot-a-mot, pause/vitesse ajustable, ignore les traductions entre parentheses) → apres une lecture complete, section Enregistrer (reconnaissance vocale + alignement pour feedback vert/rouge), passage a la suite impossible sans enregistrement
5. **Defi final** — texte a trous, seuil 70%, bouton "Recommencer avec indice" (premiere syllabe) si en dessous
6. **Phrase avec le vocabulaire** *(prevu, pas encore implemente — bloque sur ajout backend)*

### 6. Test de lecture
- Genere un test de comprehension (10 QCM + appariement de mots) a partir du texte de la page
- Overlay plein ecran en 2 pages (QCM puis matching), minimisable
- Le traducteur fonctionne dans le test
- Lignes SVG colorees pour visualiser les paires dans l'appariement
- Score envoye automatiquement dans une Google Sheet via Google Apps Script
- Email de l'eleve recupere via `chrome.identity` (Chromebook)

### 7. Lecture de PDF en ligne
- Detection automatique des onglets PDF (y compris via Adobe Acrobat extension)
- Bouton "Ouvrir avec Daspalecte" dans le popup
- Visionneuse PDF integree avec pdf.js v4.9.155 (rendu canvas + text layer)
- **Traduction** : annotations dans la marge droite (style Google Docs), collapsibles en bulles 💬
- **Comprehension** : boutons magiques ✨ dans la marge gauche, reponse Claude dans un encadre, collapsible en bulle 📖
- Boutons — (reduire) et ✕ (fermer) sur chaque carte
- Une seule carte ouverte a la fois, les autres se replient automatiquement
- Bulles d'une meme ligne juxtaposees horizontalement
- Zoom, navigation par page, fit-to-width, detection PDF scannes

### 8. Systeme de themes
- **2 themes visuels** : Cyberpunk (neon, fond sombre) et Classica (tons chauds, fond creme)
- Choix au premier lancement via un selecteur visuel (2 previews cote a cote)
- Changement possible a tout moment via le bouton 🎨 dans la popup
- Stocke dans `chrome.storage.local.theme`, propage en temps reel a tous les contextes
- Fichiers cles : `themes.css` (variables CSS), `theme-manager.js` (application du theme)
- CSS entierement refactore vers des variables `--t-*` (popup, sidepanel, content, pdfviewer)
- Styles inline dans content.js adaptes via `getThemeColors()`

### 9. Popup de l'extension
- Boutons principaux : Gem, Outils de lecture, PDF
- Selecteur de langue maternelle
- 3 boutons d'action : 🎨 Theme, 🗺️ Roadmap (overlay sur la page), ℹ️ Info (lien pedagokit.be)

## Architecture

```
Extension Chrome (frontend)
  ├── popup        → point d'entree, selection de langue, detection PDF, theme
  ├── sidepanel    → panneau lateral avec toggles et liste de vocabulaire
  ├── content.js   → injection dans les pages web (traduction, comprehension, exercices, roadmap)
  ├── themes.css   → variables CSS pour les 2 themes (Cyberpunk + Classica)
  ├── theme-manager.js → lit le theme depuis storage, applique data-theme sur :root
  ├── pdfviewer    → visionneuse PDF (html/js/css) + pdf.js
  └── background   → service worker, relay de messages, TTS (chrome.tts)

Cloud Function (backend)
  └── index.js     → recoit les requetes, appelle Claude API, renvoie JSON

Google Cloud Console
  └── Projet "vocabulaire" (ID numerique : 1086562672385)
      ├── Cloud Run   → daspalecte (europe-west1)
      └── Secret Manager → "daspalecte" (cle API Anthropic)

Google Apps Script (scores)
  └── Web app deployee → recoit les scores des tests de lecture et les ecrit dans Google Sheets
```

## Flux de donnees
1. L'utilisateur clique sur un mot → `content.js` envoie une requete traduction (Google Translate). Audio : content.js → background.js → `chrome.tts.speak()` (remplace `speechSynthesis` qui freeze dans Chrome)
2. L'utilisateur capture une zone → sidepanel masque → background.js (captureVisibleTab) → crop canvas → Cloud Function (analyze_screenshot) → Claude Vision → overlay resultat
3. L'utilisateur clique sur le bouton comprehension → `content.js` → `background.js` → Cloud Function → Claude API → reponse JSON affichee dans la page
3. L'utilisateur genere des exercices → meme flux, avec le prompt `generate_exercises`
4. L'utilisateur active le test de lecture → `content.js` extrait le texte → Cloud Function → Claude API → test interactif affiche
5. L'eleve soumet le test → `content.js` → Google Apps Script → Google Sheets (score enregistre)

## Design
- **Theme Cyberpunk** : fond sombre (#0a0b1e), cyan (#00f3ff), violet (#e879f9), polices Orbitron + Inter, effets glow/glassmorphism
- **Theme Classica** : fond creme (#faf6f0), vert (#2d6a5a), or (#d4944c), polices Playfair Display + Inter, style epure
- Theme stocke dans `chrome.storage.local.theme` (`'cyberpunk'` ou `'classica'`)
- Toutes les couleurs via variables CSS `--t-*` definies dans `themes.css`

## Distribution
- Chrome Web Store en mode **Prive** (groupe `daspa@cnddinant.be`)
- Eleves DASPA sur Chromebooks scolaires

## Changements v1.8

### Bouton PDF flottant (Google Drive / Chromebook)
- Ajout d'un bouton **✕** pour masquer le bouton sans ouvrir le PDF
- Glisser-deposer : l'utilisateur peut repositionner le bouton pour ne pas masquer d'autres elements de la page
- Fichier : `content.js` → methode `showPDFActivationButton()`

### Isolation du theme (attribut data-daspalecte-theme)
- Renommage `data-theme` → `data-daspalecte-theme` dans tous les fichiers CSS et JS
- Evite toute collision avec des apps tierces (localhost ou autres) qui utilisent aussi `data-theme`
- Fichiers touches : `themes.css`, `content.css`, `sidepanel.css`, `content.js`, `theme-manager.js`, `popup.js`

### Corrections visuelles theme Classica
- Bulle de traduction : fond vert (`#2d6a5a`) + texte blanc — etait fond blanc illisible
- En-tete PDF viewer : fond blanc carte + ombre legere — etait fond noir avec texte vert illisible
- Fichiers touches : `themes.css`, `pdfviewer.css`

## Changements v1.9

### Nettoyage CSS themes
- Remplacement de toutes les couleurs Classica hardcodees dans `content.css` par des variables `var(--t-*)`
- Concerne : `.daspalecte-speak-btn`, `.daspalecte-magic-btn`, `.capture-speak-btn`, `.capture-text-container`

### Bulle de traduction amelioree
- Appendice style bulle de BD (triangle CSS `::after`) sous chaque bulle — les 2 themes
- Icone son blanche en Classica pour meilleure lisibilite sur fond vert

### Popup redessinee
- Icones d'action (theme, roadmap, info) : emojis remplaces par des SVG dans des cercles bordes
- Pied de page agrandi : texte plus lisible (0.85rem), logo plus grand (65px)
- Espacement ajuste entre icones, divider et contenu du footer

## Changements v1.10

### Isolation CSS contre la contamination des pages hotes
- Cause racine trouvee pour deux bugs recurrents (barre sous la consigne des exercices, chevauchement de la bulle de traduction) : `.exercise-header`, son `h2`, `.ex-desc`, `.exercise-body` et `.daspalecte-translation` etaient des elements generiques sans `all: initial !important`, donc le CSS natif des pages hotes (ex. le soulignement des `<h2>` de Wikipedia) s'appliquait par-dessus notre propre style
- Meme traitement defensif applique qu'ailleurs dans `content.css` : `all: initial !important` + toutes les proprietes en `!important`
- Fichiers touches : `content.css`

### Contraste et lisibilite theme Classica
- Bulle de traduction (hover), icone son (emoji, `color` n'a aucun effet dessus → `filter` utilise a la place), bouton magique ✨ (inverse : vert au repos, blanc au survol avec halo vert sur l'etoile)
- Nouveaux tokens `--t-text-on-accent` et `--t-accent-ink` : corrige le contraste des badges/etiquettes/QCM sur fond accent et de la traduction en marge PDF
- `--t-text-muted`/`--t-text-dim` assombris en Classica (echouaient WCAG AA)
- Retrait des side-stripe borders (anti-pattern) dans 7 composants (popup, sidepanel, pdfviewer, content)
- Logo du footer heberge localement (`logo-pedagokit.png`) au lieu d'une URL Google Drive externe ; glow adapte en Classica

### Accessibilite clavier
- Exercices Matching, sélecteur de theme (popup, devient un vrai `radiogroup`), etiquettes drag & drop (fallback clic/clavier en plus du drag natif) : navigables et operables au clavier
- `aria-label` ajoutes sur les boutons icones (popup, sidepanel, pdfviewer)

### PDF viewer
- Marges responsive (breakpoints), `fitToWidth()` recalcule au resize
- Virtualisation : seules les pages proches de l'ecran sont reellement rendues (canvas), via `IntersectionObserver` — le texte est extrait pour toutes les pages des le chargement (necessaire pour comprehension/test de lecture)
- Verrou anti-course sur le rendu (zoom rapide/resize concurrents)

### Bugs corriges
- Bouton flottant "Ouvrir avec Daspalecte" apparaissait parfois en double → garde ajoutee dans `showPDFActivationButton()`
- Boite de comprehension sur page web : ajout d'un bouton reduire (comme le PDF viewer, repli en bulle 📖) ; correction d'un doublon de bulle d'action (le bouton ✨ doit etre masque via `setProperty(..., 'important')`, pas juste `style.display`, a cause du `!important` de la feuille de style)
- `sidepanel.js` : erreurs "Extension context invalidated" (rechargement de l'extension pendant qu'un onglet reste ouvert) → tous les appels `chrome.storage`/`chrome.identity` proteges par `try/catch`, comme deja fait dans `content.js`

### Backend (Cloud Function, hors de ce repo)
- Nouvelle action `verify_tags_answers` ajoutee dans `index.js` (Cloud Run "daspalecte", projet `vocabulaire-469115`, region europe-west1) : demande a Claude si une phrase completee par l'eleve reste valide meme si le mot ne correspond pas exactement au mot attendu (evite de rejeter des synonymes) — deployee et testee avec succes
- Ce code n'a pas de copie locale dans ce repo, uniquement accessible via Google Cloud Console → Cloud Run → onglet Source (editeur en ligne fragile a l'automatisation : prefer telecharger l'archive, corriger en local avec `node --check`, puis coller un diff minimal)
- Exercice 6 (phrase avec le vocabulaire) reste bloque sur le meme type de dependance backend, reporte

### Skill impeccable
- Copie depuis le projet "bibliothèque" dans `.claude/skills/impeccable` (design/audit multi-commandes)
- Audit complet effectue (accessibilite, performance, theming, responsive, anti-patterns) — la plupart des actions prioritaires traitees cette session

## Bug connu a investiguer
- Depuis la persistance du sidepanel entre onglets (sync via `chrome.storage.onChanged`), Chrome bloque parfois : la sidebar tremble/bouge puis freeze complet
- Intermittent, pas systematique
- Piste probable : boucle infinie entre `storage.onChanged` listeners (content.js ↔ sidepanel.js) qui se renvoient des changements mutuellement (`sidepanelVisible`, `translatorEnabled`)
- A verifier : les flags `isUpdatingToggles` et les conditions de garde dans les listeners storage

## Roadmap
1. **CSS a ameliorer** — affinage des styles, coherence entre themes
2. **Test de lecture a ameliorer** — email automatique au prof a chaque soumission + ameliorations UX
3. **Interface professeur** — tableau de bord pour consulter les resultats des eleves
4. **Adaptation par niveau CECR** — A1 a C2, complexite ajustee
5. **Suivi pedagogique** — historique, revisions espacees, stats de progression
6. **Outil de prononciation** — reconnaissance vocale (IA ou non) : l'eleve prononce un mot, comparaison avec la prononciation attendue ; si non reconnu, considere comme mal prononce
7. **Outil YouTube** — generation d'un test de comprehension (QCM + appariement) a partir du contenu d'une video YouTube, meme principe que le test de lecture actuel sur texte
8. **Connexion utilisateur** — authentification pour sauvegarder les resultats (au-dela du flux actuel via chrome.identity + Google Sheets)

## Version actuelle : 1.10
