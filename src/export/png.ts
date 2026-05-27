import { patternPixelSize, renderPattern, type RenderOptions } from '../render/chart';
import type { Pattern } from '../core/pattern';

/** Render a pattern to a fresh detached canvas (used for PNG + PDF thumbnails). */
export function renderPatternToCanvas(p: Pattern, opts: RenderOptions): HTMLCanvasElement {
  const { w, h } = patternPixelSize(p, opts.cellSize);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  renderPattern(ctx, p, opts);
  return canvas;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportPng(p: Pattern, opts: RenderOptions, filename: string): Promise<void> {
  const canvas = renderPatternToCanvas(p, opts);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png'),
  );
  if (!blob) throw new Error('PNG encoding failed');
  downloadBlob(blob, filename);
}
