# CLAUDE.md — Instructions pour Claude Code

## Rituel de session
- **Debut de session** : toujours commencer par lire `INIT.md` pour se remettre en contexte du projet.
- **Fin de session** : mettre a jour `INIT.md` si des changements significatifs ont ete apportes, puis rappeler a l'utilisateur de mettre a jour le repo GitHub (`git add`, `commit`, `push`).

## Langue
- Communiquer en **francais** avec l'utilisateur.
- Le code, les commentaires dans le code et les noms de variables/fonctions restent en **anglais**.

## Conventions de code
- Pas de frameworks JS (pas de React, Vue, etc.) — JavaScript vanilla uniquement
- Respecter le theme visuel Neon Cyberpunk (voir `INIT.md` pour les couleurs/polices)
- Le content script (`content.js`) est le fichier le plus volumineux (~1200 lignes) — toute modification doit etre prudente

## Securite
- Ne jamais exposer l'URL de l'endpoint Cloud Function dans le code public ou le README
- Ne jamais commiter de fichiers `.env` ou de credentials
