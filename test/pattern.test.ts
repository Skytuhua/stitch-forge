import { describe, it, expect } from 'vitest';
import { BLANK, buildPattern, physicalSize, type ImageDataLike } from '../src/core/pattern';

function makeImage(
  width: number,
  height: number,
  px: (x: number, y: number) => [number, number, number, number],
): ImageDataLike {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      const [r, g, b, a] = px(x, y);
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = a;
    }
  }
  return { width, height, data };
}

describe('buildPattern', () => {
  it('produces a single-color palette for a solid image', () => {
    const img = makeImage(4, 4, () => [200, 30, 30, 255]);
    const p = buildPattern(img, { stitchesWide: 4, maxColors: 8, seed: 1 });
    expect(p.stitchesWide).toBe(4);
    expect(p.stitchesHigh).toBe(4);
    expect(p.palette).toHaveLength(1);
    expect(p.totalStitches).toBe(16);
    expect(p.blankCount).toBe(0);
    expect([...p.cells].every((c) => c === 0)).toBe(true);
    expect(p.palette[0].symbol).toBe('X');
    expect(p.palette[0].count).toBe(16);
  });

  it('separates two color regions into two floss colors', () => {
    const img = makeImage(8, 4, (x) => (x < 4 ? [220, 20, 20, 255] : [20, 20, 220, 255]));
    const p = buildPattern(img, { stitchesWide: 8, maxColors: 8, seed: 2 });
    expect(p.palette.length).toBe(2);
    const total = p.palette.reduce((s, e) => s + e.count, 0);
    expect(total).toBe(32);
    // Distinct floss codes.
    expect(new Set(p.palette.map((e) => e.dmc.code)).size).toBe(2);
  });

  it('treats transparent areas as blank (no stitch)', () => {
    const img = makeImage(4, 4, (_x, y) => (y < 2 ? [0, 0, 0, 0] : [10, 200, 10, 255]));
    const p = buildPattern(img, { stitchesWide: 4, maxColors: 8, seed: 3 });
    expect(p.blankCount).toBe(8);
    expect(p.totalStitches).toBe(8);
    // Top two rows blank, bottom two stitched.
    for (let i = 0; i < 8; i++) expect(p.cells[i]).toBe(BLANK);
    for (let i = 8; i < 16; i++) expect(p.cells[i]).not.toBe(BLANK);
  });

  it('preserves aspect ratio in stitch dimensions', () => {
    const img = makeImage(4, 8, () => [100, 100, 100, 255]);
    const p = buildPattern(img, { stitchesWide: 10, maxColors: 4, seed: 4 });
    expect(p.stitchesWide).toBe(10);
    expect(p.stitchesHigh).toBe(20);
  });

  it('sorts palette by descending stitch count and assigns ordered symbols', () => {
    // 3/4 red, 1/4 blue.
    const img = makeImage(8, 4, (x) => (x < 6 ? [220, 20, 20, 255] : [20, 20, 220, 255]));
    const p = buildPattern(img, { stitchesWide: 8, maxColors: 8, seed: 5 });
    expect(p.palette[0].count).toBeGreaterThanOrEqual(p.palette[1].count);
    expect(p.palette[0].symbol).toBe('X');
    expect(p.palette[1].symbol).toBe('+');
  });

  it('is deterministic for fixed seed', () => {
    const img = makeImage(16, 16, (x, y) => [(x * 16) % 256, (y * 16) % 256, (x * y) % 256, 255]);
    const a = buildPattern(img, { stitchesWide: 16, maxColors: 10, seed: 9 });
    const b = buildPattern(img, { stitchesWide: 16, maxColors: 10, seed: 9 });
    expect([...a.cells]).toEqual([...b.cells]);
    expect(a.palette.map((e) => e.dmc.code)).toEqual(b.palette.map((e) => e.dmc.code));
  });
});

describe('physicalSize', () => {
  it('computes inches and cm for a given Aida count', () => {
    const s = physicalSize(28, 14, 14);
    expect(s.inches.w).toBe(2);
    expect(s.inches.h).toBe(1);
    expect(s.cm.w).toBeCloseTo(5.08, 2);
  });
});
