// The core legend gives back the Fusion mock-up's (its legende_dxf.py, outputs in ref/),
// whose prints are validated: same contours, point by point.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { LEGEND, layoutLegend, parseFont, ringArea, type InkPolygon, type Ring } from '../src/legend.ts';

const file = (p: string) => new URL(`../../${p}`, import.meta.url);
const bytes = readFileSync(file(`fonts/${LEGEND.fontFile}`));
const font = parseFont(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const WINDOW = { width: 27, height: 10.5 };
const mockup = JSON.parse(readFileSync(file('core/test/ref/alarme_legende.json'), 'utf8'));

function centroid(rings: Ring[]): [number, number] {
  let a = 0, cx = 0, cy = 0;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
      a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f;
    }
  }
  return [cx / (3 * a), cy / (3 * a)];
}

const area = (p: InkPolygon) => ringArea(p.outer) + p.holes.reduce((s, h) => s + ringArea(h), 0);

// DXF contours: one LWPOLYLINE per contour, vertices in codes 10 / 20.
function dxfRings(path: string): Ring[] {
  const lines = readFileSync(file(path), 'utf8').split(/\r?\n/).map((l) => l.trim());
  const rings: Ring[] = [];
  let ring: Ring | null = null;
  for (let i = 0; i + 1 < lines.length; i += 2) {
    const [code, value] = [lines[i], lines[i + 1]];
    if (code === '0') ring = value === 'LWPOLYLINE' ? (rings.push([]), rings[rings.length - 1]) : null;
    else if (ring && code === '10') ring.push([Number(value), NaN]);
    else if (ring && code === '20') ring[ring.length - 1][1] = Number(value);
  }
  return rings;
}

const key = (r: Ring) => r.map(([x, y]) => `${x.toFixed(6)},${y.toFixed(6)}`).sort().join(' ');

describe('ALARME, like the mock-up', () => {
  const lay = layoutLegend('ALARME', font, WINDOW);

  test('cap height and extent', () => {
    expect(lay.capHeight).toBeCloseTo(mockup.capHeight, 3);
    expect(lay.width).toBeCloseTo(mockup.width, 3);
    expect(lay.height).toBeCloseTo(mockup.height, 3);
    expect(lay.room).toBeCloseTo(LEGEND.margin, 6);
  });

  test('ink polygons and islands: areas and centres', () => {
    expect(lay.ink).toHaveLength(mockup.ink.length);
    expect(lay.islands).toHaveLength(mockup.islands.length);
    const ours = lay.ink.map((p) => ({ area: area(p), c: centroid([p.outer, ...p.holes]) }));
    for (const m of mockup.ink) {
      const o = ours.find((q) => Math.hypot(q.c[0] - m.cx, q.c[1] - m.cy) < 2e-3)!;
      expect(o.area).toBeCloseTo(m.area, 3);
    }
    for (const m of mockup.islands) {
      const o = lay.islands.find((r) => { const c = centroid([r]); return Math.hypot(c[0] - m.cx, c[1] - m.cy) < 2e-3; })!;
      expect(-ringArea(o)).toBeCloseTo(m.area, 3);
    }
  });

  test('same contours as the DXF, point by point (to the µm)', () => {
    const dxf = dxfRings('core/test/ref/alarme_legende.dxf').map(key).sort();
    const ours = lay.ink.flatMap((p) => [p.outer, ...p.holes]).map(key).sort();
    expect(ours).toEqual(dxf);
  });
});

describe('layout', () => {
  test('a long text shrinks to fit the width', () => {
    const lay = layoutLegend('OVERHEATING', font, WINDOW);
    expect(lay.capHeight).toBeLessThan(mockup.capHeight);
    expect(lay.width).toBeCloseTo(WINDOW.width - 2 * LEGEND.margin, 6);
  });

  test('accented letters', () => {
    expect(layoutLegend('CAFÉ', font, WINDOW).ink.length).toBeGreaterThanOrEqual(4);
  });

  test('character missing from the font', () => {
    expect(() => layoutLegend('A☃B', font, WINDOW)).toThrow('caractères absents de la police : ☃');
  });
});
