import type { Mm } from '../model/jednostki';
import type { Kolor, OzdobaMotyw } from '../model/szablon';
import type { DefinicjaSymbolu, ElementSceny, Macierz } from '../silnik/scena';
import { konturProstokata } from '../silnik/konturyFigur';
import { znajdzElement } from './katalog';
import { maCiaglyNaroznik, powiekszCiaglyNaroznik } from './noweMotywy';
import { macierzeNarozniki, symbolZElementu, type WynikNarozniki } from './narozniki';
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
  bokRogu: Mm = pas,
): Macierz[] {
  const { x, y, szer, wys } = obszar;
  const sv = pas / e.wys;
  const wynik: Macierz[] = [];
  const poziomo = rozlozKafelki(szer - 2 * bokRogu, pas, e);
  const pionowo = rozlozKafelki(wys - 2 * bokRogu, pas, e);
  // Góra: wzdłuż +X.
  for (let i = 0; i < poziomo.n; i++)
    wynik.push([poziomo.krok / e.szer, 0, 0, sv, x + bokRogu + i * poziomo.krok, y]);
  // Prawy: wzdłuż +Y, głębia w −X.
  for (let i = 0; i < pionowo.n; i++)
    wynik.push([0, pionowo.krok / e.szer, -sv, 0, x + szer, y + bokRogu + i * pionowo.krok]);
  // Dół: wzdłuż −X, głębia w −Y.
  for (let i = 0; i < poziomo.n; i++)
    wynik.push([-poziomo.krok / e.szer, 0, 0, -sv, x + szer - bokRogu - i * poziomo.krok, y + wys]);
  // Lewy: wzdłuż −Y, głębia w +X.
  for (let i = 0; i < pionowo.n; i++)
    wynik.push([0, -pionowo.krok / e.szer, sv, 0, x, y + wys - bokRogu - i * pionowo.krok]);
  return wynik;
}

/** Kafelki styczne do zamkniętej linii środka zaokrąglonej ramki. */
export function macierzeLuku(
  e: Pick<ElementOzdobny, 'szer' | 'wys'>,
  obszar: Obszar,
  pas: Mm,
  promien: Mm,
): Macierz[] {
  const x = obszar.x + pas / 2;
  const y = obszar.y + pas / 2;
  const szer = obszar.szer - pas;
  const wys = obszar.wys - pas;
  const r = Math.max(0, Math.min(promien - pas / 2, szer / 2, wys / 2));
  if (!r) return macierzeBokow(e, obszar, pas);

  type Punkt = { x: number; y: number; kat: number };
  const bok = (px: number, py: number, dlugosc: number, kat: number) => ({
    dlugosc,
    punkt: (d: number): Punkt => ({ x: px + d * Math.cos(kat), y: py + d * Math.sin(kat), kat }),
  });
  const luk = (cx: number, cy: number, od: number) => ({
    dlugosc: (r * Math.PI) / 2,
    punkt: (d: number): Punkt => {
      const a = od + d / r;
      return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), kat: a + Math.PI / 2 };
    },
  });
  const drogi = [
    bok(x + r, y, szer - 2 * r, 0),
    luk(x + szer - r, y + r, -Math.PI / 2),
    bok(x + szer, y + r, wys - 2 * r, Math.PI / 2),
    luk(x + szer - r, y + wys - r, 0),
    bok(x + szer - r, y + wys, szer - 2 * r, Math.PI),
    luk(x + r, y + wys - r, Math.PI / 2),
    bok(x, y + wys - r, wys - 2 * r, Math.PI * 1.5),
    luk(x + r, y + r, Math.PI),
  ];
  const L = drogi.reduce((suma, d) => suma + d.dlugosc, 0);
  const nominalna = Math.min((pas * e.szer) / e.wys, Math.max(pas, r / 2));
  const n = Math.min(512, Math.max(1, Math.round(L / nominalna)));
  const krok = L / n;
  const sx = krok / e.szer;
  const sy = pas / e.wys;
  const wynik: Macierz[] = [];
  for (let i = 0, j = 0, od = 0; i < n; i++) {
    const d = (i + 0.5) * krok;
    while (j < drogi.length - 1 && od + drogi[j]!.dlugosc < d) od += drogi[j++]!.dlugosc;
    const p = drogi[j]!.punkt(d - od);
    const c = Math.cos(p.kat);
    const s = Math.sin(p.kat);
    wynik.push([
      sx * c,
      sx * s,
      -sy * s,
      sy * c,
      p.x - (krok / 2) * c + (pas / 2) * s,
      p.y - (krok / 2) * s - (pas / 2) * c,
    ]);
  }
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
  opcje: {
    bezKostek?: boolean;
    kolorKostki?: Kolor;
    wlasne?: readonly ElementOzdobny[];
    promien?: Mm;
  } = {},
): WynikOzdoby {
  const e = znajdzElement(o.element, opcje.wlasne);
  if (!e || e.rodzaj !== 'motyw') return { elementy: [], symbole: {}, nieznany: o.element, pas: 0 };
  const pas = Math.min(o.szerokosc, obszar.szer / 2, obszar.wys / 2);
  if (!(pas > 0)) return { elementy: [], symbole: {}, pas: 0 };
  const elementy: ElementSceny[] = [];
  const symbole: Record<string, DefinicjaSymbolu> = {
    [e.id]: symbolZElementu(e),
  };
  const promien = opcje.promien ?? 0;
  const ciaglyNaroznik = maCiaglyNaroznik(e.id);
  const bokRogu = ciaglyNaroznik
    ? Math.min(Math.max(pas, promien), obszar.szer / 2, obszar.wys / 2)
    : pas;
  const luk = o.poLuku && !ciaglyNaroznik && promien > pas / 2;
  const macierze = luk
    ? macierzeLuku(e, obszar, pas, promien)
    : macierzeBokow(e, obszar, pas, bokRogu);
  for (const macierz of macierze)
    elementy.push({ typ: 'symbol', klucz: e.id, macierz, kolor: o.kolor });
  if ((ciaglyNaroznik || !opcje.bezKostek) && !luk) {
    if (e.kostka) {
      // Łuk może być większy niż pas. Powiększamy promień, zachowując rozstaw kresek.
      const powiekszony = bokRogu > pas;
      const bok = powiekszony ? (bokRogu / pas) * e.wys : e.wys;
      const klucz = kluczKostki(powiekszony ? `${e.id}:${bok}` : e.id);
      const pole = { szer: bok, wys: bok };
      const kontury = powiekszony ? powiekszCiaglyNaroznik(e.id, bok) : e.kostka;
      symbole[klucz] = symbolZElementu({ ...e, ...pole, kontury });
      for (const macierz of macierzeNarozniki(pole, obszar, bokRogu))
        elementy.push({ typ: 'symbol', klucz, macierz, kolor: opcje.kolorKostki ?? o.kolor });
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
    // Szyna nie grubsza niż pas – inaczej wymiary prostokątów wyszłyby ujemne.
    const g = Math.min(o.szyny, pas);
    const obrys = { kolor: o.kolor, grubosc: g };
    const { x, y, szer, wys } = obszar;
    const promienSzyn = ciaglyNaroznik ? bokRogu : luk ? promien : 0;
    elementy.push({
      typ: 'prostokat',
      x: x + g / 2,
      y: y + g / 2,
      szer: Math.max(0, szer - g),
      wys: Math.max(0, wys - g),
      ...(promienSzyn ? { promien: Math.max(0, promienSzyn - g / 2) } : {}),
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
        ...(promienSzyn ? { promien: Math.max(0, promienSzyn - w) } : {}),
        obrys,
      });
  }
  if (!luk) return { elementy, symbole, pas };
  return {
    elementy: [
      {
        typ: 'grupa',
        x: 0,
        y: 0,
        przyciecieKonturem: konturProstokata(obszar.x, obszar.y, obszar.szer, obszar.wys, promien),
        elementy,
      },
    ],
    symbole,
    pas,
  };
}
