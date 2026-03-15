---
name: design-classica
description: Charte graphique et style visuel Classica de Daspalecte. Use when adding or modifying UI components, CSS, or styles in the extension. Ensures consistency with the warm, cream-based, classic aesthetic (Playfair Display, green #2d6a5a, gold #d4944c).
---

# Charte graphique Classica — Daspalecte

Le thème **Classica** est un style épuré, tons chauds, fond crème. À utiliser pour toute modification visuelle de l'extension Daspalecte.

## Couleurs principales

| Token | Valeur | Usage |
|-------|--------|-------|
| `--t-primary` | `#2d6a5a` | Vert principal, titres, boutons primaires |
| `--t-accent` | `#d4944c` | Or/doré, accents, traductions, bordures secondaires |
| `--t-bg` | `#faf6f0` | Fond crème |
| `--t-bg-card` | `#ffffff` | Cartes, panneaux |
| `--t-bg-element` | `#f0ebe3` | Éléments interactifs |
| `--t-text` | `#3d3832` | Texte principal |
| `--t-text-secondary` | `#5a534b` | Texte secondaire |
| `--t-text-muted` | `#8a7f72` | Texte atténué |
| `--t-border` | `#d5cec4` | Bordures légères |

## Polices

- **Titres** : `'Playfair Display', Georgia, serif`
- **Corps** : `'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif`

## Style général

- **Épuré** : pas de glow, pas de glassmorphism excessif
- **Ombres douces** : `0 2px 8px rgba(0,0,0,0.08)` — jamais de glow néon
- **Border radius** : 4px (sm), 4px (default), 8px (lg)
- **Letter spacing** : titres 1px, boutons 2px

## Variables CSS à privilégier

Toujours utiliser les variables `--t-*` définies dans `themes.css` :

```css
/* Bon */
color: var(--t-primary);
background: var(--t-bg-card);
border: 1px solid var(--t-border);

/* Mauvais — valeurs en dur */
color: #2d6a5a;
```

## Styles inline (content.js)

Pour les styles dynamiques, utiliser `getThemeColors()` qui retourne pour Classica :

```javascript
{
  primary: '#2d6a5a',
  primaryHover: '#357a68',
  accent: '#d4944c',
  bg: '#faf6f0',
  bgCard: '#ffffff',
  text: '#3d3832',
  shadow: '0 2px 8px rgba(0,0,0,0.1)',
  shadowHover: '0 2px 12px rgba(0,0,0,0.15)',
  primaryAlpha20: 'rgba(45, 106, 90, 0.2)',
  primaryAlpha30: 'rgba(45, 106, 90, 0.3)',
  primaryAlpha50: 'rgba(45, 106, 90, 0.5)',
}
```

## Éléments spécifiques Classica

- **Bouton magique** : bordure verte, hover fond `#e8f0ee`, ombre douce
- **Bulle de traduction** : fond blanc, texte vert
- **Bouton speak** : vert avec icône, pas de glow
- **Toggle** : piste verte `#2d6a5a`, pastille blanche
- **Mots de vocabulaire** : bordure gauche or `#d4944c` pour la traduction

## À éviter en Classica

- Effets `box-shadow` avec glow cyan/violet
- Couleurs néon (#00f3ff, #e879f9)
- Fond sombre
- Glassmorphism opaque
- `letter-spacing` très large (cyberpunk)

## Fichiers de référence

- `themes.css` — lignes 122–234 : définition complète des variables Classica
- `content.js` — `getThemeColors()` lignes 41–56
- `popup.css` — `.theme-preview-classica` pour exemples de composants
