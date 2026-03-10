# Daspalecte

Extension Chrome d'aide à la lecture pour les étudiants en Français Langue Étrangère (FLE), spécialement conçue pour les élèves du dispositif DASPA (Dispositif d'Accueil et de Scolarisation des élèves Primo-Arrivants).

![Version](https://img.shields.io/badge/version-1.2-blue)
![Manifest](https://img.shields.io/badge/manifest-v3-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

## Fonctionnalités principales

### 1. Traducteur mot à mot
- **Traduction instantanée** : Cliquez sur n'importe quel mot d'une page web pour obtenir sa traduction
- **10 langues supportées** : Arabe, Anglais, Dari, Espagnol, Pashto, Polonais, Roumain, Russe, Turc, Ukrainien
- **Interface intuitive** : Les traductions apparaissent dans une bulle cyan au-dessus du mot
- **Gestion des ligatures françaises** : Support complet des caractères œ, æ, etc.
- **Protection des liens** : Empêche les clics accidentels sur les hyperliens pendant la traduction
- **Compatible avec la compréhension** : Peut être utilisé simultanément avec l'outil de compréhension

### 2. Gestion de vocabulaire
- **Collection automatique** : Les mots traduits sont ajoutés à une liste personnelle
- **Organisation** : Cases à cocher pour sélectionner et gérer les mots
- **Suppression** : Retirez facilement les mots non pertinents
- **Persistance** : Vos mots sont sauvegardés localement

### 3. Aide à la compréhension (IA)
- **Simplification intelligente** : Boutons magiques (✨) sur les paragraphes de plus de 50 caractères
- **Double aide** :
  - **Résumé** : Une phrase de maximum 30 mots capturant l'idée principale
  - **Reformulation** : Texte complet simplifié avec traductions des mots difficiles
- **Traduction contextuelle** : Mots difficiles traduits entre parenthèses dans votre langue maternelle
- **Propulsé par Claude Sonnet 4.5** : IA de dernière génération pour simplifications et exercices de haute qualité
- **Affichage dynamique** : Activez/désactivez les simplifications à volonté
- **Compatible avec le traducteur** : Les deux outils peuvent être actifs simultanément

### 4. Génération d'exercices
- **5 types d'exercices progressifs** (ordre pédagogique) :
  1. **Associations** : Reliez les mots français à leur traduction
  2. **Famille de mots** : Découvrez les mots de la même famille
  3. **Étiquettes** : Glissez-déposez le bon mot dans la phrase
  4. **Lecture** : Lisez un texte contextuel en français
  5. **Défi final** : Complétez les phrases (texte à trous)
- **Textes en français** : Tous les exercices sont formulés en français (langue à apprendre)
- **Navigation libre** :
  - Boutons "Précédent" et "Suivant" pour naviguer entre les exercices
  - Possibilité de sauter un exercice bloquant
- **Désactivation automatique du traducteur** : Pour éviter les distractions pendant les exercices
- **Vérification automatique** : Validez vos réponses instantanément

## Installation

### Pour les développeurs

1. Clonez le dépôt :
```bash
git clone https://github.com/jpbolle/daspalecte.git
cd daspalecte
```

2. Chargez l'extension dans Chrome :
   - Ouvrez Chrome et allez dans `chrome://extensions/`
   - Activez le "Mode développeur" (coin supérieur droit)
   - Cliquez sur "Charger l'extension non empaquetée"
   - Sélectionnez le dossier `daspalecte`

3. Configuration du backend (optionnel, pour la fonctionnalité IA) :
```bash
cd cloud-function
npm install
# Déployez sur Google Cloud Functions avec votre clé API Claude
```

### Pour les utilisateurs finaux

*L'extension sera bientôt disponible sur le Chrome Web Store.*

## Utilisation

1. **Activer l'extension** : Cliquez sur l'icône Daspalecte dans votre barre d'outils
2. **Ouvrir les outils** : Cliquez sur "Outils de lecture web"
3. **Panneau latéral** : Le panneau apparaît sur le côté droit de votre page

### Mode Traducteur
1. Activez le toggle "Traducteur" dans le panneau
2. Sélectionnez votre langue cible
3. Cliquez sur n'importe quel mot de la page
4. La traduction s'affiche au-dessus du mot
5. Les mots traduits s'ajoutent automatiquement à votre liste

### Mode Compréhension
1. Activez le toggle "Compréhension" dans le panneau
2. Sélectionnez votre langue maternelle
3. Des boutons ✨ apparaissent sur les paragraphes
4. Cliquez pour obtenir une version simplifiée avec traductions

### Exercices
1. Sélectionnez des mots dans votre liste de vocabulaire
2. Cliquez sur "Générer des exercices"
3. Complétez les 5 exercices interactifs
4. Validez vos réponses et progressez

## Structure du projet

```
daspalecte/
├── manifest.json              # Configuration de l'extension (MV3)
├── background.js              # Service worker
├── popup.html/js/css          # Interface popup (icône extension)
├── sidepanel.html/js/css      # Panneau latéral d'outils
├── content.js                 # Script principal (1,209 lignes)
├── content.css                # Styles pour les traductions et UI
├── icon*.png                  # Icônes de l'extension (16-128px)
├── test-ligatures.html        # Page de test pour ligatures françaises
└── cloud-function/            # Backend Google Cloud
    ├── index.js               # Function Claude API
    └── package.json           # Dépendances
```

## Technologies utilisées

### Frontend
- **JavaScript Vanilla** : Pas de frameworks, performances optimales
- **Chrome Extensions API** : Storage, Runtime, Messaging
- **Architecture iframe** : Isolation DOM pour le panneau latéral
- **CSS3** : Animations, glassmorphism, thème cyberpunk néon

### Backend
- **Google Cloud Functions** : Serverless
- **Claude Sonnet 4.5** : Modèle IA de dernière génération (septembre 2025) pour simplifications et exercices
- **Google Translate API** : Traductions mot à mot
- **Google Secret Manager** : Sécurisation des clés API
- **Node.js** : Runtime

### Design
- **Thème** : Neon Cyberpunk
- **Couleurs** : Cyan (#00f3ff) et Violet clair (#e879f9)
- **Polices** : Orbitron (titres), Inter (corps)
- **Effets** : Glow, ombres portées, transitions fluides

## Langues supportées

### Langues de traduction (10 langues)
- Arabe (ar)
- Anglais (en)
- Dari (fa)
- Espagnol (es)
- Pashto (ps)
- Polonais (pl)
- Roumain (ro)
- Russe (ru)
- Turc (tr)
- Ukrainien (uk)

### Langue d'interface et d'apprentissage
- **Français** : Langue cible pour l'apprentissage FLE

## Fonctionnalités techniques

- **Support des ligatures françaises** : œ, æ correctement gérés
- **Protection contre les clics accidentels** : Les liens sont désactivés pendant la traduction
- **Persistance des données** : Chrome Local Storage
- **Cache de traductions** : Évite les requêtes API redondantes
- **Modes compatibles** : Traducteur et Compréhension peuvent fonctionner simultanément
- **Gestion intelligente des exercices** : Désactivation temporaire du traducteur pendant les exercices
- **Responsive** : Optimisé pour différentes tailles d'écran
- **Robustesse** : Gestion des erreurs et fallbacks pour tous les types d'exercices

## Configuration

Les paramètres sont stockés localement via Chrome Storage API :
- `translatorEnabled` : État du traducteur
- `selectedLanguage` : Langue de traduction active
- `comprehensionEnabled` : État du mode compréhension
- `nativeLanguage` : Langue maternelle de l'étudiant

## API Backend

L'extension utilise un backend sécurisé hébergé sur **Google Cloud Run** (région Europe-West1) pour :

**1. Aide à la compréhension** (`summarize`)
- Génère un résumé (max 30 mots) + reformulation complète
- Ajoute des traductions entre parenthèses pour les mots difficiles
- Retour JSON : `{summary: "...", reformulation: "..."}`

**2. Génération d'exercices** (`generate_exercises`)
- Crée 5 exercices progressifs en français
- Types : matching, family, tags, reading, cloze
- Adapté au niveau FLE avec traductions d'aide

**Note** : L'URL de l'endpoint n'est pas publique pour éviter les abus et protéger les quotas API.

## Développement

### Prérequis
- Google Chrome 88+
- Node.js 16+ (pour le backend)
- Compte Google Cloud (pour déploiement backend)
- Clé API Claude (Anthropic)

### Tests
Utilisez `test-ligatures.html` pour tester le support des ligatures françaises.

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
1. Forker le projet
2. Créer une branche (`git checkout -b feature/amelioration`)
3. Commiter vos changements (`git commit -m 'Ajout fonctionnalité'`)
4. Pousser vers la branche (`git push origin feature/amelioration`)
5. Ouvrir une Pull Request

## Auteur

**PedagokIT**

## Licence

MIT License - voir le fichier LICENSE pour plus de détails

## Remerciements

- Anthropic (Claude API)
- Google Cloud Platform
- Tous les enseignants FLE et étudiants DASPA

---

## Objectifs à venir

### Lecture de PDF en ligne
- **Support des PDF** : Permettre l'utilisation de tous les outils (traducteur, compréhension, exercices, test de lecture) sur les PDF ouverts dans le navigateur
- **Extraction de texte** : Récupérer le contenu textuel des PDF pour l'analyser

### Interface améliorée
- **Adaptation par niveau** : Choix du niveau CECR (A1 à C2) pour adapter la complexité des exercices et simplifications

### Fonctionnalités pédagogiques
- **Historique d'apprentissage** : Suivi des mots appris et des exercices complétés
- **Révisions espacées** : Système de répétition pour mémorisation à long terme
- **Statistiques de progression** : Tableaux de bord pour élèves et enseignants

---

*Développé avec ❤️ pour faciliter l'apprentissage du français*
