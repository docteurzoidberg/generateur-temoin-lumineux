# Plan — générateur de témoin lumineux

Mise à jour : 30/10/2026. Plan du générateur (étapes 3 à 5 : ordre, pile,
lots) : [docs/plan-generateur.md](docs/plan-generateur.md) ; spécification
(preset, contrôles, page, sorties, ligne de commande) :
[docs/generateur.md](docs/generateur.md) ; skill : [docs/skill.md](docs/skill.md).

## Feuille de route (plan de l'utilisateur, 29/10/2026 ; étapes 3 à 5 réordonnées le 30/10/2026)

Les étapes se lancent une à une, à la demande de l'utilisateur.

1. **Maquette dans Fusion** : faite et validée le 29/10/2026 ; dépôt à
   part depuis le 31/10/2026, avec ses points à revoir ; ses sorties de
   référence pour les tests sont dans `core/test/ref/`.
2. **Impressions d'essai** *(en cours)* : l'utilisateur imprime et fait ses
   retours ; retour à l'étape 1 si besoin. La maquette doit rester simple à
   régénérer depuis le design Fusion (STL, images, vue éclatée) : ces
   opérations sont aujourd'hui plusieurs scripts, à réduire à une seule
   commande. Essais utiles : jeux (feuillure, découpe, fond), légendes
   (voile, polices, tailles), banc lumineux, ruban clipsé. Maquette
   régénérée le 30/10/2026 : ruban WS2812B à 144 LED/m (voir Principes)
   clipsé sur le fond sans adhésif, LED à 10 mm de la légende, cadre de 47.
   1er essai (30/10/2026) : tout bon (M3 validée) sauf le fond, qui avait
   du jeu latéral et sortait trop facilement ; fond seul corrigé (bouts de
   rails arrondis en serrage, nervures plus grosses) et 2e essai sur une
   série de 3 serrages : 0,3 mm retenu. Essai M2,5 reporté après la v1
   (vis M3 seulement en v1).
3. **Noyau et ligne de commande** *(fait le 30/10/2026, branche
   `etape-3-noyau`)* : pièces, contrôles et exports (3MF, STL,
   STEP, gabarit, nomenclature) construits depuis le preset, commande
   `temoin` ; d'abord un prototype du moteur géométrique, puis la parité
   avec la maquette Fusion.
4. **Skill Claude Code global** *(fait le 30/10/2026, branche `etape-4-skill`)* (lien
   depuis `~/.claude/skills`, source dans `skill/`) : demander un témoin depuis un projet hôte, le générer depuis
   son preset, l'intégrer sur demande dans son design Fusion ; premier
   client, le Claudemètre.
5. **Page web** : réglages ou preset ouvert (celui d'un projet hôte, par
   exemple), aperçu en temps réel (éclaté ou assemblé, éteint
   ou allumé) et téléchargements, dans le navigateur, sans serveur.

Détail des étapes 3 à 5 : [docs/plan-generateur.md](docs/plan-generateur.md).

Ensuite, à replanifier : gabarit de découpe, nomenclature, recalage du modèle
d'uniformité sur photos, variantes (cadre rond, 2 lignes, pictogrammes SVG,
cloisons et zones, clips, vis par l'arrière, légende sur film imprimé, façade
« dead front », autres LED).

## Décisions à prendre

- [x] Moteur géométrique (30/10/2026) : replicad, d'après le prototype du
      lot 3.0 (temps, poids, parité, STEP relu par Fusion : voir
      [docs/plan-generateur.md](docs/plan-generateur.md)).
- [x] Langue de l'interface (30/10/2026) : français pour la v1 ; plus tard,
      page multilingue avec des libellés i18n. Code en anglais (30/10/2026) :
      commentaires, identifiants, fichiers et tests de `core/`, `cli/`, `web/`.
- [ ] Publication : dépôt public parti d'un seul commit (31/10/2026 ;
      l'historique de travail reste privé) ; page sur GitHub Pages,
      construite et publiée par `.github/workflows/page.yml` à chaque push
      sur `main` ; licence WTFPL v2 pour le code du dépôt (31/10/2026),
      les dépendances et les polices gardant la leur.
- [x] Ordre (30/10/2026) : ligne de commande et skill avant la page web.
- [x] Pile (30/10/2026) : TypeScript, bibliothèques 100 % libres, un seul
      noyau pour la ligne de commande, le skill et la page.
- [x] 3MF génériques (30/10/2026) : rien de propre à un slicer ; une pièce
      par couleur dans le même 3MF. Le tranchage reste à l'utilisateur ;
      Snapmaker Orca hors périmètre (un projet hôte qui veut trancher a son
      propre skill).
- [x] Preset d'exemple en M3 : cadre élargi de 44 à 47 (30/10/2026), vis
      centrées entre la fenêtre et le bord.
- [x] Preset v1 réduit à ce qui a été validé à l'impression (30/10/2026) :
      texte (une ligne), fenêtre, cadre, panneau, tête de vis fraisée ou
      cylindrique, sortie des fils à gauche ou à droite, couleurs du cadre et
      du fond de la légende (noir par défaut). Vis M3 et inserts à chaud
      seulement, entraxe calculé ; pas d'écrous ni de collage ; pas de types
      de filament (choisis au tranchage). M2, M2,5 et le reste viendront
      chacun après une impression d'essai.
- [x] Fond de la boîte (4e pièce, porte le ruban clipsé) : tenu en
      serrage de 0,3 mm (nervures et bouts des rails), choisi à l'essai le
      30/10/2026 ; pas de vis traversantes.

## Principes

- **Générique** : rien de propre à un projet hôte ; ses presets vivent dans
  son dépôt (ex. le Claudemètre : `design/temoin/claude.json`).
- **Le preset est le contrat**, versionné ; **un seul noyau** (géométrie,
  contrôles, exports) pour la ligne de commande, le skill et la page.
- **100 % libre** : bibliothèques open source seulement (licences :
  [docs/plan-generateur.md](docs/plan-generateur.md)).
- **Page statique**, sans serveur, utilisable hors ligne.
- **Fabrication** : FDM, multi-filament jusqu'à 4 têtes, mono-filament
  possible ; quincaillerie courante (M2 à M3, inserts à chaud, écrous) ; en
  v1, vis M3 et inserts à chaud seulement.
- **Ruban de référence** : WS2812B 5 V à 144 LED/m (pas 6,94 ; circuit
  12 × 0,5 ; LED 5050), coupable après chaque LED : le tronçon s'ajuste à la
  fenêtre, au plus près de la règle nombre = largeur de fenêtre / pas,
  arrondi (4 LED pour 27 mm).
- **3MF faits ici**, tranchage à l'utilisateur.

## Anatomie et vocabulaire

| Terme | Définition |
| --- | --- |
| cadre | collerette en façade, devant le panneau |
| lèvre | bord du cadre autour de la fenêtre, sur lequel la légende s'appuie |
| feuillure | logement de la légende au dos du cadre |
| fenêtre | partie visible de la légende |
| légende | plaquette multi-filament : **masque** opaque, **lettres** translucides, **voile** diffuseur continu derrière (il porte les îlots des A, D, O, R) ; lettres et voile d'un même filament ne font qu'un corps |
| boîte à lumière | **tube** (intérieur = fenêtre) qui traverse la découpe et plaque la légende contre la lèvre ; **bride** derrière le panneau, avec les inserts ; **logement** du ruban ; **cloisons** en option |
| fond | ferme le logement au dos de la boîte ; porte le ruban, clipsé entre deux **rails** qui entrent dans la boîte ; sa **languette** ferme la fente de la nappe, taillée dans la paroi de la boîte |
| découpe | trou du panneau : tube + jeu, plus 2 trous de vis |

Masque, lettres et voile s'impriment ensemble, dans la même famille de matière
(PETG avec PETG, PLA avec PLA). Cadre, boîte et fond sont des pièces séparées ;
boîte et fond opaques, en noir de préférence.

## Hors périmètre

- Visières, casquettes, capots, supports et accessoires propres à un objet :
  ils restent dans le projet hôte.
- Électronique et firmware ; découpe du panneau hôte (l'outil donne le gabarit).
- Tranchage et réglages de slicer, dont Snapmaker Orca.
- Modèle paramétrique Fusion dans le générateur (Fusion reçoit des STEP),
  rendu photoréaliste.

## Idées pour plus tard

- Extrait de configuration ESPHome ou WLED indicatif (LED, effets des états).
- Rangée de témoins alignés sur un même panneau, avec un gabarit commun.
