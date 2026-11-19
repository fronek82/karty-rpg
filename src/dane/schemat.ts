import { z } from 'zod';
import { t } from '../i18n';
import { PAPIERY } from '../model/arkusz';
import { WERSJA_SCHEMATU, type Projekt } from '../model/projekt';
import { czyKontener, type Kontener, type Szablon, type Wezel } from '../model/szablon';
import { znajdzElement } from '../ozdobniki/katalog';
import { LIMITY_SVG } from '../ozdobniki/svgImport';
import { MAKS_ELEMENTOW_BIBLIOTEKI, odwolaniaDoElementow } from './biblioteka';

/** Błąd wczytywania danych z komunikatem po polsku, gotowym do pokazania użytkownikowi. */
export class BladDanych extends Error {
  constructor(komunikat: string) {
    super(komunikat);
    this.name = 'BladDanych';
  }
}

/*
 * Schematy sprawdzają wszystkie znane pola (typy, zakresy, wartości wyliczeniowe), ale nie usuwają
 * pól, których nie znają (`looseObject`) – import nie może po cichu gubić danych.
 */
const liczba = z.number().finite();
const nieujemna = liczba.min(0);
const dodatnia = liczba.positive();
const calkowita = liczba.int();
const szkic = z.looseObject({ sila: nieujemna.max(3), ziarno: calkowita.min(0).max(4294967295) });
const postrzepienie = szkic.extend({ ziarnistosc: liczba.min(0.5).max(30) });
const identyfikator = z.string().min(1);
/** Id zasobu: litery, cyfry, `_`, `-`, `.`, `/` (w nazwie pliku w archiwum kodowany). */
export const MAKS_DLUGOSC_ID_ZASOBU = 100;
const idZasobu = z
  .string()
  .min(1)
  .max(MAKS_DLUGOSC_ID_ZASOBU)
  .regex(/^[\w./-]+$/);
const obj = z.looseObject;
const opc = <T extends z.ZodType>(s: T) => s.optional();
const osi = z.enum(['poczatek', 'srodek', 'koniec']);
const wariantCzcionki = z.enum(['normalny', 'pogrubiony', 'kursywa', 'pogrubiona-kursywa']);
const xy = obj({ x: liczba, y: liczba });

const rozmiar = z.union([
  obj({ mm: nieujemna }),
  obj({ procent: nieujemna.max(100) }),
  obj({ wypelnij: dodatnia }),
  z.literal('auto'),
]);
const odstepy = (wartosc: z.ZodNumber) =>
  z.union([
    wartosc,
    obj({ gora: opc(wartosc), prawo: opc(wartosc), dol: opc(wartosc), lewo: opc(wartosc) }),
  ]);
const stylLinii = z.enum(['ciagla', 'przerywana', 'kropkowana', 'podwojna']);
const narozniki = obj({ element: identyfikator, rozmiar: dodatnia, kolor: opc(z.string()) });
const ozdoba = z.discriminatedUnion('rodzaj', [
  obj({
    rodzaj: z.literal('motyw'),
    poLuku: opc(z.boolean()),
    element: identyfikator,
    szerokosc: dodatnia,
    kolor: z.string(),
    szyny: opc(nieujemna),
    odsuniecie: opc(nieujemna),
  }),
  obj({
    rodzaj: z.literal('ramka9'),
    element: identyfikator,
    grubosc: dodatnia.max(1000),
    kolor: opc(z.string()),
    odsuniecie: opc(nieujemna),
  }),
]);
const krawedzie = obj({
  gora: opc(z.boolean()),
  prawo: opc(z.boolean()),
  dol: opc(z.boolean()),
  lewo: opc(z.boolean()),
});

/** Położenie w kontenerze swobodnym: ±1000 mm to dużo więcej niż największa karta (300 mm). */
const pozycja = obj({
  x: liczba.min(-1000).max(1000),
  y: liczba.min(-1000).max(1000),
  kotwica: opc(
    z.enum([
      'lewy-gorny',
      'gorny',
      'prawy-gorny',
      'lewy',
      'srodek',
      'prawy',
      'lewy-dolny',
      'dolny',
      'prawy-dolny',
    ]),
  ),
  obrot: opc(liczba.min(0).lt(360)),
});

const baza = {
  id: identyfikator,
  nazwa: opc(z.string()),
  szerokosc: opc(rozmiar),
  wysokosc: opc(rozmiar),
  margines: opc(odstepy(liczba)),
  padding: opc(odstepy(nieujemna)),
  wyrownanie: opc(obj({ poziomo: opc(osi), pionowo: opc(osi) })),
  tlo: opc(z.string()),
  obramowanie: opc(
    obj({
      grubosc: nieujemna,
      szkic: opc(szkic),
      kolor: z.string(),
      styl: opc(stylLinii),
      przerwa: opc(nieujemna),
      krawedzie: opc(krawedzie),
    }),
  ),
  ozdoba: opc(ozdoba),
  narozniki: opc(narozniki),
  promien: opc(nieujemna),
  minSzerokosc: opc(nieujemna),
  minWysokosc: opc(nieujemna),
  pozycja: opc(pozycja),
};
const bazaPola = {
  ...baza,
  klucz: opc(z.string()),
  gdyPuste: opc(z.enum(['pokaz-ramke', 'ukryj'])),
};

const polaStylu = {
  wariant: opc(wariantCzcionki),
  minRozmiar: opc(dodatnia),
  kolor: opc(z.string()),
  wyrownanie: opc(z.enum(['lewo', 'srodek', 'prawo', 'justuj'])),
  wyrownaniePionowe: opc(osi),
  interlinia: opc(dodatnia),
  wielkieLitery: opc(z.boolean()),
  kapitaliki: opc(z.boolean()),
  wciecie: opc(nieujemna),
  odstepAkapitow: opc(nieujemna),
  odstepLiter: opc(liczba),
  obwodka: opc(obj({ grubosc: nieujemna, kolor: z.string() })),
};
const stylTekstu = obj({ czcionka: z.string().min(1), rozmiar: dodatnia, ...polaStylu });
const stylCzesciowy = obj({
  czcionka: opc(z.string().min(1)),
  rozmiar: opc(dodatnia),
  ...polaStylu,
});
const kolorReguly = z.string().regex(/^#[0-9a-f]{6}$/i);
const kolorZDanych = obj({
  klucz: identyfikator,
  domyslny: kolorReguly,
  mapa: z.array(obj({ wartosc: z.string(), kolor: kolorReguly })),
});

const napis = z.union([z.string(), obj({ parametr: z.string() })]);
const dopasowanie = z.enum(['dopasuj', 'wypelnij', 'rozciagnij']);

const pole = z.discriminatedUnion('typ', [
  obj({
    ...bazaPola,
    typ: z.literal('tekst'),
    styl: stylTekstu,
    grupaStyluId: opc(identyfikator),
    tekst: opc(napis),
    wieleWierszy: opc(z.boolean()),
    etykieta: opc(
      obj({
        tekst: napis,
        pozycja: z.enum(['nad', 'przed', 'pod']),
        styl: opc(stylCzesciowy),
        kolorZDanych: opc(kolorZDanych),
      }),
    ),
    formatowanie: opc(z.boolean()),
    listyNumerowane: opc(z.boolean()),
    ikonyWTekscie: opc(z.boolean()),
    kontynuuj: opc(z.boolean()),
  }),
  obj({
    ...bazaPola,
    typ: z.literal('wartosc'),
    styl: stylTekstu,
    grupaStyluId: opc(identyfikator),
    tekst: opc(napis),
    ksztalt: z.enum([
      'prostokat',
      'kwadrat',
      'kolo',
      'sciety',
      'romb',
      'tarcza',
      'szesciokat',
      'wlasny',
    ]),
    ksztaltElement: opc(identyfikator),
    etykieta: opc(
      obj({
        tekst: napis,
        pozycja: z.enum(['nad', 'pod']),
        styl: opc(stylCzesciowy),
        odstep: opc(nieujemna),
        kolorZDanych: opc(kolorZDanych),
      }),
    ),
  }),
  obj({
    ...bazaPola,
    typ: z.literal('obraz'),
    dopasowanie,
    zasob: opc(z.string()),
    kadr: opc(xy),
    omijaj: opc(z.array(z.string())),
    odstepOdOmijanych: opc(nieujemna),
  }),
  obj({
    ...bazaPola,
    typ: z.literal('znaczniki'),
    kolumny: calkowita.min(1),
    rzedy: calkowita.min(1),
    ksztalt: z.enum(['kolo', 'kwadrat']),
    srednica: dodatnia,
    odstep: nieujemna,
    grubosc: nieujemna,
    kolor: opc(z.string()),
  }),
  obj({
    ...bazaPola,
    typ: z.literal('wpis'),
    styl: stylTekstu,
    grupaStyluId: opc(identyfikator),
    sufiks: opc(napis),
  }),
  obj({
    ...bazaPola,
    typ: z.literal('ikona'),
    ikona: z.enum(['gwiazdka', 'nozyczki']),
    rozmiar: dodatnia,
    kolor: opc(z.string()),
  }),
  obj({
    ...bazaPola,
    typ: z.literal('separator'),
    kierunek: z.enum(['poziomy', 'pionowy']),
    grubosc: nieujemna,
    szkic: opc(szkic),
    kolor: opc(z.string()),
    stylLinii: opc(stylLinii),
    przerwa: opc(nieujemna),
    rysunek: opc(
      z.union([z.literal('linia'), obj({ motyw: z.string().min(1), szerokosc: nieujemna })]),
    ),
    zakonczenia: opc(obj({ element: z.string().min(1), rozmiar: nieujemna })),
    srodek: opc(obj({ element: z.string().min(1), rozmiar: nieujemna })),
    dlugosc: opc(z.union([obj({ mm: nieujemna }), obj({ procent: nieujemna.max(100) })])),
    odstepOdOzdoby: opc(nieujemna),
  }),
  obj({
    ...bazaPola,
    typ: z.literal('tabela'),
    kolumny: z.array(
      obj({
        naglowek: z.string(),
        klucz: z.string().min(1),
        szerokosc: opc(
          z.union([z.literal('auto'), obj({ mm: nieujemna }), obj({ wypelnij: dodatnia })]),
        ),
        wyrownanie: opc(z.enum(['lewo', 'srodek', 'prawo'])),
      }),
    ),
    wiersze: opc(calkowita.min(1).max(50)),
    naglowki: opc(z.boolean()),
    styl: stylTekstu,
    grupaStyluId: opc(identyfikator),
    stylNaglowka: opc(stylCzesciowy),
    tloNaglowka: opc(z.string()),
    linie: opc(
      obj({
        grubosc: nieujemna,
        kolor: z.string(),
        styl: opc(stylLinii),
        przerwa: opc(nieujemna),
        zewnetrzne: opc(z.boolean()),
      }),
    ),
    paddingKomorki: opc(nieujemna),
  }),
]);

// Rzutowanie konieczne przy schemacie rekurencyjnym; zgodność z modelem sprawdza `_Zgodnosc` niżej.
const kontener: z.ZodType<Kontener> = z.lazy(() =>
  obj({
    ...baza,
    typ: z.enum(['wiersz', 'kolumna', 'warstwy', 'swobodny']),
    dzieci: z.array(wezel),
    tloZDanych: opc(kolorZDanych),
    teksturaTla: opc(identyfikator),
    postrzepienie: opc(postrzepienie),
    odstep: opc(nieujemna),
    rozklad: opc(z.enum(['poczatek', 'srodek', 'koniec', 'miedzy'])),
  }),
) as unknown as z.ZodType<Kontener>;
const wezel: z.ZodType<Wezel> = z.lazy(() => z.union([kontener, pole])) as z.ZodType<Wezel>;

const rozmiarSlotow = { kolumny: calkowita.min(1), rzedy: calkowita.min(1) };
const rozmiarKarty = z.discriminatedUnion('tryb', [
  obj({
    tryb: z.literal('sloty'),
    slot: obj({ szerokosc: dodatnia, wysokosc: dodatnia }),
    ...rozmiarSlotow,
  }),
  obj({ tryb: z.literal('mm'), szerokosc: dodatnia, wysokosc: dodatnia }),
]);

const szablon = obj({
  id: identyfikator,
  nazwa: z.string(),
  rozmiar: rozmiarKarty,
  promienRogow: opc(nieujemna),
  tlo: opc(z.string()),
  tloZDanych: opc(kolorZDanych),
  teksturaTla: opc(identyfikator),
  postrzepienie: opc(postrzepienie),
  grupyStylow: opc(
    z
      .array(obj({ id: identyfikator, nazwa: z.string().trim().min(1), styl: stylTekstu }))
      .refine((grupy) => new Set(grupy.map((g) => g.id)).size === grupy.length),
  ),
  przyklad: opc(z.record(z.string(), z.string())),
  ramka: opc(
    obj({
      grubosc: nieujemna,
      szkic: opc(szkic),
      kolor: z.string(),
      styl: opc(stylLinii),
      przerwa: opc(nieujemna),
      narozniki: opc(narozniki),
      ozdoba: opc(ozdoba),
      odsuniecie: opc(nieujemna),
      promien: opc(nieujemna),
    }),
  ),
  korzen: kontener,
  podklad: opc(
    obj({
      zasob: identyfikator,
      przezroczystosc: liczba.min(0).max(100),
      widoczny: z.boolean(),
    }),
  ),
  parametry: opc(z.array(obj({ klucz: z.string(), nazwa: z.string(), domyslnie: z.string() }))),
  warianty: opc(z.array(obj({ ...rozmiarSlotow, korzen: kontener }))),
});

const ustawieniaObrazu = obj({
  skala: opc(dodatnia),
  przesuniecie: opc(xy),
  obrot: opc(liczba),
  dopasowanie: opc(dopasowanie),
});

const karta = obj({
  id: identyfikator,
  szablonId: identyfikator,
  dane: z.record(z.string(), z.string()),
  ilosc: calkowita.min(0),
  kopiaKarty: opc(obj({ oryginal: identyfikator, numer: calkowita.min(1) })),
  rozmiar: opc(obj(rozmiarSlotow)),
  obrazy: opc(z.record(z.string(), ustawieniaObrazu)),
});

const talia = obj({
  id: identyfikator,
  nazwa: z.string(),
  karty: z.array(karta),
  grupy: opc(
    z.array(
      obj({
        id: identyfikator,
        naglowek: z.string(),
        opis: opc(z.string()),
        karty: z.array(z.string()),
      }),
    ),
  ),
});

const dopasowanieDoSlotu = obj({
  luz: liczba.min(0).max(5),
  polozenie: z.enum(['srodek', 'lewy-gorny']),
  tloDoSlotu: z.boolean(),
  linie: z.enum(['slot', 'karta']),
});

const ukladArkusza = obj({
  kolumny: calkowita.min(1).max(50),
  rzedy: calkowita.min(1).max(50),
  gora: nieujemna,
  lewo: nieujemna,
  odstepPoziomy: nieujemna,
  odstepPionowy: nieujemna,
  linieCiecia: z.boolean(),
});

/** Preset „Moje układy” z bazy przeglądarki (sprawdzany przy odczycie – trafia do projektu). */
export const presetUkladu = obj({
  id: z.string().min(1),
  nazwa: z.string().min(1),
  papier: z.enum([...(Object.keys(PAPIERY) as (keyof typeof PAPIERY)[]), 'wlasny']),
  wymiaryPapieru: opc(obj({ szer: liczba.min(20).max(1000), wys: liczba.min(20).max(1000) })),
  orientacja: z.enum(['pionowa', 'pozioma']),
  slot: obj({ szerokosc: dodatnia, wysokosc: dodatnia }),
  uklad: ukladArkusza,
  dopasowanie: opc(dopasowanieDoSlotu),
}).refine((u) => u.papier !== 'wlasny' || u.wymiaryPapieru !== undefined);

const arkusz = obj({
  id: identyfikator,
  nazwa: z.string(),
  taliaId: identyfikator,
  wlasnySzablonId: opc(identyfikator),
  liczbaStron: opc(calkowita.min(1).max(500)),
  naglowki: opc(
    z.array(
      obj({
        id: identyfikator,
        strona: calkowita.min(0),
        kolumna: calkowita.min(0),
        kolumny: calkowita.min(1),
        naglowek: z.string(),
        opis: opc(z.string()),
        odstepPrzed: opc(nieujemna),
      }),
    ),
  ),
  ustawienia: obj({
    papier: z.enum([...(Object.keys(PAPIERY) as (keyof typeof PAPIERY)[]), 'wlasny']),
    wymiaryPapieru: opc(obj({ szer: liczba.min(20).max(1000), wys: liczba.min(20).max(1000) })),
    marginesBezpieczenstwa: opc(nieujemna),
    orientacja: z.enum(['pionowa', 'pozioma']),
    marginesy: obj({ gora: nieujemna, prawo: nieujemna, dol: nieujemna, lewo: nieujemna }),
    tytul: opc(
      obj({
        tekst: z.string(),
        polozenie: z.enum(['gora', 'lewo']),
        styl: stylTekstu,
        odstep: nieujemna,
      }),
    ),
    grupy: opc(
      obj({ styl: stylTekstu, stylOpisu: stylTekstu, odstep: nieujemna, odstepOdKart: nieujemna }),
    ),
    linie: obj({ grubosc: nieujemna, kolor: z.string(), kreska: dodatnia, przerwa: nieujemna }),
    nozyczki: opc(
      obj({
        linia: z.enum(['pozioma', 'pionowa']),
        indeks: calkowita.min(0),
        strona: z.enum(['poczatek', 'koniec']),
        rozmiar: dodatnia,
        odstep: nieujemna,
      }),
    ),
    czarnoBialy: opc(z.boolean()),
    slot: opc(obj({ szerokosc: dodatnia, wysokosc: dodatnia })),
    poczatekSiatki: opc(xy),
    uklad: opc(ukladArkusza),
    dopasowanie: opc(dopasowanieDoSlotu),
    rozmiary: opc(z.enum(['jeden', 'mieszane'])),
    mieszane: opc(
      obj({
        pakowanie: opc(z.enum(['pasy', 'maxrects'])),
        kolejnosc: z.enum(['najwieksze', 'wlasna']),
        obracaj: z.boolean(),
        grupujRozmiary: z.boolean(),
        odstep: nieujemna,
      }),
    ),
  }).refine((u) => u.papier !== 'wlasny' || u.wymiaryPapieru !== undefined, {
    // Funkcja – komunikat powstaje przy błędzie, w bieżącym języku (nie przy ładowaniu modułu).
    error: () => t('dane.wymiaryPapieru'),
    path: ['wymiaryPapieru'],
  }),
  kolejnosc: opc(z.array(identyfikator)),
  przypiete: opc(
    z.array(
      obj({
        kartaId: identyfikator,
        kolumna: calkowita.min(0),
        rzad: calkowita.min(0),
        strona: opc(calkowita.min(0)),
      }),
    ),
  ),
});

const kolorSymbolu = z.string().regex(/^(#[0-9a-fA-F]{6}|kolor)$/);
// Współrzędne własnych elementów: skończone i w rozsądnym zakresie (jak przy imporcie SVG).
const wspolrzedna = liczba.min(-LIMITY_SVG.zakres).max(LIMITY_SVG.zakres);
const komendaKonturu = z.union([
  z.tuple([z.literal('M'), wspolrzedna, wspolrzedna]),
  z.tuple([z.literal('L'), wspolrzedna, wspolrzedna]),
  z.tuple([
    z.literal('C'),
    wspolrzedna,
    wspolrzedna,
    wspolrzedna,
    wspolrzedna,
    wspolrzedna,
    wspolrzedna,
  ]),
  z.tuple([z.literal('Z')]),
]);
const konturSymbolu = obj({
  kontur: z.array(komendaKonturu),
  wypelnienie: opc(kolorSymbolu),
  obrys: opc(obj({ grubosc: nieujemna.max(LIMITY_SVG.zakres), kolor: kolorSymbolu })),
  evenodd: opc(z.boolean()),
});
const komendyWSumie = (k: { kontur: unknown[] }[]) => k.reduce((n, c) => n + c.kontur.length, 0);
const limitKomend = [
  (k: { kontur: unknown[] }[]) => komendyWSumie(k) <= LIMITY_SVG.komendy,
  `za dużo komend (najwyżej ${LIMITY_SVG.komendy})`,
] as const;
const ulamek = liczba.min(0).max(1);

const wciecieRamki = nieujemna.max(LIMITY_SVG.zakres);
const ustawieniaRamki9 = obj({
  zrodlo: z.discriminatedUnion('typ', [
    obj({ typ: z.literal('obraz'), zasob: idZasobu }),
    obj({ typ: z.literal('svg') }),
  ]),
  wciecia: obj({ gora: wciecieRamki, prawo: wciecieRamki, dol: wciecieRamki, lewo: wciecieRamki }),
  boki: z.enum(['rozciagnij', 'powtarzaj']),
  srodek: z.enum(['wypelnij', 'pomin']),
});

/** Własny element biblioteki ozdobników (z importu SVG); wbudowane (`wb:`) żyją w kodzie. */
const elementOzdobny = obj({
  id: z.string().regex(/^wl:[\w.-]{1,100}$/),
  nazwa: opc(z.string().max(200)),
  rodzaj: z.enum(['motyw', 'naroznik', 'zakonczenie', 'srodek', 'ksztalt', 'ramka9']),
  szer: dodatnia.max(LIMITY_SVG.zakres),
  wys: dodatnia.max(LIMITY_SVG.zakres),
  kontury: z
    .array(konturSymbolu)
    .max(LIMITY_SVG.ksztalty)
    .refine(...limitKomend),
  kostka: opc(
    z
      .array(konturSymbolu)
      .max(LIMITY_SVG.ksztalty)
      .refine(...limitKomend),
  ),
  kolorowanie: opc(z.enum(['jednolity', 'oryginal'])),
  // Prostokąt na tekst: dodatnie wymiary (UI: co najmniej 1 %), całość w obrębie rysunku.
  tresc: opc(
    obj({
      x: ulamek,
      y: ulamek,
      szer: ulamek.min(0.01),
      wys: ulamek.min(0.01),
    }).refine((r) => r.x + r.szer <= 1 + 1e-9 && r.y + r.wys <= 1 + 1e-9, 'poza rysunkiem'),
  ),
  ramka9: opc(ustawieniaRamki9),
})
  .refine(
    (e) => (e.rodzaj === 'ramka9') === (e.ramka9 !== undefined),
    'ramka9 tylko przy rodzaju ramka9',
  )
  // Ramka z obrazu nie ma własnego rysunku – kontury ma tylko źródło SVG.
  .refine(
    (e) => e.ramka9?.zrodlo.typ !== 'obraz' || e.kontury.length === 0,
    'ramka z obrazu bez konturów',
  )
  // Wcięcia 9-slice nie mogą wychodzić poza źródło.
  .refine(
    (e) =>
      !e.ramka9 ||
      (e.ramka9.wciecia.lewo + e.ramka9.wciecia.prawo <= e.szer + 1e-9 &&
        e.ramka9.wciecia.gora + e.ramka9.wciecia.dol <= e.wys + 1e-9),
    'wcięcia poza źródłem',
  );

const opisZasobu = z.discriminatedUnion('rodzaj', [
  obj({
    rodzaj: z.literal('obraz'),
    id: idZasobu,
    nazwa: z.string(),
    format: z.enum(['png', 'jpg']),
    szerokosc: dodatnia,
    wysokosc: dodatnia,
  }),
  obj({
    rodzaj: z.literal('czcionka'),
    id: idZasobu,
    nazwa: z.string(),
    rodzina: z.string().min(1),
    wariant: wariantCzcionki,
    format: z.enum(['ttf', 'otf', 'woff', 'woff2']),
    zrodlo: z.enum(['wbudowana', 'google', 'wlasna']),
  }),
]);

export const schematProjektu = obj({
  wersja: calkowita,
  id: identyfikator,
  nazwa: z.string(),
  utworzono: z.string(),
  zmieniono: z.string(),
  role: z.record(z.string(), z.string()),
  zasoby: z.array(opisZasobu),
  szablony: z.array(szablon),
  talie: z.array(talia),
  arkusze: z.array(arkusz),
  pakiet: opc(z.string()),
  biblioteka: opc(obj({ ozdobniki: z.array(elementOzdobny).max(MAKS_ELEMENTOW_BIBLIOTEKI) })),
});

export const schematPaczkiOzdobnika = obj({
  wersja: z.literal(1),
  element: elementOzdobny,
  zasoby: z.array(opisZasobu).max(1),
});

export const schematPlikuSzablonu = obj({
  wersja: calkowita,
  szablon,
  role: z.record(z.string(), z.string()),
  zasoby: z.array(opisZasobu),
  /** Własne elementy biblioteki ozdobników użyte przez szablon. */
  biblioteka: opc(z.array(elementOzdobny).max(MAKS_ELEMENTOW_BIBLIOTEKI)),
});

/**
 * Kontrola w czasie kompilacji: dane po walidacji muszą pasować do typów modelu.
 * Rozjazd schematu i interfejsów (np. nowe wymagane pole w modelu) to błąd typów.
 */
type _Zgodnosc = [
  z.infer<typeof schematProjektu> extends Projekt ? true : never,
  z.infer<typeof szablon> extends Szablon ? true : never,
];
export const _zgodnosc: _Zgodnosc = [true, true];

function sciezka(p: PropertyKey[]): string {
  return p.length ? p.map(String).join('.') : '(korzeń)';
}

/** Komunikat zod po polsku (zod domyślnie mówi po angielsku). */
function komunikat(issue: z.core.$ZodIssue): string {
  switch (issue.code) {
    case 'invalid_type':
      return t('dane.zod.typ', { oczekiwano: issue.expected });
    case 'too_small':
      return t('dane.zod.zaMalo', { min: String(issue.minimum) });
    case 'too_big':
      return t('dane.zod.zaDuzo', { max: String(issue.maximum) });
    case 'invalid_value':
      return t('dane.zod.wartosc', { dozwolone: issue.values.map(String).join(', ') });
    case 'invalid_format':
      return t('dane.zod.format');
    case 'invalid_union':
      return t('dane.zod.wariant');
    case 'custom':
      // Własne reguły (`refine`) niosą gotowy komunikat; bez niego – ogólny.
      return issue.message && issue.message !== 'Invalid input'
        ? issue.message
        : t('dane.zod.inne');
    default:
      return t('dane.zod.inne');
  }
}

/**
 * Przy unii (np. węzeł: kontener albo jedno z pól) zod zgłasza tylko „żaden wariant nie pasuje”.
 * Schodzimy do gałęzi, która zaszła najdalej (najdłuższa ścieżka błędu) – to zwykle ta, o którą
 * chodziło autorowi pliku.
 */
function najkonkretniejszy(issue: z.core.$ZodIssue): z.core.$ZodIssue {
  if (issue.code !== 'invalid_union' || issue.errors.length === 0) return issue;
  let najlepszy: z.core.$ZodIssue | undefined;
  for (const galaz of issue.errors) {
    const kandydat = galaz[0] && najkonkretniejszy(galaz[0]);
    if (kandydat && (!najlepszy || kandydat.path.length > najlepszy.path.length)) {
      najlepszy = kandydat;
    }
  }
  return najlepszy ? { ...najlepszy, path: [...issue.path, ...najlepszy.path] } : issue;
}

/** Sprawdza dane schematem; błąd zamienia na czytelny komunikat z miejscem w pliku. */
export function sprawdz<T>(schemat: z.ZodType<T>, dane: unknown): T {
  const wynik = schemat.safeParse(dane);
  if (wynik.success) return wynik.data;
  const pierwszy = wynik.error.issues[0] && najkonkretniejszy(wynik.error.issues[0]);
  throw new BladDanych(
    t('dane.niepoprawnaStruktura', {
      sciezka: sciezka(pierwszy?.path ?? []),
      komunikat: pierwszy ? komunikat(pierwszy) : '',
    }),
  );
}

type Migracja = (dane: Record<string, unknown>) => Record<string, unknown>;

export type BajtyWBazie = Blob | Uint8Array;

/** Migracja przy odczycie IndexedDB. Tablice bajtów działają też w WebKit z blokadą zapisu Blob. */
export async function migrujBajtyBazy(dane: BajtyWBazie): Promise<Uint8Array> {
  return dane instanceof Blob ? new Uint8Array(await dane.arrayBuffer()) : dane;
}

/**
 * Migracje: klucz `n` zamienia dane ze schematu `n` na `n + 1`. Projekt i plik szablonu mają
 * osobne kroki (inny kształt), ale wspólny numer wersji.
 */
export const MIGRACJE: { projekt: Record<number, Migracja>; szablon: Record<number, Migracja> } = {
  // 1 → 2: nowe pola są opcjonalne; sprowadzenie do modelu kartki robi normalizacja przy
  // otwarciu (potrzebuje czcionek – patrz src/druk/normalizacja.ts).
  // 2→3: nowe, opcjonalne pola (ramka karty, romb, separator, tabela, formatowanie) – bez zmian danych.
  // 3→4: nowe formaty papieru, własny papier, margines bezpieczeństwa – bez zmian danych.
  // 4→5: nazwy węzłów i dane przykładowe szablonu (edytor szablonu) – bez zmian danych.
  // 5→6: tabela (wiersze, nagłówki, wyrównanie kolumn), nowe kształty – bez zmian danych.
  // 6→7: własny układ arkusza (`ustawienia.uklad`) – bez zmian danych.
  // 7→8: `ustawienia.dopasowanie` (luz karty w slocie) i `dopasowanie` w presetach – bez zmian danych;
  // kartki bez tego pola zachowują tolerancję 0,5 mm.
  // 8→9: `ustawienia.rozmiary` / `ustawienia.mieszane` (mieszane rozmiary kart) i `Arkusz.kolejnosc` –
  // bez zmian danych; kartki bez pól mają jeden rozmiar (siatka) jak dotąd.
  // 9→10: styl linii `podwojna`, `przerwa`, `narozniki` (ramka karty i węzły szablonu) – bez zmian danych.
  // 10→11: `ozdoba` (motyw zamiast linii; ramka karty i węzły szablonu) – bez zmian danych.
  // 11→12: separator ozdobny (`rysunek`, `zakonczenia`, `srodek`, `dlugosc`, `odstepOdOzdoby`) – bez zmian danych.
  // 12→13: `biblioteka.ozdobniki` (własne SVG), kształt wartości `wlasny` – bez zmian danych.
  // 13→14: ramka 9-slice (`ozdoba.rodzaj: 'ramka9'`, element `ramka9` z PNG albo SVG) – bez zmian danych.
  // 14→15: tryb swobodny (kontener `swobodny`, `pozycja` węzła) – bez zmian danych.
  // 15→16: `Szablon.podklad` (podkład ze wzoru w edytorze) – bez zmian danych.
  // 16→17: opcjonalny `Arkusz.wlasnySzablonId` – stare arkusze zachowują typy pakietu.
  // 17→18: grupy stylów i reguły kolorów są opcjonalne. Dotychczasowe style i kolory zostają lokalne.
  // 18→19: opcjonalne listy i ikony w polach tekstowych. Zapisany tekst bez tych ustawień jest dosłowny.
  // 19→20: kontynuacja jest opcjonalnym ustawieniem pola i nie zmienia starszego tekstu.
  // 20→21: dodatkowe, opcjonalne ustawienia rysowania nie zmieniają starszych scen.
  // 21→22: dotychczasowe kąty i domyślne pakowanie w pasy zachowują znaczenie.
  projekt: {
    1: (d) => d,
    2: (d) => d,
    3: (d) => d,
    4: (d) => d,
    5: (d) => d,
    6: (d) => d,
    7: (d) => d,
    8: (d) => d,
    9: (d) => d,
    10: (d) => d,
    11: (d) => d,
    12: (d) => d,
    13: (d) => d,
    14: (d) => d,
    15: (d) => d,
    16: (d) => d,
    17: (d) => d,
    18: (d) => d,
    19: (d) => d,
    20: (d) => d,
    21: (d) => d,
  },
  szablon: {
    1: (d) => d,
    2: (d) => d,
    3: (d) => d,
    4: (d) => d,
    5: (d) => d,
    6: (d) => d,
    7: (d) => d,
    8: (d) => d,
    9: (d) => d,
    10: (d) => d,
    11: (d) => d,
    12: (d) => d,
    13: (d) => d,
    14: (d) => d,
    15: (d) => d,
    16: (d) => d,
    17: (d) => d,
    18: (d) => d,
    19: (d) => d,
    20: (d) => d,
    21: (d) => d,
  },
};

export function migruj(
  surowe: unknown,
  rodzaj: keyof typeof MIGRACJE = 'projekt',
  docelowa: number = WERSJA_SCHEMATU,
): unknown {
  if (typeof surowe !== 'object' || surowe === null || Array.isArray(surowe)) {
    throw new BladDanych(t('dane.brakWersji'));
  }
  let dane = surowe as Record<string, unknown>;
  const wersja = dane.wersja;
  if (typeof wersja !== 'number' || !Number.isInteger(wersja) || wersja < 1) {
    throw new BladDanych(t('dane.brakWersji'));
  }
  if (wersja > docelowa) throw new BladDanych(t('dane.nowszaWersja', { wersja }));
  for (let w = wersja; w < docelowa; w++) {
    const krok = MIGRACJE[rodzaj][w];
    if (!krok) throw new BladDanych(t('dane.brakMigracji', { wersja: w }));
    dane = { ...krok(dane), wersja: w + 1 };
  }
  return dane;
}

function powtorzenie(ids: Iterable<string>): string | undefined {
  const widziane = new Set<string>();
  for (const id of ids) {
    if (widziane.has(id)) return id;
    widziane.add(id);
  }
  return undefined;
}

function* wezly(w: Wezel): Generator<Wezel> {
  yield w;
  if ('dzieci' in w) for (const d of w.dzieci) yield* wezly(d);
}

function drzewa(s: Szablon): Kontener[] {
  return [s.korzen, ...(s.warianty ?? []).map((w) => w.korzen)];
}

export function teksturySzablonu(s: Szablon): string[] {
  const wynik: string[] = s.teksturaTla ? [s.teksturaTla] : [];
  for (const k of drzewa(s))
    for (const w of wezly(k)) if (czyKontener(w) && w.teksturaTla) wynik.push(w.teksturaTla);
  return wynik;
}

/** Identyfikatory zasobów obrazów wskazanych stałymi w szablonie. */
export function zasobySzablonu(s: Szablon): string[] {
  return [
    ...teksturySzablonu(s),
    ...drzewa(s).flatMap((k) =>
      [...wezly(k)].flatMap((w) => (w.typ === 'obraz' && w.zasob ? [w.zasob] : [])),
    ),
  ];
}

/**
 * Twarde reguły spójności – ich złamanie uniemożliwia poprawne użycie projektu: powtórzone id,
 * karta z nieznanym szablonem, arkusz z nieznaną talią, grupa lub przypięcie z nieznaną kartą.
 */
export function sprawdzSpojnosc(p: Projekt): void {
  const blad = (opis: string): never => {
    throw new BladDanych(t('dane.zlaSpojnosc', { opis }));
  };
  const powtorzony = (ids: Iterable<string>, gdzie: string) => {
    const id = powtorzenie(ids);
    if (id !== undefined) blad(t('dane.powtorzonyId', { id, gdzie }));
  };
  powtorzony(
    p.zasoby.map((z) => z.id),
    t('dane.gdzie.zasoby'),
  );
  powtorzony(
    (p.biblioteka?.ozdobniki ?? []).map((e) => e.id),
    t('dane.gdzie.biblioteka'),
  );
  powtorzony(
    p.szablony.map((s) => s.id),
    t('dane.gdzie.szablony'),
  );
  powtorzony(
    p.talie.map((x) => x.id),
    t('dane.gdzie.talie'),
  );
  powtorzony(
    p.arkusze.map((a) => a.id),
    t('dane.gdzie.arkusze'),
  );
  for (const s of p.szablony) {
    for (const k of drzewa(s)) {
      powtorzony(
        [...wezly(k)].map((w) => w.id),
        t('dane.gdzie.szablon', { id: s.id }),
      );
    }
  }
  const szablony = new Set(p.szablony.map((s) => s.id));
  const talie = new Map(p.talie.map((x) => [x.id, new Set(x.karty.map((k) => k.id))]));
  for (const talia of p.talie) {
    const gdzie = t('dane.gdzie.talia', { id: talia.id });
    powtorzony(
      talia.karty.map((k) => k.id),
      gdzie,
    );
    powtorzony(
      (talia.grupy ?? []).map((g) => g.id),
      gdzie,
    );
    powtorzony(
      (talia.grupy ?? []).flatMap((g) => g.karty),
      gdzie,
    );
    for (const k of talia.karty) {
      if (!szablony.has(k.szablonId)) {
        blad(t('dane.nieznanySzablon', { karta: k.id, szablon: k.szablonId }));
      }
    }
    const karty = talie.get(talia.id)!;
    for (const g of talia.grupy ?? []) {
      for (const kartaId of g.karty) {
        if (!karty.has(kartaId))
          blad(t('dane.nieznanaKartaWGrupie', { grupa: g.id, karta: kartaId }));
      }
    }
  }
  for (const a of p.arkusze) {
    if (a.wlasnySzablonId && !szablony.has(a.wlasnySzablonId)) {
      blad(t('dane.nieznanySzablonArkusza', { arkusz: a.id, szablon: a.wlasnySzablonId }));
    }
    powtorzony(
      (a.naglowki ?? []).map((n) => n.id),
      t('dane.gdzie.arkusz', { id: a.id }),
    );
    const karty = talie.get(a.taliaId);
    if (!karty) return blad(t('dane.nieznanaTalia', { arkusz: a.id, talia: a.taliaId }));
    for (const pp of a.przypiete ?? []) {
      if (!karty.has(pp.kartaId)) {
        blad(t('dane.nieznanaKartaPrzypieta', { arkusz: a.id, karta: pp.kartaId }));
      }
    }
  }
}

/**
 * Miękkie reguły – projekt da się otworzyć (silnik użyje czcionki zapasowej / pustej ramki),
 * ale użytkownik powinien wiedzieć: rola bez czcionek, obraz szablonu lub karty bez zasobu,
 * dwie czcionki o tej samej rodzinie i wariancie (wygrywa ostatnia).
 */
export function ostrzezeniaProjektu(p: Projekt): string[] {
  const wynik: string[] = [];
  const zasoby = new Set(p.zasoby.map((z) => z.id));
  const czcionki = p.zasoby.flatMap((z) => (z.rodzaj === 'czcionka' ? [z] : []));
  const rodziny = new Set(czcionki.map((c) => c.rodzina));
  for (const [rola, rodzina] of Object.entries(p.role)) {
    if (!rodziny.has(rodzina)) wynik.push(t('dane.nieznanaRodzina', { rola, rodzina }));
  }
  for (const s of p.szablony) {
    for (const id of new Set(zasobySzablonu(s))) {
      if (!zasoby.has(id)) {
        wynik.push(t('dane.nieznanyZasob', { gdzie: t('dane.gdzie.szablon', { id: s.id }), id }));
      }
    }
    // Podkład ze wzoru bez obrazu w bibliotece – edytor pokaże podgląd bez podkładu.
    if (s.podklad && !zasoby.has(s.podklad.zasob)) {
      wynik.push(
        t('dane.nieznanyZasob', {
          gdzie: t('dane.gdzie.szablon', { id: s.id }),
          id: s.podklad.zasob,
        }),
      );
    }
  }
  // Element ozdobny użyty w szablonie, którego nie ma w bibliotece – silnik pominie ozdobę.
  const wlasne = p.biblioteka?.ozdobniki;
  for (const s of p.szablony) {
    for (const id of new Set(odwolaniaDoElementow(s))) {
      if (!znajdzElement(id, wlasne)) {
        wynik.push(t('dane.nieznanyElement', { gdzie: t('dane.gdzie.szablon', { id: s.id }), id }));
      }
    }
  }
  // Ramki 9-slice: obraz, którego nie ma w zasobach (silnik narysuje cienką linię), wymiary
  // niezgodne z obrazem (wcięcia w pikselach przestałyby pasować) i źródło SVG bez rysunku.
  for (const e of p.biblioteka?.ozdobniki ?? []) {
    const z = e.ramka9?.zrodlo;
    const gdzie = t('dane.gdzie.ramka9', { id: e.id });
    if (z?.typ === 'obraz') {
      const opis = p.zasoby.find((o) => o.rodzaj === 'obraz' && o.id === z.zasob);
      if (!opis || opis.rodzaj !== 'obraz')
        wynik.push(t('dane.nieznanyZasob', { gdzie, id: z.zasob }));
      else if (opis.szerokosc !== e.szer || opis.wysokosc !== e.wys)
        wynik.push(
          t('dane.ramka9Wymiary', {
            gdzie,
            a: e.szer,
            b: e.wys,
            id: z.zasob,
            c: opis.szerokosc,
            d: opis.wysokosc,
          }),
        );
    } else if (z?.typ === 'svg' && e.kontury.length === 0)
      wynik.push(t('dane.ramka9Pusta', { gdzie }));
  }
  const szablony = new Map(p.szablony.map((s) => [s.id, s]));
  const zgloszone = new Set<string>();
  for (const talia of p.talie) {
    for (const k of talia.karty) {
      const s = szablony.get(k.szablonId);
      if (!s) continue;
      for (const w of drzewa(s).flatMap((d) => [...wezly(d)])) {
        if (w.typ !== 'obraz' || !w.klucz) continue;
        const id = k.dane[w.klucz];
        if (id && !zasoby.has(id) && !zgloszone.has(id)) {
          zgloszone.add(id);
          wynik.push(t('dane.nieznanyZasob', { gdzie: t('dane.gdzie.karta', { id: k.id }), id }));
        }
      }
    }
  }
  const pary = new Set<string>();
  for (const c of czcionki) {
    const klucz = `${c.rodzina}\u0000${c.wariant}`;
    if (pary.has(klucz)) {
      wynik.push(t('dane.powtorzonaCzcionka', { rodzina: c.rodzina, wariant: c.wariant }));
    }
    pary.add(klucz);
  }
  return wynik;
}

/** Migruje, sprawdza kształt i twardą spójność – wspólne wejście dla pliku i bazy. */
export function przygotujProjekt(surowe: unknown): Projekt {
  const projekt = sprawdz(schematProjektu, migruj(surowe, 'projekt')) as Projekt;
  sprawdzSpojnosc(projekt);
  return projekt;
}
