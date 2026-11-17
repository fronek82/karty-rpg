import type { Mm } from '../model/jednostki';
import type { OzdobaMotyw } from '../model/szablon';
import type { DefinicjaSymbolu, ElementSceny, Macierz } from '../silnik/scena';
import { znajdzElement } from './katalog';
import { macierzeNarozniki, type WynikNarozniki } from './narozniki';
import type { ElementOzdobny } from './typy';

/** Klucz symbolu kostki narożnej motywu w słowniku symboli sceny. */
export const kluczKostki = (id: string) => `${id}:kostka`;

export interface RozlozenieKafelkow {
  /** Liczba kafelków na odcinku (0, gdy odcinek ma zerową długość). */
  n: number;
  /** Rzeczywisty krok (szerokość kafelka po rozciągnięciu) w mm: `dlugosc / n`. */
  krok: Mm;
  /** Nominalna szerokość kafelka przy proporcjach rysunku: `pas · szer / wys`. */
  nominalna: Mm;
}

/**
 * Równe rozłożenie kafelków wzdłuż odcinka: `n = max(1, round(L / k))`, gdzie `k` to nominalna
 * szerokość kafelka (pas · szer / wys); każdy kafelek rozciągnięty do `L / n`, więc motyw
 * pasuje do dowolnej długości, a zmiana proporcji kafelka to najwyżej ±1/(2n).
 */
export function rozlozKafelki(
  dlugosc: Mm,
  pas: Mm,
  e: Pick<ElementOzdobny, 'szer' | 'wys'>,
): RozlozenieKafelkow {
  const nominalna = (pas * e.szer) / e.wys;
  if (!(dlugosc > 1e-9) || !(nominalna > 0)) return { n: 0, krok: 0, nominalna };
  const n = Math.max(1, Math.round(dlugosc / nominalna));
  return { n, krok: dlugosc / n, nominalna };
}

type Obszar = { x: Mm; y: Mm; szer: Mm; wys: Mm };

/**
 * Macierze kafelków czterech boków. Kafelek patrzy na zewnątrz: rysunek ma zewnętrzną krawędź
 * przy `y = 0`; kolejne boki to obroty o 90° zgodnie z ruchem wskazówek zegara (góra, prawy,
 * dół, lewy). Boki biegną między kwadratami narożnymi `pas` × `pas`.
 */
export function macierzeBokow(
  e: Pick<ElementOzdobny, 'szer' | 'wys'>,
  obszar: Obszar,
  pas: Mm,
): Macierz[] {
  const { x, y, szer, wys } = obszar;
  const sv = pas / e.wys;
  const wynik: Macierz[] = [];
  const poziomo = rozlozKafelki(szer - 2 * pas, pas, e);
  const pionowo = rozlozKafelki(wys - 2 * pas, pas, e);
  // Góra: wzdłuż +X.
  for (let i = 0; i < poziomo.n; i++)
    wynik.push([poziomo.krok / e.szer, 0, 0, sv, x + pas + i * poziomo.krok, y]);
  // Prawy: wzdłuż +Y, głębia w −X.
  for (let i = 0; i < pionowo.n; i++)
    wynik.push([0, pionowo.krok / e.szer, -sv, 0, x + szer, y + pas + i * pionowo.krok]);
  // Dół: wzdłuż −X, głębia w −Y.
  for (let i = 0; i < poziomo.n; i++)
    wynik.push([-poziomo.krok / e.szer, 0, 0, -sv, x + szer - pas - i * poziomo.krok, y + wys]);
  // Lewy: wzdłuż −Y, głębia w +X.
  for (let i = 0; i < pionowo.n; i++)
    wynik.push([0, -pionowo.krok / e.szer, sv, 0, x, y + wys - pas - i * pionowo.krok]);
  return wynik;
}

export interface WynikOzdoby extends WynikNarozniki {
  /** Pas po ograniczeniu do połowy krótszego boku (mm). */
  pas: Mm;
}

/**
 * Ramka z motywu na `obszar`: kafelki na czterech bokach, w rogach kostki narożne motywu
 * (chyba że ramka ma własne narożniki – wtedy rysuje je ten, kto wywołał, a kostek nie ma),
 * opcjonalnie szyny po obu stronach pasa. Pas ograniczony do połowy krótszego boku.
 * Kolejność elementów: kafelki, kostki, szyny. Nieznany motyw: pusty wynik z `nieznany`.
 */
export function ramkaZMotywu(
  o: OzdobaMotyw,
  obszar: Obszar,
  opcje: { bezKostek?: boolean } = {},
): WynikOzdoby {
  const e = znajdzElement(o.element);
  if (!e || e.rodzaj !== 'motyw') return { elementy: [], symbole: {}, nieznany: o.element, pas: 0 };
  const pas = Math.min(o.szerokosc, obszar.szer / 2, obszar.wys / 2);
  if (!(pas > 0)) return { elementy: [], symbole: {}, pas: 0 };
  const elementy: ElementSceny[] = [];
  const symbole: Record<string, DefinicjaSymbolu> = {
    [e.id]: { kontury: e.kontury, szer: e.szer, wys: e.wys },
  };
  for (const macierz of macierzeBokow(e, obszar, pas))
    elementy.push({ typ: 'symbol', klucz: e.id, macierz, kolor: o.kolor });
  if (!opcje.bezKostek) {
    if (e.kostka) {
      const klucz = kluczKostki(e.id);
      symbole[klucz] = { kontury: e.kostka, szer: e.wys, wys: e.wys };
      for (const macierz of macierzeNarozniki({ szer: e.wys, wys: e.wys }, obszar, pas))
        elementy.push({ typ: 'symbol', klucz, macierz, kolor: o.kolor });
    } else {
      // Motyw bez kostki: róg to kwadrat pasa z obrysem.
      for (const m of macierzeNarozniki({ szer: 1, wys: 1 }, obszar, pas))
        elementy.push({
          typ: 'prostokat',
          x: Math.min(m[4], m[4] + m[0]),
          y: Math.min(m[5], m[5] + m[3]),
          szer: pas,
          wys: pas,
          obrys: { kolor: o.kolor, grubosc: Math.max(0.1, o.szyny ?? 0.2) },
        });
    }
  }
  if (o.szyny && o.szyny > 0) {
    const g = o.szyny;
    const obrys = { kolor: o.kolor, grubosc: g };
    const { x, y, szer, wys } = obszar;
    elementy.push({
      typ: 'prostokat',
      x: x + g / 2,
      y: y + g / 2,
      szer: szer - g,
      wys: wys - g,
      obrys,
    });
    const w = pas - g / 2;
    if (szer - 2 * w > 0 && wys - 2 * w > 0)
      elementy.push({
        typ: 'prostokat',
        x: x + w,
        y: y + w,
        szer: szer - 2 * w,
        wys: wys - 2 * w,
        obrys,
      });
  }
  return { elementy, symbole, pas };
}
