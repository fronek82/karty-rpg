/// <reference types="node" />
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WERSJA_SCHEMATU, type Projekt } from '../model/projekt';
import type { Szablon } from '../model/szablon';
import { szablonCzaru, szablonStatystyk, szablonWroga } from '../silnik/__testy__/przyklady';
import { eksportujSzablon, importujSzablon } from './archiwum';

/**
 * Pliki przykładowych szablonów w `docs/przyklady/` (do ręcznych testów na stronie) odpowiadają
 * szablonom testowym. `AKTUALIZUJ_PRZYKLADY=1 npx vitest run src/dane/przyklady.test.ts`
 * zapisuje je od nowa.
 */
const PRZYKLADY: [Szablon, string][] = [
  [szablonCzaru, 'czar'],
  [szablonStatystyk, 'blok-statystyk'],
  [szablonWroga, 'wrog'],
];

const plik = (nazwa: string) => `docs/przyklady/${nazwa}.kartyrpg-szablon`;

function bajty(s: Szablon): Uint8Array {
  const p: Projekt = {
    wersja: WERSJA_SCHEMATU,
    id: 'przyklad',
    nazwa: s.nazwa,
    utworzono: '2026-01-01T00:00:00.000Z',
    zmieniono: '2026-01-01T00:00:00.000Z',
    role: {},
    zasoby: [],
    szablony: [s],
    talie: [],
    arkusze: [],
  };
  return eksportujSzablon(p, new Map(), s.id).bajty;
}

describe('pliki przykładów w docs/przyklady', () => {
  for (const [s, nazwa] of PRZYKLADY) {
    it(`${nazwa}: plik wczytuje się i zawiera aktualny szablon`, () => {
      if (process.env.AKTUALIZUJ_PRZYKLADY) writeFileSync(plik(nazwa), bajty(s));
      expect(existsSync(plik(nazwa)), `brak pliku ${plik(nazwa)}`).toBe(true);
      expect(importujSzablon(new Uint8Array(readFileSync(plik(nazwa)))).szablon).toEqual(s);
    });
  }
});
