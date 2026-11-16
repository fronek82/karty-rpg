import { describe, expect, it } from 'vitest';
import type { Kontener, Pole, Wezel } from '../model/szablon';
import { rozmiesc, zmierz, type KontekstUkladu, type UlozonyWezel } from './uklad';

/** Pole testowe: ikona o zadanym rozmiarze treści. */
const pole = (id: string, bok: number, extra: Partial<Pole> = {}): Pole =>
  ({ id, typ: 'ikona', ikona: 'gwiazdka', rozmiar: bok, ...extra }) as Pole;

const ctx = (ukryte: string[] = []): KontekstUkladu => ({
  zmierzPole: (p) =>
    p.typ === 'ikona' ? { szer: p.rozmiar, wys: p.rozmiar } : { szer: 0, wys: 0 },
  czyUkryty: (w) => ukryte.includes(w.id),
});

const prost = (u: UlozonyWezel) =>
  [u.x, u.y, u.szer, u.wys].map((v) => Math.round(v * 1000) / 1000);
const znajdz = (u: UlozonyWezel, id: string): UlozonyWezel | undefined =>
  u.wezel.id === id ? u : u.dzieci.map((d) => znajdz(d, id)).find(Boolean);

function wiersz(dzieci: Wezel[], extra: Partial<Kontener> = {}): Kontener {
  return { id: 'w', typ: 'wiersz', dzieci, ...extra };
}

describe('wiersz', () => {
  it('stałe, auto i wypełnienie z wagami', () => {
    const k = wiersz([
      pole('a', 5, { szerokosc: { mm: 10 } }),
      pole('b', 4),
      pole('c', 1, { szerokosc: { wypelnij: 1 } }),
      pole('d', 1, { szerokosc: { wypelnij: 3 } }),
    ]);
    const u = rozmiesc(k, 0, 0, 54, 20, ctx());
    expect(u.dzieci.map(prost)).toEqual([
      [0, 0, 10, 20],
      [10, 0, 4, 20],
      [14, 0, 10, 20],
      [24, 0, 30, 20],
    ]);
  });

  it('padding, odstęp, procenty i marginesy', () => {
    const k = wiersz(
      [
        pole('a', 1, { szerokosc: { procent: 50 } }),
        pole('b', 1, { szerokosc: { wypelnij: 1 }, margines: { lewo: 1 } }),
      ],
      { padding: 2, odstep: 1 },
    );
    const u = rozmiesc(k, 0, 0, 24, 10, ctx());
    expect(u.dzieci.map(prost)).toEqual([
      [2, 2, 10, 6],
      [14, 2, 8, 6],
    ]);
  });

  it('wyrównanie w osi poprzecznej daje rozmiar wg treści', () => {
    const k = wiersz([
      pole('a', 4, { wyrownanie: { pionowo: 'koniec' } }),
      pole('b', 4, { wyrownanie: { pionowo: 'srodek' } }),
    ]);
    const u = rozmiesc(k, 0, 0, 20, 10, ctx());
    expect(u.dzieci.map(prost)).toEqual([
      [0, 6, 4, 4],
      [4, 3, 4, 4],
    ]);
  });

  it('rozkład „miedzy” i „srodek”', () => {
    const miedzy = rozmiesc(
      wiersz([pole('a', 2), pole('b', 2), pole('c', 2)], { rozklad: 'miedzy' }),
      0,
      0,
      20,
      2,
      ctx(),
    );
    expect(miedzy.dzieci.map((d) => d.x)).toEqual([0, 9, 18]);
    const srodek = rozmiesc(wiersz([pole('a', 2)], { rozklad: 'srodek' }), 0, 0, 20, 2, ctx());
    expect(srodek.dzieci[0]!.x).toBe(9);
  });

  it('ukryte dziecko nie zajmuje miejsca', () => {
    const u = rozmiesc(
      wiersz([pole('a', 2), pole('b', 5), pole('c', 2)], { odstep: 1 }),
      0,
      0,
      20,
      5,
      ctx(['b']),
    );
    expect(u.dzieci.map((d) => d.wezel.id)).toEqual(['a', 'c']);
    expect(u.dzieci[1]!.x).toBe(3);
  });
});

describe('kolumna', () => {
  it('zagnieżdżony wiersz w kolumnie z wypełnieniem', () => {
    const k: Kontener = {
      id: 'k',
      typ: 'kolumna',
      dzieci: [
        pole('naglowek', 1, { wysokosc: { mm: 6 } }),
        wiersz([pole('x', 3)], { id: 'srodek', wysokosc: { wypelnij: 1 } }),
        pole('stopka', 2),
      ],
    };
    const u = rozmiesc(k, 0, 0, 25, 25, ctx());
    expect(prost(znajdz(u, 'naglowek')!)).toEqual([0, 0, 25, 6]);
    expect(prost(znajdz(u, 'srodek')!)).toEqual([0, 6, 25, 17]);
    expect(prost(znajdz(u, 'x')!)).toEqual([0, 6, 3, 17]);
    expect(prost(znajdz(u, 'stopka')!)).toEqual([0, 23, 25, 2]);
  });

  it('zmierz sumuje dzieci i odstępy', () => {
    const k: Kontener = {
      id: 'k',
      typ: 'kolumna',
      odstep: 1,
      padding: 1,
      dzieci: [pole('a', 3), pole('b', 5)],
    };
    expect(zmierz(k, {}, ctx())).toEqual({ szer: 7, wys: 11 });
  });
});

describe('warstwy', () => {
  it('nakłada dzieci i wyrównuje w rogach', () => {
    const k: Kontener = {
      id: 'k',
      typ: 'warstwy',
      padding: 1,
      dzieci: [
        pole('tlo', 1),
        pole('lg', 3, { wyrownanie: { poziomo: 'poczatek', pionowo: 'poczatek' } }),
        pole('pg', 4, { wyrownanie: { poziomo: 'koniec', pionowo: 'poczatek' } }),
        pole('ld', 2, { wyrownanie: { poziomo: 'poczatek', pionowo: 'koniec' } }),
      ],
    };
    const u = rozmiesc(k, 0, 0, 20, 20, ctx());
    expect(u.dzieci.map(prost)).toEqual([
      [1, 1, 18, 18],
      [1, 1, 3, 3],
      [15, 1, 4, 4],
      [1, 17, 2, 2],
    ]);
  });
});
