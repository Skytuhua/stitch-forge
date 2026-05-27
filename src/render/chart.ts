import { readableInkOn } from '../core/color';
import { BLANK, type Pattern } from '../core/pattern';

export type ViewMode = 'color' | 'symbol';

export interface RenderOptions {
  cellSize: number;
  mode: ViewMode;
  showMinorGrid: boolean;
  showMajorGrid: boolean;
  /** Color drawn for BLANK (unstitched) cells. */
  blankColor?: string;
  /** When set, dims all cells except this palette index (and rings them). */
  highlight?: number | null;
}

const MINOR_GRID = '#0000001f';
const MAJOR_GRID = '#000000aa';

export function patternPixelSize(p: Pattern, cellSize: number): { w: number; h: number } {
  return { w: p.stitchesWide * cellSize, h: p.stitchesHigh * cellSize };
}

/**
 * Render a pattern onto a 2D context. The caller sizes the canvas to
 * `patternPixelSize(...)`. Pure drawing — no DOM lookups.
 */
export function renderPattern(
  ctx: CanvasRenderingContext2D,
  p: Pattern,
  opts: RenderOptions,
): void {
  const { cellSize, mode } = opts;
  const blankColor = opts.blankColor ?? '#ffffff';
  const { w, h } = patternPixelSize(p, cellSize);

  ctx.clearRect(0, 0, w, h);

  // Cell fills.
  for (let y = 0; y < p.stitchesHigh; y++) {
    for (let x = 0; x < p.stitchesWide; x++) {
      const idx = p.cells[y * p.stitchesWide + x];
      const px = x * cellSize;
      const py = y * cellSize;
      if (idx === BLANK) {
        ctx.fillStyle = blankColor;
        ctx.fillRect(px, py, cellSize, cellSize);
        continue;
      }
      const dmc = p.palette[idx].dmc;
      ctx.fillStyle = `rgb(${dmc.r},${dmc.g},${dmc.b})`;
      ctx.fillRect(px, py, cellSize, cellSize);
    }
  }

  // Symbols (only when cells are large enough to be legible).
  if (mode === 'symbol' && cellSize >= 9) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(cellSize * 0.72)}px ui-monospace, "Courier New", monospace`;
    for (let y = 0; y < p.stitchesHigh; y++) {
      for (let x = 0; x < p.stitchesWide; x++) {
        const idx = p.cells[y * p.stitchesWide + x];
        if (idx === BLANK) continue;
        const entry = p.palette[idx];
        ctx.fillStyle = readableInkOn(entry.dmc);
        ctx.fillText(
          entry.symbol,
          x * cellSize + cellSize / 2,
          y * cellSize + cellSize / 2 + cellSize * 0.04,
        );
      }
    }
  }

  if (opts.highlight != null) {
    drawHighlight(ctx, p, opts);
  }

  drawGrid(ctx, p, opts, w, h);
}

/** Dim everything, then repaint the highlighted floss at full strength. */
function drawHighlight(ctx: CanvasRenderingContext2D, p: Pattern, opts: RenderOptions): void {
  const { cellSize } = opts;
  const target = opts.highlight;
  const { w, h } = patternPixelSize(p, cellSize);

  ctx.fillStyle = 'rgba(250,248,244,0.8)';
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < p.stitchesHigh; y++) {
    for (let x = 0; x < p.stitchesWide; x++) {
      const idx = p.cells[y * p.stitchesWide + x];
      if (idx !== target) continue;
      const dmc = p.palette[idx].dmc;
      const px = x * cellSize;
      const py = y * cellSize;
      ctx.fillStyle = `rgb(${dmc.r},${dmc.g},${dmc.b})`;
      ctx.fillRect(px, py, cellSize, cellSize);
      if (opts.mode === 'symbol' && cellSize >= 9) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${Math.round(cellSize * 0.72)}px ui-monospace, "Courier New", monospace`;
        ctx.fillStyle = readableInkOn(dmc);
        ctx.fillText(p.palette[idx].symbol, px + cellSize / 2, py + cellSize / 2 + cellSize * 0.04);
      }
    }
  }
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  p: Pattern,
  opts: RenderOptions,
  w: number,
  h: number,
): void {
  const { cellSize } = opts;
  const minor = opts.showMinorGrid && cellSize >= 6;

  if (minor) {
    ctx.strokeStyle = MINOR_GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= p.stitchesWide; x++) {
      if (x % 10 === 0) continue;
      const px = Math.round(x * cellSize) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
    }
    for (let y = 0; y <= p.stitchesHigh; y++) {
      if (y % 10 === 0) continue;
      const py = Math.round(y * cellSize) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
    }
    ctx.stroke();
  }

  if (opts.showMajorGrid) {
    ctx.strokeStyle = MAJOR_GRID;
    ctx.lineWidth = cellSize >= 6 ? 1.5 : 1;
    ctx.beginPath();
    for (let x = 0; x <= p.stitchesWide; x += 10) {
      const px = Math.round(x * cellSize) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
    }
    for (let y = 0; y <= p.stitchesHigh; y += 10) {
      const py = Math.round(y * cellSize) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
    }
    // Always close the outer border.
    ctx.moveTo(0.5, 0.5);
    ctx.lineTo(w - 0.5, 0.5);
    ctx.lineTo(w - 0.5, h - 0.5);
    ctx.lineTo(0.5, h - 0.5);
    ctx.lineTo(0.5, 0.5);
    ctx.stroke();
  }
}
