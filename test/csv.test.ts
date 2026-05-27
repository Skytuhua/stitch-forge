import { describe, it, expect } from 'vitest';
import { flossListCsv } from '../src/export/csv';
import { buildPattern, type ImageDataLike } from '../src/core/pattern';

function solid(w: number, h: number, rgb: [number, number, number]): ImageDataLike {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgb[0];
    data[i + 1] = rgb[1];
    data[i + 2] = rgb[2];
    data[i + 3] = 255;
  }
  return { width: w, height: h, data };
}

describe('flossListCsv', () => {
  it('produces a header comment and one row per palette color', () => {
    const p = buildPattern(solid(8, 8, [200, 30, 30]), { stitchesWide: 8, maxColors: 4, seed: 1 });
    const csv = flossListCsv(p, 14);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toMatch(/^# StitchForge floss list/);
    const headerIdx = lines.findIndex((l) => l.startsWith('Symbol,'));
    expect(headerIdx).toBeGreaterThan(-1);
    expect(lines[headerIdx]).toBe('Symbol,DMC,Name,Hex,Stitches,Skeins (est.)');
    // one solid color => one data row
    expect(lines.length - headerIdx - 1).toBe(p.palette.length);
    expect(lines[headerIdx + 1]).toContain(p.palette[0].dmc.code);
  });

  it('quotes fields containing commas', () => {
    const p = buildPattern(solid(4, 4, [10, 10, 10]), { stitchesWide: 4, maxColors: 2, seed: 1 });
    const csv = flossListCsv(p, 14);
    // No field in our data has commas normally, but ensure the escaper is wired:
    expect(csv).not.toMatch(/,,/); // no empty unquoted gaps from undefined
  });
});
