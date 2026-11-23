/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importujOzdobnik } from '../../dane/archiwum';
import { BladDanych } from '../../dane/schemat';
import { paczkaOzdobnikaZPliku } from './plikiOzdobnikow';
import { filtrujWpisy } from './StronaBiblioteki';

describe('Biblioteki (N7)', () => {
  it('wyszukiwarka: fragment nazwy bez wielkości liter i znaków diakrytycznych', () => {
    const wpisy = [{ nazwa: 'Łąka.png' }, { nazwa: 'Smok.png' }, { nazwa: 'ŁUK' }];
    expect(filtrujWpisy(wpisy, 'lu').map((w) => w.nazwa)).toEqual(['ŁUK']);
    expect(filtrujWpisy(wpisy, ' laka ').map((w) => w.nazwa)).toEqual(['Łąka.png']);
    expect(filtrujWpisy(wpisy, '')).toHaveLength(3);
  });

  it('SVG dodany wprost do biblioteki staje się poprawną paczką ozdobnika', async () => {
    const svg = readFileSync('testy/zasoby/gwiazdka.svg');
    const paczka = await paczkaOzdobnikaZPliku(
      new File([svg], 'gwiazdka.svg', { type: 'image/svg+xml' }),
    );
    const { element, zasoby } = importujOzdobnik(paczka);
    expect(element.nazwa).toBe('gwiazdka');
    expect(element.kolorowanie).toBe('jednolity');
    expect(zasoby).toHaveLength(0);
  });

  it('nieczytelny SVG jest odrzucany z komunikatem z nazwą pliku', async () => {
    const wynik = paczkaOzdobnikaZPliku(
      new File(['to nie jest SVG'], 'zly.svg', { type: 'image/svg+xml' }),
    );
    await expect(wynik).rejects.toBeInstanceOf(BladDanych);
    await expect(wynik).rejects.toThrow(/zly\.svg/);
  });
});
