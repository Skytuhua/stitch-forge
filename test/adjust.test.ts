import { describe, it, expect } from 'vitest';
import { adjustRgb, adjustImage, isIdentity, NO_ADJUSTMENTS } from '../src/core/adjust';
import type { ImageDataLike } from '../src/core/pattern';

describe('adjustRgb', () => {
  it('is a no-op at zero', () => {
    expect(adjustRgb(10, 120, 240, NO_ADJUSTMENTS)).toEqual([10, 120, 240]);
  });

  it('brightness raises and lowers all channels', () => {
    const up = adjustRgb(100, 100, 100, { brightness: 50, contrast: 0, saturation: 0 });
    expect(up[0]).toBeGreaterThan(100);
    const down = adjustRgb(100, 100, 100, { brightness: -50, contrast: 0, saturation: 0 });
    expect(down[0]).toBeLessThan(100);
  });

  it('clamps to 0..255', () => {
    const hi = adjustRgb(250, 250, 250, { brightness: 100, contrast: 0, saturation: 0 });
    expect(hi).toEqual([255, 255, 255]);
    const lo = adjustRgb(5, 5, 5, { brightness: -100, contrast: 0, saturation: 0 });
    expect(lo).toEqual([0, 0, 0]);
  });

  it('saturation -100 produces gray (r=g=b=luma)', () => {
    const [r, g, b] = adjustRgb(200, 50, 10, { brightness: 0, contrast: 0, saturation: -100 });
    expect(r).toBe(g);
    expect(g).toBe(b);
    const luma = Math.round(0.299 * 200 + 0.587 * 50 + 0.114 * 10);
    expect(r).toBeCloseTo(luma, 0);
  });

  it('contrast pushes values away from mid-gray', () => {
    const dark = adjustRgb(60, 60, 60, { brightness: 0, contrast: 60, saturation: 0 });
    expect(dark[0]).toBeLessThan(60); // below 128 gets darker
    const light = adjustRgb(200, 200, 200, { brightness: 0, contrast: 60, saturation: 0 });
    expect(light[0]).toBeGreaterThan(200); // above 128 gets lighter
  });
});

describe('isIdentity / adjustImage', () => {
  it('detects identity', () => {
    expect(isIdentity(NO_ADJUSTMENTS)).toBe(true);
    expect(isIdentity({ brightness: 1, contrast: 0, saturation: 0 })).toBe(false);
  });

  it('preserves alpha and dimensions, leaves input untouched', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 128, 40, 50, 60, 255]);
    const img: ImageDataLike = { width: 2, height: 1, data };
    const out = adjustImage(img, { brightness: 20, contrast: 0, saturation: 0 });
    expect(out.width).toBe(2);
    expect(out.height).toBe(1);
    expect(out.data[3]).toBe(128); // alpha preserved
    expect(out.data[7]).toBe(255);
    expect(data[0]).toBe(10); // original unchanged
    expect(out.data[0]).toBeGreaterThan(10);
  });
});
