import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parsePreset, presetJsonSchema, type Preset } from '../src/preset.ts';

const read = (p: string) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const alarm = () => read('../../presets/alarme.json');

function errors(change: (p: any) => void): string[] {
  const p = alarm();
  change(p);
  const r = parsePreset(p);
  if (r.ok) throw new Error('preset wrongly accepted');
  return r.errors;
}

function ok(data: unknown): Preset {
  const r = parsePreset(data);
  if (!r.ok) throw new Error(r.errors.join('\n'));
  return r.preset;
}

describe('valid preset', () => {
  test('the alarme example passes as is', () => {
    const p = ok(alarm());
    expect(p.frame).toEqual({ width: 47, height: 18, color: '#4b5320' });
  });

  test('only the text and the panel thickness are required', () => {
    const p = ok({ version: 1, legend: { text: 'ALARME' }, panel: { thickness: 3 } });
    expect(p).toEqual({
      ...ok(alarm()),
      $schema: undefined,
      frame: { width: 47, height: 18, color: '#111111' },
    });
  });

  test('socket head, wires on the right, colours', () => {
    const p = ok({ ...alarm(), mount: { head: 'socket' }, light: { wireExit: 'right' }, legend: { text: 'CAFÉ', background: '#ffffff' } });
    expect(p.mount.head).toBe('socket');
    expect(p.light.wireExit).toBe('right');
    expect(p.legend.background).toBe('#ffffff');
  });
});

describe('invalid preset: one "path : message" line per error', () => {
  test.each([
    ['key outside v1', (p: any) => { p.mount.screw = 'M2.5'; }, 'mount : Clé non reconnue : "screw"'],
    ['misspelt key', (p: any) => { p.light.wireExits = 'left'; }, 'light : Clé non reconnue : "wireExits"'],
    ['unknown head', (p: any) => { p.mount.head = 'button'; }, 'mount.head : Option invalide : une valeur parmi "countersunk"|"socket" attendue'],
    ['unknown wire exit', (p: any) => { p.light.wireExit = 'back'; }, 'light.wireExit : Option invalide : une valeur parmi "left"|"right" attendue'],
    ['missing panel thickness', (p: any) => { delete p.panel.thickness; }, 'panel.thickness : obligatoire'],
    ['missing text', (p: any) => { delete p.legend; }, 'legend : obligatoire'],
    ['negative thickness', (p: any) => { p.panel.thickness = -3; }, 'panel.thickness : Trop petit : nombre doit être >0'],
    ['malformed colour', (p: any) => { p.frame.color = 'kaki'; }, 'frame.color : couleur attendue au format #rrggbb'],
    ['2 lines', (p: any) => { p.legend.text = 'READY\nARMED'; }, 'legend.text : une seule ligne en v1'],
    ['empty text', (p: any) => { p.legend.text = '  '; }, 'legend.text : texte vide'],
    ['other version', (p: any) => { p.version = 2; }, 'version : version de preset non prise en charge : ce générateur lit la v1'],
  ])('%s', (_, change, message) => {
    expect(errors(change)).toContain(message);
  });

  test('not an object', () => {
    expect(parsePreset([]).ok).toBe(false);
  });
});

test('presets/schema.json is up to date (npm run schema)', () => {
  expect(read('../../presets/schema.json')).toEqual(presetJsonSchema());
});
