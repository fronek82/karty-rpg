import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DaneZasobow, Projekt } from '../model/projekt';

const zapiszMock = vi.fn();
const zapiszMiniatureMock = vi.fn();
vi.mock('../dane/baza', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../dane/baza')>();
  return {
    ...actual,
    BazaProjektow: class {
      zapisz = (...a: unknown[]) => zapiszMock(...a);
      zapiszMiniature = (...a: unknown[]) => zapiszMiniatureMock(...a);
      zapiszWBibliotece = vi.fn().mockResolvedValue(undefined);
    },
  };
});

import { czyProjektRewersowy, kluczMiniaturyRewersu } from '../dane/baza';
import { nowyProjektZRewersem } from './baza';

const staraFetch = globalThis.fetch;

beforeEach(() => {
  zapiszMock.mockReset();
  zapiszMock.mockResolvedValue(undefined);
  zapiszMiniatureMock.mockReset();
  zapiszMiniatureMock.mockResolvedValue(undefined);
  globalThis.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
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
