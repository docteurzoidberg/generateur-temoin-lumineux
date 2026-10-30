# Spécification du générateur (étapes 3 à 5)

Ce que fait l'outil. Comment il se construit (ordre, pile, dossiers, lots) :
[plan-generateur.md](plan-generateur.md) ; vocabulaire des pièces :
[PLAN.md](../PLAN.md). Codé : le preset (`core/src/preset.ts`), la mise en page de la légende
(`core/src/legend.ts`), les cotes (`core/src/dims.ts`), les pièces
(`core/src/parts.ts`), les exports (`core/src/exports.ts`), les contrôles
(`core/src/checks.ts`, `core/src/generate.ts`) et la ligne de commande
(`cli/`).

## Preset (réglages de la v1)

Le contrat entre la ligne de commande, le skill et la page, versionné
(`"version": 1`), figé le 30/10/2026 : schéma zod dans
[`core/src/preset.ts`](../core/src/preset.ts), JSON Schema dans
[`presets/schema.json`](../presets/schema.json) (`npm run schema`). Exemple
complet : [`presets/alarme.json`](../presets/alarme.json). Cotes en mm.

**La v1 ne règle que ce qui a été validé à l'impression** (décision du
30/10/2026) : un prototype fonctionnel vite, sans fonction non éprouvée.

| Clé | Réglage | Par défaut |
| --- | --- | --- |
| `legend.text` | texte, sur une ligne | obligatoire |
| `legend.background` | couleur du fond de la légende (masque) | noir `#111111` |
| `window.width`, `window.height` | fenêtre, partie visible de la légende | 27 × 10,5 |
| `frame.width`, `frame.height` | cadre | 47 × 18 |
| `frame.color` | couleur du cadre | noir `#111111` |
| `panel.thickness` | épaisseur du panneau hôte (= longueur du tube) | obligatoire |
| `mount.head` | `countersunk` (fraisée) ou `socket` (cylindrique) | `countersunk` |
| `light.wireExit` | sortie des fils, vue de face : `left` ou `right` | `left` |

- **Clé inconnue refusée** (faute de frappe, ou réglage hors v1) ; erreurs
  en lignes « chemin : message », par exemple `mount.head : Option
  invalide : une valeur parmi "countersunk"|"socket" attendue`.
- **Évolution** : ajouts compatibles en v1 ; changer une clé ou une valeur
  par défaut fait passer en v2, avec une migration.
- **Couleurs** : elles servent à l'aperçu et au 3MF ; le filament réel
  (matière, couleur) se choisit au tranchage, hors du générateur.

Fixé dans le noyau en v1 (valeurs des impressions validées, reprises du
preset et du script `temoin.py` de la maquette Fusion) :

| Sujet | Valeur |
| --- | --- |
| Légende | police Barlow Condensed SemiBold ; capitales « auto » (la plus grande à 1,5 mm du bord de la fenêtre) ; interlettrage 0,12 de la capitale ; lettres lumineuses (mode positif) ; masque et lettres 0,8, voile 0,6 |
| Fenêtre et cadre | coins de la fenêtre vifs ; cadre rectangulaire, épaisseur 2,5, rayon 1,5, lèvre 1, chanfreins 0,3 (bord) et 0,4 (fenêtre) |
| Jeux | 0,2 par côté (découpe, feuillure, logement) ; fond tenu en serrage de 0,3 |
| Fixation | 2 vis M3 (ISO 10642 ou ISO 4762) et 2 inserts à chaud M3 (perçage Ø 4, longueur 4) ; vis centrées entre la fenêtre et le bord du cadre ; longueur de vis calculée ; tête cylindrique (pas encore imprimée) : perçage droit, tête posée sur la façade |
| Lumière | ruban WS2812B 5 V à 144 LED/m (pas 6,94, circuit 12 × 0,5, LED 5050), coupé après chaque LED ; nombre = largeur de la fenêtre / pas, arrondi (4 pour 27) ; face des LED à 10 mm de la légende ; ruban clipsé sur le fond |
| Couleurs | boîte et fond noirs ; lettres et voile blancs translucides |
| Panneau d'essai | 60 × 40 avec sa découpe et ses 2 trous, agrandi avec le cadre (marges de 6,5 et 11) |
| Contrôles | buse de 0,4 |

Plus tard, chacun après une impression d'essai : 2 lignes, autres polices
et import TTF/OTF, hauteur des capitales et interlettrage réglables, mode
négatif ; coins de fenêtre arrondis, cadre rond, épaisseur et lèvre ; vis
M2 et M2,5, écrous, collage, entraxe choisi ; autres rubans, LED seules,
zones, profondeur ; filaments et nombre de têtes ; états et effets de
l'aperçu (étape 5).

## Contrôles (calculés en direct)

Codés dans [`core/src/checks.ts`](../core/src/checks.ts), avec
`core/src/generate.ts` : ✓, avertissement (⚠, n'empêche pas la génération) ou
erreur (✗, rien n'est écrit), dans la ligne de commande comme dans la page ;
chacun porte un code stable pour le skill. Buse de 0,4 ; parois d'au moins
2 largeurs de buse (0,8).

| Code | Contrôle | ⚠ sous | ✗ sous |
| --- | --- | --- | --- |
| `preset` | preset valide (une ligne par erreur) | | toute erreur |
| `legend` | caractères présents dans la police ; capitales et marge | | caractère absent |
| `legend.strokes` | traits plus fins que la buse (ouverture morphologique, comme `legende_dxf.py`) | une zone | |
| `legend.gaps` | espaces du masque plus fins que la buse, dans la fenêtre | une zone | |
| `legend.islands` | îlots du masque (A, D, O, R…), tenus par le voile | | |
| `mount.overlap` | débord du cadre autour de la découpe | 1,5 | 0,8 |
| `mount.bridge` | panneau entre la découpe et chaque trou de vis | 1,5 | 0 |
| `mount.head` | fraisure ou tête de vis : distance au bord du cadre et à la fenêtre | 0,8 | 0 |
| `mount.insert` | paroi entre l'insert et la cavité de la boîte | | 0,8 |
| `mount.boss` | bossages des inserts hors du cadre | dépassement | |
| `mount.frame` | si un contrôle de montage échoue : plus petit cadre qui passe, au demi-millimètre (la correction à proposer) | | |
| `screw` | une vis M3 du commerce convient (pointe à 0,3 mm du fond du perçage, au moins 60 % de l'insert en prise) | | aucune |
| `light.leds` | LED extrêmes dans la fenêtre | dépassement | |

ALARME (impression validée) : un seul avertissement, `legend.gaps`, avec
les 4 mêmes zones que la maquette ; elles n'ont pas gêné l'impression.

Plus tard : uniformité de l'éclairage estimée (LED lambertiennes à la
profondeur de la boîte) ; le modèle simple donne 39 % pour ALARME, qui
éclaire bien : il faut d'abord le recaler sur photos.

## Page web

Disposition recalée sur le preset v1 (30/10/2026) ; valeurs d'ALARME.
Lots : [plan-generateur.md](plan-generateur.md), « Étape 5 ».

```text
┌─ Témoin lumineux ─────────── Ouvrir · Exemples · Enregistrer · Lien ─┐
│ ┌─ Réglages ─────────────┐ ┌─ Aperçu ──────────────────────────────┐ │
│ │ Nom        alarme      │ │    ┌─────────────────────────────┐    │ │
│ │ Texte      ALARME      │ │    │ ○  ┌───────────────────┐  ○ │    │ │
│ │ Fond       ■ #111111   │ │    │    │       ALARME      │    │    │ │
│ │ Fenêtre    27 × 10,5   │ │    │    └───────────────────┘    │    │ │
│ │ Cadre      47 × 18     │ │    └─────────────────────────────┘    │ │
│ │ Couleur    ■ #111111   │ │                                       │ │
│ │ Panneau    3 mm        │ │ 3D · face      lumière : fixe · ambre │ │
│ │ Tête       fraisée  ▼  │ │ assemblé ─────●───── éclaté           │ │
│ │ Fils       à gauche ▼  │ ├─ Contrôles ───────────────────────────┤ │
│ └────────────────────────┘ │ ✓ légende : capitales de 5,36 mm      │ │
│ ┌─ Montage ──────────────┐ │ ⚠ 4 espaces du masque < buse          │ │
│ │ découpe 29,8 × 13,3    │ │ ✓ montage, vis M3 × 10, 4 LED         │ │
│ │ 2 trous Ø 3,4 à 37     │ ├─ Télécharger ─────────────────────────┤ │
│ │ 2 vis M3 × 10 fraisées │ │ zip (12 fichiers) · 3MF · STL · STEP  │ │
│ │ 2 inserts M3, Ø 4      │ └───────────────────────────────────────┘ │
│ │ 4 LED, ruban 27,8 mm   │                                           │
│ └────────────────────────┘                                           │
└──────────────────────────────────────────────────────────────────────┘
```

- **Réglages** : les 8 clés du preset v1, et le nom des fichiers (celui du
  preset ouvert, comme `temoin`, sinon le texte en minuscules). Contrôles et
  montage recalculés à chaque saisie, avec les lignes de `temoin check` ;
  une erreur du preset est aussi montrée sous son champ, et bloque le
  téléchargement.
- **3D**, vue par défaut (recalculée après une pause de saisie, chaque
  pièce seulement si ses réglages changent) : les 6 pièces imprimées,
  éclatées ou assemblées, quatre points de vue, pièces masquables dont le
  panneau d'essai. Visionneuse tirée de la vue éclatée de la maquette, sans sa
  quincaillerie (vis, inserts, ruban), absente du noyau.
- **Face** (2D, immédiate) : cadre, fenêtre, lettres et vis aux couleurs du
  preset.
- **Lumière** simulée, commune aux deux vues : éteinte, fixe, respiration
  (3 s) ou clignotement (1 Hz), dans une couleur du ruban (blanc, ambre,
  rouge, vert, bleu, ou au choix). Lettres de la couleur de la lumière, un
  peu plus blanches au cœur, avec un halo, plus retenu pour les couleurs
  claires ; éteinte, le blanc du voile. Réglage de la page, hors preset :
  le projet hôte pilote ses LED. Lueur égale sur toutes les lettres, sans
  modèle d'éclairage ; effets fixes si le système réduit les animations.
- **Presets** : ouvrir un JSON (choisi ou glissé sur la page, par exemple le
  preset d'un projet hôte, pour voir son aperçu), l'enregistrer, preset dans
  l'URL, exemples. Pas de `temoin preview` : la page est la visionneuse.
  Un preset ouvert est contrôlé tel quel, comme par `temoin check`, jusqu'à
  la première saisie ; le formulaire garde ensuite les valeurs fausses de
  ses champs jusqu'à leur saisie et abandonne les clés inconnues. Nom des
  fichiers : celui du fichier ouvert ou du lien ; un exemple repart du
  texte. Enregistrer donne le `<nom>.json` de `temoin generate` (valeurs par
  défaut comprises, sans `$schema`), et seulement pour un preset valide. Le
  lien porte le preset dans le fragment de l'URL, jamais envoyé au serveur :
  `#name=claude&version=1&legend.text=CLAUDE&…&light.wireExit=left`, tenu à
  jour à chaque saisie.
- **Télécharger** : les fichiers de `temoin generate` (voir « Sorties »),
  identiques, en un zip ; calculés au clic.
- **Thème** clair ou sombre : celui du système par défaut, bouton « Sombre »
  dans l'en-tête pour changer, choix gardé dans le navigateur.
- **Hors ligne** une fois chargée (service worker de la page construite,
  pas en développement).
- **Licences** en pied de page : OpenCascade (LGPL 2.1, fichier `.wasm` à
  part, lien vers ses sources), polices Barlow Condensed et B612 (OFL), et
  `licences.txt` avec le texte de chaque licence.
- Plus tard : coupe, zones fines surlignées, lueur selon le modèle
  d'uniformité, et les réglages hors v1.

## Sorties

| Fichier | Contenu |
| --- | --- |
| `<nom>_<impression>.3mf` | 3MF génériques, un par impression : `legende` (un objet de 2 pièces, masque et voile, à charger ensemble), `cadre`, `boite_fond`, `panneau_essai` ; pièces orientées, une par couleur ; à trancher dans le logiciel de son choix |
| `<nom>_<pièce>.stl` | `cadre`, `legende_masque`, `legende_voile`, `boite`, `fond`, `panneau_essai`, orientés et posés comme les 3MF |
| `<nom>.step` | assemblage nommé et coloré (cadre, masque, voile, boite, fond), solides exacts dans le repère du témoin |
| `<nom>.json` | le preset utilisé, valeurs par défaut comprises |

Fichiers identiques d'une génération à l'autre. Plus tard, chacun après
validation : gabarit de découpe (SVG, DXF, PDF à l'échelle 1), nomenclature
en fichier ; en v1, la quincaillerie est dans le résumé de la commande.

Repère du STEP : origine au centre de la fenêtre, sur le
plan du panneau (dos du cadre), X à droite, Z en haut, +Y vers l'arrière ; un
projet hôte place le témoin sans rotation.

Tranchage hors périmètre : aucun réglage propre à un logiciel de tranchage
(Snapmaker Orca compris) ; un projet hôte qui veut trancher a son propre skill.

## Ligne de commande (étape 3) et skill (étape 4)

Codée dans `cli/bin/temoin.ts` ; installée pour tous les projets par
`cd cli && npm link` (fait le 30/10/2026, Node 22.18 sous nvm : à refaire
après un changement de version de Node) ; sinon, depuis ce dépôt :
`node cli/bin/temoin.ts …` ou `npm run temoin -- …`.

```bash
temoin check presets/alarme.json             # contrôles et résumé, rien n'est écrit
temoin check presets/alarme.json --json      # le même en JSON, pour le skill
temoin generate presets/alarme.json          # fichiers dans export/, à côté du preset
temoin generate presets/alarme.json -o out/  # ailleurs
```

- `<nom>` = nom du fichier preset sans `.json` ; code de sortie 0 (bon),
  1 (preset faux ou contrôle en erreur, rien n'est écrit), 2 (mauvais usage).
- Résumé : contrôles (✓, ⚠, ✗), vis (longueur calculée) et inserts, ruban
  (nombre de LED, tronçon), cotes, découpe et trous à percer dans le panneau
  (entraxe), fichiers écrits ; environ 3,5 s. En JSON : `{ name, ok, checks,
  summary, out, files }`, cotes du résumé arrondies au µm.

Skill global `temoin-lumineux` (source dans `skill/`, liée depuis
`~/.claude/skills/temoin-lumineux` ; mode d'emploi : [skill.md](skill.md)),
court, le calcul restant dans l'outil :

1. trouver le preset du projet courant, ou en créer un depuis un exemple en
   posant les questions qui manquent ;
2. `temoin check --json`, puis `temoin generate` vers le dossier d'export du
   projet ;
3. résumer contrôles, nomenclature et fichiers écrits ;
4. sur demande : intégrer le témoin dans le design hôte
   (import du STEP avec un skill Fusion 360, découpe et trous d'après le
   gabarit).

Exemple : depuis le Claudemètre, « génère le témoin du claudemètre » →
preset `design/temoin/claude.json`, fichiers dans `design/temoin/export/`.
