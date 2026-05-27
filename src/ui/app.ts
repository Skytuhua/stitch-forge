import { physicalSize, type Pattern, type ImageDataLike } from '../core/pattern';
import { BLANK } from '../core/pattern';
import { renderPattern, type RenderOptions, type ViewMode } from '../render/chart';
import { exportPng } from '../export/png';
import { exportFlossCsv } from '../export/csv';
import type { Adjustments } from '../core/adjust';
import type { BuildRequest, BuildResponse } from '../workers/pattern.worker';

const MAX_SRC_DIM = 1000; // cap source resolution for snappy generation
const STORAGE_KEY = 'stitchforge.settings.v1';

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el as T;
}

export function initApp(): void {
  const els = {
    drop: $<HTMLDivElement>('drop'),
    file: $<HTMLInputElement>('file'),
    sample: $<HTMLButtonElement>('sample'),
    srcPreview: $<HTMLCanvasElement>('srcPreview'),
    changeHint: $<HTMLElement>('changeHint'),
    widthRange: $<HTMLInputElement>('widthRange'),
    widthVal: $<HTMLElement>('widthVal'),
    colorsRange: $<HTMLInputElement>('colorsRange'),
    colorsVal: $<HTMLElement>('colorsVal'),
    fabric: $<HTMLSelectElement>('fabric'),
    customFabricField: $<HTMLElement>('customFabricField'),
    fabricCustom: $<HTMLInputElement>('fabricCustom'),
    adjustDetails: $<HTMLDetailsElement>('adjustDetails'),
    adjustBadge: $<HTMLElement>('adjustBadge'),
    brightnessRange: $<HTMLInputElement>('brightnessRange'),
    brightnessVal: $<HTMLElement>('brightnessVal'),
    contrastRange: $<HTMLInputElement>('contrastRange'),
    contrastVal: $<HTMLElement>('contrastVal'),
    saturationRange: $<HTMLInputElement>('saturationRange'),
    saturationVal: $<HTMLElement>('saturationVal'),
    resetAdjust: $<HTMLButtonElement>('resetAdjust'),
    viewColor: $<HTMLButtonElement>('viewColor'),
    viewSymbol: $<HTMLButtonElement>('viewSymbol'),
    zoomRange: $<HTMLInputElement>('zoomRange'),
    zoomVal: $<HTMLElement>('zoomVal'),
    zoomIn: $<HTMLButtonElement>('zoomIn'),
    zoomOut: $<HTMLButtonElement>('zoomOut'),
    zoomFit: $<HTMLButtonElement>('zoomFit'),
    gridMinor: $<HTMLInputElement>('gridMinor'),
    gridMajor: $<HTMLInputElement>('gridMajor'),
    title: $<HTMLInputElement>('title'),
    exportPdf: $<HTMLButtonElement>('exportPdf'),
    exportPng: $<HTMLButtonElement>('exportPng'),
    exportCsv: $<HTMLButtonElement>('exportCsv'),
    viewport: $<HTMLDivElement>('viewport'),
    empty: $<HTMLDivElement>('empty'),
    canvas: $<HTMLCanvasElement>('canvas'),
    spinner: $<HTMLDivElement>('spinner'),
    status: $<HTMLParagraphElement>('status'),
    statSize: $<HTMLElement>('statSize'),
    statPhysical: $<HTMLElement>('statPhysical'),
    statTotal: $<HTMLElement>('statTotal'),
    statColors: $<HTMLElement>('statColors'),
    legend: $<HTMLDivElement>('legend'),
    legendCount: $<HTMLElement>('legendCount'),
    legendHint: $<HTMLElement>('legendHint'),
    hoverReadout: $<HTMLElement>('hoverReadout'),
    clearHighlight: $<HTMLButtonElement>('clearHighlight'),
  };

  const worker = new Worker(new URL('../workers/pattern.worker.ts', import.meta.url), {
    type: 'module',
  });

  let sourceImage: ImageData | null = null;
  let pattern: Pattern | null = null;
  let viewMode: ViewMode = 'color';
  let highlight: number | null = null;
  let generating = false;
  let queued = false;
  let pendingAutoFit = false;
  let debounceTimer = 0;

  restoreSettings();

  // ---- worker results ----
  worker.onmessage = (e: MessageEvent<BuildResponse>) => {
    const msg = e.data;
    generating = false;
    els.spinner.hidden = true;
    if (msg.type === 'error') {
      setStatus(`Could not build pattern: ${msg.message}`, true);
      return;
    }
    pattern = msg.pattern;
    highlight = null;
    syncHighlightUi();
    if (pendingAutoFit) {
      pendingAutoFit = false;
      autoFitZoom();
    }
    render();
    updateStats();
    updateLegend();
    const hasStitches = pattern.totalStitches > 0;
    els.exportPdf.disabled = !hasStitches;
    els.exportPng.disabled = !hasStitches;
    els.exportCsv.disabled = !hasStitches;
    setStatus(
      hasStitches
        ? `Matched ${pattern.palette.length} DMC colors across ${pattern.totalStitches.toLocaleString(
            'en-US',
          )} stitches · ${Math.round(msg.elapsedMs)} ms`
        : 'This image is fully transparent — nothing to stitch.',
      !hasStitches,
    );
    if (queued) {
      queued = false;
      generate();
    }
  };
  worker.onerror = (e) => {
    generating = false;
    els.spinner.hidden = true;
    setStatus(`Worker error: ${e.message}`, true);
  };

  // ---- generation ----
  function adjustments(): Adjustments {
    return {
      brightness: Number(els.brightnessRange.value),
      contrast: Number(els.contrastRange.value),
      saturation: Number(els.saturationRange.value),
    };
  }

  function generate(): void {
    if (!sourceImage) return;
    if (generating) {
      queued = true;
      return;
    }
    generating = true;
    els.spinner.hidden = false;
    const req: BuildRequest = {
      type: 'build',
      image: cloneImageData(sourceImage),
      opts: {
        stitchesWide: Number(els.widthRange.value),
        maxColors: Number(els.colorsRange.value),
        seed: 0x5717c4,
        adjustments: adjustments(),
      },
    };
    worker.postMessage(req);
  }

  function scheduleGenerate(): void {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(generate, 180);
  }

  // ---- rendering ----
  function cellSize(): number {
    return Number(els.zoomRange.value);
  }

  function renderOptions(): RenderOptions {
    return {
      cellSize: cellSize(),
      mode: viewMode,
      showMinorGrid: els.gridMinor.checked,
      showMajorGrid: els.gridMajor.checked,
      highlight,
    };
  }

  function render(): void {
    if (!pattern) return;
    els.empty.hidden = true;
    els.canvas.hidden = false;
    const opts = renderOptions();
    els.canvas.width = pattern.stitchesWide * opts.cellSize;
    els.canvas.height = pattern.stitchesHigh * opts.cellSize;
    els.canvas.style.imageRendering = viewMode === 'symbol' ? 'auto' : 'pixelated';
    const ctx = els.canvas.getContext('2d');
    if (!ctx) {
      setStatus('Canvas not supported in this browser.', true);
      return;
    }
    renderPattern(ctx, pattern, opts);
  }

  function autoFitZoom(): void {
    if (!pattern) return;
    const avail = els.viewport.clientWidth - 48;
    const fit = Math.floor(avail / pattern.stitchesWide);
    setZoom(fit || 8);
  }

  function setZoom(value: number): void {
    const min = Number(els.zoomRange.min);
    const max = Number(els.zoomRange.max);
    const clamped = Math.max(min, Math.min(max, value));
    els.zoomRange.value = String(clamped);
    els.zoomVal.textContent = String(clamped);
  }

  // ---- stats + legend ----
  function fabricCount(): number {
    if (els.fabric.value === 'custom') {
      const n = Number(els.fabricCustom.value);
      return Number.isFinite(n) && n > 0 ? Math.min(40, n) : 14;
    }
    return Number(els.fabric.value);
  }

  function updateStats(): void {
    if (!pattern) return;
    const size = physicalSize(pattern.stitchesWide, pattern.stitchesHigh, fabricCount());
    els.statSize.textContent = `${pattern.stitchesWide} × ${pattern.stitchesHigh}`;
    els.statPhysical.textContent = `${size.inches.w}" × ${size.inches.h}" · ${size.cm.w} × ${size.cm.h} cm`;
    els.statTotal.textContent = pattern.totalStitches.toLocaleString('en-US');
    els.statColors.textContent = String(pattern.palette.length);
  }

  function updateLegend(): void {
    if (!pattern) return;
    els.legendCount.textContent = `(${pattern.palette.length})`;
    els.legendHint.hidden = pattern.palette.length === 0;
    const frag = document.createDocumentFragment();
    for (const entry of pattern.palette) {
      const { r, g, b } = entry.dmc;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'legend-row';
      row.dataset.index = String(entry.index);
      row.setAttribute('aria-pressed', 'false');
      row.title = `Highlight DMC ${entry.dmc.code} on the chart`;

      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = `rgb(${r},${g},${b})`;
      sw.style.color = luminance(r, g, b) > 0.45 ? '#000' : '#fff';
      sw.textContent = entry.symbol;

      const name = document.createElement('span');
      name.className = 'legend-name';
      name.innerHTML = `<strong>${escapeHtml(entry.dmc.code)}</strong><span>${escapeHtml(
        entry.dmc.name,
      )}</span>`;

      const count = document.createElement('span');
      count.className = 'legend-count';
      count.innerHTML = `${entry.count.toLocaleString('en-US')}<br>~${entry.skeins} skein${
        entry.skeins > 1 ? 's' : ''
      }`;

      row.append(sw, name, count);
      row.addEventListener('click', () => toggleHighlight(entry.index));
      frag.append(row);
    }
    els.legend.replaceChildren(frag);
  }

  // ---- highlight ----
  function toggleHighlight(index: number): void {
    highlight = highlight === index ? null : index;
    syncHighlightUi();
    render();
  }

  function syncHighlightUi(): void {
    els.legend.querySelectorAll<HTMLElement>('.legend-row').forEach((row) => {
      const on = Number(row.dataset.index) === highlight;
      row.classList.toggle('selected', on);
      row.setAttribute('aria-pressed', String(on));
    });
    if (highlight != null && pattern) {
      const e = pattern.palette[highlight];
      els.clearHighlight.hidden = false;
      els.clearHighlight.textContent = `Highlighting DMC ${e.dmc.code} · ${e.symbol}  ✕`;
    } else {
      els.clearHighlight.hidden = true;
    }
  }

  els.clearHighlight.addEventListener('click', () => {
    highlight = null;
    syncHighlightUi();
    render();
  });

  // ---- hover readout ----
  els.canvas.addEventListener('mousemove', (e) => {
    if (!pattern) return;
    const cs = cellSize();
    const col = Math.floor(e.offsetX / cs);
    const row = Math.floor(e.offsetY / cs);
    if (col < 0 || row < 0 || col >= pattern.stitchesWide || row >= pattern.stitchesHigh) return;
    const idx = pattern.cells[row * pattern.stitchesWide + col];
    if (idx === BLANK) {
      els.hoverReadout.textContent = `R${row + 1} · C${col + 1} — (blank)`;
    } else {
      const e2 = pattern.palette[idx];
      els.hoverReadout.textContent = `R${row + 1} · C${col + 1} — ${e2.symbol}  DMC ${e2.dmc.code} ${e2.dmc.name}`;
    }
  });
  els.canvas.addEventListener('mouseleave', () => {
    els.hoverReadout.textContent = pattern ? 'Hover the chart to inspect stitches' : '';
  });

  // ---- image input ----
  function useImage(image: ImageData, previewSource: CanvasImageSource): void {
    sourceImage = image;
    pendingAutoFit = true;
    drawPreview(previewSource);
    els.changeHint.hidden = false;
    generate();
  }

  function drawPreview(src: CanvasImageSource): void {
    const pc = els.srcPreview;
    pc.hidden = false;
    const innerW = els.drop.clientWidth || 240;
    const innerH = 132;
    pc.width = innerW;
    pc.height = innerH;
    const ctx = pc.getContext('2d');
    if (!ctx) return;
    const dims = sourceDims(src);
    const scale = Math.min(innerW / dims.w, innerH / dims.h);
    const dw = dims.w * scale;
    const dh = dims.h * scale;
    ctx.clearRect(0, 0, innerW, innerH);
    ctx.drawImage(src, (innerW - dw) / 2, (innerH - dh) / 2, dw, dh);
  }

  async function handleFile(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      setStatus('That file is not an image.', true);
      return;
    }
    setStatus('Loading image…');
    try {
      const { imageData, bitmap } = await loadImage(file);
      useImage(imageData, bitmap);
    } catch {
      setStatus('Could not read that image file.', true);
    }
  }

  // ---- events ----
  els.drop.addEventListener('click', () => els.file.click());
  els.drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      els.file.click();
    }
  });
  els.file.addEventListener('change', () => {
    const f = els.file.files?.[0];
    if (f) void handleFile(f);
  });
  ['dragenter', 'dragover'].forEach((ev) =>
    els.drop.addEventListener(ev, (e) => {
      e.preventDefault();
      els.drop.classList.add('dragging');
    }),
  );
  ['dragleave', 'drop'].forEach((ev) =>
    els.drop.addEventListener(ev, (e) => {
      e.preventDefault();
      els.drop.classList.remove('dragging');
    }),
  );
  els.drop.addEventListener('drop', (e) => {
    const f = (e as DragEvent).dataTransfer?.files?.[0];
    if (f) void handleFile(f);
  });

  els.sample.addEventListener('click', () => {
    const { imageData, canvas } = makeSample();
    setStatus('Loaded sample image.');
    useImage(imageData, canvas);
  });

  els.widthRange.addEventListener('input', () => {
    els.widthVal.textContent = els.widthRange.value;
    saveSettings();
    scheduleGenerate();
  });
  els.colorsRange.addEventListener('input', () => {
    els.colorsVal.textContent = els.colorsRange.value;
    saveSettings();
    scheduleGenerate();
  });
  els.fabric.addEventListener('change', () => {
    els.customFabricField.hidden = els.fabric.value !== 'custom';
    saveSettings();
    updateStats();
  });
  els.fabricCustom.addEventListener('input', () => {
    saveSettings();
    updateStats();
  });

  const adjustControls: Array<[HTMLInputElement, HTMLElement]> = [
    [els.brightnessRange, els.brightnessVal],
    [els.contrastRange, els.contrastVal],
    [els.saturationRange, els.saturationVal],
  ];
  for (const [range, label] of adjustControls) {
    range.addEventListener('input', () => {
      label.textContent = range.value;
      syncAdjustBadge();
      saveSettings();
      scheduleGenerate();
    });
  }
  els.resetAdjust.addEventListener('click', () => {
    for (const [range, label] of adjustControls) {
      range.value = '0';
      label.textContent = '0';
    }
    syncAdjustBadge();
    saveSettings();
    scheduleGenerate();
  });

  function syncAdjustBadge(): void {
    const a = adjustments();
    els.adjustBadge.hidden = a.brightness === 0 && a.contrast === 0 && a.saturation === 0;
  }

  els.viewColor.addEventListener('click', () => setView('color'));
  els.viewSymbol.addEventListener('click', () => setView('symbol'));
  function setView(mode: ViewMode): void {
    viewMode = mode;
    els.viewColor.classList.toggle('active', mode === 'color');
    els.viewSymbol.classList.toggle('active', mode === 'symbol');
    els.viewColor.setAttribute('aria-pressed', String(mode === 'color'));
    els.viewSymbol.setAttribute('aria-pressed', String(mode === 'symbol'));
    if (mode === 'symbol' && cellSize() < 10) setZoom(10);
    saveSettings();
    render();
  }

  els.zoomRange.addEventListener('input', () => {
    els.zoomVal.textContent = els.zoomRange.value;
    render();
  });
  els.zoomIn.addEventListener('click', () => {
    setZoom(cellSize() + 2);
    render();
  });
  els.zoomOut.addEventListener('click', () => {
    setZoom(cellSize() - 2);
    render();
  });
  els.zoomFit.addEventListener('click', () => {
    autoFitZoom();
    render();
  });
  els.gridMinor.addEventListener('change', () => {
    saveSettings();
    render();
  });
  els.gridMajor.addEventListener('change', () => {
    saveSettings();
    render();
  });

  els.exportPng.addEventListener('click', () => {
    if (!pattern) return;
    const opts = renderOptions();
    const exportOpts: RenderOptions = {
      ...opts,
      cellSize: Math.max(opts.cellSize, 10),
      highlight: null,
    };
    void exportPng(pattern, exportOpts, `${baseFilename()}.png`).catch(() =>
      setStatus('PNG export failed.', true),
    );
  });
  els.exportCsv.addEventListener('click', () => {
    if (!pattern) return;
    try {
      exportFlossCsv(pattern, fabricCount(), `${baseFilename()}-floss.csv`);
      setStatus('Floss list downloaded.');
    } catch {
      setStatus('CSV export failed.', true);
    }
  });
  els.exportPdf.addEventListener('click', () => {
    if (!pattern) return;
    const current = pattern;
    setStatus('Building PDF…');
    // jsPDF is heavy, so it is loaded only when the user actually exports.
    void import('../export/pdf')
      .then(({ exportPdf }) => {
        exportPdf(
          current,
          { fabricCount: fabricCount(), title: els.title.value },
          `${baseFilename()}.pdf`,
        );
        setStatus('PDF downloaded.');
      })
      .catch((err) =>
        setStatus(`PDF export failed: ${err instanceof Error ? err.message : err}`, true),
      );
  });

  function baseFilename(): string {
    const t = els.title.value.trim() || 'stitchforge-pattern';
    return (
      t
        .replace(/[^a-z0-9-_ ]/gi, '')
        .replace(/\s+/g, '-')
        .toLowerCase() || 'stitchforge-pattern'
    );
  }

  function setStatus(text: string, isError = false): void {
    els.status.textContent = text;
    els.status.classList.toggle('error', isError);
  }

  // ---- settings persistence ----
  function saveSettings(): void {
    const s = {
      width: els.widthRange.value,
      colors: els.colorsRange.value,
      fabric: els.fabric.value,
      fabricCustom: els.fabricCustom.value,
      view: viewMode,
      gridMinor: els.gridMinor.checked,
      gridMajor: els.gridMajor.checked,
      brightness: els.brightnessRange.value,
      contrast: els.contrastRange.value,
      saturation: els.saturationRange.value,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* storage may be unavailable (private mode) — non-fatal */
    }
  }

  function restoreSettings(): void {
    let s: Record<string, unknown> | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) s = JSON.parse(raw);
    } catch {
      s = null;
    }
    if (s) {
      setRange(els.widthRange, els.widthVal, s.width);
      setRange(els.colorsRange, els.colorsVal, s.colors);
      setRange(els.brightnessRange, els.brightnessVal, s.brightness);
      setRange(els.contrastRange, els.contrastVal, s.contrast);
      setRange(els.saturationRange, els.saturationVal, s.saturation);
      if (typeof s.fabric === 'string') els.fabric.value = s.fabric;
      if (typeof s.fabricCustom === 'string') els.fabricCustom.value = s.fabricCustom;
      if (typeof s.gridMinor === 'boolean') els.gridMinor.checked = s.gridMinor;
      if (typeof s.gridMajor === 'boolean') els.gridMajor.checked = s.gridMajor;
      if (s.view === 'symbol') setView('symbol');
    }
    els.customFabricField.hidden = els.fabric.value !== 'custom';
    syncAdjustBadge();
  }

  function setRange(range: HTMLInputElement, label: HTMLElement, value: unknown): void {
    if (typeof value === 'string' || typeof value === 'number') {
      range.value = String(value);
      label.textContent = range.value;
    }
  }

  // ---- helpers ----
  function loadImage(file: File): Promise<{ imageData: ImageData; bitmap: HTMLImageElement }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        try {
          resolve({ imageData: toImageData(img), bitmap: img });
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('decode failed'));
      };
      img.src = url;
    });
  }
}

// ---- module-level pure-ish helpers ----

function toImageData(img: HTMLImageElement): ImageData {
  const scale = Math.min(1, MAX_SRC_DIM / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

function cloneImageData(src: ImageData): ImageDataLike {
  return { width: src.width, height: src.height, data: new Uint8ClampedArray(src.data) };
}

function sourceDims(src: CanvasImageSource): { w: number; h: number } {
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  if (src instanceof HTMLCanvasElement) return { w: src.width, h: src.height };
  return { w: 1, h: 1 };
}

function luminance(r: number, g: number, b: number): number {
  const f = (c: number) => {
    const cs = c / 255;
    return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );
}

/** A colorful original sample (sunset over hills) — varied hues to show off matching. */
function makeSample(): { imageData: ImageData; canvas: HTMLCanvasElement } {
  const w = 360;
  const h = 270;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Sky gradient.
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#243a73');
  sky.addColorStop(0.45, '#7b4a8c');
  sky.addColorStop(0.72, '#e0764f');
  sky.addColorStop(1, '#f4c45a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Sun.
  const sun = ctx.createRadialGradient(w * 0.68, h * 0.52, 6, w * 0.68, h * 0.52, 60);
  sun.addColorStop(0, '#fff6cf');
  sun.addColorStop(0.5, '#ffd84d');
  sun.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(w * 0.68, h * 0.52, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe98a';
  ctx.beginPath();
  ctx.arc(w * 0.68, h * 0.52, 26, 0, Math.PI * 2);
  ctx.fill();

  // Hill silhouettes (layered).
  const hill = (yBase: number, amp: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 6) {
      const y = yBase + Math.sin((x / w) * Math.PI * 2 + yBase) * amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  };
  hill(h * 0.7, 14, '#6b3b6e');
  hill(h * 0.8, 18, '#4a2a52');
  hill(h * 0.9, 12, '#2e1b38');

  // Birds.
  ctx.strokeStyle = '#1d1430';
  ctx.lineWidth = 2;
  const bird = (bx: number, by: number, s: number) => {
    ctx.beginPath();
    ctx.moveTo(bx - s, by);
    ctx.quadraticCurveTo(bx, by - s * 0.7, bx, by);
    ctx.quadraticCurveTo(bx, by - s * 0.7, bx + s, by);
    ctx.stroke();
  };
  bird(w * 0.25, h * 0.25, 11);
  bird(w * 0.33, h * 0.3, 8);
  bird(w * 0.18, h * 0.33, 7);

  return { imageData: ctx.getImageData(0, 0, w, h), canvas };
}
