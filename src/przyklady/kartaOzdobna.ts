import { t } from '../i18n';
import type { Przyklad } from './typy';

const BRAZ = '#5b3a1e';

/**
 * Karta ozdobna z elementów wbudowanych (bez własnych plików): ramka z motywu z narożnikami,
 * separator z zakończeniami i środkiem, panel z podwójną linią i wartość w kształcie rombu.
 */
export function przyklad(): Przyklad {
  return {
    szablon: {
      id: 'ozdobna',
      nazwa: t('przyklad.ozdobna.nazwa'),
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      promienRogow: 3,
      tlo: '#f3e6c8',
      ramka: {
        grubosc: 0.3,
        kolor: '#000000',
        narozniki: { element: 'wb:lisc', rozmiar: 5 },
        ozdoba: { rodzaj: 'motyw', element: 'wb:pnacze', szerokosc: 5, kolor: BRAZ },
      },
      korzen: {
        id: 'karta',
        typ: 'kolumna',
        padding: 3,
        odstep: 1.5,
        dzieci: [
          {
            id: 'tytul',
            typ: 'tekst',
            klucz: 'tytul',
            wieleWierszy: false,
            styl: {
              czcionka: 'tresc',
              rozmiar: 4.2333333333333325,
              wariant: 'pogrubiony',
              wyrownanie: 'srodek',
            },
          },
          {
            id: 'dekor',
            typ: 'separator',
            kierunek: 'poziomy',
            grubosc: 0.3,
            kolor: BRAZ,
            zakonczenia: { element: 'wb:zak-grot', rozmiar: 2.4 },
            srodek: { element: 'wb:sr-romb', rozmiar: 2.4 },
            odstepOdOzdoby: 0.4,
          },
          {
            id: 'opis',
            typ: 'tekst',
            klucz: 'opis',
            wysokosc: { wypelnij: 1 },
            padding: 1.5,
            tlo: '#ffffff',
            promien: 1,
            obramowanie: { grubosc: 0.3, kolor: BRAZ, styl: 'podwojna' },
            styl: { czcionka: 'tresc', rozmiar: 3.175 },
          },
          {
            id: 'wartosc',
            typ: 'wartosc',
            klucz: 'wartosc',
            szerokosc: { mm: 16 },
            padding: 0.8,
            wyrownanie: { poziomo: 'poczatek', pionowo: 'poczatek' },
            tlo: '#fff8e6',
            obramowanie: { grubosc: 0.3, kolor: '#000000' },
            styl: { czcionka: 'tresc', rozmiar: 3.175, wariant: 'pogrubiony' },
            ksztalt: 'romb',
          },
        ],
      },
    },
    dane: {
      tytul: t('przyklad.ozdobna.dane.tytul'),
      opis: t('przyklad.ozdobna.dane.opis'),
      wartosc: '7',
    },
  };
}
