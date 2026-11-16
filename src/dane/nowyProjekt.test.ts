/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { czyKartkaZnormalizowana } from '../druk/normalizacja';
import { pakietMausritter } from '../pakiety/mausritter';
import { nowyProjektGry } from './nowyProjekt';
import { przygotujProjekt } from './schemat';

const czytaj = async (plik: string) => new Uint8Array(readFileSync(plik));
const pobierz = [
  (f: string) => czytaj(`public/czcionki/${f}`),
  () => czytaj('src/pakiety/mausritter/obrazy/zastepczy.png'),
] as const;

describe('nowy projekt gry', () => {
  it('pusta kartka: jedna kartka bez kart, pakiet zapisany', async () => {
    const { projekt } = await nowyProjektGry(pakietMausritter, ...pobierz, { id: 'n' });
    expect(projekt.arkusze).toHaveLength(1);
    expect(projekt.talie[0]!.karty).toEqual([]);
    expect(projekt.pakiet).toBe('mausritter');
    expect(czyKartkaZnormalizowana(projekt)).toBe(true);
    expect(() => przygotujProjekt(projekt)).not.toThrow();
  });

  it('gotowy układ: tylko wybrane arkusze, karty przypięte', async () => {
    const { projekt } = await nowyProjektGry(pakietMausritter, ...pobierz, { uklad: 'stany' });
    expect(projekt.arkusze.map((a) => a.id)).toEqual(['mausritter-arkusz-stany']);
    expect(projekt.talie).toHaveLength(1);
    expect(czyKartkaZnormalizowana(projekt)).toBe(true);
    expect(projekt.arkusze[0]!.naglowki!.length).toBeGreaterThan(3);
    const wszystkie = await nowyProjektGry(pakietMausritter, ...pobierz, { uklad: 'wszystkie' });
    expect(wszystkie.projekt.arkusze).toHaveLength(3);
    await expect(
      nowyProjektGry(pakietMausritter, ...pobierz, { uklad: 'nie-ma' }),
    ).rejects.toThrow();
  });
});
