// Front view (SVG): frame, window, letters and screw heads in the preset colours. The light
// (light.ts) tints the letters and adds a halo, clipped to the window as by the mask;
// lightFace() only updates them, for the animated effects.
import type { FaceModel } from './face-model.ts';
import { haloShare, mix, UNLIT_INK } from './light.ts';

const NS = 'http://www.w3.org/2000/svg';
const MARGIN = 3;   // mm around the frame

function el(name: string, attrs: Record<string, string | number>, ...children: SVGElement[]): SVGElement {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  e.append(...children);
  return e;
}

const rect = (w: number, h: number, attrs: Record<string, string | number>) =>
  el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, ...attrs });

function hexagon(x: number, across: number): string {
  const r = across / Math.sqrt(3);   // vertex, for a key of `across` flats
  return [0, 1, 2, 3, 4, 5].map((k) => `${(x + r * Math.cos((k * Math.PI) / 3)).toFixed(3)},${(r * Math.sin((k * Math.PI) / 3)).toFixed(3)}`).join(' ');
}

export function drawFace(svg: SVGSVGElement, m: FaceModel): void {
  const w = m.frame.w + 2 * MARGIN, h = m.frame.h + 2 * MARGIN;
  svg.setAttribute('viewBox', `${-w / 2} ${-h / 2} ${w} ${h}`);
  const glow = el('filter', { id: 'glow', x: '-20%', y: '-60%', width: '140%', height: '220%' },
    el('feGaussianBlur', { in: 'SourceGraphic', stdDeviation: 0.6, result: 'blur' }),
    el('feMerge', {}, el('feMergeNode', { in: 'blur' }), el('feMergeNode', { in: 'blur' })));
  const clip = el('clipPath', { id: 'window-clip' }, rect(m.window.w, m.window.h, {}));
  const screws = m.screws.map((s) => el('g', { class: 'screw' },
    ...(s.recess ? [el('circle', { cx: s.x, cy: 0, r: s.recess / 2, class: 'recess' })] : []),
    el('circle', { cx: s.x, cy: 0, r: s.head / 2, class: 'head' }),
    el('polygon', { points: hexagon(s.x, s.hex), class: 'socket' })));
  svg.replaceChildren(
    el('defs', {}, glow, clip),
    rect(m.frame.w, m.frame.h, { rx: m.frame.r, fill: m.frame.color, class: 'frame' }),
    rect(m.window.w, m.window.h, { fill: m.window.color, class: 'window' }),
    el('g', { 'clip-path': 'url(#window-clip)' }, el('path', { d: m.ink, 'fill-rule': 'evenodd', filter: 'url(#glow)', class: 'halo' })),
    el('path', { d: m.ink, 'fill-rule': 'evenodd', class: 'ink' }),
    ...screws,
  );
}

// Letters in the light colour at brightness k (0: off, the white veil), halo with them.
export function lightFace(svg: SVGSVGElement, color: string, k: number): void {
  const ink = svg.querySelector<SVGPathElement>('.ink'), halo = svg.querySelector<SVGPathElement>('.halo');
  if (!ink || !halo) return;
  ink.style.fill = mix(UNLIT_INK, mix(color, '#ffffff', 0.35), k);
  halo.style.fill = color;
  halo.style.opacity = String(0.95 * k * haloShare(color));
}
