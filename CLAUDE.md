# CLAUDE.md — Instructions pour Claude Code

## Rituel de session
- **Debut de session** : toujours commencer par lire `INIT.md` pour se remettre en contexte du projet.
- **Fin de session** : mettre a jour `INIT.md` si des changements significatifs ont ete apportes, puis rappeler a l'utilisateur de mettre a jour le repo GitHub (`git add`, `commit`, `push`).

## Structure du monorepo
- `daspa-extension/` — extension Chrome (charger ce dossier en « Load unpacked »)
- `gas-addon/` — module complementaire Google Docs/Sheets/Slides
- `daspa-app/` — app web de resultats (Next.js + Firebase)
- `cloud-function/` — backend Claude (hors git)

## Parite extension Chrome / module complementaire Apps Script
- Le projet a **deux implementations paralleles** : l'extension Chrome (`daspa-extension/`) et le module complementaire Docs/Sheets/Slides (`gas-addon/`), qui est un portage de la premiere.
- **Des qu'une fonctionnalite, un exercice, un prompt ou un correctif est ajoute/modifie dans l'extension ou dans `cloud-function/`, invoquer le skill `parite-addon`** et repercuter le changement dans `gas-addon/` — ou, si ce n'est pas pertinent, le dire explicitement a l'utilisateur.
- Ne jamais terminer une tache touchant l'extension sans avoir repondu a : « est-ce que ca doit aussi changer dans le module complementaire ? »

## Langue
- Communiquer en **francais** avec l'utilisateur.
- Le code, les commentaires dans le code et les noms de variables/fonctions restent en **anglais**.

## Conventions de code
- **Extension Chrome et module complementaire** : pas de frameworks JS (pas de React, Vue, etc.) — JavaScript vanilla uniquement, aucune etape de build
- **App web (`daspa-app/`)** : Next.js + React + Tailwind, c'est l'exception assumee. La regle ci-dessus ne s'y applique pas
- Respecter le theme visuel Neon Cyberpunk (voir `INIT.md` pour les couleurs/polices)
- Le content script (`daspa-extension/content.js`) est le fichier le plus volumineux (~3000 lignes) — toute modification doit etre prudente

## Securite
- Ne jamais exposer l'URL de l'endpoint Cloud Function dans le code public ou le README
- Ne jamais commiter de fichiers `.env` ou de credentials
