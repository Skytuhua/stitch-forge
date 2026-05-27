import { describe, it, expect } from 'vitest';
import { DMC_COUNT, DMC_LAB, dmcByCode, nearestDmc } from '../src/core/dmc';

describe('DMC palette', () => {
  it('loads the full palette with unique codes', () => {
    expect(DMC_COUNT).toBe(454);
    const codes = new Set(DMC_LAB.map((c) => c.code));
    expect(codes.size).toBe(DMC_COUNT);
  });

  it('matches an exact DMC color to itself with ~0 distance', () => {
    const black = dmcByCode('310');
    expect(black).toBeDefined();
    const m = nearestDmc({ r: black!.r, g: black!.g, b: black!.b });
    expect(m.color.code).toBe('310');
    expect(m.distance).toBeCloseTo(0, 6);
  });

  it('maps pure white to a white floss', () => {
    const m = nearestDmc({ r: 255, g: 255, b: 255 });
    expect(['B5200', 'White', 'Snow White']).toContain(m.color.code);
  });

  it('maps pure black to DMC 310 (Black)', () => {
    const m = nearestDmc({ r: 0, g: 0, b: 0 });
    expect(m.color.code).toBe('310');
  });

  it('respects a restricted sub-palette', () => {
    const sub = DMC_LAB.filter((c) => c.code === '310' || c.code === 'B5200');
    const m = nearestDmc({ r: 200, g: 200, b: 200 }, sub);
    expect(m.color.code).toBe('B5200'); // light gray is nearer white than black
  });
});
