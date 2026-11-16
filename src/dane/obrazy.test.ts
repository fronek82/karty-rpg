import { describe, expect, it } from 'vitest';
import { opisObrazu } from './obrazy';

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
