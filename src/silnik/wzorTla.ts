import type { Mm } from '../model/jednostki';
import type { RodzajWzoruTla, WzorTla } from '../model/szablon';
import type { ElementSceny, Kontur } from './scena';

interface Obszar {
  x: Mm;
  y: Mm;
  szer: Mm;
  wys: Mm;
}

/** Kierunki linii (stopnie, przed obrotem wzoru) dla rodzajów liniowych. */
const KIERUNKI: Record<Exclude<RodzajWzoruTla, 'kropki'>, number[]> = {
  pionowe: [90],
  poziome: [0],
  kratka: [0, 90],
  ukosne: [45],
  romby: [45, -45],
};

/** Najwięcej kropek na karcie – przy gęstszym wzorze odstęp jest powiększany (wydajność PDF). */
export const MAX_KROPEK = 20000;
const K_LUKU = 0.5522847498;
const zaokr = (v: number) => Math.round(v * 1e4) / 1e4;

function rzuty(o: Obszar, px: number, py: number, ux: number, uy: number): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const [x, y] of [
    [o.x, o.y],
    [o.x + o.szer, o.y],
    [o.x, o.y + o.wys],
    [o.x + o.szer, o.y + o.wys],
  ] as const) {
    const d = (x - px) * ux + (y - py) * uy;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

function kolo(cx: number, cy: number, r: number): Kontur {
  const k = r * K_LUKU;
  return [
    ['M', zaokr(cx + r), zaokr(cy)],
    ['C', zaokr(cx + r), zaokr(cy + k), zaokr(cx + k), zaokr(cy + r), zaokr(cx), zaokr(cy + r)],
    ['C', zaokr(cx - k), zaokr(cy + r), zaokr(cx - r), zaokr(cy + k), zaokr(cx - r), zaokr(cy)],
    ['C', zaokr(cx - r), zaokr(cy - k), zaokr(cx - k), zaokr(cy - r), zaokr(cx), zaokr(cy - r)],
    ['C', zaokr(cx + k), zaokr(cy - r), zaokr(cx + r), zaokr(cy - k), zaokr(cx + r), zaokr(cy)],
    ['Z'],
  ];
}

/**
 * Elementy wzoru tła w obszarze `obszar` (np. karta ze spadem), bez przycięcia – przycina
 * wywołujący. Początek wzoru: (0, 0) karty netto przesunięte o `przesuniecie`, więc karta ze spadem
 * i bez niego mają wzór w tym samym miejscu.
 */
export function elementyWzoruTla(wzor: WzorTla, obszar: Obszar): ElementSceny[] {
  if (!(obszar.szer > 0 && obszar.wys > 0) || !(wzor.grubosc > 0) || !(wzor.odstep > 0)) return [];
  const px = wzor.przesuniecie?.x ?? 0;
  const py = wzor.przesuniecie?.y ?? 0;
  const obrot = wzor.obrot ?? 0;
  if (wzor.rodzaj === 'kropki') {
    const r = wzor.grubosc / 2;
    const odstep = Math.max(wzor.odstep, Math.sqrt((obszar.szer * obszar.wys) / MAX_KROPEK));
    const a = (obrot * Math.PI) / 180;
    const [ux, uy] = [Math.cos(a), Math.sin(a)];
    const [vx, vy] = [-uy, ux];
    const [minU, maxU] = rzuty(obszar, px, py, ux, uy);
    const [minV, maxV] = rzuty(obszar, px, py, vx, vy);
    const kontur: Kontur = [];
    for (let i = Math.floor((minU - r) / odstep); i <= Math.ceil((maxU + r) / odstep); i++) {
      for (let j = Math.floor((minV - r) / odstep); j <= Math.ceil((maxV + r) / odstep); j++) {
        const cx = px + i * odstep * ux + j * odstep * vx;
        const cy = py + i * odstep * uy + j * odstep * vy;
        if (
          cx + r < obszar.x ||
          cx - r > obszar.x + obszar.szer ||
          cy + r < obszar.y ||
          cy - r > obszar.y + obszar.wys
        )
          continue;
        kontur.push(...kolo(cx, cy, r));
      }
    }
    return kontur.length ? [{ typ: 'sciezka', kontur, wypelnienie: wzor.kolor }] : [];
  }
  const kontur: Kontur = [];
  for (const kierunek of KIERUNKI[wzor.rodzaj]) {
    const a = ((kierunek + obrot) * Math.PI) / 180;
    // d – kierunek linii, n – normalna (w niej odkładamy kolejne linie).
    const [dx, dy] = [Math.cos(a), Math.sin(a)];
    const [nx, ny] = [-dy, dx];
    const [minN, maxN] = rzuty(obszar, px, py, nx, ny);
    const [minD, maxD] = rzuty(obszar, px, py, dx, dy);
    const g = wzor.grubosc;
    for (
      let k = Math.floor((minN - g) / wzor.odstep);
      k <= Math.ceil((maxN + g) / wzor.odstep);
      k++
    ) {
      const sx = px + k * wzor.odstep * nx;
      const sy = py + k * wzor.odstep * ny;
      kontur.push(
        ['M', zaokr(sx + (minD - g) * dx), zaokr(sy + (minD - g) * dy)],
        ['L', zaokr(sx + (maxD + g) * dx), zaokr(sy + (maxD + g) * dy)],
      );
    }
  }
  return kontur.length
    ? [{ typ: 'sciezka', kontur, obrys: { kolor: wzor.kolor, grubosc: wzor.grubosc } }]
    : [];
}

/** Domyślny wzór po wybraniu „Wzór” w panelu tła karty. */
export const DOMYSLNY_WZOR_TLA: WzorTla = {
  rodzaj: 'kratka',
  grubosc: 0.2,
  odstep: 5,
  kolor: '#9fb3c8',
};
