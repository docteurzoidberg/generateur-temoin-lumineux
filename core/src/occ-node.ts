// OpenCascade (WASM) start-up under Node, for the command line and the tests; the page
// does it on its own (the .wasm is a separately served file there, LGPL licence).
import { createRequire } from 'node:module';
import opencascade from 'replicad-opencascadejs';
import { setOC } from 'replicad';

let ready: Promise<void> | null = null;

export function initOC(): Promise<void> {
  ready ??= (async () => {
    const wasm = createRequire(import.meta.url).resolve('replicad-opencascadejs/wasm');
    // OpenCascade messages (STEP export statistics…) dropped: the command line output
    // stays readable, and its JSON valid.
    const quiet = () => {};
    setOC(await opencascade({ locateFile: () => wasm, print: quiet, printErr: quiet } as Parameters<typeof opencascade>[0]));
  })();
  return ready;
}
