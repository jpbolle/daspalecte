---
name: parite-addon
description: Maintient la parité entre l'extension Chrome et le module complémentaire Google Apps Script (Docs/Sheets/Slides). Use whenever you add, modify or fix ANY user-facing feature, exercise, prompt or fix in the Chrome extension (daspa-extension/: content.js, sidepanel.*, popup.*, themes.css, content.css) or in the backend Cloud Function — the same change almost always has to be ported to gas-addon/. Also use when the user says "ajoute", "corrige", "modifie" a feature without naming a target, or asks whether the add-on is up to date.
---

# Parité extension Chrome ↔ module complémentaire Apps Script

Daspalecte existe en **deux implémentations parallèles** qui partagent le même backend :

| | Extension Chrome | Module complémentaire (Docs/Sheets/Slides) |
|---|---|---|
| Cible | pages web | Google Docs, Sheets, Slides |
| Interface | `daspa-extension/sidepanel.html/.js/.css` | `gas-addon/Sidebar.html` |
| Exercices | `daspa-extension/content.js` (`render*`) + `content.css` | `gas-addon/ExercisesDialog.html` |
| Injection page | `daspa-extension/content.js` | — (impossible, rendu canvas) |
| Backend | `cloud-function/index.js` — **commun aux deux** |

Le module complémentaire est un **portage** de `daspa-extension/content.js`. Toute évolution de l'un doit être répercutée sur l'autre, sinon les deux divergent silencieusement.

## Règle

**Après toute modification de l'extension ou du backend, vérifier si le module complémentaire est concerné, et le dire à l'utilisateur — même si on ne porte pas tout de suite.**

Ne jamais terminer une tâche sur l'extension sans avoir répondu à : *« est-ce que ça doit aussi changer dans `gas-addon/` ? »*

## Quoi porter, quoi ne pas porter

**À porter systématiquement :**
- Les 7 exercices (`renderMatching`, `renderTags`, `renderReading`, `renderFamily`, `renderCloze`, `renderSentence`, écoute et associe) — logique, seuils, feedback, navigation par points
- Les prompts du Cloud Function (`generate_exercises`, `verify_sentence`, `verify_tags_answers`, `summarize`) — **backend commun, donc automatiquement partagé**, mais vérifier que les deux clients gèrent bien le nouveau format de réponse
- Les helpers de comparaison de mots (`normalizeSentenceWord`, `stripGenderNumber`, `wordMatchKey`, `sameVocabularyWord`, `splitIntoSentences`)
- La traduction, le vocabulaire, l'aide à la compréhension
- Les corrections de bugs sur toute logique ci-dessus

**À adapter, pas copier tel quel :**
- CSS : porter le *design* (variables `--t-*`, thème Classica) mais **pas** les hacks défensifs `all: initial !important` de `content.css` — ils protègent des pages hôtes, inutiles dans une iframe Apps Script isolée
- `chrome.tts` → `speechSynthesis` ; `chrome.storage.local` → `PropertiesService.getUserProperties()` ; `fetch()` direct → `google.script.run.callCloudFunction()`
- Overlay plein écran de l'extension → dialogue modal Apps Script (`ui.showModalDialog`)

**À ne PAS porter :**
- Visionneuse PDF, capture d'écran/OCR, bouton flottant PDF, roadmap, sélecteur de thème (le module est Classica uniquement)
- Tout ce qui dépend d'un DOM de page web (clic direct sur un mot → remplacé par « sélectionner puis cliquer un bouton »)

## Procédure

1. Identifier la fonction modifiée dans `daspa-extension/content.js` (ou le prompt dans `cloud-function/index.js`)
2. Chercher son équivalent : les noms sont préfixés `renderEx*` dans `gas-addon/ExercisesDialog.html` (`renderCloze` → `renderExCloze`)
3. Appliquer le même changement en respectant les substitutions d'API ci-dessus
4. **Valider la syntaxe** (voir ci-dessous — obligatoire, le pipeline Apps Script est piégeux)
5. `cd gas-addon && clasp push --force`
6. Signaler à l'utilisateur ce qui a été porté, et ce qui reste à faire de son côté (redéploiement Cloud Function ou Web App)

## Validation obligatoire avant tout push

Le pipeline HTML d'Apps Script **supprime tout ce qui suit `//`, y compris à l'intérieur d'une chaîne JS** — ça a déjà tué tout le script d'une sidebar (`'http://...'` tronqué en `'http:`). Toujours lancer :

```bash
cd gas-addon && node -e "
const fs=require('fs');
['Sidebar.html','ExercisesDialog.html'].forEach(f=>{
  const m=fs.readFileSync(f,'utf8').match(/<script>([\s\S]*?)<\/script>/);
  try{new Function(m[1]);console.log(f+': OK');}catch(e){console.log(f+' SYNTAX ERROR: '+e.message);}
  m[1].split('\n').forEach((l,i)=>{const k=l.indexOf('//');
    if(k>-1&&l.slice(0,k).trim())console.log(f+' RISQUE // ligne '+(i+1)+': '+l);});
});
"
```

Aucune ligne « RISQUE » ne doit apparaître. Si un `//` littéral est nécessaire dans du code, le découper (`'http:' + '/' + '/...'`).

Voir la section **« Pièges Apps Script rencontrés »** de `INIT.md` pour les 8 comportements non documentés déjà rencontrés (iframe sans micro, `postMessage` bloqué, corruption de contenu, déploiement figé sur sa version…). Les relire avant de déboguer quoi que ce soit d'inattendu — ils font perdre des heures.

## Où en est le portage

État courant et reste à faire : section **« Add-on Google Apps Script »** de `INIT.md` (tenue à jour en fin de session).
