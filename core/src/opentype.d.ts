// Types for the part of opentype.js 2.0 used by the core (the package ships none).
declare module 'opentype.js/dist/opentype.mjs' {
  export type PathCommand =
    | { type: 'M'; x: number; y: number }
    | { type: 'L'; x: number; y: number }
    | { type: 'Q'; x1: number; y1: number; x: number; y: number }
    | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
    | { type: 'Z' };

  export interface Glyph {
    index: number;
    advanceWidth: number;
    path: { commands: PathCommand[] };
  }

  export interface Font {
    unitsPerEm: number;
    names: { fullName?: Record<string, string> };
    tables: { os2?: { sCapHeight?: number } };
    charToGlyph(char: string): Glyph;
    charToGlyphIndex(char: string): number;
  }

  export function parse(buffer: ArrayBuffer): Font;
}
