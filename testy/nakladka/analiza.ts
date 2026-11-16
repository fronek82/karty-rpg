import type { ElementSceny, Scena } from '../../src/silnik/scena';

/**
 * Analiza nakładki arkusza na referencję: pozycje linii cięcia z naszej sceny (dokładne, mm),
 * odszukanie ich w rastrze referencji (profil ciemnych pikseli) i dopasowanie liniowe
 * r = a·p + b w każdej osi. Reszty dopasowania mówią, czy siatka się zgadza; a i b – jak
 * referencja jest przeskalowana i przesunięta (np. druk 99,89%).
 */

export interface Linie {
  pionowe: number[];
  poziome: number[];
}

/**
 * Linie cięcia z naszej sceny (przerywane linie najwyższego poziomu), pogrupowane po
 * współrzędnej; tylko „długie” (≥ połowy najdłuższej) – jak w referencji, gdzie mierzymy linie
 * biegnące przez siatkę.
 */
export function linieCiecia(scena: Scena): Linie {
  const linie = scena.elementy.filter(
    (e): e is Extract<ElementSceny, { typ: 'linia' }> => e.typ === 'linia' && !!e.obrys.kreska,
  );
  const zbierz = (pion: boolean) => {
    const dlugosci = new Map<number, number>();
    for (const l of linie) {
      if (pion ? l.x1 !== l.x2 : l.y1 !== l.y2) continue;
      const k = Math.round((pion ? l.x1 : l.y1) * 100) / 100;
      dlugosci.set(k, (dlugosci.get(k) ?? 0) + Math.abs(pion ? l.y2 - l.y1 : l.x2 - l.x1));
    }
    const max = Math.max(0, ...dlugosci.values());
    return [...dlugosci]
      .filter(([, d]) => d >= max / 2)
      .map(([k]) => k)
      .sort((a, b) => a - b);
  };
  return { pionowe: zbierz(true), poziome: zbierz(false) };
}

/**
 * Najsilniejsze maksimum profilu w oknie ±`okno` mm wokół `mm`, z położeniem jako średnią ważoną
 * w jego otoczeniu (dokładność poniżej piksela). undefined – brak wyraźnej linii.
 */
export function znajdzLinie(
  profil: number[],
  pxNaMm: number,
  mm: number,
  okno: number,
  minimum: number,
): number | undefined {
  const od = Math.max(0, Math.floor((mm - okno) * pxNaMm));
  const do_ = Math.min(profil.length - 1, Math.ceil((mm + okno) * pxNaMm));
  let najlepszy = -1;
  for (let i = od; i <= do_; i++)
    if (najlepszy < 0 || profil[i]! > profil[najlepszy]!) najlepszy = i;
  if (najlepszy < 0 || profil[najlepszy]! < minimum) return undefined;
  const r = Math.max(1, Math.round(pxNaMm * 0.4));
  let suma = 0;
  let waga = 0;
  for (let i = Math.max(0, najlepszy - r); i <= Math.min(profil.length - 1, najlepszy + r); i++) {
    const w = Math.max(0, profil[i]! - profil[najlepszy]! / 2);
    suma += (i + 0.5) * w;
    waga += w;
  }
  return suma / waga / pxNaMm;
}

export interface Dopasowanie {
  a: number;
  b: number;
  pary: { nasza: number; referencja: number; reszta: number }[];
  /** Linie, których nie znaleziono w referencji (mm). */
  brakujace: number[];
  maksReszta: number;
}

/** Regresja liniowa r = a·p + b z resztami. */
export function dopasuj(nasze: number[], znalezione: (number | undefined)[]): Dopasowanie {
  const pary = nasze.flatMap((p, i) => {
    const r = znalezione[i];
    return r === undefined ? [] : [{ p, r }];
  });
  const brakujace = nasze.filter((_, i) => znalezione[i] === undefined);
  const n = pary.length;
  if (n < 2) return { a: 1, b: 0, pary: [], brakujace, maksReszta: Infinity };
  const sp = pary.reduce((s, x) => s + x.p, 0) / n;
  const sr = pary.reduce((s, x) => s + x.r, 0) / n;
  const kow = pary.reduce((s, x) => s + (x.p - sp) * (x.r - sr), 0);
  const war = pary.reduce((s, x) => s + (x.p - sp) ** 2, 0);
  const a = kow / war;
  const b = sr - a * sp;
  const wynik = pary.map(({ p, r }) => ({ nasza: p, referencja: r, reszta: r - (a * p + b) }));
  return {
    a,
    b,
    pary: wynik,
    brakujace,
    maksReszta: Math.max(...wynik.map((x) => Math.abs(x.reszta))),
  };
}
