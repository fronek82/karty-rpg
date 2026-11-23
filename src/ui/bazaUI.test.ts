/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DaneZasobow, Projekt } from '../model/projekt';

const CZCIONKA_TTF = new Uint8Array(readFileSync('public/czcionki/EBGaramond-Regular.ttf'));

const zapiszMock = vi.fn();
const wczytajMock = vi.fn();
const zapiszMiniatureMock = vi.fn();
vi.mock('../dane/baza', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../dane/baza')>();
  return {
    ...actual,
    BazaProjektow: class {
      zapisz = (...a: unknown[]) => zapiszMock(...a);
      wczytaj = (...a: unknown[]) => wczytajMock(...a);
      zapiszMiniature = (...a: unknown[]) => zapiszMiniatureMock(...a);
      zapiszWBibliotece = vi.fn().mockResolvedValue(undefined);
    },
  };
});

import { czyProjektRewersowy, kluczMiniaturyRewersu } from '../dane/baza';
import {
  nowyProjektZAwersuZProjektu,
  nowyProjektZRewersem,
  nowyProjektZRewersuZProjektu,
} from './bazaUI';

const staraFetch = globalThis.fetch;

beforeEach(() => {
  zapiszMock.mockReset();
  zapiszMock.mockResolvedValue(undefined);
  wczytajMock.mockReset();
  zapiszMiniatureMock.mockReset();
  zapiszMiniatureMock.mockResolvedValue(undefined);
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => CZCIONKA_TTF.slice().buffer,
  })) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = staraFetch;
});

describe('nowyProjektZRewersem', () => {
  it('tworzy projekt własny z rewersem 63×88 mm przypisanym do talii i zapisuje go z miniaturą karty', async () => {
    const wynik = await nowyProjektZRewersem('/');
    expect(zapiszMock).toHaveBeenCalledTimes(1);
    const [projekt, zasoby] = zapiszMock.mock.calls[0] as [Projekt, DaneZasobow];
    expect(wynik.id).toBe(projekt.id);
    expect(czyProjektRewersowy(projekt)).toBe(true);
    expect(projekt.rewersy).toHaveLength(1);
    const rewers = projekt.rewersy![0]!;
    expect(rewers.id).toBe(wynik.rewersId);
    expect(rewers.rozmiar).toEqual({ tryb: 'mm', szerokosc: 63, wysokosc: 88 });
    expect(projekt.talie[0]?.rewersId).toBe(wynik.rewersId);
    expect(projekt.nazwa).toBe(rewers.nazwa);
    expect(zasoby.size).toBeGreaterThan(0);

    // Zapisuje miniaturę karty zarówno pod kluczem rewersu, jak i pod ID projektu rewersowego.
    const kluczeMiniatur = zapiszMiniatureMock.mock.calls.map((c) => c[0]);
    expect(kluczeMiniatur).toContain(kluczMiniaturyRewersu(projekt.id, rewers.id));
    expect(kluczeMiniatur).toContain(projekt.id);
    const svg = zapiszMiniatureMock.mock.calls[0]?.[1] as string;
    expect(svg).toContain('<svg');
  });
});

describe('Użyj w projekcie (nowyProjektZAwersuZProjektu / nowyProjektZRewersuZProjektu)', () => {
  it('nowyProjektZRewersuZProjektu zachowuje niestandardowy rozmiar rewersu i nie modyfikuje oryginału', async () => {
    const { rewersId } = await nowyProjektZRewersem('/');
    const [bazowy, bazoweZasoby] = zapiszMock.mock.calls[0] as [Projekt, DaneZasobow];
    const zrodlo: Projekt = {
      ...bazowy,
      rewersy: (bazowy.rewersy ?? []).map((r) => ({
        ...r,
        nazwa: 'Tarot rewers',
        rozmiar: { tryb: 'mm', szerokosc: 70, wysokosc: 120 },
      })),
    };
    wczytajMock.mockResolvedValue({ projekt: zrodlo, zasoby: bazoweZasoby });
    zapiszMock.mockClear();

    const noweId = await nowyProjektZRewersuZProjektu(zrodlo.id, rewersId, '/');
    expect(zapiszMock).toHaveBeenCalledTimes(1);
    const [nowy] = zapiszMock.mock.calls[0] as [Projekt, DaneZasobow];
    expect(noweId).toBe(nowy.id);
    expect(noweId).not.toBe(zrodlo.id);
    expect(nowy.nazwa).toBe('Tarot rewers');
    expect(nowy.szablony[0]?.rozmiar).toEqual({ tryb: 'mm', szerokosc: 70, wysokosc: 120 });
    expect(nowy.rewersy?.[0]?.rozmiar).toEqual({ tryb: 'mm', szerokosc: 70, wysokosc: 120 });
    expect(nowy.talie[0]?.rewersId).toBe(nowy.rewersy?.[0]?.id);
  });

  it('nowyProjektZAwersuZProjektu kopiuje awers do nowego projektu bez rewersu źródła', async () => {
    const { rewersId } = await nowyProjektZRewersem('/');
    const [bazowy, bazoweZasoby] = zapiszMock.mock.calls[0] as [Projekt, DaneZasobow];
    const szablon = bazowy.szablony[0]!;
    const zrodlo: Projekt = {
      ...bazowy,
      szablony: [{ ...szablon, nazwa: 'Karta zaklęcia', rewersId }],
    };
    wczytajMock.mockResolvedValue({ projekt: zrodlo, zasoby: bazoweZasoby });
    zapiszMock.mockClear();

    const noweId = await nowyProjektZAwersuZProjektu(zrodlo.id, szablon.id, '/');
    expect(zapiszMock).toHaveBeenCalledTimes(1);
    const [nowy] = zapiszMock.mock.calls[0] as [Projekt, DaneZasobow];
    expect(noweId).toBe(nowy.id);
    expect(noweId).not.toBe(zrodlo.id);
    expect(nowy.nazwa).toBe('Karta zaklęcia');
    expect(nowy.szablony[0]?.nazwa).toBe('Karta zaklęcia');
    expect(nowy.szablony[0]?.rewersId).toBeUndefined();
    expect(nowy.rewersy ?? []).toHaveLength(0);
  });
});
