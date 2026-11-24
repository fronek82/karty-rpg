import type { Mm } from '../model/jednostki';
import type { Kolor, Narozniki } from '../model/szablon';
import type { DefinicjaSymbolu, ElementSceny, Macierz } from '../silnik/scena';
import { znajdzElement } from './katalog';
import type { ElementOzdobny } from './typy';

/**
 * Kolory rysunku elementu: wypełnienia i obrysy konturów (brak wypełnienia / obrysu – `none` – się
 * nie liczy; przezroczystych kolorów import nie przenosi). `'kolor'` (`currentColor`) to jeden kolor.
 */
export function koloryElementu(e: Pick<ElementOzdobny, 'kontury'>): Set<string> {
  const kolory = new Set<string>();
  const dodaj = (k: string) => kolory.add(k === 'kolor' ? k : k.trim().toLowerCase());
  for (const c of e.kontury) {
    if (c.wypelnienie !== undefined) dodaj(c.wypelnienie);
    if (c.obrys && c.obrys.grubosc > 0) dodaj(c.obrys.kolor);
  }
  return kolory;
}

/** Czy rysunek ma najwyżej jeden kolor (można go przekolorować w miejscu użycia, np. wzór tła). */
export const czyJednokolorowy = (e: Pick<ElementOzdobny, 'kontury'>): boolean =>
  koloryElementu(e).size <= 1;

/**
 * Definicja symbolu sceny z elementu biblioteki (klucz = identyfikator elementu). `jednolity` –
 * wszystkie kolory z miejsca użycia (domyślnie według ustawienia `kolorowanie` elementu).
 */
export function symbolZElementu(
  e: ElementOzdobny,
  jednolity = e.kolorowanie === 'jednolity',
): DefinicjaSymbolu {
  if (!jednolity) return { kontury: e.kontury, szer: e.szer, wys: e.wys };
  // Własny rysunek „jednolity”: wszystkie wypełnienia i obrysy dziedziczą kolor z miejsca użycia.
  const kontury = e.kontury.map((c) => ({
    ...c,
    ...(c.wypelnienie !== undefined ? { wypelnienie: 'kolor' as const } : {}),
    ...(c.obrys ? { obrys: { ...c.obrys, kolor: 'kolor' as const } } : {}),
  }));
  return { kontury, szer: e.szer, wys: e.wys };
}

/**
 * Macierze czterech rogów prostokąta: rysunek dla lewego górnego rogu skalowany do `rozmiar`
 * i odbity lustrzanie na pozostałe (kolejno: lewy górny, prawy górny, lewy dolny, prawy dolny).
 */
export function macierzeNarozniki(
  e: Pick<ElementOzdobny, 'szer' | 'wys'>,
  ramka: { x: Mm; y: Mm; szer: Mm; wys: Mm },
  rozmiar: Mm,
): Macierz[] {
  const sx = rozmiar / e.szer;
  const sy = rozmiar / e.wys;
  const { x, y, szer, wys } = ramka;
  return [
    [sx, 0, 0, sy, x, y],
    [-sx, 0, 0, sy, x + szer, y],
    [sx, 0, 0, -sy, x, y + wys],
    [-sx, 0, 0, -sy, x + szer, y + wys],
  ];
}

export interface WynikNarozniki {
  elementy: ElementSceny[];
  /** Użyty rysunek (do słownika symboli sceny); brak gdy element nieznany lub nic nie narysowano. */
  symbole: Record<string, DefinicjaSymbolu>;
  /** Identyfikator nieznanego elementu – ostrzeżenie, linia ramki zostaje. */
  nieznany?: string;
}

/**
 * Narożniki na czterech rogach `ramka`. Rozmiar ograniczony do połowy krótszego boku, żeby
 * narożniki sąsiednich rogów się nie nakładały. Kolor: `n.kolor`, potem `kolorDomyslny`.
 */
export function narozniki(
  n: Narozniki,
  ramka: { x: Mm; y: Mm; szer: Mm; wys: Mm },
  kolorDomyslny: Kolor,
  wlasne?: readonly ElementOzdobny[],
): WynikNarozniki {
  const e = znajdzElement(n.element, wlasne);
  if (!e || e.rodzaj !== 'naroznik') return { elementy: [], symbole: {}, nieznany: n.element };
  const rozmiar = Math.min(n.rozmiar, ramka.szer / 2, ramka.wys / 2);
  if (!(rozmiar > 0)) return { elementy: [], symbole: {} };
  const kolor = n.kolor ?? kolorDomyslny;
  return {
    elementy: macierzeNarozniki(e, ramka, rozmiar).map((macierz) => ({
      typ: 'symbol' as const,
      klucz: e.id,
      macierz,
      kolor,
    })),
    symbole: { [e.id]: symbolZElementu(e) },
  };
}
