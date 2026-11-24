import type { Mm } from '../model/jednostki';
import type { Projekt } from '../model/projekt';
import {
  czyKontener,
  wymiaryKarty,
  type Kontener,
  type Rewers,
  type Rozmiar,
  type Szablon,
  type Wezel,
} from '../model/szablon';
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

/** Sposób dopasowania zawartości karty przy zmianie jej rozmiaru. */
export type DopasowanieZawartosci = 'skaluj' | 'zostaw';
export const DOPASOWANIA_ZAWARTOSCI: readonly DopasowanieZawartosci[] = ['skaluj', 'zostaw'];

const skalujRozmiar = (r: Rozmiar | undefined, k: number): Rozmiar | undefined =>
  r !== undefined && r !== 'auto' && 'mm' in r ? { mm: Math.round(r.mm * k * 100) / 100 } : r;

/**
 * Zawartość karty po zmianie rozmiaru z `stary` na `nowy`: „skaluj” – położenia i rozmiary (mm)
 * elementów przeskalowane osobno w poziomie i w pionie względem nowego rozmiaru karty;
 * „zostaw” – bez zmian (elementy poza kartą pokazuje ostrzeżenie w drzewie).
 */
export function dopasujZawartosc(
  s: Szablon,
  stary: Pick<WymiaryStrony, 'szer' | 'wys'>,
  nowy: Pick<WymiaryStrony, 'szer' | 'wys'>,
  tryb: DopasowanieZawartosci,
): Szablon {
  const sx = nowy.szer / stary.szer;
  const sy = nowy.wys / stary.wys;
  if (tryb === 'zostaw' || (rowne(sx, 1) && rowne(sy, 1))) return s;
  const zaokr = (x: number) => Math.round(x * 100) / 100;
  const skaluj = (w: Wezel): Wezel => {
    // Obrót 90° / 270°: szerokość elementu leży w pionie karty.
    const poprzecznie = w.pozycja?.obrot === 90 || w.pozycja?.obrot === 270;
    const [kx, ky] = poprzecznie ? [sy, sx] : [sx, sy];
    const x: Wezel = { ...w };
    const szer = skalujRozmiar(w.szerokosc, kx);
    const wys = skalujRozmiar(w.wysokosc, ky);
    if (szer !== undefined) x.szerokosc = szer;
    if (wys !== undefined) x.wysokosc = wys;
    if (w.pozycja)
      x.pozycja = { ...w.pozycja, x: zaokr(w.pozycja.x * sx), y: zaokr(w.pozycja.y * sy) };
    return czyKontener(x) ? ({ ...x, dzieci: x.dzieci.map(skaluj) } as Wezel) : x;
  };
  const korzen = (k: Kontener) => ({ ...k, dzieci: k.dzieci.map(skaluj) }) as Kontener;
  return {
    ...s,
    korzen: korzen(s.korzen),
    ...(s.warianty
      ? { warianty: s.warianty.map((w) => ({ ...w, korzen: korzen(w.korzen) })) }
      : {}),
  };
}

/** Elementy, których obszar na karcie wychodzi poza jej krawędzie (z wyrenderowanych ramek). */
export function elementyPozaKarta(
  wezly: readonly { id: string; x: number; y: number; szer: number; wys: number }[],
  szer: number,
  wys: number,
  korzenId: string,
): Set<string> {
  const wynik = new Set<string>();
  for (const w of wezly)
    if (
      w.id !== korzenId &&
      (w.x < -TOLERANCJA ||
        w.y < -TOLERANCJA ||
        w.x + w.szer > szer + TOLERANCJA ||
        w.y + w.wys > wys + TOLERANCJA)
    )
      wynik.add(w.id);
  return wynik;
}

/** Niezgodne pary przód–tył w talii (karty z rozstrzygniętym tyłem), każda para raz. */
export function niezgodnosciTalii(
  p: Projekt,
  taliaId: string,
): { przod: Szablon; tyl: Rewers; roznica: Niezgodnosc }[] {
  const talia = p.talie.find((x) => x.id === taliaId);
  if (!talia) return [];
  const rewersy = new Map((p.rewersy ?? []).map((r) => [r.id, r] as const));
  const szablony = new Map(p.szablony.map((s) => [s.id, s] as const));
  const wynik = new Map<string, { przod: Szablon; tyl: Rewers; roznica: Niezgodnosc }>();
  for (const k of talia.karty) {
    const s = szablony.get(k.szablonId);
    const r = s && rewersKarty(rewersy, k, s, talia);
    if (!s || !r || wynik.has(`${s.id}\n${r.id}`)) continue;
    const roznica = niezgodnosc(wymiaryPrzodu(s), wymiaryTylu(r));
    if (roznica) wynik.set(`${s.id}\n${r.id}`, { przod: s, tyl: r, roznica });
  }
  return [...wynik.values()];
}
