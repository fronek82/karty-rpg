import { describe, expect, it } from 'vitest';
import { WERSJA_SCHEMATU, type Projekt } from '../model/projekt';
import type { PoleTekst, Rewers, Szablon } from '../model/szablon';
import { migruj, schematRewersu } from './schemat';
import {
  duplikujRewersWProjekcie,
  nowyTyl,
  przodRewersu,
  rewersJakoSzablon,
  rewersZPrzykladami,
  szablonDoRewersu,
} from './rewers';

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

describe('teksty przykładowe tyłu (`Rewers.przyklad`)', () => {
  const tyl: Rewers = {
    id: 'r',
    nazwa: 'Tył',
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    korzen: {
      id: 'k',
      typ: 'swobodny',
      dzieci: [
        {
          id: 'napis',
          typ: 'tekst',
          nazwa: 'Rodzaj',
          tekst: 'Stały',
          styl: { czcionka: 'x', rozmiar: 10, kolor: '#000', wyrownanie: 'lewo' },
        } as PoleTekst,
      ],
    },
  };

  it('widok szablonu ↔ tył: przykład zostaje, puste i usuniętych pól – znikają', () => {
    const s = rewersJakoSzablon({ ...tyl, przyklad: { napis: 'Czary' } });
    expect(s.przyklad).toEqual({ napis: 'Czary' });
    const r = szablonDoRewersu(tyl, { ...s, przyklad: { napis: 'Ogień', inne: 'x' } });
    expect(r.przyklad).toEqual({ napis: 'Ogień' });
    // Schemat przyjmuje przykłady na pełnym tyle z kreatora.
    const zKreatora = nowyTyl(
      't',
      { nazwa: 'T', szer: 63, wys: 88, promien: 3, tlo: '#fff', uklad: 'pusty' },
      'G',
    );
    expect(schematRewersu.safeParse({ ...zKreatora, przyklad: { x: 'y' } }).success).toBe(true);
    expect(szablonDoRewersu(tyl, { ...s, przyklad: { napis: '' } }).przyklad).toBeUndefined();
  });

  it('duplikat tyłu ma przykłady pod nowymi id pól', () => {
    const p = projekt({ rewersy: [{ ...tyl, przyklad: { napis: 'Czary' } }] });
    const w = duplikujRewersWProjekcie(p, 'r', (n) => ` ${n}`);
    const kopia = w.projekt.rewersy!.find((r) => r.id === w.id)!;
    const idPola = kopia.korzen.dzieci[0]!.id;
    expect(idPola).not.toBe('napis');
    expect(kopia.przyklad).toEqual({ [idPola]: 'Czary' });
  });

  it('podgląd: przykład zamiast stałego tekstu, bez zmiany samego tyłu', () => {
    const z = rewersZPrzykladami({ ...tyl, przyklad: { napis: 'Czary' } });
    expect(z.korzen.dzieci[0]).toMatchObject({ tekst: 'Czary' });
    expect(z.przyklad).toBeUndefined();
    expect(rewersZPrzykladami(tyl)).toBe(tyl);
  });

  it('migracja 31→32 nie zmienia tyłów', () => {
    const nowy = migruj({ wersja: 31, rewersy: [tyl] }) as { wersja: number; rewersy: unknown[] };
    expect(nowy.wersja).toBe(WERSJA_SCHEMATU);
    expect(nowy.rewersy).toEqual([tyl]);
  });
});
