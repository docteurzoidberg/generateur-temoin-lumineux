# Générateur de témoin lumineux

Témoins lumineux encastrables imprimés en 3D (légende éclairée dans un cadre
monté dans une découpe de panneau) : un preset JSON décrit le témoin, le
générateur en tire les fichiers d'impression (ligne de commande `temoin`,
skill Claude Code, page web).

- **v1 = prototype fonctionnel** : seulement ce qui a été validé à
  l'impression (réglages : `docs/generateur.md`, « Preset ») ; pas de
  fonction non éprouvée.
- Arborescence : `presets/`, `fonts/` (OFL), `docs/` (`plan-generateur.md`
  à lire en premier, puis `generateur.md` et `skill.md`) ; `core/`
  (TypeScript, `npm test`, `npm run typecheck`), `cli/` (`temoin generate
  <preset>`, installé par `npm link`), `skill/` (lié depuis
  `~/.claude/skills/temoin-lumineux`), `web/` (page Vite, `npm run web`).
  Feuille de route, décisions, vocabulaire : `PLAN.md`. Les cotes viennent
  d'une maquette Fusion, dans un dépôt à part ; ses sorties de référence
  pour les tests sont dans `core/test/ref/`.
- Docs et échanges en français. Code de `core/`, `cli/` et `web/` entièrement
  en anglais : commentaires, identifiants, noms de fichiers et de tests,
  erreurs internes. Seuls les textes montrés à l'utilisateur (page, messages
  des contrôles, sortie de `temoin`, noms des fichiers produits, descriptions
  du schéma) restent en français, en attendant des libellés i18n.
- Générique : rien de propre à un projet hôte, dont les presets restent dans
  son dépôt. Visières et accessoires d'un objet : hors périmètre.
- Visserie : v1 = vis M3 et inserts à chaud (tête fraisée ou cylindrique),
  entraxe et longueur calculés ; M2 et M2,5 plus tard, au choix de
  l'utilisateur. Pas de types de filament : choisis au tranchage.
- 3MF génériques (une pièce par couleur), faits ici ; le tranchage reste à
  l'utilisateur, dans le logiciel de son choix.
- Tests en local : le hook `.githooks/pre-push` (activé par `npm install`)
  lance typecheck et `npm test` avant chaque push, sur un arbre commité ;
  l'action GitHub (`.github/workflows/page.yml`) ne fait que typecheck,
  build et publication de la page sur GitHub Pages.
