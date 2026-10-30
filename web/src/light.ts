// Simulated light of the legend, shared by the front view and the 3D view: off, steady,
// breathing or blinking, in a colour of the RGB strip. A page setting only (not in the
// preset: the host project drives its LEDs); effects as in the mock-up's eclate.html. No
// uniformity model yet: the letters glow evenly.
export type Effect = 'off' | 'steady' | 'breathe' | 'blink';
export interface Light { effect: Effect; color: string }

export const UNLIT_INK = '#cfcdc4';   // white veil seen from the front, LEDs off

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const animated = (light: Light) => !reduceMotion && (light.effect === 'breathe' || light.effect === 'blink');

// Brightness between 0 and 1 at time t (ms): breathing over 3 s, blinking at 1 Hz.
export function intensity(light: Light, t: number): number {
  if (light.effect === 'off') return 0;
  if (light.effect === 'steady' || reduceMotion) return 1;
  if (light.effect === 'breathe') return 0.3 + 0.7 * (0.5 - 0.5 * Math.cos((t / 3000) * Math.PI * 2));
  return t % 1000 < 550 ? 1 : 0.06;
}

// Share of the halo shown for a colour: the bright ones (white, the three LEDs together)
// would flood the letters, so the halo stops at the luminance HALO_LUMINANCE.
const HALO_LUMINANCE = 0.5;
const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export function haloShare(color: string): number {
  const [r, g, b] = [0, 1, 2].map((i) => linear(parseInt(color.slice(1 + 2 * i, 3 + 2 * i), 16) / 255));
  return Math.min(1, HALO_LUMINANCE / (0.2126 * r + 0.7152 * g + 0.0722 * b));
}

// Colour a share k of the way from a to b (#rrggbb).
export function mix(a: string, b: string, k: number): string {
  const c = (hex: string, i: number) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(c(a, i) + (c(b, i) - c(a, i)) * k).toString(16).padStart(2, '0')).join('');
}
