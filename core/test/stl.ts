// Reads a binary STL (file or bytes): volume (mm³), bounds, sorted extent dimensions.
import { readFileSync } from 'node:fs';

export function stlStats(src: URL | string | Uint8Array): { volume: number; lo: number[]; hi: number[]; size: number[] } {
  const u = src instanceof Uint8Array ? src : readFileSync(src);
  const b = new DataView(u.buffer, u.byteOffset, u.byteLength);
  const n = b.getUint32(80, true);
  let v = 0;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50 + 12;
    const p = [0, 1, 2].map((k) => [0, 1, 2].map((j) => b.getFloat32(o + k * 12 + j * 4, true)));
    for (const q of p) for (let j = 0; j < 3; j++) { lo[j] = Math.min(lo[j], q[j]); hi[j] = Math.max(hi[j], q[j]); }
    const [a, c, d] = p;
    v += (a[0] * (c[1] * d[2] - c[2] * d[1]) - a[1] * (c[0] * d[2] - c[2] * d[0]) + a[2] * (c[0] * d[1] - c[1] * d[0])) / 6;
  }
  return { volume: Math.abs(v), lo, hi, size: hi.map((h, j) => h - lo[j]).sort((x, y) => y - x) };
}
