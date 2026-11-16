import { pt, type Mm } from '../../model/jednostki';
import type { Arkusz, PrzypietaKarta, UstawieniaArkusza } from '../../model/arkusz';
import { SLOT } from './szablony';
import { taliaBroni, taliaStanow, taliaWyposazenia } from './talie';

/**
 * Arkusze A4 poziomo jak w referencji. Położenie siatki zmierzone wektorowo z PDF (linie cięcia)
 * i przeliczone z drukowanego slotu 25,725 mm na projektowy 25,75 mm (skala 25,75 / 25,725).
 */

const SKALA_REFERENCJI = SLOT / 25.725;
const zReferencji = (x: Mm, y: Mm) => ({
  x: Math.round(x * SKALA_REFERENCJI * 1000) / 1000,
  y: Math.round(y * SKALA_REFERENCJI * 1000) / 1000,
});

const KOLOR = '#231f20';

const wspolne: Omit<UstawieniaArkusza, 'tytul' | 'poczatekSiatki'> = {
  papier: 'A4',
  orientacja: 'pozioma',
  marginesy: { gora: 8, prawo: 8, dol: 8, lewo: 8 },
  // Linie cięcia jak w oryginale: 0,75 pt, kreska 2,3 mm, przerwa 1,55 mm.
  linie: { grubosc: pt(0.75), kolor: KOLOR, kreska: 2.296, przerwa: 1.546 },
};

const stylTytulu = {
  czcionka: 'tytul',
  wariant: 'pogrubiony' as const,
  rozmiar: pt(32),
  kolor: KOLOR,
};
/**
 * Tytuł pionowy: jak w referencji – dłuższy tytuł sięga prawie całej wysokości siatki
 * (zmniejszany automatycznie, żeby kończył się pod nożyczkami), krótszy ma ten sam rozmiar.
 */
const stylTytuluPionowego = { ...stylTytulu, rozmiar: pt(36) };
/** Nożyczki na końcu przerywanej linii prowadzącej do drugiej poziomej linii cięcia. */
const NOZYCZKI_Z_BOKU = {
  linia: 'pozioma',
  indeks: 1,
  strona: 'poczatek',
  rozmiar: 5.5,
  odstep: 7,
} as const;

/** Układ w zapisie „karta: [kolumna, rząd], …” – każda para to jeden egzemplarz. */
function przypnij(uklad: Record<string, [number, number][]>): PrzypietaKarta[] {
  return Object.entries(uklad).flatMap(([kartaId, pozycje]) =>
    pozycje.map(([kolumna, rzad]) => ({ kartaId, kolumna, rzad })),
  );
}

export const arkuszBroni: Arkusz = {
  id: 'mausritter-arkusz-bron',
  nazwa: 'Karty broni i pancerzy',
  taliaId: taliaBroni.id,
  ustawienia: {
    ...wspolne,
    tytul: {
      tekst: 'Karty broni i pancerzy',
      polozenie: 'lewo',
      styl: stylTytuluPionowego,
      odstep: 1.3,
    },
    poczatekSiatki: zReferencji(26.67, 12.81),
    nozyczki: NOZYCZKI_Z_BOKU,
  },
  przypiete: przypnij({
    'bron-improwizowana': [
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ],
    'amunicja-kamienie': [
      [4, 0],
      [5, 0],
      [5, 1],
    ],
    'zbroja-ciezka': [
      [6, 0],
      [7, 0],
      [6, 3],
    ],
    'zbroja-lekka': [
      [8, 0],
      [8, 1],
      [6, 2],
      [8, 2],
    ],
    'bron-igla': [
      [0, 1],
      [0, 2],
      [1, 2],
    ],
    'bron-sztylet': [
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    'bron-pusta-lekka': [
      [3, 1],
      [3, 2],
    ],
    'amunicja-strzaly': [
      [4, 1],
      [4, 2],
      [5, 2],
    ],
    'bron-topor': [
      [0, 3],
      [0, 4],
    ],
    'bron-miecz': [
      [1, 3],
      [1, 4],
    ],
    'bron-kiscien': [
      [2, 3],
      [2, 4],
    ],
    'bron-pusta-srednia': [
      [3, 3],
      [3, 4],
    ],
    'bron-pusta-ciezka': [
      [4, 3],
      [5, 3],
    ],
    'bron-proca': [
      [7, 3],
      [8, 3],
      [9, 3],
    ],
    'bron-pusta-lekka-dystansowa': [
      [7, 4],
      [8, 4],
      [9, 4],
    ],
    'bron-mlot-bojowy': [
      [0, 5],
      [3, 5],
    ],
    'bron-wlocznia': [
      [1, 5],
      [4, 5],
    ],
    'bron-hak': [
      [2, 5],
      [5, 5],
    ],
    'bron-pusta-ciezka-dystansowa': [[6, 5]],
    'bron-luk': [
      [7, 5],
      [8, 5],
      [9, 5],
    ],
  }),
};

const wiersze = (od: number, do_: number, kolumny: number[]) =>
  kolumny.flatMap((k) =>
    Array.from({ length: do_ - od + 1 }, (_, i) => [k, od + i] as [number, number]),
  );

export const arkuszWyposazenia: Arkusz = {
  id: 'mausritter-arkusz-wyposazenie',
  nazwa: 'Karty niezbędnego wyposażenia',
  taliaId: taliaWyposazenia.id,
  ustawienia: {
    ...wspolne,
    tytul: {
      tekst: 'Karty niezbędnego wyposażenia',
      polozenie: 'lewo',
      styl: stylTytuluPionowego,
      odstep: 1.3,
    },
    poczatekSiatki: zReferencji(26.67, 12.81),
    nozyczki: NOZYCZKI_Z_BOKU,
  },
  przypiete: przypnij({
    'przedmiot-pochodnie': [...wiersze(0, 3, [0]), ...wiersze(4, 6, [0, 1])],
    'przedmiot-latarnia': wiersze(0, 3, [1]),
    'przedmiot-latarnia-elektryczna': wiersze(0, 3, [2]),
    sakiewka: wiersze(0, 3, [3, 4]),
    'przedmiot-prowiant': wiersze(0, 3, [5, 6]),
    zaklecie: wiersze(4, 6, [2, 3, 4]),
    'pusta-1x1': [...wiersze(0, 2, [7, 8, 9]), [7, 3], ...wiersze(4, 6, [5, 6, 7])],
    'pusta-2x1': [[8, 3], ...wiersze(4, 6, [8])],
  }),
};

/** Stany: grupy z nagłówkiem i opisem, rozmieszczenie automatyczne (kolumna po kolumnie). */
export const arkuszStanow: Arkusz = {
  id: 'mausritter-arkusz-stany',
  nazwa: 'Karty stanów',
  taliaId: taliaStanow.id,
  ustawienia: {
    ...wspolne,
    tytul: { tekst: 'Karty stanów', polozenie: 'gora', styl: stylTytulu, odstep: 0 },
    grupy: {
      styl: { czcionka: 'tytul', wariant: 'pogrubiony', rozmiar: pt(13), kolor: KOLOR },
      stylOpisu: { czcionka: 'tresc', rozmiar: pt(9), kolor: KOLOR },
      // Odstępy w referencji wahają się (2,81–2,96 mm) – średnia z całej szerokości siatki.
      odstep: Math.round(((284.24 - 12.53 - 10 * 25.725) / 5) * SKALA_REFERENCJI * 1000) / 1000,
      // Co najmniej 2 mm od dołu liter ostatniej linijki opisu do górnej linii cięcia kart
      // (odstęp liczony od dołu wiersza, z interlinią – stąd zapas).
      odstepOdKart: 2.5,
    },
    poczatekSiatki: zReferencji(12.53, 42.45),
    nozyczki: { linia: 'pionowa', indeks: 2, strona: 'koniec', rozmiar: 6, odstep: 1.5 },
  },
};

export const arkuszeMausrittera = [arkuszBroni, arkuszWyposazenia, arkuszStanow];
