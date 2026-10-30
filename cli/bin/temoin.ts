#!/usr/bin/env node
// Command line of the indicator light generator (docs/generateur.md):
//   temoin check <preset.json> [--json]
//   temoin generate <preset.json> [-o <dir>] [--json]
// <dir>: export/ next to the preset by default; preset <name> = name of the files.
// Exit code: 0 valid, 1 preset error, 2 bad usage. Output is for the user: it stays in
// French.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { checkPreset, generate, LEGEND, parseFont, summaryLines, type CheckResult } from '@temoin/core';
import { initOC } from '@temoin/core/occ-node';

const USAGE = `usage : temoin check <preset.json> [--json]
        temoin generate <preset.json> [-o <dossier>] [--json]`;

function fail(message: string, code = 2): never {
  console.error(message);
  process.exit(code);
}

const { values: opts, positionals } = (() => {
  try {
    return parseArgs({ allowPositionals: true, options: { out: { type: 'string', short: 'o' }, json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } });
  } catch (e) {
    return fail(`${(e as Error).message}\n${USAGE}`);
  }
})();
const [command, presetArg] = positionals;
if (opts.help) { console.log(USAGE); process.exit(0); }
if (!['check', 'generate'].includes(command) || !presetArg || positionals.length > 2) fail(USAGE);

const presetPath = resolve(presetArg);
const name = basename(presetPath).replace(/\.json$/i, '');
let data: unknown;
try {
  data = JSON.parse(readFileSync(presetPath, 'utf8'));
} catch (e) {
  fail(`${presetArg} : ${(e as Error).message}`, 1);
}
const fontBytes = readFileSync(new URL(`../../fonts/${LEGEND.fontFile}`, import.meta.url));
const font = parseFont(fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength));

// Path relative to the current directory if inside it, else absolute.
const shown = (p: string) => { const r = relative(process.cwd(), p); return !r ? '.' : r.startsWith('..') ? p : r; };
function report(result: CheckResult, written?: { dir: string; files: string[] }): void {
  if (opts.json) {
    console.log(JSON.stringify({ name, ok: result.ok, checks: result.checks, summary: result.summary, ...(written ? { out: written.dir, files: written.files } : {}) }, null, 2));
    return;
  }
  console.log(`Témoin « ${name} » (${shown(presetPath)})`);
  for (const c of result.checks) console.log(`${c.level === 'ok' ? '✓' : c.level === 'warn' ? '⚠' : '✗'} ${c.message}`);
  if (result.summary) for (const [label, text] of summaryLines(result.summary)) console.log(`  ${label} : ${text}`);
  if (written) console.log(`Fichiers (${written.files.length}) : ${shown(written.dir)}/\n  ${written.files.join('\n  ')}`);
}

if (command === 'check') {
  const result = checkPreset(data, font);
  report(result);
  process.exit(result.ok ? 0 : 1);
}

await initOC();
const result = await generate(name, data, font);
if (!result.ok || !result.files) {
  report(result);
  process.exit(1);
}
const dir = resolve(opts.out ?? join(dirname(presetPath), 'export'));
mkdirSync(dir, { recursive: true });
const files = Object.keys(result.files).sort();
for (const f of files) writeFileSync(join(dir, f), result.files[f]);
report(result, { dir, files });
