import { t } from '../i18n';
import type { Przyklad } from './typy';

const AKCENT = '#7d2240';

/**
 * Karta swobodna: kontener, w którym każde pole ma własne położenie i rozmiar w mm – pole
 * zastępujące ilustrację (kolorowy pas), tytuł, wartość w kole, tekst obrócony o 90° i opis
 * w kolumnie. Bez obrazów, więc nie potrzebuje żadnych zasobów.
 */
export function przyklad(): Przyklad {
  return {
    szablon: {
      id: 'swobodna',
      nazwa: t('przyklad.swobodna.nazwa'),
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      promienRogow: 3,
      tlo: '#f4ecd8',
      korzen: {
        id: 'karta',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'pas',
            nazwa: t('przyklad.swobodna.wezel.pas'),
            typ: 'kolumna',
            pozycja: { x: 0, y: 0 },
            szerokosc: { mm: 63 },
            wysokosc: { mm: 46 },
            tlo: '#c9b99a',
            dzieci: [],
          },
          {
            id: 'tytul',
            nazwa: t('przyklad.swobodna.wezel.tytul'),
            typ: 'tekst',
            klucz: 'tytul',
            pozycja: { x: 6, y: 34 },
            szerokosc: { mm: 51 },
            wysokosc: { mm: 12 },
            styl: {
              czcionka: 'tytul',
              rozmiar: 5.5,
              wariant: 'pogrubiony',
              wyrownanie: 'srodek',
              wyrownaniePionowe: 'srodek',
            },
          },
          {
            id: 'wartosc',
            nazwa: t('przyklad.swobodna.wezel.wartosc'),
            typ: 'wartosc',
            klucz: 'wartosc',
            ksztalt: 'kolo',
            pozycja: { x: 3, y: 3 },
            szerokosc: { mm: 12 },
            wysokosc: { mm: 12 },
            tlo: '#fff8e6',
            obramowanie: { grubosc: 0.4, kolor: AKCENT },
            styl: { czcionka: 'tresc', rozmiar: 5, wariant: 'pogrubiony' },
          },
          {
            id: 'rodzaj',
            nazwa: t('przyklad.swobodna.wezel.rodzaj'),
            typ: 'tekst',
            klucz: 'rodzaj',
            pozycja: { x: 57, y: 8, obrot: 90 },
            szerokosc: { mm: 40 },
            wysokosc: { mm: 4.5 },
            styl: { czcionka: 'tresc', rozmiar: 2.8, wariant: 'kursywa', kolor: AKCENT },
          },
          {
            id: 'tlo-opisu',
            nazwa: t('przyklad.swobodna.wezel.opis'),
            typ: 'kolumna',
            pozycja: { x: 4, y: 50 },
            szerokosc: { mm: 55 },
            wysokosc: { mm: 30 },
            dzieci: [
              {
                id: 'opis',
                typ: 'tekst',
                klucz: 'opis',
                wysokosc: { wypelnij: 1 },
                styl: { czcionka: 'tresc', rozmiar: 3.4 },
              },
            ],
          },
        ],
      },
    },
    dane: {
      tytul: t('przyklad.swobodna.dane.tytul'),
      wartosc: '3',
      rodzaj: t('przyklad.swobodna.dane.rodzaj'),
      opis: t('przyklad.swobodna.dane.opis'),
    },
  };
}
