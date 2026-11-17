// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { odczytajKalibracje, zapiszKalibracje } from './kalibracja';

describe('kalibracja drukarki (localStorage)', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('zapis i odczyt; brak zapisu – zero', () => {
    expect(odczytajKalibracje()).toEqual({ x: 0, y: 0 });
    zapiszKalibracje({ x: 1.5, y: -0.5 });
    expect(odczytajKalibracje()).toEqual({ x: 1.5, y: -0.5 });
  });

  it('wartości spoza ±20 mm, NaN i uszkodzony zapis – zero', () => {
    localStorage.setItem('karty-rpg:kalibracja', JSON.stringify({ x: 25, y: 'a' }));
    expect(odczytajKalibracje()).toEqual({ x: 0, y: 0 });
    localStorage.setItem('karty-rpg:kalibracja', '{nie json');
    expect(odczytajKalibracje()).toEqual({ x: 0, y: 0 });
  });

  it('zablokowany zapis nie rzuca wyjątku', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });
    expect(() => zapiszKalibracje({ x: 1, y: 1 })).not.toThrow();
  });
});
