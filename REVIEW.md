# REVIEW.md — Self-review & QA

Multiple review passes (functional, visual/UX, edge-case, code-quality,
performance). Every finding below was fixed and re-verified with fresh evidence.
Automated QA lives in `scripts/qa.mjs` (headless Chromium via Playwright) and
unit tests in `test/` (Vitest). Screenshot evidence is in `review/screenshots/`.

## Evidence

| File | What it shows |
|---|---|
| `review/screenshots/01-empty.png` | First-load empty state |
| `review/screenshots/02-sample-color.png` | Color preview of the generated sample |
| `review/screenshots/03-sample-symbols.png` | Symbol-chart view with decade grid |
| `review/screenshots/04-more-colors-wider.png` | Regeneration after changing width/colors |
| `review/screenshots/05-mobile.png` | Responsive single-column layout (420px) |
| `review/screenshots/pdf-cover.png` | Exported PDF cover (stats + floss key) |
| `review/screenshots/pdf-chart.png` | Exported PDF symbol chart page (coordinates + grid) |
| `review/screenshots/export-sample.{png,pdf}` | Real exported artifacts |

## Findings & fixes

### 1. (Visual, major) Spinner never disappeared
The loading overlay stayed on top of the finished pattern. Root cause: a classic
CSS specificity trap — `.spinner-overlay { display: grid }` (and
`.chart-canvas { display: block }`) outrank the UA `[hidden] { display: none }`,
so toggling the `hidden` attribute had no effect. **Fix:** added
`[hidden] { display: none !important; }`. Re-verified: spinner clears, pattern
renders cleanly (screenshots 02–04).

### 2. (Performance) Slow generation on large patterns
A real photo at 120 stitches took ~2.9s because CIEDE2000 (heavy trig) ran in the
k-means inner loop (~10M calls). **Fix:** cluster with fast squared-Euclidean LAB
(CIE76); reserve CIEDE2000 for the floss-*matching* steps the user actually sees.
Result: 120w/30c **2.9s → 0.55s**; worst case 300w/60c (70k cells) **2.8s**.
Quality unaffected (perceptual matching unchanged).

### 3. (Bug, caught during #2) k-means++ weighting
Refactor briefly squared an already-squared distance (D⁴ instead of D²) in the
k-means++ seeding. **Fix:** use the squared distance directly. All quantizer
tests (separation, determinism, k-clamping) green.

### 4. (Quality / startup) jsPDF in the initial bundle
jsPDF (~440 kB) loaded on first paint though it's only needed on export.
**Fix:** dynamic `import('../export/pdf')` on the export click. Initial JS
**442 kB → 37 kB**; jsPDF now a lazy 404 kB chunk.

### 5. (Robustness) Degenerate inputs
Added/handled: 1×1 image, fully transparent image (empty palette, exports
disabled with a clear message), `maxColors = 1`, and upscaling (requested width
> source). Unit-tested in `test/pattern.test.ts`.

### 6. (Robustness) Non-image files
Dropping a `.txt` shows "That file is not an image." rather than failing
silently. Verified in QA.

### 7. (Test correctness) CIEDE2000 reference typo
One canonical test pair was mistyped (1.8731 vs 1.8645); the implementation was
correct and matches all 14 Sharma/Wu/Dalal reference pairs to 1e-3.

### 8. (Investigated, no defect) Mobile horizontal overflow
A 2× screenshot looked tight. Measured directly: at 420 px,
`document.body.scrollWidth === clientWidth === 420` with zero overflowing
elements. No fix needed.

## Final state

- Unit tests: **29/29 pass**. Type-check clean. ESLint + Prettier clean.
- Headless QA: **12/12 checks pass**, **0 console errors**.
- Production build green; `npm audit`: **0 vulnerabilities**.
- "Would a real user keep this?" — a real photograph produced a recognizable,
  well-matched 24-color chart with a sensible floss list and a stitchable PDF.
  Yes.
