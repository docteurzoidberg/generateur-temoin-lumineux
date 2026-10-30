// Core entry point for the command line and the page: checks of a preset (checks.ts),
// summary (hardware, legend), generation of the files.
import type { Font } from 'opentype.js/dist/opentype.mjs';
import { parsePreset, type Preset } from './preset.ts';
import { dimensions, M3, screwLength, STRIP, type Dimensions } from './dims.ts';
import { layoutLegend, type LegendLayout } from './legend.ts';
import { buildParts } from './parts.ts';
import { exportFiles } from './exports.ts';
import { legendChecks, lightChecks, mountChecks, type Check } from './checks.ts';

export type { Check };

export interface Summary {
  text: string;
  capHeight: number;                 // mm
  margin: number;                    // mm, between the text and the window edge
  window: [number, number];
  frame: [number, number];
  panel: number;
  cutout: { size: [number, number]; holes: { count: 2; diameter: number; spacing: number } };   // to drill in the panel, centred on the window
  screws: { count: 2; size: 'M3'; length: number; head: Preset['mount']['head'] };
  inserts: { count: 2; size: 'M3'; hole: [number, number] };   // hole Ø and depth
  leds: { count: number; stripLength: number; ledsPerMeter: number; wireExit: Preset['light']['wireExit'] };
}

export interface CheckResult {
  ok: boolean;                       // no error
  checks: Check[];
  preset?: Preset;
  summary?: Summary;
}

const mm = (v: number, digits = 2) => v.toFixed(digits).replace('.', ',');
const um = (v: number) => Math.round(v * 1000) / 1000;   // summary dimensions, to the µm

// Checks a preset (JSON already read); stops at the first family of errors. Dimensions
// and legend are returned as soon as the preset is valid, even if mounting fails
// (preview).
export function checkPreset(data: unknown, font: Font): CheckResult & { dims?: Dimensions; layout?: LegendLayout } {
  const r = parsePreset(data);
  if (!r.ok) return { ok: false, checks: r.errors.map((message) => ({ level: 'error', code: 'preset', message })) };
  const preset = r.preset, d = dimensions(preset);
  const checks: Check[] = [];
  let layout: LegendLayout | undefined;
  try {
    layout = layoutLegend(preset.legend.text, font, { width: d.windowW, height: d.windowH });
    checks.push({ level: 'ok', code: 'legend', message: `légende « ${preset.legend.text} » : capitales de ${mm(layout.capHeight)} mm, à ${mm(layout.room)} mm du bord de la fenêtre` });
    checks.push(...legendChecks(d, layout));
  } catch (e) {
    checks.push({ level: 'error', code: 'legend', message: `légende : ${(e as Error).message}` });
  }
  checks.push(...mountChecks(d));
  const length = screwLength(d);
  checks.push(length === null
    ? { level: 'error', code: 'screw', message: `aucune vis M3 du commerce ne convient pour un panneau de ${mm(d.panelT, 1)} mm` }
    : { level: 'ok', code: 'screw', message: `vis M3 × ${length} (${preset.mount.head === 'countersunk' ? 'tête fraisée, ISO 10642' : 'tête cylindrique, ISO 4762'})` });
  checks.push(...lightChecks(d));
  const ok = checks.every((c) => c.level !== 'error');
  if (!ok || !layout || length === null) return { ok, checks, preset, dims: d, layout };
  const summary: Summary = {
    text: preset.legend.text, capHeight: um(layout.capHeight), margin: um(layout.room),
    window: [d.windowW, d.windowH], frame: [d.frameW, d.frameH], panel: d.panelT,
    cutout: { size: [um(d.cutW), um(d.cutH)], holes: { count: 2, diameter: M3.holeD, spacing: um(d.screwSpacing) } },
    screws: { count: 2, size: 'M3', length, head: preset.mount.head },
    inserts: { count: 2, size: 'M3', hole: [4, d.insertHoleL] },
    leds: { count: d.ledCount, stripLength: um(d.stripL), ledsPerMeter: STRIP.ledsPerMeter, wireExit: preset.light.wireExit },
  };
  return { ok, checks, preset, summary, dims: d, layout };
}

// Files of the indicator <name> (file name, bytes); OpenCascade must be started.
export async function generate(name: string, data: unknown, font: Font): Promise<CheckResult & { files?: Record<string, Uint8Array> }> {
  const { dims, layout, ...result } = checkPreset(data, font);
  if (!result.ok || !dims || !layout || !result.preset) return result;
  return { ...result, files: await exportFiles(name, result.preset, buildParts(dims, layout)) };
}

const n = (v: number) => v.toFixed(1).replace('.', ',').replace(/,0+$/, '');

// Summary as lines (label, text), the same in the command line and the page.
export function summaryLines(s: Summary): [string, string][] {
  const head = s.screws.head === 'countersunk' ? 'fraisées (ISO 10642)' : 'à tête cylindrique (ISO 4762)';
  return [
    ['vis', `${s.screws.count} vis ${s.screws.size} × ${s.screws.length} ${head}, ${s.inserts.count} inserts à chaud ${s.inserts.size} (perçage Ø ${n(s.inserts.hole[0])} × ${n(s.inserts.hole[1])})`],
    ['éclairage', `${s.leds.count} LED de ruban WS2812B à ${s.leds.ledsPerMeter} LED/m (tronçon de ${n(s.leds.stripLength)} mm), fils à ${s.leds.wireExit === 'left' ? 'gauche' : 'droite'}, nappe de 4 fils au pas de 1,27`],
    ['cotes', `fenêtre ${n(s.window[0])} × ${n(s.window[1])}, cadre ${n(s.frame[0])} × ${n(s.frame[1])}, panneau de ${n(s.panel)} mm`],
    ['panneau', `découpe ${n(s.cutout.size[0])} × ${n(s.cutout.size[1])}, ${s.cutout.holes.count} trous Ø ${n(s.cutout.holes.diameter)} à ${n(s.cutout.holes.spacing)} d'entraxe, centrés sur la fenêtre`],
  ];
}
