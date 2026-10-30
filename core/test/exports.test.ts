// Output files: STL oriented and placed like the mock-up's, generic 3MF, readable STEP, all
// identical from one generation to the next.
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { importSTEP, measureVolume, type Shape3D } from 'replicad';
import { initOC } from '../src/occ-node.ts';
import { parsePreset } from '../src/preset.ts';
import { dimensions } from '../src/dims.ts';
import { LEGEND, layoutLegend, parseFont } from '../src/legend.ts';
import { buildParts, type Parts } from '../src/parts.ts';
import { exportFiles } from '../src/exports.ts';
import { stlStats } from './stl.ts';

const file = (p: string) => new URL(`../../${p}`, import.meta.url);
const bytes = readFileSync(file(`fonts/${LEGEND.fontFile}`));
const font = parseFont(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const r = parsePreset(JSON.parse(readFileSync(file('presets/alarme.json'), 'utf8')));
if (!r.ok) throw new Error(r.errors.join('\n'));
const preset = r.preset;

let parts: Parts;
let files: Record<string, Uint8Array>;
beforeAll(async () => {
  await initOC();
  const d = dimensions(preset);
  parts = buildParts(d, layoutLegend(preset.legend.text, font, { width: d.windowW, height: d.windowH }));
  files = await exportFiles('alarme', preset, parts);
}, 60000);

test('output files', () => {
  expect(Object.keys(files).sort()).toEqual([
    'alarme.json', 'alarme.step',
    'alarme_boite.stl', 'alarme_boite_fond.3mf', 'alarme_cadre.3mf', 'alarme_cadre.stl', 'alarme_fond.stl',
    'alarme_legende.3mf', 'alarme_legende_masque.stl', 'alarme_legende_voile.stl',
    'alarme_panneau_essai.3mf', 'alarme_panneau_essai.stl',
  ]);
});

describe('STL: oriented and placed like the mock-up', () => {
  test.each(['cadre', 'legende_masque', 'legende_voile', 'boite', 'fond', 'panneau_essai'])('%s', (name) => {
    const ours = stlStats(files[`alarme_${name}.stl`]);
    const ref = stlStats(file(`core/test/ref/alarme_${name}.stl`));
    for (let k = 0; k < 3; k++) {
      expect(Math.abs(ours.lo[k] - ref.lo[k])).toBeLessThan(0.01);
      expect(Math.abs(ours.hi[k] - ref.hi[k])).toBeLessThan(0.01);
    }
    expect(Math.abs(ours.volume / ref.volume - 1)).toBeLessThan(5e-4);
  });
});

test('legend 3MF: one object of 2 parts, preset colours', () => {
  const z = unzipSync(files['alarme_legende.3mf']);
  expect(Object.keys(z).sort()).toEqual(['3D/3dmodel.model', '[Content_Types].xml', '_rels/.rels']);
  const model = strFromU8(z['3D/3dmodel.model']);
  expect(model.match(/<object /g)).toHaveLength(3);
  expect(model.match(/<item /g)).toHaveLength(1);
  expect(model).toContain('name="masque" displaycolor="#111111FF"');
  expect(model).toContain('name="lettres et voile" displaycolor="#F4F4F0FF"');
});

test('frame 3MF: its colour', () => {
  expect(strFromU8(unzipSync(files['alarme_cadre.3mf'])['3D/3dmodel.model'])).toContain('displaycolor="#4B5320FF"');
});

test('STEP: 5 parts read back, exact volumes, frame colour kept', async () => {
  const text = strFromU8(files['alarme.step']);
  expect(text).toContain("FILE_NAME('alarme','1980-01-01T00:00:00'");
  for (const n of ['cadre', 'masque', 'voile', 'boite', 'fond']) expect(text).toContain(`'${n}'`);
  // #4b5320 = (0.294, 0.325, 0.125) in sRGB: found again within quantisation (8-bit
  // linear conversion).
  const colours = [...text.matchAll(/COLOUR_RGB\('',([^,]+),([^,]+),\s*([^)]+)\)/g)].map((m) => m.slice(1, 4).map(Number));
  expect(colours.some((c) => [75, 83, 32].every((v, i) => Math.abs(c[i] - v / 255) < 0.01))).toBe(true);
  const back = await importSTEP(new Blob([new Uint8Array(files['alarme.step'])])) as Shape3D;
  const expected = [parts.frame, parts.mask, parts.veil, parts.box, parts.cover].reduce((s, p) => s + measureVolume(p), 0);
  expect(measureVolume(back)).toBeCloseTo(expected, 3);
});

test('identical from one generation to the next', async () => {
  const again = await exportFiles('alarme', preset, parts);
  for (const [name, data] of Object.entries(files)) expect(Buffer.compare(Buffer.from(again[name]), Buffer.from(data)), name).toBe(0);
});

// The page rebuilds the parts on every input: the STEP must not depend on the state of
// OpenCascade's memory (the colour presentation is sorted by address there).
test('identical with parts rebuilt after other computations', async () => {
  const build = (text: string) => {
    const d = dimensions({ ...preset, legend: { ...preset.legend, text } });
    return buildParts(d, layoutLegend(text, font, { width: d.windowW, height: d.windowH }));
  };
  build('OVERHEATING');
  const again = await exportFiles('alarme', preset, build(preset.legend.text));
  for (const [name, data] of Object.entries(files)) expect(Buffer.compare(Buffer.from(again[name]), Buffer.from(data)), name).toBe(0);
}, 60000);
