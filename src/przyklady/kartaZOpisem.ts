import { pt } from '../model/jednostki';
import { t } from '../i18n';
import { tresc } from './pomoc';
import type { Przyklad } from './typy';

const TLO = '#2f5d8a';
const BIALY = '#ffffff';

const komorka = (id: 'koszt' | 'czas' | 'miejsce' | 'waga') => ({
  id,
  typ: 'tekst' as const,
  klucz: id,
  szerokosc: { wypelnij: 1 },
  padding: 0.8,
  tlo: BIALY,
  styl: tresc(8, { wyrownanie: 'srodek' }),
  etykieta: {
    tekst: t(`przyklad.opis.etykieta.${id}`),
    pozycja: 'nad' as const,
    styl: { czcionka: 'tresc', rozmiar: pt(5.5), wariant: 'pogrubiony' as const, kolor: TLO },
  },
});

/**
 * Karta z opisem: kolorowa karta, nazwa, siatka 2×2 etykieta/wartość, długi opis w białym panelu
 * (tekst wyjustowany, zmniejszany do miejsca) i stopka z dwoma polami.
 */
export function przyklad(): Przyklad {
  return {
    szablon: {
      id: 'opis',
      nazwa: t('przyklad.opis.nazwa'),
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      promienRogow: 3,
      tlo: TLO,
      ramka: { grubosc: 0.3, kolor: BIALY, odsuniecie: 1 },
      korzen: {
        id: 'karta',
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
            tlo: TLO,
            promien: 1.5,
            dzieci: [
              {
                id: 'w1',
                typ: 'wiersz',
                odstep: 0.4,
                dzieci: [komorka('koszt'), komorka('czas')],
              },
              {
                id: 'w2',
                typ: 'wiersz',
                odstep: 0.4,
                dzieci: [komorka('miejsce'), komorka('waga')],
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
                id: 'kategoria',
                typ: 'tekst',
                klucz: 'kategoria',
                wieleWierszy: false,
                styl: tresc(7, { wariant: 'kursywa', kolor: BIALY }),
              },
              {
                id: 'rodzaj',
                typ: 'tekst',
                klucz: 'rodzaj',
                wieleWierszy: false,
                styl: tresc(7, { wariant: 'kursywa', kolor: BIALY }),
              },
            ],
          },
        ],
      },
    },
    dane: {
      koszt: '2',
      ...Object.fromEntries(
        (['nazwa', 'czas', 'miejsce', 'waga', 'opis', 'kategoria', 'rodzaj'] as const).map((k) => [
          k,
          t(`przyklad.opis.dane.${k}`),
        ]),
      ),
    },
  };
}
