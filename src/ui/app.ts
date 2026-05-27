import { physicalSize, type Pattern, type ImageDataLike } from '../core/pattern';
import { renderPattern, type RenderOptions, type ViewMode } from '../render/chart';
import { exportPng } from '../export/png';
import type { BuildRequest, BuildResponse } from '../workers/pattern.worker';

const MAX_SRC_DIM = 1000; // cap source resolution for snappy generation

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
    widthRange: $<HTMLInputElement>('widthRange'),
    widthVal: $<HTMLElement>('widthVal'),
    colorsRange: $<HTMLInputElement>('colorsRange'),
    colorsVal: $<HTMLElement>('colorsVal'),
    fabric: $<HTMLSelectElement>('fabric'),
    customFabricField: $<HTMLElement>('customFabricField'),
    fabricCustom: $<HTMLInputElement>('fabricCustom'),
    viewColor: $<HTMLButtonElement>('viewColor'),
    viewSymbol: $<HTMLButtonElement>('viewSymbol'),
    zoomRange: $<HTMLInputElement>('zoomRange'),
    zoomVal: $<HTMLElement>('zoomVal'),
    gridMinor: $<HTMLInputElement>('gridMinor'),
    gridMajor: $<HTMLInputElement>('gridMajor'),
    title: $<HTMLInputElement>('title'),
    exportPdf: $<HTMLButtonElement>('exportPdf'),
    exportPng: $<HTMLButtonElement>('exportPng'),
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
  };

  const worker = new Worker(new URL('../workers/pattern.worker.ts', import.meta.url), {
    type: 'module',
  });

  let sourceImage: ImageData | null = null;
  let pattern: Pattern | null = null;
  let viewMode: ViewMode = 'color';
  let generating = false;
  let queued = false;
  let debounceTimer = 0;

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
    autoFitZoom();
    render();
    updateStats();
    updateLegend();
    const hasStitches = pattern.totalStitches > 0;
    els.exportPdf.disabled = !hasStitches;
    els.exportPng.disabled = !hasStitches;
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
      },
    };
    worker.postMessage(req);
  }

  function scheduleGenerate(): void {
    window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(generate, 180);
  }

  // ---- rendering ----
  function renderOptions(): RenderOptions {
    return {
      cellSize: Number(els.zoomRange.value),
      mode: viewMode,
      showMinorGrid: els.gridMinor.checked,
      showMajorGrid: els.gridMajor.checked,
    };
  }

  function render(): void {
    if (!pattern) return;
    els.empty.hidden = true;
    els.canvas.hidden = false;
    const opts = renderOptions();
    const w = pattern.stitchesWide * opts.cellSize;
    const h = pattern.stitchesHigh * opts.cellSize;
    els.canvas.width = w;
    els.canvas.height = h;
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
    const clamped = Math.max(2, Math.min(24, fit || 8));
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
    const frag = document.createDocumentFragment();
    for (const entry of pattern.palette) {
      const { r, g, b } = entry.dmc;
      const row = document.createElement('div');
      row.className = 'legend-row';

      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = `rgb(${r},${g},${b})`;
      sw.style.color = luminance(r, g, b) > 0.45 ? '#000' : '#fff';
      sw.textContent = entry.symbol;
      sw.title = `Symbol ${entry.symbol}`;

      const sym = document.createElement('span');
      sym.className = 'legend-sym';
      sym.textContent = `DMC`;

      const name = document.createElement('span');
      name.className = 'legend-name';
      name.innerHTML = `<strong>${escapeHtml(entry.dmc.code)}</strong> <span>${escapeHtml(
        entry.dmc.name,
      )}</span>`;

      const count = document.createElement('span');
      count.className = 'legend-count';
      count.innerHTML = `${entry.count.toLocaleString('en-US')}<br>~${entry.skeins} skein${
        entry.skeins > 1 ? 's' : ''
      }`;

      row.append(sw, sym, name, count);
      frag.append(row);
    }
    els.legend.replaceChildren(frag);
  }

  // ---- image input ----
  async function useImage(image: ImageData, previewSource: CanvasImageSource): Promise<void> {
    sourceImage = image;
    drawPreview(previewSource);
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
      await useImage(imageData, bitmap);
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
    void useImage(imageData, canvas);
  });

  els.widthRange.addEventListener('input', () => {
    els.widthVal.textContent = els.widthRange.value;
    scheduleGenerate();
  });
  els.colorsRange.addEventListener('input', () => {
    els.colorsVal.textContent = els.colorsRange.value;
    scheduleGenerate();
  });
  els.fabric.addEventListener('change', () => {
    els.customFabricField.hidden = els.fabric.value !== 'custom';
    updateStats();
  });
  els.fabricCustom.addEventListener('input', updateStats);

  els.viewColor.addEventListener('click', () => setView('color'));
  els.viewSymbol.addEventListener('click', () => setView('symbol'));
  function setView(mode: ViewMode): void {
    viewMode = mode;
    els.viewColor.classList.toggle('active', mode === 'color');
    els.viewSymbol.classList.toggle('active', mode === 'symbol');
    els.viewColor.setAttribute('aria-pressed', String(mode === 'color'));
    els.viewSymbol.setAttribute('aria-pressed', String(mode === 'symbol'));
    if (mode === 'symbol' && Number(els.zoomRange.value) < 10) {
      els.zoomRange.value = '10';
      els.zoomVal.textContent = '10';
    }
    render();
  }

  els.zoomRange.addEventListener('input', () => {
    els.zoomVal.textContent = els.zoomRange.value;
    render();
  });
  els.gridMinor.addEventListener('change', render);
  els.gridMajor.addEventListener('change', render);

  els.exportPng.addEventListener('click', () => {
    if (!pattern) return;
    const opts = renderOptions();
    const exportOpts: RenderOptions = { ...opts, cellSize: Math.max(opts.cellSize, 10) };
    void exportPng(pattern, exportOpts, `${baseFilename()}.png`).catch(() =>
      setStatus('PNG export failed.', true),
    );
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

  window.addEventListener('resize', () => {
    if (pattern) {
      autoFitZoom();
      render();
    }
  });
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
