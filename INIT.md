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
7. **Phrase avec le vocabulaire** — l'eleve ecrit une phrase utilisant au moins 50% des mots appris (seuil calcule cote client, tolerant au genre/nombre — "ignorant"/"ignorante" reconnus comme le meme mot — pastilles surlignees en temps reel), verification par Claude (action backend `verify_sentence`) en deux volets : (a) emploi correct/incorrect de **chaque mot impose** avec explication courte — jamais de suggestion de remplacer un mot impose, seulement juger son integration ; (b) grammaire de la phrase entiere, avec version corrigee (qui garde tous les mots imposes) affichee en encadre si besoin. Feedback bienveillant : un sens plausible malgre une grammaire imparfaite est traite comme une reussite partielle (manque de vocabulaire), pas comme un non-sens

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
- Fichiers touches : `content.js`, `cloud-function/index.js`

### Backend (Cloud Function) — copie locale ajoutee au projet
- `cloud-function/index.js` + `package.json` : copie locale ajoutee dans le repo (deja gitignoree via `cloud-function/`, ne jamais committer)
- Permet desormais d'editer et de verifier la syntaxe (`node --check`) localement avant de coller dans l'editeur Cloud Console — plus fiable que l'edition directe dans l'editeur web
- Attention : une copie locale peut se desynchroniser de la version deployee (constate cette session avec une archive `~/Downloads` corrompue) — toujours confirmer avec le contenu reel de Cloud Console en cas de doute

## Add-on Google Apps Script (Docs / Sheets / Slides) — nouveau chantier, en cours

Repond a la roadmap #10 : equivalent de l'extension pour Google Docs/Sheets/Slides, ou l'extension Chrome ne peut pas fonctionner (rendu canvas, pas de DOM texte standard). Plan complet : `/Users/jpbolle/.claude/plans/tidy-purring-ripple.md`.

- **Emplacement** : `gas-addon/` a la racine du repo, **gitignore** (comme `cloud-function/` — pas de copie de ce code dans l'historique git)
- **Architecture** : un seul projet Apps Script standalone cible les 3 apps via les sections `addOns.docs`/`sheets`/`slides` du manifeste `appsscript.json`, sidebar `HtmlService` commune (`Sidebar.html`), backend relaye vers le meme Cloud Function (`Code.gs` → `callCloudFunction()`)
- **Changement de modele d'interaction acte des le depart** : pas de clic direct sur un mot du document (impossible, rendu canvas) → l'eleve **selectionne** puis clique un bouton dans la sidebar (`getSelectionText()` gere Docs/Slides/Sheets differemment en interne, interface commune)
- **Deploiement** : necessite le nouveau modele unifie "Google Workspace Add-on" — une fonction `onHomepage(e)` renvoyant une carte `CardService` est obligatoire (sinon message d'erreur "Aucune fiche de page d'accueil n'est fournie"), avec un bouton qui ouvre la vraie sidebar HTML via `showSidebar()`. Dev local avec `clasp` (`clasp push`), pas l'editeur web
- **Theme** : Classica uniquement (demande explicite de l'utilisateur, pas de selecteur Cyberpunk/Classica), variables `--t-*` reprises de `themes.css`
- **Spike de validation technique (risques identifies dans le plan, maintenant leves)** :
  - `speechSynthesis` : aucun freeze constate, meme en rafale (5 phrases a la suite) — utilisable directement dans la sidebar
  - `SpeechRecognition` (micro) : **echoue systematiquement dans l'iframe de la sidebar** (`not-allowed`, confirme hors extensions/Incognito/Invite/permission systeme — vraiment specifique a l'iframe HtmlService). Contournement valide : une fenetre separee ouverte via `window.open()` depuis un clic a un acces micro normal (contexte de navigation independant). → l'etape "Enregistrer ma lecture" de l'exercice Lecture devra passer par cette fenetre dediee, pas rester inline dans la sidebar
- **Fonctionnalites implementees et testees en direct (Doc reel)** :
  - Traduction sur selection (max 3 mots, au-dela message d'erreur — evite qu'un eleve traduise un passage entier au lieu d'un mot), ajout automatique au vocabulaire des reception de la traduction (comme l'extension, pas de bouton "Ajouter" separe)
  - Vocabulaire persistant via `PropertiesService.getUserProperties()` (equivalent `chrome.storage.local.wordList`), suppression par mot
  - Langue maternelle persistante (`nativeLanguage`), meme 11 langues que l'extension
  - Aide a la comprehension (action `summarize` du Cloud Function inchangee) sur selection de paragraphe, garde-fou si selection trop courte (redirige vers "Traduire")
- **Reste a faire** (voir le plan pour le detail) : generation d'exercices portee dans la sidebar, couche d'extraction du texte ENTIER du document par appli (pas juste la selection — necessaire pour le test de lecture), test de lecture + envoi de score, deploiement au niveau du domaine Workspace de l'ecole
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

## Version actuelle : 1.10
