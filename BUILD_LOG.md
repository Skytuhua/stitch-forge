# BUILD_LOG.md

A running journal of decisions, dead ends, and fixes.

## Phase 0 — Environment
- Container: Linux root, Node 22.22, npm 10.9, Python 3.11, Rust 1.94, git 2.43.
  No `gh` CLI → will use git-over-HTTPS + GitHub REST API for repo/release.
- Network: npm, PyPI, GitHub, general web all reachable.
- GitHub token verified: user `Skytuhua`, scopes include `repo` + `workflow`.
  Publishing path confirmed before building.

## Phase 1 — Research
- Surveyed niches. Rejected subtitle tools, EXIF removers, GPX analyzers — all
  **saturated** with free client-side tools.
- Chose **photo → cross-stitch pattern generator**: real demand, but the free
  tier is widely criticized for poor color accuracy / size limits / weak DMC
  matching, while quality tools are paid. Clear, defensible gap. See RESEARCH.md.

## Phase 2/3 — Scaffold & deps
- Stack: Vite + TypeScript, vanilla DOM, Web Worker, Canvas 2D, jsPDF.
- `npm audit` initially flagged 7 vulns: jspdf→dompurify (ships in artifact) and
  esbuild/vite/vitest (dev-only). Upgraded jspdf 2→4.2.1, vite→8, vitest→4.
  Result: **0 vulnerabilities**.
- Vite 8 + Vitest 4: moved `test` config out of `vite.config.ts` into a
  dedicated `vitest.config.ts` (Vite 8's defineConfig rejects the `test` key).
- DMC data: fetched `seanockert/rgb-to-dmc` (454 colors), validated (unique
  codes, RGB in range, white/blanc present), committed raw to
  `assets/dmc-source.json`, and bake it to `src/core/dmc-data.ts` via
  `scripts/build-dmc.mjs`.

## Phase 4 — Build
- Implemented core: color.ts (sRGB↔LAB, CIEDE2000), dmc.ts, quantize.ts
  (seeded k-means++ in LAB), symbols.ts, pattern.ts (linear-light downsample,
  alpha→blank, cluster→DMC→per-cell reassign).
- Wrote 25 unit tests first. One failure was a mistyped CIEDE2000 reference
  (1.8731 → 1.8645); my implementation matched the canonical value. All 13 other
  Sharma reference pairs pass to 1e-3. **25/25 green**, tsc clean.
- (continued below as UI/worker/exports land)
