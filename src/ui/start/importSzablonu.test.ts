/// <reference types="node" />
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eksportujSzablon } from '../../dane/archiwum';
import { BladDanych } from '../../dane/schemat';
import { WERSJA_SCHEMATU, type Projekt } from '../../model/projekt';
import { PUSTA_KARTA } from '../../przyklady';
import { baza } from '../baza';
import { adresProjektu, importujPlikSzablonu, opisBleduImportu } from './importSzablonu';

beforeEach(() => {
  vi.stubGlobal('fetch', async (adres: string) => {
    const bajty = readFileSync(`public/czcionki/${adres.split('/czcionki/')[1]}`);
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        bajty.buffer.slice(bajty.byteOffset, bajty.byteOffset + bajty.byteLength),
    };
  });
});

describe('importujPlikSzablonu', () => {
  it('poprawny plik: nowy projekt zapisany w bazie', async () => {
    const { szablon } = await PUSTA_KARTA.laduj();
    const projekt: Projekt = {
      wersja: WERSJA_SCHEMATU,
      id: 'zrodlo',
      nazwa: 'Źródło',
      utworzono: '2026-01-01T00:00:00.000Z',
      zmieniono: '2026-01-01T00:00:00.000Z',
      role: {},
      zasoby: [],
      szablony: [szablon],
      talie: [],
      arkusze: [],
    };
    const bajty = eksportujSzablon(projekt, new Map(), szablon.id).bajty;
    const w = await importujPlikSzablonu(bajty);
    if ('blad' in w) throw new Error(w.blad);
    const zapisany = (await baza().wczytaj(w.id)).projekt;
    expect(zapisany.szablony).toHaveLength(1);
    expect(zapisany.arkusze).toHaveLength(1);
    expect(adresProjektu(w.id)).toBe(`#/projekt/${encodeURIComponent(w.id)}`);
  });

  it('uszkodzony plik: komunikat zamiast wyjątku', async () => {
    const w = await importujPlikSzablonu(new TextEncoder().encode('to nie jest archiwum'));
    expect(w).toHaveProperty('blad');
    expect((w as { blad: string }).blad).toMatch(/^Nie udało się zaimportować szablonu: /);
  });
});

describe('opisBleduImportu', () => {
  it('błąd danych – własny komunikat, inny błąd – ogólny z opisem', () => {
    expect(opisBleduImportu(new BladDanych('zły plik'))).toBe('zły plik');
    expect(opisBleduImportu(new Error('boom'))).toContain('boom');
    expect(opisBleduImportu('tekst')).toContain('tekst');
  });
});
