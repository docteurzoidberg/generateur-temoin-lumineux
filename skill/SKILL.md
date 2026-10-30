---
name: temoin-lumineux
description: Témoins lumineux encastrables imprimés en 3D (légende éclairée par un ruban WS2812B, dans un cadre vissé sur une découpe de panneau) pour n'importe quel projet. Décrit le témoin dans un preset JSON du projet (design/temoin/<nom>.json), le contrôle, produit les fichiers d'impression et de montage (3MF génériques, STL, STEP, nomenclature) avec la commande `temoin`, et sur demande l'intègre dans le design Fusion du projet. À charger pour « fais / génère / vérifie un témoin lumineux, un voyant, une légende éclairée », ou dès qu'un preset de témoin est en jeu.
---

# Témoin lumineux

Le calcul est dans la commande `temoin` du générateur : le dépôt dont `skill/` est la cible
du lien `~/.claude/skills/temoin-lumineux`.
Ce skill la pilote depuis le projet hôte et n'écrit que dans ce projet.

## Commande

```bash
temoin check <preset.json> --json                  # contrôles seuls, rien n'est écrit
temoin generate <preset.json> [-o <dossier>] --json # contrôles puis fichiers
```

- Sans `-o` : fichiers dans `export/` à côté du preset ; `<nom>` du fichier preset préfixe tout.
- Code de sortie : 0 bon (avertissements possibles), 1 preset refusé (erreur), 2 mauvais usage.
- JSON : `{ name, ok, checks: [{ level: ok|warn|error, code, message }], summary, out, files }` ;
  `summary` : `capHeight`, `window`, `frame`, `panel`, `cutout` (découpe et trous du panneau),
  `screws`, `inserts`, `leds`.
- `temoin` introuvable : `cd "$(realpath ~/.claude/skills/temoin-lumineux)/../cli" && npm link`
  (Node 22.18 ou plus) ; sinon `node "$(realpath ~/.claude/skills/temoin-lumineux)/../cli/bin/temoin.ts" …`.

## Preset (version 1)

Un fichier par témoin, versionné avec le projet hôte : `design/temoin/<nom>.json` par
défaut, ou le chemin que l'utilisateur donne. Cotes en mm. Toute clé inconnue est refusée.

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

| Clé | Réglage | Par défaut |
| --- | --- | --- |
| `legend.text` | texte d'une ligne (capitales conseillées) | **obligatoire** |
| `panel.thickness` | épaisseur du panneau hôte | **obligatoire** |
| `legend.background` | couleur du fond de la légende | `#111111` |
| `window.width`, `window.height` | partie éclairée visible | 27 × 10,5 |
| `frame.width`, `frame.height` | cadre, en façade | 47 × 18 |
| `frame.color` | couleur du cadre | `#111111` |
| `mount.head` | vis `countersunk` (fraisée, affleurante) ou `socket` (cylindrique, dépasse de 3 ; jamais imprimée) | `countersunk` |
| `light.wireExit` | sortie des fils, vue de face : `left` ou `right` | `left` |

Fixé en v1 (validé à l'impression) : police Barlow Condensed SemiBold, hauteur des lettres
automatique, lettres lumineuses ; 2 vis M3 et 2 inserts à chaud M3, longueur et entraxe
calculés ; ruban WS2812B 5 V à 144 LED/m (nombre de LED selon la fenêtre). Hors v1 : 2
lignes, autre police, M2 ou M2,5, écrous, autre ruban, cadre rond, etc. Le dire, proposer
le plus proche en v1, ne jamais contourner (clé inventée, fichier retouché).

## Déroulement

1. **Preset.** Celui du projet (`design/temoin/*.json`, ou le chemin donné). Sinon, en
   créer un : demander le texte et l'épaisseur du panneau, puis proposer pour le reste la
   valeur par défaut ou celle que le projet suggère (sa documentation, ses cotes) ;
   l'écrire après accord.
2. **Contrôles** : `temoin check <preset> --json`.
   - `error` : s'arrêter, expliquer, proposer la correction du preset (`mount.frame` donne
     le plus petit cadre qui passe) ; l'appliquer seulement après accord, puis recontrôler.
   - `warn` : continuer ; le signaler dans le résumé (les espaces du masque plus fins que la
     buse sont courants et n'ont pas gêné l'impression).
3. **Génération** : `temoin generate <preset> --json`.
4. **Résumé** à l'utilisateur, par exemple :

   ```text
   Témoin « alarme » (design/temoin/alarme.json)
   Contrôles : ⚠ espaces du masque plus fins que la buse (4), le reste ✓
   Nomenclature : 2 vis fraisées M3 × 10, 2 inserts à chaud M3 (perçage Ø 4 × 5,5),
     4 LED de ruban WS2812B à 144 LED/m (tronçon de 27,8 mm), nappe de 4 fils au pas de 1,27
   Panneau : découpe 29,8 × 13,3, 2 trous Ø 3,4 à 37 d'entraxe, centrés sur la fenêtre
   Fichiers : design/temoin/export/ (12 : 3MF, STL, STEP, preset)
   Valeurs par défaut retenues : fenêtre 27 × 10,5, vis fraisées, fils à gauche
   ```

Fichiers de `export/` (régénérables, jamais retouchés à la main) :

| Fichier | Contenu |
| --- | --- |
| `<nom>_legende.3mf` | légende : masque et voile en un objet de 2 couleurs, à imprimer ensemble |
| `<nom>_cadre.3mf`, `<nom>_boite_fond.3mf` | cadre ; boîte à lumière et fond |
| `<nom>_panneau_essai.3mf` | morceau de panneau percé, pour essayer le montage |
| `<nom>_<pièce>.stl` | une par pièce, orientée pour l'impression |
| `<nom>.step` | assemblage nommé (cadre, masque, voile, boîte, fond) dans le repère du témoin |
| `<nom>.json` | preset utilisé, valeurs par défaut comprises |

Les 3MF sont génériques (une pièce par couleur, sans réglage) : l'utilisateur tranche
lui-même ; ne pas proposer de tranchage.

## Intégration dans un design Fusion (sur demande)

Avec un skill Fusion 360 (non fourni par ce dépôt), Fusion ouvert sur le design hôte.

- Repère du témoin : origine au centre de la fenêtre, sur la face avant du panneau (dos du
  cadre), X à droite, Z en haut, +Y vers l'arrière du panneau. Demander où placer le
  témoin si le panneau hôte ne suit pas ce repère.
- Importer `<nom>.step` dans un composant « témoin `<nom>` ».
- Percer le panneau d'après `summary.cutout` : découpe rectangulaire centrée sur l'origine,
  2 trous sur l'axe X à ±entraxe/2 ; puis contrôler les interférences.
- Enregistrer une nouvelle version du design seulement après accord.

Pour voir le témoin : ouvrir `<nom>.step` dans Fusion. Plus tard, la page web du générateur
ouvrira le preset (pas encore disponible).

## Règles

- Le preset est la seule source : pour changer le témoin, modifier le preset et
  régénérer.
- Visières, capots et accessoires restent dans le projet hôte (dessinés autour du STEP).
- Ne jamais modifier le dépôt du générateur. Un défaut du générateur (contrôle faux,
  pièce fausse, plantage) : le signaler à l'utilisateur avec la commande et sa sortie.
