// Printable parts of the indicator, as exact solids (replicad), in the indicator frame of
// reference (dims.ts): port of build_frame, build_legend, build_box, build_cover and
// build_panel from the mock-up's temoin.py, operation by operation. OpenCascade must be
// started (occ-node.ts under Node).
import {
  BlueprintSketcher, Drawing, drawCircle, drawRectangle, drawRoundedRectangle, organiseBlueprints,
  type Shape3D,
} from 'replicad';
import type { Dimensions } from './dims.ts';
import { M3 } from './dims.ts';
import type { LegendLayout, Ring } from './legend.ts';

type Pt = [number, number, number];

// Prism of a drawing in the front plane (x, z), from y0 to y1 > y0 (y towards the wall).
// The plane goes through origin, centre of an optional scaling (cone).
function prism(d: Drawing, y0: number, y1: number, origin: [number, number] = [0, 0], endFactor?: number): Shape3D {
  const opts = { extrusionDirection: [0, 1, 0] as Pt, ...(endFactor ? { extrusionProfile: { profile: 'linear' as const, endFactor } } : {}) };
  return d.sketchOnPlane('XZ', [origin[0], y0, origin[1]]).extrude(y1 - y0, opts) as Shape3D;
}

const rect = (w: number, h: number, cx = 0, cz = 0) => drawRectangle(w, h).translate(cx, cz);
const circle = (d: number, cx = 0, cz = 0) => drawCircle(d / 2).translate(cx, cz);

// Edges in the plane y (face perpendicular to Y), within the box |x| ≤ w / 2, |z| ≤ h / 2.
const inFace = (y: number, w: number, h: number) =>
  (e: any) => e.inBox([-w / 2 - 0.01, y - 0.01, -h / 2 - 0.01], [w / 2 + 0.01, y + 0.01, h / 2 + 0.01]);

function inkDrawing(layout: LegendLayout): Drawing {
  const blueprints = layout.ink.flatMap((p) => [p.outer, ...p.holes]).map((r: Ring) => {
    const sk = new BlueprintSketcher().movePointerTo(r[0]);
    for (const q of r.slice(1)) sk.lineTo(q);
    return sk.close();
  });
  return new Drawing(organiseBlueprints(blueprints));
}

export function frame(d: Dimensions): Shape3D {
  const t = d.frameT;
  let s = prism(drawRoundedRectangle(d.frameW, d.frameH, d.frameR), -t, 0);
  s = s.cut(prism(rect(d.windowW, d.windowH), -t, 0));
  s = s.cut(prism(rect(d.rebateW, d.rebateH), -d.legendT, 0));
  const window = inFace(-t, d.windowW, d.windowH);
  s = s.chamfer(d.frameCh, (e) => e.inPlane('XZ', [0, -t, 0]).not(window));
  s = s.chamfer(d.windowCh, (e) => window(e.inPlane('XZ', [0, -t, 0])));
  for (const x of [-d.screwSpacing / 2, d.screwSpacing / 2]) {
    s = s.cut(prism(circle(M3.holeD, x), -t - 0.1, 0.1));
    if (d.head === 'countersunk') {
      // 90° countersink: cone from the countersink Ø (at the front) to the clearance Ø,
      // extended 0.1 in front of the face for a clean cut.
      const sink = (M3.cskD - M3.holeD) / 2;
      s = s.cut(prism(drawCircle(M3.cskD / 2 + 0.1), -t - 0.1, -t + sink, [x, 0], M3.holeD / (M3.cskD + 0.2)));
    }
  }
  return s;
}

// Legend before the veil is fused with its letters: mask (opaque, its islands included),
// veil plate and letters. The preview shows them as is: the fuse alone takes most of the
// legend time.
export function legendPieces(d: Dimensions, layout: LegendLayout): { mask: Shape3D; plate: Shape3D; letters: Shape3D } {
  const ink = inkDrawing(layout);
  const plate = rect(d.legendW, d.legendH);
  const mask = prism(plate.cut(ink), -d.legendT, -d.veilT);
  return { mask, plate: prism(plate, -d.veilT, 0), letters: prism(ink, -d.legendT, -d.veilT) };
}

// Mask and diffusing veil with the inlaid letters, as one body: letters and veil are the
// same filament in v1.
export function legend(d: Dimensions, layout: LegendLayout): { mask: Shape3D; veil: Shape3D } {
  const { mask, plate, letters } = legendPieces(d, layout);
  return { mask, veil: plate.fuse(letters) };
}

export function box(d: Dimensions): Shape3D {
  const xs = [-d.screwSpacing / 2, d.screwSpacing / 2];
  const flangeEnd = d.panelT + d.flangeT;
  let s = prism(rect(d.rebateW, d.rebateH), 0, flangeEnd);                            // tube
  s = s.fuse(prism(drawRoundedRectangle(d.frameW, d.frameH, d.frameR), d.panelT, flangeEnd));   // flange
  s = s.fuse(prism(rect(d.boxW, d.boxH), d.panelT, d.boxBack));                       // body
  for (const x of xs) s = s.fuse(prism(circle(d.bossD, x), d.panelT, d.panelT + d.insertHoleL + 1));   // bosses
  s = s.cut(prism(rect(d.windowW, d.windowH), 0, d.pocketFront));                     // cavity
  s = s.cut(prism(rect(d.pocketW, d.pocketH), d.pocketFront, d.boxBack));             // pocket
  s = s.chamfer(d.entryCh, (e) => inFace(d.boxBack, d.pocketW, d.pocketH)(e));
  // Pry notches at the top and bottom of the back edge (flat screwdriver to remove the
  // cover), overrunning the wall for a clean cut.
  for (const sz of [1, -1]) {
    s = s.cut(prism(rect(d.notchW, d.notchH + 1, 0, sz * (d.boxH / 2 + 0.5 - d.notchH / 2)), d.boxBack - d.notchD, d.boxBack));
  }
  // Ribbon cable slot in the wire exit wall, open towards the back.
  const wallX = d.wireSide * (d.pocketW / 2 + d.boxWall / 2);
  s = s.cut(prism(rect(d.boxWall + 2, d.slotL, wallX), d.boxBack - (d.stripT + d.slotW), d.boxBack));
  for (const x of xs) s = s.cut(prism(circle(M3.insertD, x), d.panelT, d.panelT + d.insertHoleL));   // inserts, from the front
  return s;
}

export function cover(d: Dimensions): Shape3D {
  const outside = d.boxBack + d.coverT;
  const railFront = outside - (d.coverT + d.railH);
  let s = prism(rect(d.boxW, d.boxH), d.boxBack, outside);                            // plate
  // Tab closing the ribbon cable slot of the box, flush with the strip.
  const wallX = d.wireSide * (d.pocketW / 2 + d.boxWall / 2);
  s = s.fuse(prism(rect(d.boxWall, d.slotL - 2 * d.fit, wallX), d.boxBack - d.stripT, d.boxBack));
  // Rails on each side of the strip, with rounded ends (press fit against the ends of the
  // pocket), then crush ribs on their outer face.
  const rz = d.railGap / 2 + d.railT / 2, rx = (d.railL - d.railT) / 2;
  for (const sz of [1, -1]) {
    let rail = rect(d.railL - d.railT, d.railT, 0, sz * rz);
    for (const sx of [1, -1]) rail = rail.fuse(circle(d.railT, sx * rx, sz * rz));
    s = s.fuse(prism(rail, railFront, outside));
    for (const sx of [1, -1]) s = s.fuse(prism(circle(d.ribD, sx * d.ribX, sz * (d.railGap / 2 + d.railT)), railFront, outside));
  }
  // Clips on the inner face of the rails: they cover the edges of the strip, snapped in
  // from the front, with a lead-in chamfer.
  const clipBack = d.stripBack - d.stripT, clipFront = clipBack - d.clipT;
  const clipH = d.fit + d.clipOver;
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) s = s.fuse(prism(rect(d.clipL, clipH, sx * d.clipX, sz * (d.railGap / 2 - clipH / 2)), clipFront, clipBack));
  }
  const zc = d.railGap / 2 - clipH;
  s = s.chamfer(d.clipCh, (e) => e.inDirection('X').inBox([-d.boxW, clipFront - 0.01, -zc - 0.01], [d.boxW, clipFront + 0.01, zc + 0.01]));
  return s;
}

// Test panel: cutout and 2 screw holes, as in the host panel.
export function testPanel(d: Dimensions): Shape3D {
  let s = prism(rect(d.testW, d.testH), 0, d.panelT);
  s = s.cut(prism(rect(d.cutW, d.cutH), -0.1, d.panelT + 0.1));
  for (const x of [-d.screwSpacing / 2, d.screwSpacing / 2]) s = s.cut(prism(circle(M3.holeD, x), -0.1, d.panelT + 0.1));
  return s;
}

export interface Parts { frame: Shape3D; mask: Shape3D; veil: Shape3D; box: Shape3D; cover: Shape3D; testPanel: Shape3D }

export function buildParts(d: Dimensions, layout: LegendLayout): Parts {
  return { frame: frame(d), ...legend(d, layout), box: box(d), cover: cover(d), testPanel: testPanel(d) };
}
