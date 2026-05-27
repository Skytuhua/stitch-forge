import { hexOf } from '../core/color';
import { physicalSize, type Pattern } from '../core/pattern';
import { downloadBlob } from './png';

function escapeCsv(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build a floss shopping list as CSV text. */
export function flossListCsv(p: Pattern, fabricCount: number): string {
  const size = physicalSize(p.stitchesWide, p.stitchesHigh, fabricCount);
  const header = [
    `# StitchForge floss list`,
    `# Pattern: ${p.stitchesWide} x ${p.stitchesHigh} stitches, ${p.totalStitches} total, ${p.palette.length} colors`,
    `# Finished size: ${size.inches.w} x ${size.inches.h} in (${size.cm.w} x ${size.cm.h} cm) on ${fabricCount}-count`,
  ].join('\n');

  const rows = [['Symbol', 'DMC', 'Name', 'Hex', 'Stitches', 'Skeins (est.)']];
  for (const e of p.palette) {
    rows.push([e.symbol, e.dmc.code, e.dmc.name, hexOf(e.dmc), String(e.count), String(e.skeins)]);
  }
  const body = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
  return `${header}\n${body}\n`;
}

export function exportFlossCsv(p: Pattern, fabricCount: number, filename: string): void {
  const blob = new Blob([flossListCsv(p, fabricCount)], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, filename);
}
