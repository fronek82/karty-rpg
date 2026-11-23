import { formatujLiczbe, t } from '../i18n';
import type { OpisCzcionki, ZrodloCzcionki } from '../model/projekt';
import type { WariantCzcionki } from '../model/szablon';
import { BladKolekcjiCzcionek, Czcionka, wczytajCzcionke } from '../silnik/czcionki';
import { BladDanych } from './schemat';
import { bezZnakowDiakrytycznych } from '../model/nazwy';

export const FORMATY_CZCIONEK = ['ttf', 'otf', 'woff', 'woff2'] as const;
export type FormatCzcionki = (typeof FORMATY_CZCIONEK)[number];
export const MAKS_BAJTOW_CZCIONKI = 25 * 1024 * 1024;

export function formatCzcionkiZNazwy(nazwaPliku: string): FormatCzcionki | undefined {
  const rozszerzenie = nazwaPliku.split('.').pop()?.toLowerCase();
  return FORMATY_CZCIONEK.find((f) => f === rozszerzenie);
}

/** Format obrazu z sygnatury pliku (nie z rozszerzenia). */
export function formatObrazu(dane: Uint8Array): 'png' | 'jpg' | undefined {
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => dane[i] === b)) return 'png';
  if (dane[0] === 0xff && dane[1] === 0xd8 && dane[2] === 0xff) return 'jpg';
  return undefined;
}

/** Wariant z metadanych: grubość ≥ 600 = pogrubiony, bit kursywy w OS/2 lub head. */
export function wariantCzcionki(grubosc: number, kursywa: boolean): WariantCzcionki {
  const pogrubiony = grubosc >= 600;
  if (pogrubiony && kursywa) return 'pogrubiona-kursywa';
  if (pogrubiony) return 'pogrubiony';
  return kursywa ? 'kursywa' : 'normalny';
}

/** Bezpieczny identyfikator zasobu z nazwy (litery, cyfry, `_`, `-`, `.`). */
export function identyfikatorZNazwy(nazwa: string, przedrostek: string): string {
  const baza = bezZnakowDiakrytycznych(nazwa)
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${przedrostek}-${baza || 'plik'}`;
}

/** `id`, a gdy zajęte – `id-2`, `id-3`, … */
export function unikalneId(id: string, zajete: ReadonlySet<string>, limit = Infinity): string {
  let wynik = id;
  for (let n = 2; zajete.has(wynik); n++) {
    const sufiks = `-${n}`;
    wynik = id.slice(0, limit - sufiks.length) + sufiks;
  }
  return wynik;
}

export interface WgranaCzcionka {
  opis: OpisCzcionki;
  dane: Uint8Array;
  czcionka: Czcionka;
}

/**
 * Sprawdza plik czcionki (fontkit: TTF, OTF, WOFF, WOFF2) i zwraca jej opis do biblioteki.
 * Rodzinę i wariant bierze z metadanych pliku; użytkownik może je poprawić w interfejsie.
 * Id zasobu (unikalne względem `zajete`) jest id czcionki w silniku, więc glify z różnych
 * czcionek się nie mieszają.
 */
export function wgrajCzcionke(
  nazwaPliku: string,
  dane: Uint8Array,
  {
    zrodlo = 'wlasna',
    zajete = new Set(),
  }: { zrodlo?: ZrodloCzcionki; zajete?: ReadonlySet<string> } = {},
): WgranaCzcionka {
  const format = formatCzcionkiZNazwy(nazwaPliku);
  if (!format) throw new BladDanych(t('dane.zlyFormatCzcionki', { plik: nazwaPliku }));
  if (dane.length > MAKS_BAJTOW_CZCIONKI) {
    throw new BladDanych(
      t('dane.zaDuzy', { plik: nazwaPliku, mb: formatujLiczbe(dane.length / 1024 / 1024, 1) }),
    );
  }
  const bezRozszerzenia = nazwaPliku.replace(/\.[^.]+$/, '');
  const id = unikalneId(identyfikatorZNazwy(bezRozszerzenia, 'czcionka'), zajete);
  let czcionka: Czcionka;
  try {
    czcionka = wczytajCzcionke(id, dane);
  } catch (e) {
    throw new BladDanych(
      e instanceof BladKolekcjiCzcionek
        ? t('dane.czcionkaKolekcja', { plik: nazwaPliku })
        : t('dane.nieczytelnaCzcionka', { plik: nazwaPliku }),
    );
  }
  const info = czcionka.metadane();
  return {
    opis: {
      rodzaj: 'czcionka',
      id,
      nazwa: nazwaPliku,
      rodzina: info.rodzina || bezRozszerzenia,
      wariant: wariantCzcionki(info.grubosc, info.kursywa),
      format,
      zrodlo,
    },
    dane,
    czcionka,
  };
}
