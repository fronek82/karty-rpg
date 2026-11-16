import { describe, expect, it } from 'vitest';
import {
  macierzOrientacji,
  opisObrazu,
  orientacjaExif,
  wymiaryJpeg,
  wymiaryPoObrocie,
} from './obrazy';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
const W = { szerokosc: 10, wysokosc: 20 };

describe('opisObrazu', () => {
  it('format z sygnatury, unikalne id z nazwy pliku', () => {
    expect(opisObrazu('Miecz Łucznika.png', PNG, W, new Set())).toEqual({
      rodzaj: 'obraz',
      id: 'obraz-Miecz-Lucznika',
      nazwa: 'Miecz Łucznika.png',
      format: 'png',
      szerokosc: 10,
      wysokosc: 20,
    });
    expect(opisObrazu('zdjecie.png', JPG, W, new Set(['obraz-zdjecie'])).format).toBe('jpg');
    expect(opisObrazu('zdjecie.png', JPG, W, new Set(['obraz-zdjecie'])).id).toBe(
      'obraz-zdjecie-2',
    );
  });

  it('odrzuca inne formaty i złe wymiary', () => {
    expect(() => opisObrazu('a.gif', new Uint8Array([71, 73, 70]), W, new Set())).toThrow(
      /nie jest obrazem PNG ani JPG/,
    );
    expect(() => opisObrazu('a.png', PNG, { szerokosc: 0, wysokosc: 1 }, new Set())).toThrow();
  });
});

/** Minimalny JPEG: SOI + APP1 Exif z jednym wpisem IFD0 (orientacja) + EOI. */
function jpegZOrientacja(o: number, le: boolean, przed: number[] = []): Uint8Array {
  const tiff = new Uint8Array(8 + 2 + 12 + 4);
  const v = new DataView(tiff.buffer);
  tiff.set(le ? [0x49, 0x49] : [0x4d, 0x4d]);
  v.setUint16(2, 42, le);
  v.setUint32(4, 8, le);
  v.setUint16(8, 1, le);
  v.setUint16(10, 0x0112, le);
  v.setUint16(12, 3, le);
  v.setUint32(14, 1, le);
  v.setUint16(18, o, le);
  const app1 = [...new TextEncoder().encode('Exif'), 0, 0, ...tiff];
  const dl = app1.length + 2;
  return new Uint8Array([
    0xff,
    0xd8,
    ...przed,
    0xff,
    0xe1,
    dl >> 8,
    dl & 0xff,
    ...app1,
    0xff,
    0xd9,
  ]);
}

describe('orientacjaExif', () => {
  it('odczyt w obu porządkach bajtów; brak EXIF i PNG → undefined', () => {
    expect(orientacjaExif(jpegZOrientacja(6, true))).toBe(6);
    expect(orientacjaExif(jpegZOrientacja(8, false))).toBe(8);
    expect(orientacjaExif(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBeUndefined();
    expect(orientacjaExif(PNG)).toBeUndefined();
    // Uszkodzony segment nie wywraca odczytu.
    expect(orientacjaExif(jpegZOrientacja(6, true).subarray(0, 20))).toBeUndefined();
  });
});

/** Segment z nagłówkiem i treścią (długość liczona automatycznie). */
const seg = (znacznik: number, tresc: number[]) => [
  0xff,
  znacznik,
  (tresc.length + 2) >> 8,
  (tresc.length + 2) & 0xff,
  ...tresc,
];

describe('orientacjaExif – przypadki brzegowe', () => {
  it('APP0 JFIF i APP1 XMP przed Exif, bajty wypełniające 0xFF', () => {
    const jfif = seg(0xe0, [...new TextEncoder().encode('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
    const xmp = seg(0xe1, [...new TextEncoder().encode('http://ns.adobe.com/xap/1.0/'), 0]);
    expect(orientacjaExif(jpegZOrientacja(8, true, [...jfif, ...xmp]))).toBe(8);
    expect(orientacjaExif(jpegZOrientacja(6, true, [0xff, 0xff]))).toBe(6);
  });

  it('orientacja 1 i spoza zakresu; IFD poza segmentem', () => {
    expect(orientacjaExif(jpegZOrientacja(1, true))).toBe(1);
    expect(orientacjaExif(jpegZOrientacja(9, true))).toBeUndefined();
    const zly = jpegZOrientacja(6, true);
    // Przesunięcie IFD0 (bajty 4–7 nagłówka TIFF) wskazuje poza APP1.
    new DataView(zly.buffer).setUint32(2 + 4 + 6 + 4, 500, true);
    expect(orientacjaExif(zly)).toBeUndefined();
  });

  it('wymiaryJpeg z SOF0 (także po APP1)', () => {
    const sof = seg(0xc0, [8, 0, 20, 0, 40, 3, 1, 0x11, 0, 2, 0x11, 1, 3, 0x11, 1]);
    const j = jpegZOrientacja(6, true, sof);
    expect(wymiaryJpeg(j)).toEqual({ szerokosc: 40, wysokosc: 20 });
    expect(wymiaryJpeg(PNG)).toBeUndefined();
  });
});

describe('macierzOrientacji', () => {
  /** Gdzie trafia piksel (x, y) obrazu zapisanego po przekształceniu. */
  const punkt = (o: number, x: number, y: number) => {
    const [a, b, c, d, e, f] = macierzOrientacji(o, 40, 20);
    return [a * x + c * y + e, b * x + d * y + f];
  };
  it('lewy górny róg zapisanego obrazu ląduje tam, gdzie wskazuje orientacja', () => {
    // 6 – obrót o 90° zgodnie z zegarem: lewy górny → prawy górny (kanwa 20 × 40).
    expect(punkt(6, 0, 0)).toEqual([20, 0]);
    expect(punkt(6, 40, 0)).toEqual([20, 40]);
    // 8 – obrót o 90° przeciwnie: lewy górny → lewy dolny.
    expect(punkt(8, 0, 0)).toEqual([0, 40]);
    // 3 – obrót o 180°.
    expect(punkt(3, 0, 0)).toEqual([40, 20]);
    expect(punkt(1, 5, 7)).toEqual([5, 7]);
    expect(wymiaryPoObrocie(6, 40, 20)).toEqual({ szerokosc: 20, wysokosc: 40 });
    expect(wymiaryPoObrocie(3, 40, 20)).toEqual({ szerokosc: 40, wysokosc: 20 });
  });
});
