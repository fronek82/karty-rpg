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

/**
 * Orientacja EXIF zdjęcia JPEG (1–8) albo undefined, gdy jej brak. Zdjęcia z telefonu często
 * mają 6 lub 8 (obrót o 90°): przeglądarka obraca je przy wyświetlaniu, a PDF (pdf-lib) nie –
 * dlatego obraz z orientacją ≠ 1 jest przy wgrywaniu przekodowywany z zastosowanym obrotem.
 */
export function orientacjaExif(dane: Uint8Array): number | undefined {
  if (dane[0] !== 0xff || dane[1] !== 0xd8) return undefined;
  const v = new DataView(dane.buffer, dane.byteOffset, dane.byteLength);
  let i = 2;
  while (i + 4 <= dane.length) {
    if (dane[i] !== 0xff) return undefined;
    const znacznik = dane[i + 1]!;
    if (znacznik === 0xda || znacznik === 0xd9) return undefined; // początek danych obrazu
    const dlugosc = v.getUint16(i + 2);
    if (znacznik === 0xe1 && i + 10 <= dane.length) {
      const exif = String.fromCharCode(...dane.subarray(i + 4, i + 10));
      if (exif === 'Exif\0\0') {
        const tiff = i + 10;
        if (tiff + 8 > dane.length) return undefined;
        const le = dane[tiff] === 0x49; // „II” – little endian, „MM” – big endian
        const u16 = (o: number) => v.getUint16(o, le);
        const ifd = tiff + v.getUint32(tiff + 4, le);
        if (ifd + 2 > dane.length) return undefined;
        const liczba = u16(ifd);
        for (let n = 0; n < liczba; n++) {
          const wpis = ifd + 2 + n * 12;
          if (wpis + 12 > dane.length) return undefined;
          if (u16(wpis) === 0x0112) {
            const o = u16(wpis + 8);
            return o >= 1 && o <= 8 ? o : undefined;
          }
        }
        return undefined;
      }
    }
    i += 2 + dlugosc;
  }
  return undefined;
}
