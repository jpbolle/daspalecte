# INIT.md — Vue d'ensemble du projet Daspalecte

## Qu'est-ce que Daspalecte ?
Une extension Chrome d'aide à la lecture pour les élèves **FLE** (Français Langue Etrangere), en particulier ceux du dispositif **DASPA** (Dispositif d'Accueil et de Scolarisation des eleves Primo-Arrivants) en Belgique.

## Les 4 fonctionnalites principales

### 1. Traducteur mot a mot
- Clic sur un mot de n'importe quelle page web -> traduction instantanee (via Google Translate API)
- 10 langues : arabe, anglais, dari, espagnol, pashto, polonais, roumain, russe, turc, ukrainien
- Bulle cyan au-dessus du mot, gestion des ligatures francaises (oe, ae)

### 2. Gestion de vocabulaire
- Les mots traduits s'ajoutent automatiquement a une liste personnelle (Chrome Storage)
- Selection, suppression, persistance locale

### 3. Aide a la comprehension (IA)
- Boutons magiques sur les paragraphes > 50 caracteres
- Resume (max 30 mots) + reformulation simplifiee avec traductions des mots difficiles
- Propulse par **Claude Sonnet 4.5** via une Cloud Function

### 4. Generation d'exercices
5 types progressifs a partir des mots de vocabulaire collectes :
1. **Associations** — relier mot francais / traduction
2. **Famille de mots** — decouvrir les mots de la meme famille
3. **Etiquettes** — glisser-deposer le bon mot dans la phrase
4. **Lecture** — lire un texte contextuel
5. **Defi final** — texte a trous

## Architecture

```
Extension Chrome (frontend)
  ├── popup        → point d'entree, selection de langue
  ├── sidepanel    → panneau lateral avec toggles et liste de vocabulaire
  ├── content.js   → injection dans les pages web (traduction, comprehension, exercices)
  └── background   → service worker, relay de messages

Cloud Function (backend)
  └── index.js     → recoit les requetes, appelle Claude API, renvoie JSON

Google Cloud Console
  └── Projet "vocabulaire" (ID numerique : 1086562672385)
      ├── Cloud Run   → daspalecte (europe-west1)
      ├── Secret Manager → "daspalecte" (cle API Anthropic)
      └── Secret Manager → "daspalecte-email-password" (mot de passe Gmail pour nodemailer)
```

## Flux de donnees
1. L'utilisateur clique sur un mot → `content.js` envoie une requete traduction (Google Translate)
2. L'utilisateur clique sur le bouton comprehension → `content.js` → `background.js` → Cloud Function → Claude API → reponse JSON affichee dans la page
3. L'utilisateur genere des exercices → meme flux, avec le prompt `generate_exercises`

## Design
- Theme **Neon Cyberpunk** : fond sombre, cyan (#00f3ff), magenta (#ff00ff)
- Polices : Orbitron (titres), Inter (corps)
- Effets : glow, glassmorphism, transitions fluides

## Version actuelle : 1.3
