// Generator page: Vite reads the core's TypeScript as is; the worker is an ES module
// (recipe from the batch 3.0 prototype). The build adds the licences of the libraries and
// fonts of the page (licences.txt, also served in development) and the service worker that
// keeps the page offline (sw.js, from src/sw.js).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const WEB = fileURLToPath(new URL('.', import.meta.url));
const LICENCES = 'licences.txt';
const BARLOW = join(WEB, '../fonts/OFL-Barlow.txt');   // font of the legend and titles, not an npm package
// Notes before a licence: the sources of the LGPL WebAssembly build; the licence of a
// package that has no licence file.
const NOTES: Record<string, string> = {
  'clipper-lib': 'Boost Software License 1.0, d\'après l\'en-tête de clipper.js (© Angus Johnson 2010-2017) : http://www.boost.org/LICENSE_1_0.txt',
  'replicad-opencascadejs': 'Open CASCADE Technology (https://github.com/Open-Cascade-SAS/OCCT), compilé en WebAssembly par opencascade.js (https://github.com/donalffons/opencascade.js) ; sources de ce paquet : https://github.com/sgenoud/replicad/tree/main/packages/replicad-opencascadejs. Le .wasm est un fichier à part, remplaçable.',
};

interface Package { name: string; version: string; license?: string; dependencies?: Record<string, string> }

// Packages the page runs on: the runtime dependencies of web/ and core/, and theirs, type
// packages left out. Texts in French: the file is shown to the user.
function licences(): string {
  const found = new Map<string, string>();   // name → directory
  const visit = (dir: string) => {
    const pkg: Package = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    for (const name of Object.keys(pkg.dependencies ?? {})) {
      if (found.has(name) || name.startsWith('@types/')) continue;
      let at = dir;
      while (!existsSync(join(at, 'node_modules', name))) {
        if (at === dirname(at)) throw new Error(`package ${name} not found from ${dir}`);
        at = dirname(at);
      }
      found.set(name, realpathSync(join(at, 'node_modules', name)));
      visit(found.get(name)!);
    }
  };
  visit(WEB);
  const rule = '='.repeat(72);
  const sections = [...found].filter(([name]) => !name.startsWith('@temoin/')).sort(([a], [b]) => a.localeCompare(b)).map(([name, dir]) => {
    const pkg: Package = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)/i.test(f));
    const text = file ? readFileSync(join(dir, file), 'utf8').trim() : 'Pas de texte de licence dans le paquet.';
    return [rule, `${name} ${pkg.version} : ${pkg.license ?? 'licence non indiquée'}`, rule, ...(NOTES[name] ? [NOTES[name], ''] : []), text].join('\n');
  });
  const barlow = [rule, 'Police Barlow Condensed (fonts/BarlowCondensed-SemiBold.ttf) : OFL-1.1', rule, readFileSync(BARLOW, 'utf8').trim()].join('\n');
  // Byte order mark: read as UTF-8 even when served without a charset.
  return '﻿' + ['Témoin lumineux : bibliothèques et polices de la page, avec leur licence.', ...sections, barlow].join('\n\n') + '\n';
}

function offline(): Plugin {
  return {
    name: 'temoin-offline',
    enforce: 'post',   // after index.html is written
    configureServer(server) {
      server.middlewares.use(`/${LICENCES}`, (_, res) => {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end(licences());
      });
    },
    generateBundle(_, bundle) {
      const text = licences();
      this.emitFile({ type: 'asset', fileName: LICENCES, source: text });
      const files = [...new Set([...Object.keys(bundle), LICENCES])].filter((f) => f !== 'index.html').sort();
      const page = bundle['index.html'];
      const hash = createHash('sha256').update(files.join('\n')).update(text);
      if (page?.type === 'asset') hash.update(page.source);
      const head = `const CACHE = 'temoin-${hash.digest('hex').slice(0, 12)}';\nconst FILES = ${JSON.stringify(['./', ...files])};\n\n`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: head + readFileSync(join(WEB, 'src/sw.js'), 'utf8') });
    },
  };
}

export default defineConfig({
  base: './',   // relative addresses: the page works at any path (GitHub Pages: /<repository>/)
  build: { target: 'es2023' },
  worker: { format: 'es' },
  plugins: [offline()],
});
