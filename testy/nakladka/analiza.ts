import type { ElementSceny, Scena } from '../../src/silnik/scena';

/**
 * Analiza nakładki arkusza na referencję: pozycje linii cięcia z naszej sceny (dokładne, mm),
 * odszukanie ich w rastrze referencji (profil ciemności) i dopasowanie liniowe r = a·p + b
 * w każdej osi. Reszty mówią, czy siatka się zgadza; a i b – jak referencja jest przeskalowana
 * (np. druk 99,89%) i przesunięta.
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
 * Linia w profilu (suma ciemności w kolumnie/wierszu) w oknie ±`okno` mm wokół `mm`.
 * Wybierane jest najsilniejsze maksimum o wąskim plateau (≤ `maksSzerokosc` mm na połowie
 * wysokości) – linia cięcia jest cienka, a pasek tytułu czy zaczerniony obszar szeroki.
 * Położenie – średnia ważona w otoczeniu maksimum (dokładność poniżej piksela).
 * undefined – brak wyraźnej, cienkiej linii.
 */
export function znajdzLinie(
  profil: ArrayLike<number>,
  pxNaMm: number,
  mm: number,
  okno: number,
  minimum: number,
  maksSzerokosc = 0.6,
): number | undefined {
  const od = Math.max(0, Math.floor((mm - okno) * pxNaMm));
  const do_ = Math.min(profil.length - 1, Math.ceil((mm + okno) * pxNaMm));
  const kandydaci: number[] = [];
  for (let i = od; i <= do_; i++) {
    const v = profil[i]!;
    if (v >= minimum && v >= (profil[i - 1] ?? 0) && v >= (profil[i + 1] ?? 0)) kandydaci.push(i);
  }
  kandydaci.sort((a, b) => profil[b]! - profil[a]!);
  for (const szczyt of kandydaci) {
    const pol = profil[szczyt]! / 2;
    let l = szczyt;
    let p = szczyt;
    while (l > 0 && profil[l - 1]! > pol) l--;
    while (p < profil.length - 1 && profil[p + 1]! > pol) p++;
    if ((p - l + 1) / pxNaMm > maksSzerokosc) continue;
    let suma = 0;
    let waga = 0;
    for (let i = l; i <= p; i++) {
      const w = profil[i]! - pol;
      suma += (i + 0.5) * w;
      waga += w;
    }
    if (waga > 0) return suma / waga / pxNaMm;
  }
  return undefined;
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

/**
 * Dwa przebiegi: zgrubny (okno ±`okno` mm wokół naszej pozycji) i dokładny – w wąskim oknie
 * wokół pozycji przewidzianej pierwszym dopasowaniem. Pojedyncze pomyłki pierwszego przebiegu
 * (np. sąsiedni element) nie przesuwają wyniku, bo drugi szuka tam, gdzie wskazuje cała siatka.
 */
export function dopasujLinie(
  profil: ArrayLike<number>,
  pxNaMm: number,
  nasze: number[],
  minimum: number,
  okno = 3,
  oknoDokladne = 0.75,
): Dopasowanie {
  if (nasze.length < 2) throw new Error('Za mało linii cięcia do dopasowania (potrzebne ≥ 2).');
  const zgrubne = dopasuj(
    nasze,
    nasze.map((p) => znajdzLinie(profil, pxNaMm, p, okno, minimum)),
  );
  return dopasuj(
    nasze,
    nasze.map((p) => znajdzLinie(profil, pxNaMm, zgrubne.a * p + zgrubne.b, oknoDokladne, minimum)),
  );
}
