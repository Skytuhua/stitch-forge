# RESEARCH.md — Discovery & Product Selection

> Phase 1 artifact. Captures the market scan, the scored shortlist, the chosen
> product, the target user, the core problem, and the feasibility argument.

## 1. Method

I ran a broad→narrow scan looking for niches that are (a) genuinely
*underserved* — not just "in demand," since easy-to-build tools get saturated
fast — and (b) fully buildable as a **100% client-side web app** (no backend,
no paid APIs, no data I cannot lawfully obtain), which maximizes demonstrability
(screenshots), shippability (static host + zip artifact), and privacy.

For each idea I asked: *Who needs it? How badly? What exists today? Why do the
existing options fall short? Can I lawfully build a clearly better focused
version with the tools I actually have?*

## 2. Candidates considered & why most were rejected

| Idea | Demand | Verdict | Reason |
|---|---|---|---|
| Subtitle sync/convert (SRT/VTT/ASS) | High | ❌ Reject | **Saturated.** SubtitleTools, SubShifter, MeTool, subtitlesedit.com, ebby, flint, subtitlekit… dozens of client-side tools already. No room to be the "better" one. |
| EXIF/GPS metadata remover | High | ❌ Reject | **Saturated.** PrivacyStrip, exifremover.com, MetadataKit, ClearExif, keiver.dev, etc. The "private cleaner" angle is the obvious build, so everyone built it. |
| GPX climb/elevation analyzer | Medium-High | ❌ Reject | **Saturated.** GPXchunk, GPX Edit Pro, The Ride Atlas, GpxOverlay, glandnav… all client-side and free. |
| **Photo → cross-stitch pattern generator (DMC)** | **High** | ✅ **CHOSEN** | **Underserved in the free space.** Real, repeated complaints that free tools have *poor color accuracy, limited pattern size, and bad DMC floss matching*; the good tools are paid desktop apps (PCStitch, StitchFiddle Pro). Clear quality gap. Highly visual. Has real domain depth (perceptual color matching) that the trivial tools skip. |

The pattern of the rejected three is instructive: simple "converter/cleaner"
utilities are SEO-lucrative and trivial to build, so they get saturated. The
winner is harder to do *well* (color science + chart generation), which is
exactly why the free options are weak — and where I can win.

## 3. Selection rubric scoring (1–5, weighted)

| Criterion | Weight | Subtitle | EXIF | GPX | **Cross-stitch** |
|---|---|---|---|---|---|
| Niche / underserved | High (×3) | 1 | 1 | 2 | **5** |
| Real demand (evidence) | High (×3) | 5 | 5 | 4 | **5** |
| Doable & shippable | High (×3) | 5 | 5 | 5 | **5** |
| Demonstrable | Med (×2) | 3 | 3 | 4 | **5** |
| Defensible scope | Med (×2) | 4 | 4 | 4 | **4** |
| Legal/ethical | Gate | Pass | Pass | Pass | **Pass** |
| **Weighted total /65** | | 46 | 46 | 49 | **63** |

## 4. The chosen product — StitchForge

**One-paragraph pitch:**
> StitchForge turns any photo into a finished, stitchable cross-stitch chart —
> entirely in your browser, with nothing uploaded. Unlike the ad-heavy free
> converters that map colors with naive RGB math (producing muddy, wrong floss
> picks), StitchForge matches every color to real **DMC** embroidery floss using
> **perceptual CIELAB / CIEDE2000** color distance, so the palette actually
> looks right. You control the stitch count, fabric (Aida) count, and number of
> colors; you get a live symbol chart with 10-stitch grid lines, a floss
> shopping list with skein estimates, and a print-ready PDF and PNG — the things
> a stitcher genuinely needs to start a project.

**Target user:** hobby cross-stitchers (a large, active craft community, e.g.
r/CrossStitch) who want to stitch a personal photo, pet portrait, or custom
image and currently must either pay for desktop software or fight with
low-quality, inaccurate free websites.

**Core problem solved:** *"Convert my image into an accurate, usable
cross-stitch pattern with real DMC floss colors, a readable chart, and a
shopping list — for free, without uploading my photos."*

**Why it's underserved (not just in demand):** the free tier is dominated by
tools that (1) use poor color matching, (2) cap pattern size, and (3) don't
output a proper printable symbol chart + floss list. The quality tier is paid.
A free, fast, private tool that does the color science properly fills a real gap.

## 5. Feasibility against my actual toolchain

- **Rendering / image processing:** HTML5 Canvas + `ImageData` — built in. ✓
- **Color science:** sRGB→linear→XYZ→CIELAB and CIEDE2000 — pure math I will
  implement and unit-test (this is the differentiator, so I own it). ✓
- **Quantization:** median-cut / k-means in LAB — implementable, runs in a
  **Web Worker** to handle large patterns without freezing the UI (kills the
  "limited size" complaint). ✓
- **DMC palette data:** factual reference data (DMC number, name, RGB) is
  openly published in multiple datasets (e.g. `seanockert/rgb-to-dmc`,
  `sharlagelfand/dmc`). It is factual color data, lawful to use; I will vet a
  single canonical list and credit the source. ✓
- **PDF export:** `jspdf` (MIT) — client-side. ✓
- **Build/host:** Vite static build → GitHub Pages + a downloadable zip
  artifact. ✓
- **No backend, no API keys, no upload** → nothing I cannot lawfully obtain. ✓

## 6. Legal / ethical gate — PASS

- Operates only on the **user's own images**, fully client-side; nothing is
  uploaded or transmitted. Privacy-positive.
- DMC color numbers/names/RGB are **factual reference data**; approximate RGB
  values are publicly published. Used as reference data with attribution. "DMC"
  is a third-party trademark referenced nominatively (for interoperability /
  identifying real floss); StitchForge is independent and unaffiliated, stated
  plainly in the README.
- No malware, no access-control bypass, no targeting of individuals, no
  deceptive content. Safe to publish publicly.

**Decision: build StitchForge.**

---
Sources consulted (market scan):
- Subtitle space (saturated): subtitletools.com, subshifter.bitsnbites.eu, metool.online, subtitlesedit.com
- EXIF space (saturated): privacystrip.com, exifremover.com, metadatakit.com, clearexif.com
- GPX space (saturated): gpxchunk.com, gpx-edit-pro.ovh, therideatlas.com, gpxoverlay.com
- Cross-stitch demand & free-tool quality gap: Reddit r/CrossStitch discussions (poor color accuracy / size limits in free tools); paid tools PCStitch, StitchFiddle
- DMC datasets: github.com/seanockert/rgb-to-dmc, github.com/sharlagelfand/dmc, github.com/adrianj/CrossStitchCreator
