/// <reference types="node" />
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import Dexie from 'dexie';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { WERSJA_SCHEMATU, type DaneZasobow, type Projekt } from '../model/projekt';
import { korzenKarty, type WariantCzcionki, type Wezel } from '../model/szablon';
import { pakietMausritter } from '../pakiety/mausritter';
import { ZESTAWY_STYLOW } from '../ozdobniki/zestawyStylow';
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
import { BladDanych, MIGRACJE, migruj, ostrzezeniaProjektu, przygotujProjekt } from './schemat';
import { szablonCzaru, szablonStatystyk, szablonWroga } from '../silnik/__testy__/przyklady';
import { nowyWezel, utworzGrupeStylu, zastosujZestawStylu, zmienGrupeStylu } from './szablon';

const czcionka = async (plik: string) => new Uint8Array(readFileSync(`public/czcionki/${plik}`));
const obraz = async () =>
  new Uint8Array(readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png'));

let projekt: Projekt;
let zasoby: DaneZasobow;

beforeAll(async () => {
  ({ projekt, zasoby } = await projektZPakietu(pakietMausritter, czcionka, obraz, 'p1'));
});

it('aktualizuje bazę IndexedDB 3 i zapisuje oddzielnie metadane oraz paczki', async () => {
  const nazwa = 'm2c-migracja';
  const stara = new Dexie(nazwa);
  stara.version(3).stores({
    projekty: 'id, zmieniono',
    zasoby: '[projektId+id], projektId',
    miniatury: 'id',
    uklady: 'id, nazwa',
  });
  await stara.table('projekty').add({
    id: projekt.id,
    zmieniono: projekt.zmieniono,
    projekt: { ...projekt, wersja: 16 },
  });
  await stara.table('miniatury').add({ id: projekt.id, svg: '<svg/>' });
  await stara.table('zasoby').bulkAdd(
    [...zasoby].map(([id, bajty]) => ({
      projektId: projekt.id,
      id,
      dane: new Blob([bajty as Uint8Array<ArrayBuffer>]),
    })),
  );
  const uklad = {
    id: 'stary',
    nazwa: 'Stary układ',
    papier: 'A4',
    orientacja: 'pionowa',
    slot: { szerokosc: 63, wysokosc: 88 },
    uklad: {
      kolumny: 3,
      rzedy: 3,
      gora: 10,
      lewo: 10,
      odstepPoziomy: 2,
      odstepPionowy: 2,
      linieCiecia: false,
    },
  };
  await stara.table('uklady').add(uklad);
  stara.close();

  const nowa = new BazaProjektow(nazwa);
  expect(await nowa.istnieje(projekt.id)).toBe(true);
  const odczyt = await nowa.wczytaj(projekt.id);
  expect(odczyt.projekt).toEqual(projekt);
  expect(odczyt.zasoby).toEqual(zasoby);
  expect(await nowa.miniatury()).toEqual(new Map([[projekt.id, '<svg/>']]));
  expect(await nowa.uklady()).toEqual([uklad]);
  expect(await nowa.bibliotekaGlobalna('szablon')).toEqual([]);
  const bajty = eksportujSzablon(projekt, zasoby, projekt.szablony[0]!.id).bajty;
  await nowa.zapiszWBibliotece('szablon', 'Szablon', bajty);
  const [wpis] = await nowa.bibliotekaGlobalna('szablon');
  expect(wpis).toEqual({ id: expect.any(String), rodzaj: 'szablon', nazwa: 'Szablon' });
  expect(await nowa.bibliotekaGlobalna('ozdobnik')).toEqual([]);
  expect(await nowa.odczytajZBiblioteki(wpis!.id)).toEqual(bajty);
  await nowa.usunZBiblioteki(wpis!.id);
  expect(await nowa.bibliotekaGlobalna('szablon')).toEqual([]);
  await expect(nowa.odczytajZBiblioteki(wpis!.id)).rejects.toThrow(BladDanych);
});

const rowne = (a: DaneZasobow, b: DaneZasobow) => {
  expect([...b.keys()].sort()).toEqual([...a.keys()].sort());
  for (const [id, dane] of a) expect(Buffer.from(b.get(id)!).equals(Buffer.from(dane))).toBe(true);
};

it('odczytuje starszą paczkę zapisaną jako Blob obok nowych paczek z tablicą bajtów', async () => {
  const nazwa = 'test-migracji-paczek';
  const stara = new Dexie(nazwa);
  stara.version(4).stores({
    projekty: 'id, zmieniono',
    zasoby: '[projektId+id], projektId',
    miniatury: 'id',
    uklady: 'id, nazwa',
    bibliotekaGlobalna: 'id, rodzaj',
    paczkiBiblioteki: 'id',
  });
  const stare = Uint8Array.of(1, 2, 3);
  await stara.table('paczkiBiblioteki').add({ id: 'starsza', dane: new Blob([stare]) });
  stara.close();
  const baza = new BazaProjektow(nazwa);
  const nowe = Uint8Array.of(4, 5, 6);
  await baza.zapiszWBibliotece('szablon', 'Nowa', nowe);
  const [wpis] = await baza.bibliotekaGlobalna('szablon');
  expect(await baza.odczytajZBiblioteki('starsza')).toEqual(stare);
  expect(await baza.odczytajZBiblioteki(wpis!.id)).toEqual(nowe);
  await baza.zapisz(projekt, zasoby);
  await stara.open();
  expect((await stara.table('paczkiBiblioteki').get(wpis!.id)).dane).toBeInstanceOf(Uint8Array);
  expect(
    (await stara.table('zasoby').get([projekt.id, projekt.zasoby[0]!.id])).dane,
  ).toBeInstanceOf(Uint8Array);
  stara.close();
});

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
  it('migruje projekt 16 do aktualnej wersji i zachowuje dotychczasowe arkusze pakietu', () => {
    const stary = { ...projekt, wersja: 16 };
    const wczytany = importujProjekt(eksportujProjekt(stary, zasoby)).projekt;
    expect(wczytany).toEqual(projekt);
    expect(wczytany.arkusze).toEqual(stary.arkusze);
    expect(migruj({ wersja: 16 }, 'szablon', 17)).toEqual({ wersja: 17 });
  });

  it('round-trip: projekt i bajty zasobów identyczne', () => {
    const bajty = eksportujProjekt(projekt, zasoby);
    const wynik = importujProjekt(bajty);
    expect(wynik.projekt).toEqual(projekt);
    rowne(zasoby, wynik.zasoby);
  });

  it('szablony z klockami M2 (ramka, romb, tabela, separator, formatowanie) – round-trip', () => {
    const p: Projekt = {
      ...projekt,
      szablony: [...projekt.szablony, szablonCzaru, szablonStatystyk, szablonWroga],
    };
    expect(importujProjekt(eksportujProjekt(p, zasoby)).projekt).toEqual(p);
    const zly = structuredClone(p);
    const wrog = zly.szablony.at(-1)!;
    const romb = wrog.korzen.dzieci[1]!;
    if (!('dzieci' in romb)) throw new Error();
    (romb.dzieci[0] as { etykieta: { pozycja: string } }).etykieta.pozycja = 'przed';
    expect(() => importujProjekt(eksportujProjekt(zly, zasoby))).toThrow(/niedozwolona wartość/);
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

  it('własny układ arkusza: poprawny przechodzi, zły (0 kolumn, ujemny odstęp, brak linii) – błąd', () => {
    const uklad = {
      kolumny: 3,
      rzedy: 3,
      gora: 10,
      lewo: 10,
      odstepPoziomy: 2,
      odstepPionowy: 2,
      linieCiecia: true,
    };
    const ok = structuredClone(projekt);
    ok.arkusze[0]!.ustawienia.uklad = uklad;
    expect(
      importujProjekt(eksportujProjekt(ok, zasoby)).projekt.arkusze[0]!.ustawienia.uklad,
    ).toEqual(uklad);
    for (const zle of [
      { ...uklad, kolumny: 0 },
      { ...uklad, odstepPoziomy: -1 },
      { ...uklad, linieCiecia: undefined },
    ]) {
      const p = structuredClone(projekt);
      p.arkusze[0]!.ustawienia.uklad = zle as never;
      expect(() => importujProjekt(eksportujProjekt(p, zasoby))).toThrow(BladDanych);
    }
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
    // Fikcyjny krok N → N+1 (prawdziwe 1 → … → N już istnieją).
    const N = WERSJA_SCHEMATU;
    MIGRACJE.szablon[N] = ({ szablonStary, ...reszta }) => ({ ...reszta, szablon: szablonStary });
    try {
      expect(migruj({ wersja: 1, szablonStary: 'x' }, 'szablon', N + 1)).toEqual({
        wersja: N + 1,
        szablon: 'x',
      });
      expect(() => migruj({ wersja: N }, 'projekt', N + 1)).toThrow(
        new RegExp(`Brak migracji danych ze schematu ${N}`),
      );
    } finally {
      delete MIGRACJE.szablon[N];
    }
    expect(migruj({ wersja: 1, a: 1 })).toEqual({ wersja: N, a: 1 });
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

  it('„Moje układy”: zapis, lista alfabetycznie, nadpisanie, usunięcie', async () => {
    baza = new BazaProjektow('test-uklady');
    const u = {
      id: 'u1',
      nazwa: 'Perforacja 3×3',
      papier: 'A4' as const,
      orientacja: 'pionowa' as const,
      slot: { szerokosc: 63, wysokosc: 88 },
      uklad: {
        kolumny: 3,
        rzedy: 3,
        gora: 12,
        lewo: 8,
        odstepPoziomy: 4,
        odstepPionowy: 3,
        linieCiecia: false,
      },
    };
    await baza.zapiszUklad(u);
    await baza.zapiszUklad({ ...u, id: 'u2', nazwa: 'Arkusz A' });
    expect((await baza.uklady()).map((x) => x.nazwa)).toEqual(['Arkusz A', 'Perforacja 3×3']);
    await baza.zapiszUklad({ ...u, nazwa: 'Zdjęcie' });
    await baza.usunUklad('u2');
    expect(await baza.uklady()).toEqual([{ ...u, nazwa: 'Zdjęcie' }]);
    // Rekord niezgodny ze schematem (np. 0 kolumn) jest pomijany.
    await baza.zapiszUklad({ ...u, id: 'zly', uklad: { ...u.uklad, kolumny: 0 } });
    expect((await baza.uklady()).map((x) => x.id)).toEqual(['u1']);
  });

  it('preset z dopasowaniem i bez (sprzed M2b-1) jest czytany; luz poza 0–5 mm odrzucany', async () => {
    baza = new BazaProjektow('test-dopasowanie');
    const u = {
      id: 'u1',
      nazwa: 'Stary',
      papier: 'A4' as const,
      orientacja: 'pionowa' as const,
      slot: { szerokosc: 63.5, wysokosc: 89 },
      uklad: {
        kolumny: 3,
        rzedy: 3,
        gora: 12,
        lewo: 8,
        odstepPoziomy: 0,
        odstepPionowy: 0,
        linieCiecia: false,
      },
    };
    const dop = {
      luz: 1.5,
      polozenie: 'lewy-gorny' as const,
      tloDoSlotu: true,
      linie: 'karta' as const,
    };
    await baza.zapiszUklad(u);
    await baza.zapiszUklad({ ...u, id: 'u2', nazwa: 'Nowy', dopasowanie: dop });
    await baza.zapiszUklad({ ...u, id: 'u3', nazwa: 'Zły', dopasowanie: { ...dop, luz: 6 } });
    const lista = await baza.uklady();
    expect(lista.map((x) => x.id)).toEqual(['u2', 'u1']);
    expect(lista[0]!.dopasowanie).toEqual(dop);
    expect(lista[1]!.dopasowanie).toBeUndefined();
  });

  it('projekt ze schematu 7 (bez dopasowania) wczytuje się bez dopisywania pola; dopasowanie przechodzi walidację', () => {
    const stary = { ...structuredClone(projekt), wersja: 7 };
    const a0 = stary.arkusze[0]!;
    expect(a0.ustawienia.dopasowanie).toBeUndefined();
    const wczytany = importujProjekt(eksportujProjekt(stary, zasoby)).projekt;
    expect(wczytany.wersja).toBe(WERSJA_SCHEMATU);
    expect(wczytany.arkusze[0]!.ustawienia.dopasowanie).toBeUndefined();
    const nowy = structuredClone(projekt);
    const dop = { luz: 2, polozenie: 'srodek' as const, tloDoSlotu: false, linie: 'slot' as const };
    nowy.arkusze[0]!.ustawienia.dopasowanie = dop;
    expect(
      importujProjekt(eksportujProjekt(nowy, zasoby)).projekt.arkusze[0]!.ustawienia.dopasowanie,
    ).toEqual(dop);
    nowy.arkusze[0]!.ustawienia.dopasowanie = { ...dop, luz: -1 };
    expect(() => importujProjekt(eksportujProjekt(nowy, zasoby))).toThrow();
  });

  it('projekt ze schematu 8 (bez mieszanych rozmiarów) wczytuje się bez zmian; pola mieszane przechodzą walidację', () => {
    const stary = { ...structuredClone(projekt), wersja: 8 };
    const wczytany = importujProjekt(eksportujProjekt(stary, zasoby)).projekt;
    expect(wczytany.wersja).toBe(WERSJA_SCHEMATU);
    expect(wczytany.arkusze[0]!.ustawienia.rozmiary).toBeUndefined();
    expect(wczytany.arkusze[0]!.kolejnosc).toBeUndefined();
    const nowy = structuredClone(projekt);
    const a = nowy.arkusze[0]!;
    const karta = nowy.talie.find((t) => t.id === a.taliaId)!.karty[0]!.id;
    a.ustawienia.rozmiary = 'mieszane';
    a.ustawienia.mieszane = {
      kolejnosc: 'wlasna',
      obracaj: true,
      grupujRozmiary: false,
      odstep: 1.5,
    };
    a.kolejnosc = [karta];
    const z = importujProjekt(eksportujProjekt(nowy, zasoby)).projekt.arkusze[0]!;
    expect(z.ustawienia.rozmiary).toBe('mieszane');
    expect(z.ustawienia.mieszane).toEqual(a.ustawienia.mieszane);
    expect(z.kolejnosc).toEqual([karta]);
    a.ustawienia.mieszane = { ...a.ustawienia.mieszane, odstep: -1 };
    expect(() => importujProjekt(eksportujProjekt(nowy, zasoby))).toThrow();
    a.ustawienia.mieszane = { ...a.ustawienia.mieszane, odstep: 0 };
    a.ustawienia.rozmiary = 'inne' as never;
    expect(() => importujProjekt(eksportujProjekt(nowy, zasoby))).toThrow();
  });

  it('lista, zmiana samego dokumentu, usuwanie', async () => {
    baza = new BazaProjektow('test-lista');
    await baza.zapisz(projekt, zasoby);
    const nowy = { ...projekt, nazwa: 'Zmieniony', zmieniono: '2099-01-01T00:00:00.000Z' };
    await baza.zapisz(nowy);
    expect(await baza.lista()).toEqual([
      {
        id: 'p1',
        nazwa: 'Zmieniony',
        zmieniono: '2099-01-01T00:00:00.000Z',
        liczbaKart: projekt.talie.reduce((s, t) => s + t.karty.reduce((a, k) => a + k.ilosc, 0), 0),
        liczbaStron: 3,
      },
    ]);
    await baza.zapiszMiniature('p1', '<svg/>');
    expect((await baza.miniatury()).get('p1')).toBe('<svg/>');
    rowne(zasoby, (await baza.wczytaj('p1')).zasoby);
    await baza.usun('p1');
    expect(await baza.lista()).toEqual([]);
    expect((await baza.miniatury()).size).toBe(0);
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
  it('M3-3: migracja v18 zachowuje dosłowny tekst, a paczka v19 przenosi ustawienia notacji', () => {
    const wzor = projekt.szablony[0]!;
    const pole = {
      id: 'tekst',
      typ: 'tekst' as const,
      tekst: '1. :star:',
      styl: { czcionka: 'tresc', rozmiar: 3 },
    };
    const szablon = { ...wzor, korzen: { ...wzor.korzen, dzieci: [pole] } };
    const p = { ...projekt, szablony: [szablon] };
    expect(
      importujSzablon(eksportujSzablon({ ...p, wersja: 18 }, zasoby, szablon.id).bajty).szablon,
    ).toEqual(szablon);
    const nowy = {
      ...szablon,
      korzen: {
        ...szablon.korzen,
        dzieci: [
          {
            ...pole,
            listyNumerowane: true,
            ikonyWTekscie: true,
          },
        ],
      },
    };
    expect(
      importujSzablon(eksportujSzablon({ ...p, szablony: [nowy] }, zasoby, szablon.id).bajty)
        .szablon,
    ).toEqual(nowy);
  });

  it('M3-2: migruje stare projekty i szablony bez dopisywania reguł', () => {
    const stary = { ...projekt, wersja: 17 };
    expect(przygotujProjekt(stary)).toEqual(projekt);
    const id = projekt.szablony[0]!.id;
    expect(importujSzablon(eksportujSzablon(stary, zasoby, id).bajty).szablon).toEqual(
      projekt.szablony[0],
    );
  });

  it('M3-2: paczka zachowuje niezależną grupę, regułę koloru i czcionkę grupy', () => {
    const wzor = projekt.szablony[0]!;
    const pole = nowyWezel(wzor, 'tekst', 'Nazwa');
    let szablon = utworzGrupeStylu(
      {
        ...wzor,
        korzen: { ...wzor.korzen, dzieci: [pole] },
        tloZDanych: {
          klucz: 'nazwa',
          domyslny: '#ffffff',
          mapa: [{ wartosc: 'Noc', kolor: '#443366' }],
        },
      },
      pole.id,
      'Wspólny',
    );
    const grupa = szablon.grupyStylow![0]!;
    const font = projekt.zasoby.find(
      (z) => z.rodzaj === 'czcionka' && z.rodzina !== projekt.role.tresc,
    )!;
    if (font.rodzaj !== 'czcionka') throw new Error('Brak czcionki testowej');
    szablon = zmienGrupeStylu(szablon, grupa.id, {
      styl: (st) => ({ ...st, czcionka: font.rodzina }),
    });
    const p = { ...projekt, szablony: [szablon], arkusze: [], talie: [] };
    const paczka = importujSzablon(eksportujSzablon(p, zasoby, szablon.id).bajty);
    expect(paczka.szablon).toEqual(szablon);
    expect(paczka.zasoby.some((z) => z.id === font.id)).toBe(true);
    const dodany = dodajSzablon(p, zasoby, paczka);
    expect(dodany.szablonId).not.toBe(szablon.id);
    expect(dodany.projekt.szablony).toEqual([szablon, { ...szablon, id: dodany.szablonId }]);
    expect(
      importujProjekt(
        eksportujProjekt({ ...projekt, szablony: [szablon, ...projekt.szablony.slice(1)] }, zasoby),
      ).projekt.szablony[0],
    ).toEqual(szablon);
    const konflikt = { ...p, szablony: [{ ...szablon, grupyStylow: [grupa, grupa] }] };
    expect(() => importujSzablon(eksportujSzablon(konflikt, zasoby, szablon.id).bajty)).toThrow(
      BladDanych,
    );
  });

  it('szablon po zastosowaniu zestawu stylu przechodzi eksport i import', () => {
    const wzor = projekt.szablony.find((s) => s.id === 'mausritter-bron')!;
    const wariant = wzor.warianty![0]!;
    const separator = {
      ...nowyWezel(wzor, 'separator', 'Separator w wariancie'),
      id: 'separator-v',
    };
    const szablon = zastosujZestawStylu(
      {
        ...wzor,
        warianty: [
          {
            ...wariant,
            korzen: { ...wariant.korzen, dzieci: [...wariant.korzen.dzieci, separator] },
          },
        ],
      },
      ZESTAWY_STYLOW[1],
    );
    const p = { ...projekt, szablony: [szablon] };
    const { bajty } = eksportujSzablon(p, zasoby, szablon.id);
    const wynik = importujSzablon(bajty).szablon;
    expect(wynik).toEqual(szablon);
    expect(korzenKarty(wynik, { rozmiar: { kolumny: 1, rzedy: 2 } }).dzieci).toContainEqual({
      ...separator,
      ...ZESTAWY_STYLOW[1].separator,
    });
  });

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

  it('M2b-3: linia podwójna i narożniki przechodzą eksport/import szablonu bez zmian', () => {
    const wzor = projekt.szablony.find((s) => s.id === 'mausritter-bron')!;
    const ozdobny = {
      ...wzor,
      ramka: {
        grubosc: 0.3,
        kolor: '#2f5d8a',
        styl: 'podwojna' as const,
        przerwa: 0.5,
        narozniki: { element: 'wb:lisc', rozmiar: 6, kolor: '#8b0000' },
      },
      korzen: {
        ...wzor.korzen,
        obramowanie: { grubosc: 0.3, kolor: '#000000', styl: 'podwojna' as const },
        narozniki: { element: 'wb:kat', rozmiar: 4 },
      },
    };
    const p: Projekt = {
      ...projekt,
      szablony: projekt.szablony.map((s) => (s.id === ozdobny.id ? ozdobny : s)),
    };
    const paczka = importujSzablon(eksportujSzablon(p, zasoby, ozdobny.id).bajty);
    expect(paczka.szablon).toEqual(ozdobny);
    const caly = importujProjekt(eksportujProjekt(p, zasoby));
    expect(caly.projekt.szablony.find((s) => s.id === ozdobny.id)).toEqual(ozdobny);
  });

  it('M2b-3: migracja 9→10 jest tożsamościowa – stary projekt otwiera się bez zmian', () => {
    const stary = { ...structuredClone(projekt), wersja: 9 };
    const wynik = przygotujProjekt(stary);
    expect(wynik.wersja).toBe(WERSJA_SCHEMATU);
    expect(wynik.szablony).toEqual(projekt.szablony);
    expect(migruj({ wersja: 9, a: 1 }, 'szablon')).toEqual({ wersja: WERSJA_SCHEMATU, a: 1 });
  });

  it('M2b-4: migracja 10→11 jest tożsamościowa; ozdoba (motyw) przechodzi eksport i walidację', () => {
    expect(migruj({ wersja: 10, a: 1 }, 'szablon', 11)).toEqual({ wersja: 11, a: 1 });
    const wzor = projekt.szablony.find((s) => s.id === 'mausritter-bron')!;
    const ozdoba = {
      rodzaj: 'motyw' as const,
      element: 'wb:przeplot',
      szerokosc: 5,
      kolor: '#2f5d8a',
      szyny: 0.3,
      odsuniecie: 1,
    };
    const z = (o: object): Projekt => ({
      ...projekt,
      szablony: projekt.szablony.map((s) =>
        s.id === wzor.id
          ? {
              ...wzor,
              ramka: { grubosc: 0.3, kolor: '#000', ozdoba: o as never },
              korzen: { ...wzor.korzen, ozdoba: o as never },
            }
          : s,
      ),
    });
    const p = z(ozdoba);
    const paczka = importujSzablon(eksportujSzablon(p, zasoby, wzor.id).bajty);
    expect(paczka.szablon.ramka?.ozdoba).toEqual(ozdoba);
    expect(paczka.szablon.korzen.ozdoba).toEqual(ozdoba);
    expect(przygotujProjekt(p).szablony[0]).toBeDefined();
    for (const zle of [
      { ...ozdoba, szerokosc: 0 },
      { ...ozdoba, rodzaj: 'obraz' },
      { ...ozdoba, element: '' },
      { ...ozdoba, szyny: -1 },
    ])
      expect(() => przygotujProjekt(z(zle))).toThrow();
  });

  it('M2b-5: migracja 11→12 jest tożsamościowa; separator ozdobny przechodzi eksport i walidację', () => {
    expect(WERSJA_SCHEMATU).toBeGreaterThanOrEqual(12);
    expect(migruj({ wersja: 11, a: 1 }, 'szablon', 12)).toEqual({ wersja: 12, a: 1 });
    expect(migruj({ wersja: 11, a: 1 }, 'projekt', 12)).toEqual({ wersja: 12, a: 1 });
    const wzor = projekt.szablony.find((s) => s.id === 'mausritter-bron')!;
    const sep = {
      id: 'sep-oz',
      typ: 'separator' as const,
      kierunek: 'poziomy' as const,
      grubosc: 0.3,
      rysunek: { motyw: 'wb:lancuch', szerokosc: 3 },
      zakonczenia: { element: 'wb:zak-grot', rozmiar: 2.4 },
      srodek: { element: 'wb:sr-romb', rozmiar: 2.4 },
      dlugosc: { procent: 80 },
      odstepOdOzdoby: 0.4,
    };
    const z = (o: object): Projekt => ({
      ...projekt,
      szablony: projekt.szablony.map((s) =>
        s.id === wzor.id
          ? { ...wzor, korzen: { ...wzor.korzen, dzieci: [...wzor.korzen.dzieci, o as never] } }
          : s,
      ),
    });
    const p = z(sep);
    const paczka = importujSzablon(eksportujSzablon(p, zasoby, wzor.id).bajty);
    expect(paczka.szablon.korzen.dzieci.at(-1)).toEqual(sep);
    expect(przygotujProjekt(p).szablony[0]).toBeDefined();
    expect(() => przygotujProjekt(z({ ...sep, rysunek: 'inny' }))).toThrow();
    expect(() => przygotujProjekt(z({ ...sep, dlugosc: { mm: -1 } }))).toThrow();
    expect(() =>
      przygotujProjekt(z({ ...sep, zakonczenia: { element: '', rozmiar: 1 } })),
    ).toThrow();
    expect(() => przygotujProjekt(z({ ...sep, odstepOdOzdoby: -1 }))).toThrow();
    expect(() => przygotujProjekt(z({ ...sep, dlugosc: { procent: 101 } }))).toThrow();
    expect(przygotujProjekt(z({ ...sep, rysunek: 'linia', dlugosc: { mm: 30 } }))).toBeDefined();
  });

  it('M2b-3: schemat przyjmuje narożniki, przerwę i styl podwójny, odrzuca błędne wartości', () => {
    const wzor = projekt.szablony.find((s) => s.id === 'mausritter-bron')!;
    const z = (ramka: object, korzen: object = {}): Projekt => ({
      ...projekt,
      szablony: projekt.szablony.map((s) =>
        s.id === wzor.id
          ? { ...wzor, ramka: ramka as never, korzen: { ...wzor.korzen, ...korzen } }
          : s,
      ),
    });
    const ok = { grubosc: 0.3, kolor: '#000', styl: 'podwojna', przerwa: 0 };
    expect(() => przygotujProjekt(z(ok))).not.toThrow();
    expect(() =>
      przygotujProjekt(z({ ...ok, narozniki: { element: 'wb:kat', rozmiar: 5 } })),
    ).not.toThrow();
    expect(() =>
      przygotujProjekt(z(ok, { narozniki: { element: 'wb:kat', rozmiar: 5, kolor: '#fff' } })),
    ).not.toThrow();
    for (const zle of [
      { ...ok, przerwa: -1 },
      { ...ok, styl: 'potrojna' },
      { ...ok, narozniki: { rozmiar: 5 } },
      { ...ok, narozniki: { element: '', rozmiar: 5 } },
      { ...ok, narozniki: { element: 'wb:kat', rozmiar: 0 } },
    ])
      expect(() => przygotujProjekt(z(zle))).toThrow();
    expect(() => przygotujProjekt(z(ok, { narozniki: { element: 'wb:kat' } }))).toThrow();
  });

  it('M2b-3: niepoprawne narożniki są odrzucane', () => {
    const wzor = projekt.szablony.find((s) => s.id === 'mausritter-bron')!;
    const zly: Projekt = {
      ...projekt,
      szablony: [
        {
          ...wzor,
          ramka: { grubosc: 0.3, kolor: '#000', narozniki: { element: 'x', rozmiar: -1 } },
        },
      ],
    };
    expect(() => importujProjekt(eksportujProjekt(zly, zasoby))).toThrow();
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
