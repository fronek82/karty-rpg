import type { Mm } from '../model/jednostki';
import { RAMIONA_GWIAZDY } from '../model/szablon';
import type { Kontur } from './scena';

/**
 * Figury wartości dodane w schemacie 28: wielokąty foremne, gwiazda, serce i kropla. Każda ma
 * naturalne proporcje (szerokość / wysokość) i prostokąt treści wpisany wokół środka optycznego
 * (np. środek ciężkości trójkąta), w którym wartość jest wyśrodkowana.
 */
export const FIGURY = ['trojkat', 'pieciokat', 'osmiokat', 'gwiazda', 'serce', 'kropla'] as const;
export type Figura = (typeof FIGURY)[number];

type Ramka = { x: Mm; y: Mm; szer: Mm; wys: Mm };
type Punkt = [number, number];
/** Ułamki wymiarów kształtu (x, y, szerokość, wysokość). */
export type Wnetrze = { x: number; y: number; szer: number; wys: number };

/** Opis figury w kwadracie jednostkowym 0–1 (rozciąganym do ramki). */
interface Opis {
  /** Szerokość / wysokość figury bez zniekształceń. */
  proporcje: number;
  /** Wielokąt (boki proste) albo kontur z krzywymi. */
  wielokat?: Punkt[];
  krzywe?: Kontur;
  /** Środek optyczny – środek prostokąta treści. */
  srodek: Punkt;
  /** Wielokąt, w którym musi zmieścić się treść (domyślnie sama figura). */
  obszarTresci?: Punkt[];
}

/** Liczba ramion gwiazdy w dozwolonym zakresie. */
export function liczbaRamion(n: number | undefined): number {
  const r = Math.round(n ?? RAMIONA_GWIAZDY.domyslnie);
  return Number.isFinite(r)
    ? Math.min(RAMIONA_GWIAZDY.max, Math.max(RAMIONA_GWIAZDY.min, r))
    : RAMIONA_GWIAZDY.domyslnie;
}

/** Punkty na okręgu (kąt startowy w stopniach, 0° = prawo, zgodnie z ruchem wskazówek zegara). */
function okrag(n: number, start: number, promien = 1): Punkt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((start + (360 * i) / n) * Math.PI) / 180;
    return [promien * Math.cos(a), promien * Math.sin(a)] as Punkt;
  });
}

/** Wielokąty (i środek) przeskalowane do kwadratu 0–1 wg granic pierwszego wielokąta. */
function normalizuj(pkt: Punkt[], srodek: Punkt, ...inne: Punkt[][]) {
  const xs = pkt.map((p) => p[0]);
  const ys = pkt.map((p) => p[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0;
  const h = Math.max(...ys) - y0;
  const n = (p: Punkt): Punkt => [(p[0] - x0) / w, (p[1] - y0) / h];
  return {
    proporcje: w / h,
    wielokat: pkt.map(n),
    srodek: n(srodek),
    inne: inne.map((q) => q.map(n)),
  };
}

/** Promień wewnętrzny gwiazdy (przy zewnętrznym 1): klasyczna gwiazda 5-ramienna, grubsze 6+. */
function promienWewnetrzny(n: number): number {
  if (n <= 4) return 0.42;
  return Math.min(0.5, Math.cos((2 * Math.PI) / n) / Math.cos(Math.PI / n));
}

function opisFigury(f: Figura, ramiona: number): Opis {
  switch (f) {
    case 'trojkat': {
      // Trójkąt równoboczny ostrzem w górę; środek optyczny – środek ciężkości (2/3 wysokości).
      const h = Math.sqrt(3) / 2;
      return {
        proporcje: 1 / h,
        wielokat: [
          [0.5, 0],
          [1, 1],
          [0, 1],
        ],
        srodek: [0.5, 2 / 3],
      };
    }
    case 'pieciokat':
    case 'osmiokat': {
      const n = f === 'pieciokat' ? 5 : 8;
      // Pięciokąt ostrzem w górę, ośmiokąt płaskim bokiem; środek – środek okręgu opisanego.
      const { proporcje, wielokat, srodek } = normalizuj(
        okrag(n, f === 'pieciokat' ? -90 : -67.5),
        [0, 0],
      );
      return { proporcje, wielokat, srodek };
    }
    case 'gwiazda': {
      const zew = okrag(ramiona, -90);
      const wew = okrag(ramiona, -90 + 180 / ramiona, promienWewnetrzny(ramiona));
      const pkt = zew.flatMap((p, i) => [p, wew[i]!]);
      const { proporcje, wielokat, srodek, inne } = normalizuj(pkt, [0, 0], wew);
      // Treść tylko w środkowym wielokącie (bez ramion).
      return { proporcje, wielokat, srodek, obszarTresci: inne[0] };
    }
    case 'serce':
      // Dwa łuki u góry, ostrze na dole; treść nieco nad środkiem (najszersza część).
      return {
        proporcje: 1.1,
        krzywe: [
          ['M', 0.5, 0.26],
          ['C', 0.5, 0.1, 0.38, 0, 0.25, 0],
          ['C', 0.1, 0, 0, 0.12, 0, 0.3],
          ['C', 0, 0.56, 0.26, 0.76, 0.5, 1],
          ['C', 0.74, 0.76, 1, 0.56, 1, 0.3],
          ['C', 1, 0.12, 0.9, 0, 0.75, 0],
          ['C', 0.62, 0, 0.5, 0.1, 0.5, 0.26],
          ['Z'],
        ],
        srodek: [0.5, 0.43],
      };
    case 'kropla':
      // Ostrze u góry, okrągły dół; treść w środku okrągłej części.
      return {
        proporcje: 0.75,
        krzywe: [
          ['M', 0.5, 0],
          ['C', 0.62, 0.2, 1, 0.42, 1, 0.66],
          ['C', 1, 0.85, 0.78, 1, 0.5, 1],
          ['C', 0.22, 1, 0, 0.85, 0, 0.66],
          ['C', 0, 0.42, 0.38, 0.2, 0.5, 0],
          ['Z'],
        ],
        srodek: [0.5, 0.66],
      };
  }
}

const pamiec = new Map<string, { opis: Opis; wnetrze: Wnetrze }>();

function dane(f: Figura, ramiona?: number) {
  const n = f === 'gwiazda' ? liczbaRamion(ramiona) : 0;
  const klucz = `${f}:${n}`;
  let d = pamiec.get(klucz);
  if (!d) {
    const opis = opisFigury(f, n);
    d = { opis, wnetrze: wyznaczWnetrze(opis) };
    pamiec.set(klucz, d);
  }
  return d;
}

/** Naturalne proporcje figury (szerokość / wysokość). */
export function proporcjeFigury(f: Figura, ramiona?: number): number {
  return dane(f, ramiona).opis.proporcje;
}

/** Prostokąt treści figury (ułamki wymiarów) wokół środka optycznego. */
export function wnetrzeFigury(f: Figura, ramiona?: number): Wnetrze {
  return dane(f, ramiona).wnetrze;
}

/** Krzywa Béziera (punkty kontrolne) w chwili `t`. */
function bezier(p0: Punkt, p1: Punkt, p2: Punkt, p3: Punkt, t: number): Punkt {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/** Kontur (M, L, C) jako wielokąt – krzywe próbkowane. */
function splaszcz(k: Kontur): Punkt[] {
  const wynik: Punkt[] = [];
  let biezacy: Punkt = [0, 0];
  for (const c of k) {
    if (c[0] === 'M' || c[0] === 'L') {
      biezacy = [c[1], c[2]];
      wynik.push(biezacy);
    } else if (c[0] === 'C') {
      const p0 = biezacy;
      for (let i = 1; i <= 16; i++)
        wynik.push(bezier(p0, [c[1], c[2]], [c[3], c[4]], [c[5], c[6]], i / 16));
      biezacy = [c[5], c[6]];
    }
  }
  return wynik;
}

/** Punkt w wielokącie (reguła parzystości). */
function wWielokacie(p: Punkt, w: Punkt[]): boolean {
  let wewnatrz = false;
  for (let i = 0, j = w.length - 1; i < w.length; j = i++) {
    const [xi, yi] = w[i]!;
    const [xj, yj] = w[j]!;
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi)
      wewnatrz = !wewnatrz;
  }
  return wewnatrz;
}

/**
 * Największy prostokąt treści o środku w środku optycznym i proporcjach 1 : 1 w mm (krótkie
 * wartości – „12”, „k6” – są mniej więcej kwadratowe), mieszczący się w obszarze treści.
 */
function wyznaczWnetrze(o: Opis): Wnetrze {
  const obszar = o.obszarTresci ?? o.wielokat ?? splaszcz(o.krzywe!);
  const [cx, cy] = o.srodek;
  // Kwadrat w mm: połowa szerokości w ułamkach = s / proporcje, połowa wysokości = s.
  const miesci = (s: number) => {
    const a = s / o.proporcje;
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const pkt: Punkt[] = [
        [cx - a + 2 * a * t, cy - s],
        [cx - a + 2 * a * t, cy + s],
        [cx - a, cy - s + 2 * s * t],
        [cx + a, cy - s + 2 * s * t],
      ];
      if (!pkt.every((p) => wWielokacie(p, obszar))) return false;
    }
    return true;
  };
  let lo = 0;
  let hi = 0.5;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (miesci(m)) lo = m;
    else hi = m;
  }
  const a = lo / o.proporcje;
  return { x: cx - a, y: cy - lo, szer: 2 * a, wys: 2 * lo };
}

/** Pole wielokąta ze znakiem (dodatnie – zgodnie z ruchem wskazówek zegara w osi y w dół). */
function poleZeZnakiem(w: Punkt[]): number {
  let s = 0;
  for (let i = 0, j = w.length - 1; i < w.length; j = i++)
    s += w[j]![0] * w[i]![1] - w[i]![0] * w[j]![1];
  return s / 2;
}

/**
 * Wielokąt z bokami przesuniętymi do środka o `d` (prostopadle) – zewnętrzna krawędź obrysu
 * pokrywa się wtedy z tłem. Wierzchołki – przecięcia przesuniętych boków.
 */
function wcietyWielokat(w: Punkt[], d: number): Punkt[] {
  if (d <= 0) return w;
  const znak = poleZeZnakiem(w) > 0 ? 1 : -1;
  const n = w.length;
  const linie = w.map((p, i) => {
    const q = w[(i + 1) % n]!;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const l = Math.hypot(dx, dy) || 1;
    // Normalna do środka (dla obiegu zgodnego z ruchem wskazówek zegara: (-dy, dx)).
    const nx = (-dy / l) * znak;
    const ny = (dx / l) * znak;
    return { p: [p[0] + nx * d, p[1] + ny * d] as Punkt, k: [dx, dy] as Punkt };
  });
  return linie.map((b, i) => {
    const a = linie[(i - 1 + n) % n]!;
    const det = a.k[0] * b.k[1] - a.k[1] * b.k[0];
    if (Math.abs(det) < 1e-12) return b.p;
    const t = ((b.p[0] - a.p[0]) * b.k[1] - (b.p[1] - a.p[1]) * b.k[0]) / det;
    return [a.p[0] + a.k[0] * t, a.p[1] + a.k[1] * t] as Punkt;
  });
}

/** Kontur figury wpisanej w ramkę `r`, przesunięty do środka o `wciecie`. */
export function konturFigury(f: Figura, r: Ramka, wciecie: Mm = 0, ramiona?: number): Kontur {
  const { opis } = dane(f, ramiona);
  if (opis.wielokat) {
    const pkt = wcietyWielokat(
      opis.wielokat.map(([x, y]) => [r.x + x * r.szer, r.y + y * r.wys] as Punkt),
      wciecie,
    );
    return [...pkt.map(([x, y], i) => [i === 0 ? 'M' : 'L', x, y] as const), ['Z']] as Kontur;
  }
  // Krzywe: ramka zmniejszona o wcięcie z każdej strony (jak tarcza).
  const x0 = r.x + wciecie;
  const y0 = r.y + wciecie;
  const w = Math.max(0, r.szer - 2 * wciecie);
  const h = Math.max(0, r.wys - 2 * wciecie);
  return opis.krzywe!.map((c) => {
    if (c[0] === 'Z') return c;
    if (c[0] === 'C')
      return [
        'C',
        x0 + c[1] * w,
        y0 + c[2] * h,
        x0 + c[3] * w,
        y0 + c[4] * h,
        x0 + c[5] * w,
        y0 + c[6] * h,
      ];
    return [c[0], x0 + c[1] * w, y0 + c[2] * h];
  }) as Kontur;
}

/** Ramka o proporcjach `p` (szer / wys), największa w `r` i wyśrodkowana. */
export function wpiszProporcje(r: Ramka, p: number): Ramka {
  if (!(p > 0) || !(r.szer > 0) || !(r.wys > 0)) return r;
  const szer = Math.min(r.szer, r.wys * p);
  const wys = szer / p;
  return { x: r.x + (r.szer - szer) / 2, y: r.y + (r.wys - wys) / 2, szer, wys };
}
