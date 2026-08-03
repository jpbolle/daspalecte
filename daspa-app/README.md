# Daspalecte — app web

Plateforme de résultats : le prof suit ses élèves, l'élève voit sa progression.
Alimentée par l'extension Chrome et par le module complémentaire Google Docs
via `POST /api/ingest`.

## Démarrer en local

Les émulateurs Firebase exigent un JDK (`brew install openjdk`, keg-only : il
faut préfixer le PATH, ce que fait déjà le script `emulators`).

```bash
npm run emulators      # terminal 1 — auth + firestore, UI sur :4000
npm run dev:emul       # terminal 2 — Next.js sur :3000, branché sur les émulateurs
```

Sans émulateur (contre le vrai projet Firebase) : `npm run dev`, après avoir mis
`NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false` dans `.env.local` et fourni des
credentials Admin (`GOOGLE_APPLICATION_CREDENTIALS`).

## Tests

```bash
npm test               # règles Firestore + écritures d'ingestion
```

Les deux suites tapent sur l'émulateur Firestore : il doit tourner.

## Configuration

`.env.example` liste toutes les variables. Trois méritent une explication :

- `ADMIN_EMAIL` — ce compte est promu administrateur à sa première connexion,
  quoi que dise son document `users`. C'est le filet qui évite de se verrouiller
  dehors.
- `ALLOWED_AUDIENCES` — clients OAuth autorisés à appeler `/api/ingest`, séparés
  par des virgules. **Jamais un client ID en dur dans le code** : un nouveau
  client (extension, add-on, futur mobile) s'ajoute ici seulement.
- `ALLOWED_INGEST_ORIGINS` — origines CORS acceptées, typiquement
  `chrome-extension://<id de l'extension>`.

## Ce qu'il faut savoir sur le modèle de données

L'identifiant d'un compte est le **`sub` Google**, pas l'uid Firebase Auth et
pas l'email. L'extension et l'add-on n'obtiennent qu'un access token Google et
ne connaissent que cette valeur ; l'email, lui, change (changement d'école,
faute de frappe corrigée) et emporterait tout l'historique. Le `sub` est recopié
dans le custom claim `gsub`, et c'est lui que comparent les règles Firestore —
jamais `request.auth.uid`.

Corollaire : un élève peut exister sans avoir jamais ouvert cette app. Son
premier événement envoyé depuis l'extension crée son compte, à condition qu'un
prof ait inscrit son adresse au préalable.

Les écritures passent **toutes** par le SDK Admin (routes `/api/*`). Les règles
Firestore n'accordent que la lecture, et servent de seconde barrière.

## Thème

Classica, repris de `daspa-extension/themes.css`. Les tokens sont recopiés dans
`src/app/globals.css` (bloc `@theme`) et doivent rester alignés avec
`daspa-extension/themes.css:127-244` — si l'un bouge, l'autre suit.
