import { describe, it, expect } from 'vitest';
import {
  ciede2000,
  delinearizeChannel,
  hexOf,
  linearizeChannel,
  readableInkOn,
  rgbToLab,
} from '../src/core/color';

describe('rgbToLab', () => {
  it('maps white to L=100, a=b=0', () => {
    const lab = rgbToLab({ r: 255, g: 255, b: 255 });
    expect(lab.L).toBeCloseTo(100, 2);
    expect(lab.a).toBeCloseTo(0, 2);
    expect(lab.b).toBeCloseTo(0, 2);
  });

  it('maps black to L=0', () => {
    const lab = rgbToLab({ r: 0, g: 0, b: 0 });
    expect(lab.L).toBeCloseTo(0, 4);
    expect(lab.a).toBeCloseTo(0, 4);
    expect(lab.b).toBeCloseTo(0, 4);
  });

  it('maps mid gray (128) to neutral ~L 53.6', () => {
    const lab = rgbToLab({ r: 128, g: 128, b: 128 });
    expect(lab.L).toBeCloseTo(53.59, 1);
    expect(lab.a).toBeCloseTo(0, 2);
    expect(lab.b).toBeCloseTo(0, 2);
  });

  it('pure red has positive a and b', () => {
    const lab = rgbToLab({ r: 255, g: 0, b: 0 });
    expect(lab.L).toBeCloseTo(53.24, 1);
    expect(lab.a).toBeGreaterThan(70);
    expect(lab.b).toBeGreaterThan(60);
  });
});

describe('linear channel round-trip', () => {
  it('round-trips representative values', () => {
    for (const v of [0, 1, 64, 128, 200, 255]) {
      expect(delinearizeChannel(linearizeChannel(v))).toBe(v);
    }
  });
});

describe('ciede2000', () => {
  // Canonical test pairs from Sharma, Wu & Dalal (2005).
  const cases: Array<[number, number, number, number, number, number, number]> = [
    [50, 2.6772, -79.7751, 50, 0, -82.7485, 2.0425],
    [50, 3.1571, -77.2803, 50, 0, -82.7485, 2.8615],
    [50, 2.8361, -74.02, 50, 0, -82.7485, 3.4412],
    [50, -1.3802, -84.2814, 50, 0, -82.7485, 1.0],
    [50, -1.1848, -84.8006, 50, 0, -82.7485, 1.0],
    [50, -0.9009, -85.5211, 50, 0, -82.7485, 1.0],
    [50, 0, 0, 50, -1, 2, 2.3669],
    [50, 2.49, -0.001, 50, -2.49, 0.0009, 7.1792],
    [50, 2.49, -0.001, 50, -2.49, 0.0011, 7.2195],
    [50, -0.001, 2.49, 50, 0.0009, -2.49, 4.8045],
    [60.2574, -34.0099, 36.2677, 60.4626, -34.1751, 39.4387, 1.2644],
    [63.0109, -31.0961, -5.8663, 62.8187, -29.7946, -4.0864, 1.263],
    [35.0831, -44.1164, 3.7933, 35.0232, -40.0716, 1.5901, 1.8645],
    [22.7233, 20.0904, -46.694, 23.0331, 14.973, -42.5619, 2.0373],
  ];

  it('matches reference dE00 values', () => {
    for (const [L1, a1, b1, L2, a2, b2, expected] of cases) {
      const d = ciede2000({ L: L1, a: a1, b: b1 }, { L: L2, a: a2, b: b2 });
      expect(d).toBeCloseTo(expected, 3);
    }
  });

  it('is zero for identical colors and symmetric', () => {
    const x = { L: 40, a: 12, b: -7 };
    const y = { L: 70, a: -20, b: 33 };
    expect(ciede2000(x, x)).toBeCloseTo(0, 6);
    expect(ciede2000(x, y)).toBeCloseTo(ciede2000(y, x), 9);
  });
});

describe('hex + ink helpers', () => {
  it('formats hex uppercase with leading zeros', () => {
    expect(hexOf({ r: 0, g: 16, b: 255 })).toBe('#0010FF');
  });
  it('picks black ink on light, white on dark', () => {
    expect(readableInkOn({ r: 255, g: 255, b: 255 })).toBe('#000000');
    expect(readableInkOn({ r: 0, g: 0, b: 0 })).toBe('#FFFFFF');
  });
});
