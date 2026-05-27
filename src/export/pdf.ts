import { jsPDF } from 'jspdf';
import { physicalSize, type Pattern, BLANK } from '../core/pattern';
import { renderPatternToCanvas } from './png';

export interface PdfOptions {
  fabricCount: number;
  title?: string;
}

const MARGIN = 40;
const ROW_H = 16;
const CELL = 13; // pt per stitch in the printed chart
const GUTTER = 20; // space for coordinate labels

export function buildPdf(p: Pattern, opts: PdfOptions): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  drawCover(doc, p, opts, pageW, pageH);
  drawChart(doc, p, pageW, pageH);
  return doc;
}

export function exportPdf(p: Pattern, opts: PdfOptions, filename: string): void {
  buildPdf(p, opts).save(filename);
}

function drawCover(doc: jsPDF, p: Pattern, opts: PdfOptions, pageW: number, pageH: number): void {
  const title = opts.title?.trim() || 'Cross-Stitch Pattern';
  let y = MARGIN + 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text(title, MARGIN, y);
  y += 16;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Generated with StitchForge', MARGIN, y);
  doc.setTextColor(0);
  y += 18;

  // Color thumbnail (top-right).
  const thumbCell = Math.max(1, Math.floor(200 / Math.max(p.stitchesWide, p.stitchesHigh)));
  const canvas = renderPatternToCanvas(p, {
    cellSize: thumbCell,
    mode: 'color',
    showMinorGrid: false,
    showMajorGrid: true,
  });
  const maxBox = 210;
  const scale = Math.min(maxBox / canvas.width, maxBox / canvas.height);
  const tw = canvas.width * scale;
  const th = canvas.height * scale;
  const tx = pageW - MARGIN - tw;
  doc.addImage(canvas.toDataURL('image/png'), 'PNG', tx, MARGIN + 6, tw, th);

  // Stats block (left).
  const size = physicalSize(p.stitchesWide, p.stitchesHigh, opts.fabricCount);
  doc.setFontSize(11);
  const stats = [
    ['Stitch count', `${p.stitchesWide} W × ${p.stitchesHigh} H`],
    ['Total stitches', p.totalStitches.toLocaleString('en-US')],
    ['Colors (DMC)', String(p.palette.length)],
    ['Fabric', `${opts.fabricCount}-count Aida`],
    ['Finished size', `${size.inches.w}" × ${size.inches.h}"  (${size.cm.w} × ${size.cm.h} cm)`],
  ];
  for (const [k, v] of stats) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${k}:`, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    doc.text(v, MARGIN + 92, y);
    y += 17;
  }

  y = Math.max(y, MARGIN + 6 + th) + 18;

  // Floss key.
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Floss key', MARGIN, y);
  y += 8;

  y = drawFlossHeader(doc, y + 8);
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);

  for (const entry of p.palette) {
    if (y + ROW_H > pageH - MARGIN) {
      doc.addPage();
      y = drawFlossHeader(doc, MARGIN + 14);
      doc.setFont('courier', 'normal');
      doc.setFontSize(9);
    }
    const cx = colX(doc.internal.pageSize.getWidth());
    const { r, g, b } = entry.dmc;
    doc.setFillColor(r, g, b);
    doc.setDrawColor(150);
    doc.rect(MARGIN, y - 9, 16, 11, 'FD');

    doc.setTextColor(0);
    doc.text(entry.symbol, cx.symbol, y);
    doc.text(entry.dmc.code, cx.code, y);
    doc.text(clip(doc, entry.dmc.name, cx.count - cx.name - 6), cx.name, y);
    doc.text(entry.count.toLocaleString('en-US'), cx.count, y, { align: 'right' });
    doc.text(String(entry.skeins), cx.skeins, y, { align: 'right' });
    y += ROW_H;
  }
}

function colX(pageW: number): {
  symbol: number;
  code: number;
  name: number;
  count: number;
  skeins: number;
} {
  return {
    symbol: MARGIN + 26,
    code: MARGIN + 48,
    name: MARGIN + 92,
    count: pageW - MARGIN - 50,
    skeins: pageW - MARGIN,
  };
}

function drawFlossHeader(doc: jsPDF, y: number): number {
  const cx = colX(doc.internal.pageSize.getWidth());
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text('SW', MARGIN, y);
  doc.text('SYM', cx.symbol, y);
  doc.text('DMC', cx.code, y);
  doc.text('NAME', cx.name, y);
  doc.text('STITCHES', cx.count, y, { align: 'right' });
  doc.text('SKEINS', cx.skeins, y, { align: 'right' });
  doc.setTextColor(0);
  doc.setDrawColor(180);
  doc.line(MARGIN, y + 4, cx.skeins, y + 4);
  return y + 16;
}

function clip(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && doc.getTextWidth(`${t}…`) > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

function drawChart(doc: jsPDF, p: Pattern, pageW: number, pageH: number): void {
  const ox = MARGIN + GUTTER;
  const oyBase = MARGIN + 24 + GUTTER;
  const colsPerPage = Math.floor((pageW - ox - MARGIN) / CELL);
  const rowsPerPage = Math.floor((pageH - oyBase - MARGIN) / CELL);
  const pagesX = Math.ceil(p.stitchesWide / colsPerPage);
  const pagesY = Math.ceil(p.stitchesHigh / rowsPerPage);
  const totalPages = pagesX * pagesY;

  let pageNum = 0;
  for (let py = 0; py < pagesY; py++) {
    for (let px = 0; px < pagesX; px++) {
      pageNum++;
      doc.addPage();
      const c0 = px * colsPerPage;
      const c1 = Math.min(c0 + colsPerPage, p.stitchesWide);
      const r0 = py * rowsPerPage;
      const r1 = Math.min(r0 + rowsPerPage, p.stitchesHigh);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(
        `Chart — page ${pageNum} of ${totalPages}   ·   cols ${c0 + 1}–${c1}, rows ${r0 + 1}–${r1}`,
        MARGIN,
        MARGIN + 6,
      );

      const oy = oyBase;
      drawChartBlock(doc, p, c0, c1, r0, r1, ox, oy);
    }
  }
}

function drawChartBlock(
  doc: jsPDF,
  p: Pattern,
  c0: number,
  c1: number,
  r0: number,
  r1: number,
  ox: number,
  oy: number,
): void {
  const cols = c1 - c0;
  const rows = r1 - r0;
  const right = ox + cols * CELL;
  const bottom = oy + rows * CELL;

  // Symbols.
  doc.setFont('courier', 'normal');
  doc.setFontSize(CELL * 0.82);
  doc.setTextColor(0);
  for (let y = r0; y < r1; y++) {
    for (let x = c0; x < c1; x++) {
      const idx = p.cells[y * p.stitchesWide + x];
      if (idx === BLANK) continue;
      const sym = p.palette[idx].symbol;
      doc.text(sym, ox + (x - c0) * CELL + CELL / 2, oy + (y - r0) * CELL + CELL * 0.74, {
        align: 'center',
      });
    }
  }

  // Minor grid.
  doc.setDrawColor(210);
  doc.setLineWidth(0.4);
  for (let x = c0; x <= c1; x++) {
    if (x % 10 === 0) continue;
    const gx = ox + (x - c0) * CELL;
    doc.line(gx, oy, gx, bottom);
  }
  for (let y = r0; y <= r1; y++) {
    if (y % 10 === 0) continue;
    const gy = oy + (y - r0) * CELL;
    doc.line(ox, gy, right, gy);
  }

  // Major grid (every 10 global stitches) + coordinate labels.
  doc.setDrawColor(40);
  doc.setLineWidth(1);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(80);
  for (let x = c0; x <= c1; x++) {
    if (x % 10 !== 0 && x !== c0 && x !== c1) continue;
    const gx = ox + (x - c0) * CELL;
    if (x % 10 === 0) {
      doc.line(gx, oy, gx, bottom);
      if (x !== c1) doc.text(String(x), gx + 1, oy - 4);
    }
  }
  for (let y = r0; y <= r1; y++) {
    if (y % 10 !== 0 && y !== r0 && y !== r1) continue;
    const gy = oy + (y - r0) * CELL;
    if (y % 10 === 0) {
      doc.line(ox, gy, right, gy);
      if (y !== r1) doc.text(String(y), ox - GUTTER + 2, gy + 7);
    }
  }

  // Outer border.
  doc.setLineWidth(1.2);
  doc.rect(ox, oy, cols * CELL, rows * CELL);
}
