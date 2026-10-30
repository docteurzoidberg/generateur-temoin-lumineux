// Settings form, built from the rows of fields.ts: fills in and reads back a preset, and
// shows the preset errors under their field ("path : message" lines from the core). A value
// a field cannot show (colour "red", unknown option) is kept as is until that field is
// edited: its error stays, nothing is changed silently.
import type { Field, Row } from './fields.ts';

type Input = HTMLInputElement | HTMLSelectElement;
interface Entry { field: Field; input: Input; error: HTMLElement; sync?: (shown?: string) => void; kept?: unknown }

const get = (o: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), o);

function control(f: Field): Input {
  if (f.kind === 'select') {
    const s = document.createElement('select');
    for (const [value, label] of f.options ?? []) s.append(new Option(label, value));
    return s;
  }
  const i = document.createElement('input');
  i.type = f.kind;
  if (f.kind === 'number') Object.assign(i, { min: '0', step: '0.1', inputMode: 'decimal' });
  if (f.kind === 'text') Object.assign(i, { autocomplete: 'off', spellcheck: false });
  if (f.required && f.kind === 'text') i.placeholder = 'obligatoire';
  return i;
}

export function createForm(container: HTMLElement, layout: Row[], onInput: () => void) {
  const inputs = new Map<string, Entry>();
  for (const row of layout) {
    const el = document.createElement('div');
    el.className = 'row';
    const label = document.createElement(row.fields.length > 1 ? 'span' : 'label');
    label.className = 'row-label';
    label.textContent = row.label;
    const controls = document.createElement('div');
    controls.className = 'controls';
    const error = document.createElement('p');
    error.className = 'field-error';
    error.id = `err-${row.fields[0].path}`;
    row.fields.forEach((field, k) => {
      const input = control(field);
      const entry: Entry = { field, input, error };
      input.id = `f-${field.path}`;
      input.name = field.path;
      if (field.hint) input.title = field.hint;
      if (row.fields.length > 1) input.setAttribute('aria-label', field.label);
      else (label as HTMLLabelElement).htmlFor = input.id;
      input.setAttribute('aria-describedby', error.id);
      input.addEventListener('input', () => { entry.kept = undefined; onInput(); });
      if (k) controls.append(Object.assign(document.createElement('span'), { className: 'times', textContent: '×' }));
      controls.append(input);
      if (field.kind === 'color') {   // hexadecimal value next to the swatch
        const hex = Object.assign(document.createElement('output'), { className: 'hex' });
        hex.htmlFor.add(input.id);
        entry.sync = (shown = input.value) => { hex.value = shown; };
        input.addEventListener('input', () => entry.sync!());
        controls.append(hex);
      }
      inputs.set(field.path, entry);
    });
    if (row.unit) controls.append(Object.assign(document.createElement('span'), { className: 'unit', textContent: row.unit }));
    el.append(label, controls, error);
    container.append(el);
  }

  return {
    // Preset read from the form: an empty field is left out (default value, or
    // "obligatoire" in the errors).
    read(): Record<string, unknown> {
      const preset: Record<string, Record<string, unknown>> = {};
      for (const [path, { field, input, kept }] of inputs) {
        const [group, key] = path.split('.');
        preset[group] ??= {};
        if (kept !== undefined) { preset[group][key] = kept; continue; }
        const raw = input.value.trim();
        if (raw === '') continue;
        preset[group][key] = field.kind === 'number' ? Number(raw) : raw;
      }
      return { version: 1, ...preset };
    },
    // Fills in the form, without input events: the caller restarts the checks.
    fill(preset: unknown): void {
      for (const [path, entry] of inputs) {
        const value = get(preset, path) ?? entry.field.default ?? '';
        entry.input.value = String(value);
        entry.kept = entry.input.value === String(value) ? undefined : value;
        entry.sync?.(String(value));
      }
    },
    value(path: string): string {
      return inputs.get(path)?.input.value ?? '';
    },
    // Preset errors under their field (those aimed at no field stay in the list of
    // checks).
    errors(lines: string[]): void {
      const byRow = new Map<HTMLElement, string[]>();
      for (const { error } of inputs.values()) byRow.set(error, []);
      for (const line of lines) {
        const [path, ...message] = line.split(' : ');
        const target = inputs.get(path);
        if (target) byRow.get(target.error)!.push(`${target.field.label} : ${message.join(' : ')}`);
      }
      for (const [error, messages] of byRow) error.textContent = messages.join(' ; ');
      for (const [path, { input }] of inputs) input.setAttribute('aria-invalid', String(lines.some((l) => l.startsWith(`${path} : `))));
    },
  };
}
