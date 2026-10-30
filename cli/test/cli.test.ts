// The temoin command, run for real: exit codes, messages, written files.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const BIN = new URL('../bin/temoin.ts', import.meta.url).pathname;
const ALARM = new URL('../../presets/alarme.json', import.meta.url).pathname;
const run = (...args: string[]) => spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });

function presetFile(change: (p: any) => void): string {
  const p = JSON.parse(readFileSync(ALARM, 'utf8'));
  delete p.$schema;
  change(p);
  const f = join(mkdtempSync(join(tmpdir(), 'temoin-')), 'sample.json');
  writeFileSync(f, JSON.stringify(p));
  return f;
}

describe('temoin check', () => {
  test('alarme: valid, hardware summary', () => {
    const r = run('check', ALARM);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('✓ vis M3 × 10 (tête fraisée, ISO 10642)');
    expect(r.stdout).toContain('4 LED de ruban WS2812B à 144 LED/m');
  });

  test('--json for the skill', () => {
    const out = JSON.parse(run('check', ALARM, '--json').stdout);
    expect(out).toMatchObject({ name: 'alarme', ok: true, summary: { screws: { length: 10 }, leds: { count: 4 }, cutout: { size: [29.8, 13.3], holes: { spacing: 37 } } } });
  });

  test.each([
    ['invalid preset', (p: any) => { p.mount.screw = 'M2.5'; }, '✗ mount : Clé non reconnue : "screw"'],
    ['missing character', (p: any) => { p.legend.text = 'A☃B'; }, '✗ légende : caractères absents de la police : ☃'],
    ['panel too thick', (p: any) => { p.panel.thickness = 30; }, '✗ aucune vis M3 du commerce ne convient pour un panneau de 30,0 mm'],
  ])('%s: exit code 1', (_, change, message) => {
    const r = run('check', presetFile(change));
    expect(r.status).toBe(1);
    expect(r.stdout).toContain(message);
  });

  test('missing file: exit code 1; bad usage: exit code 2', () => {
    expect(run('check', '/nulle/part.json').status).toBe(1);
    expect(run('frobnicate', ALARM).status).toBe(2);
    expect(run('check').status).toBe(2);
  });
});

test('temoin generate: 12 files in export/ next to the preset', () => {
  const f = presetFile((p) => { p.legend.text = 'CAFÉ'; });
  const r = run('generate', f);
  expect(r.status, r.stderr).toBe(0);
  const dir = join(f, '..', 'export');
  expect(readdirSync(dir)).toHaveLength(12);
  expect(readdirSync(dir)).toContain('sample_legende.3mf');
}, 60000);
