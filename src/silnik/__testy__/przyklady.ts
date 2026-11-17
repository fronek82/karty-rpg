import { pt } from '../../model/jednostki';
import type { StylTekstu, Szablon } from '../../model/szablon';

/**
 * Szablony testowe w układzie trzech przykładów z planu M2 (karta czaru, blok statystyk, karta
 * wroga) – zbudowane w kodzie, żeby sprawdzić klocki silnika. Treści są własne i neutralne.
 * W M2-5 te same układy będą budowane wyłącznie przez interfejs edytora.
 */

const tresc = (rozmiar: number, reszta: Partial<StylTekstu> = {}): StylTekstu => ({
  czcionka: 'tresc',
  rozmiar: pt(rozmiar),
  ...reszta,
});

const CZERWONY = '#b8322a';
const BIALY = '#ffffff';

const komorka = (id: string, etykieta: string) => ({
  id,
  typ: 'tekst' as const,
  klucz: id,
  szerokosc: { wypelnij: 1 },
  padding: 0.8,
  tlo: BIALY,
  styl: tresc(8, { wyrownanie: 'srodek' }),
  etykieta: {
    tekst: etykieta,
    pozycja: 'nad' as const,
    styl: { czcionka: 'tresc', rozmiar: pt(5.5), wariant: 'pogrubiony' as const, kolor: CZERWONY },
  },
});

/** A. Karta czaru: kolorowa karta, białe panele, siatka 2×2 etykieta/wartość, stopka. */
export const szablonCzaru: Szablon = {
  id: 'test-czar',
  nazwa: 'Czar (test)',
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
  promienRogow: 3,
  tlo: CZERWONY,
  ramka: { grubosc: 0.3, kolor: BIALY, odsuniecie: 1 },
  korzen: {
    id: 'korzen',
    typ: 'kolumna',
    padding: 2.5,
    odstep: 1.5,
    dzieci: [
      {
        id: 'nazwa',
        typ: 'tekst',
        klucz: 'nazwa',
        wieleWierszy: false,
        styl: tresc(13, { wariant: 'pogrubiony', kolor: BIALY, wyrownanie: 'srodek' }),
      },
      {
        id: 'siatka',
        typ: 'kolumna',
        odstep: 0.4,
        tlo: CZERWONY,
        promien: 1.5,
        dzieci: [
          {
            id: 'w1',
            typ: 'wiersz',
            odstep: 0.4,
            dzieci: [komorka('czas', 'CZAS RZUCANIA'), komorka('zasieg', 'ZASIĘG')],
          },
          {
            id: 'w2',
            typ: 'wiersz',
            odstep: 0.4,
            dzieci: [komorka('komponenty', 'KOMPONENTY'), komorka('trwanie', 'CZAS TRWANIA')],
          },
        ],
      },
      {
        id: 'opis',
        typ: 'tekst',
        klucz: 'opis',
        wysokosc: { wypelnij: 1 },
        padding: 2,
        tlo: BIALY,
        promien: 1.5,
        styl: tresc(7.5, { wyrownanie: 'justuj', minRozmiar: pt(5), odstepAkapitow: 1 }),
      },
      {
        id: 'stopka',
        typ: 'wiersz',
        rozklad: 'miedzy',
        dzieci: [
          {
            id: 'klasa',
            typ: 'tekst',
            klucz: 'klasa',
            wieleWierszy: false,
            styl: tresc(7, { wariant: 'kursywa', kolor: BIALY }),
          },
          {
            id: 'szkola',
            typ: 'tekst',
            klucz: 'szkola',
            wieleWierszy: false,
            styl: tresc(7, { wariant: 'kursywa', kolor: BIALY }),
          },
        ],
      },
    ],
  },
};

export const daneCzaru = {
  nazwa: 'Ognista kula',
  czas: '1 akcja',
  zasieg: '40 m',
  komponenty: 'W, S',
  trwanie: 'natychmiast',
  opis: 'Płomień wylatuje z dłoni i wybucha w wybranym miejscu. Istoty w pobliżu wykonują rzut obronny. **Porażka:** pełne obrażenia od ognia. **Sukces:** połowa obrażeń.\n***Wyżej.*** Obrażenia rosną z poziomem czaru.',
  klasa: 'Mag',
  szkola: 'Wywoływanie',
};

const CECHY = ['Sz', 'WW', 'US', 'S', 'Wt', 'I', 'Zw', 'Zr', 'Int', 'SW', 'Ogd', 'Żyw'];

/** B. Blok statystyk: tytuł kapitalikami, tabela cech, separator, akapity wyjustowane. */
export const szablonStatystyk: Szablon = {
  id: 'test-statystyki',
  nazwa: 'Blok statystyk (test)',
  rozmiar: { tryb: 'mm', szerokosc: 88, wysokosc: 63 },
  tlo: '#f3ead2',
  ramka: { grubosc: 0.4, kolor: '#5a4630' },
  korzen: {
    id: 'korzen',
    typ: 'kolumna',
    padding: 3,
    odstep: 1,
    dzieci: [
      {
        id: 'nazwa',
        typ: 'tekst',
        klucz: 'nazwa',
        wieleWierszy: false,
        styl: tresc(12, { wariant: 'pogrubiony', kapitaliki: true, wyrownanie: 'srodek' }),
      },
      {
        id: 'cechy',
        typ: 'tabela',
        kolumny: CECHY.map((c) => ({ naglowek: c, klucz: `cecha_${c.toLowerCase()}` })),
        styl: tresc(7),
        tloNaglowka: '#e2d3ae',
        linie: { grubosc: 0.2, kolor: '#5a4630' },
        paddingKomorki: 0.5,
      },
      { id: 'kreska', typ: 'separator', kierunek: 'poziomy', grubosc: 0.3, kolor: '#5a4630' },
      {
        id: 'opis',
        typ: 'tekst',
        klucz: 'opis',
        wysokosc: { wypelnij: 1 },
        styl: tresc(7, { wyrownanie: 'justuj', wciecie: 2, minRozmiar: pt(5) }),
      },
    ],
  },
};

export const daneStatystyk: Record<string, string> = {
  nazwa: 'Strażnik bramy',
  ...Object.fromEntries(
    CECHY.map((c, i) => [
      `cecha_${c.toLowerCase()}`,
      String([4, 35, 30, 3, 3, 30, 1, 30, 25, 30, 25, 9][i]),
    ]),
  ),
  opis: '**Umiejętności:** Spostrzegawczość, Zastraszanie, Broń biała.\n**Ekwipunek:** halabarda, latarnia, pęk kluczy. ***Stary Wilk*** zna każdego, kto przechodzi przez bramę, i nikomu nie ufa.',
};

const ROMB = '#9b1c1c';
const wartoscWRombie = (id: string, etykieta: string) => ({
  id,
  typ: 'wartosc' as const,
  klucz: id,
  ksztalt: 'romb' as const,
  // Stała szerokość – romby równe niezależnie od długości liczby; wysokość = etykieta + romb.
  szerokosc: { mm: 11 },
  minWysokosc: 12,
  obramowanie: { grubosc: 0.35, kolor: ROMB },
  styl: tresc(9, { wariant: 'pogrubiony' }),
  etykieta: {
    tekst: etykieta,
    pozycja: 'nad' as const,
    styl: { czcionka: 'tresc', rozmiar: pt(4.5), wariant: 'pogrubiony' as const, kolor: ROMB },
  },
});

/** C. Karta wroga: zagnieżdżony nagłówek, wartości w rombach z etykietą, zwijanie pustych pól. */
export const szablonWroga: Szablon = {
  id: 'test-wrog',
  nazwa: 'Wróg (test)',
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
  tlo: '#fbf7ee',
  korzen: {
    id: 'korzen',
    typ: 'kolumna',
    padding: 3,
    odstep: 1.5,
    dzieci: [
      {
        id: 'naglowek',
        typ: 'wiersz',
        odstep: 1,
        dzieci: [
          {
            id: 'tytul',
            typ: 'kolumna',
            szerokosc: { wypelnij: 1 },
            dzieci: [
              {
                id: 'nazwa',
                typ: 'tekst',
                klucz: 'nazwa',
                styl: tresc(11, { wariant: 'pogrubiony', wielkieLitery: true }),
              },
              {
                id: 'cechy',
                typ: 'tekst',
                klucz: 'cechy',
                styl: tresc(7, { wariant: 'kursywa' }),
              },
            ],
          },
          wartoscWRombie('poziom', 'POZIOM'),
        ],
      },
      {
        id: 'statystyki',
        typ: 'wiersz',
        rozklad: 'miedzy',
        dzieci: [
          wartoscWRombie('wytrzymalosc', 'WYTRZYMAŁOŚĆ'),
          wartoscWRombie('sila', 'SIŁA'),
          wartoscWRombie('zbroja', 'ZBROJA'),
          wartoscWRombie('nienawisc', 'NIENAWIŚĆ'),
        ],
      },
      { id: 'kreska', typ: 'separator', kierunek: 'poziomy', grubosc: 0.3, kolor: ROMB },
      {
        id: 'bron',
        typ: 'tekst',
        klucz: 'bron',
        gdyPuste: 'ukryj',
        styl: tresc(7),
        etykieta: { tekst: 'Broń:', pozycja: 'przed', styl: { wariant: 'pogrubiony' } },
      },
      {
        id: 'zdolnosci',
        typ: 'tekst',
        klucz: 'zdolnosci',
        gdyPuste: 'ukryj',
        styl: tresc(7),
        etykieta: { tekst: 'Zdolności:', pozycja: 'przed', styl: { wariant: 'pogrubiony' } },
      },
      {
        id: 'opis',
        typ: 'tekst',
        klucz: 'opis',
        gdyPuste: 'ukryj',
        styl: tresc(7, { wariant: 'kursywa' }),
      },
    ],
  },
};

export const daneWroga = {
  nazwa: 'Wilk z gór',
  cechy: 'Szybki, czujny',
  poziom: '3',
  wytrzymalosc: '14',
  sila: '4',
  zbroja: '2',
  nienawisc: '3',
  bron: 'Kły (5), Pazury (3)',
  zdolnosci: '**Zgraja.** Atakuje razem z innymi.',
};
