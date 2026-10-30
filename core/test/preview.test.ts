// Preview meshes: the printed pieces in assembly order, within the bounds of the exported
// solids; the cache only rebuilds what changed.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';
import { initOC } from '../src/occ-node.ts';
import { parsePreset, type Preset } from '../src/preset.ts';
import { dimensions } from '../src/dims.ts';
import { LEGEND, layoutLegend, parseFont } from '../src/legend.ts';
import { buildParts } from '../src/parts.ts';
import { previewParts, type PartMesh, type PreviewCache } from '../src/preview.ts';

const file = (p: string) => new URL(`../../${p}`, import.meta.url);
const bytes = readFileSync(file(`fonts/${LEGEND.fontFile}`));
const font = parseFont(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));

function preset(change: (p: any) => void = () => {}): Preset {
  const p = JSON.parse(readFileSync(file('presets/alarme.json'), 'utf8'));
  change(p);
  const r = parsePreset(p);
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r.preset;
}

function preview(p: Preset, cache?: PreviewCache) {
  const d = dimensions(p);
  return previewParts(p, d, layoutLegend(p.legend.text, font, { width: d.windowW, height: d.windowH }), cache);
}

function bounds(m: PartMesh): number[][] {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  m.vertices.forEach((v, i) => { lo[i % 3] = Math.min(lo[i % 3], v); hi[i % 3] = Math.max(hi[i % 3], v); });
  return [lo, hi];
}

beforeAll(() => initOC(), 30000);

describe('alarme', () => {
  let result: ReturnType<typeof preview>;
  beforeAll(() => { result = preview(preset()); }, 60000);

  test('the printed pieces, in assembly order, with their label and colour', () => {
    expect(result.parts.map((p) => p.name)).toEqual(['cadre', 'legende_masque', 'legende_voile', 'boite', 'fond', 'panneau_essai']);
    expect(result.parts[0]).toMatchObject({ label: 'cadre', color: '#4b5320' });
    expect(result.built).toEqual(['frame', 'mask+veil', 'box', 'cover', 'testPanel']);
  });

  test('consistent meshes', () => {
    for (const p of result.parts) {
      expect(p.vertices.length % 3).toBe(0);
      expect(p.normals.length).toBe(p.vertices.length);
      expect(p.triangles.length % 3).toBe(0);
      expect(Math.max(...p.triangles)).toBeLessThan(p.vertices.length / 3);
      expect(p.edges.length % 6).toBe(0);
      expect(p.edges.length).toBeGreaterThan(0);
    }
  });

  test('within the bounds of the exported solids (0.01 mm)', () => {
    const p = preset(), d = dimensions(p);
    const parts = buildParts(d, layoutLegend(p.legend.text, font, { width: d.windowW, height: d.windowH }));
    const solids = [parts.frame, parts.mask, parts.veil, parts.box, parts.cover, parts.testPanel];
    result.parts.forEach((m, i) => {
      const [lo, hi] = bounds(m), [blo, bhi] = solids[i].boundingBox.bounds;
      for (let k = 0; k < 3; k++) {
        expect(Math.abs(lo[k] - blo[k]), `${m.name} min ${k}`).toBeLessThan(0.01);
        expect(Math.abs(hi[k] - bhi[k]), `${m.name} max ${k}`).toBeLessThan(0.01);
      }
    });
  }, 60000);
});

test('cache: a new text rebuilds the legend only, a colour nothing, a frame size what it holds', () => {
  const cache: PreviewCache = new Map();
  preview(preset(), cache);
  expect(preview(preset((p) => { p.legend.text = 'CLAUDE'; }), cache).built).toEqual(['mask+veil']);
  const recoloured = preview(preset((p) => { p.legend.text = 'CLAUDE'; p.frame.color = '#5c623c'; }), cache);
  expect(recoloured.built).toEqual([]);
  expect(recoloured.parts[0].color).toBe('#5c623c');
  expect(preview(preset((p) => { p.legend.text = 'CLAUDE'; p.frame.width = 50; }), cache).built).toEqual(['frame', 'box', 'testPanel']);
  expect(preview(preset((p) => { p.legend.text = 'CLAUDE'; p.frame.width = 50; p.light.wireExit = 'right'; }), cache).built).toEqual(['box', 'cover']);
}, 60000);
