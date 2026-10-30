// Link of the page: the preset in the URL fragment (the browser sends it to no server), one
// parameter per key, at its path in the preset ("frame.width=47"), plus the name of the
// files ("name=claude"). Read back, each value takes the type of its field: a number or a
// text, and what is not a number stays a text, so that its errors are those of
// temoin check.
import type { Row } from './fields.ts';

export interface Linked { preset: Record<string, unknown>; name: string }

export function toHash(preset: object, name: string): string {
  const params = new URLSearchParams();
  if (name) params.set('name', name);
  const add = (path: string, v: unknown) => params.append(path, typeof v === 'string' ? v : JSON.stringify(v));
  for (const [key, value] of Object.entries(preset)) {
    if (key === '$schema') continue;   // for editors only
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [k, v] of Object.entries(value)) add(`${key}.${k}`, v);
    } else add(key, value);
  }
  return params.toString();
}

// Preset of the link, or nothing if the fragment carries none.
export function fromHash(hash: string, layout: Row[]): Linked | undefined {
  const numbers = new Set(['version', ...layout.flatMap((r) => r.fields).filter((f) => f.kind === 'number').map((f) => f.path)]);
  const preset: Record<string, unknown> = {};
  let name = '';
  for (const [path, text] of new URLSearchParams(hash.replace(/^#/, ''))) {
    if (path === 'name') { name = text; continue; }
    const value = numbers.has(path) && text.trim() !== '' && Number.isFinite(Number(text)) ? Number(text) : text;
    const dot = path.indexOf('.');
    if (dot < 0) { preset[path] = value; continue; }
    const group = preset[path.slice(0, dot)];
    const into = group && typeof group === 'object' ? group as Record<string, unknown> : (preset[path.slice(0, dot)] = {}) as Record<string, unknown>;
    into[path.slice(dot + 1)] = value;
  }
  return Object.keys(preset).length ? { preset, name } : undefined;
}
