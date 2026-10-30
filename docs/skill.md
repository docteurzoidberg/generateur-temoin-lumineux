# Skill `temoin-lumineux` : mode d'emploi

Mise à jour : 30/10/2026. **Écrit le 30/10/2026** :
[`skill/SKILL.md`](../skill/SKILL.md) (étape 4 du [PLAN](../PLAN.md) ; plan :
[plan-generateur.md](plan-generateur.md)). Ce document dit comment on s'en
sert depuis un autre projet et ce qu'il rend. Pour les humains, les projets hôtes et leurs agents. Outil qu'il
appelle, la commande `temoin` : [generateur.md](generateur.md).

Depuis un projet hôte, on demande un témoin lumineux personnalisé ; le skill
le décrit dans un preset du projet, le vérifie, produit les fichiers
d'impression et de montage, et sur demande l'intègre dans le design Fusion
du projet.

## Le rendre disponible

Skill **global** (décision du 30/10/2026) : disponible dans tous les
projets, sans option au lancement de Claude Code. La source reste dans ce
dépôt (`skill/`, avec `SKILL.md`) ; `~/.claude/skills/temoin-lumineux` est un
lien vers elle, posé une fois depuis le dépôt cloné, avec la commande :

```bash
cd generateur-temoin-lumineux   # le dépôt cloné
ln -s "$PWD/skill" ~/.claude/skills/temoin-lumineux
(cd cli && npm link)            # la commande temoin
```

Le lien suit le dépôt : une mise à jour du skill vaut aussitôt partout.
Depuis un projet hôte, il suffit alors de lancer Claude Code :

```bash
cd mon-projet   # le projet hôte, avec son preset dans design/temoin/
claude
```

Le skill se suffit : l'agent hôte n'a pas à lire le reste de ce dépôt.

## Dans le projet hôte

```text
<projet hôte>/
└── design/temoin/      convention proposée ; tout autre dossier si on le nomme
    ├── <nom>.json      preset, versionné avec le projet hôte
    └── export/         écrit par le skill, régénérable
```

Un preset par témoin ; `<nom>` préfixe tous les fichiers produits.

## Le demander

| Demande | Ce qui se passe |
| --- | --- |
| « génère le témoin du claudemètre » | preset trouvé, contrôles, fichiers dans `export/`, résumé |
| « fais un témoin ARMÉ, panneau de 3 mm, cadre rouge » | nouveau preset depuis l'exemple, questions sur ce qui manque, puis génération |
| « vérifie le témoin » | contrôles seuls, rien n'est écrit |
| « montre le témoin » | STEP à ouvrir dans Fusion ; plus tard, preset à ouvrir dans la page web du générateur (étape 5) |
| « intègre le témoin dans le design Fusion » | STEP importés, découpe et trous dans le panneau hôte |

## Déroulement

1. **Preset** : celui du projet (`design/temoin/*.json` ou le chemin donné).
   Sinon, nouveau preset : le texte (une ligne) et l'épaisseur du panneau
   sont demandés, seules clés obligatoires du preset v1 ; la tête de vis
   (fraisée ou cylindrique), la sortie des fils (gauche ou droite) et les
   couleurs du cadre et du fond de la légende le sont aussi, avec leur
   valeur par défaut proposée. Les valeurs par défaut retenues sont listées
   dans le résumé.
2. **Contrôles** (`temoin check --json`) : une erreur arrête tout, avec la
   correction du preset proposée (par exemple le cadre conseillé du contrôle
   `mount.frame`), appliquée seulement après accord ; un
   avertissement n'arrête pas et figure dans le résumé.
3. **Génération** (`temoin generate`) vers `export/`, tous formats.
4. **Résumé** : contrôles, nomenclature, fichiers écrits, valeurs par défaut
   retenues.
5. **Sur demande** : intégration (ci-dessous).

## Résultat attendu

Dans `export/` :

Les fichiers de la v1 ([generateur.md](generateur.md), « Sorties ») :

| Fichier | Contenu |
| --- | --- |
| `<nom>_<impression>.3mf` | 3MF génériques, un par impression (`legende`, `cadre`, `boite_fond`, `panneau_essai`) |
| `<nom>_<pièce>.stl` | une par pièce, orientées pour l'impression |
| `<nom>.step` | assemblage nommé, dans le repère du témoin |
| `<nom>.json` | le preset utilisé |

Pièces : cadre, légende (masque, lettres, voile, à charger ensemble), boîte à
lumière, fond. Résumé rendu à l'utilisateur, par exemple :

```text
Témoin « alarme » (design/temoin/alarme.json)
Contrôles : ⚠ espaces du masque plus fins que la buse (4), le reste ✓
Nomenclature : 2 vis fraisées M3 × 10, 2 inserts à chaud M3 (perçage Ø 4 × 5,5),
  4 LED de ruban WS2812B à 144 LED/m (tronçon de 27,8 mm), nappe de 4 fils au pas de 1,27
Panneau : découpe 29,8 × 13,3, 2 trous Ø 3,4 à 37 d'entraxe, centrés sur la fenêtre
Fichiers : design/temoin/export/ (12 : 3MF, STL, STEP, preset)
Valeurs par défaut retenues : fenêtre 27 × 10,5, vis fraisées, fils à gauche
```

## Intégration dans un design Fusion

Fusion ouvert sur le design hôte ; un skill Fusion 360 (non fourni ici) fait
les opérations.

- STEP importés dans un composant « témoin `<nom>` ». Repère : origine au
  centre de la fenêtre, sur le plan du panneau (dos du cadre), X à droite,
  Z en haut, +Y vers l'arrière ; sans rotation si le panneau hôte suit ce
  repère, sinon le skill demande où le placer.
- Découpe et 2 trous de vis taillés dans le corps du panneau d'après la
  découpe et l'entraxe du résumé (le gabarit viendra plus tard), puis
  contrôle des interférences.
- Nouvelle version du design enregistrée seulement sur accord.

## Ce qu'il ne fait pas

- Visières, capots, supports et accessoires : ils restent dans le projet hôte.
- Électronique et firmware ; découpe physique du panneau (il donne le gabarit).
- Trancher : les 3MF sont génériques. Un projet hôte qui veut trancher (par
  exemple avec Snapmaker Orca) se dote d'un skill dédié.
- Modifier ce dépôt : il n'écrit que dans le projet hôte.

## Règles pour un agent

- Le preset est la seule source : pour changer le témoin, modifier le preset
  et régénérer ; ne jamais retoucher les STL, STEP ou 3MF.
- Visserie fixée en v1 (vis M3 et inserts à chaud) ; la longueur de vis est
  calculée, jamais choisie à la main.
- Défaut du générateur : le signaler à l'utilisateur, ne pas le corriger
  depuis le projet hôte.

## Version

Une seule : le skill s'appuie sur `temoin` (Node), sans Fusion ; Fusion ne
sert qu'à l'intégration. La v0 sur les scripts de la maquette, envisagée,
est abandonnée (30/10/2026) : la ligne de commande vient avant le skill.

## Points ouverts

- [x] Chargement d'un skill par lien symbolique : vérifié le 30/10/2026,
      le skill est listé par une session lancée dans le Claudemètre.
- [x] Appel de l'outil depuis le skill global : `temoin` installé par
      `npm link` (30/10/2026), chemin absolu du dépôt en repli.
- [ ] Convention `design/temoin/` à confirmer.
- [x] Questions du skill tirées du preset v1 (`presets/schema.json`, figé
      le 30/10/2026) : la table des clés est recopiée dans `SKILL.md`, qui
      se suffit ; à reprendre si le preset change.
