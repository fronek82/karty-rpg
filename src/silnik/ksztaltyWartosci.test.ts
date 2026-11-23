import { describe, expect, it } from 'vitest';
import { pt } from '../model/jednostki';
import type { KsztaltWartosci, PoleWartosc, Szablon } from '../model/szablon';
import { renderujKarte } from './karta';
import {
  FIGURY,
  konturFigury,
  liczbaRamion,
  proporcjeFigury,
  wnetrzeFigury,
  wpiszProporcje,
} from './ksztaltyWartosci';
import type { ElementSceny, Kontur } from './scena';
import { rejestrTestowy } from './__testy__/pomoc';

const ctx = { czcionki: rejestrTestowy(), obraz: () => undefined };

/** Karta z jednym polem wartości o stałym rozmiarze (pole wypełnia całą kartę). */
function karta(pole: Partial<PoleWartosc>, szer = 20, wys = 20): Szablon {
  return {
    id: 's',
    nazwa: 's',
    rozmiar: { tryb: 'mm', szerokosc: szer, wysokosc: wys },
    korzen: {
      id: 'korzen',
      typ: 'kolumna',
      dzieci: [
        {
          id: 'w',
          typ: 'wartosc',
          ksztalt: 'romb',
          tekst: '7',
          wysokosc: { wypelnij: 1 },
          tlo: '#eeeeee',
          obramowanie: { grubosc: 0.3, kolor: '#000000' },
          styl: { czcionka: 'tresc', rozmiar: pt(10) },
          ...pole,
        } as PoleWartosc,
      ],
    },
  };
}

function granice(k: Kontur) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const c of k)
    if (c[0] !== 'Z')
      for (let i = 1; i < c.length; i += 2) {
        xs.push(c[i] as number);
        ys.push(c[i + 1] as number);
      }
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, szer: Math.max(...xs) - x, wys: Math.max(...ys) - y };
}

/** Granice tła kształtu (ścieżka z wypełnieniem). */
function tloKsztaltu(s: Szablon) {
  const scena = renderujKarte(s, { dane: {} }, ctx).scena;
  const tlo = scena.elementy.find(
    (e): e is Extract<ElementSceny, { typ: 'sciezka' }> => e.typ === 'sciezka' && !!e.wypelnienie,
  );
  return granice(tlo!.kontur);
}

describe('figury wartości', () => {
  it('wnętrze każdej figury leży w figurze i jest wyśrodkowane w poziomie', () => {
    for (const f of FIGURY) {
      const w = wnetrzeFigury(f);
      expect(w.szer, f).toBeGreaterThan(0.15);
      expect(w.x + w.szer / 2, f).toBeCloseTo(0.5, 6);
      expect(w.x, f).toBeGreaterThanOrEqual(0);
      expect(w.y + w.wys, f).toBeLessThanOrEqual(1);
    }
    // Trójkąt: środek treści w środku ciężkości (2/3 wysokości od wierzchołka).
    const t = wnetrzeFigury('trojkat');
    expect(t.y + t.wys / 2).toBeCloseTo(2 / 3, 6);
  });

  it('naturalne proporcje: trójkąt równoboczny, ośmiokąt foremny, gwiazda zależna od ramion', () => {
    expect(proporcjeFigury('trojkat')).toBeCloseTo(2 / Math.sqrt(3), 6);
    expect(proporcjeFigury('osmiokat')).toBeCloseTo(1, 6);
    expect(proporcjeFigury('gwiazda', 4)).toBeCloseTo(1, 6);
    expect(proporcjeFigury('gwiazda', 5)).not.toBeCloseTo(proporcjeFigury('gwiazda', 6), 3);
  });

  it('gwiazda ma 2 × ramiona wierzchołków; liczba ramion w granicach 3–12', () => {
    const r = { x: 0, y: 0, szer: 10, wys: 10 };
    expect(konturFigury('gwiazda', r).length).toBe(11);
    expect(konturFigury('gwiazda', r, 0, 8).length).toBe(17);
    expect([liczbaRamion(undefined), liczbaRamion(1), liczbaRamion(40)]).toEqual([5, 3, 12]);
  });

  it('wcięcie przesuwa boki wielokąta do środka', () => {
    const r = { x: 0, y: 0, szer: 10, wys: 10 };
    const g = granice(konturFigury('osmiokat', r, 0.5));
    expect(g.x).toBeCloseTo(0.5, 6);
    expect(g.szer).toBeCloseTo(9, 6);
  });

  it('wpiszProporcje: największa ramka o danych proporcjach, wyśrodkowana', () => {
    expect(wpiszProporcje({ x: 0, y: 0, szer: 20, wys: 10 }, 1)).toEqual({
      x: 5,
      y: 0,
      szer: 10,
      wys: 10,
    });
  });
});

describe('wartość w kształcie – proporcje i etykieta', () => {
  const ksztalty: KsztaltWartosci[] = ['romb', 'tarcza', 'szesciokat', ...FIGURY];

  it('etykieta (nad, pod, obok) nie zmienia proporcji kształtu', () => {
    for (const ksztalt of ksztalty) {
      const bez = tloKsztaltu(karta({ ksztalt }));
      const proporcje = bez.szer / bez.wys;
      for (const pozycja of ['nad', 'pod', 'lewo', 'prawo'] as const) {
        const z = tloKsztaltu(karta({ ksztalt, etykieta: { tekst: 'SIŁA', pozycja } }));
        expect(z.szer / z.wys, `${ksztalt} ${pozycja}`).toBeCloseTo(proporcje, 6);
      }
    }
  });

  it('zmiana rozmiaru pola skaluje kształt proporcjonalnie i wyśrodkowuje go', () => {
    const g = tloKsztaltu(karta({ ksztalt: 'gwiazda' }, 40, 20));
    expect(g.szer / g.wys).toBeCloseTo(proporcjeFigury('gwiazda'), 6);
    expect(g.wys).toBeCloseTo(20, 6);
    expect(g.x + g.szer / 2).toBeCloseTo(20, 6);
  });

  it('bez „Zachowaj proporcje” kształt wypełnia dostępne miejsce (jak przed schematem 28)', () => {
    const g = tloKsztaltu(karta({ ksztalt: 'romb', zachowajProporcje: false }, 30, 20));
    expect(g).toEqual({ x: 0, y: 0, szer: 30, wys: 20 });
  });

  it('etykieta obok: kształt w pozostałej części pola, po drugiej stronie etykiety', () => {
    const lewo = tloKsztaltu(
      karta({ ksztalt: 'romb', etykieta: { tekst: 'SIŁA', pozycja: 'lewo' } }, 30, 10),
    );
    const prawo = tloKsztaltu(
      karta({ ksztalt: 'romb', etykieta: { tekst: 'SIŁA', pozycja: 'prawo' } }, 30, 10),
    );
    expect(lewo.x + lewo.szer).toBeGreaterThan(prawo.x + prawo.szer);
    expect(lewo.wys).toBeCloseTo(10, 6);
  });

  it('pole o rozmiarze wg treści ma proporcje kształtu, a etykieta je powiększa, nie zniekształca', () => {
    const s = (etykieta?: PoleWartosc['etykieta']): Szablon =>
      karta({
        ksztalt: 'trojkat',
        etykieta,
        wysokosc: undefined,
        wyrownanie: { poziomo: 'poczatek', pionowo: 'poczatek' },
      });
    const wezel = (sz: Szablon) =>
      renderujKarte(sz, { dane: {} }, ctx).wezly.find((w) => w.id === 'w')!;
    const bez = wezel(s());
    expect(bez.szer / bez.wys).toBeCloseTo(proporcjeFigury('trojkat'), 6);
    const z = wezel(s({ tekst: 'X', pozycja: 'prawo', odstep: 1 }));
    expect(z.wys).toBeCloseTo(bez.wys, 6);
    expect(z.szer).toBeGreaterThan(bez.szer + 1);
  });
});
