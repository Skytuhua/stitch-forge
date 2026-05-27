# ARCHITECTURE.md

## Stack & rationale

| Choice | Why |
|---|---|
| **TypeScript** | Type safety on color math and data structures; catches errors the trivial free tools ship with. |
| **Vite** | Fast dev loop; produces a small static bundle ideal for GitHub Pages + a zip artifact. No server. |
| **Vanilla DOM (no UI framework)** | The UI is a handful of controls + canvases. A framework would add weight and dependency risk for no real benefit. Keeps the bundle tiny and the app dependency-light. |
| **Web Worker** | Pattern generation (downsample + k-means + per-cell CIEDE2000 matching) is CPU-heavy. Running it off the main thread keeps the UI responsive and removes the "limited size" ceiling of naive tools. |
| **Canvas 2D** | Renders both the color preview and the symbol chart; also the source of the PNG export. |
| **jsPDF** (MIT) | Client-side PDF generation for the printable chart + floss key. Only built-in fonts/primitives are used (no HTML rendering), so the dompurify-dependent code path is never touched. |

Only one runtime dependency (`jspdf`). Everything else (color science,
quantization, DMC matching, chart layout) is first-party and unit-tested.

## Module map

```
src/
  core/                 # pure, framework-free, fully unit-tested
    color.ts            # sRGB<->CIELAB, CIEDE2000, luminance/ink helpers
    dmc.ts              # DMC palette (LAB-precomputed) + nearest-floss match
    dmc-data.ts         # AUTO-GENERATED 454-color DMC table
    quantize.ts         # deterministic k-means in LAB (k-means++ init)
    symbols.ts          # ordered, PDF-safe chart glyphs
    pattern.ts          # orchestration: image -> Pattern (cells + palette)
  workers/
    pattern.worker.ts   # runs buildPattern off the main thread
  render/
    chart.ts            # draws color preview + symbol chart to a canvas
  export/
    pdf.ts              # printable PDF (cover + paginated chart + floss key)
    png.ts              # PNG export of the preview
  ui/
    app.ts              # wires DOM controls, worker, rendering, exports
  main.ts               # entry point
  style.css
scripts/
  build-dmc.mjs         # regenerates dmc-data.ts from assets/dmc-source.json
```

## Data flow

```
File ──▶ <img>/ImageBitmap ──▶ ImageData (source canvas)
                                   │
                       structuredClone to Worker
                                   ▼
   downsample (linear-light box average, alpha→blank)
                                   ▼
            per-cell CIELAB  ──▶ k-means(K) in LAB
                                   ▼
        centroids ──▶ nearest DMC (CIEDE2000), de-duped = palette
                                   ▼
   reassign each cell ──▶ nearest floss within palette (CIEDE2000)
                                   ▼
        Pattern { cells: Int32Array, palette[], stats }  ──▶ main thread
                                   ▼
              Canvas render (color | symbol)  ──▶  PNG / PDF export
```

`BLANK = -1` marks unstitched (transparent) cells throughout.

## Why the color science matters

The dominant complaint about free photo→pattern tools is **bad color
matching**. Naive tools pick floss by RGB Euclidean distance, which does not
match human perception (e.g. it confuses dark navy and dark green). StitchForge
works entirely in **CIELAB** and ranks floss by **CIEDE2000**, the current CIE
standard for perceptual color difference, validated in `color.test.ts` against
the canonical Sharma/Wu/Dalal reference pairs. This is the core differentiator.

## Third-party data & licenses

- **DMC color table** — factual reference data (floss code, name, approximate
  RGB), derived from `github.com/seanockert/rgb-to-dmc`. Color facts are not
  copyrightable; credited in README. "DMC" is a trademark of its owner, used
  nominatively to identify real floss; StitchForge is independent/unaffiliated.
- **jsPDF** — MIT.

## Performance & limits

- Generation runs in a worker; the UI shows a spinner and never blocks.
- Pattern dimensions clamped to 2000×2000 stitches.
- k-means is seeded and capped at 30 iterations, so generation is bounded and
  reproducible.
