import { describe, expect, it } from 'vitest';
import { pasujeDoSlotu, polozenieKarty } from './arkusz';

const slot = { szerokosc: 63.5, wysokosc: 89 };
const karta = (szerokosc: number, wysokosc: number) => ({ szerokosc, wysokosc });

describe('pasujeDoSlotu', () => {
  it('bez dopasowania – tolerancja 0,5 mm w obie strony (jak przed M2b-1)', () => {
    expect(pasujeDoSlotu(karta(63.5, 89), slot)).toBe(true);
    expect(pasujeDoSlotu(karta(63, 88.5), slot)).toBe(true);
    expect(pasujeDoSlotu(karta(63, 88), slot)).toBe(false);
    expect(pasujeDoSlotu(karta(64, 89.5), slot)).toBe(true);
    expect(pasujeDoSlotu(karta(64.1, 89), slot)).toBe(false);
  });
  it('luz dopuszcza kartę mniejszą, większa – nadal tylko o 0,5 mm', () => {
    expect(pasujeDoSlotu(karta(63, 88), slot, { luz: 1 })).toBe(true);
    expect(pasujeDoSlotu(karta(62, 88), slot, { luz: 1 })).toBe(false);
    expect(pasujeDoSlotu(karta(63, 88), slot, { luz: 0 })).toBe(false);
    expect(pasujeDoSlotu(karta(58.5, 84), slot, { luz: 5 })).toBe(true);
    expect(pasujeDoSlotu(karta(64.1, 89), slot, { luz: 5 })).toBe(false);
  });
});

describe('polozenieKarty', () => {
  const obszar = { x: 10, y: 20, szer: 63.5, wys: 89 };
  it('środek albo lewy górny róg; karta większa od obszaru nie wychodzi w lewo/w górę', () => {
    expect(polozenieKarty(obszar, { szer: 63, wys: 88 })).toEqual({ x: 10.25, y: 20.5 });
    expect(polozenieKarty(obszar, { szer: 63, wys: 88 }, { polozenie: 'lewy-gorny' })).toEqual({
      x: 10,
      y: 20,
    });
    expect(polozenieKarty(obszar, { szer: 64, wys: 89.5 })).toEqual({ x: 10, y: 20 });
  });
});
