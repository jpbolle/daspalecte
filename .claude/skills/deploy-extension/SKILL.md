# deployExtension

Skill de deploiement de l'extension Chrome Daspalecte vers le Chrome Web Store.

## Declencheur
Quand l'utilisateur demande de deployer, packager, ou publier l'extension Daspalecte.

## Etapes

### 1. Bump de version
Demander le nouveau numero de version a l'utilisateur, puis mettre a jour :
- `daspa-extension/manifest.json` : champ `"version"`
- `daspa-extension/popup.html` : texte du footer `<p>2026 - version X.Y</p>`
- `daspa-extension/sidepanel.html` : texte du footer version
- `INIT.md` : derniere ligne `## Version actuelle : X.Y`

### 2. Mise a jour de la description Chrome Web Store
Lire `chrome-store-description.txt` et verifier qu'il reflete les fonctionnalites actuelles.
Si des features ont ete ajoutees ou modifiees, mettre a jour le fichier en consequence.
Sections a verifier :
- Titre et description courte
- Traducteur (langues supportees)
- Lecteur PDF
- Capture & Lecture d'image (OCR)
- Aide a la comprehension (IA)
- Gestion de vocabulaire
- Exercices interactifs
- Test de comprehension final

### 3. Verification Cloud Function
Verifier si `cloud-function/index.js` a ete modifie depuis le dernier deploiement :
```bash
git diff HEAD~5 -- cloud-function/index.js
```
Si des changements sont detectes, avertir l'utilisateur :
> **ATTENTION** : `cloud-function/index.js` a ete modifie. Tu dois le redeployer manuellement :
> 1. Aller sur Google Cloud Console → Cloud Run → Service `daspalecte` (europe-west1)
> 2. Deployer une nouvelle revision avec le code mis a jour
> 3. Le secret `daspalecte` (cle API Anthropic) est deja configure dans Secret Manager

Si aucun changement : indiquer que le Cloud Run n'a pas besoin d'etre mis a jour.

### 4. Creation du package ZIP
Preferer le script :
```bash
./daspa-extension/package-extension.sh
```
Il produit `daspa-extension/daspalecte-<version>.zip` et refuse de packager si
`DEFAULT_API_BASE` est local, si `"key"` est dans le manifeste, ou si un JS a
une erreur de syntaxe.

Fichiers volontairement exclus du zip :
- `.git/`, `.gitignore`, `.claude/`
- `cloud-function/` (deploye separement sur Cloud Run)
- `CLAUDE.md`, `INIT.md`, `README.md`, tout fichier `*.md`
- `chrome-store-description.txt` (reference interne)
- `.DS_Store`, anciens zips, fichiers de test

### 5. Recapitulatif
Afficher un resume :
- Version deployee
- Fichiers modifies
- Taille du zip
- Cloud Function : a redeployer ou non
- Rappeler d'uploader le zip sur https://chrome.google.com/webstore/devconsole
- Distribution : groupe prive `daspa@cnddinant.be`

### 6. Fin de session
Mettre a jour `INIT.md` avec la nouvelle version si ce n'est pas deja fait.
Rappeler a l'utilisateur de commiter et pusher :
```bash
git add -A && git commit -m "Release vX.Y: description des changements" && git push
```
