// Preview meshes of the printed pieces, in the indicator frame of reference (dims.ts):
// indexed triangles, normals and sharp edges, for the page viewer. A cache keeps the mesh of
// each piece whose inputs did not change: a new legend text only rebuilds the legend. The
// veil is shown as its plate and letters side by side, without the fuse of the printed part
// (same look, a fraction of the time). OpenCascade must be started.
import type { Shape3D } from 'replicad';
import type { Dimensions } from './dims.ts';
import { pieceInfo } from './exports.ts';
import type { LegendLayout } from './legend.ts';
import { box, cover, frame, legendPieces, testPanel } from './parts.ts';
import type { Preset } from './preset.ts';

export interface PartMesh {
  vertices: Float32Array;    // x, y, z per vertex (mm)
  normals: Float32Array;
  triangles: Uint32Array;    // 3 vertex indices per triangle
  edges: Float32Array;       // segments, 2 points each
}

export interface PreviewPart extends PartMesh { name: string; label: string; color: string }

export type PreviewCache = Map<string, { key: string; meshes: PartMesh[] }>;

const TOLERANCE = { tolerance: 0.05, angularTolerance: 0.3 };

function meshOf(shapes: Shape3D[]): PartMesh {
  const parts = shapes.map((s) => {
    const m = s.mesh(TOLERANCE), e = s.meshEdges(TOLERANCE);
    s.delete();
    return { m, e };
  });
  // Several solids in one mesh (veil plate and letters): vertex indices shifted.
  const count = (f: (p: (typeof parts)[number]) => number) => parts.reduce((n, p) => n + f(p), 0);
  const out: PartMesh = {
    vertices: new Float32Array(count((p) => p.m.vertices.length)),
    normals: new Float32Array(count((p) => p.m.normals.length)),
    triangles: new Uint32Array(count((p) => p.m.triangles.length)),
    edges: new Float32Array(count((p) => p.e.lines.length)),
  };
  let v = 0, t = 0, e = 0;
  for (const { m, e: edges } of parts) {
    out.vertices.set(m.vertices, v);
    out.normals.set(m.normals, v);
    out.triangles.set(m.triangles.map((i) => i + v / 3), t);
    out.edges.set(edges.lines, e);
    v += m.vertices.length; t += m.triangles.length; e += edges.lines.length;
  }
  return out;
}

// Builders by group of pieces, with the preset settings their shape depends on (through
// dims.ts); colours change no shape.
const size = (p: Preset) => [p.frame.width, p.frame.height];
const GROUPS: { parts: string[]; key: (p: Preset) => unknown[]; build: (d: Dimensions, layout: LegendLayout) => Shape3D[][] }[] = [
  { parts: ['frame'], key: (p) => [p.window, size(p), p.mount], build: (d) => [[frame(d)]] },
  {
    parts: ['mask', 'veil'],
    key: (p) => [p.window, p.legend.text],
    build: (d, layout) => { const l = legendPieces(d, layout); return [[l.mask], [l.plate, l.letters]]; },
  },
  { parts: ['box'], key: (p) => [p.window, size(p), p.panel, p.light], build: (d) => [[box(d)]] },
  { parts: ['cover'], key: (p) => [p.window, p.light], build: (d) => [[cover(d)]] },
  { parts: ['testPanel'], key: (p) => [p.window, size(p), p.panel], build: (d) => [[testPanel(d)]] },
];

// Meshes of the pieces, in assembly order; `built` lists the groups computed this time
// (the others came from the cache).
export function previewParts(preset: Preset, d: Dimensions, layout: LegendLayout, cache: PreviewCache = new Map()): { parts: PreviewPart[]; built: string[] } {
  const meshes = new Map<string, PartMesh>();
  const built: string[] = [];
  for (const g of GROUPS) {
    const id = g.parts.join('+'), key = JSON.stringify(g.key(preset));
    let entry = cache.get(id);
    if (entry?.key !== key) {
      entry = { key, meshes: g.build(d, layout).map(meshOf) };
      cache.set(id, entry);
      built.push(id);
    }
    g.parts.forEach((part, i) => meshes.set(part, entry.meshes[i]));
  }
  const parts = pieceInfo(preset).map(({ name, label, color, part }) => ({ name, label, color, ...meshes.get(part)! }));
  return { parts, built };
}
