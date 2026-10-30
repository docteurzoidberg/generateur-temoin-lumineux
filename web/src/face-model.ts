// Front view: what to draw, computed in the checks worker from the core's dimensions and
// legend; the page (face.ts) only has to draw it. Dimensions in mm, origin at the centre of
// the window, y down (SVG).
import { M3, type Dimensions, type LegendLayout, type Preset, type Ring } from '@temoin/core';

export interface FaceModel {
  frame: { w: number; h: number; r: number; color: string };
  window: { w: number; h: number; color: string };   // legend background (mask)
  ink: string;                                        // letters as an SVG path, counters as holes (evenodd)
  screws: { x: number; head: number; recess?: number; hex: number }[];   // Ø of head and countersink, hex key size
}

const HEX = { countersunk: 2, socket: 2.5 };   // hex key of M3 screws: ISO 10642, ISO 4762

const ring = (r: Ring) => 'M' + r.map(([x, y]) => `${+x.toFixed(3)} ${+(-y).toFixed(3)}`).join('L') + 'Z';

export function faceModel(p: Preset, d: Dimensions, layout?: LegendLayout): FaceModel {
  const x = d.screwSpacing / 2;
  const screw = d.head === 'countersunk' ? { head: M3.headD, recess: M3.cskD } : { head: M3.socketHeadD };
  return {
    frame: { w: d.frameW, h: d.frameH, r: d.frameR, color: p.frame.color },
    window: { w: d.windowW, h: d.windowH, color: p.legend.background },
    ink: layout ? layout.ink.flatMap((poly) => [poly.outer, ...poly.holes]).map(ring).join('') : '',
    screws: [-x, x].map((sx) => ({ x: sx, ...screw, hex: HEX[d.head] })),
  };
}
