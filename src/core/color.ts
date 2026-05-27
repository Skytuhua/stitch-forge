// Perceptual color math: sRGB <-> CIELAB (D65) and the CIEDE2000 color
// difference. This is the heart of StitchForge's accuracy: floss matching and
// color clustering happen in LAB space using CIEDE2000, which tracks human
// perception far better than naive RGB Euclidean distance.

export interface Rgb {
  r: number; // 0..255
  g: number;
  b: number;
}

export interface Lab {
  L: number;
  a: number;
  b: number;
}

// D65 reference white, 2° observer.
const Xn = 95.047;
const Yn = 100.0;
const Zn = 108.883;

function srgbChannelToLinear(c: number): number {
  const cs = c / 255;
  return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
}

/** sRGB channel (0..255) -> linear-light (0..1). For correct averaging. */
export function linearizeChannel(c: number): number {
  return srgbChannelToLinear(c);
}

/** linear-light (0..1) -> sRGB channel (0..255), clamped & rounded. */
export function delinearizeChannel(l: number): number {
  const x = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(x * 255)));
}

function labF(t: number): number {
  const d = 6 / 29;
  return t > d * d * d ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29;
}

export function rgbToLab({ r, g, b }: Rgb): Lab {
  const rl = srgbChannelToLinear(r);
  const gl = srgbChannelToLinear(g);
  const bl = srgbChannelToLinear(b);

  // linear sRGB -> XYZ (D65), scaled to 0..100
  const X = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) * 100;
  const Y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175) * 100;
  const Z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) * 100;

  const fx = labF(X / Xn);
  const fy = labF(Y / Yn);
  const fz = labF(Z / Zn);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

export function hexOf({ r, g, b }: Rgb): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

// Relative luminance (WCAG) of an sRGB color, 0..1. Used to pick legible
// text/symbol color on top of a floss swatch.
export function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

/** Returns '#000000' or '#FFFFFF', whichever has better contrast on `bg`. */
export function readableInkOn(bg: Rgb): string {
  return relativeLuminance(bg) > 0.45 ? '#000000' : '#FFFFFF';
}

const DEG = Math.PI / 180;

/**
 * CIEDE2000 color difference between two LAB colors.
 * Reference: Sharma, Wu & Dalal (2005). Returns dE00 (0 = identical).
 */
export function ciede2000(c1: Lab, c2: Lab): number {
  const { L: L1, a: a1, b: b1 } = c1;
  const { L: L2, a: a2, b: b2 } = c2;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;

  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + Math.pow(25, 7))));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;

  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  const h1p = hueAngle(b1, a1p);
  const h2p = hueAngle(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp: number;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else {
    let diff = h2p - h1p;
    if (diff > 180) diff -= 360;
    else if (diff < -180) diff += 360;
    dhp = diff;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * DEG) / 2);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hbarp: number;
  if (C1p * C2p === 0) {
    hbarp = h1p + h2p;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hbarp = (h1p + h2p) / 2;
  } else if (h1p + h2p < 360) {
    hbarp = (h1p + h2p + 360) / 2;
  } else {
    hbarp = (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * DEG) +
    0.24 * Math.cos(2 * hbarp * DEG) +
    0.32 * Math.cos((3 * hbarp + 6) * DEG) -
    0.2 * Math.cos((4 * hbarp - 63) * DEG);

  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + Math.pow(25, 7)));
  const Sl = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(2 * dTheta * DEG) * Rc;

  return Math.sqrt(
    Math.pow(dLp / Sl, 2) +
      Math.pow(dCp / Sc, 2) +
      Math.pow(dHp / Sh, 2) +
      Rt * (dCp / Sc) * (dHp / Sh),
  );
}

function hueAngle(b: number, ap: number): number {
  if (ap === 0 && b === 0) return 0;
  let h = Math.atan2(b, ap) / DEG;
  if (h < 0) h += 360;
  return h;
}
