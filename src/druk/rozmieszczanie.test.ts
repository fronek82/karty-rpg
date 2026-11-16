import { describe, expect, it } from 'vitest';
import type { Karta } from '../model/szablon';
import {
  egzemplarze,
  rozmiescKarty,
  type Egzemplarz,
  type UmieszczonaKarta,
} from './rozmieszczanie';

const SLOT = { szerokosc: 10, wysokosc: 10 };
const karta = (id: string, ilosc: number): Karta => ({ id, szablonId: 's', dane: {}, ilosc });
const lista = (spec: [string, number, number, number][]): Egzemplarz[] =>
  egzemplarze(
    spec.map(([id, ilosc]) => karta(id, ilosc)),
    (k) => {
      const [, , kol, rz] = spec.find(([id]) => id === k.id)!;
      return { kolumny: kol, rzedy: rz };
    },
  );

/** Sprawdza: brak nakładania, wszystko w siatce. */
function poprawne(karty: UmieszczonaKarta[], kolumny: number, rzedy: number) {
  const zajete = new Set<string>();
  for (const c of karty) {
    const k0 = Math.round(c.xRegionu / SLOT.szerokosc) + c.kolumna;
    expect(k0 + c.kolumny).toBeLessThanOrEqual(kolumny);
    expect(c.rzad + c.rzedy).toBeLessThanOrEqual(rzedy);
    for (let x = k0; x < k0 + c.kolumny; x++)
      for (let y = c.rzad; y < c.rzad + c.rzedy; y++) {
        const klucz = `${c.strona}:${x}:${y}`;
        expect(zajete.has(klucz), `nakładanie w ${klucz}`).toBe(false);
        zajete.add(klucz);
      }
  }
}

describe('egzemplarze', () => {
  it('rozwija karty wg ilości, pomija 0 i ułamki w dół', () => {
    const e = egzemplarze([karta('a', 2), karta('b', 0), karta('c', 1.7)], () => ({
      kolumny: 1,
      rzedy: 1,
    }));
    expect(e.map((x) => `${x.karta.id}${x.numer}`)).toEqual(['a0', 'a1', 'c0']);
  });
});

describe('rozmiescKarty bez grup', () => {
  it('mieszane rozmiary wypełniają siatkę bez dziur i bez nakładania', () => {
    // 4×3 = 12 slotów: 2× (1×2) + 2× (2×1) + 4× (1×1).
    const e = lista([
      ['mala', 4, 1, 1],
      ['pionowa', 2, 1, 2],
      ['pozioma', 2, 2, 1],
    ]);
    const w = rozmiescKarty(e, { szer: 40, wys: 30, slot: SLOT });
    expect(w.liczbaStron).toBe(1);
    expect(w.karty).toHaveLength(8);
    poprawne(w.karty, 4, 3);
  });

  it('nadmiar przechodzi na kolejną stronę', () => {
    const w = rozmiescKarty(lista([['a', 7, 1, 1]]), { szer: 20, wys: 20, slot: SLOT });
    expect(w.liczbaStron).toBe(2);
    expect(w.karty.filter((c) => c.strona === 1)).toHaveLength(3);
  });

  it('przypięte karty są na swoich miejscach, reszta w wolnych', () => {
    const w = rozmiescKarty(
      lista([
        ['a', 2, 1, 1],
        ['b', 1, 2, 1],
      ]),
      { szer: 30, wys: 20, slot: SLOT },
      {
        przypiete: [{ kartaId: 'a', kolumna: 2, rzad: 1 }],
      },
    );
    expect(
      w.karty.find((c) => c.karta.id === 'a' && c.kolumna === 2 && c.rzad === 1),
    ).toBeDefined();
    poprawne(w.karty, 3, 2);
    expect(w.ostrzezenia).toEqual([]);
  });

  it('kolizja przypięć i nadmiarowe przypięcie dają ostrzeżenia', () => {
    const w = rozmiescKarty(
      lista([['a', 2, 1, 1]]),
      { szer: 30, wys: 20, slot: SLOT },
      {
        przypiete: [
          { kartaId: 'a', kolumna: 0, rzad: 0 },
          { kartaId: 'a', kolumna: 0, rzad: 0 },
          { kartaId: 'a', kolumna: 1, rzad: 0 },
          { kartaId: 'a', kolumna: 2, rzad: 0 },
        ],
      },
    );
    // Drugie przypięcie koliduje (egzemplarz zostaje do rozmieszczenia), trzecie go zużywa,
    // czwarte nie ma już egzemplarza.
    expect(w.ostrzezenia).toEqual(['przypiecie-koliduje:a@0,0', 'przypiecie-bez-karty:a']);
    expect(w.karty).toHaveLength(2);
  });

  it('karta większa niż strona jest pomijana z ostrzeżeniem', () => {
    const w = rozmiescKarty(lista([['duza', 1, 3, 1]]), { szer: 20, wys: 20, slot: SLOT });
    expect(w.karty).toHaveLength(0);
    expect(w.ostrzezenia).toEqual(['karta-wieksza-niz-strona:duza']);
  });
});

describe('rozmiescKarty z grupami', () => {
  it('grupa dostaje tyle kolumn, ile trzeba przy pełnej wysokości; grupy z odstępem', () => {
    const e = lista([
      ['a', 7, 1, 1],
      ['b', 2, 1, 1],
    ]);
    const w = rozmiescKarty(
      e,
      { szer: 100, wys: 30, slot: SLOT },
      {
        grupy: {
          lista: [
            { id: 'A', kartyIds: ['a'] },
            { id: 'B', kartyIds: ['b'] },
          ],
          odstep: 3,
        },
      },
    );
    expect(w.regiony).toEqual([
      { strona: 0, grupaId: 'A', x: 0, kolumny: 3 },
      { strona: 0, grupaId: 'B', x: 33, kolumny: 1 },
    ]);
    // Kolumna po kolumnie: 7 kart w 3 rzędach → kolumny 0,0,0,1,1,1,2.
    expect(w.karty.filter((c) => c.grupaId === 'A').map((c) => `${c.kolumna}${c.rzad}`)).toEqual([
      '00',
      '01',
      '02',
      '10',
      '11',
      '12',
      '20',
    ]);
  });

  it('grupa, która się nie mieści, zaczyna się na następnej stronie', () => {
    const e = lista([
      ['a', 4, 1, 1],
      ['b', 4, 1, 1],
    ]);
    const w = rozmiescKarty(
      e,
      { szer: 35, wys: 20, slot: SLOT },
      {
        grupy: {
          lista: [
            { id: 'A', kartyIds: ['a'] },
            { id: 'B', kartyIds: ['b'] },
          ],
          odstep: 3,
        },
      },
    );
    expect(w.regiony.map((r) => `${r.grupaId}@${r.strona}`)).toEqual(['A@0', 'B@1']);
    expect(w.liczbaStron).toBe(2);
  });
});
