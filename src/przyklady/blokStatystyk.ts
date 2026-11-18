import { pt } from '../model/jednostki';
import { t } from '../i18n';
import { tresc } from './pomoc';
import type { Przyklad } from './typy';

const KOLUMNY = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const WARTOSCI = [1, 2, 3, 4, 5, 6, 7, 8];
const LINIA = '#5a4630';

/**
 * Blok statystyk (karta pozioma 88×63): nazwa kapitalikami, tabela z nagłówkami, separator
 * i wyjustowany opis z wcięciem pierwszego wiersza akapitu.
 */
export function przyklad(): Przyklad {
  return {
    szablon: {
      id: 'statystyki',
      nazwa: t('przyklad.statystyki.nazwa'),
      rozmiar: { tryb: 'mm', szerokosc: 88, wysokosc: 63 },
      tlo: '#f3ead2',
      ramka: { grubosc: 0.4, kolor: LINIA },
      korzen: {
        id: 'karta',
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
            id: 'tabela',
            typ: 'tabela',
            kolumny: KOLUMNY.map((c) => ({ naglowek: c, klucz: `kolumna_${c.toLowerCase()}` })),
            styl: tresc(7),
            tloNaglowka: '#e2d3ae',
            linie: { grubosc: 0.2, kolor: LINIA },
            paddingKomorki: 0.5,
          },
          { id: 'kreska', typ: 'separator', kierunek: 'poziomy', grubosc: 0.3, kolor: LINIA },
          {
            id: 'opis',
            typ: 'tekst',
            klucz: 'opis',
            wysokosc: { wypelnij: 1 },
            styl: tresc(7, { wyrownanie: 'justuj', wciecie: 2, minRozmiar: pt(5) }),
          },
        ],
      },
    },
    dane: {
      nazwa: t('przyklad.statystyki.dane.nazwa'),
      ...Object.fromEntries(
        KOLUMNY.map((c, i) => [`kolumna_${c.toLowerCase()}`, String(WARTOSCI[i])]),
      ),
      opis: t('przyklad.statystyki.dane.opis'),
    },
  };
}
