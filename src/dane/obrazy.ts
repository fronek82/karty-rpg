import { formatujLiczbe, t } from '../i18n';
import type { OpisObrazu } from '../model/projekt';
import { formatObrazu, identyfikatorZNazwy, unikalneId } from './czcionki';
import { BladDanych } from './schemat';

export const MAKS_BAJTOW_OBRAZU = 20 * 1024 * 1024;
/** Bezpieczny limit powierzchni kanwy (Safari na iOS: ~16,7 Mpx). */
export const MAKS_PIKSELI = 16_000_000;

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
      t('dane.zaDuzy', { plik: nazwaPliku, mb: formatujLiczbe(dane.length / 1024 / 1024, 1) }),
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
/** Segmenty nagłówka JPEG (do początku danych obrazu): znacznik, początek i koniec treści. */
function* segmentyJpeg(dane: Uint8Array): Generator<{ znacznik: number; od: number; do: number }> {
  if (dane[0] !== 0xff || dane[1] !== 0xd8) return;
  const v = new DataView(dane.buffer, dane.byteOffset, dane.byteLength);
  let i = 2;
  while (i + 4 <= dane.length) {
    if (dane[i] !== 0xff) return;
    while (dane[i + 1] === 0xff && i + 5 <= dane.length) i++; // bajty wypełniające 0xFF
    const znacznik = dane[i + 1]!;
    if (znacznik === 0xda || znacznik === 0xd9) return; // początek danych obrazu / koniec pliku
    const dlugosc = v.getUint16(i + 2);
    if (dlugosc < 2 || i + 2 + dlugosc > dane.length) return;
    yield { znacznik, od: i + 4, do: i + 2 + dlugosc };
    i += 2 + dlugosc;
  }
}

/**
 * Orientacja EXIF zdjęcia JPEG (1–8) albo undefined, gdy jej brak. Zdjęcia z telefonu często
 * mają 6 lub 8 (obrót o 90°): przeglądarka obraca je przy wyświetlaniu, a PDF (pdf-lib) nie –
 * dlatego obraz z orientacją ≠ 1 jest przy wgrywaniu przekodowywany z zastosowanym obrotem.
 * Odczyt ograniczony do segmentu APP1 (uszkodzony EXIF nie sięga do danych obrazu).
 */
export function orientacjaExif(dane: Uint8Array): number | undefined {
  const v = new DataView(dane.buffer, dane.byteOffset, dane.byteLength);
  for (const s of segmentyJpeg(dane)) {
    if (s.znacznik !== 0xe1 || s.do - s.od < 14) continue;
    if (String.fromCharCode(...dane.subarray(s.od, s.od + 6)) !== 'Exif\0\0') continue;
    const tiff = s.od + 6;
    const le = dane[tiff] === 0x49; // „II” – little endian, „MM” – big endian
    if (!le && dane[tiff] !== 0x4d) return undefined;
    const ifd = tiff + v.getUint32(tiff + 4, le);
    if (ifd + 2 > s.do) return undefined;
    const liczba = v.getUint16(ifd, le);
    for (let n = 0; n < liczba; n++) {
      const wpis = ifd + 2 + n * 12;
      if (wpis + 12 > s.do) return undefined;
      // Znacznik 0x0112 (Orientation), typ 3 (SHORT).
      if (v.getUint16(wpis, le) === 0x0112 && v.getUint16(wpis + 2, le) === 3) {
        const o = v.getUint16(wpis + 8, le);
        return o >= 1 && o <= 8 ? o : undefined;
      }
    }
    return undefined;
  }
  return undefined;
}

/** Wymiary zapisanego obrazu JPEG (z nagłówka SOF, bez orientacji EXIF). */
export function wymiaryJpeg(dane: Uint8Array): { szerokosc: number; wysokosc: number } | undefined {
  const v = new DataView(dane.buffer, dane.byteOffset, dane.byteLength);
  for (const s of segmentyJpeg(dane)) {
    const z = s.znacznik;
    // SOF0–SOF15 bez DHT (C4), JPG (C8), DAC (CC).
    if (z >= 0xc0 && z <= 0xcf && z !== 0xc4 && z !== 0xc8 && z !== 0xcc && s.do - s.od >= 5) {
      return { wysokosc: v.getUint16(s.od + 1), szerokosc: v.getUint16(s.od + 3) };
    }
  }
  return undefined;
}

/**
 * Przekształcenie kanwy (a, b, c, d, e, f) rysujące obraz zapisany w rozmiarze `szer` × `wys`
 * tak, jak wskazuje orientacja EXIF; kanwa wynikowa ma wymiary z `wymiaryPoObrocie`.
 */
export function macierzOrientacji(
  o: number,
  szer: number,
  wys: number,
): [number, number, number, number, number, number] {
  switch (o) {
    case 2:
      return [-1, 0, 0, 1, szer, 0];
    case 3:
      return [-1, 0, 0, -1, szer, wys];
    case 4:
      return [1, 0, 0, -1, 0, wys];
    case 5:
      return [0, 1, 1, 0, 0, 0];
    case 6:
      return [0, 1, -1, 0, wys, 0];
    case 7:
      return [0, -1, -1, 0, wys, szer];
    case 8:
      return [0, -1, 1, 0, 0, szer];
    default:
      return [1, 0, 0, 1, 0, 0];
  }
}

export const wymiaryPoObrocie = (o: number, szer: number, wys: number) =>
  o >= 5 && o <= 8 ? { szerokosc: wys, wysokosc: szer } : { szerokosc: szer, wysokosc: wys };

/** Wymiary obrazu PNG/JPG z nagłówka pliku (JPEG z orientacją EXIF), bez dekodowania. */
export function wymiaryPliku(
  dane: Uint8Array,
): { szerokosc: number; wysokosc: number } | undefined {
  const format = formatObrazu(dane);
  const v = new DataView(dane.buffer, dane.byteOffset, dane.byteLength);
  if (format === 'png')
    return v.byteLength >= 33 && v.getUint32(12) === 0x49484452
      ? { szerokosc: v.getUint32(16), wysokosc: v.getUint32(20) }
      : undefined;
  if (format !== 'jpg') return undefined;
  const surowe = wymiaryJpeg(dane);
  return surowe && wymiaryPoObrocie(orientacjaExif(dane) ?? 1, surowe.szerokosc, surowe.wysokosc);
}
