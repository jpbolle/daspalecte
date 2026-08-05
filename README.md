# Daspalecte

Outils d'aide à la lecture pour les élèves en **Français Langue Étrangère (FLE)**, en particulier
ceux du dispositif **DASPA** (Dispositif d'Accueil et de Scolarisation des élèves Primo-Arrivants)
en Belgique.

![Version](https://img.shields.io/badge/version-2.0.1-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)

L'élève lit une page web, un PDF ou un document Google. Il clique sur un mot qu'il ne comprend pas,
demande la reformulation d'un paragraphe trop dense, puis s'entraîne sur les mots qu'il a lui-même
rencontrés. Son professeur suit sa progression depuis une application web.

## Le monorepo

Quatre composants, deux implémentations parallèles de la même idée :

| Dossier | Rôle |
|---|---|
| `daspa-extension/` | Extension Chrome — pages web et PDF |
| `gas-addon/` | Module complémentaire Google Docs / Sheets / Slides (Apps Script) |
| `daspa-app/` | Application web de résultats (Next.js + Firebase) |
| `cloud-function/` | Backend Claude (Cloud Run, **hors dépôt**) |

`daspa-extension/` et `gas-addon/` couvrent des terrains où la même technique ne fonctionne pas :
l'éditeur Google Docs rend son texte en canvas, un content script n'y a aucune prise. Le module
complémentaire est donc un portage de `content.js`, avec un modèle d'interaction différent —
l'élève **sélectionne** puis clique un bouton, au lieu de cliquer directement un mot.

Les deux appellent le **même** backend. Toute évolution de l'un doit être répercutée sur l'autre :
voir `CLAUDE.md` et le skill `parite-addon`.

## Ce que fait l'extension

**Traducteur mot à mot** — un clic affiche le sens dans la langue d'origine de l'élève, parmi une
dizaine de langues d'origine fréquentes en classe d'accueil. Bulle au-dessus du mot, audio de la
prononciation, ligatures françaises (œ, æ) gérées, liens protégés du clic accidentel.

**Carnet de vocabulaire** — chaque mot consulté rejoint automatiquement une liste personnelle,
conservée d'une session à l'autre. Sélection par cases à cocher, suppression groupée.

**Aide à la compréhension** — un bouton ✨ le long des paragraphes de plus de 50 caractères produit
un résumé de 30 mots maximum, puis une reformulation simplifiée où les termes ardus sont traduits.

**Capture et déchiffrage d'image** — l'élève sélectionne une zone de l'écran ; Claude Vision en
transcrit fidèlement le texte, traduit les mots difficiles et annote le résultat. Pensé pour les
documents scannés et les manuels photographiés.

**Sept exercices progressifs**, générés à partir du carnet personnel :

1. **Associations** — relier chaque mot à sa traduction, avec lignes de connexion
2. **Famille de mots** — carte qui se retourne au clic, saisie des dérivés au verso
3. **Étiquettes** — glisser-déposer dans la phrase (seuil 70 %, correction locale)
4. **Lecture** — texte cliquable, écoute **phrase par phrase**, puis enregistrement vocal aligné
5. **Écoute et associe** — reconnaître le mot à l'oreille avant de l'associer
6. **Défi** — texte à trous (seuil 70 %, reprise avec indice sur les seules erreurs)
7. **Phrase avec le vocabulaire** — rédiger une phrase réemployant au moins la moitié des mots,
   vérifiée par Claude mot par mot puis sur la grammaire d'ensemble

**Test de lecture** — dix questions à choix multiples et un appariement, construits à partir du
texte de la page. Score calculé immédiatement.

**Lecteur PDF** — pdf.js intégré, traductions en annotations dans la marge droite, explications
dans la marge gauche, repliables en bulles. Rendu virtualisé, zoom, ajustement à la largeur.

**Deux thèmes** — Cyberpunk (fond sombre, néon) et Classica (crème, épuré), choisis au premier
lancement et modifiables à tout moment.

## Ce que fait le module complémentaire

Le même périmètre, moins ce qui n'est pas transposable dans Apps Script : traduction sur sélection,
carnet de vocabulaire, aide à la compréhension, les sept exercices et le test de lecture — dans des
dialogues modaux plutôt que des surcouches de page. Thème Classica uniquement.

Le test de lecture porte sur la **sélection** dans Docs (un document scolaire mêle plusieurs textes
et consignes), sur toute la présentation dans Slides, et n'existe pas dans Sheets — un tableau
n'est pas un texte suivi.

Ni capture d'écran ni lecteur PDF : l'un comme l'autre supposent un accès au navigateur que le
bac à sable d'Apps Script n'accorde pas.

## Ce que fait l'application web

Elle remplace l'ancien envoi de score vers une feuille de calcul.

- Connexion Google, rôles `admin` / `teacher` / `student` en custom claims
- Inscription des élèves par leur professeur : un compte non inscrit au préalable est refusé
- Tableau de classe, fiche par élève avec ses sessions dépliables, vue élève de ses propres résultats
- Zone d'administration : vue école, et **coût réel des appels Claude** mesuré en tokens

La clef d'un compte est le **`sub` Google**, jamais l'e-mail : une adresse d'élève change et
emporterait tout l'historique.

## Installation

### Élèves

L'extension est distribuée en **privé** par le Chrome Web Store, aux comptes du domaine de
l'établissement. Son installation est gérée par l'école.

### Développement

```bash
git clone https://github.com/jpbolle/daspalecte.git
cd daspalecte
```

**Extension** — `chrome://extensions/` → mode développeur → « Charger l'extension non empaquetée »
→ sélectionner le dossier `daspa-extension/`.

> L'identifiant Chrome d'une copie non empaquetée dérive du **chemin absolu** du dossier : le
> déplacer change l'identifiant, qu'il faut alors reporter dans les URI de redirection du client
> OAuth et dans les origines autorisées de l'ingestion. Ne jamais ajouter de clef `"key"` au
> manifeste pour figer l'identifiant : sur un profil géré par stratégie, Chrome refuse alors de
> charger l'extension.

**Application web**

```bash
cd daspa-app
npm install
npm run dev            # nécessite des identifiants ADC ; voir INIT.md
npm test               # 48 tests (règles Firestore, ingestion, provisionnement)
```

Les suites de tests exigent l'émulateur Firestore, donc un JDK.

**Module complémentaire** — développement avec `clasp` depuis `gas-addon/` (`clasp push`), jamais
depuis l'éditeur web.

**Paquet de publication**

```bash
./daspa-extension/package-extension.sh
```

Le script refuse de construire si le backend pointe sur localhost, si une clef `"key"` est revenue
dans le manifeste, si un fichier JS a une erreur de syntaxe, ou s'il subsiste une **ressource
distante** — une seule suffirait à classer l'extension en « code distant » au Chrome Web Store et à
rallonger chaque examen de plusieurs jours.

## Architecture

```
Extension / Module complémentaire
        │
        ├──► Google Translate ............ traduction mot à mot
        ├──► Cloud Run (europe-west1) ──► Claude Sonnet 4.5
        │         summarize · generate_exercises · verify_sentence
        │         generate_comprehension_test · analyze_screenshot
        │
        └──► App Hosting (europe-west4) ─► Firestore
                  /api/ingest : résultats, vocabulaire, coûts d'appel
```

La clef API Anthropic vit dans Google Secret Manager, n'est lue que côté serveur et n'apparaît dans
aucune réponse. L'URL de l'endpoint n'est pas publiée ici.

## Choix techniques

**Extension et module complémentaire** : JavaScript vanilla, aucune étape de build, aucun
framework. Les polices sont embarquées dans le paquet, comme les tables d'encodage de pdf.js — pas
un octet n'est chargé depuis un CDN.

**Application web** : Next.js (App Router, TypeScript) et Tailwind — l'exception assumée.

**Thèmes** : toutes les couleurs passent par des variables CSS `--t-*` définies dans `themes.css`.
Les tokens Classica sont recopiés dans l'application web : si l'un bouge, l'autre suit.

**Audio** : `chrome.tts` côté extension — `speechSynthesis` gèle dans Chrome — et
`speechSynthesis` côté Apps Script, où il fonctionne sans problème.

## Données

L'élève connecté transmet à la plateforme de son école, hébergée en Europe : son identifiant de
compte Google, son adresse e-mail scolaire, les mots qu'il étudie et ses résultats. Les textes
soumis à une reformulation ou à la génération d'un exercice sont traités par Claude (Anthropic) et
Google Traduction. Rien n'est vendu ni exploité à des fins publicitaires.

Politique de confidentialité :
<https://www.pedagokit.be/politiques-de-confidentialité-extensions-et-apps/daspalecte>

## Feuille de route

- Adaptation par niveau CECR (A1 à C2)
- Suivi pédagogique : historique, révisions espacées, statistiques de progression
- Outil de prononciation : comparaison entre le mot prononcé et le mot attendu
- Génération d'un test à partir d'une vidéo YouTube, puis d'une application de préparation de
  contenu par le professeur
- Ingestion des résultats du module complémentaire (phase 5)

## Auteur

**PedagokIT** — Jean-Philippe Bolle, Collège Notre-Dame de Dinant.

Projet développé pour les besoins d'un établissement scolaire et distribué à ses élèves. Aucune
licence ouverte n'y est attachée à ce jour.

## Remerciements

Anthropic (Claude), Google Cloud Platform, et les enseignants et élèves qui essuient les plâtres.

---

*Développé avec ❤️ pour faciliter l'apprentissage du français*
