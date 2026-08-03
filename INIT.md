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
7 types progressifs a partir des mots de vocabulaire collectes, avec seuils de reussite et navigation par points (dots) cliquables si exercice deja reussi ou si c'est le tout premier exercice non encore fait (retour arriere ne force plus a refaire, et n'empeche plus d'avancer directement au suivant) :
1. **Associations** — relier mot francais / traduction (correction immediate paire par paire, pas de seuil), lignes SVG de connexion entre les paires trouvees (comme le test de lecture)
2. **Famille de mots** — carte a effet flip (icone 🔄 seule, recto toujours accessible), saisie des mots lies au verso, traduction au survol des etiquettes recto, seuil : au moins 2 mots trouves
3. **Etiquettes** — glisser-deposer le bon mot dans la phrase (+ fallback clic/clavier), seuil 80%, bouton "Regenerer" (rappelle Claude) si en dessous, **verification des synonymes par Claude** si une reponse est jugee fausse (evite de rejeter des synonymes valides)
4. **Lecture** — revelation progressive : texte silencieux cliquable (traduction mot-a-mot) → apres 20s, un bouton d'ecoute individuel apparait **par phrase** (plutot qu'un seul bouton pour tout le texte, pour eviter la derive de synchronisation sur les textes longs), avec pause estimee apres chaque signe de ponctuation forte → une fois **toutes** les phrases ecoutees au moins une fois, section Enregistrer (reconnaissance vocale + alignement pour feedback vert/rouge sur le texte entier), passage a la suite impossible sans enregistrement
5. **Ecoute et associe** — meme mecanique que l'exercice 1 (Associations), mais la colonne francaise n'affiche pas le texte : seulement un bouton 🔊 par mot, l'eleve doit reconnaitre le mot a l'oreille avant de l'associer a sa traduction
6. **Defi** — texte a trous, seuil 70%, bouton "Recommencer avec indice" (premiere syllabe) si en dessous, **l'indice ne concerne que les reponses fausses de la tentative precedente**, pas les bonnes
7. **Phrase avec le vocabulaire** — l'eleve ecrit une phrase utilisant au moins 50% des mots appris (seuil calcule cote client, pastilles surlignees en temps reel), verification par Claude (action backend `verify_sentence`) en deux volets : (a) emploi correct/incorrect de **chaque mot impose** avec explication courte — jamais de suggestion de remplacer un mot impose, seulement juger son integration ; (b) grammaire de la phrase entiere, avec version corrigee (qui garde tous les mots imposes) affichee en encadre si besoin. Feedback bienveillant : un sens plausible malgre une grammaire imparfaite est traite comme une reussite partielle (manque de vocabulaire), pas comme un non-sens. **Le transfert de forme est une reussite, jamais une faute** — pluriel/singulier, masculin/feminin, verbe conjugue, et surtout changement de classe grammaticale en gardant le sens ("un critique" → "il critiqua", "rapide" → "rapidement") : le prompt impose a Claude de feliciter ces transformations, et la correspondance cote client les reconnait (`sameVocabularyWord()`, radical commun d'au moins 4 lettres)

Les titres des exercices sont renumerotes automatiquement selon leur position reelle dans le tableau final (`renumberExerciseTitles()`), pas figes dans le texte genere par Claude — robuste a l'insertion de nouveaux exercices.

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

## Changements recents (non encore integres a un bump de version)

### Exercice Lecture — synchronisation surbrillance/voix, refonte par phrase
- Probleme initial : la surbrillance mot-a-mot traînait derriere la voix (jusqu'a ~1s de retard), car pilotee par les evenements de limite de mot du moteur `chrome.tts`, qui arrivent apres coup sur certaines voix
- Premier correctif : la minuterie estimee (mots/minute) devient le mecanisme principal au lieu des evenements reels ; ajout d'une pause estimee apres chaque signe de ponctuation forte (`.!?…` → 450ms, `,;:` → 200ms), sinon l'estimation prenait de l'avance sur la voix au fil du texte
- Insuffisant sur les textes longs (la derive reapparaissait progressivement) → **refonte complete** : le texte est decoupe phrase par phrase (`splitIntoSentences()`), chaque phrase a son propre bouton d'ecoute et sa propre surbrillance independante (la derive repart a zero a chaque phrase). L'etape Enregistrer se revele une fois **toutes** les phrases ecoutees (au lieu d'une seule lecture complete du texte entier). L'alignement de l'enregistrement final reste sur le texte entier (`readingFullTextWordsData`, distinct de `readingWordsData` qui ne porte que sur la phrase en cours)
- Fichier touche : `content.js`, `content.css`

### Exercice 1 (Associations) — lignes de connexion
- Ajout d'un SVG superpose au conteneur d'appariement : chaque paire trouvee est reliee par une ligne verte persistante, en plus du surlignage des cases — reprend le mecanisme deja utilise pour le test de lecture (`renderTestMatchingExercise`)
- Fichier touche : `content.js`, `content.css`

### Nouvel exercice — Ecoute et associe (entre Lecture et Defi)
- Construit cote client a partir des memes paires que l'exercice 1 (aucun appel Claude supplementaire) : `buildListeningMatchingExercise()`
- Reutilise `renderMatching()` avec un mode `audioOnly` : la colonne francaise affiche des boutons 🔊 numerotes au lieu du texte, l'eleve doit ecouter avant d'associer
- Insertion automatique dans le tableau d'exercices + renumerotation de tous les titres (`renumberExerciseTitles()`)
- Fichier touche : `content.js`, `content.css`

### Points de navigation — plusieurs corrections
- Un exercice reussi puis quitte sans cliquer "Continuer" (ex. via un point de navigation) ne se marquait jamais comme reussi → chaque exercice appelle desormais directement `markCompleted()` au moment ou il se sait reussi (passe en parametre a chaque `render*`), plutot que de le deduire apres coup a la navigation
- Le tout premier exercice non encore fait restait injoignable directement (il fallait repasser par "Continuer" sur l'exercice precedent) → son point est desormais toujours cliquable, en plus de l'exercice courant et de ceux deja reussis
- Fichier touche : `content.js`

### Exercice Defi (ex-"Defi final") — renomme + indice cible
- Renomme car il n'est plus le dernier exercice depuis l'ajout d'Ecoute et associe et de Phrase avec le vocabulaire (le numero est de toute facon recalcule automatiquement, voir `renumberExerciseTitles()`)
- Le bouton "Recommencer avec indice" n'affiche plus l'indice syllabique que sur les items rates a la tentative precedente (`hintIndices`, un `Set` d'index), plus sur toutes les reponses
- Fichier touche : `content.js`, `cloud-function/index.js` (titre dans le prompt `generate_exercises`)

### Exercice Phrase avec le vocabulaire — feedback affine
- Format de reponse enrichi de `verify_sentence` : verdict par mot (`wordsFeedback: [{word, correct, explanation}]`) + verdict phrase entiere (`sentenceValid`, `sentenceFeedback`, `correctedSentence`)
- Le prompt interdit desormais explicitement de suggerer un remplacement pour un mot impose (juger seulement s'il est bien integre) et demande une interpretation bienveillante (un sens plausible malgre une grammaire imperfaite = reussite partielle, pas un non-sens) ; la phrase corrigee proposee doit obligatoirement conserver tous les mots imposes
- Correspondance des mots utilises tolerante au genre/nombre cote client (`stripGenderNumber()` : retire un -s/-x final puis un -e final avant comparaison) — "ignorant" et "ignorante" sont desormais reconnus comme le meme mot de vocabulaire
- **Puis elargie au transfert de classe grammaticale** (`sameVocabularyWord()`, `content.js` + `ExercisesDialog.html`) : deux formes comptent comme le meme mot si elles partagent un radical d'au moins 4 lettres, donc "critique" reconnait "il critiqua", "rapide" reconnait "rapidement", "courir" reconnait "course". Sans cela le compteur bloquait l'eleve avant meme l'appel a Claude. Prompt `verify_sentence` mis a jour en consequence : toute variation de forme (accord, conjugaison, derivation) doit etre `correct: true` **et felicitee** — interdiction explicite de dire "le mot impose etait X, tu as ecrit Y"
- Fichiers touches : `content.js`, `cloud-function/index.js`

### Backend (Cloud Function) — copie locale ajoutee au projet
- `cloud-function/index.js` + `package.json` : copie locale ajoutee dans le repo (deja gitignoree via `cloud-function/`, ne jamais committer)
- Permet desormais d'editer et de verifier la syntaxe (`node --check`) localement avant de coller dans l'editeur Cloud Console — plus fiable que l'edition directe dans l'editeur web
- Attention : une copie locale peut se desynchroniser de la version deployee (constate cette session avec une archive `~/Downloads` corrompue) — toujours confirmer avec le contenu reel de Cloud Console en cas de doute

### Backend (Cloud Function) — premiere route GET
- Jusqu'ici le service ne repondait qu'a du POST JSON (actions). Ajout d'une **route GET** : `?page=recording` sert `RECORDING_PAGE_HTML`, la page d'enregistrement vocal de l'add-on Docs/Sheets/Slides (voir la section add-on : Apps Script ne peut pas heberger cette page, son iframe sandboxe coupe l'acces micro)
- Tout autre GET renvoie un simple `Daspalecte backend OK` (utile pour verifier que le service repond)
- Verification rapide apres deploiement : `curl -s -o /dev/null -w "%{http_code} %{content_type}\n" "<URL>?page=recording"` doit renvoyer `200 text/html; charset=utf-8`

## Add-on Google Apps Script (Docs / Sheets / Slides) — nouveau chantier, en cours

Repond a la roadmap #10 : equivalent de l'extension pour Google Docs/Sheets/Slides, ou l'extension Chrome ne peut pas fonctionner (rendu canvas, pas de DOM texte standard). Plan complet : `/Users/jpbolle/.claude/plans/tidy-purring-ripple.md`.

- **Emplacement** : `gas-addon/` a la racine du repo, **suivi par git** depuis cette session (retire du `.gitignore`, contrairement a `cloud-function/` qui reste hors du repo)
- **Architecture** : un seul projet Apps Script standalone cible les 3 apps via les sections `addOns.docs`/`sheets`/`slides` du manifeste `appsscript.json`, sidebar `HtmlService` commune (`Sidebar.html`), backend relaye vers le meme Cloud Function (`Code.gs` → `callCloudFunction()`)
- **Changement de modele d'interaction acte des le depart** : pas de clic direct sur un mot du document (impossible, rendu canvas) → l'eleve **selectionne** puis clique un bouton dans la sidebar (`getSelectionText()` gere Docs/Slides/Sheets differemment en interne, interface commune)
- **Deploiement** : necessite le nouveau modele unifie "Google Workspace Add-on" — une fonction `onHomepage(e)` renvoyant une carte `CardService` est obligatoire (sinon message d'erreur "Aucune fiche de page d'accueil n'est fournie"), avec un bouton qui ouvre la vraie sidebar HTML via `showSidebar()`. Dev local avec `clasp` (`clasp push`), pas l'editeur web
- **Theme** : Classica uniquement (demande explicite de l'utilisateur, pas de selecteur Cyberpunk/Classica), variables `--t-*` reprises de `themes.css`
- **Spike de validation technique (risques identifies dans le plan, maintenant leves)** :
  - `speechSynthesis` : aucun freeze constate, meme en rafale (5 phrases a la suite) — utilisable directement dans la sidebar
  - `SpeechRecognition` (micro) : **echoue systematiquement dans tout ce que sert `HtmlService`** — voir la section "Pieges Apps Script" ci-dessous, la solution finale n'est PAS une fenetre `window.open()` vers Apps Script (teste, echoue aussi) mais une page hebergee sur le Cloud Function
- **Fonctionnalites implementees et testees en direct (Doc reel)** :
  - Traduction sur selection (max 3 mots, au-dela message d'erreur — evite qu'un eleve traduise un passage entier au lieu d'un mot), ajout automatique au vocabulaire des reception de la traduction (comme l'extension, pas de bouton "Ajouter" separe)
  - Vocabulaire persistant via `PropertiesService.getUserProperties()` (equivalent `chrome.storage.local.wordList`), suppression par mot
  - Langue maternelle persistante (`nativeLanguage`), meme 11 langues que l'extension
  - Aide a la comprehension (action `summarize` du Cloud Function inchangee) sur selection de paragraphe, garde-fou si selection trop courte (redirige vers "Traduire")
  - **Les 7 exercices** (portage de `content.js` quasi 1:1) dans un **dialogue modal** (`ui.showModalDialog`, `ExercisesDialog.html`, 820x680) et non dans la sidebar — trop etroite pour l'appariement/les etiquettes (retour utilisateur). La sidebar ne garde que le bouton "Generer des exercices", qui appelle `showExercisesDialog()`. Le dialogue relit lui-meme vocabulaire + langue au chargement et lance la generation automatiquement
  - **Enregistrement vocal de l'exercice Lecture** : page hebergee sur le **Cloud Function** (`?page=recording&store=<url_webapp>&text=<texte_a_lire>`), ouverte en `window.open()` depuis le dialogue. Le texte de l'exercice est affiche dans cette fenetre (transmis dans l'URL, sans les traductions entre parentheses pour que l'eleve ne lise que ce qui sera compare a sa transcription) — l'integrer au dialogue lui-meme est **impossible** : le dialogue est une page `HtmlService`, donc sans micro (voir pieges 3 ci-dessous). Resultat renvoye par deux canaux redondants : `fetch` vers le deploiement Web App Apps Script (`doGet ?action=store` → `CacheService`) relu par polling (`pollRecordingResult()`), plus `postMessage` en secours. L'alignement mot-a-mot (plus longue sous-sequence commune) se fait dans le dialogue, qui connait les mots de reference
  - **Perimetre du texte soumis au test, par hote** (etape 7 du plan) : `getReadingTestText()` dans `Code.gs`. Choix **pedagogique, pas technique** — **Docs** : l'eleve SELECTIONNE le passage sur lequel il veut etre interroge (un document scolaire contient souvent plusieurs textes et consignes ; le document entier melangerait tout) ; **Slides** : toute la presentation, sans selection (un diaporama forme un tout, et y selectionner des formes est malcommode) ; **Sheets** : pas de test de lecture du tout, la section est masquee dans la sidebar (un tableau n'est pas un texte suivi). La fonction renvoie un objet `{ok, reason, host, text}` — `reason` vaut `unsupported_host`/`no_selection`/`too_short`, ce qui permet d'afficher un message adapte plutot qu'un "trop court" generique. Meme nettoyage et meme troncature a 5000 caracteres que `extractPageText()` de l'extension
  - **Le texte est lu AVANT l'ouverture du dialogue** (`startReadingTest()`, appelee par le bouton de la sidebar), puis transmis par `CacheService` (`consumeReadingTestText()`, consomme a la lecture). Raison : dans Docs le texte vient de la SELECTION de l'eleve, et rien ne garantit qu'une selection reste lisible depuis un dialogue modal — au moment du clic dans la sidebar, en revanche, on est dans le meme contexte que "Traduire la selection", qui fonctionne. Effet de bord souhaitable : en cas de refus, aucun dialogue ne s'ouvre, le message s'affiche dans la sidebar et l'eleve corrige sa selection sur place
  - **Test de lecture** (etape 8 du plan) : `ReadingTest.html`, dialogue modal 820x680 comme les exercices, ouvert par le bouton "Passer le test" de la sidebar. Portage de `handleComprehensionTest`/`displayComprehensionTest`/`renderMCQQuestions`/`renderTestMatchingExercise`/`submitComprehensionTest` — 2 pages (10 QCM puis appariement), lignes SVG colorees (une couleur par paire, palette Classica), correction visuelle vert/rouge, score en pourcentage
  - **Pas d'envoi de score** : le flux "Apps Script -> Google Sheet du professeur" de l'extension (`content.js:sendScoreToTeacher()`) est **abandonne**, une vraie base de donnees le remplacera. Le dialogue affiche donc le score a l'eleve sans le persister. Point de reprise documente dans `Code.gs` (section TEST DE LECTURE) : c'est la qu'il faudra ajouter l'envoi et son entree `urlFetchWhitelist` le jour venu. L'extension, elle, envoie toujours vers la Sheet — a nettoyer quand la base arrivera
  - Differences assumees avec l'extension : pas de bouton "minimiser" (un dialogue modal se ferme et se rouvre depuis la sidebar, il n'a pas de bulle flottante ou se replier) ; le traducteur au clic ne s'applique qu'aux **enonces** des questions, pas aux options (sur une option, le clic doit cocher la reponse)
- **Refonte de la sidebar pour coller a celle de l'extension** (retour utilisateur, session du 2026-08-02) :
  - **En-tete** : le titre "Daspalecte" en vert faisait doublon avec celui de la barre native de la sidebar Apps Script → supprime, remplace par la ligne "🌐 Ma langue + menu deroulant" (le libelle se replie sur la seule icone sous 270px de large)
  - **Carte "Traducteur" renommee "Vocabulaire"**, et la liste des mots y est desormais integree (au lieu d'une carte "Mots" separee) — c'est la meme carte qui produit les mots et qui les affiche, comme dans le sidepanel
  - **Interrupteurs** sur "Vocabulaire" et "Comprehension", comme dans l'extension. Le modele d'interaction etant different (selection + bouton, pas de clic sur un mot), ils activent/desactivent le **bouton d'action** de leur section. Etat persiste (`getToolStates`/`setToolEnabled` dans `Code.gs`, `UserProperties`), desactive par defaut comme dans l'extension
  - **Bulles d'info (i) au survol** a la place des paragraphes de consigne, qui prenaient trop de place. Piege CSS a ne pas reintroduire : pas d'`opacity` sur `.info-tip` — elle cree un contexte d'empilement et la bulle absolue passe alors SOUS le bouton d'action de la section (constate en test)
  - **Cases a cocher + "Tout cocher" + corbeille de suppression groupee** sur la liste de mots : ce sont desormais les mots **coches** qui alimentent la generation d'exercices, comme dans l'extension. La selection transite par `CacheService` (`startExercises()` / `consumeExerciseWords()`, meme mecanisme que le texte du test de lecture) — un dialogue modal ne peut pas lire le DOM de la sidebar. Repli sur tout le vocabulaire si le cache a expire
  - **Pied de page** : "2026 - version 1.10" + logo, comme l'extension. Le logo est inline en **data: URI** (200px de large, ~22 ko de base64) : un add-on Apps Script n'expose aucun fichier statique, il n'y a donc pas d'URL a mettre dans `src`. A surveiller au premier `clasp push` — le `//` present dans le base64 est dans un **attribut HTML** et non dans un `<script>`, la ou `HtmlService` fait ses degats (piege 1 ci-dessous)
- **Retouches du dialogue d'exercices** (`ExercisesDialog.html`, meme session) :
  - Titre "Exercices — Daspalecte" retire du corps de la page (doublon avec la barre de fenetre du dialogue Apps Script) ; il ne reste que la croix de fermeture
  - Appariement (exercices Associations et Ecoute et associe) : `gap` des colonnes passe de 12px a **80px** (valeur de `.matching-container` dans `content.css`) — a 12px les lignes SVG reliant les paires etaient invisibles
  - Famille de mots : le bouton 🔄 disparait, **la carte entiere se retourne au clic** (verso : clic hors des champs de saisie pour revenir au recto) ; etiquettes, pastille du mot principal et champs agrandis
  - Exercice Lecture : consigne imposee cote client (`READING_INSTRUCTION`) plutot que reprise de la reponse de Claude, qui ne peut pas deviner le deroule reel (texte cliquable → ecoute → enregistrement)
  - Etiquettes : **plus aucun appel a Claude** (l'action `verify_tags_answers` n'est plus appelee depuis l'add-on — decision utilisateur : les etiquettes sont fournies, il n'y a pas de synonyme a arbitrer). Correction strictement locale ; le verdict de la tentative precedente est efface avant chaque nouvelle verification. **L'extension, elle, appelle toujours `verify_tags_answers`** (`content.js`) — divergence assumee, a trancher si on veut la parite
- **Dialogues quasi plein ecran pour masquer les reponses** (exercices ET test de lecture) : le document et la liste de vocabulaire visibles derriere contiennent les reponses. Le fond semi-transparent que Google place derriere ses dialogues **n'est pas stylable depuis notre iframe** (origine differente) : le seul levier est d'agrandir le dialogue lui-meme, dont le fond est opaque. `DIALOG_WIDTH = 1600` / `DIALOG_HEIGHT = 1100` dans `Code.gs` (Google borne a la taille de la fenetre, donc quasi plein ecran sur tout appareil), plus fond opaque sur `html` **et** `body` des deux dialogues
  - Consequence sur la mise en page (les deux dialogues) : le `body` devient une **colonne flex centree** (`align-items: center`, enfants en `width:100%; max-width:1000px`). Un simple `margin: auto` sur les enfants ne suffisait pas — plusieurs redefinissent leur `margin` en raccourci plus bas et se retrouvaient decales a gauche, d'ou l'alignement casse constate en test. Le corps (`.ex-body` / `#ct-main` + `.ct-body`) prend la hauteur restante, le pied reste ancre en bas. Typo et etiquettes agrandies en consequence (titre 16→22px, corps 13,5→15px, `.match-item` 12,5→15px), colonnes d'appariement bornees a 330px pour ne pas s'etirer
  - `#ct-main` passe a `display: flex` (et non `block`) quand le test s'affiche — sinon le style inline ecrasait la colonne flex
  - Croix de fermeture retiree du dialogue des exercices : le dialogue Apps Script fournit deja la sienne, et le pied garde « Fermer ». `ReadingTest.html` garde en revanche son `<h1>` et sa croix (non tranche)
- **Style de la sidebar** : reprend les classes et l'ordre de sections de `sidepanel.html`/`sidepanel.css` de l'extension (`.tool-section`, `.section-header`, `.action-btn`, `.word-item`, bouton "Generer des exercices" dans la section Mots, masque tant qu'aucun mot). Aucun vestige Cyberpunk : ombre neutre unique `--t-shadow-soft: 0 2px 8px rgba(0,0,0,0.08)`, pas de glow colore, pas d'`uppercase` sur le titre (voir skill `design-classica`)
- **Manifeste** : inchange par le test de lecture (l'abandon de l'envoi de score evite le scope `userinfo.email` et l'entree `urlFetchWhitelist` correspondante — donc aussi la re-autorisation de l'add-on que tout nouveau scope declenche cote utilisateur)
- **Reste a faire** (voir le plan pour le detail) : deploiement au niveau du domaine Workspace de l'ecole (etape 9), seule etape du plan encore ouverte

### Pieges Apps Script rencontres (tous confirmes en test reel, plusieurs heures de debug)

1. **`HtmlService` supprime tout ce qui suit `//`, meme a l'interieur d'une chaine JS.** `'http://www.w3.org/2000/svg'` devenait `'http:` → chaine non fermee → `Uncaught SyntaxError` et **tout le script de la sidebar mort** (boutons totalement inertes, aucun log). Contournement : construire la chaine en morceaux (`'http:' + '/' + '/www.w3.org/...'`). **Regle : ne jamais laisser un `//` litteral apparaitre apres du code sur une ligne** — un `grep` de controle existe dans l'historique de session
2. **`HtmlService` corrompt aussi carrement du contenu** : `let recognition = null;` + `let recording = false;` servi comme `let recognition = nulcording = false;` (fragment efface au milieu). C'est pour cela que la page d'enregistrement a fini hebergee sur le Cloud Function
3. **Toute page servie par `HtmlService` est enveloppee dans un iframe sandboxe sans permission micro** — y compris une vraie page de premier niveau ouverte via `window.open()` sur un deploiement Web App. `SpeechRecognition` s'y termine sans erreur et sans jamais capter de son ("Rien n'a ete reconnu"). Le meme code sur une page normale (test isole sur google.com) fonctionne parfaitement
4. **`ContentService.createTextOutput(...).setMimeType(HTML)` ne rend pas de page** sur un deploiement restreint au domaine : le HTML s'affiche en texte brut, balises visibles
5. **`postMessage` bloque entre `*.googleusercontent.com` (dialogue/sidebar) et `script.google.com`** : "dropping postMessage.. was from host X but expected host Y". Idem pour `google.script.run` **appele depuis une fenetre ouverte par `window.open()`** (la bibliotheque cliente tente une poignee de main vers son `opener`, bloquee de la meme facon)
6. **`ScriptApp.getService().getUrl()` renvoie une URL de deploiement OBSOLETE** quand il est appele depuis un contexte d'add-on. L'URL du Web App est donc en dur dans `Code.gs` (`RECORDING_WEBAPP_URL`) — a mettre a jour a la main en cas de redeploiement
7. **`urlFetchWhitelist` est obligatoire** (champ de **premier niveau** de `appsscript.json`, PAS sous `addOns.common`) des qu'un add-on Workspace utilise `UrlFetchApp`, sinon le deploiement echoue
8. **Un deploiement Web App est fige sur sa version** : apres `clasp push`, il faut Deployer > Gerer les deploiements > crayon > **Nouvelle version** pour que le code servi par `/exec` change. La sidebar et le dialogue, eux, se rechargent toujours a jour
- **A surveiller** : la premiere fois qu'on ouvre l'add-on apres un `clasp push`, un rechargement complet de l'onglet (`Cmd+Shift+R`) est parfois necessaire — la carte d'accueil/le panneau peuvent rester en cache

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
9. **Creation de l'app web** — application web separee de l'extension (URL de video -> transcription -> aides IA generees par Claude : resume, QCM, vocabulaire, questions ancrees a un timestamp) ; permet au prof de preparer du contenu a l'avance et aux eleves de le consommer en asynchrone, ce que l'architecture actuelle de l'extension (ephemere, par page) ne permet pas. Reprend/elargit l'idee de l'outil YouTube (roadmap #7)
10. **Module complementaire equivalent pour Google Docs** — meme principe que l'extension (traduction au clic, aide a la comprehension, vocabulaire) mais adapte a Google Docs ; a verifier : l'editeur Docs ne rend pas le texte en DOM standard (canvas/SVG), donc probablement un Google Docs Add-on (Apps Script) plutot qu'une reutilisation directe de content.js
11. **Connexion OAuth Google + plateforme web de resultats** — chantier prioritaire, decide en fin de session du 2026-08-01 (voir la section dediee ci-dessous). Absorbe et remplace les items #2 (envoi des resultats au prof), #3 (interface professeur) et #8 (connexion utilisateur), qui ne doivent plus etre traites separement

## App web de resultats (`web/`) — chantier en cours, demarre le 2026-08-03

Plan complet : `/Users/jpbolle/.claude/plans/crispy-dreaming-duckling.md`. Remplace le flux « score -> Apps Script -> Google Sheet » et absorbe les items #2, #3, #8 et #11 de la roadmap.

- **Projet Firebase** : `essai-27712` (nom affiche « daspalecte »), reutilise faute de quota pour en creer un nouveau. **L'ID reste `essai-27712`** et apparaitra dans l'URL d'hebergement. Firestore en `eur3` (multi-region Europe, choisi a la creation, immuable), plan gratuit
- **Stack** : Next.js 16 (App Router, TypeScript) + Tailwind v4 dans `web/`, deploiement prevu sur Firebase App Hosting (necessite le plan Blaze, pas encore active)
- **Theme** : tokens Classica recopies de `themes.css:127-244` dans le bloc `@theme` de `web/src/app/globals.css`. **Si l'un bouge, l'autre suit.** Registre « product » du skill impeccable : Playfair reserve aux titres de page, jamais sur un libelle ou un bouton

### La decision structurante : la clef d'un compte est le `sub` Google

Ni l'uid Firebase Auth, ni l'email. L'extension (`chrome.identity.getAuthToken`) et l'add-on (`ScriptApp.getOAuthToken()`) n'obtiennent qu'un **access token Google** et ne connaissent que le `sub` ; l'email, lui, change et emporterait tout l'historique. Le `sub` est recopie dans le custom claim `gsub`, et **c'est lui que comparent les regles Firestore** — jamais `request.auth.uid`.

Consequence voulue : **un eleve n'a pas besoin d'ouvrir l'app web.** Son premier mot traduit dans l'extension cree son compte, a condition qu'un prof ait inscrit son adresse au prealable.

### Ce qui est fait

- Auth Google (popup + repli redirection pour les Chromebooks), cookie de session httpOnly, role en custom claim (`admin` / `teacher` / `student`), ecran « compte non reconnu »
- Inscription par email : `/prof` pour les eleves, `/admin/profs` pour les profs (admin seul). `ADMIN_EMAIL` est promu admin a son premier login quoi qu'en dise son document `users` — filet anti-verrouillage
- `POST /api/ingest` : verifie le token contre une **liste** d'audiences (`ALLOWED_AUDIENCES`, jamais un client ID en dur), ecriture idempotente (l'id d'evenement vient du client, un lot rejoue ne double pas les compteurs), projection vers `vocabulary` / `readingTests` / `exerciseResults`
- Ecrans : tableau de classe avec stats + cartes eleves, fiche eleve avec ses sessions depliables (mots etudies, exercices et leurs scores, test de lecture), vue eleve (`/moi`) avec ses tests et ses mots filtrables
- **31 tests** (`cd web && npm test`) : 21 sur les regles Firestore, 10 sur les ecritures d'ingestion. Les deux suites exigent l'emulateur Firestore, donc un JDK (`brew install openjdk`)
- Regles et index deployes sur le projet reel

### Pieges rencontres

1. **Quota de projets Google atteint** — impossible de creer un nouveau projet Firebase, d'ou la reutilisation d'`essai-27712`
2. **`firebase emulators:start` prend le projet actif du CLI, pas forcement celui du `.firebaserc`** : l'emulateur Auth tournait sous `lecturevive-cnd` et rejetait tous les jetons (`aud` incorrect). Le script `npm run emulators` force desormais `--project essai-27712`
3. **Creer la base Firestore par l'API exige la facturation** ; par la console, le plan gratuit suffit
4. **Un `w-full` dans un conteneur flex s'ecrase a zero** — la jauge de score etait invisible sur `/moi`

### Extension : envoi des resultats (`analytics.js`)

- **Ne JAMAIS remettre `"key"` dans `manifest.json`.** Essaye en debut de chantier pour faire converger l'ID local vers celui du Web Store : Chrome refuse alors de charger la copie non empaquetee, avec « L'administrateur a bloque l'extension Daspalecte ». La stratégie d'administration de `cnddinant.be` pilote l'extension publiee, et Chrome interdit par securite qu'une copie locale usurpe l'ID d'une extension geree par stratégie. **Conséquence : avec la clef, aucun developpement local n'est possible sur un profil gere.** L'extension a donc bel et bien deux identifiants, definitivement : `dfamiepedkpjldfbdcmdchjfopnhnkgf` (Web Store) et celui de la copie non empaquetee, derive du chemin absolu du dossier
- **D'ou `launchWebAuthFlow` plutot que `getAuthToken`.** `getAuthToken` lit son `client_id` dans le manifeste, qui n'en accepte qu'un : avec deux identifiants d'extension il faudrait deux clients OAuth et un manifeste a echanger avant chaque publication — un oubli casserait le suivi de tous les eleves, en silence et sans erreur visible. Un client de type **Application Web** accepte au contraire plusieurs URI de redirection : on enregistre `https://<id>.chromiumapp.org/` pour chaque identifiant et le meme client sert partout. Le bloc `oauth2` a donc disparu du manifeste, et `analytics.js` gere lui-meme le cache du jeton (`daspalecteToken`, marge de 60 s avant expiration)
- **L'URI de redirection exacte se lit avec `chrome.identity.getRedirectURL()`** dans la console du service worker — ne pas la deduire a la main
- **Trois clients OAuth dans `essai-27712`**, c'est normal : celui cree par Firebase pour la page de connexion de l'app, celui de type Extension Chrome (devenu inutile, vestige de la premiere approche), et celui de type Application Web utilise par `launchWebAuthFlow`
- **`analytics.js`, charge par `background.js`** via `importScripts`, et pas depuis `content.js` : un content script meurt a chaque navigation, la session en cours ne survivrait pas. Il tient la session par onglet (`chrome.storage.session`, nouvelle session si l'URL normalisee change ou apres 30 min d'inactivite), la file d'attente (`chrome.storage.local`, indispensable sur des Chromebooks au reseau capricieux) et le jeton
- **La connexion est explicite**, depuis la section « Mon compte » du sidepanel : c'est le seul endroit ou une fenetre de consentement Google peut s'ouvrir. Ensuite `background.js` ne demande plus que des jetons non interactifs. Sans cette premiere connexion, les evenements s'accumulent dans la file sans partir — ils ne sont pas perdus
- **Points de mesure** (`this.track(...)` dans `content.js`) : traduction d'un mot (page web et PDF), aide a la comprehension, capture OCR, exercice reussi, test de lecture
- **Nombre d'essais** : compte les clics sur « Verifier » au niveau de l'assistant (`attemptsByStep` dans `displayExercises`), plutot qu'un compteur ajoute dans chacun des sept exercices. Associations et Lecture n'ont pas de bouton « Verifier » et restent donc a un essai, ce qui est exact : leur correction est immediate
- **`markCompleted(result)` n'enregistre que la premiere reussite** d'un exercice : un exercice deja reussi peut etre re-verifie, le prof verrait des doublons
- Un compte non inscrit par un prof recoit un 403 `unknown_account` : le suivi se coupe (`daspalecteTrackingBlocked`) au lieu de rejouer indefiniment, et le sidepanel l'explique a l'eleve

### Reste a faire

- **Verifier le flux de bout en bout avec un vrai compte eleve.** Attention : `jeanphilippe.bolle@cnddinant.be` est provisionne en **admin**, donc `/api/ingest` repond `{ok: true, ignored: "not_a_student"}` — c'est la preuve que la chaine jeton + CORS + resolution de compte fonctionne, mais aucune donnee n'est ecrite. Il faut un compte inscrit comme eleve pour voir des sessions apparaitre
- **Basculer `DEFAULT_API_BASE`** (`analytics.js`) de `http://127.0.0.1:3000` vers l'URL App Hosting le jour du deploiement. `daspalecteApiBase` dans `chrome.storage.local` permet de surcharger sans reconstruire
- **Phase 5 — add-on Apps Script** : l'`aud` d'un token Apps Script est le client OAuth du projet GCP associe au script ; il faudra rattacher le projet Apps Script a `essai-27712` et ajouter cette audience a `ALLOWED_AUDIENCES`
- Retirer `sendScoreToTeacher` et l'URL `script.google.com` de `content.js` une fois le nouveau flux verifie (l'envoi vers la Sheet est **conserve en parallele** pendant la transition, un TODO le signale dans le code)
- Activer le plan Blaze et deployer sur App Hosting

## Chantier a venir — OAuth Google et plateforme web de resultats

Prochain gros chantier (annonce "dans les jours qui viennent" le 2026-08-01) : connexion OAuth Google pour l'extension **et** pour le module complementaire, plus une plateforme web qui stocke les resultats, avec une interface professeur et une interface eleve. Remplace definitivement le flux "score -> Google Apps Script -> Google Sheet", **deja abandonne** (l'add-on n'envoie plus rien, l'extension envoie encore — a nettoyer a ce moment-la).

### Trois decisions d'architecture a respecter des le premier jour

Elles determinent si l'app web heritera de l'authentification ou s'il faudra tout refaire :

1. **Creer le client OAuth dans le projet Google Cloud existant** (`vocabulaire`, 1086562672385). L'ecran de consentement Google se configure une seule fois **par projet** : nom, logo, restriction de domaine `@cnddinant.be` sont alors acquis pour tous les clients suivants. Attention : Google impose des **types de client differents** (« Extension Chrome » vs « Application Web »), il y aura donc au moins deux client IDs dans ce meme projet
2. **Verifier le token cote backend contre une LISTE d'audiences**, jamais contre un client ID en dur. Si `cloud-function/index.js` demande « ce token vient-il de l'un de mes clients autorises, et l'eleve est-il du domaine ? », l'app web se branche sans toucher au backend
3. **Cle d'un eleve dans la base = le `sub` du token Google**, pas son email. Un email d'eleve change (changement d'etablissement, correction de faute de frappe) et l'historique serait perdu

### Ce qui en depend

- **Protection de l'endpoint Cloud Run** : le service est aujourd'hui public (`Access-Control-Allow-Origin: *`, aucune authentification) et son URL est dans ce repo GitHub **public** (`content.js`, et desormais `gas-addon/Code.gs`). N'importe qui peut donc consommer le quota Claude — **la cle API, elle, ne risque rien** : elle vit dans Secret Manager, n'est lue que cote serveur et n'apparait dans aucune reponse. Une limite de depenses est en place cote Anthropic, ce qui borne le risque financier en attendant. Le controle du domaine viendra naturellement avec l'OAuth : ne PAS coder d'authentification intermediaire, elle serait jetee
- L'envoi de score du module complementaire : point de reprise deja documente dans `gas-addon/Code.gs`, section TEST DE LECTURE

## Version actuelle : 2.0
