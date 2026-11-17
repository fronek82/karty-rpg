import type { Mm } from '../model/jednostki';
import type { Kolor, Narozniki } from '../model/szablon';
import type { DefinicjaSymbolu, ElementSceny, Macierz } from '../silnik/scena';
import { znajdzElement } from './katalog';
import type { ElementOzdobny } from './typy';

/** Definicja symbolu sceny z elementu biblioteki (klucz = identyfikator elementu). */
export function symbolZElementu(e: ElementOzdobny): DefinicjaSymbolu {
  return { kontury: e.kontury, szer: e.szer, wys: e.wys };
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
): WynikNarozniki {
  const e = znajdzElement(n.element);
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
