// Writes presets/schema.json from the preset schema: npm run schema
import { writeFileSync } from 'node:fs';
import { presetJsonSchema } from '../src/preset.ts';

const out = new URL('../../presets/schema.json', import.meta.url);
writeFileSync(out, JSON.stringify(presetJsonSchema(), null, 2) + '\n');
console.log('written:', out.pathname);
