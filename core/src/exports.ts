// Output files of the indicator, as bytes (the core writes nothing), identical from one
// generation to the next:
// - <name>_<part>.stl: oriented for printing like the mock-up's orient_stl.py (front
//   face on the bed: frame, legend, test panel; back: box, cover); the parts of a group
//   (mask and veil) keep a common frame of reference;
// - <name>_<print>.3mf: generic 3MF like the mock-up's export_3mf.py, one part per
//   colour, without any slicer setting;
// - <name>.step: named and coloured assembly, in the indicator frame, for integration;
// - <name>.json: the preset used, default values included.
// Part names and labels end up in file names and slicers: they stay in French.
import { strToU8, zipSync } from 'fflate';
import { exportSTEP, type Shape3D } from 'replicad';
import type { Parts } from './parts.ts';
import { presetJson, type Preset } from './preset.ts';

const MESH = { tolerance: 0.01, angularTolerance: 0.1 };
const WHITE = '#f4f4f0', BLACK = '#111111';
const FREE = '#8e9189';   // filament left to the user (test panel)

type Tri = number[];   // 3 vertices in a row: x, y, z
type Side = 'face' | 'back';
export interface PieceInfo { name: string; label: string; part: keyof Parts; side: Side; group: string; color: string }
interface Piece extends PieceInfo { shape: Shape3D }

// The printed pieces, in assembly order from front to back, with their file name, label
// and colour; the preview shows the same ones.
export function pieceInfo(p: Preset): PieceInfo[] {
  return [
    { name: 'cadre', label: 'cadre', part: 'frame', side: 'face', group: 'cadre', color: p.frame.color },
    { name: 'legende_masque', label: 'masque', part: 'mask', side: 'face', group: 'legende', color: p.legend.background },
    { name: 'legende_voile', label: 'lettres et voile', part: 'veil', side: 'face', group: 'legende', color: WHITE },
    { name: 'boite', label: 'boîte', part: 'box', side: 'back', group: 'boite', color: BLACK },
    { name: 'fond', label: 'fond', part: 'cover', side: 'back', group: 'fond', color: BLACK },
    { name: 'panneau_essai', label: "panneau d'essai (au choix)", part: 'testPanel', side: 'face', group: 'panneau_essai', color: FREE },
  ];
}

const pieces = (p: Preset, parts: Parts): Piece[] => pieceInfo(p).map((info) => ({ ...info, shape: parts[info.part] }));

// 3MF prints: objects, each made of one or more parts (one per colour).
const JOBS: Record<string, [string, string[]][]> = {
  legende: [['legende', ['legende_masque', 'legende_voile']]],
  boite_fond: [['boite', ['boite']], ['fond', ['fond']]],
  cadre: [['cadre', ['cadre']]],
  panneau_essai: [['panneau_essai', ['panneau_essai']]],
};
const PLATE_CENTER = [100, 100];   // assumed bed centre (mm), to rearrange when slicing
const GAP = 5;                     // gap between the objects of a print (mm)

// 90° rotation about X: the wanted face goes down (minimal z).
function oriented(s: Shape3D, side: Side): Tri[] {
  const m = s.mesh(MESH);
  const tris: Tri[] = [];
  for (let i = 0; i < m.triangles.length; i += 3) {
    const t: Tri = [];
    for (let k = 0; k < 3; k++) {
      const v = 3 * m.triangles[i + k];
      const [x, y, z] = [m.vertices[v], m.vertices[v + 1], m.vertices[v + 2]];
      t.push(...(side === 'face' ? [x, -z, y] : [x, z, -y]));
    }
    tris.push(t);
  }
  return tris;
}

function bounds(tris: Tri[]): [number[], number[]] {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const t of tris) for (let i = 0; i < 9; i++) { lo[i % 3] = Math.min(lo[i % 3], t[i]); hi[i % 3] = Math.max(hi[i % 3], t[i]); }
  return [lo, hi];
}

// Watertight (each edge seen once in each direction) and of positive volume, else an error.
function checkMesh(name: string, tris: Tri[]): void {
  const key = (t: Tri, i: number) => `${t[i].toFixed(4)},${t[i + 1].toFixed(4)},${t[i + 2].toFixed(4)}`;
  const edges = new Map<string, number>();
  let vol = 0;
  for (const t of tris) {
    const [a, b, c] = [key(t, 0), key(t, 3), key(t, 6)];
    for (const e of [`${a}|${b}`, `${b}|${c}`, `${c}|${a}`]) edges.set(e, (edges.get(e) ?? 0) + 1);
    vol += (t[0] * (t[4] * t[8] - t[7] * t[5]) - t[3] * (t[1] * t[8] - t[7] * t[2]) + t[6] * (t[1] * t[5] - t[4] * t[2])) / 6;
  }
  const bad = [...edges].filter(([e, n]) => { const [a, b] = e.split('|'); return n !== 1 || edges.get(`${b}|${a}`) !== 1; });
  if (bad.length || vol <= 0) throw new Error(`${name}: invalid mesh (${bad.length} edges, volume ${vol.toFixed(1)})`);
}

function stlBytes(tris: Tri[]): Uint8Array {
  const out = new Uint8Array(84 + 50 * tris.length);
  out.set(strToU8('generateur-temoin-lumineux'.padEnd(80, ' ')));
  const dv = new DataView(out.buffer);
  dv.setUint32(80, tris.length, true);
  tris.forEach((t, i) => t.forEach((v, k) => dv.setFloat32(84 + 50 * i + 12 + 4 * k, v, true)));
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = (v: number) => String(Number(v.toFixed(4)));

function meshXml(id: number, name: string, pindex: number, tris: Tri[]): string {
  // Unique vertices, indexed triangles; degenerate triangles dropped.
  const index = new Map<string, number>(), verts: string[] = [], faces: string[] = [];
  for (const t of tris) {
    const f = [0, 3, 6].map((i) => {
      const k = `${num(t[i])} ${num(t[i + 1])} ${num(t[i + 2])}`;
      if (!index.has(k)) { index.set(k, verts.length); verts.push(k); }
      return index.get(k)!;
    });
    if (new Set(f).size === 3) faces.push(`     <triangle v1="${f[0]}" v2="${f[1]}" v3="${f[2]}"/>`);
  }
  const v = verts.map((k) => { const [x, y, z] = k.split(' '); return `     <vertex x="${x}" y="${y}" z="${z}"/>`; });
  return `  <object id="${id}" type="model" name="${esc(name)}" pid="1" pindex="${pindex}">\n   <mesh>\n    <vertices>\n${v.join('\n')}\n    </vertices>\n`
    + `    <triangles>\n${faces.join('\n')}\n    </triangles>\n   </mesh>\n  </object>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>
`;
const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
`;
const ZIP_DATE = new Date(1980, 0, 1);   // fixed date: identical files from one generation to the next

function threeMf(title: string, objects: [string, { label: string; color: string; tris: Tri[] }[]][]): Uint8Array {
  const mats: string[] = [], res: string[] = [], layout: [number, number[], number[]][] = [];
  let id = 2;   // 1: the materials
  for (const [name, parts] of objects) {
    const ids = parts.map((p) => {
      const mat = `${p.label}|${p.color}`;
      if (!mats.includes(mat)) mats.push(mat);
      res.push(meshXml(id, parts.length > 1 ? p.label : name, mats.indexOf(mat), p.tris));
      return id++;
    });
    if (ids.length > 1) {   // multi-filament object: one part per colour, same frame
      res.push(`  <object id="${id}" type="model" name="${esc(name)}">\n   <components>\n`
        + ids.map((i) => `    <component objectid="${i}"/>`).join('\n') + '\n   </components>\n  </object>');
      ids.splice(0, ids.length, id++);
    }
    layout.push([ids[0], ...bounds(parts.flatMap((p) => p.tris))]);
  }
  // Objects in a row along X, the whole centred on the bed.
  const width = layout.reduce((w, [, lo, hi]) => w + hi[0] - lo[0], 0) + GAP * (layout.length - 1);
  let x = PLATE_CENTER[0] - width / 2;
  const items = layout.map(([i, lo, hi]) => {
    const item = `  <item objectid="${i}" transform="1 0 0 0 1 0 0 0 1 ${num(x - lo[0])} ${num(PLATE_CENTER[1] - (lo[1] + hi[1]) / 2)} 0"/>`;
    x += hi[0] - lo[0] + GAP;
    return item;
  });
  const bases = mats.map((m) => { const [label, color] = m.split('|'); return `   <base name="${esc(label)}" displaycolor="${color.toUpperCase()}FF"/>`; });
  const model = `<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="fr-FR" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">\n`
    + ` <metadata name="Title">${esc(title)}</metadata>\n <metadata name="Application">generateur-temoin-lumineux</metadata>\n`
    + ` <resources>\n  <basematerials id="1">\n${bases.join('\n')}\n  </basematerials>\n${res.join('\n')}\n </resources>\n`
    + ` <build>\n${items.join('\n')}\n </build>\n</model>\n`;
  const entry = (s: string) => [strToU8(s), { mtime: ZIP_DATE }] as [Uint8Array, { mtime: Date }];
  return zipSync({ '[Content_Types].xml': entry(CONTENT_TYPES), '_rels/.rels': entry(RELS), '3D/3dmodel.model': entry(model) }, { level: 6 });
}

// OpenCascade reads colours as linear RGB and writes sRGB in the STEP: without a
// conversion, Fusion shows them too light.
function linear(hex: string): string {
  return '#' + [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    const l = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    return Math.round(l * 255).toString(16).padStart(2, '0');
  }).join('');
}

// OpenCascade writes the presentation (colours) last, one block per part, in the order of
// a table sorted by memory address: the order changes as soon as parts are rebuilt (page
// previews, another JavaScript engine). It is rewritten in a fixed order: blocks sorted by
// what they colour, entities renumbered in reading order.
function stableStyles(text: string): string {
  const start = text.search(/^#\d+ = MECHANICAL_DESIGN_GEOMETRIC_PRESENTATION_REPRESENTATION\(/m);
  if (start < 0) return text;
  const end = text.indexOf('ENDSEC;', start);
  const body = new Map<number, string>();
  for (const m of text.slice(start, end).matchAll(/#(\d+) = ([^;]*);/g)) body.set(+m[1], m[2].replace(/\s*\n\s*/g, ''));
  const refs = (s: string) => [...s.matchAll(/#(\d+)/g)].map((m) => +m[1]).filter((id) => body.has(id));
  const referenced = new Set([...body.values()].flatMap(refs));
  const key = (id: number) => body.get(id)!.replace(/#(\d+)/g, (r, n) => (body.has(+n) ? '#' : r));   // references outside the section only
  const roots = [...body.keys()].filter((id) => !referenced.has(id)).sort((a, b) => key(a).localeCompare(key(b)));
  const renum = new Map<number, number>();
  const visit = (id: number) => {
    if (renum.has(id)) return;
    renum.set(id, Math.min(...body.keys()) + renum.size);
    refs(body.get(id)!).forEach(visit);
  };
  roots.forEach(visit);
  const lines = [...renum].map(([id, n]) => `#${n} = ${body.get(id)!.replace(/#(\d+)/g, (r, k) => (renum.has(+k) ? `#${renum.get(+k)}` : r))};`);
  return text.slice(0, start) + lines.join('\n') + '\n' + text.slice(end);
}

async function step(name: string, list: Piece[]): Promise<Uint8Array> {
  const shapes = list.filter((p) => p.name !== 'panneau_essai')
    .map((p) => ({ shape: p.shape, name: p.name.replace('legende_', ''), color: linear(p.color) }));
  const text = new TextDecoder().decode(await exportSTEP(shapes).arrayBuffer());
  // Header without date or temporary file name.
  return strToU8(stableStyles(text).replace(/FILE_NAME\('[^']*','[^']*'/, `FILE_NAME('${name}','1980-01-01T00:00:00'`));
}

export async function exportFiles(name: string, preset: Preset, parts: Parts): Promise<Record<string, Uint8Array>> {
  const list = pieces(preset, parts);
  const tris = new Map(list.map((p) => [p.name, oriented(p.shape, p.side)]));
  // Common translation for each group: centred in XY, resting at z = 0.
  const groups = new Map<string, [number[], number[]]>();
  for (const p of list) {
    const [lo, hi] = bounds(tris.get(p.name)!);
    const g = groups.get(p.group);
    groups.set(p.group, g ? [lo.map((v, k) => Math.min(v, g[0][k])), hi.map((v, k) => Math.max(v, g[1][k]))] : [lo, hi]);
  }
  const files: Record<string, Uint8Array> = {};
  for (const p of list) {
    const [lo, hi] = groups.get(p.group)!;
    const d = [-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]];
    const moved = tris.get(p.name)!.map((t) => t.map((v, i) => v + d[i % 3]));
    checkMesh(p.name, moved);
    tris.set(p.name, moved);
    files[`${name}_${p.name}.stl`] = stlBytes(moved);
  }
  const byName = new Map(list.map((p) => [p.name, p]));
  for (const [job, objects] of Object.entries(JOBS)) {
    files[`${name}_${job}.3mf`] = threeMf(`${name} ${job}`, objects.map(([obj, names]) =>
      [obj, names.map((n) => ({ label: byName.get(n)!.label, color: byName.get(n)!.color, tris: tris.get(n)! }))]));
  }
  files[`${name}.step`] = await step(name, list);
  files[`${name}.json`] = strToU8(presetJson(preset));
  return files;
}
