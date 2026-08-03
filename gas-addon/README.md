# Daspalecte — Add-on Apps Script (Docs / Sheets / Slides)

Plan complet : `/Users/jpbolle/.claude/plans/tidy-purring-ripple.md`.

## État d'avancement

- Étapes 1-5 : bootstrap, thème Classica, traduction sur sélection + vocabulaire, aide à la compréhension — fait.
- Étape 6 (génération d'exercices) : fait — les 7 types d'exercices sont portés dans `Sidebar.html`
  (bouton "Générer des exercices" sous la section Vocabulaire, réutilise les mots déjà accumulés).
  Différences avec `content.js` :
  - Pas d'overlay plein écran (la sidebar est déjà tout l'espace disponible) : `#ex-view` remplace
    simplement les autres sections le temps de la session d'exercices.
  - `chrome.tts` → `speechSynthesis` directement (validé sans freeze par le spike de l'étape 2).
  - L'enregistrement de l'exercice Lecture (`SpeechRecognition`, qui échoue dans l'iframe de la
    sidebar) ouvre une **fenêtre séparée** générée à la volée (Blob + `window.open`, pas de
    déploiement web app dédié), qui fait sa propre reconnaissance + alignement puis renvoie le
    résultat par `postMessage`. C'est le point le plus incertain, à tester en priorité (bloqueurs
    de popup, permission micro dans une fenêtre `window.open` plutôt qu'un onglet classique).
  - CSS simplifié (colonnes plus étroites, cartes famille en liste verticale plutôt qu'en grille)
    pour la largeur réduite de la sidebar, sans les hacks `all: initial !important` de
    `content.css` (inutiles ici, pas de CSS de page hôte à contrer).
- Étape 7 (extraction du texte entier par appli) et étape 8 (test de lecture) : pas commencées.

## Structure

- `appsscript.json` — manifeste (déclare l'add-on pour Docs, Sheets, Slides)
- `Code.gs` — points d'entrée serveur (menu, sidebar, relais vers le Cloud Function existant)
- `Sidebar.html` — interface (thème, traduction, vocabulaire, aide à la compréhension, exercices)

## Mise en route (nécessite ton compte Google — étapes à faire toi-même)

Ce scaffold est local, donc rien n'est encore lié à un vrai projet Apps Script.
Pour continuer, il faut ton compte Google (clasp s'authentifie via OAuth dans le navigateur) :

1. Installer clasp si besoin : `npm install -g @google/clasp`
2. Te connecter : `clasp login` (ouvre une fenêtre de connexion Google)
3. Depuis ce dossier (`gas-addon/`), créer le projet Apps Script standalone lié :
   `clasp create --type standalone --title "Daspalecte"`
   (un add-on installable sur plusieurs types de documents doit être un script
   **standalone**, pas lié à un seul fichier — les sections `docs`/`sheets`/`slides`
   du manifeste `appsscript.json` couvrent les trois apps depuis ce projet unique)
4. Pousser le code local vers Apps Script : `clasp push`
5. Ouvrir le projet dans l'éditeur web pour vérifier qu'il n'y a pas d'erreur de manifeste :
   `clasp open`
6. Dans l'éditeur web : Déployer → Gérer les déploiements → tester en tant qu'add-on
   sur un Doc, une Sheet et une présentation Slides de test.

⚠️ `logoUrl` dans `appsscript.json` pointe vers une icône Google générique temporaire —
à remplacer par une icône Daspalecte hébergée publiquement avant toute diffusion réelle.

Une fois les étapes 1-6 ci-dessus faites, dis-le et on enchaîne sur l'étape 2 du plan
(spike de validation `speechSynthesis`/`SpeechRecognition` dans une sidebar réelle),
qui nécessite ce déploiement testable.
