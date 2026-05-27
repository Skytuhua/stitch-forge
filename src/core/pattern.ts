import { delinearizeChannel, linearizeChannel, rgbToLab, type Lab, type Rgb } from './color';
import { DMC_LAB, nearestDmcLab, type DmcColorLab } from './dmc';
import { kMeansLab } from './quantize';
import { MAX_SYMBOLS, symbolAt } from './symbols';

/** Upper bound on colors, capped by the number of distinct chart symbols. */
export const MAX_COLORS = MAX_SYMBOLS;

/** Cell value for "no stitch here" (fully transparent area of the source). */
export const BLANK = -1;

/**
 * Rough floss usage: ~full cross stitches one DMC skein covers with 2 strands
 * on ~14-count Aida. Clearly an estimate; surfaced as such in the UI.
 */
export const STITCHES_PER_SKEIN = 1500;

export interface ImageDataLike {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface PaletteEntry {
  index: number;
  dmc: DmcColorLab;
  symbol: string;
  count: number;
  skeins: number;
}

export interface Pattern {
  stitchesWide: number;
  stitchesHigh: number;
  /** length = stitchesWide * stitchesHigh; palette index, or BLANK. */
  cells: Int32Array;
  palette: PaletteEntry[];
  totalStitches: number;
  blankCount: number;
}

export interface BuildOptions {
  stitchesWide: number;
  maxColors: number;
  seed?: number;
  /** alpha below this (0..1) marks a cell as BLANK. Default 0.5. */
  alphaThreshold?: number;
}

interface Cell {
  rgb: Rgb;
  lab: Lab;
  blank: boolean;
}

export function buildPattern(image: ImageDataLike, opts: BuildOptions): Pattern {
  const stitchesWide = clampInt(opts.stitchesWide, 1, 2000);
  const aspect = image.height / image.width;
  const stitchesHigh = clampInt(Math.round(stitchesWide * aspect), 1, 2000);
  const maxColors = clampInt(opts.maxColors, 1, MAX_COLORS);
  const alphaThreshold = opts.alphaThreshold ?? 0.5;

  const cells = downscale(image, stitchesWide, stitchesHigh, alphaThreshold);

  // Cluster only the non-blank cells.
  const labs: Lab[] = [];
  const labIndex: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i].blank) {
      labs.push(cells[i].lab);
      labIndex.push(i);
    }
  }

  const out = new Int32Array(stitchesWide * stitchesHigh).fill(BLANK);
  const palette: PaletteEntry[] = [];

  if (labs.length > 0) {
    const { centroids } = kMeansLab(labs, maxColors, { seed: opts.seed });

    // Map each centroid to its nearest real DMC floss, de-duplicating so two
    // near-identical centroids collapse to one floss.
    const chosen = new Map<string, DmcColorLab>();
    for (const c of centroids) {
      const m = nearestDmcLab(c, DMC_LAB);
      chosen.set(m.color.code, m.color);
    }
    const paletteLab = [...chosen.values()];

    // Reassign every cell to the nearest floss *within the chosen palette* —
    // this is more accurate per-cell than trusting the centroid's match.
    const counts = new Int32Array(paletteLab.length);
    const codeToIdx = new Map(paletteLab.map((c, i) => [c.code, i]));
    for (let k = 0; k < labIndex.length; k++) {
      const m = nearestDmcLab(labs[k], paletteLab);
      const pi = codeToIdx.get(m.color.code)!;
      counts[pi]++;
      out[labIndex[k]] = pi;
    }

    // Drop unused palette entries and renumber, then assign symbols.
    const used = paletteLab
      .map((dmc, oldIdx) => ({ dmc, count: counts[oldIdx], oldIdx }))
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count);

    const remap = new Int32Array(paletteLab.length).fill(BLANK);
    used.forEach((e, newIdx) => {
      remap[e.oldIdx] = newIdx;
      palette.push({
        index: newIdx,
        dmc: e.dmc,
        symbol: symbolAt(newIdx),
        count: e.count,
        skeins: Math.max(1, Math.ceil(e.count / STITCHES_PER_SKEIN)),
      });
    });
    for (let i = 0; i < out.length; i++) {
      if (out[i] !== BLANK) out[i] = remap[out[i]];
    }
  }

  const blankCount = out.reduce((acc, v) => acc + (v === BLANK ? 1 : 0), 0);
  return {
    stitchesWide,
    stitchesHigh,
    cells: out,
    palette,
    totalStitches: out.length - blankCount,
    blankCount,
  };
}

function downscale(image: ImageDataLike, w: number, h: number, alphaThreshold: number): Cell[] {
  const { width: sw, height: sh, data } = image;
  const cells: Cell[] = new Array(w * h);

  for (let cy = 0; cy < h; cy++) {
    const y0 = Math.floor((cy * sh) / h);
    const y1 = Math.max(y0 + 1, Math.floor(((cy + 1) * sh) / h));
    for (let cx = 0; cx < w; cx++) {
      const x0 = Math.floor((cx * sw) / w);
      const x1 = Math.max(x0 + 1, Math.floor(((cx + 1) * sw) / w));

      let lr = 0;
      let lg = 0;
      let lb = 0;
      let aw = 0; // alpha-weight (for premultiplied color average)
      let n = 0;
      for (let y = y0; y < y1 && y < sh; y++) {
        for (let x = x0; x < x1 && x < sw; x++) {
          const o = (y * sw + x) * 4;
          const a = data[o + 3] / 255;
          lr += linearizeChannel(data[o]) * a;
          lg += linearizeChannel(data[o + 1]) * a;
          lb += linearizeChannel(data[o + 2]) * a;
          aw += a;
          n++;
        }
      }

      const meanAlpha = n > 0 ? aw / n : 0;
      let rgb: Rgb;
      if (aw > 0) {
        rgb = {
          r: delinearizeChannel(lr / aw),
          g: delinearizeChannel(lg / aw),
          b: delinearizeChannel(lb / aw),
        };
      } else {
        rgb = { r: 255, g: 255, b: 255 };
      }
      cells[cy * w + cx] = {
        rgb,
        lab: rgbToLab(rgb),
        blank: meanAlpha < alphaThreshold,
      };
    }
  }
  return cells;
}

export interface PhysicalSize {
  inches: { w: number; h: number };
  cm: { w: number; h: number };
}

/** Finished stitched size on a given Aida fabric count (stitches per inch). */
export function physicalSize(
  stitchesWide: number,
  stitchesHigh: number,
  fabricCount: number,
): PhysicalSize {
  const wIn = stitchesWide / fabricCount;
  const hIn = stitchesHigh / fabricCount;
  return {
    inches: { w: round2(wIn), h: round2(hIn) },
    cm: { w: round2(wIn * 2.54), h: round2(hIn * 2.54) },
  };
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
