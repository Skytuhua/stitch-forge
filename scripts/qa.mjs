// Headless functional + visual QA: drives the built app, screenshots each
// state, exercises exports, and fails loudly on console errors.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.QA_URL ?? 'http://localhost:4173/';
const OUT = join(process.cwd(), 'review', 'screenshots');
mkdirSync(OUT, { recursive: true });

const shot = (page, name) => page.screenshot({ path: join(OUT, name), fullPage: false });

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width: 1366, height: 900 },
  deviceScaleFactor: 2,
  acceptDownloads: true,
});
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

function check(cond, label) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}`);
  if (!cond) process.exitCode = 1;
}

// Playwright's fill() is unreliable on range inputs; set value + fire 'input'.
const setRange = (sel, value) =>
  page.$eval(
    sel,
    (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    value,
  );

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(300);
await shot(page, '01-empty.png');
check(await page.locator('#empty').isVisible(), 'empty state visible on load');

// Generate from the sample.
await page.click('#sample');
await page.waitForSelector('#canvas:not([hidden])', { timeout: 15000 });
await page.waitForFunction(() => document.getElementById('spinner')?.hidden === true, {
  timeout: 15000,
});
await page.waitForTimeout(400);
await shot(page, '02-sample-color.png');

const colors = await page.locator('#statColors').textContent();
const total = await page.locator('#statTotal').textContent();
const legendRows = await page.locator('.legend-row').count();
check(Number(colors) >= 2, `palette has >=2 colors (got ${colors})`);
check(legendRows === Number(colors), `legend rows (${legendRows}) match color count (${colors})`);
check(total !== '—' && total !== '0', `total stitches populated (${total})`);

// Symbol view.
await page.click('#viewSymbol');
await page.waitForTimeout(400);
await shot(page, '03-sample-symbols.png');
check(
  (await page.locator('#viewSymbol').getAttribute('aria-pressed')) === 'true',
  'symbol view active',
);

// Change width + colors, expect regeneration (dimensions must update).
await page.click('#viewColor');
await setRange('#colorsRange', 40);
await setRange('#widthRange', 140);
// Wait for the regenerated result (debounce + worker), not just spinner state.
await page
  .waitForFunction(() => document.getElementById('statSize')?.textContent?.startsWith('140 '), {
    timeout: 15000,
  })
  .catch(() => {});
await page.waitForTimeout(300);
await shot(page, '04-more-colors-wider.png');
const size2 = await page.locator('#statSize').textContent();
check(size2?.startsWith('140 ×'), `pattern regenerated at new width (got "${size2}")`);
const colors2 = Number(await page.locator('#statColors').textContent());
check(colors2 >= 2 && colors2 <= 40, `color count within requested bound (${colors2})`);

// Custom fabric count updates finished size.
const sizeBefore = await page.locator('#statPhysical').textContent();
await page.selectOption('#fabric', 'custom');
await page.locator('#fabricCustom').fill('22');
await page.locator('#fabricCustom').dispatchEvent('input');
await page.waitForTimeout(200);
const sizeAfter = await page.locator('#statPhysical').textContent();
check(sizeBefore !== sizeAfter, `finished size changes with fabric count (${sizeAfter})`);

// PNG export.
const pngDl = page.waitForEvent('download', { timeout: 15000 });
await page.click('#exportPng');
const png = await pngDl;
await png.saveAs(join(OUT, 'export-sample.png'));
check(true, `PNG download fired (${png.suggestedFilename()})`);

// PDF export (lazy-loads jsPDF).
await page.fill('#title', 'Sunset Sample');
const pdfDl = page.waitForEvent('download', { timeout: 30000 });
await page.click('#exportPdf');
const pdf = await pdfDl;
const pdfPath = join(OUT, 'export-sample.pdf');
await pdf.saveAs(pdfPath);
check(true, `PDF download fired (${pdf.suggestedFilename()})`);

// Mobile/responsive snapshot.
await page.setViewportSize({ width: 420, height: 900 });
await page.waitForTimeout(400);
await shot(page, '05-mobile.png');

// Robustness: a non-image file is rejected with a clear error.
await page.setViewportSize({ width: 1366, height: 900 });
const txt = join(OUT, 'not-an-image.txt');
writeFileSync(txt, 'definitely not an image');
await page.setInputFiles('#file', txt);
await page.waitForTimeout(300);
const status = await page.locator('#status').textContent();
check(/not an image/i.test(status ?? ''), `non-image file rejected (status: "${status}")`);

check(errors.length === 0, `no console errors (saw ${errors.length})`);
if (errors.length) console.log(errors.join('\n'));

await browser.close();
console.log('QA done.');
