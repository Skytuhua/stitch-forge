# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [1.0.0] — 2026-05-27

First public release.

### Added

- Photo → cross-stitch pattern generation, entirely client-side (no upload).
- Perceptual color engine: sRGB → CIELAB conversion, **CIEDE2000** floss
  matching (verified against the Sharma/Wu/Dalal reference data), and seeded
  k-means color quantization in LAB.
- Full **454-color DMC** floss palette with nearest-match by perceptual distance.
- Controls: pattern width (stitches), max colors (up to 80), and fabric Aida
  count (11/14/16/18 or custom).
- **Color** preview and **Symbol** chart views with zoom and stitch / 10-count
  grid overlays. Transparent image areas render as blank (unstitched) cells.
- Floss list (DMC code, name, swatch, stitch count, skein estimate), finished
  size in inches and centimeters, and total stitch/color counts.
- **PDF export** (cover with stats + floss key, then a paginated symbol chart
  with coordinates) and **PNG export** of the preview.
- Heavy generation runs in a Web Worker; deterministic output for a given image
  and settings.
- Built-in generated sample image for zero-setup demos.

[1.0.0]: https://github.com/Skytuhua/stitch-forge/releases/tag/v1.0.0
