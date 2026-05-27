# SPEC.md — StitchForge v1

## Product

StitchForge converts any image into a cross-stitch pattern with accurate **DMC**
floss colors. Everything runs in the browser; **no image is ever uploaded**.

## Primary user flow

1. User drops/selects an image.
2. User adjusts: **pattern width** (in stitches), **max colors**, and **fabric
   (Aida) count**.
3. StitchForge generates a stitch pattern: a pixel-style color preview and a
   symbol chart with 10-stitch grid lines.
4. User reviews the **floss list** (DMC code, name, swatch, stitch count, skein
   estimate) and the **finished size** (in / cm).
5. User exports a **print-ready PDF** (cover stats + symbol chart + floss key)
   and/or a **PNG** of the preview.

## v1 feature set (all must work — no placeholders)

- **Image input:** drag-and-drop or file picker; PNG / JPEG / WebP / GIF (first
  frame). Transparent pixels become **blank** (unstitched) cells.
- **Controls:**
  - Pattern width in stitches (clamped 1–2000; height derived from aspect).
  - Max colors (1–80, capped by available chart symbols).
  - Fabric count (Aida; presets 11/14/16/18 + custom) → drives finished size.
  - A built-in sample image so the tool is demonstrable with zero setup.
- **Color engine:** downsample in linear light → cluster in CIELAB via
  deterministic k-means → map cluster centroids to nearest DMC floss by
  **CIEDE2000** → reassign each cell to the nearest floss within the chosen
  palette. Deterministic for a given image + settings.
- **Views:** toggle between **Color** preview and **Symbol** chart; grid lines
  every 10 stitches with darker decade lines; zoom.
- **Floss list:** sorted by usage; swatch, DMC code, name, stitch count,
  estimated skeins; total stitches and color count.
- **Finished size:** width × height in inches and centimeters for the chosen
  fabric count.
- **Exports:**
  - **PDF**: title page with stats + floss key, followed by the symbol chart
    (paginated across pages with row/column coordinates) — designed to be
    stitched from on paper.
  - **PNG**: the rendered preview at a crisp export scale.
- **Quality of life:** loading state during generation, empty state before any
  image, graceful error messages, responsive layout, keyboard-focusable
  controls, all work offline after first load.

## Non-goals (explicitly out of scope for v1)

- Manual per-cell editing / drawing.
- Back-stitch, fractional stitches, French knots, beads, metallic blends.
- Other floss brands (Anchor, Cosmo) or floss conversion between brands.
- Accounts, cloud saving, sharing links, server-side anything.
- Importing existing `.xsd`/`.oxs`/pattern formats.

## Definition of "done"

- Every feature above works in a real browser, verified with screenshots.
- Core logic is unit-tested and green; type-check and lint clean.
- A first-time user can go image → exported PDF without instructions.
- Ships as a public GitHub repo + tagged release with downloadable artifacts,
  plus a live GitHub Pages demo.
