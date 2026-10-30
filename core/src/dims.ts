// Dimensions of the indicator (mm), computed from the preset and the values fixed in v1,
// taken from the parameters of the mock-up's temoin.py (validated prints). Indicator
// frame of reference: origin at the centre of the window, on the panel plane (back of the
// frame and of the legend), x to the right, z up, y towards the wall.
import type { Preset } from './preset.ts';

// M3 screws and heat-set inserts: clearance hole, countersink (90°), countersunk head Ø
// (ISO 10642), nominal Ø, insert hole and length, socket head Ø (ISO 4762).
export const M3 = { holeD: 3.4, cskD: 6.3, headD: 6.0, nominalD: 3.0, insertD: 4.0, insertL: 4.0, socketHeadD: 5.5 } as const;
export const NOZZLE = 0.4;   // reference nozzle of the checks (strokes, gaps, walls)
export const SCREW_LENGTHS = [4, 5, 6, 8, 10, 12, 14, 16, 20] as const;   // off the shelf
const INSERT_EXTRA = 1.5;   // insert hole deeper than the insert

// Reference strip: WS2812B 5 V at 144 LED/m, 12 × 0.5 board, 5050 LEDs.
export const STRIP = { ledsPerMeter: 144, width: 12, thickness: 0.5, ledSize: 5, ledH: 1.6, depth: 10 } as const;

export function dimensions(p: Preset) {
  const windowW = p.window.width, windowH = p.window.height;
  const frameW = p.frame.width, frameH = p.frame.height;
  const panelT = p.panel.thickness;
  const fit = 0.2;                       // clearance per side: legend, tube, pocket
  const lip = 1;
  const faceT = 0.8, veilT = 0.6;        // mask and letters (4 layers), veil (3 layers)
  const legendT = faceT + veilT;
  const legendW = windowW + 2 * lip, legendH = windowH + 2 * lip;
  const rebateW = legendW + 2 * fit, rebateH = legendH + 2 * fit;   // rebate = outside of the tube
  const ledPitch = 1000 / STRIP.ledsPerMeter;
  const ledCount = Math.max(1, Math.round(windowW / ledPitch));
  const stripL = ledCount * ledPitch;
  const endRoom = 2.5;                   // room for the wires at each end of the strip
  const pocketW = stripL + 2 * endRoom;
  const railT = 1, railH = 2;
  const railGap = STRIP.width + 2 * fit;
  const pocketH = railGap + 2 * railT + 2 * fit;
  const stripBack = STRIP.depth + STRIP.ledH + STRIP.thickness;   // back of the strip, on the cover plate
  const boxBack = stripBack;
  const boxWall = 1.6;
  const coverSqueeze = 0.3;              // cover press fit (ribs, rail ends)
  const wireCount = 4, wirePitch = 1.27;
  return {
    windowW, windowH, frameW, frameH, panelT, fit, lip,
    faceT, veilT, legendT, legendW, legendH, rebateW, rebateH,
    frameT: 2.5, frameR: 1.5, frameCh: 0.3, windowCh: 0.4,
    cutW: rebateW + 2 * fit, cutH: rebateH + 2 * fit,
    // Test panel of the mock-up (60 × 40 for a 47 × 18 frame), grown with the frame.
    testW: Math.max(60, frameW + 13), testH: Math.max(40, frameH + 22),
    head: p.mount.head,
    screwSpacing: (windowW + frameW) / 2,   // screws centred between the window and the frame edge
    insertHoleL: M3.insertL + INSERT_EXTRA,
    bossD: M3.insertD + 2.6,
    flangeT: 2.5, boxWall,
    ledPitch, ledCount, stripL, pocketW, railT, railH, railGap, pocketH,
    stripT: STRIP.thickness, stripBack, boxBack,
    pocketFront: boxBack - railH - fit,
    clipX: ((ledCount - 1) * ledPitch) / 2, clipL: 3, clipOver: 0.4, clipT: 0.6, clipCh: 0.4,
    coverSqueeze, coverT: 1.2,
    railL: pocketW + 2 * coverSqueeze,
    ribD: 2 * (fit + coverSqueeze), ribX: pocketW / 4,
    entryCh: 0.3,
    notchW: 5, notchH: 1, notchD: 1.2,
    boxW: pocketW + 2 * boxWall, boxH: pocketH + 2 * boxWall,
    wireSide: p.light.wireExit === 'left' ? -1 : 1,
    slotL: wireCount * wirePitch + 1, slotW: 1.2,   // slot of the ribbon cable (flat), in front of the strip
  };
}

export type Dimensions = ReturnType<typeof dimensions>;

// Longest off-the-shelf screw whose tip stays 0.3 mm from the bottom of the insert hole
// and that holds at least 60 % of the insert. ISO length: head included for a countersunk
// head (flush), under the head for a socket head (resting on the front). null: none fits.
export function screwLength(d: Dimensions): number | null {
  const top = d.head === 'countersunk' ? -d.frameT + (M3.cskD - M3.headD) / 2 : -d.frameT;
  const ok = SCREW_LENGTHS.filter((L) => d.panelT + 0.6 * M3.insertL <= top + L && top + L <= d.panelT + d.insertHoleL - 0.3);
  return ok.length ? ok[ok.length - 1] : null;
}
