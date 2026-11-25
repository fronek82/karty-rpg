/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pt } from '../../model/jednostki';
import type { Szablon } from '../../model/szablon';
import type { ElementSceny, Scena } from '../scena';
import { RejestrCzcionek, wczytajCzcionke } from '../czcionki';

const KATALOG = fileURLToPath(new URL('../../../public/czcionki/', import.meta.url));

export function czcionkaTestowa(plik: string) {
  return wczytajCzcionke(plik, new Uint8Array(readFileSync(KATALOG + plik)));
}

/** Rejestr z czcionkami OFL projektu i rolami jak w pakiecie Mausrittera. */
export function rejestrTestowy(): RejestrCzcionek {
  return new RejestrCzcionek()
    .dodaj('EB Garamond', 'normalny', czcionkaTestowa('EBGaramond-Regular.ttf'))
    .dodaj('EB Garamond', 'pogrubiony', czcionkaTestowa('EBGaramond-Bold.ttf'))
    .dodaj('EB Garamond', 'kursywa', czcionkaTestowa('EBGaramond-Italic.ttf'))
    .dodaj('EB Garamond', 'pogrubiona-kursywa', czcionkaTestowa('EBGaramond-BoldItalic.ttf'))
    .dodaj('Grenze Gotisch', 'normalny', czcionkaTestowa('GrenzeGotisch-Regular.ttf'))
    .dodaj('Grenze Gotisch', 'pogrubiony', czcionkaTestowa('GrenzeGotisch-Bold.ttf'))
    .przypiszRole('tytul', 'Grenze Gotisch')
    .przypiszRole('tresc', 'EB Garamond');
}

const SLOT = 25.75;
const czarna = { grubosc: 0.25, kolor: '#000000' };

/** Szablon testowy w stylu karty broni 1×1 (bez grafik i tekstów z materiałów komercyjnych). */
export const szablonBroni: Szablon = {
  id: 'test-bron',
  nazwa: 'Broń (test)',
  rozmiar: { tryb: 'sloty', slot: { szerokosc: SLOT, wysokosc: SLOT }, kolumny: 1, rzedy: 1 },
  tlo: '#ffffff',
  korzen: {
    id: 'korzen',
    typ: 'kolumna',
    dzieci: [
      {
        id: 'naglowek',
        typ: 'tekst',
        klucz: 'nazwa',
        wysokosc: { mm: 6.7 },
        padding: { lewo: 1.2, prawo: 1.2, gora: 0.8 },
        wieleWierszy: false,
        obramowanie: { ...czarna, krawedzie: { dol: true } },
        styl: {
          czcionka: 'tytul',
          wariant: 'pogrubiony',
          rozmiar: pt(9),
          minRozmiar: pt(6),
          wyrownaniePionowe: 'srodek',
        },
      },
      {
        id: 'tresc',
        typ: 'warstwy',
        wysokosc: { wypelnij: 1 },
        padding: 1.2,
        dzieci: [
          {
            id: 'obraz',
            typ: 'obraz',
            klucz: 'obraz',
            dopasowanie: 'dopasuj',
            margines: { gora: 2, dol: 2 },
          },
          {
            id: 'uzycia',
            typ: 'znaczniki',
            klucz: 'uzycia',
            kolumny: 3,
            rzedy: 1,
            ksztalt: 'kolo',
            srednica: 2.6,
            odstep: 0.4,
            grubosc: 0.2,
            wyrownanie: { poziomo: 'poczatek', pionowo: 'poczatek' },
          },
          {
            id: 'obrazenia',
            typ: 'wartosc',
            klucz: 'obrazenia',
            ksztalt: 'prostokat',
            gdyPuste: 'ukryj',
            padding: { lewo: 1, prawo: 1, gora: 0.5, dol: 0.5 },
            obramowanie: czarna,
            wyrownanie: { poziomo: 'koniec', pionowo: 'poczatek' },
            styl: { czcionka: 'tresc', wariant: 'pogrubiony', rozmiar: pt(9) },
          },
          {
            id: 'klasa',
            typ: 'tekst',
            klucz: 'klasa',
            wyrownanie: { poziomo: 'poczatek', pionowo: 'koniec' },
            styl: { czcionka: 'tresc', wariant: 'pogrubiony', rozmiar: pt(6) },
          },
        ],
      },
    ],
  },
};

/** Elementy karty bez grupy przycięcia do zaokrąglonych rogów (karta z `promienRogow`). */
export function zawartoscKarty(scena: Scena): ElementSceny[] {
  const [g, ...reszta] = scena.elementy;
  return g?.typ === 'grupa' && g.przyciecieKonturem && reszta.length === 0
    ? g.elementy
    : scena.elementy;
}
