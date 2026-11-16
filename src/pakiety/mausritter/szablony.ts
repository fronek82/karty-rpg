import { pt, type Mm } from '../../model/jednostki';
import type {
  Kontener,
  NapisSzablonu,
  Obramowanie,
  ParametrSzablonu,
  Pole,
  StylTekstu,
  Szablon,
} from '../../model/szablon';

/**
 * Szablony kart Mausrittera. Wymiary zmierzone z arkuszy referencyjnych (wektorowo, w mm);
 * w pakiecie są tylko układy – żadnych grafik ani tekstów z materiałów komercyjnych.
 */

/** Slot ekwipunku: 73 pt. */
export const SLOT: Mm = 25.75;
/** Linie na kartach: 0,5 pt w kolorze „bogatej czerni” z oryginału. */
const KOLOR = '#231f20';
const LINIA: Obramowanie = { grubosc: pt(0.5), kolor: KOLOR };

/** Odstępy wewnątrz karty od krawędzi (mm). */
const WCIECIE = { lewo: 1.29, prawo: 1.45, dol: 1.2 };
const POD_LINIA = 1.0;
const PASEK_TYTULU: Mm = 6.71;

const tytul: StylTekstu = {
  czcionka: 'tytul',
  wariant: 'pogrubiony',
  rozmiar: pt(10),
  minRozmiar: pt(7.5),
  kolor: KOLOR,
  wyrownaniePionowe: 'srodek',
};
const tresc = (rozmiar: number, wariant: StylTekstu['wariant'] = 'pogrubiony'): StylTekstu => ({
  czcionka: 'tresc',
  wariant,
  rozmiar: pt(rozmiar),
  kolor: KOLOR,
});

const rozmiarSlotow = (kolumny = 1, rzedy = 1) =>
  ({ tryb: 'sloty', slot: { szerokosc: SLOT, wysokosc: SLOT }, kolumny, rzedy }) as const;

/** Pasek tytułu z linią pod spodem; puste pole zostawia pusty pasek (karty do wypełnienia). */
function pasekTytulu(): Pole {
  return {
    id: 'nazwa',
    typ: 'tekst',
    klucz: 'nazwa',
    wysokosc: { mm: PASEK_TYTULU },
    margines: { lewo: 0.2, prawo: 0.2 },
    padding: { lewo: 1.05, prawo: 0.8, gora: 0.3 },
    wieleWierszy: false,
    obramowanie: { ...LINIA, krawedzie: { dol: true } },
    styl: tytul,
  };
}

/** Pasek tytułu z gwiazdką zamiast nazwy (zaklęcia). */
function pasekGwiazdki(): Kontener {
  return {
    id: 'pasek',
    typ: 'wiersz',
    wysokosc: { mm: PASEK_TYTULU },
    margines: { lewo: 0.2, prawo: 0.2 },
    padding: { lewo: 1.05 },
    obramowanie: { ...LINIA, krawedzie: { dol: true } },
    dzieci: [
      {
        id: 'gwiazdka',
        typ: 'ikona',
        ikona: 'gwiazdka',
        rozmiar: 3.2,
        kolor: KOLOR,
        wyrownanie: { pionowo: 'srodek' },
      },
    ],
  };
}

function znaczniki(): Pole {
  return {
    id: 'uzycia',
    typ: 'znaczniki',
    klucz: 'uzycia',
    kolumny: 3,
    rzedy: 1,
    ksztalt: 'kolo',
    // Średnica zewnętrzna (z grubością linii) i odstęp między kółkami jak w oryginale.
    srednica: 2.866,
    odstep: 0.514,
    grubosc: pt(0.5),
    kolor: KOLOR,
    margines: { gora: 0.08 },
    wyrownanie: { poziomo: 'poczatek', pionowo: 'poczatek' },
  };
}

/** Pole ilustracji – obraz wgrany przez użytkownika; w pakiecie obrazek zastępczy. */
function obraz(margines: { gora: Mm; dol: Mm }): Pole {
  return {
    id: 'obraz',
    typ: 'obraz',
    klucz: 'obraz',
    dopasowanie: 'dopasuj',
    margines: { ...margines, lewo: 0.5, prawo: 0.5 },
  };
}

function wartosc(ksztalt: 'prostokat' | 'sciety', rozmiar: number, tekst?: NapisSzablonu): Pole {
  return {
    id: 'wartosc',
    typ: 'wartosc',
    klucz: 'wartosc',
    tekst,
    ksztalt,
    promien: ksztalt === 'sciety' ? pt(3) : undefined,
    gdyPuste: 'ukryj',
    minSzerokosc: 6.87,
    minWysokosc: 6.87,
    padding: { lewo: 1.2, prawo: 1.2 },
    obramowanie: LINIA,
    tlo: '#ffffff',
    wyrownanie: { pionowo: 'poczatek' },
    styl: tresc(rozmiar),
  };
}

/** Klasa broni w lewym dolnym rogu, z białą obwódką – czytelna na tle ilustracji. */
function klasa(): Pole {
  return {
    id: 'klasa',
    typ: 'tekst',
    klucz: 'klasa',
    gdyPuste: 'ukryj',
    // Korekta z nakładki na referencję: dolna krawędź tekstu ~1,3 mm nad krawędzią karty.
    margines: { lewo: 0.3, dol: 0.4 },
    wieleWierszy: false,
    wyrownanie: { poziomo: 'poczatek', pionowo: 'koniec' },
    styl: { ...tresc(8), obwodka: { grubosc: 0.7, kolor: '#ffffff' } },
  };
}

const WNETRZE = { gora: POD_LINIA, ...WCIECIE };

/**
 * Broń i zbroja 1×1 i 2×1: po lewej znaczniki, pod nimi ilustracja; po prawej ramka wartości.
 * Ilustracja nigdy nie wchodzi pod ramkę. Klasa nałożona w lewym dolnym rogu (biała obwódka).
 */
function trescUzbrojenia(ramka: Pole, zKlasa: boolean): Kontener {
  return {
    id: 'tresc',
    typ: 'warstwy',
    wysokosc: { wypelnij: 1 },
    padding: WNETRZE,
    dzieci: [
      {
        id: 'uklad',
        typ: 'wiersz',
        odstep: 0.6,
        dzieci: [
          {
            id: 'lewa',
            typ: 'kolumna',
            szerokosc: { wypelnij: 1 },
            odstep: 0.5,
            dzieci: [
              { ...znaczniki(), wyrownanie: { poziomo: 'poczatek' } },
              { ...obraz({ gora: 0, dol: 0 }), wysokosc: { wypelnij: 1 } },
            ],
          },
          ramka,
        ],
      },
      ...(zKlasa ? [klasa()] : []),
    ],
  };
}

/** Wariant pionowy (1×2): rząd znaczników i ramki u góry, ilustracja na całą szerokość pod nim. */
function trescUzbrojeniaPionowa(ramka: Pole, zKlasa: boolean): Kontener {
  return {
    id: 'tresc',
    typ: 'warstwy',
    wysokosc: { wypelnij: 1 },
    padding: WNETRZE,
    dzieci: [
      {
        id: 'uklad',
        typ: 'kolumna',
        odstep: 0.8,
        dzieci: [
          { id: 'gora', typ: 'wiersz', rozklad: 'miedzy', dzieci: [znaczniki(), ramka] },
          { ...obraz({ gora: 0, dol: 0 }), wysokosc: { wypelnij: 1 } },
        ],
      },
      ...(zKlasa ? [klasa()] : []),
    ],
  };
}

const karta = (
  id: string,
  nazwa: string,
  kolumny: number,
  rzedy: number,
  dzieci: (Pole | Kontener)[],
  parametry?: ParametrSzablonu[],
  pionowa?: (Pole | Kontener)[],
): Szablon => ({
  id,
  nazwa,
  rozmiar: rozmiarSlotow(kolumny, rzedy),
  tlo: '#ffffff',
  ...(parametry ? { parametry } : {}),
  korzen: { id: 'korzen', typ: 'kolumna', dzieci },
  ...(pionowa
    ? {
        warianty: [
          { kolumny: 1, rzedy: 2, korzen: { id: 'korzen', typ: 'kolumna', dzieci: pionowa } },
        ],
      }
    : {}),
});

export const szablonBron = karta(
  'mausritter-bron',
  'Broń',
  1,
  1,
  [pasekTytulu(), trescUzbrojenia(wartosc('prostokat', 10), true)],
  undefined,
  [pasekTytulu(), trescUzbrojeniaPionowa(wartosc('prostokat', 10), true)],
);

export const szablonZbroja = karta(
  'mausritter-zbroja',
  'Zbroja',
  1,
  2,
  [pasekTytulu(), trescUzbrojenia(wartosc('sciety', 8.5, { parametr: 'obrona' }), false)],
  [{ klucz: 'obrona', nazwa: 'Obrona', domyslnie: '-1 obr' }],
  [pasekTytulu(), trescUzbrojeniaPionowa(wartosc('sciety', 8.5, { parametr: 'obrona' }), false)],
);

/** Przedmiot: znaczniki w lewym górnym rogu, ilustracja obok nich po prawej. */
export const szablonPrzedmiot = karta('mausritter-przedmiot', 'Przedmiot', 1, 1, [
  pasekTytulu(),
  {
    id: 'tresc',
    typ: 'wiersz',
    wysokosc: { wypelnij: 1 },
    padding: WNETRZE,
    odstep: 0.6,
    dzieci: [
      { ...znaczniki(), wyrownanie: { pionowo: 'poczatek' } },
      { ...obraz({ gora: 0, dol: 0 }), szerokosc: { wypelnij: 1 } },
    ],
  },
]);

export const szablonSakiewka = karta(
  'mausritter-sakiewka',
  'Sakiewka',
  1,
  1,
  [
    pasekTytulu(),
    {
      id: 'tresc',
      typ: 'kolumna',
      wysokosc: { wypelnij: 1 },
      padding: { gora: POD_LINIA, lewo: 1.63, prawo: 1.87, dol: 1.38 },
      odstep: 0.5,
      dzieci: [
        { ...obraz({ gora: 0, dol: 0 }), wysokosc: { wypelnij: 1 } },
        {
          id: 'zawartosc',
          typ: 'wpis',
          klucz: 'zawartosc',
          sufiks: { parametr: 'pojemnosc' },
          wysokosc: { mm: 6.36 },
          padding: { lewo: 1, prawo: 1.1 },
          obramowanie: LINIA,
          styl: tresc(9),
        },
      ],
    },
  ],
  [{ klucz: 'pojemnosc', nazwa: 'Pojemność', domyslnie: '/ 250p' }],
);

/** Zaklęcie: gwiazdka zamiast nazwy; ilustracja może nachodzić na znaczniki. */
export const szablonZaklecie = karta('mausritter-zaklecie', 'Zaklęcie', 1, 1, [
  pasekGwiazdki(),
  {
    id: 'tresc',
    typ: 'warstwy',
    wysokosc: { wypelnij: 1 },
    padding: WNETRZE,
    dzieci: [obraz({ gora: 0.5, dol: 0.5 }), znaczniki()],
  },
]);

export const szablonPusta = karta('mausritter-pusta', 'Pusta karta', 1, 1, [
  pasekTytulu(),
  {
    id: 'tresc',
    typ: 'warstwy',
    wysokosc: { wypelnij: 1 },
    padding: WNETRZE,
    dzieci: [znaczniki()],
  },
]);

const STAN_TRESC = 8;

/** Karta stanu: tytuł, skutek kursywą, na dole „Usunięcie:” z warunkiem. */
export const szablonStan: Szablon = {
  id: 'mausritter-stan',
  nazwa: 'Stan',
  rozmiar: rozmiarSlotow(1, 1),
  parametry: [{ klucz: 'etykietaUsuniecia', nazwa: 'Etykieta usunięcia', domyslnie: 'Usunięcie:' }],
  tlo: '#ffffff',
  korzen: {
    id: 'korzen',
    typ: 'kolumna',
    padding: { lewo: 1.34, prawo: 1.0, gora: 0.6, dol: 1.35 },
    dzieci: [
      {
        id: 'nazwa',
        typ: 'tekst',
        klucz: 'nazwa',
        wieleWierszy: false,
        wysokosc: { mm: 5.9 },
        styl: { ...tytul, rozmiar: pt(12), minRozmiar: pt(9), wyrownaniePionowe: 'srodek' },
      },
      {
        id: 'skutek',
        typ: 'tekst',
        klucz: 'skutek',
        wysokosc: { wypelnij: 1 },
        margines: { gora: 0.3 },
        styl: { ...tresc(STAN_TRESC, 'kursywa'), minRozmiar: pt(6.5) },
      },
      {
        id: 'usuniecie',
        typ: 'tekst',
        klucz: 'usuniecie',
        etykieta: {
          tekst: { parametr: 'etykietaUsuniecia' },
          pozycja: 'nad',
          styl: { wariant: 'pogrubiony' },
        },
        // Zawsze dwa wiersze: przy pustej wartości zostaje linijka do wpisania ręcznie,
        // a „Usunięcie:” jest na tej samej wysokości co na pozostałych kartach.
        minWysokosc: 2 * pt(STAN_TRESC) * 1.2,
        styl: { ...tresc(STAN_TRESC, 'normalny'), minRozmiar: pt(6.5) },
      },
    ],
  },
};

export const szablonyMausrittera: Szablon[] = [
  szablonBron,
  szablonZbroja,
  szablonPrzedmiot,
  szablonSakiewka,
  szablonZaklecie,
  szablonStan,
  szablonPusta,
];
