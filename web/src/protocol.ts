// Messages between the page (main.ts) and its two workers: checks (checker.ts, without
// OpenCascade, on every input) and the OpenCascade engine (engine.ts, through
// engine-client.ts: 3D preview and files).
import type { Check, PreviewPart } from '@temoin/core';
import type { FaceModel } from './face-model.ts';

export type ToChecker = { id: number; preset: unknown };

export type FromChecker = {
  id: number;
  ok: boolean;                        // no error: generation is possible
  checks: Check[];
  summary?: [string, string][];       // mounting, like the summary of temoin check
  face?: FaceModel;                   // as soon as the preset is valid, even if mounting fails
  json?: string;                      // preset to save (the <name>.json of temoin generate), as soon as it is valid
};

export type EngineRequest =
  | { type: 'preview'; preset: unknown }
  | { type: 'generate'; name: string; preset: unknown };

export type ToEngine = EngineRequest & { id: number };

// Replies carry the size of the OpenCascade heap (bytes), which only grows.
export type EngineReply = { id: number; heap: number } & (
  | { type: 'preview'; ok: true; parts: PreviewPart[]; built: string[]; ms: number }
  | { type: 'preview'; ok: false; message: string }          // preset or legend not usable
  | { type: 'generated'; ok: boolean; checks: Check[]; files: string[]; zip?: Uint8Array<ArrayBuffer>; ms: number }
  | { type: 'error'; message: string });

export type FromEngine =
  | { type: 'ready'; ms: number }                     // OpenCascade and the font started
  | { type: 'failed'; message: string }               // they could not start
  | EngineReply;
