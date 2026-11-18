/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ustawJezyk } from '../../i18n';
import { KAFELKI_SZABLONOW } from '../../przyklady';
import {
  bladPodgladowPrzykladow,
  ponowPodgladyPrzykladow,
  uruchomPodgladyPrzykladow,
  wyczyscPodgladyPrzykladowDoTestow,
  wynikPrzykladu,
} from './ladujPrzyklady';

const IDY = KAFELKI_SZABLONOW.map((o) => o.id);

/** `fetch` czytający czcionki z dysku; `stan.ok = false` – błąd sieci. */
const stan = { ok: true, pobrania: 0 };
beforeEach(() => {
  wyczyscPodgladyPrzykladowDoTestow();
  stan.ok = true;
  stan.pobrania = 0;
  vi.stubGlobal('fetch', async (adres: string) => {
    stan.pobrania++;
    if (!stan.ok) throw new TypeError('Failed to fetch');
    const bajty = readFileSync(`public/czcionki/${adres.split('/czcionki/')[1]}`);
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

const ileGotowych = (j: 'pl' | 'en') => IDY.filter((id) => wynikPrzykladu(j, id)).length;

describe('harmonogram podglądów przykładów', () => {
  it('liczy wszystkie podglądy bez błędów i zapamiętuje je między wejściami', async () => {
    await uruchomPodgladyPrzykladow('pl');
    expect(ileGotowych('pl')).toBe(IDY.length);
    for (const id of IDY) {
      const w = wynikPrzykladu('pl', id);
      expect(w, id).toHaveProperty('podglad');
      expect((w as { podglad: { ostrzezenia: string[] } }).podglad.ostrzezenia).toEqual([]);
    }
    // Ponowne wejście: ta sama pamięć, bez nowych pobrań czcionek.
    const pobrania = stan.pobrania;
    const pierwszy = wynikPrzykladu('pl', IDY[1]!);
    await uruchomPodgladyPrzykladow('pl');
    expect(wynikPrzykladu('pl', IDY[1]!)).toBe(pierwszy);
    expect(stan.pobrania).toBe(pobrania);
  });

  it('zmiana języka w trakcie: nic nie trafia pod zły klucz, po powrocie liczy od nowa', async () => {
    const pierwsze = uruchomPodgladyPrzykladow('pl');
    ustawJezyk('en'); // przygotowanie PL zobaczy zmianę po załadowaniu przykładów i przerwie się
    await pierwsze;
    expect(ileGotowych('pl')).toBe(0);
    expect(ileGotowych('en')).toBe(0);
    ustawJezyk('pl');
    await uruchomPodgladyPrzykladow('pl');
    expect(ileGotowych('pl')).toBe(IDY.length);
    ustawJezyk('en');
    await uruchomPodgladyPrzykladow('en');
    expect(ileGotowych('en')).toBe(IDY.length);
    // Teksty w wynikach EN są angielskie (inny SVG niż PL).
    const pl = (wynikPrzykladu('pl', 'opis') as { podglad: { strony: { svg: string }[] } }).podglad;
    const en = (wynikPrzykladu('en', 'opis') as { podglad: { strony: { svg: string }[] } }).podglad;
    expect(en.strony[0]!.svg).not.toBe(pl.strony[0]!.svg);
  });

  it('błąd pobrania czcionek: komunikat, brak wyników, ponowna próba po naprawie', async () => {
    stan.ok = false;
    await uruchomPodgladyPrzykladow('pl');
    expect(bladPodgladowPrzykladow('pl')).toMatch(/Failed to fetch/);
    expect(ileGotowych('pl')).toBe(0);
    stan.ok = true;
    await ponowPodgladyPrzykladow('pl');
    expect(bladPodgladowPrzykladow('pl')).toBeUndefined();
    expect(ileGotowych('pl')).toBe(IDY.length);
  });
});
