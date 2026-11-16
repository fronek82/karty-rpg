import { t } from '../i18n';
import type { OpisObrazu } from '../model/projekt';
import { formatObrazu, identyfikatorZNazwy, unikalneId } from './czcionki';
import { BladDanych } from './schemat';

export const MAKS_BAJTOW_OBRAZU = 20 * 1024 * 1024;

/**
 * Opis obrazu do biblioteki projektu. Format z sygnatury pliku (nie z rozszerzenia), wymiary
 * w pikselach odczytuje wołający (w przeglądarce `createImageBitmap`), id unikalne w projekcie.
 */
export function opisObrazu(
  nazwaPliku: string,
  dane: Uint8Array,
  wymiary: { szerokosc: number; wysokosc: number },
  zajete: ReadonlySet<string>,
): OpisObrazu {
  const format = formatObrazu(dane);
  if (!format) throw new BladDanych(t('dane.zlyObraz', { plik: nazwaPliku }));
  if (dane.length > MAKS_BAJTOW_OBRAZU) {
    throw new BladDanych(
      t('dane.zaDuzy', { plik: nazwaPliku, mb: (dane.length / 1024 / 1024).toFixed(1) }),
    );
  }
  if (!(wymiary.szerokosc > 0 && wymiary.wysokosc > 0)) {
    throw new BladDanych(t('dane.zlyObraz', { plik: nazwaPliku }));
  }
  const id = unikalneId(identyfikatorZNazwy(nazwaPliku.replace(/\.[^.]+$/, ''), 'obraz'), zajete);
  return {
    rodzaj: 'obraz',
    id,
    nazwa: nazwaPliku,
    format,
    szerokosc: wymiary.szerokosc,
    wysokosc: wymiary.wysokosc,
  };
}
