/// <reference types="node" />
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import Dexie from 'dexie';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { WERSJA_SCHEMATU, type DaneZasobow, type Projekt } from '../model/projekt';
import { korzenKarty, type Rewers, type WariantCzcionki, type Wezel } from '../model/szablon';
import { pakietMausritter } from '../pakiety/mausritter';
import { ZESTAWY_STYLOW } from '../ozdobniki/zestawyStylow';
import {
  dodajRewers,
  duplikujRewersWProjekcie,
  nowyRewers,
  przypisaniaRewersu,
  przypiszRewers,
  przypiszRewersKartom,
  rewersJakoSzablon,
  rewersKarty,
  szablonDoRewersu,
  ustawStalyObrazRewersu,
  ustawTekstureRewersu,
  usunRewers,
  zmienRewers,
  zrodloRewersuKarty,
} from './rewers';
import { BazaProjektow } from './baza';
import { cofnij, ponow, pustaHistoria, zapamietaj } from './historia';
import { szablonyUzywajace } from './biblioteka';
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
import {
  nowyWezel,
  skopiujStyl,
  utworzGrupeStylu,
  wklejStyl,
  zastosujZestawStylu,
  zmienGrupeStylu,
  zmienKolejnoscRysowania,
  zmienTypPola,
} from './szablon';

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

  it('migracja 27→28: rozciągane kształty wartości zachowują dotychczasowy wygląd', () => {
    const wezly = [
      { id: 'a', typ: 'wartosc', ksztalt: 'romb' },
      { id: 'b', typ: 'wartosc', ksztalt: 'wlasny', ksztaltElement: 'x' },
      { id: 'c', typ: 'wartosc', ksztalt: 'kolo' },
      { id: 'd', typ: 'tekst', ksztalt: 'romb' },
    ];
    const dane = { wersja: 27, szablony: [{ korzen: { typ: 'kolumna', dzieci: wezly } }] };
    for (const rodzaj of ['projekt', 'szablon'] as const) {
      const wynik = migruj(dane, rodzaj, 28) as typeof dane;
      expect(wynik.wersja).toBe(28);
      expect(wynik.szablony[0]!.korzen.dzieci).toEqual([
        { ...wezly[0], zachowajProporcje: false },
        { ...wezly[1], zachowajProporcje: false },
        wezly[2],
        wezly[3],
      ]);
    }
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
      expect.objectContaining({
        id: 'p1',
        nazwa: 'Zmieniony',
        zmieniono: '2099-01-01T00:00:00.000Z',
        liczbaKart: projekt.talie.reduce((s, t) => s + t.karty.reduce((a, k) => a + k.ilosc, 0), 0),
        liczbaStron: 3,
      }),
    ]);
    await baza.zapiszMiniature('p1', '<svg/>');
    expect((await baza.miniatury()).get('p1')).toBe('<svg/>');
    rowne(zasoby, (await baza.wczytaj('p1')).zasoby);
    await baza.usun('p1');
    expect(await baza.lista()).toEqual([]);
    expect((await baza.miniatury()).size).toBe(0);
    await expect(baza.wczytaj('p1')).rejects.toThrow(/Nie ma projektu/);
  });

  it('lista() wyznacza aktywnySzablonId i aktywnyRewersId, a szablonyAwersowZProjektow pomija identyczne kopie', async () => {
    baza = new BazaProjektow('test-lista-dedup');
    const rev = {
      id: 'r1',
      nazwa: 'Rewers 1',
      rozmiar: { tryb: 'mm' as const, szerokosc: 63, wysokosc: 88 },
      korzen: { id: 'rk', typ: 'swobodny' as const, dzieci: [] },
    };
    const p1 = {
      ...projekt,
      id: 'pw1',
      pakiet: 'wlasne',
      zmieniono: '2026-11-22T10:00:00.000Z',
      rewersy: [rev],
      talie: projekt.talie.map((tl, i) => (i === 0 ? { ...tl, rewersId: 'r1' } : tl)),
    };
    const p2 = {
      ...projekt,
      id: 'pw2',
      pakiet: 'wlasne',
      zmieniono: '2026-11-22T09:00:00.000Z',
    };
    await baza.zapisz(p1, zasoby);
    await baza.zapisz(p2, zasoby);
    const podsumowania = await baza.lista();
    const w1 = podsumowania.find((x) => x.id === 'pw1')!;
    expect(w1.aktywnySzablonId).toBeTruthy();
    expect(w1.aktywnyRewersId).toBe('r1');
    const wszystkie = await baza.szablonyAwersowZProjektow();
    const tresci = wszystkie.map((s) => s.kluczTresci);
    expect(new Set(tresci).size).toBe(tresci.length);
    // pw2 to kopia pw1 – jego szablony są identyczne, więc na liście są tylko z pw1.
    expect(wszystkie.every((s) => s.projektId === 'pw1')).toBe(true);
    const pierwsza = tresci[0]!;
    const bezPierwszej = await baza.szablonyAwersowZProjektow(undefined, new Set([pierwsza]));
    expect(bezPierwszej.some((s) => s.kluczTresci === pierwsza)).toBe(false);
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
  it('M3-6: migruje kąty proste z v21 i zachowuje kąt dziesiętny w paczce', () => {
    const wzor = projekt.szablony[0]!;
    const ikona = {
      id: 'ikona',
      typ: 'ikona' as const,
      ikona: 'gwiazdka' as const,
      rozmiar: 3,
      pozycja: { x: 1, y: 2, obrot: 270 },
    };
    const stary = { ...wzor, korzen: { id: 's', typ: 'swobodny' as const, dzieci: [ikona] } };
    const p21 = { ...projekt, wersja: 21, szablony: [stary], arkusze: [], talie: [] };
    expect(przygotujProjekt(p21).szablony[0]).toEqual(stary);
    expect(importujSzablon(eksportujSzablon(p21, zasoby, stary.id).bajty).szablon).toEqual(stary);
    const nowy = {
      ...stary,
      korzen: {
        ...stary.korzen,
        dzieci: [{ ...ikona, pozycja: { ...ikona.pozycja, obrot: 32.5 } }],
      },
    };
    expect(
      importujSzablon(
        eksportujSzablon({ ...p21, wersja: WERSJA_SCHEMATU, szablony: [nowy] }, zasoby, nowy.id)
          .bajty,
      ).szablon,
    ).toEqual(nowy);
  });

  it('M3-5: migruje projekt v20 i przenosi tekstury z przemianowaniem zasobu', () => {
    expect(przygotujProjekt({ ...projekt, wersja: 20 })).toEqual(projekt);
    const obraz = projekt.zasoby.find((z) => z.rodzaj === 'obraz')!;
    const wzor = projekt.szablony[0]!;
    const tekstura = {
      ...wzor,
      teksturaTla: obraz.id,
      postrzepienie: { sila: 1, ziarno: 1, ziarnistosc: 2 },
      korzen: { ...wzor.korzen, teksturaTla: obraz.id },
    };
    const p = { ...projekt, szablony: [tekstura], talie: [], arkusze: [] };
    const paczka = importujSzablon(eksportujSzablon(p, zasoby, tekstura.id).bajty);
    expect(paczka.szablon).toEqual(tekstura);
    expect(paczka.dane.get(obraz.id)).toEqual(zasoby.get(obraz.id));
    const archiwum = unzipSync(eksportujSzablon(p, zasoby, tekstura.id).bajty);
    const json = JSON.parse(strFromU8(archiwum['szablon.json']!));
    json.zasoby = [];
    archiwum['szablon.json'] = strToU8(JSON.stringify(json));
    expect(() => importujSzablon(zipSync(archiwum))).toThrow(/brakuje obrazu tekstury/);

    const zKolizja = new Map(zasoby);
    zKolizja.set(obraz.id, Uint8Array.of(1, 2, 3));
    const wynik = dodajSzablon(p, zKolizja, paczka);
    const kopia = wynik.projekt.szablony.find((s) => s.id === wynik.szablonId)!;
    expect(kopia.teksturaTla).not.toBe(obraz.id);
    expect(kopia.korzen.teksturaTla).toBe(kopia.teksturaTla);
    expect(wynik.zasoby.get(kopia.teksturaTla!)).toEqual(zasoby.get(obraz.id));
  });

  it('M3-4: migruje v19 i przenosi opcjonalną kontynuację w paczce szablonu', () => {
    const wzor = projekt.szablony[0]!;
    const pole = {
      id: 'opis-wyprawy',
      typ: 'tekst' as const,
      klucz: 'opis',
      styl: { czcionka: 'tresc', rozmiar: 3 },
    };
    const stary = { ...wzor, korzen: { ...wzor.korzen, dzieci: [pole] } };
    const p19 = { ...projekt, wersja: 19, szablony: [stary] };
    expect(importujSzablon(eksportujSzablon(p19, zasoby, stary.id).bajty).szablon).toEqual(stary);
    const nowy = { ...stary, korzen: { ...stary.korzen, dzieci: [{ ...pole, kontynuuj: true }] } };
    expect(
      importujSzablon(eksportujSzablon({ ...projekt, szablony: [nowy] }, zasoby, nowy.id).bajty)
        .szablon,
    ).toEqual(nowy);
  });

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

describe('M4-1: rewersy', () => {
  const rewers: Rewers = {
    id: 'rewers',
    nazwa: 'Mapa',
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    korzen: { id: 'korzen', typ: 'swobodny', dzieci: [] },
  };

  it('migruje projekt i paczkę v22 bez przypisywania rewersu', () => {
    expect(przygotujProjekt({ ...projekt, wersja: 22 })).toEqual(projekt);
    const s = projekt.szablony[0]!;
    const paczka = importujSzablon(
      eksportujSzablon({ ...projekt, wersja: 22 }, zasoby, s.id).bajty,
    );
    expect(paczka.szablon).toEqual(s);
    expect(paczka.rewers).toBeUndefined();
  });

  it('rozróżnia kolejność przypisań, dziedziczenie i jawny brak rewersu', () => {
    const drugi = { ...rewers, id: 'drugi' };
    const mapa = new Map([
      [rewers.id, rewers],
      [drugi.id, drugi],
    ]);
    expect(rewersKarty(mapa, {}, {}, { rewersId: 'rewers' })).toBe(rewers);
    expect(rewersKarty(mapa, {}, { rewersId: 'drugi' }, { rewersId: 'rewers' })).toBe(drugi);
    expect(rewersKarty(mapa, { rewersId: 'rewers' }, { rewersId: 'drugi' }, {})).toBe(rewers);
    expect(rewersKarty(mapa, { rewersId: null }, { rewersId: 'drugi' }, {})).toBeUndefined();
    expect(rewersKarty(mapa, {}, { rewersId: null }, { rewersId: 'rewers' })).toBeUndefined();
  });

  it('zapisuje i odtwarza przypisania oraz usuwa rewers i referencje w jednej zmianie', async () => {
    const { projekt: bazaRewersow, id } = dodajRewers(projekt, rewers);
    const s = projekt.szablony[0]!;
    const talia = projekt.talie[0]!;
    const karta = talia.karty[0]!;
    const projektZPrzypisaniem = przypiszRewers(
      przypiszRewers(
        przypiszRewers(bazaRewersow, { rodzaj: 'talia', id: talia.id }, id),
        { rodzaj: 'szablon', id: s.id },
        id,
      ),
      { rodzaj: 'karta', taliaId: talia.id, id: karta.id },
      null,
    );
    const nazwa = 'm4-1-rewers-zapis';
    const baza = new BazaProjektow(nazwa);
    try {
      await baza.zapisz(projektZPrzypisaniem, zasoby);
      const wynik = await baza.wczytaj(projekt.id);
      expect(wynik.projekt).toEqual(projektZPrzypisaniem);
      expect(importujProjekt(eksportujProjekt(wynik.projekt, wynik.zasoby)).projekt).toEqual(
        wynik.projekt,
      );
      const bez = usunRewers(wynik.projekt, id);
      expect(bez.rewersy).toEqual([]);
      expect(bez.talie[0]!.rewersId).toBeNull();
      expect(bez.szablony[0]!.rewersId).toBeNull();
      expect(wynik.projekt.szablony[0]!.rewersId).toBe(id);
      expect(przygotujProjekt(bez)).toEqual(bez);
      expect(cofnij(zapamietaj(pustaHistoria(), wynik.projekt), bez)?.stan).toBe(wynik.projekt);
      const dziedziczy = przypiszRewers(bez, { rodzaj: 'szablon', id: s.id }, undefined);
      expect('rewersId' in dziedziczy.szablony[0]!).toBe(false);
    } finally {
      baza.zamknij();
      await Dexie.delete(nazwa);
    }
  });

  it('odrzuca obcy identyfikator lub duplikat w archiwum projektu', () => {
    const s = { ...projekt.szablony[0]!, rewersId: rewers.id };
    expect(() => przygotujProjekt({ ...projekt, szablony: [s], talie: [], arkusze: [] })).toThrow(
      /nieznany rewers/,
    );
    expect(() => przygotujProjekt({ ...projekt, rewersy: [rewers, rewers] })).toThrow(/rewersy/);
  });

  it('przenosi obraz, ozdobnik i font rewersu oraz przepisuje kolidujące identyfikatory', () => {
    const obraz = projekt.zasoby.find((o) => o.rodzaj === 'obraz')!;
    const font = projekt.zasoby.find((o) => o.rodzaj === 'czcionka')!;
    const nazwaFontu = 'Własny krój rewersu';
    const r: Rewers = {
      ...rewers,
      teksturaTla: obraz.id,
      korzen: {
        ...rewers.korzen,
        dzieci: [
          { id: 'tytul', typ: 'tekst', tekst: 'Mapa', styl: { czcionka: nazwaFontu, rozmiar: 4 } },
          { id: 'logo', typ: 'obraz', zasob: obraz.id, dopasowanie: 'dopasuj' },
        ],
      },
      ramka: { kolor: '#111111', grubosc: 1, narozniki: { element: 'wl:naroznik', rozmiar: 4 } },
    };
    const s = { ...szablonCzaru, rewersId: r.id };
    const p: Projekt = {
      ...projekt,
      szablony: [s],
      talie: [],
      arkusze: [],
      rewersy: [r],
      zasoby: [obraz, { ...font, rodzina: nazwaFontu, zrodlo: 'wlasna' }],
      biblioteka: {
        ozdobniki: [
          {
            id: 'wl:naroznik',
            nazwa: 'Narożnik rewersu',
            rodzaj: 'naroznik',
            szer: 3,
            wys: 3,
            kontury: [
              { kontur: [['M', 0, 0], ['L', 3, 0], ['L', 0, 3], ['Z']], wypelnienie: 'kolor' },
            ],
          },
        ],
      },
    };
    expect(szablonyUzywajace(p, 'wl:naroznik').map((s) => s.id)).toEqual([r.id]);
    const wynik = eksportujSzablon(p, zasoby, s.id);
    expect(wynik.ostrzezenia).toEqual([expect.stringContaining(nazwaFontu)]);
    const paczka = importujSzablon(wynik.bajty);
    expect(paczka.rewers).toEqual(r);
    const pliki = unzipSync(wynik.bajty);
    const j = JSON.parse(strFromU8(pliki['szablon.json']!));
    j.rewers.korzen.dzieci.push(j.rewers.korzen.dzieci[0]);
    pliki['szablon.json'] = strToU8(JSON.stringify(j));
    expect(() => importujSzablon(zipSync(pliki))).toThrow(/powtórzon/);

    expect(paczka.biblioteka).toEqual(p.biblioteka!.ozdobniki);
    const inneBajty = new Map(zasoby).set(obraz.id, Uint8Array.of(1));
    const cel: Projekt = {
      ...p,
      biblioteka: { ozdobniki: p.biblioteka!.ozdobniki.map((e) => ({ ...e, nazwa: 'Inny' })) },
    };
    const dodany = dodajSzablon(cel, inneBajty, paczka);
    const kopia = dodany.projekt.rewersy![1]!;
    expect(kopia.id).not.toBe(r.id);
    expect(kopia.teksturaTla).not.toBe(obraz.id);
    expect(dodany.zasoby.get(kopia.teksturaTla!)).toEqual(zasoby.get(obraz.id));
    expect(kopia.ramka!.narozniki!.element).toBe('wl:naroznik-2');
    expect(dodany.projekt.szablony.find((s) => s.id === dodany.szablonId)!.rewersId).toBe(kopia.id);
    expect(() => dodajSzablon(cel, zasoby, { ...paczka, zasoby: [] })).toThrow(/nieznany zasób/);
  });
});

describe('M4-2: edycja rewersów, tryby tła, ikony SVG i historia', () => {
  it('tworzy, duplikuje i liczy bezpośrednie przypisania rewersów oraz wspiera bezKlucza', () => {
    const utworzony = nowyRewers(projekt, { nazwa: 'Karta lasu' });
    const rid = utworzony.id;
    const rev = utworzony.projekt.rewersy!.find((r) => r.id === rid)!;
    expect(rev.korzen.typ).toBe('swobodny');

    const sz = rewersJakoSzablon(rev);
    const poleTekstu = nowyWezel(sz, 'tekst', 'Opis', { bezKlucza: true });
    expect('klucz' in poleTekstu).toBe(false);

    const talia = utworzony.projekt.talie[0]!;
    const kartyIds = talia.karty.slice(0, 2).map((k) => k.id);
    let poPrzypisaniu = przypiszRewers(utworzony.projekt, { rodzaj: 'talia', id: talia.id }, rid);
    poPrzypisaniu = przypiszRewers(
      poPrzypisaniu,
      { rodzaj: 'szablon', id: poPrzypisaniu.szablony[0]!.id },
      rid,
    );
    poPrzypisaniu = przypiszRewersKartom(poPrzypisaniu, talia.id, kartyIds, rid);
    expect(przypisaniaRewersu(poPrzypisaniu, rid)).toEqual({
      talie: 1,
      szablony: 1,
      karty: 2,
      razem: 4,
    });

    const kopia = duplikujRewersWProjekcie(poPrzypisaniu, rid, (n) =>
      n === 1 ? 'kopia' : `kopia ${n}`,
    );
    expect(kopia.id).not.toBe(rid);
    expect(kopia.projekt.rewersy!.some((r) => r.id === kopia.id)).toBe(true);
    expect(
      zrodloRewersuKarty(
        new Map(kopia.projekt.rewersy!.map((r) => [r.id, r])),
        {},
        { rewersId: null },
        { rewersId: rid },
      ),
    ).toEqual({ skad: 'szablon', wylaczony: true });
  });

  it('obsługuje zmianę kolejności warstw oraz cofanie/ponawianie w rewersie i migrację v24', () => {
    const v23 = migruj({ ...projekt, wersja: 23 }, 'projekt');
    expect((v23 as Projekt).wersja).toBe(WERSJA_SCHEMATU);

    const baza = nowyRewers(projekt, { nazwa: 'Test kolejności' });
    const start = baza.projekt;
    const rev = start.rewersy!.find((r) => r.id === baza.id)!;
    const revZWierstwa: Rewers = {
      ...rev,
      teksturaTryb: 'kafelki',
      korzen: {
        ...rev.korzen,
        dzieci: [
          {
            id: 'w1',
            typ: 'tekst',
            tekst: 'Dolny',
            pozycja: { x: 5, y: 5 },
            styl: { czcionka: 'tresc', rozmiar: 4 },
          },
          { id: 'w2', typ: 'ikona', ikona: 'gwiazdka', element: 'wl:herb', rozmiar: 6 },
        ],
      },
    };
    const sz = rewersJakoSzablon(revZWierstwa);
    const poKolejnosci = zmienKolejnoscRysowania(sz, 'w1', 'na-wierzch');
    expect(poKolejnosci.korzen.dzieci.map((d) => d.id)).toEqual(['w2', 'w1']);
    const zaktualizowany = szablonDoRewersu(revZWierstwa, poKolejnosci);
    expect(zaktualizowany.teksturaTryb).toBe('kafelki');

    const p1: Projekt = {
      ...start,
      rewersy: start.rewersy!.map((r) => (r.id === baza.id ? revZWierstwa : r)),
    };
    const p2: Projekt = {
      ...start,
      rewersy: start.rewersy!.map((r) => (r.id === baza.id ? zaktualizowany : r)),
    };
    const hist = zapamietaj(pustaHistoria<Projekt>(), p1);
    const krokCof = cofnij(hist, p2);
    expect(
      krokCof?.stan.rewersy!.find((r) => r.id === baza.id)?.korzen.dzieci.map((d) => d.id),
    ).toEqual(['w1', 'w2']);
    const krokPon = ponow(krokCof!.historia, krokCof!.stan);
    expect(
      krokPon?.stan.rewersy!.find((r) => r.id === baza.id)?.korzen.dzieci.map((d) => d.id),
    ).toEqual(['w2', 'w1']);
    expect(szablonyUzywajace(p1, 'wl:herb').map((s) => s.id)).toEqual([baza.id]);
  });
});

describe('M4-3: schemat v25, tekst po łuku, krycie warstw i zabarwienie tła', () => {
  it('migruje projekt i szablon v24 do v25 oraz waliduje nowe pola', () => {
    expect(WERSJA_SCHEMATU).toBeGreaterThanOrEqual(25);
    expect(migruj({ wersja: 24, a: 1 }, 'projekt', 25)).toEqual({ wersja: 25, a: 1 });
    expect(migruj({ wersja: 24, a: 1 }, 'szablon', 25)).toEqual({ wersja: 25, a: 1 });
    expect(przygotujProjekt({ ...projekt, wersja: 24 })).toEqual(projekt);

    const obraz = projekt.zasoby.find((z) => z.rodzaj === 'obraz')!;
    const rev: Rewers = {
      id: 'rev-m43',
      nazwa: 'Rewers z efektami',
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      tlo: '#1e293b',
      teksturaTla: obraz.id,
      teksturaTryb: 'wypelnij',
      teksturaKrycie: 0.65,
      teksturaZabarwienie: { kolor: '#7c2d12', krycie: 0.3 },
      korzen: {
        id: 'korzen',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'napis-luk',
            typ: 'tekst',
            tekst: 'KARTA PRZYGODY',
            krycie: 0.85,
            pozycja: { x: 6, y: 10 },
            szerokosc: { mm: 51 },
            styl: { czcionka: 'tytul', rozmiar: 5, kolor: '#f8fafc', wyrownanie: 'srodek' },
            luk: { promien: 40, kierunek: 'gora' },
          },
          {
            id: 'znak',
            typ: 'ikona',
            ikona: 'gwiazdka',
            rozmiar: 8,
            krycie: 0.5,
            pozycja: { x: 27, y: 40 },
          },
        ],
      },
    };

    const zRev = (r: object): Projekt => ({
      ...projekt,
      rewersy: [r as Rewers],
    });

    // Poprawny rewers przechodzi walidację oraz round-trip przez szablonDoRewersu i archiwa ZIP.
    const valid = przygotujProjekt(zRev(rev));
    expect(valid.rewersy).toEqual([rev]);

    const poEdycji = szablonDoRewersu(rev, rewersJakoSzablon(rev));
    expect(poEdycji.teksturaKrycie).toBe(0.65);
    expect(poEdycji.teksturaZabarwienie).toEqual({ kolor: '#7c2d12', krycie: 0.3 });

    // Kopiowanie i wklejanie stylu przenosi krycie i łuk tekstu.
    const zrodlo = rev.korzen.dzieci[0]!;
    const cel: Wezel = {
      id: 'cel',
      typ: 'tekst',
      tekst: 'Inny',
      styl: { czcionka: 'tresc', rozmiar: 4 },
    };
    const wklejony = wklejStyl(cel, skopiujStyl(zrodlo));
    expect(wklejony.krycie).toBe(0.85);
    expect(wklejony.typ === 'tekst' && wklejony.luk).toEqual({ promien: 40, kierunek: 'gora' });

    // Archiwum projektu i szablonu (z przypisanym rewersem) zachowuje efekty M4-3.
    const szablonZRev = { ...projekt.szablony[0]!, rewersId: rev.id };
    const pArch: Projekt = {
      ...projekt,
      rewersy: [rev],
      szablony: [szablonZRev, ...projekt.szablony.slice(1)],
    };
    const roundProjekt = importujProjekt(eksportujProjekt(pArch, zasoby));
    expect(roundProjekt.projekt.rewersy).toEqual([rev]);
    const roundSzablon = importujSzablon(eksportujSzablon(pArch, zasoby, szablonZRev.id).bajty);
    expect(roundSzablon.rewers).toEqual(rev);

    // Odrzucenie niepoprawnych wartości poza zakresem.
    expect(() => przygotujProjekt(zRev({ ...rev, teksturaKrycie: 1.5 }))).toThrow();
    expect(() => przygotujProjekt(zRev({ ...rev, teksturaKrycie: -0.1 }))).toThrow();
    expect(() =>
      przygotujProjekt(zRev({ ...rev, teksturaZabarwienie: { kolor: '#000', krycie: 1.2 } })),
    ).toThrow();
    expect(() =>
      przygotujProjekt(
        zRev({
          ...rev,
          korzen: {
            ...rev.korzen,
            dzieci: [{ ...rev.korzen.dzieci[0]!, krycie: -0.2 }],
          },
        }),
      ),
    ).toThrow();
    expect(() =>
      przygotujProjekt(
        zRev({
          ...rev,
          korzen: {
            ...rev.korzen,
            dzieci: [{ ...rev.korzen.dzieci[0]!, luk: { promien: 0, kierunek: 'gora' } }],
          },
        }),
      ),
    ).toThrow();
    expect(() =>
      przygotujProjekt(
        zRev({
          ...rev,
          korzen: {
            ...rev.korzen,
            dzieci: [{ ...rev.korzen.dzieci[0]!, luk: { promien: 30, kierunek: 'lewo' } }],
          },
        }),
      ),
    ).toThrow();
  });

  it('zmienTypPola zachowuje krycie i tryb bezKlucza; pomocniki rewersu obsługują tekstury, obrazy i źródła', async () => {
    const { projekt: zNowym, id: revId } = nowyRewers(projekt, { nazwa: 'Testowy' });
    const rev0 = zNowym.rewersy!.find((r) => r.id === revId)!;

    // zmienRewers aktualizuje rewers, a brak zmian zwraca referencję projektu.
    expect(zmienRewers(zNowym, revId, (r) => r)).toBe(zNowym);
    const zNazwa = zmienRewers(zNowym, revId, (r) => ({ ...r, nazwa: 'Zmieniony' }));
    expect(zNazwa.rewersy!.find((r) => r.id === revId)?.nazwa).toBe('Zmieniony');

    // ustawTekstureRewersu i szablonDoRewersu bez tekstury nie zostawiają osieroconych pól.
    const png = await obraz();
    const zTekstura = ustawTekstureRewersu(zNazwa, zasoby, revId, 'tlo.png', {
      dane: png,
      szerokosc: 64,
      wysokosc: 64,
    });
    const revZTek = {
      ...zTekstura.projekt.rewersy!.find((r) => r.id === revId)!,
      teksturaTryb: 'kafelki' as const,
      teksturaKrycie: 0.5,
      teksturaZabarwienie: { kolor: '#1d4ed8', krycie: 0.25 },
    };
    expect(revZTek.teksturaTla).toBeDefined();
    const szBezTekstury = rewersJakoSzablon(revZTek);
    delete szBezTekstury.teksturaTla;
    const poUsunieciuTekstury = szablonDoRewersu(revZTek, szBezTekstury);
    expect(poUsunieciuTekstury.teksturaTla).toBeUndefined();
    expect(poUsunieciuTekstury.teksturaTryb).toBeUndefined();
    expect(poUsunieciuTekstury.teksturaKrycie).toBeUndefined();
    expect(poUsunieciuTekstury.teksturaZabarwienie).toBeUndefined();

    // zmienTypPola zachowuje krycie i przy bezKlucza=true tworzy pole obrazu bez klucza danych.
    const szBaza = rewersJakoSzablon(rev0);
    const szZTekstem = {
      ...szBaza,
      korzen: {
        ...szBaza.korzen,
        dzieci: [
          {
            id: 'w1',
            typ: 'tekst' as const,
            tekst: 'Napis',
            krycie: 0.45,
            styl: { czcionka: 'tytul', rozmiar: 5 },
          },
        ],
      },
    };
    const szZObrazem = zmienTypPola(szZTekstem, 'w1', 'obraz', 'Obraz', [], true);
    const poleObraz = szZObrazem.korzen.dzieci[0]!;
    expect(poleObraz.typ).toBe('obraz');
    expect(poleObraz.krycie).toBe(0.45);
    expect('klucz' in poleObraz ? poleObraz.klucz : undefined).toBeUndefined();

    // ustawStalyObrazRewersu zapisuje obraz do stałego pola obrazu po zmianie typu.
    const pZObrazem = zmienRewers(zTekstura.projekt, revId, (r) => szablonDoRewersu(r, szZObrazem));
    const poObrazie = ustawStalyObrazRewersu(
      pZObrazem,
      zTekstura.dane,
      revId,
      'w1',
      'emblemat.png',
      { dane: png, szerokosc: 64, wysokosc: 64 },
    );
    const polePo = poObrazie.projekt.rewersy!.find((r) => r.id === revId)!.korzen.dzieci[0]!;
    expect(polePo.typ === 'obraz' && polePo.zasob).toBeTruthy();

    // zrodloRewersuKarty dla wszystkich gałęzi: karta, szablon, talia, wyłączony, nieistniejące ID.
    const mapa = new Map([[rev0.id, rev0]]);
    expect(zrodloRewersuKarty(mapa, { rewersId: rev0.id }, {}, {})).toEqual({
      rewers: rev0,
      skad: 'karta',
    });
    expect(zrodloRewersuKarty(mapa, { rewersId: null }, { rewersId: rev0.id }, {})).toEqual({
      skad: 'karta',
      wylaczony: true,
    });
    expect(zrodloRewersuKarty(mapa, {}, { rewersId: rev0.id }, {})).toEqual({
      rewers: rev0,
      skad: 'szablon',
    });
    expect(zrodloRewersuKarty(mapa, {}, { rewersId: null }, { rewersId: rev0.id })).toEqual({
      skad: 'szablon',
      wylaczony: true,
    });
    expect(zrodloRewersuKarty(mapa, {}, {}, { rewersId: rev0.id })).toEqual({
      rewers: rev0,
      skad: 'talia',
    });
    expect(zrodloRewersuKarty(mapa, { rewersId: 'nie-ma' }, {}, {})).toEqual({ skad: 'brak' });
    expect(zrodloRewersuKarty(mapa, {}, {}, {})).toEqual({ skad: 'brak' });
  });
});

describe('M4-4: schemat v26 i ustawienia druku dwustronnego', () => {
  it('migruje projekt i szablon v25 do v26, waliduje dwustronny i przechodzi archiwum ZIP', () => {
    expect(WERSJA_SCHEMATU).toBeGreaterThanOrEqual(26);
    expect(migruj({ wersja: 25, a: 1 }, 'projekt', 26)).toEqual({ wersja: 26, a: 1 });
    expect(migruj({ wersja: 25, a: 1 }, 'szablon', 26)).toEqual({ wersja: 26, a: 1 });
    expect(przygotujProjekt({ ...projekt, wersja: 25 })).toEqual(projekt);

    const zDwu = (dwustronny: object): Projekt => ({
      ...projekt,
      arkusze: projekt.arkusze.map((a, i) =>
        i === 0 ? { ...a, ustawienia: { ...a.ustawienia, dwustronny: dwustronny as never } } : a,
      ),
    });

    const pDluga = zDwu({ wlaczony: true, krawedz: 'dluga' });
    const pKrotka = zDwu({ wlaczony: false, krawedz: 'krotka' });
    expect(przygotujProjekt(pDluga).arkusze[0]!.ustawienia.dwustronny).toEqual({
      wlaczony: true,
      krawedz: 'dluga',
    });
    expect(przygotujProjekt(pKrotka).arkusze[0]!.ustawienia.dwustronny).toEqual({
      wlaczony: false,
      krawedz: 'krotka',
    });

    // Round-trip przez archiwum projektu ZIP.
    const poZip = importujProjekt(eksportujProjekt(pDluga, zasoby));
    expect(poZip.projekt.arkusze[0]!.ustawienia.dwustronny).toEqual({
      wlaczony: true,
      krawedz: 'dluga',
    });

    // Odrzucenie niepoprawnych wartości.
    expect(() => przygotujProjekt(zDwu({ wlaczony: true, krawedz: 'inna' }))).toThrow();
    expect(() => przygotujProjekt(zDwu({ wlaczony: 'tak', krawedz: 'dluga' }))).toThrow();
  });
});

describe('M4-5: schemat v27 i ustawienia trybu drukarni', () => {
  it('migruje projekt i szablon v26 do v27, waliduje drukarnia i przechodzi archiwum ZIP', () => {
    expect(WERSJA_SCHEMATU).toBeGreaterThanOrEqual(27);
    expect(migruj({ wersja: 26, a: 1 }, 'projekt', 27)).toEqual({ wersja: 27, a: 1 });
    expect(migruj({ wersja: 26, a: 1 }, 'szablon', 27)).toEqual({ wersja: 27, a: 1 });
    // Stary projekt v26 bez pola drukarnia otwiera się z domyślnym drukiem domowym.
    const zV26 = przygotujProjekt({ ...projekt, wersja: 26 });
    expect(zV26).toEqual(projekt);
    expect(zV26.arkusze[0]!.ustawienia.drukarnia).toBeUndefined();

    const zDruk = (drukarnia: object): Projekt => ({
      ...projekt,
      arkusze: projekt.arkusze.map((a, i) =>
        i === 0 ? { ...a, ustawienia: { ...a.ustawienia, drukarnia: drukarnia as never } } : a,
      ),
    });

    const pSiatka = zDruk({ wlaczony: true, spad: 3, znacznikiCiecia: true, uklad: 'siatka' });
    const pPojedyncza = zDruk({
      wlaczony: true,
      spad: 5,
      znacznikiCiecia: false,
      uklad: 'pojedyncza',
    });
    expect(przygotujProjekt(pSiatka).arkusze[0]!.ustawienia.drukarnia).toEqual({
      wlaczony: true,
      spad: 3,
      znacznikiCiecia: true,
      uklad: 'siatka',
    });
    expect(przygotujProjekt(pPojedyncza).arkusze[0]!.ustawienia.drukarnia).toEqual({
      wlaczony: true,
      spad: 5,
      znacznikiCiecia: false,
      uklad: 'pojedyncza',
    });

    // Round-trip przez archiwum projektu ZIP.
    const poZip = importujProjekt(eksportujProjekt(pPojedyncza, zasoby));
    expect(poZip.projekt.arkusze[0]!.ustawienia.drukarnia).toEqual({
      wlaczony: true,
      spad: 5,
      znacznikiCiecia: false,
      uklad: 'pojedyncza',
    });

    // Odrzucenie niepoprawnych wartości.
    expect(() =>
      przygotujProjekt(zDruk({ wlaczony: true, spad: -1, znacznikiCiecia: true, uklad: 'siatka' })),
    ).toThrow();
    expect(() =>
      przygotujProjekt(zDruk({ wlaczony: true, spad: 11, znacznikiCiecia: true, uklad: 'siatka' })),
    ).toThrow();
    expect(() =>
      przygotujProjekt(zDruk({ wlaczony: true, spad: 3, znacznikiCiecia: true, uklad: 'inny' })),
    ).toThrow();
  });
});
