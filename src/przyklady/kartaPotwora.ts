import { pt } from '../model/jednostki';
import { t } from '../i18n';
import { tresc } from './pomoc';
import type { Przyklad } from './typy';

const KOLOR = '#9b1c1c';

/** Wartość w rombie z etykietą nad nim; stała szerokość, więc romby są równe. */
const wartoscWRombie = (n: number) => ({
  id: `wartosc${n}`,
  typ: 'wartosc' as const,
  klucz: `wartosc${n}`,
  ksztalt: 'romb' as const,
  szerokosc: { mm: 11 },
  minWysokosc: 12,
  obramowanie: { grubosc: 0.35, kolor: KOLOR },
  styl: tresc(9, { wariant: 'pogrubiony' }),
  etykieta: {
    tekst: t('przyklad.potwor.etykieta.wartosc', { n }),
    pozycja: 'nad' as const,
    styl: {
      czcionka: 'tresc',
      rozmiar: pt(4.5),
      minRozmiar: pt(3.5),
      wariant: 'pogrubiony' as const,
      kolor: KOLOR,
    },
  },
});

const poleZEtykieta = (id: 'lista' | 'dodatki' | 'opis', kursywa = false) => ({
  id,
  typ: 'tekst' as const,
  klucz: id,
  gdyPuste: 'ukryj' as const,
  styl: tresc(7, kursywa ? { wariant: 'kursywa' } : {}),
  ...(kursywa
    ? {}
    : {
        etykieta: {
          tekst: t(`przyklad.potwor.etykieta.${id as 'lista' | 'dodatki'}`),
          pozycja: 'przed' as const,
          styl: { wariant: 'pogrubiony' as const },
        },
      }),
});

/**
 * Karta potwora: zagnieżdżony nagłówek (nazwa i podtytuł obok wartości), rząd wartości
 * w rombach, separator i pola, które znikają, gdy są puste (tu: ostatnie).
 */
export function przyklad(): Przyklad {
  return {
    szablon: {
      id: 'potwor',
      nazwa: t('przyklad.potwor.nazwa'),
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      tlo: '#fbf7ee',
      korzen: {
        id: 'karta',
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
                    id: 'podtytul',
                    typ: 'tekst',
                    klucz: 'podtytul',
                    styl: tresc(7, { wariant: 'kursywa' }),
                  },
                ],
              },
              wartoscWRombie(1),
            ],
          },
          {
            id: 'wartosci',
            typ: 'wiersz',
            rozklad: 'miedzy',
            dzieci: [2, 3, 4, 5].map(wartoscWRombie),
          },
          { id: 'kreska', typ: 'separator', kierunek: 'poziomy', grubosc: 0.3, kolor: KOLOR },
          poleZEtykieta('lista'),
          poleZEtykieta('dodatki'),
          poleZEtykieta('opis', true),
        ],
      },
    },
    dane: {
      nazwa: t('przyklad.potwor.dane.nazwa'),
      podtytul: t('przyklad.potwor.dane.podtytul'),
      wartosc1: '3',
      wartosc2: '14',
      wartosc3: '4',
      wartosc4: '2',
      wartosc5: '3',
      lista: t('przyklad.potwor.dane.lista'),
      dodatki: t('przyklad.potwor.dane.dodatki'),
    },
  };
}
