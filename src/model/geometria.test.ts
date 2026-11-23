import { describe, expect, it } from 'vitest';
import { przecinajaSie, zaokraglij } from './geometria';
import { bezZnakowDiakrytycznych, normalizujNazwe } from './nazwy';

describe('geometria', () => {
  it('przecięcie: wspólne wnętrze tak, styk krawędzi i prostokąt zerowy nie', () => {
    const a = { x: 0, y: 0, szer: 10, wys: 10 };
    expect(przecinajaSie(a, { x: 5, y: 5, szer: 10, wys: 10 })).toBe(true);
    expect(przecinajaSie(a, { x: 10, y: 0, szer: 5, wys: 5 })).toBe(false);
    expect(przecinajaSie(a, { x: 5, y: 5, szer: 0, wys: 3 })).toBe(false);
  });

  it('zaokrąglanie do zadanej liczby miejsc', () => {
    expect(zaokraglij(1.23456)).toBe(1.23);
    expect(zaokraglij(1.23456, 3)).toBe(1.235);
    expect(zaokraglij(2.5, 0)).toBe(3);
  });
});

describe('nazwy', () => {
  it('bez znaków diakrytycznych, z zachowaniem wielkości liter', () => {
    expect(bezZnakowDiakrytycznych('Łódź Żółć')).toBe('Lodz Zolc');
  });

  it('normalizacja nazwy do porównań', () => {
    expect(normalizujNazwe('  Ilość ')).toBe('ilosc');
    expect(normalizujNazwe('ŁUK')).toBe('luk');
  });
});
