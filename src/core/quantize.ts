import { type Lab } from './color';

// Deterministic k-means clustering in CIELAB space.
//
// Clustering uses squared Euclidean distance in LAB (CIE76): it is the standard,
// fast choice for grouping and is perceptually reasonable in LAB. The expensive,
// perceptually-exact CIEDE2000 is reserved for the floss-*matching* steps in
// pattern.ts (centroid -> DMC and cell -> palette) — the choices a user actually
// sees — keeping the inner clustering loop fast even for large patterns.
//
// Determinism (seeded PRNG + k-means++ init) means the same image + settings
// always produce the same pattern — important for reproducibility and tests.

function dist2(a: Lab, b: Lab): number {
  const dL = a.L - b.L;
  const da = a.a - b.a;
  const db = a.b - b.b;
  return dL * dL + da * da + db * db;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface KMeansResult {
  centroids: Lab[];
  /** assignment[i] = index of the centroid that point i belongs to. */
  assignments: Int32Array;
}

export interface KMeansOptions {
  maxIterations?: number;
  seed?: number;
}

/**
 * Cluster `points` into at most `k` groups. If there are fewer distinct points
 * than `k`, returns one centroid per distinct point.
 */
export function kMeansLab(points: Lab[], k: number, opts: KMeansOptions = {}): KMeansResult {
  const maxIterations = opts.maxIterations ?? 30;
  const n = points.length;
  if (n === 0) return { centroids: [], assignments: new Int32Array(0) };

  const distinct = dedupe(points);
  const kEff = Math.max(1, Math.min(k, distinct.length));

  const rng = mulberry32(opts.seed ?? 0x5717c4);
  let centroids = kppInit(distinct, kEff, rng);
  const assignments = new Int32Array(n).fill(-1);

  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    // Assignment step.
    for (let i = 0; i < n; i++) {
      const p = points[i];
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centroids.length; c++) {
        const d = dist2(p, centroids[c]);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed = true;
      }
    }

    // Update step (mean in LAB).
    const sumL = new Float64Array(centroids.length);
    const sumA = new Float64Array(centroids.length);
    const sumB = new Float64Array(centroids.length);
    const counts = new Int32Array(centroids.length);
    for (let i = 0; i < n; i++) {
      const c = assignments[i];
      sumL[c] += points[i].L;
      sumA[c] += points[i].a;
      sumB[c] += points[i].b;
      counts[c]++;
    }
    const next: Lab[] = centroids.map((old, c) => {
      if (counts[c] === 0) return old; // keep empty centroid; reseed below
      return { L: sumL[c] / counts[c], a: sumA[c] / counts[c], b: sumB[c] / counts[c] };
    });

    // Reseed any empty clusters to the farthest point (avoids dead clusters).
    for (let c = 0; c < next.length; c++) {
      if (counts[c] === 0) {
        next[c] = farthestPoint(points, next, rng);
      }
    }

    centroids = next;
    if (!changed && iter > 0) break;
  }

  return { centroids, assignments };
}

function dedupe(points: Lab[]): Lab[] {
  const seen = new Set<string>();
  const out: Lab[] = [];
  for (const p of points) {
    const key = `${Math.round(p.L * 10)},${Math.round(p.a * 10)},${Math.round(p.b * 10)}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

function kppInit(points: Lab[], k: number, rng: () => number): Lab[] {
  const centroids: Lab[] = [points[Math.floor(rng() * points.length)]];
  const d2 = new Float64Array(points.length).fill(Infinity);

  while (centroids.length < k) {
    const last = centroids[centroids.length - 1];
    let total = 0;
    for (let i = 0; i < points.length; i++) {
      // dist2 already returns squared distance — exactly the D^2 weight kpp wants.
      const sq = dist2(points[i], last);
      if (sq < d2[i]) d2[i] = sq;
      total += d2[i];
    }
    if (total === 0) break;
    let target = rng() * total;
    let chosen = points.length - 1;
    for (let i = 0; i < points.length; i++) {
      target -= d2[i];
      if (target <= 0) {
        chosen = i;
        break;
      }
    }
    centroids.push(points[chosen]);
  }
  return centroids;
}

function farthestPoint(points: Lab[], centroids: Lab[], rng: () => number): Lab {
  let best = points[Math.floor(rng() * points.length)];
  let bestD = -1;
  for (const p of points) {
    let nearest = Infinity;
    for (const c of centroids) {
      const d = dist2(p, c);
      if (d < nearest) nearest = d;
    }
    if (nearest > bestD) {
      bestD = nearest;
      best = p;
    }
  }
  return best;
}
