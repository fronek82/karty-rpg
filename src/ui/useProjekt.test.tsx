// @vitest-environment jsdom
/// <reference types="node" />
import 'fake-indexeddb/auto';
import { Blob as NodeBlob } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { BazaProjektow } from '../dane/baza';
import { dodajZasoby, ustawDane } from '../dane/edycja';
import { projektZPakietu } from '../dane/pakiet';
import type { DaneZasobow, Projekt } from '../model/projekt';
import { pakietMausritter } from '../pakiety/mausritter';
import { baza } from './baza';
import { czyKartkaZnormalizowana } from '../druk/normalizacja';
import { useProjekt, type StanProjektu } from './useProjekt';

const czytaj = async (plik: string) => new Uint8Array(readFileSync(plik));
let projekt: Projekt;
let dane: DaneZasobow;
const T = 'mausritter-stany';
let licznik = 0;
let id = '';

beforeAll(async () => {
  // Blob z jsdom nie przeżywa klonowania w fake-indexeddb (traci arrayBuffer) – natywny z Node.
  globalThis.Blob = NodeBlob as unknown as typeof Blob;
  // jsdom nie ma URL.createObjectURL – adresy blob: nie są tu potrzebne.
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => undefined;
  ({ projekt, zasoby: dane } = await projektZPakietu(
    pakietMausritter,
    (f) => czytaj(`public/czcionki/${f}`),
    () => czytaj('src/pakiety/mausritter/obrazy/zastepczy.png'),
    'p',
  ));
});

beforeEach(async () => {
  id = `p${++licznik}`;
  await baza().zapisz({ ...projekt, id }, dane);
});
afterEach(() => vi.restoreAllMocks());

const gotowy = (s: StanProjektu) => {
  if (s.stan !== 'gotowy') throw new Error(`stan ${s.stan}`);
  return s;
};
const pierwszaKarta = (p: Projekt) => p.talie.find((x) => x.id === T)!.karty[0]!;
const PNG = readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png');
const nowyObraz = (n: string) => ({
  opis: {
    rodzaj: 'obraz' as const,
    id: n,
    nazwa: `${n}.png`,
    format: 'png' as const,
    szerokosc: 1,
    wysokosc: 1,
  },
  dane: new Uint8Array(PNG),
});

async function otworz() {
  const h = renderHook(() => useProjekt(id));
  await waitFor(() => expect(h.result.current).toMatchObject({ stan: 'gotowy' }), {
    timeout: 4000,
  });
  return h;
}

describe('useProjekt', () => {
  it('zapis po chwili bezczynności i przy zamknięciu projektu', async () => {
    const h = await otworz();
    const k = pierwszaKarta(gotowy(h.result.current).projekt);
    act(() => gotowy(h.result.current).zmien((p) => ustawDane(p, T, k.id, 'nazwa', 'A')));
    expect(gotowy(h.result.current).zapis.stan).toBe('zapisywanie');
    await waitFor(() => expect(gotowy(h.result.current).zapis.stan).toBe('zapisano'));
    expect(pierwszaKarta((await baza().wczytaj(id)).projekt).dane.nazwa).toBe('A');

    act(() => gotowy(h.result.current).zmien((p) => ustawDane(p, T, k.id, 'nazwa', 'B')));
    h.unmount(); // przed upływem opóźnienia
    await waitFor(async () =>
      expect(pierwszaKarta((await baza().wczytaj(id)).projekt).dane.nazwa).toBe('B'),
    );
  });

  it('wgranie zasobu nie gubi edycji zrobionych przed nim i w trakcie jego zapisu', async () => {
    const h = await otworz();
    const k = pierwszaKarta(gotowy(h.result.current).projekt);
    let zadanie!: Promise<void>;
    act(() => {
      gotowy(h.result.current).zmien((p) => ustawDane(p, T, k.id, 'nazwa', 'Przed'));
      // `f` dostaje projekt z edycją „Przed”, choć render jeszcze jej nie pokazał.
      zadanie = gotowy(h.result.current).zmienZZasobami((p, d) => {
        expect(pierwszaKarta(p).dane.nazwa).toBe('Przed');
        return dodajZasoby(p, d, [nowyObraz('obraz-nowy')]);
      });
      gotowy(h.result.current).zmien((p) => ustawDane(p, T, k.id, 'skutek', 'W trakcie'));
    });
    await act(() => zadanie);
    await waitFor(() => expect(gotowy(h.result.current).zapis.stan).toBe('zapisano'));
    const z = await baza().wczytaj(id);
    expect(pierwszaKarta(z.projekt).dane).toMatchObject({ nazwa: 'Przed', skutek: 'W trakcie' });
    expect(z.zasoby.has('obraz-nowy')).toBe(true);
    h.unmount();
  });

  it('nieudany zapis z zasobami: błąd w stanie, ponowienie zapisuje także bajty', async () => {
    const h = await otworz();
    const k = pierwszaKarta(gotowy(h.result.current).projekt);
    vi.spyOn(BazaProjektow.prototype, 'zapisz').mockRejectedValueOnce(new Error('dysk pełny'));
    await act(async () => {
      await expect(
        gotowy(h.result.current).zmienZZasobami((p, d) =>
          dodajZasoby(p, d, [nowyObraz('obraz-x')]),
        ),
      ).rejects.toThrow('dysk pełny');
    });
    expect(gotowy(h.result.current).zapis).toEqual({ stan: 'blad', komunikat: 'dysk pełny' });
    // Kolejna zwykła edycja ponawia zapis – razem z bajtami nowego obrazu.
    act(() => gotowy(h.result.current).zmien((p) => ustawDane(p, T, k.id, 'nazwa', 'Po błędzie')));
    await waitFor(() => expect(gotowy(h.result.current).zapis.stan).toBe('zapisano'));
    const z = await baza().wczytaj(id);
    expect(z.zasoby.has('obraz-x')).toBe(true);
    expect(pierwszaKarta(z.projekt).dane.nazwa).toBe('Po błędzie');
    h.unmount();
  });

  it('projekt sprzed edytora jest normalizowany przy otwarciu i zapisywany', async () => {
    const h = await otworz();
    const p = gotowy(h.result.current).projekt;
    expect(czyKartkaZnormalizowana(p)).toBe(true);
    await waitFor(async () =>
      expect(czyKartkaZnormalizowana((await baza().wczytaj(id)).projekt)).toBe(true),
    );
    h.unmount();
  });

  it('cofnij / ponów; seria zmian jednego pola to jeden krok', async () => {
    const h = await otworz();
    const k = pierwszaKarta(gotowy(h.result.current).projekt);
    const nazwa = () => pierwszaKarta(gotowy(h.result.current).projekt).dane.nazwa;
    const przed = nazwa();
    expect(gotowy(h.result.current).mozeCofnac).toBe(false);
    act(() => {
      for (const v of ['M', 'Mi', 'Mie'])
        gotowy(h.result.current).zmien((p) => ustawDane(p, T, k.id, 'nazwa', v), {
          klucz: 'nazwa',
        });
    });
    expect(nazwa()).toBe('Mie');
    expect(gotowy(h.result.current).mozeCofnac).toBe(true);
    act(() => gotowy(h.result.current).cofnij());
    expect(nazwa()).toBe(przed);
    expect(gotowy(h.result.current).mozePonowic).toBe(true);
    act(() => gotowy(h.result.current).ponow());
    expect(nazwa()).toBe('Mie');
    h.unmount();
  });

  it('błąd w funkcji zmiany zasobów nie zmienia stanu', async () => {
    const h = await otworz();
    const przed = gotowy(h.result.current).projekt;
    await act(async () => {
      await expect(
        gotowy(h.result.current).zmienZZasobami(() => {
          throw new Error('zły plik');
        }),
      ).rejects.toThrow('zły plik');
    });
    expect(gotowy(h.result.current).projekt).toBe(przed);
    expect(gotowy(h.result.current).zapis.stan).toBe('zapisano');
    h.unmount();
  });

  it('tryb ręcznego zapisu (autozapis: false): zmiany czekają na zapiszTeraz()', async () => {
    const h = renderHook(() => useProjekt(id, { autozapis: false }));
    await waitFor(() => expect(h.result.current.stan).toBe('gotowy'), { timeout: 4000 });
    act(() => {
      gotowy(h.result.current).zmien((p) => ({ ...p, nazwa: 'Ręcznie' }));
    });
    expect(gotowy(h.result.current).zapis.stan).toBe('niezapisane');
    expect(gotowy(h.result.current).niezapisane).toBe(true);
    // Po upływie czasu debouncingu baza nadal ma starą nazwę.
    await new Promise((r) => setTimeout(r, 600));
    expect((await baza().wczytaj(id)).projekt.nazwa).toBe(projekt.nazwa);
    // Dopiero jawne zapiszTeraz() utrwala zmianę w bazie.
    await act(async () => {
      await gotowy(h.result.current).zapiszTeraz();
    });
    expect(gotowy(h.result.current).zapis.stan).toBe('zapisano');
    expect(gotowy(h.result.current).niezapisane).toBe(false);
    expect((await baza().wczytaj(id)).projekt.nazwa).toBe('Ręcznie');
    // Kolejna niezapisana zmiana nie zapisuje się przy odmontowaniu.
    act(() => {
      gotowy(h.result.current).zmien((p) => ({ ...p, nazwa: 'Porzucona' }));
    });
    h.unmount();
    await new Promise((r) => setTimeout(r, 100));
    expect((await baza().wczytaj(id)).projekt.nazwa).toBe('Ręcznie');
  });
});
