import { buildPattern, type BuildOptions, type ImageDataLike, type Pattern } from '../core/pattern';

export interface BuildRequest {
  type: 'build';
  image: ImageDataLike;
  opts: BuildOptions;
}

export type BuildResponse =
  | { type: 'done'; pattern: Pattern; elapsedMs: number }
  | { type: 'error'; message: string };

self.onmessage = (e: MessageEvent<BuildRequest>) => {
  const msg = e.data;
  if (msg.type !== 'build') return;
  try {
    const t0 = performance.now();
    const pattern = buildPattern(msg.image, msg.opts);
    const res: BuildResponse = { type: 'done', pattern, elapsedMs: performance.now() - t0 };
    // Transfer the cells buffer back to avoid a copy.
    (self as unknown as Worker).postMessage(res, [pattern.cells.buffer]);
  } catch (err) {
    const res: BuildResponse = {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(res);
  }
};
