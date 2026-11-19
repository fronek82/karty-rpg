import type { Kontur } from './scena';

const KAPPA = 0.5522847498;

/** Prostokąt z zaokrąglonymi rogami jako kontur (mm, oś Y w dół). */
export function konturProstokata(x: number, y: number, w: number, h: number, r = 0): Kontur {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (rr === 0) return [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];
  const k = rr * KAPPA;
  return [
    ['M', x + rr, y],
    ['L', x + w - rr, y],
    ['C', x + w - rr + k, y, x + w, y + rr - k, x + w, y + rr],
    ['L', x + w, y + h - rr],
    ['C', x + w, y + h - rr + k, x + w - rr + k, y + h, x + w - rr, y + h],
    ['L', x + rr, y + h],
    ['C', x + rr - k, y + h, x, y + h - rr + k, x, y + h - rr],
    ['L', x, y + rr],
    ['C', x, y + rr - k, x + rr - k, y, x + rr, y],
    ['Z'],
  ];
}

export function konturOkregu(cx: number, cy: number, r: number): Kontur {
  const k = r * KAPPA;
  return [
    ['M', cx + r, cy],
    ['C', cx + r, cy + k, cx + k, cy + r, cx, cy + r],
    ['C', cx - k, cy + r, cx - r, cy + k, cx - r, cy],
    ['C', cx - r, cy - k, cx - k, cy - r, cx, cy - r],
    ['C', cx + k, cy - r, cx + r, cy - k, cx + r, cy],
    ['Z'],
  ];
}
