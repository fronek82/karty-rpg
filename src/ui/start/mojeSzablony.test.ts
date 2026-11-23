import { describe, expect, it } from 'vitest';
import { filtrujISortuj } from './mojeSzablony';

const lista = [
  { nazwa: 'Żółw', zmieniono: '2026-11-02' },
  { nazwa: 'arkusz postaci', zmieniono: '2026-11-03' },
  { nazwa: 'Broń 10', zmieniono: '2026-11-01' },
  { nazwa: 'Broń 2', zmieniono: '2026-11-04' },
];
const nazwy = (l: { nazwa: string }[]) => l.map((x) => x.nazwa);

describe('filtrujISortuj', () => {
  it('szuka fragmentu nazwy bez wielkości liter i znaków diakrytycznych', () => {
    expect(nazwy(filtrujISortuj(lista, 'bron', 'nazwa-az'))).toEqual(['Broń 2', 'Broń 10']);
    expect(nazwy(filtrujISortuj(lista, ' ZOLW ', 'nazwa-az'))).toEqual(['Żółw']);
    expect(filtrujISortuj(lista, 'xyz', 'nazwa-az')).toEqual([]);
  });

  it('sortuje po dacie zmiany i po nazwie (liczby naturalnie)', () => {
    expect(nazwy(filtrujISortuj(lista, '', 'zmiana-nowe'))[0]).toBe('Broń 2');
    expect(nazwy(filtrujISortuj(lista, '', 'zmiana-stare'))[0]).toBe('Broń 10');
    expect(nazwy(filtrujISortuj(lista, '', 'nazwa-az')).slice(0, 3)).toEqual([
      'arkusz postaci',
      'Broń 2',
      'Broń 10',
    ]);
    expect(nazwy(filtrujISortuj(lista, '', 'nazwa-za'))[0]).toBe('Żółw');
    // Oryginał bez zmian.
    expect(nazwy(lista)[0]).toBe('Żółw');
  });
});
