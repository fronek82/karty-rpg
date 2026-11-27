import { describe, expect, it } from 'vitest';
import { miesciSieWSiatce, pierwszeWolneMiejsce, zajeteKafelki } from './siatkaMausritter';

describe('siatka kafelków Mausritter (UI2 R8)', () => {
  const A4 = { kolumny: 7, rzedy: 10 };

  it('wylicza zajęte kafelki dla kart 1×1, 1×2, 2×1 i 2×2', () => {
    const z = zajeteKafelki([
      { kolumna: 0, rzad: 0, kolumny: 1, rzedy: 1 },
      { kolumna: 1, rzad: 0, kolumny: 2, rzedy: 1 },
      { kolumna: 0, rzad: 1, kolumny: 1, rzedy: 2 },
      { kolumna: 3, rzad: 2, kolumny: 2, rzedy: 2 },
    ]);
    expect(z.size).toBe(1 + 2 + 2 + 4);
    expect(z.has('0,0')).toBe(true);
    expect(z.has('2,0')).toBe(true);
    expect(z.has('0,2')).toBe(true);
    expect(z.has('4,3')).toBe(true);
    expect(z.has('5,3')).toBe(false);
  });

  it('sprawdza granice siatki i kolizje z zajętymi kafelkami', () => {
    const z = zajeteKafelki([{ kolumna: 2, rzad: 1, kolumny: 1, rzedy: 1 }]);
    // Karta 2×2 przy prawej lub dolnej krawędzi się nie mieści.
    expect(miesciSieWSiatce(A4, { kolumna: 6, rzad: 0 }, { kolumny: 2, rzedy: 2 }, z)).toBe(false);
    expect(miesciSieWSiatce(A4, { kolumna: 0, rzad: 9 }, { kolumny: 2, rzedy: 2 }, z)).toBe(false);
    // Karta 2×2 nachodząca na (2,1) się nie mieści.
    expect(miesciSieWSiatce(A4, { kolumna: 1, rzad: 0 }, { kolumny: 2, rzedy: 2 }, z)).toBe(false);
    // Karta 2×2 na (0,0) mieści się bez kolizji.
    expect(miesciSieWSiatce(A4, { kolumna: 0, rzad: 0 }, { kolumny: 2, rzedy: 2 }, z)).toBe(true);
  });

  it('znajduje pierwsze wolne miejsce dla karty 1×1 i 2×2', () => {
    const z = zajeteKafelki([
      { kolumna: 0, rzad: 0, kolumny: 2, rzedy: 1 },
      { kolumna: 2, rzad: 0, kolumny: 5, rzedy: 1 },
    ]);
    // Cały pierwszy rząd (0) jest zajęty → pierwsze wolne miejsce to (0, 1).
    expect(pierwszeWolneMiejsce(A4, { kolumny: 1, rzedy: 1 }, z)).toEqual({ kolumna: 0, rzad: 1 });
    expect(pierwszeWolneMiejsce(A4, { kolumny: 2, rzedy: 2 }, z)).toEqual({ kolumna: 0, rzad: 1 });
    // Brak miejsca na pełnej siatce 2×2.
    const pelna = zajeteKafelki([{ kolumna: 0, rzad: 0, kolumny: 2, rzedy: 2 }]);
    expect(
      pierwszeWolneMiejsce({ kolumny: 2, rzedy: 2 }, { kolumny: 1, rzedy: 1 }, pelna),
    ).toBeUndefined();
  });
});
