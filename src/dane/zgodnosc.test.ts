import { describe, expect, it } from 'vitest';
import type { Projekt } from '../model/projekt';
import type { Rewers, Szablon } from '../model/szablon';
import {
  dopasujZawartosc,
  elementyPozaKarta,
  niezgodnosc,
  opisRozmiaru,
  powiazania,
} from './zgodnosc';

const przod = (id: string, szer = 63, wys = 88, zmiany: Partial<Szablon> = {}): Szablon => ({
  id,
  nazwa: id,
  rozmiar: { tryb: 'mm', szerokosc: szer, wysokosc: wys },
  korzen: { id: `${id}-k`, typ: 'swobodny', dzieci: [] },
  ...zmiany,
});
const tyl = (id: string, szer = 63, wys = 88): Rewers => ({
  id,
  nazwa: id,
  rozmiar: { tryb: 'mm', szerokosc: szer, wysokosc: wys },
  korzen: { id: `${id}-k`, typ: 'swobodny', dzieci: [] },
});

describe('niezgodnosc', () => {
  it('rozmiar, orientacja i rogi; tył bez rogów pasuje do dowolnych', () => {
    expect(niezgodnosc({ szer: 63, wys: 88, promien: 3 }, { szer: 63, wys: 88 })).toBeUndefined();
    expect(niezgodnosc({ szer: 63, wys: 88 }, { szer: 57, wys: 89 })).toEqual({
      rozmiar: true,
      orientacja: false,
      rogi: false,
    });
    expect(niezgodnosc({ szer: 63, wys: 88 }, { szer: 88, wys: 63 })?.orientacja).toBe(true);
    expect(
      niezgodnosc({ szer: 63, wys: 88, promien: 3 }, { szer: 63, wys: 88, promien: 0 })?.rogi,
    ).toBe(true);
    expect(opisRozmiaru({ szer: 63.5, wys: 88 })).toBe('63,5×88');
  });
});

describe('powiazania', () => {
  it('tył używany przez przody: przypisanie szablonu i kart (także przez talię)', () => {
    const p = {
      szablony: [przod('A', 63, 88, { rewersId: 'T' }), przod('B'), przod('C'), przod('pusty')],
      rewersy: [tyl('T'), tyl('U')],
      talie: [
        {
          id: 't1',
          nazwa: 't1',
          rewersId: 'T',
          karty: [{ id: 'k1', szablonId: 'B', dane: {}, ilosc: 1 }],
        },
        {
          id: 't2',
          nazwa: 't2',
          karty: [{ id: 'k2', szablonId: 'C', dane: {}, ilosc: 1, rewersId: 'U' }],
        },
      ],
    } as unknown as Projekt;
    expect(powiazania(p, 'tyl', 'T').map((x) => x.id)).toEqual(['A', 'B']);
    expect(powiazania(p, 'tyl', 'U').map((x) => x.id)).toEqual(['C']);
    expect(powiazania(p, 'przod', 'A').map((x) => x.id)).toEqual(['T']);
    expect(powiazania(p, 'przod', 'pusty')).toEqual([]);
  });
});

describe('dopasujZawartosc', () => {
  const s = przod('S', 60, 80, {
    korzen: {
      id: 'k',
      typ: 'swobodny',
      dzieci: [
        {
          id: 'e',
          typ: 'tekst',
          tekst: 'x',
          szerokosc: { mm: 30 },
          wysokosc: { mm: 10 },
          pozycja: { x: 6, y: 8 },
        },
      ],
    },
  } as Partial<Szablon>);

  it('skaluje położenie i rozmiary (mm) osobno w obu osiach', () => {
    const w = dopasujZawartosc(s, { szer: 60, wys: 80 }, { szer: 30, wys: 160 }, 'skaluj');
    expect(w.korzen.dzieci[0]).toMatchObject({
      szerokosc: { mm: 15 },
      wysokosc: { mm: 20 },
      pozycja: { x: 3, y: 16 },
    });
  });

  it('zagnieżdżony kontener swobodny w mm: rozmiar i położenia dzieci skalowane razem', () => {
    const z = przod('Z', 60, 80, {
      korzen: {
        id: 'k',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'w',
            typ: 'swobodny',
            szerokosc: { mm: 40 },
            wysokosc: { mm: 40 },
            pozycja: { x: 10, y: 10 },
            dzieci: [{ id: 'd', typ: 'tekst', tekst: 'x', pozycja: { x: 20, y: 20 } }],
          },
        ],
      },
    } as Partial<Szablon>);
    const w = dopasujZawartosc(z, { szer: 60, wys: 80 }, { szer: 30, wys: 40 }, 'skaluj');
    const wew = w.korzen.dzieci[0] as Szablon['korzen'];
    expect(wew).toMatchObject({ szerokosc: { mm: 20 }, pozycja: { x: 5, y: 5 } });
    expect(wew.dzieci[0]).toMatchObject({ pozycja: { x: 10, y: 10 } });
  });

  it('„zostaw” nie zmienia szablonu', () => {
    expect(dopasujZawartosc(s, { szer: 60, wys: 80 }, { szer: 30, wys: 40 }, 'zostaw')).toBe(s);
  });

  it('elementy poza kartą', () => {
    const wezly = [
      { id: 'k', x: 0, y: 0, szer: 30, wys: 40 },
      { id: 'w', x: 1, y: 1, szer: 10, wys: 10 },
      { id: 'poza', x: 25, y: 1, szer: 10, wys: 10 },
    ];
    expect([...elementyPozaKarta(wezly, 30, 40, 'k')]).toEqual(['poza']);
  });
});
