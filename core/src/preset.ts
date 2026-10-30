// Preset v1: the contract between the command line, the skill and the page (settings:
// docs/generateur.md). Dimensions in mm. v1 only sets what has been validated in print
// (decision of 30/10/2026); everything else is fixed in the core. Only the text and the
// panel thickness are required; every other key defaults to the value of the example
// presets/alarme.json, with black colours. An unknown key is rejected (typo). Compatible
// additions stay in v1; any change of a key or of a default value moves to v2, with its
// migration. Messages and descriptions are shown to the user: they stay in French.
import * as z from 'zod';

z.config(z.locales.fr());
// Missing key: "obligatoire" (with the allowed values) rather than "object expected,
// undefined received".
z.config({
  customError: (iss) => {
    if (iss.input !== undefined) return undefined;
    if (iss.code === 'invalid_type') return 'obligatoire';
    if (iss.code === 'invalid_value') return `obligatoire, parmi ${iss.values.map((v) => JSON.stringify(v)).join(' | ')}`;
    return undefined;
  },
});

const BLACK = '#111111';

const mm = (what: string) => z.number().positive().describe(`${what} (mm)`);
const color = (what: string) => z.string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'couleur attendue au format #rrggbb').default(BLACK)
  .describe(`${what} (#rrggbb) ; noir par défaut`);

const legend = z.strictObject({
  text: z.string()
    .regex(/\S/, 'texte vide')
    .refine((t) => !t.includes('\n'), 'une seule ligne en v1')
    .describe('Texte de la légende, sur une ligne'),
  background: color('Couleur du fond de la légende (masque opaque)'),
});

const window = z.strictObject({
  width: mm('Largeur de la fenêtre (partie visible de la légende)').default(27),
  height: mm('Hauteur de la fenêtre').default(10.5),
});

const frame = z.strictObject({
  width: mm('Largeur du cadre').default(47),
  height: mm('Hauteur du cadre').default(18),
  color: color('Couleur du cadre'),
});

const panel = z.strictObject({
  thickness: mm('Épaisseur du panneau hôte (= longueur du tube)'),
});

const mount = z.strictObject({
  head: z.enum(['countersunk', 'socket']).default('countersunk')
    .describe('Vis M3 et inserts à chaud ; countersunk : tête fraisée, socket : tête cylindrique (ISO 4762)'),
});

const light = z.strictObject({
  wireExit: z.enum(['left', 'right']).default('left')
    .describe('Sortie des fils du ruban, vue de face'),
});

export const presetSchema = z.strictObject({
  $schema: z.string().optional().describe('Chemin ou URL du JSON Schema, pour les éditeurs'),
  version: z.literal(1, { error: 'version de preset non prise en charge : ce générateur lit la v1' }),
  legend,
  window: window.prefault({}),
  frame: frame.prefault({}),
  panel,
  mount: mount.prefault({}),
  light: light.prefault({}),
}).describe("Preset d'un témoin lumineux (v1). Cotes en mm.");

export type PresetInput = z.input<typeof presetSchema>;
export type Preset = z.output<typeof presetSchema>;

export type ParseResult = { ok: true; preset: Preset } | { ok: false; errors: string[] };

function where(path: PropertyKey[]): string {
  return path.map((p, i) => (typeof p === 'number' ? `[${p}]` : `${i ? '.' : ''}${String(p)}`)).join('') || '(preset)';
}

// Validates a preset (JSON already read); errors are "path : message" lines.
export function parsePreset(data: unknown): ParseResult {
  const r = presetSchema.safeParse(data);
  if (r.success) return { ok: true, preset: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${where(i.path)} : ${i.message}`) };
}

// The preset file as the generator writes it (<name>.json of temoin generate, Save button
// of the page): default values included, without $schema.
export function presetJson(preset: Preset): string {
  const { $schema, ...used } = preset;
  return JSON.stringify(used, null, 2) + '\n';
}

export function presetJsonSchema(): Record<string, unknown> {
  return {
    title: 'Preset de témoin lumineux, v1',
    ...z.toJSONSchema(presetSchema, { io: 'input', target: 'draft-2020-12' }),
  };
}
