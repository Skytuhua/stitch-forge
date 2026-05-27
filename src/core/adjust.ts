// Pre-quantization image adjustments. Photos frequently need a brightness /
// contrast / saturation nudge before they stitch well, so these are applied to
// the source pixels before downsampling and floss matching.
//
// Each control is in the range -100..100, where 0 is "no change".

import type { ImageDataLike } from './pattern';

export interface Adjustments {
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100 (grayscale) .. 100 (doubled)
}

export const NO_ADJUSTMENTS: Adjustments = { brightness: 0, contrast: 0, saturation: 0 };

export function isIdentity(a: Adjustments): boolean {
  return a.brightness === 0 && a.contrast === 0 && a.saturation === 0;
}

const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Apply brightness/contrast/saturation to a single sRGB triple (0..255).
 * Order: brightness, then contrast, then saturation. Pure and unit-tested.
 */
export function adjustRgb(
  r: number,
  g: number,
  b: number,
  a: Adjustments,
): [number, number, number] {
  // Brightness: shift by up to +/-255.
  const bShift = (a.brightness / 100) * 255;
  let rr = r + bShift;
  let gg = g + bShift;
  let bb = b + bShift;

  // Contrast: classic factor around mid-gray (128).
  if (a.contrast !== 0) {
    const c = (a.contrast / 100) * 255; // -255..255
    const f = (259 * (c + 255)) / (255 * (259 - c));
    rr = f * (rr - 128) + 128;
    gg = f * (gg - 128) + 128;
    bb = f * (bb - 128) + 128;
  }

  // Saturation: mix toward/away from luma. -100 => grayscale, +100 => 2x.
  if (a.saturation !== 0) {
    const s = 1 + a.saturation / 100;
    const luma = 0.299 * rr + 0.587 * gg + 0.114 * bb;
    rr = luma + s * (rr - luma);
    gg = luma + s * (gg - luma);
    bb = luma + s * (bb - luma);
  }

  return [clamp255(rr), clamp255(gg), clamp255(bb)];
}

/** Return a new image with adjustments applied; the input is left untouched. */
export function adjustImage(image: ImageDataLike, a: Adjustments): ImageDataLike {
  const src = image.data;
  const out = new Uint8ClampedArray(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const [r, g, b] = adjustRgb(src[i], src[i + 1], src[i + 2], a);
    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = src[i + 3];
  }
  return { width: image.width, height: image.height, data: out };
}
