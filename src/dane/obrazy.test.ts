import { describe, expect, it } from 'vitest';
import { opisObrazu, orientacjaExif } from './obrazy';

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
function jpegZOrientacja(o: number, le: boolean): Uint8Array {
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
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, dl >> 8, dl & 0xff, ...app1, 0xff, 0xd9]);
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
