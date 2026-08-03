#!/usr/bin/env bash
#
# Fabrique l'archive a envoyer au Chrome Web Store.
#
#   ./daspa-extension/package-extension.sh
#   # ou depuis ce dossier : ./package-extension.sh
#
# N'embarque QUE les fichiers de ce dossier (daspa-extension/) : ni daspa-app/,
# ni gas-addon/, ni cloud-function/, ni la documentation. Le Web Store refuse
# les archives contenant des fichiers inutiles, et surtout cloud-function/
# n'a rien a faire dans un paquet public.

set -euo pipefail

cd "$(dirname "$0")"

VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
ARCHIVE="daspalecte-${VERSION}.zip"

# --- Garde-fous ------------------------------------------------------------
# Publier une extension pointant sur localhost enverrait les resultats de tous
# les eleves dans le vide, sans la moindre erreur visible. On refuse net.
API_BASE=$(grep -o "^const DEFAULT_API_BASE = '[^']*'" analytics.js | cut -d"'" -f2)
case "$API_BASE" in
  *localhost*|*127.0.0.1*|"")
    echo "REFUS : DEFAULT_API_BASE vaut « ${API_BASE} » dans analytics.js." >&2
    echo "        Mets l'URL de production avant de packager." >&2
    exit 1
    ;;
esac

if grep -q '"key"' manifest.json; then
  echo "REFUS : manifest.json contient une clef \"key\"." >&2
  echo "        Elle empeche tout chargement local sur un profil gere (voir INIT.md)." >&2
  exit 1
fi

if grep -q "A_REMPLIR" analytics.js; then
  echo "REFUS : OAUTH_CLIENT_ID n'est pas renseigne dans analytics.js." >&2
  exit 1
fi

# --- Verification de syntaxe ----------------------------------------------
for f in analytics.js background.js content.js popup.js sidepanel.js pdfviewer.js theme-manager.js; do
  node --check "$f" >/dev/null || { echo "REFUS : erreur de syntaxe dans $f" >&2; exit 1; }
done
python3 -c "import json; json.load(open('manifest.json'))" >/dev/null

# --- Fabrication ------------------------------------------------------------
rm -f "$ARCHIVE"

zip -r -q "$ARCHIVE" \
  manifest.json \
  analytics.js background.js content.js content.css \
  popup.html popup.css popup.js \
  sidepanel.html sidepanel.css sidepanel.js \
  pdfviewer.html pdfviewer.css pdfviewer.js \
  themes.css theme-manager.js \
  lib \
  icon16.png icon32.png icon48.png icon128.png logo-pedagokit.png \
  -x '*.DS_Store'

echo "Archive : ${ARCHIVE}  ($(du -h "$ARCHIVE" | cut -f1))"
echo "Backend : ${API_BASE}"
unzip -l "$ARCHIVE" | tail -n 3
