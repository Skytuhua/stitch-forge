import { describe, it, expect } from 'vitest';
import { kMeansLab } from '../src/core/quantize';
import { rgbToLab, type Lab } from '../src/core/color';

const lab = (r: number, g: number, b: number): Lab => rgbToLab({ r, g, b });

describe('kMeansLab', () => {
  it('handles empty input', () => {
    const res = kMeansLab([], 4);
    expect(res.centroids).toHaveLength(0);
    expect(res.assignments).toHaveLength(0);
  });

  it('clamps k to the number of distinct points', () => {
    const points = [lab(255, 0, 0), lab(255, 0, 0), lab(0, 0, 255)];
    const res = kMeansLab(points, 10, { seed: 1 });
    expect(res.centroids.length).toBe(2);
    expect(res.assignments).toHaveLength(3);
  });

  it('separates two well-defined clusters', () => {
    const reds = Array.from({ length: 20 }, (_, i) => lab(250 - i, 10, 10));
    const blues = Array.from({ length: 20 }, (_, i) => lab(10, 10, 250 - i));
    const res = kMeansLab([...reds, ...blues], 2, { seed: 7 });
    expect(res.centroids).toHaveLength(2);
    // All reds share one cluster, all blues share the other.
    const redClusters = new Set(res.assignments.slice(0, 20));
    const blueClusters = new Set(res.assignments.slice(20));
    expect(redClusters.size).toBe(1);
    expect(blueClusters.size).toBe(1);
    expect([...redClusters][0]).not.toBe([...blueClusters][0]);
  });

  it('is deterministic for a fixed seed', () => {
    const pts = Array.from({ length: 50 }, (_, i) => lab((i * 37) % 256, (i * 53) % 256, i % 256));
    const a = kMeansLab(pts, 6, { seed: 42 });
    const b = kMeansLab(pts, 6, { seed: 42 });
    expect([...a.assignments]).toEqual([...b.assignments]);
  });
});
