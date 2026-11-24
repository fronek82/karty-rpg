import { describe, expect, it } from 'vitest';
import type { Projekt } from '../model/projekt';
import type { Szablon } from '../model/szablon';
import { przodyDoPrzypisania } from './zgodnoscTylu';

const przod = (id: string, rewersId?: string): Szablon => ({
  id,
  nazwa: id,
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
  korzen: { id: `${id}-k`, typ: 'swobodny', dzieci: [] },
  ...(rewersId ? { rewersId } : {}),
});
const karta = (id: string, szablonId: string, rewersId?: string) => ({
  id,
  szablonId,
  dane: {},
  ilosc: 1,
  ...(rewersId ? { rewersId } : {}),
});
const projekt = (karty: ReturnType<typeof karta>[]) =>
  ({
    szablony: [przod('A'), przod('B'), przod('C', 'T')],
    rewersy: [],
    talie: [{ id: 't', nazwa: 't', karty }],
  }) as unknown as Projekt;

describe('przodyDoPrzypisania', () => {
  it('talia: przody kart bez własnego tyłu, bez szablonów z własnym tyłem', () => {
    const p = projekt([karta('1', 'A'), karta('2', 'B', 'X'), karta('3', 'C')]);
    expect(przodyDoPrzypisania(p, 't').map((s) => s.id)).toEqual(['A']);
  });
  it('pusta talia – szablony bez przypisania; wszystkie karty z własnym tyłem – nic', () => {
    expect(przodyDoPrzypisania(projekt([]), 't').map((s) => s.id)).toEqual(['A', 'B']);
    expect(przodyDoPrzypisania(projekt([karta('1', 'A', 'X')]), 't')).toEqual([]);
  });
  it('wybrane karty – ich przody', () => {
    const p = projekt([karta('1', 'A'), karta('2', 'C')]);
    expect(przodyDoPrzypisania(p, 't', ['2']).map((s) => s.id)).toEqual(['C']);
  });
});
