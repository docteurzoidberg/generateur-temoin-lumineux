# Plan du générateur (étapes 3 à 5)

Mise à jour : 30/10/2026. Comment construire le générateur : ordre, pile,
découpage, lots et critères de fin. Feuille de route, décisions et
vocabulaire : [PLAN.md](../PLAN.md) ; ce que fait l'outil (preset,
contrôles, page, sorties, ligne de commande) : [generateur.md](generateur.md) ;
skill : [skill.md](skill.md). Étapes 3 et 4 faites le 30/10/2026.

## Ordre (décidé le 30/10/2026)

D'abord générer des témoins depuis les autres projets, la page web ensuite.
Le noyau sert aux deux ; la ligne de commande est l'interface la moins
coûteuse, et le Claudemètre éprouve le preset sur un vrai cas avant qu'une
page ne le fige.

| Étape | Livrable | Terminée quand |
| --- | --- | --- |
| 3 | noyau `core/`, ligne de commande `cli/` | le preset `alarme` redonne les pièces de la maquette (parité) ; `temoin check` et `generate` marchent *(fait le 30/10/2026)* |
| 4 | skill global `skill/` | le témoin du Claudemètre est généré depuis son dépôt *(fait le 30/10/2026)* |
| 5 | page web `web/` | réglages ou preset ouvert, aperçu et téléchargements, hors ligne ; pour un même preset, mêmes fichiers que la ligne de commande |

La v0 du skill sur les scripts Fusion, envisagée, est abandonnée. `temoin
preview` aussi (30/10/2026) : la commande sert surtout au skill et aux
projets hôtes, qui ne regardent pas de page ; pour voir un témoin, on ouvre
son preset dans la page web (ou son STEP dans Fusion).

**Prototype fonctionnel d'abord** (décision du 30/10/2026) : la v1 ne règle
que ce qui a été validé à l'impression ; le reste est fixé dans le noyau aux
valeurs de la maquette (liste : [generateur.md](generateur.md), « Preset »).
Chaque réglage ajouté ensuite passe d'abord par une impression d'essai.

## Architecture

```text
projets hôtes (Claudemètre)                  un humain
             │                                   │
   ┌─────────▼──────────┐              ┌─────────▼──────────┐
   │ skill global       │              │ page web statique  │
   │ temoin-lumineux    │              │ réglages, aperçu,  │
   └─────────┬──────────┘              │ téléchargements    │
   ┌─────────▼──────────┐              └─────────┬──────────┘
   │ CLI temoin (Node)  │                        │
   │ check · generate   │                        │
   └─────────┬──────────┘                        │
             └─────────────────┬─────────────────┘
          ┌────────────────────▼───────────────────┐
          │ core/ (TypeScript, sans E/S)           │
          │ preset → pièces, contrôles, fichiers   │
          │ replicad · opentype.js · fflate        │
          └────────────────────────────────────────┘
```

Le noyau ne lit ni n'écrit aucun fichier ; il tourne dans Node comme dans un
Web Worker. Son contrat :

```ts
generate(preset: Preset, fonts: FontBytes): {
  checks: Check[]                       // un code par contrôle, mêmes messages partout
  parts: Part[]                         // solides et maillages, pour l'aperçu
  files: Record<string, Uint8Array>     // 3MF, STL, STEP, gabarit, nomenclature
}
```

| Dossier | Contenu |
| --- | --- |
| `core/` | preset (schéma, valeurs par défaut, migration de version, JSON Schema publié) ; catalogues (vis, inserts, longueurs du commerce, rubans, LED) ; légende ; pièces ; orientation pour l'impression ; contrôles ; exports |
| `cli/` | commande `temoin` : arguments, lecture du preset et des polices, écriture des fichiers, sortie `--json` pour le skill |
| `web/` | page Vite : formulaire tiré du schéma, preset ouvert depuis un fichier, noyau dans un Web Worker, aperçu three.js (éclaté ou assemblé, éteint ou allumé, tiré de la vue éclatée de la maquette), téléchargement en zip, preset dans l'URL, hors ligne (service worker) |
| `skill/` | `SKILL.md`, court : le calcul reste dans `temoin` |

Un seul dépôt en espaces de travail npm (`core`, `cli`, puis `web`) ;
`presets/` et `fonts/` sont partagés. Chaque dossier est créé au début de
son étape. Le code est en TypeScript sans étape de build : Node 22.18 et
Vite lisent les `.ts` directement (syntaxe effaçable seulement, imports en
`.ts`) ; `npm test` (vitest) et `npm run typecheck` (tsc) à la racine.

## Pile, 100 % libre

| Rôle | Bibliothèque | Licence |
| --- | --- | --- |
| langage, build | TypeScript, Vite | Apache-2.0, MIT |
| solides exacts, STEP | replicad, sur OpenCascade en WASM (`replicad-opencascadejs`) | MIT ; LGPL-2.1 |
| polices | opentype.js | MIT |
| preset | zod | MIT |
| 3MF (zip) | fflate | MIT |
| gabarit PDF | pdf-lib | MIT |
| aperçu 3D | three.js | MIT |
| tests | vitest | MIT |
| repli du moteur | manifold-3d (maillages, sans STEP) | Apache-2.0 |

LGPL d'OpenCascade : le `.wasm` reste un fichier à part, jamais fondu dans
notre code, et la page comme le README citent sa licence avec le lien vers
ses sources. Notre propre code est sous WTFPL v2 (31/10/2026), que ces
licences permettent : LGPL respectée par le `.wasm` à part, polices sous
OFL avec leur texte.

Écartés : build123d ou CadQuery (Python), car la page demanderait un serveur
ou un second noyau ; OpenSCAD en WASM, sans STEP et malcommode pour les
contrôles.

## Étape 3 : noyau et ligne de commande

| Lot | Contenu | Contrôle |
| --- | --- | --- |
| 3.0 Prototype | jetable, une demi-journée : légende de 10 lettres, cadre avec congés et fraisures, export STEP et maillage | temps de calcul (Node et navigateur), poids du WASM, STEP relu par Fusion ; décide replicad ou manifold-3d |
| 3.1 Preset v1 *(fait le 30/10/2026)* | schéma zod figé, réduit à ce qui a été validé à l'impression (texte, fenêtre, cadre, panneau, tête de vis, sortie des fils, couleurs du cadre et du fond de la légende), valeurs par défaut, JSON Schema (`core/src/preset.ts`, `presets/schema.json`) | `presets/alarme.json` valide ; erreurs lisibles sur un preset faux (`npm test`) |
| 3.2 Légende *(fait le 30/10/2026)* | reprise de `legende_dxf.py` (maquette) dans `core/src/legend.ts`, sans OpenCascade : contours, hauteur `auto`, interlettrage, îlots | contours identiques au DXF de la maquette, point par point au µm ; aires et centres de son JSON |
| 3.3 Pièces *(fait le 30/10/2026)* | cadre, légende (masque ; voile et lettres d'un corps), boîte, fond, panneau d'essai (`core/src/parts.ts`) ; cotes et vis reprises de `temoin.py` (maquette) (`core/src/dims.ts`) | parité avec les STL de la maquette : volume à 0,05 % et encombrement à 0,01 mm (écart constaté : 0,012 % au plus, encombrements identiques) ; tête cylindrique et fils à droite vérifiés à part |
| 3.4 Contrôles *(fait le 30/10/2026)* | ceux de la spécification, un code chacun, et le cadre conseillé quand le montage échoue (`core/src/checks.ts`) ; uniformité de l'éclairage reportée (modèle à recaler) | ALARME : mêmes zones fines que `legende_dxf.py`, aucune erreur ; cas d'école : cadre trop petit, fenêtre trop large, LED hors de la fenêtre, vis introuvable |
| 3.5 Exports *(fait le 30/10/2026, avant 3.4)* | STL et 3MF (reprise de `orient_stl.py` et `export_3mf.py`), STEP en un assemblage nommé, preset ; fichiers déterministes (`core/src/exports.ts`). Gabarit et nomenclature en fichier : plus tard | STL posés comme ceux de la maquette (bornes à 0,01 mm) ; 3MF lus ; STEP relu (volumes exacts, couleurs) ; 2 générations identiques. Reste : 3MF ouvert par l'utilisateur dans son logiciel de tranchage |
| 3.6 Ligne de commande *(fait le 30/10/2026, avant 3.4)* | `temoin check`, `generate`, `--json`, codes de sortie (`cli/bin/temoin.ts`) ; installation globale à l'étape 4 | lancée pour de vrai par les tests : alarme, presets faux, génération complète |

### Prototype du moteur (lot 3.0, fait le 30/10/2026) : replicad retenu

Code jetable, supprimé le 30/10/2026 une fois `core/` en place (il n'est
pas dans l'historique public) : cadre et légende du
preset `alarme`, plus la légende SURCHAUFFE (10 lettres), mesurés sous Node
et dans Chromium headless (Web Worker), STEP relu par Fusion. Pour
l'étape 5 : `proto/moteur/web/worker.js` démarre OpenCascade dans un Web
Worker avec Vite (`replicad-opencascadejs/wasm?url` passé à `locateFile`,
`worker: { format: 'es' }`).

| Mesure (2e passe) | Node | Chromium, Web Worker |
| --- | --- | --- |
| démarrage d'OpenCascade | 0,2 s | 1,4 s |
| cadre (congés, chanfreins, 2 fraisures) | 0,25 s | 0,25 s (1,2 s à froid) |
| légende ALARME | 0,18 s | 0,14 s |
| légende SURCHAUFFE | 0,30 s | 0,26 s |
| maillage des 5 pièces | 0,26 s | 0,32 s |
| STEP des 5 pièces | 0,6 s | 0,7 s |

- **Page** : premier résultat environ 5,5 s après le chargement (WASM déjà
  téléchargé), puis une légende se recalcule en 0,15 à 0,3 s.
- **Poids** : WASM 23 Mo, soit 5,0 Mo en brotli (7,3 en gzip), téléchargé
  une fois puis en cache ; code du worker 0,4 Mo (0,1 compressé).
  manifold-3d ne pèserait que 0,2 Mo compressé, mais sans STEP.
- **Parité avec la maquette** : cadre 1181,40 mm³ contre 1181,39 pour le STL
  de Fusion ; masque 246,02 contre 246,03, voile 261,48 contre 261,47, avec
  le même nombre de triangles que Fusion.
- **STEP relu par Fusion** : 3 composants nommés (cadre, masque, voile),
  solides fermés, volumes exacts ; le masque arrive en 4 corps (masque et
  îlots des A, A, R), comme dans la maquette.

Leçons pour la suite :

- Légende en polylignes (lot 3.2) : la mise en page de `legende_dxf.py`
  (segments de 0,2 mm au plus) est 4 fois plus rapide que les courbes de
  Bézier de `drawText` et donne 70 fois moins de triangles ; le masque
  découpé en 2D puis extrudé une fois divise encore le temps par 2.
- Couleurs du STEP (lot 3.5) : Fusion les lit comme linéaires (#4b5320
  arrive en (148, 155, 99)) ; les convertir de sRGB en linéaire à l'export.
- Le cadre à froid (1,2 s) paie la compilation à la volée du WASM : la page
  peut démarrer OpenCascade dès son chargement.
- OpenCascade écrit ses statistiques d'export STEP sur la sortie standard :
  `print` et `printErr` du module WASM sont neutralisés (sinon le JSON de la
  ligne de commande est cassé).
- npm 11.5 retirait du lockfile les modules natifs de rolldown et
  lightningcss, tirés par vitest (npm/cli#4828), et vitest ne démarrait
  plus : corrigé par npm 11.21.1, installé le 30/10/2026 ; ne pas supprimer
  le lockfile pour contourner.
- Boîte englobante des glyphes (lot 3.2) : celle d'opentype.js est approchée
  (bord du A à 13,56 unités au lieu de 13,47), ce qui décalait l'échelle de
  0,003 % ; le noyau calcule les extremums exacts des courbes, comme
  fontTools.

Tolérances de parité (lot 3.3) : volume à 0,05 %, encombrement à 0,01 mm.
Parité atteinte le 30/10/2026 : le noyau devient la référence ; la maquette
Fusion reste l'étalon des tests. Une impression de contrôle d'un
témoin sorti de `temoin`, si l'utilisateur la veut, clôt l'étape.

## Étape 4 : skill

- `skill/SKILL.md` d'après [skill.md](skill.md) ; lien
  `~/.claude/skills/temoin-lumineux` posé à l'écriture *(fait le
  30/10/2026, skill vu depuis le Claudemètre)*.
- `temoin` appelé tel qu'installé par `npm link` *(fait, marche depuis
  n'importe quel dossier)* ; résumé complété de la découpe et de l'entraxe
  à percer dans le panneau, utiles à l'intégration.
- Questions tirées du preset v1 (table des clés recopiée dans `SKILL.md`).
- Premier client : le Claudemètre ; preset `design/temoin/claude.json` créé
  avec l'utilisateur, dans son dépôt *(fait le 30/10/2026 par le skill,
  depuis une session lancée dans le Claudemètre : CLAUDE, cadre 47 × 18
  kaki, panneau de 3 mm ; un seul avertissement, l'espace étroit du masque ;
  12 fichiers, identiques à une génération neuve)*.
- Sur demande, intégration dans le design Fusion hôte (avec un skill Fusion
  360, non fourni ici).

## Étape 5 : page web

Branche `etape-5-web` ; lots validés le 30/10/2026. Disposition et vues :
[generateur.md](generateur.md), section « Page web ». La page ouvre aussi
les presets des projets hôtes (fichier choisi ou glissé, par exemple
`design/temoin/claude.json`) : c'est leur aperçu, à la place de `temoin
preview`.

| Lot | Contenu | Contrôle |
| --- | --- | --- |
| 5.1 Noyau dans la page *(fait le 30/10/2026)* | espace de travail `web/` (Vite) ; Web Worker qui démarre OpenCascade dès le chargement (recette du prototype du lot 3.0) ; un bouton génère et télécharge le zip d'`alarme` | test commun : fichiers du zip identiques, octet pour octet, à ceux de `temoin generate`, dans Chromium headless (Playwright) ; temps comparés au prototype |
| 5.2 Réglages et contrôles *(fait le 30/10/2026)* | formulaire des 8 clés (types, bornes, défauts et options lus dans le schéma zod, libellés en français) ; contrôles et montage (découpe, vis, LED) en direct, sans OpenCascade ; vue de face 2D en SVG, éteinte ou allumée | ALARME : mêmes lignes que `temoin check` ; cas d'école du lot 3.4 ; un test échoue si une clé du schéma n'a pas de champ |
| 5.3 Presets *(fait le 30/10/2026)* | ouvrir un `.json` (choisi ou glissé), l'enregistrer, lien avec le preset dans l'URL, exemples de `presets/` ; nom des fichiers = nom du preset ouvert, sinon champ « Nom » (par défaut le texte en minuscules) | `claude.json` du Claudemètre : contrôles de `temoin check` ; lien rouvert → même preset ; preset faux → erreurs « chemin : message » |
| 5.4 Aperçu 3D *(fait le 30/10/2026)* | maillages des pièces dans le repère du témoin, ajoutés au noyau ; recalcul dans le worker après une pause de saisie, résultats périmés jetés ; visionneuse tirée de la vue éclatée de la maquette (three.js de npm) : éclaté ou assemblé, éteint ou allumé, panneau d'essai, pièces masquables | ALARME et CLAUDE comparés à `eclate.html` ; légende recalculée en moins de 0,5 s ; mémoire du worker stable sur 50 recalculs |
| 5.5 Hors ligne *(fait le 31/10/2026)* | service worker (page, worker, WASM de 23 Mo, police) ; polices de l'interface servies par la page ; licences citées (OpenCascade LGPL-2.1 et lien vers ses sources, polices OFL) | page construite, rechargée sans réseau : aperçu et zip marchent |

Lot 5.1 : les 12 fichiers d'`alarme` sortent de la page en 3,4 s
(`temoin generate` : 3,25 s), OpenCascade prêt 1,1 s après le chargement
(serveur de développement) ; worker de 0,86 Mo, WASM de 23 Mo à part. Le
test commun (`web/test/parity.test.ts`, dans `npm test`) a trouvé un défaut
du noyau : OpenCascade écrit les couleurs du STEP dans un ordre qui dépend
de ses adresses mémoire, donc de ce qui a été calculé avant. La section est
désormais réécrite dans un ordre fixe (`stableStyles`, `core/src/exports.ts`) ;
les STEP déjà générés gardent le même contenu, dans un autre ordre.

Lot 5.2 : formulaire tiré de `presets/schema.json` (`web/src/fields.ts` ;
une clé sans champ fait échouer la page et `fields.test.ts`) ; contrôles,
montage et vue de face dans un second worker sans OpenCascade
(`web/src/checker.ts`, environ 50 ms par saisie), le fil principal sans le
noyau (10 Ko). Le noyau rend désormais cotes et légende même quand le
montage échoue (aperçu d'un cadre trop petit), et le résumé du montage
(`summaryLines`) sert à la page comme à `temoin`. Test de la page : ALARME
et 4 cas d'école donnent les lignes de `temoin check`. À reprendre au lot
5.5 : le worker des contrôles embarque replicad sans s'en servir (0,7 Mo).

Lot 5.3 : barre « Ouvrir · Exemples · Enregistrer · Lien » dans l'en-tête,
fichier glissé n'importe où sur la page. Un preset ouvert (fichier, exemple,
lien) est contrôlé tel quel jusqu'à la première saisie : la page donne les
lignes de `temoin check`, même pour un preset faux (clé inconnue, version) ;
ensuite, le formulaire prend la main, garde les valeurs fausses de ses
champs (couleur « rouge », option inconnue) jusqu'à leur saisie et abandonne
les clés qu'il n'a pas. Enregistrer écrit le `<nom>.json` de `temoin
generate` (`presetJson`, désormais dans le noyau). Le lien suit chaque
saisie (fragment de l'URL, une clé par paramètre, `frame.width=47`, plus
`name`) : la page rechargée garde son preset. Contrôles : `claude.json` du
Claudemètre donne les 10 lignes de `temoin check`, lien rouvert compris ;
tests de la page (`page.test.ts`) : preset ouvert, enregistré, lien copié
puis rouvert dans une autre page, preset faux glissé, exemple ;
`link.test.ts` pour l'aller-retour du lien. Un seul exemple dans
`presets/` (alarme) : le menu prendra les suivants tels quels.

Lot 5.4 : maillages d'aperçu dans le noyau (`core/src/preview.ts`) : les 6
pièces imprimées (triangles, normales et arêtes vives d'OpenCascade) dans
le repère du témoin, avec un cache par pièce dont la clé est faite des
réglages dont elle dépend : un texte ne refait que la légende, une couleur
rien. Le voile y est montré en plaque et lettres juxtaposées, sans la
fusion de la pièce imprimée (280 à 550 ms à elle seule) ; les fichiers
gardent `legend()`. Un seul worker OpenCascade pour l'aperçu et le zip
(`web/src/engine.ts`, client `engine-client.ts`). Visionneuse three.js
0.186 (`web/src/viewer.ts`, 0,56 Mo chargés au premier passage en 3D) :
éclaté ou assemblé, quatre points de vue, éteint ou allumé (commun avec la
vue de face), pièces masquables. Mesures sur la page construite (Chromium
headless) : première vue 3D en 2,0 s, légende recalculée en 0,26 à 0,43 s.
Mémoire : OpenCascade fuit dans chaque opération booléenne (issue replicad
[#282](https://github.com/sgenoud/replicad/issues/282), ouverte le
23/09/2026, environ 0,2 Mo par opération, toujours là en 1.2.0) ; le
worker est remplacé quand son tas dépasse 512 Mo. Sur 50 recalculs lourds
(texte et largeur du cadre), le tas va en dents de scie de 127 à 595 Mo,
2 relances, aucune erreur (mesure faite à la main, trop longue pour
`npm test`). Comparé à `eclate.html` (ALARME) : mêmes pièces, positions et
point de vue ; la quincaillerie de la maquette (vis, inserts, ruban) n'est
pas dans le noyau, donc pas dans l'aperçu. CLAUDE : même montage, avec son
texte et sa couleur de cadre. Test de la page : vue 3D des 6 pièces,
légende seule refaite après une saisie, pièce masquée puis réaffichée.

Après le lot 5.4 (30/10/2026) : vue 3D par défaut, et lumière simulée
(`web/src/light.ts`), commune aux deux vues et hors preset : éteinte,
fixe, respiration ou clignotement, dans une couleur du ruban. Lettres de
la couleur, un peu plus blanches au cœur ; halo plus retenu pour les
couleurs claires (le blanc noyait les lettres). Vue de face : halo SVG,
flou découpé à la fenêtre. 3D : halo fait d'un bloom du voile seul, les
autres pièces dessinées en noir pour qu'elles le cachent, puis ajouté à
la scène, sans seuil de luminosité. Un premier essai, bloom de toute la
scène au-dessus d'un seuil, allumait les lettres une à une selon leur
reflet, et ses couleurs poussées au-delà de 1 viraient au blanc. Test de
la page : vue 3D d'abord, couleur des lettres et du halo, lumière éteinte
puis rallumée par une couleur.

Lot 5.5 : service worker écrit par le build (`web/src/sw.js`, complété
par `vite.config.ts` avec la liste des fichiers et un cache nommé
d'après eux) : il garde la page, ses workers, le `.wasm` d'OpenCascade
(23 Mo), les polices et les licences, 25 Mo en tout ; une nouvelle
version attend que la page soit fermée partout. Seulement dans la page
construite. Polices de l'interface servies par la page : B612 et B612
Mono (paquets `@fontsource`, OFL), jusque-là demandées au système, donc
remplacées le plus souvent ; plus larges, elles ont fait rétrécir la
colonne des libellés (9 em) pour que les champs numériques montrent 6
caractères. Licences : pied de page (OpenCascade, LGPL 2.1, lien vers
ses sources ; polices OFL) et `licences.txt`, construit depuis les
dépendances de `web/` et `core/` (la licence de chaque paquet, la note
des sources d'OpenCascade, l'OFL de Barlow), servi aussi en
développement ; l'option `build.license` de Vite ne voit pas les
workers. Le worker des contrôles n'embarque plus replicad (`sideEffects:
false` dans `core/package.json`) : 443 Ko au lieu de 714. Test de la
page : chargée, réseau coupé, rechargée, elle montre la vue 3D des 6
pièces, donne le zip de 12 fichiers et ses licences. Les champs numériques n'ont plus de flèches (les
touches haut et bas restent) : elles cachaient « 10.5 ».

- STEP et 3MF calculés au téléchargement seulement ; vue de face et
  contrôles aussitôt, 3D ensuite (premier résultat vers 5,5 s d'après le
  prototype).
- Mémoire : OpenCascade fuit dans les opérations booléennes (replicad #282),
  sans gravité pour `temoin` qui génère une fois ; la page relance son
  worker au-delà de 512 Mo (lot 5.4).
- Parité : on compare les fichiers du zip (le zip, lui, porte des dates).
- Plus tard : coupe 3D, zones fines surlignées sur la vue de face (les
  contrôles ne donnent leur position que dans le message).
- Page en français ; l'étape se clôt avec la page en local (`npm run web`).
  Dépôt public, licence (WTFPL v2) et hébergement (GitHub Pages) : voir
  le PLAN, « Publication ».

## Hors périmètre

- Version téléphone de la page en v1 (décision du 30/10/2026) : la page
  vise l'ordinateur ; sa mise en page empilée sous 880 px reste telle
  quelle, sans être ni testée ni retouchée. Pas d'autre thème que le clair
  et le sombre déjà là (bouton « Sombre » de l'en-tête).

- Tranchage et réglages propres à un logiciel de tranchage, dont Snapmaker
  Orca : les 3MF sont génériques et l'utilisateur tranche. Un projet hôte
  qui veut trancher se dote de son propre skill.

## Points ouverts

- [x] Moteur : replicad, d'après le prototype du 30/10/2026 (lot 3.0).
- [x] Tolérances de parité : volume à 0,05 %, encombrement à 0,01 mm (lot 3.3).
- [x] `npm link` pour appeler `temoin` depuis le skill, chemin absolu en
      repli (étape 4, 30/10/2026).
