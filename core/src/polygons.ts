// 2D regions (mm) for the legend checks: offset with round joins, difference,
// intersection, with Clipper in integer coordinates. Arcs within 0.25 µm, like shapely's
// 16 segments per quarter circle for the radii involved.
import ClipperLib from 'clipper-lib';
import { ringArea, type InkPolygon, type Ring } from './legend.ts';

const SCALE = 1e5;               // Clipper units per mm
const ARC_TOLERANCE = 0.00025;   // mm

export type Region = InkPolygon[];

const toPath = (r: Ring): ClipperLib.IntPoint[] => r.map(([x, y]) => ({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) }));
const toRing = (p: ClipperLib.IntPoint[]): Ring => p.map((q) => [q.X / SCALE, q.Y / SCALE]);
const paths = (region: Region) => region.flatMap((p) => [p.outer, ...p.holes]).map(toPath);

// Polygons with holes from a Clipper tree (an island in a hole is one more polygon).
function fromTree(tree: ClipperLib.PolyTree): Region {
  const out: Region = [];
  const walk = (node: ClipperLib.PolyNode) => {
    for (const outer of node.Childs()) {
      out.push({ outer: toRing(outer.Contour()), holes: outer.Childs().map((h) => toRing(h.Contour())) });
      for (const hole of outer.Childs()) walk(hole);
    }
  };
  walk(tree);
  return out;
}

export function rectangle(w: number, h: number): Region {
  return [{ outer: [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], holes: [] }];
}

export function offset(region: Region, d: number): Region {
  const co = new ClipperLib.ClipperOffset(2, ARC_TOLERANCE * SCALE);
  co.AddPaths(paths(region), ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const tree = new ClipperLib.PolyTree();
  co.Execute(tree, d * SCALE);
  return fromTree(tree);
}

function clip(a: Region, b: Region, type: ClipperLib.ClipType): Region {
  const c = new ClipperLib.Clipper();
  c.AddPaths(paths(a), ClipperLib.PolyType.ptSubject, true);
  c.AddPaths(paths(b), ClipperLib.PolyType.ptClip, true);
  const tree = new ClipperLib.PolyTree();
  c.Execute(type, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);
  return fromTree(tree);
}

export const difference = (a: Region, b: Region) => clip(a, b, ClipperLib.ClipType.ctDifference);
export const intersection = (a: Region, b: Region) => clip(a, b, ClipperLib.ClipType.ctIntersection);

export const area = (p: InkPolygon) => Math.abs(ringArea(p.outer)) - p.holes.reduce((s, h) => s + Math.abs(ringArea(h)), 0);

export function centroid(p: InkPolygon): [number, number] {
  let a = 0, cx = 0, cy = 0;
  for (const r of [p.outer, ...p.holes]) {
    const sign = r === p.outer ? Math.sign(ringArea(r)) : -Math.sign(ringArea(r));
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const f = sign * (r[j][0] * r[i][1] - r[i][0] * r[j][1]);
      a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f;
    }
  }
  return [cx / (3 * a), cy / (3 * a)];
}

// What disappears in a morphological opening of diameter w (stroke or gap thinner than
// the nozzle), like thin() in the mock-up's legende_dxf.py: the tips of sharp corners,
// merely rounded in print, are discarded (0.06 mm trim, 0.02 mm² threshold).
export function thin(region: Region, w: number): Region {
  const opened = offset(offset(region, -w / 2), w / 2);
  return offset(difference(region, opened), -0.06).filter((p) => area(p) > 0.02);
}
