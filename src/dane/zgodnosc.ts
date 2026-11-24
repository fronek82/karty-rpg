import type { Mm } from '../model/jednostki';
import type { Projekt } from '../model/projekt';
import { wymiaryKarty, type Rewers, type Szablon } from '../model/szablon';
import { rewersKarty } from './rewers';

/**
 * Zgodność rozmiarów przodu (szablonu) i tyłu (rewersu): wymiary, orientacja i zaokrąglenie
 * rogów. Na arkuszu tył dopasowuje się do przodu – niezgodne rozmiary zniekształcają tył.
 */

export interface WymiaryStrony {
  szer: Mm;
  wys: Mm;
  /** Brak – rogi „jak przód” (tył z projektu sprzed schematu 31), nie porównywane. */
  promien?: Mm;
}

const TOLERANCJA = 0.05;
const rowne = (a: number, b: number) => Math.abs(a - b) <= TOLERANCJA;

export const wymiaryPrzodu = (s: Szablon): WymiaryStrony => {
  const { szer, wys } = wymiaryKarty(s);
  return { szer, wys, promien: s.promienRogow ?? 0 };
};

export const wymiaryTylu = (r: Rewers): WymiaryStrony => ({
  szer: r.rozmiar.szerokosc,
  wys: r.rozmiar.wysokosc,
  ...(r.promienRogow !== undefined ? { promien: r.promienRogow } : {}),
});

export interface Niezgodnosc {
  rozmiar: boolean;
  orientacja: boolean;
  rogi: boolean;
}

/** Różnice między przodem a tyłem albo `undefined`, gdy pasują. */
export function niezgodnosc(a: WymiaryStrony, b: WymiaryStrony): Niezgodnosc | undefined {
  const orientacja =
    a.szer > a.wys !== b.szer > b.wys && !rowne(a.szer, a.wys) && !rowne(b.szer, b.wys);
  const rozmiar = !(rowne(a.szer, b.szer) && rowne(a.wys, b.wys));
  const rogi = a.promien !== undefined && b.promien !== undefined && !rowne(a.promien, b.promien);
  return rozmiar || orientacja || rogi ? { rozmiar, orientacja, rogi } : undefined;
}

const liczba = (x: number) => String(Math.round(x * 10) / 10).replace('.', ',');

/** „63×88” (mm, z przecinkiem dziesiętnym). */
export const opisRozmiaru = (w: Pick<WymiaryStrony, 'szer' | 'wys'>) =>
  `${liczba(w.szer)}×${liczba(w.wys)}`;

/** Szablon powiązany z edytowanym: tył przypisany do przodu albo przód korzystający z tyłu. */
export interface Powiazanie {
  strona: 'przod' | 'tyl';
  id: string;
  nazwa: string;
  wymiary: WymiaryStrony;
}

/**
 * Tyły używane przez przód `szablonId` (przypisanie szablonu i karty z tym szablonem,
 * także przez talię) albo przody, które korzystają z tyłu `rewersId`. Pusty przód projektu
 * samego tyłu (bez kart i bez przypisania) się nie liczy.
 */
export function powiazania(p: Projekt, strona: 'przod' | 'tyl', id: string): Powiazanie[] {
  const rewersy = new Map((p.rewersy ?? []).map((r) => [r.id, r] as const));
  const pary: [Szablon, Rewers][] = [];
  for (const s of p.szablony)
    if (typeof s.rewersId === 'string' && rewersy.has(s.rewersId))
      pary.push([s, rewersy.get(s.rewersId)!]);
  const szablony = new Map(p.szablony.map((s) => [s.id, s] as const));
  for (const talia of p.talie)
    for (const k of talia.karty) {
      const s = szablony.get(k.szablonId);
      const r = s && rewersKarty(rewersy, k, s, talia);
      if (s && r) pary.push([s, r]);
    }
  const wynik = new Map<string, Powiazanie>();
  for (const [s, r] of pary) {
    if (strona === 'przod' && s.id === id)
      wynik.set(r.id, { strona: 'tyl', id: r.id, nazwa: r.nazwa, wymiary: wymiaryTylu(r) });
    if (strona === 'tyl' && r.id === id)
      wynik.set(s.id, { strona: 'przod', id: s.id, nazwa: s.nazwa, wymiary: wymiaryPrzodu(s) });
  }
  return [...wynik.values()];
}
