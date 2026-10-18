# Design System Myco — Direction B + C

## Décisions

- Polices : **Inter** (texte), **JetBrains Mono** (chiffres)
- Rayons : `rounded-lg` (12px) pour les cartes, `rounded-md` (8px) pour les boutons
- Mode sombre : reporté
- Navigation mobile : bas de l'écran (4 onglets : Carte, Coins, Tableau, Compte)
- Panneaux : modales classiques (pas de bottom sheets)

## Palette

### Primaire (vert signal)
`primary-50` à `primary-900`. Utilisée pour : CTA, liens actifs, badges positifs.
Bouton principal : `primary-600` (#16a34a), hover `primary-700` (#15803d).

### Sage (vert doux)
`sage-50` à `sage-900`. Utilisée pour : badges comestibilité bonne, écrans pédagogiques.

### Neutres chauds
`neutral-50` à `neutral-900`. Pas de gris pur : teinte légèrement chaude.

### Dangers et alertes
- `danger-600` (#dc2626) : erreurs, suppressions, comestibilité toxique
- `danger-700` (#b91c1c) : badge MORTEL en fond plein
- `warning-600` (#ca8a04) : avertissements ANSES, statuts en attente
- `info-600` (#0284c7) : géoloc, partages, informations

## Typographie

- `text-xs` (12px) : badges, mentions légales
- `text-sm` (14px) : labels, texte secondaire
- `text-base` (16px) : corps
- `text-lg` (18px) : sous-titres
- `text-xl` (20px) : titres de carte
- `text-2xl` (24px) : titres de section
- `text-3xl` (30px) : titres de page
- `text-5xl` (48px) : chiffres dashboard

## Espacements

Échelle 4px : `space-1` (4px) jusqu'à `space-16` (64px).
Sur mobile, +1 cran : un `space-4` devient `space-5`.

## Rayons

- `rounded-sm` (4px) : badges, inputs compacts
- `rounded-md` (8px) : boutons, inputs
- `rounded-lg` (12px) : **cartes principales**
- `rounded-xl` (16px) : modales
- `rounded-2xl` (24px) : grandes cartes / hero

## Ombres

- `shadow-sm` : cartes discrètes
- `shadow` : standard
- `shadow-md` : cartes interactives
- `shadow-lg` : modales
- `shadow-xl` : éléments flottants

Éviter `shadow-md+` sur mobile (batterie) — utiliser des bordures.

## Composants disponibles

Base : `Button`, `Input`, `Textarea`, `Label`, `Card`, `Badge`, `Separator`.
À ajouter plus tard : `Dialog`, `AlertDialog`, `Toast`, `Tabs`, `Dropdown`, `Tooltip`, `Select`, `Checkbox`, `Skeleton`.

## Layouts

- **Desktop (≥ 1024px)** : conteneur `container-page`, max-width 1100px, padding 32px
- **Tablette (640-1023px)** : padding 24px, grilles 2 colonnes
- **Mobile (< 640px)** : conteneur `container-page-mobile`, padding 16px, pb-24 pour la nav basse

## Règles mobiles

- Boutons : hauteur min 48px (`size="lg"` ou `size="xl"`)
- Zones de tap : 44×44px minimum
- Font-size inputs : 16px minimum (empêche zoom iOS)
- Modales : plein écran avec bouton retour
- Navigation en bas, 4 onglets max
- Toasts : en bas, au-dessus de la navbar

## Accessibilité

- Contraste WCAG AA minimum (4.5:1)
- Badges de danger en AAA (7:1)
- Focus visible (ring 2px primary-600)
- Navigation clavier complète
- `aria-label` sur les icônes seules
- `prefers-reduced-motion` respecté

## Conventions de code

- Composants : `src/components/ui/` (génériques), `src/components/` (métier)
- Hooks : `src/hooks/`
- Utilitaires : `src/lib/`
- Styles globaux : `src/styles.css` (Tailwind layers + classes customisées)
