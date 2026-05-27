import { DMC_COLORS, type DmcColor } from './dmc-data';
import { ciede2000, rgbToLab, type Lab, type Rgb } from './color';

export interface DmcColorLab extends DmcColor {
  lab: Lab;
}

// Precompute LAB for every DMC color once (cheap: 454 conversions).
export const DMC_LAB: readonly DmcColorLab[] = DMC_COLORS.map((c) => ({
  ...c,
  lab: rgbToLab({ r: c.r, g: c.g, b: c.b }),
}));

export interface DmcMatch {
  color: DmcColorLab;
  distance: number; // dE00 from the queried color
}

/** Nearest DMC floss to an arbitrary sRGB color, by CIEDE2000 in LAB space. */
export function nearestDmc(rgb: Rgb, palette: readonly DmcColorLab[] = DMC_LAB): DmcMatch {
  return nearestDmcLab(rgbToLab(rgb), palette);
}

/** Nearest DMC floss to an already-computed LAB color. */
export function nearestDmcLab(lab: Lab, palette: readonly DmcColorLab[] = DMC_LAB): DmcMatch {
  let best = palette[0];
  let bestD = Infinity;
  for (const c of palette) {
    const d = ciede2000(lab, c.lab);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return { color: best, distance: bestD };
}

export function dmcByCode(code: string): DmcColorLab | undefined {
  return DMC_LAB.find((c) => c.code === code);
}

export const DMC_COUNT = DMC_LAB.length;
