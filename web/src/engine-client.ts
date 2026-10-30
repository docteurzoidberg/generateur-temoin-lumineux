// Page side of the OpenCascade worker (engine.ts): requests run one at a time, in order.
// OpenCascade leaks in boolean operations (replicad issue #282: about 0.2 MB each, a few
// tens of MB per full rebuild), so once a reply reports a heap past RESTART_HEAP, the worker
// is replaced by a fresh one before the next request; its preview cache goes with it.
import type { EngineReply, EngineRequest, FromEngine } from './protocol.ts';

export const RESTART_HEAP = 512 * 2 ** 20;

export interface EngineEvents {
  ready(ms: number): void;        // OpenCascade started (again)
  failed(message: string): void;  // it could not start
  restarting(): void;             // the worker is being replaced
}

export function createEngine(events: EngineEvents) {
  let worker: Worker;
  let ready: Promise<void>;
  let pending: ((reply: EngineReply) => void) | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  let nextId = 0;

  function start(): void {
    worker = new Worker(new URL('./engine.ts', import.meta.url), { type: 'module' });
    ready = new Promise((resolve, reject) => {
      worker.onmessage = ({ data }: MessageEvent<FromEngine>) => {
        if (data.type === 'ready') { events.ready(data.ms); resolve(); }
        else if (data.type === 'failed') { events.failed(data.message); reject(new Error(data.message)); }
        else pending?.(data);
      };
    });
    ready.catch(() => {});   // reported through events.failed; requests reject on their own
  }

  async function run(request: EngineRequest): Promise<EngineReply> {
    await ready;
    const id = ++nextId;
    const reply = await new Promise<EngineReply>((resolve) => {
      pending = (r) => { if (r.id === id) resolve(r); };
      worker.postMessage({ ...request, id });
    });
    pending = undefined;
    if (reply.heap > RESTART_HEAP) {
      worker.terminate();
      events.restarting();
      start();
    }
    return reply;
  }

  start();
  return {
    request(request: EngineRequest): Promise<EngineReply> {
      const result = queue.then(() => run(request));
      queue = result.catch(() => {});
      return result;
    },
  };
}
