// v1 checks (docs/generateur.md, checks section): ok, warning or error; an error prevents
// generation. Thresholds come from the specification; walls and strokes of at least 2
// nozzle widths. Lighting uniformity awaits a model fitted on photos (later). Messages are
// shown to the user: they stay in French.
import { M3, NOZZLE, STRIP, type Dimensions } from './dims.ts';
import type { LegendLayout } from './legend.ts';
import { area, centroid, difference, intersection, rectangle, thin } from './polygons.ts';

export interface Check { level: 'ok' | 'warn' | 'error'; code: string; message: string }

const mm = (v: number, digits = 2) => v.toFixed(digits).replace('.', ',');
const WALL = 2 * NOZZLE;

// Error threshold and recommended threshold: below error, an error; below good, a warning.
function graded(code: string, value: number, error: number, good: number, message: string): Check {
  return { level: value < error ? 'error' : value < good ? 'warn' : 'ok', code, message };
}

export function legendChecks(d: Dimensions, layout: LegendLayout): Check[] {
  // The 4 largest areas, then their count.
  const spots = (r: ReturnType<typeof thin>) => {
    const big = [...r].sort((a, b) => area(b) - area(a));
    const shown = big.slice(0, 4).map((p) => `${mm(area(p))} mm² en x = ${mm(centroid(p)[0], 1)}`).join(', ');
    return big.length > 4 ? `${shown} et ${big.length - 4} autre(s)` : shown;
  };
  const strokes = thin(layout.ink, NOZZLE);
  const window = rectangle(d.windowW, d.windowH);
  const gaps = thin(difference(rectangle(d.legendW, d.legendH), layout.ink), NOZZLE).filter((p) => intersection([p], window).length);
  const checks: Check[] = [
    { level: strokes.length ? 'warn' : 'ok', code: 'legend.strokes', message: `traits plus fins que la buse (${mm(NOZZLE, 1)} mm) : ${strokes.length ? spots(strokes) : 'aucun'}` },
    { level: gaps.length ? 'warn' : 'ok', code: 'legend.gaps', message: `espaces du masque plus fins que la buse : ${gaps.length ? spots(gaps) : 'aucun'}` },
  ];
  if (layout.islands.length) {
    checks.push({ level: 'ok', code: 'legend.islands', message: `${layout.islands.length} îlot(s) de masque, tenus par le voile` });
  }
  return checks;
}

function mountRules(d: Dimensions): Check[] {
  const x = d.screwSpacing / 2;
  const overlap = Math.min(d.frameW - d.cutW, d.frameH - d.cutH) / 2;
  const bridge = x - M3.holeD / 2 - d.cutW / 2;
  const headR = (d.head === 'countersunk' ? M3.cskD : M3.socketHeadD) / 2;
  const headRoom = Math.min(d.frameW / 2 - (x + headR), d.frameH / 2 - headR, x - headR - (d.windowW / 2 + d.windowCh));
  const insertWall = x - M3.insertD / 2 - d.windowW / 2;
  const bossOut = x + d.bossD / 2 - d.frameW / 2;
  const checks = [
    graded('mount.overlap', overlap, WALL, 1.5, `le cadre déborde la découpe de ${mm(overlap)} mm (au moins 1,5)`),
    graded('mount.bridge', bridge, 0, 1.5, `${mm(bridge)} mm de panneau entre la découpe et chaque trou de vis (au moins 1,5)`),
    graded('mount.head', headRoom, 0, WALL, `${d.head === 'countersunk' ? 'fraisure' : 'tête de vis'} à ${mm(headRoom)} mm du bord du cadre ou de la fenêtre (au moins ${mm(WALL, 1)})`),
    graded('mount.insert', insertWall, WALL, WALL, `paroi de ${mm(insertWall)} mm entre l'insert et la cavité de la boîte (au moins ${mm(WALL, 1)})`),
  ];
  if (bossOut > 0) checks.push({ level: 'warn', code: 'mount.boss', message: `bossages des inserts hors du cadre de ${mm(bossOut)} mm, derrière le panneau` });
  return checks;
}

// Frame (and screw spacing, centred between the window and the edge) of w × h.
const withFrame = (d: Dimensions, w: number, h: number): Dimensions => ({ ...d, frameW: w, frameH: h, screwSpacing: (d.windowW + w) / 2 });

// Smallest frame, to the half millimetre, for which the mounting rules pass without a
// warning: the fix suggested when one of them fails.
function minimalFrame(d: Dimensions): [number, number] {
  const fine = (w: number, h: number) => mountRules(withFrame(d, w, h)).every((c) => c.level === 'ok');
  let w = d.windowW, h = d.windowH;
  while (!fine(w, 1000) && w < d.windowW + 100) w += 0.5;
  while (!fine(w, h) && h < d.windowH + 100) h += 0.5;
  return [w, h];
}

export function mountChecks(d: Dimensions): Check[] {
  const checks = mountRules(d);
  const worst = checks.some((c) => c.level === 'error') ? 'error' : checks.some((c) => c.level === 'warn') ? 'warn' : 'ok';
  if (worst !== 'ok') {
    const [w, h] = minimalFrame(d);
    checks.push({ level: worst, code: 'mount.frame', message: `cadre conseillé pour une fenêtre de ${mm(d.windowW, 1)} × ${mm(d.windowH, 1)} : au moins ${mm(w, 1)} × ${mm(h, 1)} mm (actuel ${mm(d.frameW, 1)} × ${mm(d.frameH, 1)})` });
  }
  return checks;
}

export function lightChecks(d: Dimensions): Check[] {
  const out = d.clipX + STRIP.ledSize / 2 - d.windowW / 2;
  return [out > 0
    ? { level: 'warn', code: 'light.leds', message: `LED extrêmes à ${mm(out)} mm derrière le cadre, hors de la fenêtre` }
    : { level: 'ok', code: 'light.leds', message: `${d.ledCount} LED dans la fenêtre` }];
}
