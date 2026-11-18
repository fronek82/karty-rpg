/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ustawJezyk } from '../../i18n';
import { pakietMausritter } from '../../pakiety/mausritter';
import {
  bladLadowania,
  ponowPodglady,
  uruchomPodglady,
  wyczyscPodgladyDoTestow,
  wynikPodgladu,
} from './ladujPodglady';

const IDY = ['pusta', ...pakietMausritter.gotoweUklady.map((u) => u.id)];

/** `fetch` czytający czcionki i obraz z dysku; `dzialaFetch.ok = false` – błąd sieci. */
const stan = { ok: true };
beforeEach(() => {
  wyczyscPodgladyDoTestow();
  stan.ok = true;
  vi.stubGlobal('fetch', async (adres: string) => {
    if (!stan.ok) throw new TypeError('Failed to fetch');
    const plik = adres.endsWith('.png')
      ? 'src/pakiety/mausritter/obrazy/zastepczy.png'
      : `public/czcionki/${adres.split('/czcionki/')[1]}`;
    const bajty = readFileSync(plik);
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        bajty.buffer.slice(bajty.byteOffset, bajty.byteOffset + bajty.byteLength),
    };
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  ustawJezyk('pl');
});

const ileGotowych = (j: 'pl' | 'en') =>
  IDY.filter((id) => wynikPodgladu(pakietMausritter.id, j, id)).length;

describe('harmonogram podglądów', () => {
  it('liczy wszystkie podglądy i zapamiętuje wyniki', async () => {
    await uruchomPodglady(pakietMausritter, 'pl');
    expect(ileGotowych('pl')).toBe(IDY.length);
    for (const id of IDY)
      expect(wynikPodgladu(pakietMausritter.id, 'pl', id), id).toHaveProperty('podglad');
    // Drugie wywołanie nie liczy od nowa (ta sama obietnica / pamięć).
    const wynik = wynikPodgladu(pakietMausritter.id, 'pl', 'bron');
    await uruchomPodglady(pakietMausritter, 'pl');
    expect(wynikPodgladu(pakietMausritter.id, 'pl', 'bron')).toBe(wynik);
  });

  it('wyścig PL → EN → PL: przerwane liczenie nie zostawia wiszącej obietnicy', async () => {
    const pierwsze = uruchomPodglady(pakietMausritter, 'pl');
    ustawJezyk('en'); // liczenie PL zobaczy zmianę przed pierwszym krokiem i przerwie się
    await pierwsze;
    expect(ileGotowych('pl')).toBe(0);
    ustawJezyk('pl');
    await uruchomPodglady(pakietMausritter, 'pl');
    expect(ileGotowych('pl')).toBe(IDY.length);
    // Angielskie liczenie zaczyna się samo, gdy język jest EN.
    ustawJezyk('en');
    await uruchomPodglady(pakietMausritter, 'en');
    expect(ileGotowych('en')).toBe(IDY.length);
  });

  it('błąd pobrania: komunikat ładowania, brak wyników, ponowna próba po naprawie', async () => {
    stan.ok = false;
    await uruchomPodglady(pakietMausritter, 'pl');
    expect(bladLadowania(pakietMausritter.id, 'pl')).toMatch(/Failed to fetch/);
    expect(ileGotowych('pl')).toBe(0);
    // Kolejne wywołanie po błędzie liczy od nowa (nie czeka na starą obietnicę).
    stan.ok = true;
    await ponowPodglady(pakietMausritter, 'pl');
    expect(bladLadowania(pakietMausritter.id, 'pl')).toBeUndefined();
    expect(ileGotowych('pl')).toBe(IDY.length);
  });
});
