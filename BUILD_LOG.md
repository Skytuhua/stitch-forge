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
- Built rendering (canvas color + symbol chart), Web Worker, PNG + PDF exports
  (paginated symbol chart with coordinates + floss key), and the full vanilla-TS
  UI (drag/drop, sliders, view toggle, zoom, grid, stats, floss legend) with a
  generated original sample image (sunset) so the tool is demoable with no setup.
- ESLint flat config: disabled core `no-undef` for TS (tsc already covers it;
  the rule false-flagged DOM/WebWorker globals).

## Phase 5 — Self-review & QA (see REVIEW.md for full detail)
- Stood up headless Playwright QA (`scripts/qa.mjs`) + poppler to rasterize and
  inspect the exported PDF. Screenshot evidence in `review/screenshots/`.
- Major fix: spinner overlay never hid — `.spinner-overlay{display:grid}`
  outranked `[hidden]`; added `[hidden]{display:none!important}`.
- Perf: moved clustering off CIEDE2000 to CIE76 (kept CIEDE2000 for floss
  matching): 120w 2.9s→0.55s. Fixed a kpp D² double-square bug found en route.
- jsPDF lazy-loaded on export: initial JS 442kB→37kB.
- Hardened: transparent image (exports disabled), non-image file (clear error),
  1×1, maxColors=1, upscaling — unit-tested. 29/29 tests, 12/12 QA, 0 vulns.

## Phase 6 — Docs & packaging
- README (with screenshots), CHANGELOG, build artifact zip (verified to open
  from a clean state).

## v1.1.0 — Review pass + features
- Full re-review. Fixed a real UX bug: `autoFitZoom()` ran on every regen and on
  resize, silently resetting the user's chosen zoom. Now auto-fits only when a
  new image loads (`pendingAutoFit`); added explicit −/Fit/+ buttons.
- Removed a redundant per-row "DMC" badge in the legend.
- New features (all unit-/QA-tested): image **brightness/contrast/saturation**
  (`core/adjust.ts`), **click-a-floss-to-highlight** on the chart, **hover
  readout** of the stitch under the cursor, **CSV** floss-list export, **zoom
  buttons**, and **localStorage settings persistence**.
- UI refresh (numbered steps, GitHub icon, collapsible adjustments, stage
  toolbar, polished legend, focus styles).
- 38 unit tests pass; QA 19/19 with 0 console errors; lint/tsc clean; 0 vulns.
