// Generator page: settings built from the preset schema; checks, mounting and front view
// on every input (checks worker); 3D preview (shown first) after a pause in typing, and
// files on download (OpenCascade worker, engine.ts); simulated light of the legend.
// Presets: opened (picked or dropped on the page), examples from presets/, saved, and
// carried by the page link. On load: the preset of the link, else the alarme example.
// Offline once loaded, built page only (service worker, src/sw.js). Texts shown to the
// user are in French (i18n labels later).
import '@fontsource/b612/400.css';
import '@fontsource/b612/700.css';
import '@fontsource/b612-mono/400.css';
import './style.css';
import schema from '../../presets/schema.json' with { type: 'json' };
import type { PreviewPart } from '@temoin/core';
import { createEngine } from './engine-client.ts';
import { drawFace, lightFace } from './face.ts';
import type { FaceModel } from './face-model.ts';
import { rows, type SchemaNode } from './fields.ts';
import { createForm } from './form.ts';
import { animated, intensity, type Effect, type Light } from './light.ts';
import { fromHash, toHash } from './link.ts';
import type { FromChecker, ToChecker } from './protocol.ts';
import type { Viewer, ViewName } from './viewer.ts';

// Examples: the presets of the repository, by file name.
const EXAMPLES = Object.fromEntries(Object.entries(import.meta.glob<string>(
  ['../../presets/*.json', '!../../presets/schema.json'], { query: '?raw', import: 'default', eager: true },
)).map(([path, text]) => [path.replace(/^.*\/|\.json$/g, ''), text]));

const $ = <T extends Element = HTMLElement>(selector: string) => document.querySelector(selector) as T;
const $$ = <T extends Element = HTMLButtonElement>(selector: string) => [...document.querySelectorAll<T>(selector)];
const MARK = { ok: '✓', warn: '⚠', error: '✗' } as const;
const seconds = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

const nameInput = $<HTMLInputElement>('#name');
const checksList = $('#checks'), summary = $('#summary'), status = $('#status'), presetStatus = $('#preset-status');
const face = $<SVGSVGElement>('#face'), stage = $('#stage'), caption = $('#caption');
const stage3d = $('#stage3d'), controls3d = $('#controls3d'), piecesList = $('#pieces'), explodeInput = $<HTMLInputElement>('#explode');
const downloadButton = $<HTMLButtonElement>('#download'), saveButton = $<HTMLButtonElement>('#save');
const fileInput = $<HTMLInputElement>('#file'), examples = $<HTMLDetailsElement>('#examples'), drop = $('#drop');

// Name of the files: the one typed in (or the opened preset's), else derived from the text ("ALARME" → alarme).
const slug = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'temoin';
const fileName = () => nameInput.value.trim().replace(/[\s\\/:*?"<>|]+/g, '-') || nameInput.placeholder;

// Checks: one request at a time, only the latest input waiting.
const checker = new Worker(new URL('./checker.ts', import.meta.url), { type: 'module' });
let checkId = 0, checking = false, stale = false, checkedOk = false, json: string | undefined;
let lastFace: FaceModel | undefined;

const layout = rows(schema as SchemaNode);
const form = createForm($('#fields'), layout, () => { opened = undefined; changed(); });
// Opened preset (file, example, link): checked as is, like temoin check does, until the
// first input; then the form's (keys without a field are dropped).
let opened: object | undefined;
const current = () => opened ?? form.read();

function changed(): void {
  nameInput.placeholder = slug(form.value('legend.text'));
  writeLink();
  stale = true;
  sendCheck();
  edits++;
  schedulePreview();
  updateButtons();
}

function sendCheck(): void {
  if (checking || !stale) return;
  checking = true;
  stale = false;
  checker.postMessage({ id: ++checkId, preset: current() } satisfies ToChecker);
}

const item = (tag: string, className: string, text: string) => Object.assign(document.createElement(tag), { className, textContent: text });

checker.onmessage = ({ data }: MessageEvent<FromChecker>) => {
  checking = false;
  if (stale) return sendCheck();   // result overtaken by an input: not shown
  // Same lines as temoin check; preset errors are also shown under their field.
  form.errors(data.checks.filter((c) => c.code === 'preset').map((c) => c.message));
  checksList.replaceChildren(...data.checks.map((c) => item('li', `check ${c.level}`, `${MARK[c.level]} ${c.message}`)));
  summary.replaceChildren(...(data.summary ?? []).flatMap(([label, text]) => [item('dt', '', label), item('dd', '', text)]));
  if (!data.summary) summary.append(item('dd', 'muted', 'Le montage s’affiche quand les contrôles passent.'));
  if (data.face) lastFace = data.face;
  if (lastFace) { drawFace(face, lastFace); paintFace(); }
  else face.replaceChildren();
  stage.classList.toggle('is-stale', !data.face);
  faceCaption = data.face ? 'Vue de face, à l’échelle.' : lastFace ? 'Dernier aperçu valide : corriger les réglages signalés.' : 'Pas d’aperçu : corriger les réglages signalés.';
  showCaption();
  checkedOk = data.ok;
  json = data.json;
  updateButtons();
};

// Preview: the 3D view (computed in a few seconds), or the front view at once.
let mode: 'face' | '3d' = '3d';
let faceCaption = 'Vue de face, à l’échelle.', caption3d = 'Calcul de la vue 3D…';
const showCaption = () => { caption.textContent = mode === 'face' ? faceCaption : caption3d; };

for (const button of $$('#mode button')) {
  button.addEventListener('click', () => {
    mode = button.dataset.mode as typeof mode;
    for (const b of $$('#mode button')) b.setAttribute('aria-pressed', String(b === button));
    stage.hidden = mode !== 'face';
    stage3d.hidden = controls3d.hidden = mode !== '3d';
    viewer?.setActive(mode === '3d');
    showCaption();
    paintFace();
    if (mode === '3d') void runPreview();
  });
}

// Light: effect and colour, the same in both views; the front view is animated here, the 3D
// view in its own render loop.
let light: Light = { effect: 'steady', color: '#ffffff' }, faceFrame = 0;
const colorInput = $<HTMLInputElement>('#light-color');

function paintFace(): void {
  cancelAnimationFrame(faceFrame);
  faceFrame = 0;
  const step = (t: number) => {
    lightFace(face, light.color, intensity(light, t));
    if (mode === 'face' && animated(light)) faceFrame = requestAnimationFrame(step);
  };
  step(performance.now());
}

function setLight(next: Partial<Light>): void {
  light = { ...light, ...next };
  for (const b of $$('#light-state button')) b.setAttribute('aria-pressed', String(b.dataset.effect === light.effect));
  for (const b of $$('#light-colors button')) b.setAttribute('aria-pressed', String(b.dataset.color === light.color));
  colorInput.value = light.color;
  paintFace();
  viewer?.setLight(light);
}
for (const b of $$('#light-state button')) b.addEventListener('click', () => setLight({ effect: b.dataset.effect as Effect }));
for (const b of $$('#light-colors button')) b.addEventListener('click', () => setLight({ color: b.dataset.color!, ...(light.effect === 'off' ? { effect: 'steady' } : {}) }));
colorInput.addEventListener('input', () => setLight({ color: colorInput.value }));

// 3D view: computed by the OpenCascade worker after a pause in typing (each piece only
// when its settings change); a result overtaken by an input is dropped. The viewer
// (three.js) is a separate chunk, loaded on the first preview.
const PAUSE = 300;   // ms
let viewer: Viewer | undefined, viewerLoad: Promise<Viewer | undefined> | undefined;
let edits = 0, previewTimer = 0, previewing = false, previewDirty = true, previewShown = false;
const hidden = new Set<string>();

function loadViewer(): Promise<Viewer | undefined> {
  viewerLoad ??= import('./viewer.ts').then(({ createViewer }) => {
    viewer = createViewer(stage3d);
    viewer.setLight(light);
    viewer.setExplode(Number(explodeInput.value) / 100);
    viewer.setActive(mode === '3d');
    return viewer;
  }, (e: unknown) => {
    caption3d = `Vue 3D indisponible : ${(e as Error).message}`;
    showCaption();
    return undefined;
  });
  return viewerLoad;
}

function schedulePreview(delay = PAUSE): void {
  previewDirty = true;
  if (mode !== '3d') return;
  clearTimeout(previewTimer);
  previewTimer = window.setTimeout(runPreview, delay);
}

async function runPreview(): Promise<void> {
  if (previewing || !previewDirty) return;
  previewing = true;
  const v = await loadViewer();
  if (!v) { previewing = false; return; }
  previewDirty = false;
  const at = edits;
  if (!previewShown) { caption3d = 'Calcul de la vue 3D…'; showCaption(); }
  const reply = await engine.request({ type: 'preview', preset: current() }).catch((e: Error) => ({ type: 'error', message: e.message }) as const);
  previewing = false;
  if (at !== edits) return schedulePreview();   // overtaken by an input: dropped
  const ok = reply.type === 'preview' && reply.ok;
  if (ok) {
    v.show(reply.parts);
    listPieces(reply.parts);
    previewShown = true;
    stage3d.dataset.built = reply.built.join(' ');   // for the tests: what was computed, time, heap (MB)
    stage3d.dataset.ms = String(Math.round(reply.ms));
    stage3d.dataset.heap = String(Math.round(reply.heap / 2 ** 20));
    caption3d = reply.built.length ? `Vue 3D, recalculée en ${seconds(reply.ms)}.` : 'Vue 3D.';
  } else {
    caption3d = previewShown ? 'Dernière vue 3D valide : corriger les réglages signalés.' : 'Pas de vue 3D : corriger les réglages signalés.';
  }
  stage3d.classList.toggle('is-stale', !ok);
  showCaption();
}

// Pieces shown or hidden, with their colour.
function listPieces(parts: PreviewPart[]): void {
  piecesList.replaceChildren(...parts.map((p) => {
    const button = item('button', 'piece', '') as HTMLButtonElement;
    button.type = 'button';
    button.setAttribute('aria-pressed', String(!hidden.has(p.name)));
    const swatch = item('span', 'swatch', '');
    swatch.style.background = p.color;
    button.append(swatch, p.label);
    button.addEventListener('click', () => {
      const show = hidden.has(p.name);
      if (show) hidden.delete(p.name); else hidden.add(p.name);
      button.setAttribute('aria-pressed', String(show));
      viewer?.setVisible(p.name, show);
    });
    viewer?.setVisible(p.name, !hidden.has(p.name));
    return button;
  }));
}

explodeInput.addEventListener('input', () => viewer?.setExplode(Number(explodeInput.value) / 100));
explodeInput.addEventListener('change', () => viewer?.refit());
for (const button of $$('#views button')) button.addEventListener('click', () => viewer?.view(button.dataset.view as ViewName));

// OpenCascade starts on load; the files are computed on click. A replaced worker (memory)
// loses its preview cache: the shown preset is computed again, out of sight.
let engineReady = false, generating = false;
const engine = createEngine({
  ready(ms) {
    if (!engineReady && !status.dataset.started) status.textContent = `Moteur prêt (${seconds(ms)}).`;
    status.dataset.started = 'yes';
    engineReady = true;
    updateButtons();
  },
  failed(message) { status.textContent = `Le moteur n’a pas démarré : ${message}`; },
  restarting() {
    engineReady = false;
    updateButtons();
    if (previewShown) schedulePreview(0);
  },
});

function updateButtons(): void {
  const fresh = !stale && !checking;
  downloadButton.disabled = !(engineReady && checkedOk && fresh && !generating);
  saveButton.disabled = !(json && fresh);
}

function save(bytes: BlobPart, name: string, type: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

downloadButton.addEventListener('click', async () => {
  generating = true;
  updateButtons();
  const name = fileName(), zipName = `${name}.zip`;
  status.textContent = 'Génération des fichiers…';
  const reply = await engine.request({ type: 'generate', name, preset: current() }).catch((e: Error) => ({ type: 'error', message: e.message }) as const);
  generating = false;
  if (reply.type === 'generated') {
    if (reply.zip) save(reply.zip, zipName, 'application/zip');
    status.textContent = reply.zip ? `${zipName} : ${reply.files.length} fichiers en ${seconds(reply.ms)}.` : 'Rien n’est généré : le preset a des erreurs.';
  } else if (reply.type === 'error') status.textContent = `Erreur : ${reply.message}`;
  updateButtons();
});

// Theme: the system's until the button is used; the choice stays in this browser (applied
// before the first paint by index.html).
const themeButton = $<HTMLButtonElement>('#theme');
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const isDark = () => (document.documentElement.dataset.theme ?? (systemDark.matches ? 'dark' : 'light')) === 'dark';
const showTheme = () => themeButton.setAttribute('aria-pressed', String(isDark()));
themeButton.addEventListener('click', () => {
  const theme = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('theme', theme); } catch { /* private window: this page only */ }
  showTheme();
});
systemDark.addEventListener('change', showTheme);
showTheme();

// Presets. The link follows every input (without a history entry): the reloaded page, or
// the copied link, reopens the same preset.
function say(text: string, error = false): void {
  presetStatus.textContent = text;
  presetStatus.classList.toggle('is-error', error);
}

function writeLink(): void {
  history.replaceState(null, '', `#${toHash(current(), nameInput.value.trim())}`);
}

function load(preset: object, name: string, origin: string): void {
  opened = preset;
  form.fill(preset);
  nameInput.value = name;
  lastFace = undefined;   // not the preview of the previous preset
  say(origin);
  changed();
}

// File picked or dropped: the name of the files becomes its own, as with temoin.
async function openFile(file: File): Promise<void> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
  } catch (e) {
    return say(`${file.name} non ouvert : ${(e as Error).message}`, true);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return say(`${file.name} non ouvert : objet JSON attendu`, true);
  load(data, file.name.replace(/\.json$/i, ''), `Ouvert : ${file.name}`);
}

$('#open').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';   // the same file, reopened, fires again
  if (file) void openFile(file);
});

// Dropping a file on the page: the drop zone covers it while dragging over.
const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes('Files') ?? false;
addEventListener('dragover', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = 'copy';
  drop.hidden = false;
});
drop.addEventListener('dragleave', () => { drop.hidden = true; });
addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  drop.hidden = true;
  const file = e.dataTransfer!.files[0];
  if (file) void openFile(file);
});

// Examples: starting points; the name of the files is derived from the text again.
for (const name of Object.keys(EXAMPLES).sort()) {
  const button = item('button', 'menu-item', name) as HTMLButtonElement;
  button.type = 'button';
  button.addEventListener('click', () => {
    examples.open = false;
    load(JSON.parse(EXAMPLES[name]), '', `Exemple : ${name}`);
  });
  $('#example-list').append(button);
}
document.addEventListener('click', (e) => { if (!examples.contains(e.target as Node)) examples.open = false; });
examples.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !examples.open) return;
  examples.open = false;
  examples.querySelector('summary')!.focus();
});

saveButton.addEventListener('click', () => {
  const name = `${fileName()}.json`;
  save(json!, name, 'application/json');
  say(`Enregistré : ${name}, dans les téléchargements.`);
});

$('#link').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    say('Lien copié : il rouvre ce preset.');
  } catch {
    say('Lien dans la barre d’adresse : le copier pour rouvrir ce preset.');
  }
});

nameInput.addEventListener('input', writeLink);

function openLink(): boolean {
  const linked = fromHash(location.hash, layout);
  if (linked) load(linked.preset, linked.name, 'Preset du lien');
  return !!linked;
}
addEventListener('hashchange', openLink);   // link pasted in the address bar of the open page
if (!openLink()) load(JSON.parse(EXAMPLES.alarme), '', 'Exemple : alarme');

// Offline, built page only (MODE rather than PROD, false in the page built by the tests
// under NODE_ENV=test); if the service worker cannot be installed, the page simply needs
// the network.
if (import.meta.env.MODE === 'production' && 'serviceWorker' in navigator) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
