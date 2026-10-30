// The page, built by Vite and opened in headless Chromium, against the temoin command: for
// the same preset, same checks (temoin check) and same files (temoin generate), whether it
// is typed in, opened, dropped or reopened from its link. One page for all cases: each
// settings case then restores the alarme settings. Expected texts are the page's, in
// French.
import { execFile, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { unzipSync } from 'fflate';
import { chromium, type Browser, type Page } from 'playwright-core';
import { parsePreset, presetJson } from '@temoin/core';
import { build, preview, type PreviewServer } from 'vite';
import { afterAll, beforeAll, expect, test } from 'vitest';

const WEB = new URL('..', import.meta.url).pathname;
const BIN = new URL('../../cli/bin/temoin.ts', import.meta.url).pathname;
const ALARM = new URL('../../presets/alarme.json', import.meta.url).pathname;
const alarm = JSON.parse(readFileSync(ALARM, 'utf8'));
const MARK = { ok: '✓', warn: '⚠', error: '✗' } as const;
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const runCli = (...args: string[]) => spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });

// A preset where every key differs from the example, and an invalid preset.
const PUMP = {
  version: 1, legend: { text: 'PUMP 2', background: '#202020' }, window: { width: 30, height: 12 },
  frame: { width: 50, height: 20, color: '#7a3b2e' }, panel: { thickness: 2 }, mount: { head: 'socket' }, light: { wireExit: 'right' },
};
const INVALID = { version: 1, legend: { text: 'X', background: 'red' }, frame: { widht: 40 }, panel: { thickness: -2 }, mount: { head: 'hex' } };

// Playwright's headless Chromium, already installed (no download).
function headlessShell(): string {
  const cache = join(homedir(), '.cache/ms-playwright');
  const dir = readdirSync(cache).find((d) => d.startsWith('chromium_headless_shell'));
  if (!dir) throw new Error(`no headless Chromium in ${cache}: npx playwright install chromium-headless-shell`);
  return join(cache, dir, 'chrome-headless-shell-linux64/chrome-headless-shell');
}

let out: string, server: PreviewServer, browser: Browser, page: Page;
const errors: string[] = [];

beforeAll(async () => {
  out = mkdtempSync(join(tmpdir(), 'temoin-web-'));
  const config = { root: WEB, logLevel: 'error' as const, build: { outDir: join(out, 'dist') } };
  await build(config);
  server = await preview({ ...config, preview: { port: 0 } });
  // WebGL of the 3D view: software rendering in headless Chromium.
  browser = await chromium.launch({ executablePath: headlessShell(), args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  context.on('weberror', (e) => errors.push(e.error().message));
  context.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page = await context.newPage();
  await page.goto(server.resolvedUrls!.local[0]);
}, 60000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  expect(errors).toEqual([]);   // no error in the page console
});

// Preset written to a temporary file, under this name.
function presetFile(name: string, preset: object): string {
  const f = join(mkdtempSync(join(out, 'preset-')), name);
  writeFileSync(f, JSON.stringify(preset));
  return f;
}

// Lines of temoin check for a preset (object, or file).
function cliLines(preset: object | string): string[] {
  const f = typeof preset === 'string' ? preset : presetFile('sample.json', preset);
  return JSON.parse(runCli('check', f, '--json').stdout).checks.map((c: { level: keyof typeof MARK; message: string }) => `${MARK[c.level]} ${c.message}`);
}

const linesOf = (p: Page) => p.locator('#checks li').allTextContents();
const pageLines = () => linesOf(page);
const fieldValues = (p: Page) => p.locator('#fields').locator('input, select').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
const presetStatus = () => page.locator('#preset-status').textContent();

async function openFile(path: string): Promise<void> {
  await page.locator('#file').setInputFiles(path);
  await expect.poll(presetStatus).toBe(`Ouvert : ${basename(path)}`);
}

// File dropped on the page: drag over (the drop zone shows), then drop.
async function dropFile(path: string): Promise<void> {
  const dataTransfer = await page.evaluateHandle(([name, text]) => {
    const dt = new DataTransfer();
    dt.items.add(new File([text], name, { type: 'application/json' }));
    return dt;
  }, [basename(path), readFileSync(path, 'utf8')]);
  await page.dispatchEvent('.layout', 'dragover', { dataTransfer });
  expect(await page.locator('#drop').isVisible()).toBe(true);
  await page.dispatchEvent('#drop', 'drop', { dataTransfer });
  expect(await page.locator('#drop').isHidden()).toBe(true);
  await expect.poll(presetStatus).toBe(`Ouvert : ${basename(path)}`);
}

test('alarme: 3D view first, the six printed pieces of the core; checks of temoin check, mounting, front view', async () => {
  expect(await page.getByRole('button', { name: '3D', exact: true }).getAttribute('aria-pressed')).toBe('true');
  await expect.poll(() => page.locator('#stage3d').getAttribute('data-built'), { timeout: 60000 }).toBe('frame mask+veil box cover testPanel');
  expect(await page.locator('#stage3d canvas').count()).toBe(1);
  expect(await page.locator('#pieces .piece').allTextContents()).toEqual(['cadre', 'masque', 'lettres et voile', 'boîte', 'fond', "panneau d'essai (au choix)"]);
  await expect.poll(pageLines, { timeout: 10000 }).toEqual(cliLines(alarm));
  expect(await page.locator('#summary').textContent()).toContain('découpe 29,8 × 13,3, 2 trous Ø 3,4 à 37 d\'entraxe');

  await page.getByRole('button', { name: 'Face', exact: true }).click();
  expect(await page.locator('#stage3d').isHidden()).toBe(true);
  expect(await page.locator('#face path.ink').getAttribute('d')).toMatch(/^M[-\d.]+ [-\d.]+L/);
  expect(await page.locator('#face .screw').count()).toBe(2);
}, 90000);

test('light: letters in the light colour with their halo, white veil when off', async () => {
  const look = () => page.locator('#face').evaluate((svg) => {
    const ink = svg.querySelector<SVGElement>('.ink')!, halo = svg.querySelector<SVGElement>('.halo')!;
    return { ink: ink.style.fill, halo: halo.style.fill, opacity: Number(halo.style.opacity) };
  });
  const pressed = (group: string) => page.locator(`${group} button[aria-pressed="true"]`).evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label') ?? b.textContent));
  expect(await pressed('#light-state')).toEqual(['Fixe']);
  await page.getByRole('button', { name: 'Ambre' }).click();
  expect(await pressed('#light-colors')).toEqual(['Ambre']);
  const amber = await look();
  expect([amber.ink, amber.halo]).toEqual(['rgb(255, 204, 89)', 'rgb(255, 176, 0)']);   // a little whiter at the core
  expect(amber.opacity).toBeGreaterThan(0.8);
  await page.getByRole('button', { name: 'Blanc' }).click();
  expect((await look()).opacity).toBeLessThan(amber.opacity);   // bright colour: halo held back

  await page.getByRole('button', { name: 'Éteinte' }).click();
  expect(await look()).toEqual({ ink: 'rgb(207, 205, 196)', halo: 'rgb(255, 255, 255)', opacity: 0 });
  await page.getByRole('button', { name: 'Vert' }).click();   // a colour lights it again
  expect(await pressed('#light-state')).toEqual(['Fixe']);
  expect((await look()).halo).toBe('rgb(0, 224, 64)');
  await page.getByRole('button', { name: 'Blanc' }).click();
});

test.each([
  ['frame too small', 'Largeur du cadre', '35', '47', (p: any) => { p.frame.width = 35; }],
  ['window too wide', 'Largeur de la fenêtre', '45', '27', (p: any) => { p.window.width = 45; }],
  ['no screw fits', 'Panneau', '30', '3', (p: any) => { p.panel.thickness = 30; }],
  ['panel without thickness', 'Panneau', '', '3', (p: any) => { delete p.panel.thickness; }],
])('%s: checks of temoin check, download blocked', async (_, label, value, original, change) => {
  const field = page.getByLabel(label, { exact: true });
  await field.fill(value);
  const preset = structuredClone(alarm);
  change(preset);
  await expect.poll(pageLines, { timeout: 10000 }).toEqual(cliLines(preset));
  expect(await page.locator('#download').isDisabled()).toBe(true);
  await field.fill(original);
  await expect.poll(pageLines, { timeout: 10000 }).toEqual(cliLines(alarm));
}, 30000);

test('number fields: the whole value in sight, up to 6 characters', async () => {
  const fields = page.locator('#fields input[type="number"]');
  const original = await fields.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  const cut = () => fields.evaluateAll((els) => els.filter((e) => e.scrollWidth > e.clientWidth).length);
  expect(original).toContain('10.5');
  expect(await cut()).toBe(0);
  for (const f of await fields.all()) await f.fill('100.25');
  expect(await cut()).toBe(0);
  for (const [i, f] of (await fields.all()).entries()) await f.fill(original[i]);
  await expect.poll(pageLines, { timeout: 10000 }).toEqual(cliLines(alarm));
}, 30000);

test('alarme: the page zip holds the files of temoin generate', async () => {
  const cli = join(out, 'cli');
  const generated = promisify(execFile)(process.execPath, [BIN, 'generate', ALARM, '-o', cli]);   // at the same time as the page
  const button = page.getByRole('button', { name: 'Télécharger le zip' });
  await expect.poll(() => button.isEnabled(), { timeout: 30000 }).toBe(true);
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), button.click()]);
  expect(download.suggestedFilename()).toBe('alarme.zip');
  const zip = unzipSync(readFileSync(await download.path()));

  await generated;
  const expected = Object.fromEntries(readdirSync(cli).sort().map((f) => [f, sha(readFileSync(join(cli, f)))]));
  expect(Object.keys(expected)).toHaveLength(12);
  expect(Object.fromEntries(Object.entries(zip).map(([f, b]) => [f, sha(b)]))).toEqual(expected);

  // Save: the preset as temoin generate writes it.
  const [saved] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Enregistrer' }).click()]);
  expect(saved.suggestedFilename()).toBe('alarme.json');
  expect(sha(readFileSync(await saved.path()))).toBe(expected['alarme.json']);
}, 120000);

test('opened preset: checks of temoin check, file name, saved as is', async () => {
  const file = presetFile('pump.json', PUMP);
  await openFile(file);
  await expect.poll(pageLines, { timeout: 10000 }).toEqual(cliLines(file));
  expect(await page.locator('#name').inputValue()).toBe('pump');
  const button = page.getByRole('button', { name: 'Enregistrer' });
  await expect.poll(() => button.isEnabled()).toBe(true);
  const [saved] = await Promise.all([page.waitForEvent('download'), button.click()]);
  expect(saved.suggestedFilename()).toBe('pump.json');
  const parsed = parsePreset(PUMP);
  if (!parsed.ok) throw new Error(parsed.errors.join('\n'));
  expect(readFileSync(await saved.path(), 'utf8')).toBe(presetJson(parsed.preset));
}, 30000);

test('link: copied, it reopens the same preset in another page', async () => {
  await openFile(presetFile('pump.json', PUMP));
  await page.getByLabel('Hauteur du cadre', { exact: true }).fill('21');   // the form's preset, from now on
  await expect.poll(pageLines, { timeout: 10000 }).toEqual(cliLines({ ...PUMP, frame: { ...PUMP.frame, height: 21 } }));
  await page.getByRole('button', { name: 'Lien' }).click();
  await expect.poll(presetStatus).toBe('Lien copié : il rouvre ce preset.');
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toBe(page.url());

  const other = await page.context().newPage();
  await other.goto(link);
  await expect.poll(() => linesOf(other), { timeout: 10000 }).toEqual(await pageLines());
  expect(await fieldValues(other)).toEqual(await fieldValues(page));   // name of the files included
  expect(await other.locator('#preset-status').textContent()).toBe('Preset du lien');
  await other.close();
}, 30000);

test('invalid preset, dropped: "path : message" errors of temoin check, kept on input', async () => {
  const file = presetFile('invalid.json', INVALID);
  await dropFile(file);
  const lines = cliLines(file);
  await expect.poll(pageLines, { timeout: 10000 }).toEqual(lines);
  for (const line of lines) expect(line).toMatch(/^✗ [\w.]+ : /);
  expect(await page.locator('[id="err-legend.background"]').textContent()).toBe('Fond de la légende : couleur attendue au format #rrggbb');
  expect(await page.locator('#download').isDisabled()).toBe(true);
  expect(await page.locator('#save').isDisabled()).toBe(true);

  // An input: the form takes over, keeps the invalid values of its fields and drops the key
  // it does not have.
  await page.getByLabel('Texte', { exact: true }).fill('Y');
  const { frame, ...kept } = INVALID;
  await expect.poll(pageLines, { timeout: 10000 }).toEqual(cliLines({ ...kept, legend: { ...INVALID.legend, text: 'Y' } }));
}, 30000);

test('alarme example: checks of temoin check, name derived from the text', async () => {
  await page.locator('#examples summary').click();
  await page.getByRole('button', { name: 'alarme', exact: true }).click();
  expect(await page.locator('#examples').getAttribute('open')).toBeNull();
  await expect.poll(pageLines, { timeout: 10000 }).toEqual(cliLines(alarm));
  expect(await presetStatus()).toBe('Exemple : alarme');
  expect(await page.locator('#name').inputValue()).toBe('');
  expect(await page.locator('#name').getAttribute('placeholder')).toBe('alarme');
}, 30000);

test('3D view: only the legend rebuilt for a new text', async () => {
  await page.getByRole('button', { name: '3D', exact: true }).click();
  const stage = page.locator('#stage3d');
  await page.getByLabel('Texte', { exact: true }).fill('CLAUDE');
  await expect.poll(() => stage.getAttribute('data-built'), { timeout: 30000 }).toBe('mask+veil');
  expect(await page.locator('#caption').textContent()).toMatch(/^Vue 3D, recalculée en \d+,\d s\.$/);

  const panel = page.locator('#pieces .piece', { hasText: 'panneau' });
  await panel.click();
  expect(await panel.getAttribute('aria-pressed')).toBe('false');
  await panel.click();
  expect(await panel.getAttribute('aria-pressed')).toBe('true');

  await page.getByRole('button', { name: 'Face', exact: true }).click();
  await page.getByLabel('Texte', { exact: true }).fill('ALARME');
  await expect.poll(pageLines, { timeout: 10000 }).toEqual(cliLines(alarm));
}, 90000);

test('theme: the button switches between light and dark, kept in the browser', async () => {
  const button = page.getByRole('button', { name: 'Sombre', exact: true });
  const dark = await button.getAttribute('aria-pressed') === 'true';
  for (const theme of dark ? ['light', 'dark'] : ['dark', 'light']) {
    await button.click();
    expect(await button.getAttribute('aria-pressed')).toBe(String(theme === 'dark'));
    expect(await page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem('theme')])).toEqual([theme, theme]);
  }
});

test('offline: once loaded, the page works without network, licences included', async () => {
  const context = await browser.newContext();
  context.on('weberror', (e) => errors.push(e.error().message));
  const offline = await context.newPage();
  await offline.goto(server.resolvedUrls!.local[0]);
  await offline.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));   // every file kept
  await context.setOffline(true);
  await offline.reload();
  await expect.poll(() => offline.locator('#stage3d').getAttribute('data-built'), { timeout: 60000 }).toBe('frame mask+veil box cover testPanel');
  const button = offline.getByRole('button', { name: 'Télécharger le zip' });
  await expect.poll(() => button.isEnabled(), { timeout: 30000 }).toBe(true);
  const [download] = await Promise.all([offline.waitForEvent('download', { timeout: 60000 }), button.click()]);
  expect(Object.keys(unzipSync(readFileSync(await download.path())))).toHaveLength(12);

  expect(await offline.locator('footer a[href="licences.txt"]').count()).toBe(1);
  const licences = await offline.evaluate(() => fetch('licences.txt').then((r) => r.text()));
  for (const line of ['replicad-opencascadejs 1.1.0 : LGPL-2.1-only', '@fontsource/b612 5.3.0 : OFL-1.1', 'Police Barlow Condensed (fonts/BarlowCondensed-SemiBold.ttf) : OFL-1.1']) expect(licences).toContain(line);
  await context.close();
}, 180000);
