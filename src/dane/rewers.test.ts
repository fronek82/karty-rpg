import { describe, expect, it } from 'vitest';
import type { Projekt } from '../model/projekt';
import type { Szablon } from '../model/szablon';
import { przodRewersu } from './rewers';

const szablon = (id: string, rewersId?: string): Szablon =>
  ({
    id,
    nazwa: id,
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    korzen: { id: `k-${id}`, typ: 'kolumna', dzieci: [] },
    ...(rewersId ? { rewersId } : {}),
  }) as Szablon;

const projekt = (p: Partial<Projekt>): Projekt =>
  ({ szablony: [], talie: [], rewersy: [{ id: 'r1' }, { id: 'r2' }], ...p }) as unknown as Projekt;

describe('przodRewersu', () => {
  it('najpierw szablon z przypisanym tyłem', () => {
    const p = projekt({ szablony: [szablon('a'), szablon('b', 'r1')] });
    expect(przodRewersu(p, 'r1')?.id).toBe('b');
  });

  it('potem szablon pierwszej karty z tym tyłem (karta lub talia)', () => {
    const p = projekt({
      szablony: [szablon('a'), szablon('b', 'r2')],
      talie: [
        {
          id: 't',
          nazwa: 't',
          rewersId: 'r1',
          karty: [
            { id: 'k1', szablonId: 'b', dane: {}, ilosc: 1 },
            { id: 'k2', szablonId: 'a', dane: {}, ilosc: 1 },
          ],
        },
      ],
    });
    expect(przodRewersu(p, 'r1')?.id).toBe('a');
    expect(przodRewersu(p, 'r2')?.id).toBe('b');
  });

  it('tył bez przypisania – brak przodu', () => {
    expect(przodRewersu(projekt({ szablony: [szablon('a')] }), 'r1')).toBeUndefined();
  });
});
