#!/usr/bin/env node
/**
 * Generator kuratorowanej galerii neutralnych szablonów online (`public/galeria/`).
 * Tworzy deterministyczne paczki `.kartyrpg-szablon` (ZIP z `szablon.json`) oraz `manifest.json`.
 * Wszystkie szablony są oryginalnymi, neutralnymi układami projektu na licencji MIT (bez zasobów zewnętrznych).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';

const WERSJA_SCHEMATU = 27;
const DATA_STALA = new Date('2026-01-01T00:00:00Z');
const PT = 25.4 / 72;
const pt = (n) => n * PT;
const ROLE_DOMYSLNE = { tresc: 'EB Garamond', tytul: 'EB Garamond' };

const KATALOG_WYJSCIOWY = resolve('public/galeria');
mkdirSync(KATALOG_WYJSCIOWY, { recursive: true });

function spakujSzablon(szablon, rewers) {
  const zawartosc = {
    wersja: WERSJA_SCHEMATU,
    szablon,
    ...(rewers ? { rewers } : {}),
    role: ROLE_DOMYSLNE,
    zasoby: [],
  };
  return zipSync(
    {
      'szablon.json': [strToU8(JSON.stringify(zawartosc, null, 2)), { mtime: DATA_STALA }],
    },
    { level: 6 },
  );
}

const POZYCJE = [
  {
    wpis: {
      id: 'przedmiot-z-rewersem',
      nazwa: {
        pl: 'Karta przedmiotu (z rewersem)',
        en: 'Item card (with back)',
      },
      opis: {
        pl: 'Klasyczna karta 63×88 mm z tytułem, kategorią, wartością w rombie, opisem, polami użyć i dopasowanym rewersem.',
        en: 'Classic 63×88 mm card with title, category, diamond value badge, description, usage boxes, and matching card back.',
      },
      kategoria: 'karty',
      format: { szerokosc: 63, wysokosc: 88, nazwa: 'Poker 63×88 mm' },
      maRewers: true,
      plik: 'przedmiot-z-rewersem.kartyrpg-szablon',
      autor: 'Karty RPG',
      licencja: 'MIT',
      tagi: ['poker', 'ekwipunek', 'item', 'rewers', 'back', '63x88'],
    },
    szablon: {
      id: 'gal-przedmiot',
      nazwa: 'Karta przedmiotu',
      rewersId: 'gal-rewers-przedmiot',
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      promienRogow: 3,
      tlo: '#fbf6ea',
      ramka: {
        grubosc: 0.35,
        kolor: '#2c3e50',
        styl: 'ciagla',
        odsuniecie: 2,
        narozniki: { element: 'wb:kat', rozmiar: 4.5, kolor: '#2c3e50' },
      },
      przyklad: {
        tytul: 'Kompas podróżny',
        koszt: '2',
        kategoria: 'Narzędzie · Lekkie',
        opis: 'Wskazuje kierunek najbliższego znanego punktu orientacyjnego podczas wędrówki.',
      },
      korzen: {
        id: 'korzen',
        typ: 'kolumna',
        padding: 4,
        odstep: 1.8,
        dzieci: [
          {
            id: 'naglowek',
            typ: 'wiersz',
            odstep: 1.5,
            dzieci: [
              {
                id: 'tytul',
                typ: 'tekst',
                klucz: 'tytul',
                wieleWierszy: false,
                szerokosc: { wypelnij: 1 },
                styl: {
                  czcionka: 'tytul',
                  rozmiar: pt(12),
                  wariant: 'pogrubiony',
                  kolor: '#1f2d3d',
                },
              },
              {
                id: 'koszt',
                typ: 'wartosc',
                klucz: 'koszt',
                szerokosc: { mm: 11 },
                padding: 0.7,
                tlo: '#efe2c6',
                obramowanie: { grubosc: 0.3, kolor: '#2c3e50' },
                ksztalt: 'romb',
                styl: {
                  czcionka: 'tresc',
                  rozmiar: pt(10),
                  wariant: 'pogrubiony',
                  kolor: '#1f2d3d',
                },
              },
            ],
          },
          {
            id: 'kategoria',
            typ: 'tekst',
            klucz: 'kategoria',
            wieleWierszy: false,
            styl: {
              czcionka: 'tresc',
              rozmiar: pt(8),
              wariant: 'kursywa',
              kolor: '#546575',
            },
          },
          {
            id: 'sep-1',
            typ: 'separator',
            kierunek: 'poziomy',
            grubosc: 0.25,
            kolor: '#2c3e50',
            srodek: { element: 'wb:sr-romb', rozmiar: 2.2 },
            odstepOdOzdoby: 0.5,
          },
          {
            id: 'obraz',
            typ: 'obraz',
            klucz: 'ilustracja',
            wysokosc: { mm: 27 },
            dopasowanie: 'wypelnij',
            tlo: '#f2ead8',
            promien: 1.2,
            obramowanie: { grubosc: 0.25, kolor: '#8b7a5e' },
          },
          {
            id: 'opis',
            typ: 'tekst',
            klucz: 'opis',
            wysokosc: { wypelnij: 1 },
            padding: 1.4,
            tlo: '#ffffff',
            promien: 1,
            obramowanie: { grubosc: 0.2, kolor: '#c5b89e' },
            styl: { czcionka: 'tresc', rozmiar: pt(8.5), kolor: '#222222' },
          },
          {
            id: 'uzycia',
            typ: 'znaczniki',
            klucz: 'uzycia',
            kolumny: 3,
            rzedy: 1,
            ksztalt: 'kolo',
            srednica: 3.4,
            odstep: 1.6,
            grubosc: 0.3,
            kolor: '#2c3e50',
          },
        ],
      },
    },
    rewers: {
      id: 'gal-rewers-przedmiot',
      nazwa: 'Rewers przedmiotu',
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      tlo: '#223344',
      ramka: {
        grubosc: 0.4,
        kolor: '#e8d8b5',
        styl: 'podwojna',
        odsuniecie: 3.5,
        narozniki: { element: 'wb:gwiazda', rozmiar: 5, kolor: '#e8d8b5' },
      },
      korzen: {
        id: 'rewers-korzen',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'rewers-etykieta',
            typ: 'tekst',
            tekst: 'EKWIPUNEK',
            wieleWierszy: false,
            pozycja: { x: 8, y: 39 },
            szerokosc: { mm: 47 },
            wysokosc: { mm: 10 },
            styl: {
              czcionka: 'tytul',
              rozmiar: pt(12),
              wariant: 'pogrubiony',
              wyrownanie: 'srodek',
              kolor: '#f5ead2',
              odstepLiter: 0.8,
            },
          },
        ],
      },
    },
  },
  {
    wpis: {
      id: 'zdarzenie-poziome',
      nazwa: {
        pl: 'Karta zdarzenia (pozioma)',
        en: 'Event card (landscape)',
      },
      opis: {
        pl: 'Poziomy układ 88×63 mm z nagłówkiem, dwukolumnową tabelą efektów oraz obszernym opisem sytuacji.',
        en: 'Landscape 88×63 mm layout with header, two-column effects table, and spacious situation description.',
      },
      kategoria: 'zdarzenia',
      format: { szerokosc: 88, wysokosc: 63, nazwa: 'Poker poziomy 88×63 mm' },
      maRewers: false,
      plik: 'zdarzenie-poziome.kartyrpg-szablon',
      autor: 'Karty RPG',
      licencja: 'MIT',
      tagi: ['pozioma', 'landscape', 'zdarzenie', 'event', 'tabela', '88x63'],
    },
    szablon: {
      id: 'gal-zdarzenie',
      nazwa: 'Karta zdarzenia',
      rozmiar: { tryb: 'mm', szerokosc: 88, wysokosc: 63 },
      promienRogow: 3,
      tlo: '#f7f4ee',
      ramka: {
        grubosc: 0.35,
        kolor: '#5b3a1e',
        styl: 'podwojna',
        odsuniecie: 2.2,
        narozniki: { element: 'wb:lisc', rozmiar: 4, kolor: '#5b3a1e' },
      },
      przyklad: {
        tytul: 'Gęsta mgła na przełęczy',
        opis: 'Widoczność spada do kilku kroków. Podróżnicy muszą wybrać bezpieczniejszy szlak albo zwolnić tempo marszu.',
        wynik: 'Sukces',
        efekt: 'Brak opóźnienia',
        'wynik.2': 'Porażka',
        'efekt.2': 'Dodatkowy odcinek drogi',
      },
      korzen: {
        id: 'korzen',
        typ: 'kolumna',
        padding: 4.5,
        odstep: 1.8,
        dzieci: [
          {
            id: 'tytul',
            typ: 'tekst',
            klucz: 'tytul',
            wieleWierszy: false,
            styl: {
              czcionka: 'tytul',
              rozmiar: pt(13),
              wariant: 'pogrubiony',
              wyrownanie: 'srodek',
              kolor: '#3f2612',
            },
          },
          {
            id: 'sep',
            typ: 'separator',
            kierunek: 'poziomy',
            grubosc: 0.25,
            kolor: '#5b3a1e',
            zakonczenia: { element: 'wb:zak-grot', rozmiar: 2 },
            srodek: { element: 'wb:sr-gwiazda', rozmiar: 2.2 },
            odstepOdOzdoby: 0.4,
          },
          {
            id: 'opis',
            typ: 'tekst',
            klucz: 'opis',
            wysokosc: { wypelnij: 1 },
            styl: { czcionka: 'tresc', rozmiar: pt(9), kolor: '#24201c' },
          },
          {
            id: 'tabela',
            typ: 'tabela',
            kolumny: [
              { naglowek: 'Wynik', klucz: 'wynik', szerokosc: { wypelnij: 1 } },
              { naglowek: 'Konsekwencja', klucz: 'efekt', szerokosc: { wypelnij: 2 } },
            ],
            wiersze: 2,
            naglowki: true,
            paddingKomorki: 1,
            linie: { grubosc: 0.25, kolor: '#5b3a1e', zewnetrzne: true },
            tloNaglowka: '#eadec9',
            styl: { czcionka: 'tresc', rozmiar: pt(8), kolor: '#24201c' },
            stylNaglowka: {
              czcionka: 'tresc',
              rozmiar: pt(8),
              wariant: 'pogrubiony',
              kolor: '#3f2612',
            },
          },
        ],
      },
    },
  },
  {
    wpis: {
      id: 'postac-tarot',
      nazwa: {
        pl: 'Karta postaci (Tarot)',
        en: 'Character card (Tarot)',
      },
      opis: {
        pl: 'Duży format 70×120 mm na postać lub towarzysza: portret, trzy cechy w rzędzie, zdolności, notatki i ozdobny rewers.',
        en: 'Large 70×120 mm card for a character or companion: portrait, three stats in a row, abilities, notes, and ornamental back.',
      },
      kategoria: 'postacie',
      format: { szerokosc: 70, wysokosc: 120, nazwa: 'Tarot 70×120 mm' },
      maRewers: true,
      plik: 'postac-tarot.kartyrpg-szablon',
      autor: 'Karty RPG',
      licencja: 'MIT',
      tagi: ['tarot', 'postac', 'character', 'npc', 'rewers', 'back', '70x120'],
    },
    szablon: {
      id: 'gal-postac',
      nazwa: 'Karta postaci (Tarot)',
      rewersId: 'gal-rewers-postac',
      rozmiar: { tryb: 'mm', szerokosc: 70, wysokosc: 120 },
      promienRogow: 3.5,
      tlo: '#faf6ee',
      ramka: {
        grubosc: 0.35,
        kolor: '#4a3228',
        styl: 'ciagla',
        odsuniecie: 2.5,
        narozniki: { element: 'wb:wezel', rozmiar: 5, kolor: '#4a3228' },
      },
      przyklad: {
        imie: 'Maja z Zielonej Doliny',
        rola: 'Przewodniczka · Zwiad',
        cecha1: '12',
        cecha2: '14',
        cecha3: '11',
        zdolnosci:
          '1. Zna skróty w gęstym lesie.\n2. Potrafi rozpalić ognisko nawet podczas deszczu.',
      },
      korzen: {
        id: 'korzen',
        typ: 'kolumna',
        padding: 4.5,
        odstep: 2,
        dzieci: [
          {
            id: 'imie',
            typ: 'tekst',
            klucz: 'imie',
            wieleWierszy: false,
            styl: {
              czcionka: 'tytul',
              rozmiar: pt(13.5),
              wariant: 'pogrubiony',
              wyrownanie: 'srodek',
              kolor: '#2b1b14',
            },
          },
          {
            id: 'rola',
            typ: 'tekst',
            klucz: 'rola',
            wieleWierszy: false,
            styl: {
              czcionka: 'tresc',
              rozmiar: pt(8.5),
              wariant: 'kursywa',
              wyrownanie: 'srodek',
              kolor: '#684e40',
            },
          },
          {
            id: 'portret',
            typ: 'obraz',
            klucz: 'portret',
            wysokosc: { mm: 38 },
            dopasowanie: 'wypelnij',
            tlo: '#efe6d5',
            promien: 1.5,
            obramowanie: { grubosc: 0.3, kolor: '#4a3228' },
          },
          {
            id: 'cechy',
            typ: 'wiersz',
            odstep: 2,
            dzieci: [
              {
                id: 'cecha-1',
                typ: 'wartosc',
                klucz: 'cecha1',
                ksztalt: 'prostokat',
                szerokosc: { wypelnij: 1 },
                padding: 1,
                tlo: '#f3ead9',
                promien: 1,
                obramowanie: { grubosc: 0.25, kolor: '#4a3228' },
                styl: {
                  czcionka: 'tresc',
                  rozmiar: pt(10),
                  wariant: 'pogrubiony',
                  kolor: '#2b1b14',
                },
                etykieta: {
                  tekst: 'Sprawność',
                  pozycja: 'nad',
                  styl: { czcionka: 'tresc', rozmiar: pt(7), kolor: '#684e40' },
                },
              },
              {
                id: 'cecha-2',
                typ: 'wartosc',
                klucz: 'cecha2',
                ksztalt: 'prostokat',
                szerokosc: { wypelnij: 1 },
                padding: 1,
                tlo: '#f3ead9',
                promien: 1,
                obramowanie: { grubosc: 0.25, kolor: '#4a3228' },
                styl: {
                  czcionka: 'tresc',
                  rozmiar: pt(10),
                  wariant: 'pogrubiony',
                  kolor: '#2b1b14',
                },
                etykieta: {
                  tekst: 'Umysł',
                  pozycja: 'nad',
                  styl: { czcionka: 'tresc', rozmiar: pt(7), kolor: '#684e40' },
                },
              },
              {
                id: 'cecha-3',
                typ: 'wartosc',
                klucz: 'cecha3',
                ksztalt: 'prostokat',
                szerokosc: { wypelnij: 1 },
                padding: 1,
                tlo: '#f3ead9',
                promien: 1,
                obramowanie: { grubosc: 0.25, kolor: '#4a3228' },
                styl: {
                  czcionka: 'tresc',
                  rozmiar: pt(10),
                  wariant: 'pogrubiony',
                  kolor: '#2b1b14',
                },
                etykieta: {
                  tekst: 'Wola',
                  pozycja: 'nad',
                  styl: { czcionka: 'tresc', rozmiar: pt(7), kolor: '#684e40' },
                },
              },
            ],
          },
          {
            id: 'zdolnosci',
            typ: 'tekst',
            klucz: 'zdolnosci',
            listyNumerowane: true,
            wysokosc: { wypelnij: 1 },
            padding: 1.5,
            tlo: '#ffffff',
            promien: 1,
            obramowanie: { grubosc: 0.2, kolor: '#c5b4a2' },
            styl: { czcionka: 'tresc', rozmiar: pt(8.5), kolor: '#222222' },
          },
        ],
      },
    },
    rewers: {
      id: 'gal-rewers-postac',
      nazwa: 'Rewers postaci',
      rozmiar: { tryb: 'mm', szerokosc: 70, wysokosc: 120 },
      tlo: '#3b241c',
      ramka: {
        grubosc: 0.4,
        kolor: '#e7d5b4',
        styl: 'ciagla',
        odsuniecie: 4,
        narozniki: { element: 'wb:wezel', rozmiar: 5.5, kolor: '#e7d5b4' },
        ozdoba: { rodzaj: 'motyw', element: 'wb:przeplot', szerokosc: 4.5, kolor: '#c8ab7b' },
      },
      korzen: {
        id: 'rewers-korzen',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'rewers-tytul',
            typ: 'tekst',
            tekst: 'POSTAĆ',
            wieleWierszy: false,
            pozycja: { x: 10, y: 54 },
            szerokosc: { mm: 50 },
            wysokosc: { mm: 12 },
            styl: {
              czcionka: 'tytul',
              rozmiar: pt(14),
              wariant: 'pogrubiony',
              wyrownanie: 'srodek',
              kolor: '#f4e6cb',
              odstepLiter: 1,
            },
          },
        ],
      },
    },
  },
  {
    wpis: {
      id: 'zasob-mini',
      nazwa: {
        pl: 'Karta zasobu (Mini)',
        en: 'Resource card (Mini)',
      },
      opis: {
        pl: 'Kompaktowy format 44×68 mm do szybkich kart zasobów, stanów lub krótkich wskazówek przy stole.',
        en: 'Compact 44×68 mm format for quick resource cards, conditions, or short table reminders.',
      },
      kategoria: 'zasoby',
      format: { szerokosc: 44, wysokosc: 68, nazwa: 'Mini Euro 44×68 mm' },
      maRewers: false,
      plik: 'zasob-mini.kartyrpg-szablon',
      autor: 'Karty RPG',
      licencja: 'MIT',
      tagi: ['mini', 'zasob', 'resource', 'stan', 'condition', '44x68'],
    },
    szablon: {
      id: 'gal-zasob',
      nazwa: 'Karta zasobu (Mini)',
      rozmiar: { tryb: 'mm', szerokosc: 44, wysokosc: 68 },
      promienRogow: 2.5,
      tlo: '#f4f7f2',
      ramka: {
        grubosc: 0.35,
        kolor: '#2e5238',
        styl: 'ciagla',
        odsuniecie: 1.8,
      },
      przyklad: {
        tytul: 'Zapasy ziół',
        efekt: 'Odnawia siły w trakcie krótkiego postoju.',
      },
      korzen: {
        id: 'korzen',
        typ: 'kolumna',
        padding: 3,
        odstep: 1.4,
        dzieci: [
          {
            id: 'tytul',
            typ: 'tekst',
            klucz: 'tytul',
            wieleWierszy: false,
            styl: {
              czcionka: 'tytul',
              rozmiar: pt(10.5),
              wariant: 'pogrubiony',
              wyrownanie: 'srodek',
              kolor: '#1f3b27',
            },
          },
          {
            id: 'obraz',
            typ: 'obraz',
            klucz: 'obraz',
            wysokosc: { mm: 20 },
            dopasowanie: 'wypelnij',
            tlo: '#e3ece0',
            promien: 1,
            obramowanie: { grubosc: 0.25, kolor: '#2e5238' },
          },
          {
            id: 'efekt',
            typ: 'tekst',
            klucz: 'efekt',
            wysokosc: { wypelnij: 1 },
            styl: { czcionka: 'tresc', rozmiar: pt(8), wyrownanie: 'srodek', kolor: '#222222' },
          },
          {
            id: 'ladunki',
            typ: 'znaczniki',
            klucz: 'ladunki',
            kolumny: 4,
            rzedy: 1,
            ksztalt: 'kwadrat',
            srednica: 3,
            odstep: 1.2,
            grubosc: 0.25,
            kolor: '#2e5238',
          },
        ],
      },
    },
  },
  {
    wpis: {
      id: 'rewers-geometryczny',
      nazwa: {
        pl: 'Szablon z rewersem geometrycznym',
        en: 'Template with geometric back',
      },
      opis: {
        pl: 'Uniwersalna karta 63×88 mm z bogatym, dwukolorowym rewersem ornamentowym gotowym do druku dwustronnego.',
        en: 'Versatile 63×88 mm card featuring an ornate two-tone geometric back ready for double-sided printing.',
      },
      kategoria: 'rewersy',
      format: { szerokosc: 63, wysokosc: 88, nazwa: 'Poker 63×88 mm' },
      maRewers: true,
      plik: 'rewers-geometryczny.kartyrpg-szablon',
      autor: 'Karty RPG',
      licencja: 'MIT',
      tagi: ['rewers', 'back', 'ornament', 'dwustronny', 'duplex', 'poker', '63x88'],
    },
    szablon: {
      id: 'gal-karta-rewers',
      nazwa: 'Karta z rewersem geometrycznym',
      rewersId: 'gal-rewers-geo',
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      promienRogow: 3,
      tlo: '#fdfcf9',
      ramka: {
        grubosc: 0.35,
        kolor: '#1f2937',
        styl: 'podwojna',
        odsuniecie: 2.2,
      },
      przyklad: {
        tytul: 'Tytuł karty',
        tresc: 'Miejsce na dowolny opis, regułę lub wskazówkę dla graczy.',
      },
      korzen: {
        id: 'korzen',
        typ: 'kolumna',
        padding: 4.5,
        odstep: 2,
        dzieci: [
          {
            id: 'tytul',
            typ: 'tekst',
            klucz: 'tytul',
            wieleWierszy: false,
            styl: {
              czcionka: 'tytul',
              rozmiar: pt(12.5),
              wariant: 'pogrubiony',
              wyrownanie: 'srodek',
              kolor: '#111827',
            },
          },
          {
            id: 'sep',
            typ: 'separator',
            kierunek: 'poziomy',
            grubosc: 0.25,
            kolor: '#1f2937',
            srodek: { element: 'wb:sr-gwiazda', rozmiar: 2.2 },
            odstepOdOzdoby: 0.5,
          },
          {
            id: 'tresc',
            typ: 'tekst',
            klucz: 'tresc',
            wysokosc: { wypelnij: 1 },
            styl: { czcionka: 'tresc', rozmiar: pt(9), kolor: '#1f2937' },
          },
        ],
      },
    },
    rewers: {
      id: 'gal-rewers-geo',
      nazwa: 'Rewers geometryczny',
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      tlo: '#1c2541',
      ramka: {
        grubosc: 0.45,
        kolor: '#d9b977',
        styl: 'podwojna',
        odsuniecie: 3.5,
        narozniki: { element: 'wb:okucie', rozmiar: 5.5, kolor: '#d9b977' },
        ozdoba: { rodzaj: 'motyw', element: 'wb:gwiazdki', szerokosc: 4.5, kolor: '#d9b977' },
      },
      korzen: {
        id: 'rewers-korzen',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'rewers-medalion',
            typ: 'tekst',
            tekst: 'KARTY',
            wieleWierszy: false,
            pozycja: { x: 10, y: 39 },
            szerokosc: { mm: 43 },
            wysokosc: { mm: 10 },
            styl: {
              czcionka: 'tytul',
              rozmiar: pt(13),
              wariant: 'pogrubiony',
              wyrownanie: 'srodek',
              kolor: '#f2dfb0',
              odstepLiter: 1.2,
            },
          },
        ],
      },
    },
  },
];

for (const { wpis, szablon, rewers } of POZYCJE) {
  const bajty = spakujSzablon(szablon, rewers);
  writeFileSync(resolve(KATALOG_WYJSCIOWY, wpis.plik), bajty);
}

const manifest = {
  wersja: 1,
  szablony: POZYCJE.map((p) => p.wpis),
};

writeFileSync(
  resolve(KATALOG_WYJSCIOWY, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(`Wygenerowano ${POZYCJE.length} szablonów galerii w ${KATALOG_WYJSCIOWY}`);
