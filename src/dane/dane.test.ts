/// <reference types="node" />
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { DaneZasobow, Projekt } from '../model/projekt';
import { pakietMausritter } from '../pakiety/mausritter';
import { BazaProjektow } from './baza';
import {
  dodajSzablon,
  eksportujProjekt,
  eksportujSzablon,
  importujProjekt,
  importujSzablon,
} from './archiwum';
import { wgrajCzcionke } from './czcionki';
import { projektZPakietu, rejestrZProjektu } from './pakiet';
import { BladDanych } from './schemat';

const czcionka = async (plik: string) => new Uint8Array(readFileSync(`public/czcionki/${plik}`));
const obraz = async () =>
  new Uint8Array(readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png'));

let projekt: Projekt;
let zasoby: DaneZasobow;

beforeAll(async () => {
  ({ projekt, zasoby } = await projektZPakietu(pakietMausritter, czcionka, obraz, 'p1'));
});

const rowne = (a: DaneZasobow, b: DaneZasobow) => {
  expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
  for (const [id, dane] of a) expect(Buffer.from(b.get(id)!).equals(Buffer.from(dane))).toBe(true);
};

describe('projekt z pakietu', () => {
  it('ma zasoby z biblioteki, role i unikalne id czcionek w silniku', () => {
    expect(projekt.role).toEqual({ tytul: 'Grenze Gotisch', tresc: 'EB Garamond' });
    const ids = projekt.zasoby.map((z) => z.id);
    expect(new Set(ids).size).toBe(ids.length);
    const rejestr = rejestrZProjektu(projekt, zasoby);
    const a = rejestr.pobierz('tytul');
    const b = rejestr.pobierz('tresc');
    expect(a.id).not.toBe(b.id);
    expect(ids).toContain(a.id);
  });
});

describe('eksport i import .kartyrpg', () => {
  it('round-trip: projekt i bajty zasobów identyczne', () => {
    const bajty = eksportujProjekt(projekt, zasoby);
    const wynik = importujProjekt(bajty);
    expect(wynik.projekt).toEqual(projekt);
    rowne(zasoby, wynik.zasoby);
  });

  it('plik to ZIP z projekt.json i zasoby/', () => {
    const pliki = unzipSync(eksportujProjekt(projekt, zasoby));
    expect(Object.keys(pliki)).toContain('projekt.json');
    expect(Object.keys(pliki).some((n) => n.startsWith('zasoby/'))).toBe(true);
  });

  it('nie-archiwum → czytelny błąd po polsku', () => {
    expect(() => importujProjekt(strToU8('to nie zip'))).toThrow(BladDanych);
    expect(() => importujProjekt(strToU8('to nie zip'))).toThrow(/nie jest poprawny plik/);
  });

  it('brak projekt.json, zły JSON, nowsza wersja, zły kształt, brak zasobu, nadmiarowy plik', () => {
    const pliki = unzipSync(eksportujProjekt(projekt, zasoby));
    const zip = (zmiana: (p: Record<string, Uint8Array>) => void) => {
      const kopia = { ...pliki };
      zmiana(kopia);
      return zipSync(kopia);
    };
    const json = () => JSON.parse(strFromU8(pliki['projekt.json']!)) as Record<string, unknown>;
    const zJsonem = (o: unknown) => zip((p) => (p['projekt.json'] = strToU8(JSON.stringify(o))));

    expect(() => importujProjekt(zip((p) => delete p['projekt.json']))).toThrow(/brakuje pliku/);
    expect(() => importujProjekt(zip((p) => (p['projekt.json'] = strToU8('{'))))).toThrow(
      /uszkodzony/,
    );
    expect(() => importujProjekt(zJsonem({ ...json(), wersja: 99 }))).toThrow(/nowszej wersji/);
    expect(() => importujProjekt(zJsonem({ ...json(), nazwa: 5 }))).toThrow(/nazwa/);
    expect(() => importujProjekt(zJsonem({ ...json(), szablony: [{ id: 'x' }] }))).toThrow(
      /szablony\.0/,
    );
    const pierwszy = Object.keys(pliki).find((n) => n.startsWith('zasoby/'))!;
    expect(() => importujProjekt(zip((p) => delete p[pierwszy]))).toThrow(/brakuje zasobu/);
    expect(() => importujProjekt(zip((p) => (p['smiec.txt'] = strToU8('x'))))).toThrow(
      /nieoczekiwany/,
    );
  });

  it('niespójne odwołania są odrzucane', () => {
    const zly = structuredClone(projekt);
    zly.talie[0]!.karty[0]!.szablonId = 'nie-ma';
    expect(() => importujProjekt(eksportujProjekt(zly, zasoby))).toThrow(/nieznanego szablonu/);
    const zly2 = structuredClone(projekt);
    zly2.arkusze[0]!.taliaId = 'nie-ma';
    expect(() => importujProjekt(eksportujProjekt(zly2, zasoby))).toThrow(/nieznanej talii/);
  });

  it('nie gubi pól, których schemat nie zna', () => {
    const rozszerzony = structuredClone(projekt) as Projekt & { przyszle?: number };
    rozszerzony.przyszle = 7;
    (rozszerzony.talie[0]!.karty[0] as unknown as Record<string, unknown>).notatka = 'x';
    const wynik = importujProjekt(eksportujProjekt(rozszerzony, zasoby)).projekt;
    expect(wynik).toEqual(rozszerzony);
  });
});

describe('baza IndexedDB', () => {
  let baza: BazaProjektow;
  afterEach(() => baza?.zamknij());

  it('zapis → odczyt zwraca identyczny projekt i zasoby (Blob)', async () => {
    baza = new BazaProjektow('test-zapis');
    await baza.zapisz(projekt, zasoby);
    const wynik = await baza.wczytaj('p1');
    expect(wynik.projekt).toEqual(projekt);
    rowne(zasoby, wynik.zasoby);
  });

  it('lista, zmiana samego dokumentu, usuwanie', async () => {
    baza = new BazaProjektow('test-lista');
    await baza.zapisz(projekt, zasoby);
    const nowy = { ...projekt, nazwa: 'Zmieniony', zmieniono: '2099-01-01T00:00:00.000Z' };
    await baza.zapisz(nowy);
    expect(await baza.lista()).toEqual([
      { id: 'p1', nazwa: 'Zmieniony', zmieniono: '2099-01-01T00:00:00.000Z' },
    ]);
    rowne(zasoby, (await baza.wczytaj('p1')).zasoby);
    await baza.usun('p1');
    expect(await baza.lista()).toEqual([]);
    await expect(baza.wczytaj('p1')).rejects.toThrow(/Nie ma projektu/);
  });

  it('zapis z brakującymi bajtami zasobu nie zmienia bazy', async () => {
    baza = new BazaProjektow('test-brak');
    await expect(baza.zapisz(projekt, new Map())).rejects.toThrow(/brakuje zasobu/);
    expect(await baza.lista()).toEqual([]);
  });

  it('wielokrotny zapis z zasobami zastępuje stare zasoby', async () => {
    baza = new BazaProjektow('test-zastap');
    await baza.zapisz(projekt, zasoby);
    const bezObrazu = {
      ...projekt,
      zasoby: projekt.zasoby.filter((z) => z.rodzaj === 'czcionka'),
      szablony: projekt.szablony.filter((s) => !JSON.stringify(s).includes('"zasob"')),
    };
    const sz = new Set(bezObrazu.szablony.map((s) => s.id));
    bezObrazu.talie = projekt.talie.map((t) => ({
      ...t,
      karty: t.karty.filter((k) => sz.has(k.szablonId)),
      grupy: undefined,
    }));
    const dane = new Map([...zasoby].filter(([id]) => bezObrazu.zasoby.some((z) => z.id === id)));
    await baza.zapisz(bezObrazu, dane);
    expect((await baza.wczytaj('p1')).zasoby.size).toBe(dane.size);
  });
});

describe('wgrywanie czcionek', () => {
  it('rozpoznaje rodzinę i wariant z pliku', async () => {
    const w = wgrajCzcionke(
      'EBGaramond-BoldItalic.ttf',
      await czcionka('EBGaramond-BoldItalic.ttf'),
    );
    expect(w.opis).toMatchObject({
      rodzina: 'EB Garamond',
      wariant: 'pogrubiona-kursywa',
      format: 'ttf',
      zrodlo: 'wlasna',
    });
    expect(w.opis.id).toBe('czcionka-EBGaramond-BoldItalic');
  });

  it('odrzuca zły format i uszkodzony plik po polsku', () => {
    expect(() => wgrajCzcionke('a.txt', new Uint8Array(4))).toThrow(/Nieobsługiwany format/);
    expect(() => wgrajCzcionke('a.ttf', new Uint8Array(40))).toThrow(/Nie udało się wczytać/);
  });
});

describe('eksport i import szablonu', () => {
  it('szablon z czcionkami i obrazem; round-trip przez dodanie do pustego projektu', () => {
    const { bajty, ostrzezenia } = eksportujSzablon(projekt, zasoby, 'mausritter-bron');
    expect(ostrzezenia).toEqual([]);
    const paczka = importujSzablon(bajty);
    expect(paczka.szablon).toEqual(projekt.szablony.find((s) => s.id === 'mausritter-bron'));
    const pusty: Projekt = {
      ...projekt,
      role: {},
      zasoby: [],
      szablony: [],
      talie: [],
      arkusze: [],
    };
    const wynik = dodajSzablon(pusty, new Map(), paczka);
    expect(wynik.projekt.szablony).toHaveLength(1);
    expect(wynik.projekt.role.tresc).toBe('EB Garamond');
    for (const o of wynik.projekt.zasoby) expect(wynik.zasoby.has(o.id)).toBe(true);
  });

  it('ostrzega o czcionce z własnego pliku; kolizja zasobu o innej treści to błąd', () => {
    const wlasny = structuredClone(projekt);
    for (const o of wlasny.zasoby) if (o.rodzaj === 'czcionka') o.zrodlo = 'wlasna';
    const { ostrzezenia, bajty } = eksportujSzablon(wlasny, zasoby, 'mausritter-bron');
    expect(ostrzezenia.length).toBeGreaterThan(0);
    expect(ostrzezenia[0]).toMatch(/licencj/);

    const paczka = importujSzablon(bajty);
    const inne: DaneZasobow = new Map(zasoby);
    const id = paczka.zasoby[0]!.id;
    inne.set(id, new Uint8Array([1, 2, 3]));
    expect(() => dodajSzablon(projekt, inne, paczka)).toThrow(/inną zawartość/);
  });

  it('powtórny import tego samego szablonu dostaje nowe id', () => {
    const paczka = importujSzablon(eksportujSzablon(projekt, zasoby, 'mausritter-bron').bajty);
    const wynik = dodajSzablon(projekt, zasoby, paczka);
    expect(wynik.szablonId).toBe('mausritter-bron-2');
  });
});
