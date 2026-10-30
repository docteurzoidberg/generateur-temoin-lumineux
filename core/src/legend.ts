// Legend: the preset text as ink polygons, in mm, origin at the centre of the window, x
// to the right, y up. Port of the mock-up's legende_dxf.py (same result, checked by the
// tests): glyphs flattened into segments of at most STEP mm, tracking as a fraction of the
// cap height, no kerning, capitals centred, "auto" height = the largest for which the ink
// stays MARGIN away from the window edge. No OpenCascade: also used by the front view and
// the checks.
/// <reference path="./opentype.d.ts" />
// ESM file of the package, read as is by Node and Vite (the main entry is CommonJS).
import { parse, type Font, type Glyph, type PathCommand } from 'opentype.js/dist/opentype.mjs';

// Values fixed in v1 (docs/generateur.md, "Preset").
export const LEGEND = {
  font: 'Barlow Condensed SemiBold',
  fontFile: 'BarlowCondensed-SemiBold.ttf',
  tracking: 0.12,   // fraction of the cap height, added between two letters
  margin: 1.5,      // mm, between the ink and the window edge
  step: 0.2,        // mm, maximum length of a flattened curve segment
} as const;

export type Point = [number, number];
export type Ring = Point[];
export interface InkPolygon { outer: Ring; holes: Ring[] }

export interface LegendLayout {
  capHeight: number;
  width: number;      // ink extent
  height: number;
  room: number;       // margin between the ink and the window edge
  ink: InkPolygon[];  // one ink region per polygon, its counters as holes
  islands: Ring[];    // mask islands (counters of A, D, O, R…), held by the veil
}

export function parseFont(bytes: ArrayBuffer): Font {
  return parse(bytes);
}

type Curve = Extract<PathCommand, { type: 'Q' | 'C' }>;

// Curve as a cubic (p1, p2, p3 after the current point p0); a quadratic is elevated to a
// cubic, as fontTools' BasePen does.
function cubic(p0: Point, c: Curve): [Point, Point, Point] {
  if (c.type === 'C') return [[c.x1, c.y1], [c.x2, c.y2], [c.x, c.y]];
  return [[p0[0] + (2 / 3) * (c.x1 - p0[0]), p0[1] + (2 / 3) * (c.y1 - p0[1])],
          [c.x + (2 / 3) * (c.x1 - c.x), c.y + (2 / 3) * (c.y1 - c.y)], [c.x, c.y]];
}

function cubicAt([p0, p1, p2, p3]: Point[], t: number): Point {
  const u = 1 - t;
  return [0, 1].map((i) => u ** 3 * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t ** 3 * p3[i]) as Point;
}

// Parameters t in ]0, 1[ where the curve reaches an extremum in x or y.
function extrema(p0: Point, c: Curve): number[] {
  const ts: number[] = [];
  for (const i of [0, 1] as const) {
    if (c.type === 'Q') {
      const ctrl = i ? c.y1 : c.x1, end = i ? c.y : c.x;
      const den = p0[i] - 2 * ctrl + end;
      if (den !== 0) ts.push((p0[i] - ctrl) / den);
    } else {
      // Derivative of the cubic on axis i: a t² + b t + k = 0.
      const [a0, a1, a2, a3] = [p0[i], i ? c.y1 : c.x1, i ? c.y2 : c.x2, i ? c.y : c.x];
      const a = -a0 + 3 * a1 - 3 * a2 + a3, b = 2 * (a0 - 2 * a1 + a2), k = a1 - a0;
      const disc = b * b - 4 * a * k;
      if (a === 0) { if (b !== 0) ts.push(-k / b); } else if (disc >= 0) ts.push((-b + Math.sqrt(disc)) / (2 * a), (-b - Math.sqrt(disc)) / (2 * a));
    }
  }
  return ts.filter((t) => t > 0 && t < 1);
}

// Exact bounding box of a glyph: curve ends and extrema, like fontTools' BoundsPen
// (opentype.js's is approximate and would shift the scale). null: glyph without ink
// (space).
function bounds(commands: PathCommand[]): [number, number, number, number] | null {
  const pts: Point[] = [];
  let p: Point = [0, 0];
  for (const c of commands) {
    if (c.type === 'Z') continue;
    if (c.type === 'Q' || c.type === 'C') {
      const q = [p, ...cubic(p, c)];
      for (const t of extrema(p, c)) pts.push(cubicAt(q, t));
    }
    p = [c.x, c.y];
    pts.push(p);
  }
  if (!pts.length) return null;
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function capHeightEm(font: Font): number {
  const cap = font.tables.os2?.sCapHeight;
  if (cap && cap > 0) return cap;
  const bb = bounds(font.charToGlyph('H').path.commands)!;
  return bb[3] - bb[1];
}

// Glyph contours as polylines, in font units: each curve in n segments, n from the length
// of its control polygon (at least 2).
function flatten(commands: PathCommand[], seg: number): Ring[] {
  const rings: Ring[] = [];
  let pts: Point[] = [];
  const d = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  // Coincident points dropped (zero-length segment), including a last point equal to the first.
  const close = () => {
    pts = pts.filter((p, i) => i === 0 || d(p, pts[i - 1]) > 1e-9);
    if (pts.length > 1 && d(pts[0], pts[pts.length - 1]) < 1e-9) pts.pop();
    if (pts.length > 2) rings.push(pts);
    pts = [];
  };
  for (const c of commands) {
    if (c.type === 'M') { close(); pts = [[c.x, c.y]]; continue; }
    if (c.type === 'Z') { close(); continue; }
    if (c.type === 'L') { pts.push([c.x, c.y]); continue; }
    const q = [pts[pts.length - 1], ...cubic(pts[pts.length - 1], c)];
    const n = Math.max(2, Math.ceil((d(q[0], q[1]) + d(q[1], q[2]) + d(q[2], q[3])) / seg));
    for (let k = 1; k <= n; k++) pts.push(cubicAt(q, k / n));
  }
  close();
  return rings;
}

export function ringArea(r: Ring): number {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return a / 2;   // > 0: counter-clockwise
}

function inside([x, y]: Point, r: Ring): boolean {
  let w = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) w = !w;
  }
  return w;
}

// Filled regions: a contour inside an even number of others bounds ink, otherwise a
// counter. Equivalent to the fonts' non-zero rule as long as contours do not overlap
// (true for the v1 font).
function fill(rings: Ring[]): InkPolygon[] {
  const parents = rings.map((r, i) => rings.filter((o, j) => j !== i && inside(r[0], o)));
  const polys = new Map<Ring, InkPolygon>();
  rings.forEach((r, i) => {
    if (parents[i].length % 2 === 0) polys.set(r, { outer: ringArea(r) > 0 ? r : [...r].reverse(), holes: [] });
  });
  rings.forEach((r, i) => {
    if (parents[i].length % 2 === 0) return;
    // The closest ink contour around it: the one with the most parents.
    const host = parents[i].filter((o) => polys.has(o))
      .sort((a, b) => parents[rings.indexOf(b)].length - parents[rings.indexOf(a)].length)[0];
    polys.get(host)!.holes.push(ringArea(r) < 0 ? r : [...r].reverse());
  });
  return [...polys.values()];
}

// Throws a message for the user (shown as a check line).
export function layoutLegend(text: string, font: Font, window: { width: number; height: number }): LegendLayout {
  const chars = [...text];
  const missing = [...new Set(chars.filter((ch) => font.charToGlyphIndex(ch) === 0))];
  if (missing.length) throw new Error(`caractères absents de la police : ${missing.join(' ')}`);
  const capEm = capHeightEm(font);
  let x = 0;
  const placed: [Glyph, number][] = [];
  const boxes: number[][] = [];
  for (const ch of chars) {
    const g = font.charToGlyph(ch);
    const bb = bounds(g.path.commands);
    if (bb) boxes.push([x + bb[0], bb[1], x + bb[2], bb[3]]);
    placed.push([g, x]);
    x += g.advanceWidth + LEGEND.tracking * capEm;
  }
  if (!boxes.length) throw new Error('texte sans encre');
  const xmin = Math.min(...boxes.map((b) => b[0])), ymin = Math.min(...boxes.map((b) => b[1]));
  const xmax = Math.max(...boxes.map((b) => b[2])), ymax = Math.max(...boxes.map((b) => b[3]));
  const halfH = Math.max(ymax - capEm / 2, capEm / 2 - ymin);
  const s = Math.min((window.width - 2 * LEGEND.margin) / (xmax - xmin), (window.height / 2 - LEGEND.margin) / halfH);
  const dx = (xmin + xmax) / 2;

  const rings: Ring[] = [];
  for (const [g, gx] of placed) {
    for (const r of flatten(g.path.commands, LEGEND.step / s)) {
      rings.push(r.map(([px, py]) => [s * (px + gx - dx), s * (py - capEm / 2)]));
    }
  }
  const ink = fill(rings);
  const xs = rings.flatMap((r) => r.map((p) => p[0])), ys = rings.flatMap((r) => r.map((p) => p[1]));
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return {
    capHeight: s * capEm,
    width: x1 - x0,
    height: y1 - y0,
    room: Math.min(window.width / 2 - Math.max(-x0, x1), window.height / 2 - Math.max(-y0, y1)),
    ink,
    islands: ink.flatMap((p) => p.holes),
  };
}
