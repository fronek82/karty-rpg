import { t } from '../i18n';
import type { OpisCzcionki, ZrodloCzcionki } from '../model/projekt';
import type { WariantCzcionki } from '../model/szablon';
import { Czcionka, wczytajCzcionke } from '../silnik/czcionki';
import { BladDanych } from './schemat';

const FORMATY = ['ttf', 'otf', 'woff', 'woff2'] as const;
const MAKS_BAJTOW = 25 * 1024 * 1024;

function wariantZNazwy(styl: string): WariantCzcionki {
  const pogrubiony = /bold|black|heavy/i.test(styl);
  const kursywa = /italic|oblique/i.test(styl);
  if (pogrubiony && kursywa) return 'pogrubiona-kursywa';
  if (pogrubiony) return 'pogrubiony';
  return kursywa ? 'kursywa' : 'normalny';
}

/** Bezpieczny identyfikator zasobu z nazwy (litery, cyfry, `_`, `-`, `.`). */
export function identyfikatorZNazwy(nazwa: string, przedrostek: string): string {
  const baza = nazwa
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${przedrostek}-${baza || 'plik'}`;
}

export interface WgranaCzcionka {
  opis: OpisCzcionki;
  dane: Uint8Array;
  czcionka: Czcionka;
}

/**
 * Sprawdza plik czcionki (fontkit: TTF, OTF, WOFF, WOFF2) i zwraca jej opis do biblioteki.
 * Rodzinę i wariant bierze z metadanych pliku; użytkownik może je poprawić w interfejsie.
 * Id zasobu jest id czcionki w silniku, więc glify z różnych czcionek się nie mieszają.
 */
export function wgrajCzcionke(
  nazwaPliku: string,
  dane: Uint8Array,
  zrodlo: ZrodloCzcionki = 'wlasna',
): WgranaCzcionka {
  const format = nazwaPliku.split('.').pop()?.toLowerCase();
  const znany = FORMATY.find((f) => f === format);
  if (!znany) throw new BladDanych(t('dane.zlyFormatCzcionki', { plik: nazwaPliku }));
  if (dane.length > MAKS_BAJTOW) {
    throw new BladDanych(
      t('dane.zaDuzy', { plik: nazwaPliku, mb: (dane.length / 1024 / 1024).toFixed(1) }),
    );
  }
  const id = identyfikatorZNazwy(nazwaPliku.replace(/\.[^.]+$/, ''), 'czcionka');
  let czcionka: Czcionka;
  try {
    czcionka = wczytajCzcionke(id, dane);
  } catch (e) {
    const powod = e instanceof Error ? e.message : String(e);
    throw new BladDanych(
      powod.includes('kolekcją')
        ? t('dane.czcionkaKolekcja', { plik: nazwaPliku })
        : t('dane.nieczytelnaCzcionka', { plik: nazwaPliku, powod }),
    );
  }
  const info = czcionka.metadane();
  return {
    opis: {
      rodzaj: 'czcionka',
      id,
      nazwa: nazwaPliku,
      rodzina: info.rodzina || nazwaPliku.replace(/\.[^.]+$/, ''),
      wariant: wariantZNazwy(info.styl),
      format: znany,
      zrodlo,
    },
    dane,
    czcionka,
  };
}
