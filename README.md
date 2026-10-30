# Générateur de témoin lumineux

Génère des **témoins lumineux encastrables**, imprimables en 3D, pour
n'importe quel projet : une légende qui s'allume derrière une fenêtre, dans
un cadre qui se monte dans la découpe d'un panneau, comme un voyant ou un
annonciateur de tableau de bord.

**Page en ligne : <https://docteurzoidberg.github.io/generateur-temoin-lumineux/>**
(tout se calcule dans le navigateur, sans serveur ; marche hors ligne une
fois chargée).

> **État (31/10/2026) : v1 utilisable.** La page, la commande `temoin` et
> le skill Claude Code produisent les mêmes fichiers depuis un preset. Les
> pièces sont celles d'impressions d'essai validées, en vis M3 ; la v1 ne
> règle que ce qui a été éprouvé. Feuille de route : [PLAN.md](PLAN.md).

## Le témoin

```text
Coupe, vue de dessus : avant à gauche, mur à droite

         cadre  panneau      boîte à lumière + bride
        ┌──────┬────────┬───────────────────────────┐
  vis ══╪══════╪════════╪══▓▓ insert                │
        │      ├────────┤                           │
        │   ┌──┴────────┴──────────────────────┐    │
        │   █                                ● │    │
        │   █ légende        lumière         ● │    │  LED
        │   █                                ● │    │
        │   └──┬────────┬──────────────────────┘    │
        │      ├────────┤                           │
  vis ══╪══════╪════════╪══▓▓ insert                │
        └──────┴────────┴───────────────────────────┘
          ▲        ▲
          │        └ découpe du panneau, traversée par le tube
          └ lèvre du cadre : la légende s'y appuie
```

| Pièce | Rôle |
| --- | --- |
| **Cadre** | collerette visible en façade ; sa lèvre borde la fenêtre et retient la légende |
| **Légende** | plaquette mince multi-filament : masque opaque, lettres translucides, voile diffuseur derrière. Seule pièce à réimprimer pour changer de texte |
| **Boîte à lumière** | tube qui traverse le panneau et plaque la légende contre la lèvre, bride qui serre le panneau par l'arrière, logement du ruban de LED |
| **Fond** | ferme le logement au dos de la boîte et porte le ruban, clipsé ; emboîté en serrage, il se retire au tournevis ; fente pour la nappe des fils |

Il faut aussi 2 vis M3 et 2 inserts à chaud, et un tronçon de ruban
WS2812B à 144 LED/m. Le panneau ne demande qu'une découpe et 2 trous. Le
tube a la longueur de l'épaisseur du panneau : c'est le seul réglage qui
dépend du panneau, qu'il soit imprimé, en tôle ou en bois. Un panneau
d'essai, imprimable, permet de monter le témoin avant de percer le vrai.

## La page

- **Réglages** du preset, contrôlés à chaque saisie : ce qui ne
  s'imprimera pas ou ne tiendra pas est signalé, avec le montage (découpe,
  vis, LED).
- **Aperçu** 3D (pièces éclatées ou assemblées, masquables) ou vue de
  face, avec la lumière simulée : éteinte, fixe, respiration ou
  clignotement, dans la couleur de son choix.
- **Presets** : ouvrir un fichier (ou le glisser sur la page), l'enregistrer,
  partir d'un exemple ; le lien de la page porte le preset.
- **Télécharger** le zip des fichiers d'impression, les mêmes que ceux de
  `temoin generate`.

## Le preset

Un témoin est décrit par un fichier JSON, par exemple
[`presets/alarme.json`](presets/alarme.json) :

```json
{
  "version": 1,
  "legend": { "text": "ALARME", "background": "#111111" },
  "window": { "width": 27, "height": 10.5 },
  "frame": { "width": 47, "height": 18, "color": "#4b5320" },
  "panel": { "thickness": 3 },
  "mount": { "head": "countersunk" },
  "light": { "wireExit": "left" }
}
```

Seuls `legend.text` et `panel.thickness` sont obligatoires ; cotes en mm.
Toutes les clés, leurs valeurs par défaut et les contrôles :
[docs/generateur.md](docs/generateur.md). JSON Schema :
[`presets/schema.json`](presets/schema.json).

## Ce que produit le générateur

| Fichier | Contenu |
| --- | --- |
| `<nom>_<impression>.3mf` | un par impression (légende, cadre, boîte et fond, panneau d'essai) ; pièces orientées, une par couleur, à trancher dans le logiciel de son choix |
| `<nom>_<pièce>.stl` | une par pièce, orientée comme dans les 3MF |
| `<nom>.step` | assemblage nommé et coloré, pour intégrer le témoin dans un projet (Fusion, FreeCAD) |
| `<nom>.json` | le preset utilisé, valeurs par défaut comprises |

La quincaillerie (longueur des vis, inserts, LED) et les cotes de la
découpe sont dans le résumé de la page et de la commande. Fichiers
identiques d'une génération à l'autre.

## En local

Node 22.18 ou plus.

```bash
git clone https://github.com/docteurzoidberg/generateur-temoin-lumineux.git
cd generateur-temoin-lumineux
npm install
npm run web          # la page, servie par Vite (http://localhost:5173)
```

```bash
npm run typecheck
npx playwright-core install --only-shell chromium   # Chromium headless des tests de la page
npm test
npm run build -w @temoin/web                        # page construite dans web/dist
```

`npm install` active aussi un hook git (`.githooks/pre-push`) : avant chaque
push, il lance le typecheck et tous les tests, et bloque le push s'ils
échouent. L'action GitHub, elle, ne fait que construire et publier la page.

### Ligne de commande

```bash
(cd cli && npm link)                       # installe la commande temoin
temoin check presets/alarme.json           # contrôles seuls, rien n'est écrit
temoin generate presets/alarme.json        # fichiers dans presets/export/
```

```text
Témoin « alarme » (presets/alarme.json)
✓ légende « ALARME » : capitales de 5,36 mm, à 1,50 mm du bord de la fenêtre
⚠ espaces du masque plus fins que la buse : 0,05 mm² en x = -10,4, …
✓ vis M3 × 10 (tête fraisée, ISO 10642)
✓ 4 LED dans la fenêtre
  …
  panneau : découpe 29,8 × 13,3, 2 trous Ø 3,4 à 37 d'entraxe, centrés sur la fenêtre
```

`--json` donne le même résultat pour un script ; code de sortie 0 si le
preset est bon (avertissements possibles), 1 s'il est refusé.

### Skill Claude Code

Le skill `temoin-lumineux` fait la même chose depuis n'importe quel projet,
qui garde son preset dans `design/temoin/<nom>.json` : « génère le témoin »,
« vérifie le témoin », « fais un témoin ARMÉ, panneau de 3 mm ».

```bash
ln -s "$PWD/skill" ~/.claude/skills/temoin-lumineux   # depuis le dépôt cloné, après npm link
```

Mode d'emploi : [docs/skill.md](docs/skill.md).

## Plus tard

Chaque réglage viendra après une impression d'essai : légende sur 2 lignes,
autres polices, mode négatif (fond lumineux), vis M2 et M2,5, écrous
prisonniers, autres rubans et LED, cloisons et zones, réglages de
l'imprimante (buse, couche). Et aussi : gabarit de découpe à imprimer,
nomenclature en fichier, coupe 3D dans la page, estimation de l'uniformité
de l'éclairage. Détail : [PLAN.md](PLAN.md) et
[docs/generateur.md](docs/generateur.md).

## Hors périmètre

- **Visières, casquettes, capots, supports** : ils dépendent de chaque objet
  et restent dans le projet hôte, dessinés autour du STEP du témoin.
- **Électronique et firmware** : le générateur indique les LED et le passage
  des fils, il ne pilote rien.
- **Modèle paramétrique dans un logiciel de CAO** : il reçoit des STEP
  générés ; les réglages vivent dans le preset.
- **Tranchage** : les 3MF sont génériques, chacun tranche avec son logiciel.

## Organisation du dépôt

```text
PLAN.md     feuille de route, décisions, vocabulaire
docs/       plan et spécification du générateur, mode d'emploi du skill
core/       noyau (TypeScript) : preset, légende, pièces, contrôles, exports
cli/        ligne de commande temoin (check, generate)
skill/      skill Claude Code temoin-lumineux
web/        page web (Vite) : le noyau dans des Web Workers, sans serveur
presets/    presets d'exemple et JSON Schema du preset
fonts/      polices libres fournies (OFL)
.github/    action qui contrôle, construit et publie la page (GitHub Pages)
```

## Licences

Ce dépôt (code, docs, presets, fichiers de référence des tests), © 2026
DrZoid : **WTFPL**, version 2 ([LICENSE](LICENSE)). Il vient sans aucune
garantie, dans la mesure permise par la loi applicable ; chacun peut le
redistribuer et le modifier selon les termes de la Do What The Fuck You
Want To Public License, version 2 (<https://www.wtfpl.net/>).

Elle ne s'applique pas à ce qui vient d'ailleurs : ses dépendances, libres,
et ses polices gardent leur licence, que la page cite dans son pied de
page et dans `licences.txt`, avec le texte de chacune. Elles autorisent
cette licence pour notre code : OpenCascade (LGPL) reste un fichier à part,
remplaçable, avec ses sources citées ; les polices restent sous OFL, avec
leur texte (`fonts/OFL-Barlow.txt`).

- **OpenCascade** (Open CASCADE Technology, par `replicad-opencascadejs`) :
  LGPL 2.1. Compilé en WebAssembly, il reste un fichier `.wasm` à part.
  Sources : [OCCT](https://github.com/Open-Cascade-SAS/OCCT) et
  [replicad-opencascadejs](https://github.com/sgenoud/replicad/tree/main/packages/replicad-opencascadejs).
- Polices **Barlow Condensed** (`fonts/`) et **B612** : SIL Open Font
  License 1.1.
- three.js, replicad, opentype.js, zod, fflate : MIT ; flatbush : ISC ;
  clipper-lib : Boost.

## Origine

C'est le voyant « annonciateur » V5 du Claudemètre, rendu générique. Le
Claudemètre en est le premier utilisateur, mais l'outil n'en dépend pas.
Les cotes viennent d'une maquette Fusion 360, gardée dans un dépôt à part ;
ses sorties de référence (STL, contours de la légende) sont dans
`core/test/ref/`, où les tests du noyau les comparent à ses pièces.
