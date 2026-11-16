/// <reference types="node" />
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { WERSJA_SCHEMATU, type DaneZasobow, type Projekt } from '../model/projekt';
import type { WariantCzcionki, Wezel } from '../model/szablon';
import { pakietMausritter } from '../pakiety/mausritter';
import { BazaProjektow } from './baza';
import {
  dodajSzablon,
  eksportujProjekt,
  eksportujSzablon,
  importujProjekt,
  importujSzablon,
  LIMITY_ARCHIWUM,
} from './archiwum';
import { MAKS_BAJTOW_CZCIONKI, wariantCzcionki, wgrajCzcionke } from './czcionki';
import { projektZPakietu, rejestrZProjektu } from './pakiet';
import { BladDanych, MIGRACJE, migruj, ostrzezeniaProjektu } from './schemat';

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
    const { rejestr, ostrzezenia } = rejestrZProjektu(projekt, zasoby);
    expect(ostrzezenia).toEqual([]);
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

  it('uszkodzona czcionka lub obraz w archiwum → błąd importu', () => {
    const pliki = unzipSync(eksportujProjekt(projekt, zasoby));
    const font = Object.keys(pliki).find((n) => n.endsWith('.ttf'))!;
    const png = Object.keys(pliki).find((n) => n.endsWith('.png'))!;
    expect(() => importujProjekt(zipSync({ ...pliki, [font]: new Uint8Array(100) }))).toThrow(
      /Czcionka .* uszkodzona/,
    );
    expect(() => importujProjekt(zipSync({ ...pliki, [png]: strToU8('GIF89a') }))).toThrow(
      /nie jest obrazem PNG ani JPG/,
    );
  });

  it('wpisy spoza projekt.json i zasoby/ oraz limity rozmiaru są odrzucane', () => {
    const pliki = unzipSync(eksportujProjekt(projekt, zasoby));
    expect(() => importujProjekt(zipSync({ ...pliki, 'szablon.json': strToU8('{}') }))).toThrow(
      /nieoczekiwany wpis/,
    );
    expect(() => importujProjekt(zipSync({ ...pliki, 'zasoby/a/b.png': strToU8('x') }))).toThrow(
      /nieoczekiwany wpis/,
    );
    const stare = { ...LIMITY_ARCHIWUM };
    try {
      LIMITY_ARCHIWUM.suma = 1000;
      expect(() => importujProjekt(eksportujProjekt(projekt, zasoby))).toThrow(/zbyt duża/);
      LIMITY_ARCHIWUM.suma = stare.suma;
      LIMITY_ARCHIWUM.wpisy = 2;
      expect(() => importujProjekt(eksportujProjekt(projekt, zasoby))).toThrow(/zbyt wiele/);
    } finally {
      Object.assign(LIMITY_ARCHIWUM, stare);
    }
  });

  it('pola stylu i ustawień obrazu są sprawdzane (np. nieznany wariant czcionki)', () => {
    const zly = structuredClone(projekt);
    const zStylem = (w: Wezel): Extract<Wezel, { styl: unknown }> | undefined =>
      'dzieci' in w ? w.dzieci.map(zStylem).find(Boolean) : 'styl' in w ? w : undefined;
    zStylem(zly.szablony[0]!.korzen)!.styl.wariant = 'bold' as WariantCzcionki;
    expect(() => importujProjekt(eksportujProjekt(zly, zasoby))).toThrow(/niedozwolona wartość/);
    const zly2 = structuredClone(projekt);
    zly2.talie[0]!.karty[0]!.obrazy = { obraz: { skala: -1 } };
    expect(() => importujProjekt(eksportujProjekt(zly2, zasoby))).toThrow(/obrazy\.obraz\.skala/);
    const zly3 = structuredClone(projekt);
    zly3.szablony[0]!.korzen.padding = { gora: 'x' as unknown as number };
    expect(() => importujProjekt(eksportujProjekt(zly3, zasoby))).toThrow(/padding/);
  });

  it('twarda spójność: powtórzone id, karta w grupie i przypięta karta', () => {
    const zly = structuredClone(projekt);
    zly.szablony.push(zly.szablony[0]!);
    expect(() => importujProjekt(eksportujProjekt(zly, zasoby))).toThrow(
      /powtórzony identyfikator/,
    );
    const zly2 = structuredClone(projekt);
    const talia = zly2.talie.find((x) => x.grupy?.length)!;
    talia.grupy![0]!.karty.push('nie-ma');
    expect(() => importujProjekt(eksportujProjekt(zly2, zasoby))).toThrow(
      /nieznaną kartę „nie-ma”/,
    );
    const zly3 = structuredClone(projekt);
    zly3.arkusze[0]!.przypiete = [{ kartaId: 'nie-ma', kolumna: 0, rzad: 0 }];
    expect(() => importujProjekt(eksportujProjekt(zly3, zasoby))).toThrow(
      /przypina nieznaną kartę/,
    );
    const zly4 = structuredClone(projekt);
    const k = zly4.szablony[0]!.korzen;
    k.dzieci.push(structuredClone(k.dzieci[0]!));
    expect(() => importujProjekt(eksportujProjekt(zly4, zasoby))).toThrow(/szablon mausritter/);
  });

  it('miękkie odwołania (rola, obraz) nie blokują otwarcia – są ostrzeżeniami', () => {
    const p = structuredClone(projekt);
    p.role.ozdobna = 'Nie Ma Takiej';
    p.zasoby = p.zasoby.filter((z) => z.rodzaj !== 'obraz');
    const dane = new Map([...zasoby].filter(([id]) => p.zasoby.some((z) => z.id === id)));
    const wynik = importujProjekt(eksportujProjekt(p, dane));
    const o = ostrzezeniaProjektu(wynik.projekt);
    expect(o.join('\n')).toMatch(/rola „ozdobna”/);
    expect(o.join('\n')).toMatch(/karta .* wskazuje nieznany zasób „mausritter\/zastepczy”/);
    expect(o.filter((x) => x.includes('mausritter/zastepczy'))).toHaveLength(1);
  });

  it('migracje: osobne kroki dla projektu i szablonu, brak kroku to czytelny błąd', () => {
    MIGRACJE.szablon[1] = ({ szablonStary, ...reszta }) => ({ ...reszta, szablon: szablonStary });
    try {
      expect(migruj({ wersja: 1, szablonStary: 'x' }, 'szablon', 2)).toEqual({
        wersja: 2,
        szablon: 'x',
      });
      expect(() => migruj({ wersja: 1 }, 'projekt', 2)).toThrow(
        /Brak migracji danych ze schematu 1/,
      );
    } finally {
      delete MIGRACJE.szablon[1];
    }
    expect(() => migruj({ wersja: WERSJA_SCHEMATU + 1 })).toThrow(/nowszej wersji/);
    expect(() => migruj({ wersja: 0.5 })).toThrow(/numeru wersji/);
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

  it('zapis samego dokumentu: nowy opis bez Bloba odrzucony atomowo; istnieje()', async () => {
    baza = new BazaProjektow('test-dokument');
    await baza.zapisz(projekt, zasoby);
    expect(await baza.istnieje('p1')).toBe(true);
    expect(await baza.istnieje('p2')).toBe(false);
    const zNowym: Projekt = {
      ...projekt,
      nazwa: 'Nie zapisze się',
      zasoby: [...projekt.zasoby, { ...projekt.zasoby[0]!, id: 'nowy' }],
    };
    await expect(baza.zapisz(zNowym)).rejects.toThrow(/brakuje zasobu „nowy”/);
    expect((await baza.wczytaj('p1')).projekt.nazwa).toBe(projekt.nazwa);
  });

  it('zapis niespójnego projektu jest odrzucany', async () => {
    baza = new BazaProjektow('test-niespojny');
    const zly = structuredClone(projekt);
    zly.talie[0]!.karty[0]!.szablonId = 'nie-ma';
    await expect(baza.zapisz(zly, zasoby)).rejects.toThrow(BladDanych);
    expect(await baza.lista()).toEqual([]);
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

  it('wariant z OS/2: Regular, Italic, Bold; unikalne id względem zajętych', async () => {
    const w = (plik: string) => wgrajCzcionke(plik, readFileSync(`public/czcionki/${plik}`));
    expect(w('EBGaramond-Regular.ttf').opis.wariant).toBe('normalny');
    expect(w('EBGaramond-Italic.ttf').opis.wariant).toBe('kursywa');
    expect(w('GrenzeGotisch-Bold.ttf').opis).toMatchObject({
      rodzina: 'Grenze Gotisch',
      wariant: 'pogrubiony',
    });
    const zajete = new Set(['czcionka-EBGaramond-Regular']);
    const druga = wgrajCzcionke(
      'EBGaramond-Regular.ttf',
      await czcionka('EBGaramond-Regular.ttf'),
      { zajete },
    );
    expect(druga.opis.id).toBe('czcionka-EBGaramond-Regular-2');
  });

  it('wariantCzcionki: kroje spoza RIBBI według grubości', () => {
    expect(wariantCzcionki(600, false)).toBe('pogrubiony');
    expect(wariantCzcionki(500, true)).toBe('kursywa');
    expect(wariantCzcionki(300, false)).toBe('normalny');
    expect(wariantCzcionki(900, true)).toBe('pogrubiona-kursywa');
  });

  it('odrzuca zbyt duży plik', () => {
    expect(() => wgrajCzcionke('a.ttf', new Uint8Array(MAKS_BAJTOW_CZCIONKI + 1))).toThrow(
      /zbyt duży/,
    );
  });

  it('odrzuca zły format i uszkodzony plik po polsku', () => {
    expect(() => wgrajCzcionke('a.txt', new Uint8Array(4))).toThrow(/Nieobsługiwany format/);
    expect(() => wgrajCzcionke('a.ttf', new Uint8Array(40))).toThrow(
      /uszkodzony albo to nie czcionka/,
    );
  });
});

describe('eksport i import szablonu', () => {
  it('szablon z czcionkami; round-trip przez dodanie do pustego projektu', () => {
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

  it('ostrzega o czcionce z własnego pliku', () => {
    const wlasny = structuredClone(projekt);
    for (const o of wlasny.zasoby) if (o.rodzaj === 'czcionka') o.zrodlo = 'wlasna';
    const { ostrzezenia } = eksportujSzablon(wlasny, zasoby, 'mausritter-bron');
    expect(ostrzezenia.length).toBeGreaterThan(0);
    expect(ostrzezenia[0]).toMatch(/licencj/);
  });

  it('zasób o zajętym id i innej treści dostaje nowe id, odwołania szablonu przepisane', () => {
    // Szablon ze stałym obrazem (pole bez klucza danych).
    const zeStalym = structuredClone(projekt);
    const bron = zeStalym.szablony.find((s) => s.id === 'mausritter-bron')!;
    const obraz = (w: Wezel): Extract<Wezel, { typ: 'obraz' }> | undefined =>
      'dzieci' in w ? w.dzieci.map(obraz).find(Boolean) : w.typ === 'obraz' ? w : undefined;
    obraz(bron.korzen)!.zasob = 'mausritter/zastepczy';
    const eksport = eksportujSzablon(zeStalym, zasoby, 'mausritter-bron').bajty;
    const paczka = importujSzablon(eksport);
    expect(paczka.zasoby.map((o) => o.id)).toContain('mausritter/zastepczy');
    const inne: DaneZasobow = new Map(zasoby);
    inne.set('mausritter/zastepczy', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0]));
    const wynik = dodajSzablon(projekt, inne, paczka);
    const nowy = wynik.projekt.szablony.find((s) => s.id === wynik.szablonId)!;
    expect(JSON.stringify(nowy)).toContain('mausritter/zastepczy-2');
    expect(wynik.zasoby.get('mausritter/zastepczy')).toBe(inne.get('mausritter/zastepczy'));
    expect(wynik.zasoby.get('mausritter/zastepczy-2')).toEqual(zasoby.get('mausritter/zastepczy'));
  });

  it('nie podmienia czcionek ani ról projektu; konflikty jako ostrzeżenia', () => {
    const paczka = importujSzablon(eksportujSzablon(projekt, zasoby, 'mausritter-bron').bajty);
    const inny = structuredClone(projekt);
    inny.role.tytul = 'EB Garamond';
    for (const o of inny.zasoby) if (o.rodzaj === 'czcionka') o.id = `${o.id}-moja`;
    const daneInne: DaneZasobow = new Map(
      [...zasoby].map(([id, d]) => [
        inny.zasoby.find((o) => o.id === `${id}-moja`) ? `${id}-moja` : id,
        d,
      ]),
    );
    // Inna treść czcionki o tej samej rodzinie i wariancie.
    const garamond = inny.zasoby.find(
      (o) => o.rodzaj === 'czcionka' && o.rodzina === 'EB Garamond',
    )!;
    const grenze = inny.zasoby.find(
      (o) => o.rodzaj === 'czcionka' && o.rodzina === 'Grenze Gotisch',
    )!;
    daneInne.set(garamond.id, daneInne.get(grenze.id)!);
    const wynik = dodajSzablon(inny, daneInne, paczka);
    expect(wynik.projekt.role.tytul).toBe('EB Garamond');
    expect(wynik.projekt.zasoby).toHaveLength(inny.zasoby.length);
    expect(wynik.ostrzezenia.join('\n')).toMatch(/Rola „tytul”/);
    expect(wynik.ostrzezenia.join('\n')).toMatch(/dwie czcionki „EB Garamond”/);
  });

  it('powtórny import tego samego szablonu dostaje nowe id', () => {
    const paczka = importujSzablon(eksportujSzablon(projekt, zasoby, 'mausritter-bron').bajty);
    const wynik = dodajSzablon(projekt, zasoby, paczka);
    expect(wynik.szablonId).toBe('mausritter-bron-2');
  });
});
