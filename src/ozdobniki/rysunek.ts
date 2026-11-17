import type { KomendaKonturu, Kontur } from '../silnik/scena';

/** Pomocnicze konstruktory konturów do rysowania elementów wbudowanych (jednostki rysunku, Y w dół). */

const K = 0.5522847498;

/** Wielokąt z listy punktów (zamknięty). */
export function wielokat(...p: [number, number][]): Kontur {
  return [
    ['M', p[0]![0], p[0]![1]],
    ...p.slice(1).map(([x, y]): KomendaKonturu => ['L', x, y]),
    ['Z'],
  ];
}

/** Prostokąt (x, y, szerokość, wysokość). */
export function prostokat(x: number, y: number, w: number, h: number): Kontur {
  return wielokat([x, y], [x + w, y], [x + w, y + h], [x, y + h]);
}

/**
 * Okrąg z czterech krzywych; `odwrotnie` zmienia kierunek obiegu – dwa okręgi o przeciwnych
 * kierunkach w jednym konturze dają pierścień (dziurę przy wypełnieniu nonzero).
 */
export function okrag(cx: number, cy: number, r: number, odwrotnie = false): Kontur {
  const k = r * K;
  if (!odwrotnie)
    return [
      ['M', cx + r, cy],
      ['C', cx + r, cy + k, cx + k, cy + r, cx, cy + r],
      ['C', cx - k, cy + r, cx - r, cy + k, cx - r, cy],
      ['C', cx - r, cy - k, cx - k, cy - r, cx, cy - r],
      ['C', cx + k, cy - r, cx + r, cy - k, cx + r, cy],
      ['Z'],
    ];
  return [
    ['M', cx + r, cy],
    ['C', cx + r, cy - k, cx + k, cy - r, cx, cy - r],
    ['C', cx - k, cy - r, cx - r, cy - k, cx - r, cy],
    ['C', cx - r, cy + k, cx - k, cy + r, cx, cy + r],
    ['C', cx + k, cy + r, cx + r, cy + k, cx + r, cy],
    ['Z'],
  ];
}

/** Pierścień: zewnętrzny promień `r1`, wewnętrzny `r2`. */
export function pierscien(cx: number, cy: number, r1: number, r2: number): Kontur {
  return [...okrag(cx, cy, r1), ...okrag(cx, cy, r2, true)];
}

/** Liść (soczewka) od `(x0, y0)` do `(x1, y1)` o największej szerokości `w`. */
export function lisc(x0: number, y0: number, x1: number, y1: number, w: number): Kontur {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const d = Math.hypot(dx, dy) || 1;
  const px = (-dy / d) * w;
  const py = (dx / d) * w;
  const a = (t: number, s: number): [number, number] => [
    x0 + dx * t + px * s,
    y0 + dy * t + py * s,
  ];
  const [a1x, a1y] = a(0.2, 1.3);
  const [a2x, a2y] = a(0.7, 1.0);
  const [b1x, b1y] = a(0.7, -1.0);
  const [b2x, b2y] = a(0.2, -1.3);
  return [
    ['M', x0, y0],
    ['C', a1x, a1y, a2x, a2y, x1, y1],
    ['C', b1x, b1y, b2x, b2y, x0, y0],
    ['Z'],
  ];
}

/** Gwiazda o `n` ramionach (n·2 wierzchołków), pierwszy ramię w górę. */
export function gwiazda(cx: number, cy: number, r1: number, r2: number, n = 4): Kontur {
  const p: [number, number][] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? r1 : r2;
    const kat = (Math.PI * i) / n - Math.PI / 2;
    p.push([cx + r * Math.cos(kat), cy + r * Math.sin(kat)]);
  }
  return wielokat(...p);
}
