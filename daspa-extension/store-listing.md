# Fiche Chrome Web Store — Daspalecte

Texte de reference de la fiche publiee. **Archive ici pour ne plus se perdre** : le tableau de
bord Web Store est la seule source vivante, mais rien n'y garde l'historique des versions.

## Regle a ne jamais reenfreindre (refus du 2026-08-05, « Yellow Argon »)

La version precedente listait les 11 langues de traduction en toutes lettres
(`Arabic, English, Dari, Spanish, Kurdish, Pashto, Polish, Romanian, Russian, Turkish, Ukrainian`).
Google a refuse l'extension pour **accumulation de mots cles**.

Les trois plafonds de la regle :

- **5 elements maximum** quand on enumere des sites, des marques ou des langues prises en charge
- **5 occurrences maximum** d'un meme mot cle dans la description, meme s'il decrit la fonction
  principale de l'extension
- **aucune information hors sujet** : pas de generalites sur le FLE ou sur l'enseignement

La liste complete des langues a sa place dans une **capture d'ecran promotionnelle** (explicitement
autorise par Google) ou derriere un lien, jamais dans le texte de la fiche.

## Le texte de la fiche

Le titre, la description courte et la description detaillee vivent dans **`store-description.md`**,
prets a coller dans le tableau de bord. Une seule source, pour qu'aucune des deux copies ne
prenne du retard sur l'autre.

La description courte doit etre **reportee a l'identique dans le champ `description` de
`manifest.json`** : c'est ce champ que le Web Store affiche comme resume.

### Ce qui a change par rapport a la fiche refusee

1. **Les 11 langues ne sont plus nommees** — cause directe du refus
2. **Trois passages tronques repares** : la liste des exercices commencait par
   `« sont gén�mille de mots »` (l'exercice 1 avait disparu, avec un caractere corrompu), le mode
   d'emploi sautait des etapes 3 a 5 (`« Choisissez votre langu générez vos exercices »`), et la
   phrase sur les donnees se terminait par `« transmise à des itements »`
3. **Repetitions ramenees sous le plafond** : « traduction » passait une dizaine de fois, « mot »
   plus de quinze — le second motif de la meme regle, que Google n'avait pas encore invoque
4. **Section confidentialite rendue exacte** : la connexion n'est plus annoncee comme facultative
   (decision du 2026-08-04), et « aucune donnee transmise a des tiers » a disparu — c'etait faux,
   les textes partent bien chez Anthropic et Google
5. **Bloc « nouveautes de la version 2.0 » supprime** : il vieillit a chaque publication et n'aide
   pas un lecteur qui decouvre l'extension
6. **`https://github.com/jpbolle/` retire du support** : un profil GitHub n'est pas un canal de
   support pour un eleve

### Verification avant chaque soumission

Comptage reel de `store-description.md` au 2026-08-05 — **aucun mot cle ne depasse le plafond** :

| Mot cle | Occurrences | Plafond |
|---|---|---|
| traduction / traduire | 5 | 5 |
| français / française | 5 | 5 |
| langue(s) | 5 | 5 |
| Daspalecte (nom du produit) | 5 | 5 |
| élève(s) | 5 | 5 |
| lecture / lire / lecteur | 4 | 5 |
| PDF | 4 | 5 |
| terme(s) | 4 | 5 |
| exercice(s) | 3 | 5 |
| DASPA (sigle seul) | 2 | 5 |
| mot(s) | 2 | 5 |

Aucune langue n'est nommee. Aucun site web tiers n'est nomme en dehors de ceux qui traitent
reellement les donnees (obligation de transparence, section confidentialite).

**Attention en recomptant** : `daspa` capture aussi `Daspalecte`, ce qui fait croire a un
depassement inexistant. D'ou le `(?!lecte)` ci-dessous. Commande a relancer depuis
`daspa-extension/` apres toute retouche du texte :

```bash
python3 - <<'PY'
import re, unicodedata
bloc = open('store-description.md').read().split('## Description détaillée')[1]
plat = ''.join(c for c in unicodedata.normalize('NFD', bloc.lower())
               if unicodedata.category(c) != 'Mn')
motifs = {
 'traduction/traduire': r'traduc|traduir', 'lecture/lire': r'lectur|lire|lecteur',
 'exercice(s)': r'exercice', 'francais(e)': r'francais', 'langue(s)': r'langue',
 'DASPA (sigle seul)': r'daspa(?!lecte)', 'Daspalecte': r'daspalecte',
 'PDF': r'pdf', 'mot(s)': r'\bmot', 'eleve(s)': r'eleve',
}
for nom, m in motifs.items():
    n = len(re.findall(m, plat))
    print(f"{nom:30} {n:3}  {'⚠ AU-DESSUS DE 5' if n > 5 else 'ok'}")
PY
```

## Captures d'ecran

C'est la que doit vivre la liste des langues prises en charge : une capture du menu deroulant
« Ma langue », deploye, suffit — elle est descriptive et echappe a la regle sur les metadonnees.

## Objectif unique (onglet Confidentialite)

```
Aider les élèves qui maîtrisent mal le français à comprendre les textes qu'ils doivent lire, sur
une page web comme dans un PDF : traduction des mots, simplification des paragraphes et exercices
de vocabulaire construits à partir des mots rencontrés. Si l'élève se connecte avec son compte
scolaire, ses résultats sont transmis à l'espace enseignant de l'école pour le suivi pédagogique.
Extension à usage interne, distribuée en privé aux seuls élèves de l'établissement.
```

Deux mentions a ne pas retirer, parce que le reviseur croise ce champ avec le reste de l'onglet :

- **le suivi pedagogique** — sans lui, un objectif qui ne collecte rien fait face a quatre cases de
  donnees cochees juste en dessous, et l'incoherence saute aux yeux
- **le PDF** — c'est lui qui justifie une partie de l'acces `<all_urls>`

## Justification des autorisations (onglet Confidentialite)

Chaque texte doit correspondre a ce que le **code** fait reellement : le reviseur lit les deux.
Une justification qui redit le nom de l'autorisation (« activeTab : pour acceder a l'onglet
actif ») est un motif de refus classique.

`activeTab` **a ete retiree du manifeste le 2026-08-05** : `host_permissions: ["<all_urls>"]` et le
content script sur `<all_urls>` couvraient deja tout, y compris `captureVisibleTab`. Le panneau
Google est explicite — « si vous demandez une autorisation superflue, votre version sera refusee ».

### storage

```
Pour conserver localement, dans le navigateur de l'élève : son carnet de vocabulaire, sa langue
d'origine, le thème visuel choisi et l'état des outils. Sert aussi de file d'attente aux résultats
d'exercices en attente d'envoi, afin qu'une coupure réseau — fréquente sur les Chromebooks
scolaires — ne les fasse pas perdre.
```

### tabs

**Ne jamais reduire cette justification a la detection des PDF** : `tabs` sert aussi a
`chrome.tabs.captureVisibleTab` (`background.js:73`, la capture d'ecran) et a lire l'adresse et le
titre de la page joints a chaque evenement (`analytics.js:491`). Un reviseur qui trouve
`captureVisibleTab` dans le code face a une justification qui n'en parle pas conclut a une
dissimulation.

```
Trois usages. Détecter qu'un onglet affiche un PDF, pour proposer de l'ouvrir dans le lecteur
intégré de l'extension. Capturer l'image de l'onglet visible quand l'élève sélectionne une zone à
déchiffrer, ce qui permet de lire un document scanné ou un manuel photographié. Joindre l'adresse
et le titre de la page au résultat d'un exercice, afin que l'enseignant sache sur quel document
son élève a travaillé.
```

### identity

```
Pour permettre à l'élève de se connecter avec son compte Google scolaire et obtenir un jeton
d'accès, afin que ses résultats d'exercices et de tests soient transmis à l'espace de suivi de son
enseignant. L'extension est réservée aux élèves de l'établissement : seuls les comptes inscrits au
préalable par un enseignant sont reconnus, tout autre compte est refusé.
```

### tts

```
Pour lire à voix haute les mots et les phrases en français lorsque l'élève clique sur l'icône de
haut-parleur. Cette synthèse vocale aide les élèves FLE/DASPA à travailler la prononciation.
```

### alarms

```
Pour réessayer périodiquement l'envoi des résultats restés en file d'attente, à raison d'une
vérification par minute. Sans cela, un résultat produit pendant une coupure réseau ne partirait
qu'au prochain démarrage du navigateur — les Chromebooks scolaires perdent souvent la connexion.
```

### Acces a l'hote (`<all_urls>`)

C'est cette declaration qui declenche l'examen approfondi. Elle doit expliquer pourquoi une liste
de domaines ne suffirait pas.

```
Les élèves lisent sur des sites que l'école ne choisit pas : articles de presse, pages
encyclopédiques, manuels en ligne, documents PDF hébergés sur des espaces de stockage. Une aide à
la lecture n'a de sens que si elle fonctionne sur la page que l'élève a devant lui, quelle qu'elle
soit ; la restreindre à une liste de domaines la rendrait inutilisable en classe. Les outils
restent inactifs tant que l'élève ne les active pas depuis le panneau latéral, et aucun contenu
n'est lu ni transmis sans une action explicite de sa part.
```

## Utilisation des donnees (onglet Confidentialite)

A cocher, sans quoi la fiche est mensongere depuis l'ajout de `analytics.js` :

- **Informations personnelles** (adresse e-mail du compte scolaire)
- **Activite de l'utilisateur** (exercices, scores, mots consultes)
- **Contenu du site web** (texte des pages analyse par l'IA)
- **Historique de navigation** — obligatoire : chaque evenement transporte `context: {url, title}`
  et un horodatage, ce qui correspond mot pour mot a la definition de Google

## Code distant

**Non** depuis la version 2.0.1 : les polices sont embarquees dans le paquet. Toute reintroduction
d'une ressource `fonts.googleapis.com`, d'un CDN ou d'un `<script src>` distant ferait repasser la
reponse a « Oui » et rallongerait chaque examen de plusieurs jours.
