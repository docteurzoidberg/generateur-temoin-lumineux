// The core parts give back those of the Fusion mock-up (STL of the validated prints, in
// ref/): volume and extent of each part.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';
import { measureVolume, type Shape3D } from 'replicad';
import { initOC } from '../src/occ-node.ts';
import { parsePreset, type Preset } from '../src/preset.ts';
import { dimensions, screwLength, M3 } from '../src/dims.ts';
import { LEGEND, layoutLegend, parseFont } from '../src/legend.ts';
import * as parts from '../src/parts.ts';
import { stlStats } from './stl.ts';

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

const size = (s: Shape3D) => { const b = s.boundingBox; return [b.width, b.height, b.depth].sort((x, y) => y - x); };

beforeAll(() => initOC(), 30000);

describe('computed dimensions', () => {
  test('alarme: M3 × 10 screws 37 mm apart, 4 LEDs, 35.98 box', () => {
    const d = dimensions(preset());
    expect(d.screwSpacing).toBe(37);
    expect(d.ledCount).toBe(4);
    expect(d.boxW).toBeCloseTo(35.978, 3);
    expect(screwLength(d)).toBe(10);
    expect(screwLength(dimensions(preset((p) => { p.mount.head = 'socket'; })))).toBe(10);
  });

  test('panel too thick: no off-the-shelf screw', () => {
    expect(screwLength(dimensions(preset((p) => { p.panel.thickness = 30; })))).toBeNull();
  });
});

describe('parity with the mock-up (volume within 0.05 %, extent within 0.01 mm)', () => {
  let built: Record<string, Shape3D>;
  beforeAll(() => {
    const p = preset();
    const d = dimensions(p);
    const { mask, veil } = parts.legend(d, layoutLegend(p.legend.text, font, { width: d.windowW, height: d.windowH }));
    built = { cadre: parts.frame(d), legende_masque: mask, legende_voile: veil, boite: parts.box(d), fond: parts.cover(d), panneau_essai: parts.testPanel(d) };
  }, 60000);

  test.each(['cadre', 'legende_masque', 'legende_voile', 'boite', 'fond', 'panneau_essai'])('%s', (name) => {
    const ref = stlStats(file(`core/test/ref/alarme_${name}.stl`));
    expect(Math.abs(measureVolume(built[name]) / ref.volume - 1)).toBeLessThan(5e-4);
    size(built[name]).forEach((v, i) => expect(Math.abs(v - ref.size[i])).toBeLessThan(0.01));
  });
});

describe('variants outside the mock-up', () => {
  test('socket head: straight hole, no countersink', () => {
    const csk = measureVolume(parts.frame(dimensions(preset())));
    const socket = measureVolume(parts.frame(dimensions(preset((p) => { p.mount.head = 'socket'; }))));
    // 90° countersink: truncated cone from the countersink Ø to the clearance Ø, minus the clearance.
    const [R, r, h] = [M3.cskD / 2, M3.holeD / 2, (M3.cskD - M3.holeD) / 2];
    const sink = (Math.PI * h * (R * R + R * r + r * r)) / 3 - Math.PI * r * r * h;
    expect(socket - csk).toBeCloseTo(2 * sink, 2);
  });

  test('wires on the right: box and cover mirror those on the left', () => {
    const [left, right] = [preset(), preset((p) => { p.light.wireExit = 'right'; })].map(dimensions);
    for (const build of [parts.box, parts.cover]) {
      const [l, r] = [build(left), build(right)];
      expect(measureVolume(l.cut(r))).toBeGreaterThan(1);
      expect(measureVolume(l.cut(r.mirror('YZ')))).toBeLessThan(1e-6);
    }
  }, 60000);
});
