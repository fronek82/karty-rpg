import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { DaneZasobow, Projekt } from '../model/projekt';
import type { Rewers } from '../model/szablon';
import { pakietMausritter } from '../pakiety/mausritter';
import {
  dodajRewersZPaczki,
  dodajSzablon,
  eksportujRewers,
  eksportujSzablon,
  importujRewers,
  importujSzablon,
  kluczTresciRewersuWPaczce,
  nazwyWpisowArchiwum,
  PLIK_REWERSU_DAWNY,
  PLIK_SZABLONU,
} from './archiwum';
import { BazaProjektow, kluczMiniaturySzablonu } from './baza';
import { projektZPakietu } from './pakiet';
import { nowyRewers, unikalnaNazwa } from './rewers';

const czcionka = async (plik: string) => new Uint8Array(readFileSync(`public/czcionki/${plik}`));
const obraz = async () =>
  new Uint8Array(readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png'));

let bazowy: Projekt;
let zasoby: DaneZasobow;

beforeAll(async () => {
  ({ projekt: bazowy, zasoby } = await projektZPakietu(pakietMausritter, czcionka, obraz, 'p1'));
});

const rewers = (id: string, nazwa: string, tlo = '#112233'): Rewers => ({
  id,
  nazwa,
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
  tlo,
  korzen: { id: 'rk', typ: 'swobodny', dzieci: [] },
});

const wlasny = (id: string, zmiany: Partial<Projekt> = {}): Projekt => ({
  ...structuredClone(bazowy),
  id,
  pakiet: 'wlasne',
  zmieniono: '2026-11-22T10:00:00.000Z',
  ...zmiany,
});

const niepusty = () => bazowy.szablony.find((s) => s.korzen.dzieci.length > 0)!;

describe('Moje szablony: rozróżnianie po id i treści', () => {
  let baza: BazaProjektow;
  afterEach(() => baza?.zamknij());

  it('szablony i rewersy o tej samej nazwie, ale innej treści, są osobno; identyczne kopie – raz', async () => {
    baza = new BazaProjektow('n1-nazwy');
    const sz = niepusty();
    const p1 = wlasny('a1', { rewersy: [rewers('r1', 'Rewers')] });
    const p2 = wlasny('a2', {
      zmieniono: '2026-11-22T09:00:00.000Z',
      rewersy: [rewers('r1', 'Rewers', '#ffffff')],
      szablony: bazowy.szablony.map((s) => (s.id === sz.id ? { ...s, tlo: '#abcdef' } : s)),
    });
    await baza.zapisz(p1, zasoby);
    await baza.zapisz(p2, zasoby);

    const awersy = await baza.szablonyAwersowZProjektow();
    const oNazwie = awersy.filter((a) => a.szablonNazwa === sz.nazwa);
    expect(oNazwie.map((a) => a.projektId).sort()).toEqual(['a1', 'a2']);
    // Pozostałe szablony a2 są identyczne z a1 – na liście tylko nowszy egzemplarz.
    expect(
      awersy.filter((a) => a.szablonNazwa !== sz.nazwa).every((a) => a.projektId === 'a1'),
    ).toBe(true);

    const rewersy = await baza.rewersyZProjektow();
    expect(rewersy.map((r) => r.nazwa)).toEqual(['Rewers', 'Rewers']);
    expect(new Set(rewersy.map((r) => r.kluczTresci)).size).toBe(2);
  });

  it('klucz treści nie zależy od id ani kolejności pól', () => {
    const a = rewers('x', 'Tył');
    const b: Rewers = { korzen: a.korzen, tlo: a.tlo, rozmiar: a.rozmiar, nazwa: ' tył ', id: 'y' };
    const bajtyA = eksportujRewers(wlasny('k1', { rewersy: [a] }), zasoby, 'x');
    const bajtyB = eksportujRewers(wlasny('k2', { rewersy: [b] }), zasoby, 'y');
    expect(kluczTresciRewersuWPaczce(bajtyA)).toBe(kluczTresciRewersuWPaczce(bajtyB));
  });
});

describe('wymiarySzablonow (Rozmiar jak w szablonie)', () => {
  let baza: BazaProjektow;
  afterEach(() => baza?.zamknij());

  it('przody w mm z wymiarami i rogami, tyły bez identycznych kopii', async () => {
    baza = new BazaProjektow('wymiary-szablonow');
    const r = { ...rewers('r1', 'Tył A'), promienRogow: 2 };
    await baza.zapisz(wlasny('w1', { rewersy: [r] }), zasoby);
    await baza.zapisz(wlasny('w2', { rewersy: [structuredClone(r)] }), zasoby);
    const lista = await baza.wymiarySzablonow();
    const tyly = lista.filter((w) => w.strona === 'tyl');
    expect(tyly).toHaveLength(1);
    expect(tyly[0]).toMatchObject({ nazwa: 'Tył A', szer: r.rozmiar.szerokosc, promien: 2 });
    const przody = lista.filter((w) => w.strona === 'przod');
    const mm = bazowy.szablony.filter((s) => s.rozmiar.tryb === 'mm');
    expect(przody).toHaveLength(mm.length * 2);
    expect(przody.every((p) => p.szer > 0 && p.wys > 0)).toBe(true);
  });
});

describe('usunięcie projektu zachowuje szablony i rewersy', () => {
  let baza: BazaProjektow;
  afterEach(() => baza?.zamknij());

  it('karty znikają, a szablony awersów i rewersy (także powstałe w projekcie) zostają w Moich szablonach', async () => {
    baza = new BazaProjektow('n1-usun');
    const sz = niepusty();
    const p = wlasny('u1', { rewersy: [rewers('r1', 'Mój rewers')] });
    expect(p.talie.some((tl) => tl.karty.length > 0)).toBe(true);
    await baza.zapisz(p, zasoby);
    await baza.zapiszMiniature('u1', '<svg/>');
    await baza.zapiszMiniature(kluczMiniaturySzablonu('u1', sz.id), '<svg/>');
    const awersyPrzed = await baza.szablonyAwersowZProjektow();

    await baza.usunProjekt('u1');

    expect(await baza.lista()).toEqual([]);
    const bezDaty = (l: { zmieniono?: string }[]) => l.map((w) => ({ ...w, zmieniono: undefined }));
    expect(bezDaty(await baza.szablonyAwersowZProjektow())).toEqual(bezDaty(awersyPrzed));
    expect((await baza.rewersyZProjektow()).map((r) => r.nazwa)).toEqual(['Mój rewers']);
    const { projekt: poUsunieciu, zasoby: zasobyPo } = await baza.wczytaj('u1');
    expect(poUsunieciu.talie.every((tl) => tl.karty.length === 0)).toBe(true);
    expect(poUsunieciu.szablony).toEqual(p.szablony);
    // Czcionki zostają; obrazy – tylko używane przez szablony, rewersy i ozdobniki.
    const czcionki = (pr: Projekt) => pr.zasoby.filter((z) => z.rodzaj === 'czcionka').length;
    expect(czcionki(poUsunieciu)).toBe(czcionki(p));
    expect([...zasobyPo.keys()].every((k) => zasoby.has(k))).toBe(true);
    expect(zasobyPo.size).toBe(poUsunieciu.zasoby.length);
    expect(await baza.czyTylkoSzablony('u1')).toBe(true);
    const miniatury = await baza.miniatury();
    expect(miniatury.has('u1')).toBe(false);
    expect(miniatury.has(kluczMiniaturySzablonu('u1', sz.id))).toBe(true);

    // Edycja szablonu (zapis bez kart) nie przywraca projektu na listę…
    await baza.zapisz({ ...poUsunieciu, nazwa: 'Po edycji szablonu' });
    expect(await baza.lista()).toEqual([]);
    // …a projekt z kartami – wraca do Moich projektów.
    await baza.zapisz(p, zasoby);
    expect((await baza.lista()).map((x) => x.id)).toEqual(['u1']);
    expect(await baza.czyTylkoSzablony('u1')).toBe(false);
  });

  it('projekt bez szablonów do zachowania jest usuwany w całości; pusty schowek też', async () => {
    baza = new BazaProjektow('n1-usun-calosc');
    await baza.zapisz({ ...structuredClone(bazowy), id: 'm1', pakiet: 'mausritter' }, zasoby);
    await baza.usunProjekt('m1');
    expect(await baza.istnieje('m1')).toBe(false);

    await baza.zapisz(wlasny('s1', { rewersy: [rewers('r1', 'Ostatni')] }), zasoby);
    await baza.usunProjekt('s1');
    const { projekt } = await baza.wczytaj('s1');
    // Usunięcie ostatniego szablonu i rewersu ze schowka usuwa wpis.
    await baza.zapisz({
      ...projekt,
      rewersy: [],
      szablony: projekt.szablony.map((s) => ({ ...s, korzen: { ...s.korzen, dzieci: [] } })),
    });
    await baza.usunPustySchowek('s1');
    expect(await baza.istnieje('s1')).toBe(false);
  });
});

describe('wspólny plik szablonu awersu i rewersu', () => {
  it('plik rewersu ma format pliku szablonu i wczytuje się jako rewers oraz jako awers', () => {
    const r = rewers('r1', 'Tył');
    const p = wlasny('f1', { rewersy: [r] });
    const bajty = eksportujRewers(p, zasoby, 'r1');
    expect(nazwyWpisowArchiwum(bajty)).toEqual([PLIK_SZABLONU]);

    expect(importujRewers(bajty).rewers).toEqual(r);
    const jakoAwers = importujSzablon(bajty);
    expect(jakoAwers.rewers).toBeUndefined();
    expect(jakoAwers.szablon).toMatchObject({
      id: 'r1',
      nazwa: 'Tył',
      rozmiar: r.rozmiar,
      tlo: r.tlo,
      korzen: r.korzen,
    });
    const dodany = dodajSzablon(wlasny('f2'), new Map(zasoby), jakoAwers);
    expect(dodany.projekt.szablony.some((s) => s.id === dodany.szablonId)).toBe(true);
  });

  it('plik awersu wczytuje się jako rewers (rozmiar w mm, korzeń swobodny)', () => {
    const p = wlasny('f3');
    const sz = niepusty();
    const paczka = importujRewers(eksportujSzablon(p, zasoby, sz.id).bajty);
    expect(paczka.rewers.nazwa).toBe(sz.nazwa);
    expect(paczka.rewers.rozmiar.tryb).toBe('mm');
    expect(paczka.rewers.korzen.typ).toBe('swobodny');
    expect(JSON.stringify(paczka.rewers)).not.toContain('grupaStyluId');
    const dodany = dodajRewersZPaczki(wlasny('f4'), new Map(zasoby), paczka);
    expect(dodany.projekt.rewersy?.map((x) => x.nazwa)).toContain(sz.nazwa);
  });

  it('plik awersu z rewersem wczytany jako rewers nie wnosi zasobów pominiętego rewersu', () => {
    const sz = niepusty();
    const obrazRewersu = bazowy.zasoby.find((z) => z.rodzaj === 'obraz')!;
    const p = wlasny('f5', {
      rewersy: [{ ...rewers('rt', 'Tył z teksturą'), teksturaTla: obrazRewersu.id }],
      szablony: bazowy.szablony.map((s) =>
        s.id === sz.id ? { ...s, rewersId: 'rt', teksturaTla: undefined } : s,
      ),
    });
    const plik = eksportujSzablon(p, zasoby, sz.id).bajty;
    // Wczytany jako awers – z rewersem i jego teksturą.
    expect(importujSzablon(plik).zasoby.some((z) => z.id === obrazRewersu.id)).toBe(true);
    const paczka = importujRewers(plik);
    const json = JSON.stringify(paczka.rewers);
    // Tylko zasoby, do których odwołuje się powstały rewers (obrazy po id, czcionki przez role).
    for (const z of paczka.zasoby) {
      if (z.rodzaj === 'obraz') expect(json).toContain(`"${z.id}"`);
      expect(paczka.dane.has(z.id)).toBe(true);
    }
    expect([...paczka.dane.keys()].sort()).toEqual(paczka.zasoby.map((z) => z.id).sort());
    expect(json).not.toContain(`"${obrazRewersu.id}"`);
    expect(paczka.zasoby.some((z) => z.id === obrazRewersu.id)).toBe(false);
  });

  it('dawny plik .kartyrpg-rewers (rewers.json) nadal się importuje', () => {
    const r = rewers('stary', 'Stary tył');
    const bajty = zipSync(
      {
        [PLIK_REWERSU_DAWNY]: strToU8(
          JSON.stringify({ wersja: 1, rewers: r, role: {}, zasoby: [] }),
        ),
      },
      { level: 0 },
    );
    expect(importujRewers(bajty).rewers).toEqual(r);
    expect(importujSzablon(bajty).szablon.nazwa).toBe('Stary tył');
    expect(kluczTresciRewersuWPaczce(bajty)).toBeDefined();
  });

  it('plik bez awersu i rewersu jest odrzucany', () => {
    const bajty = zipSync(
      { [PLIK_SZABLONU]: strToU8(JSON.stringify({ wersja: 27, role: {}, zasoby: [] })) },
      { level: 0 },
    );
    expect(() => importujSzablon(bajty)).toThrow(/ani awersu, ani rewersu/);
  });
});

describe('domyślna nazwa nowego rewersu', () => {
  it('pochodzi z i18n i jest unikalna (także względem nazw spoza projektu)', () => {
    const p = wlasny('n1', { rewersy: [rewers('r1', 'Rewers')] });
    expect(nowyRewers(p).projekt.rewersy?.at(-1)?.nazwa).toBe('Rewers 2');
    expect(nowyRewers(p, { zajeteNazwy: ['rewers 2'] }).projekt.rewersy?.at(-1)?.nazwa).toBe(
      'Rewers 3',
    );
    expect(unikalnaNazwa('Tył', [])).toBe('Tył');
  });
});

describe('Migawka do „Cofnij” po usunięciu', () => {
  let baza: BazaProjektow;
  afterEach(() => baza?.zamknij());

  it('przywraca projekt w całości: dokument, zasoby i miniatury szablonów/rewersów', async () => {
    baza = new BazaProjektow('n6-migawka');
    const p = wlasny('m1', { rewersy: [rewers('r1', 'Rewers')] });
    await baza.zapisz(p, zasoby);
    const sz = p.szablony[0]!.id;
    await baza.zapiszMiniature('m1', '<svg>p</svg>');
    await baza.zapiszMiniature(kluczMiniaturySzablonu('m1', sz), '<svg>s</svg>');
    await baza.zapiszMiniature('rewers:m1:r1', '<svg>r</svg>');
    await baza.zapiszMiniature('rewers:m10:r1', '<svg>inny</svg>');

    const migawka = await baza.migawka(['m1', 'brak']);
    expect(migawka).toHaveLength(1);
    await baza.usun('m1');
    expect(await baza.istnieje('m1')).toBe(false);

    await baza.przywroc(migawka);
    const { projekt, zasoby: z } = await baza.wczytaj('m1');
    expect(projekt.rewersy?.[0]?.id).toBe('r1');
    expect([...z.keys()].sort()).toEqual([...zasoby.keys()].sort());
    const m = await baza.miniatury();
    expect(m.get('m1')).toBe('<svg>p</svg>');
    expect(m.get(kluczMiniaturySzablonu('m1', sz))).toBe('<svg>s</svg>');
    expect(m.get('rewers:m1:r1')).toBe('<svg>r</svg>');
    expect(m.get('rewers:m10:r1')).toBe('<svg>inny</svg>');
  });

  it('cofa usunięcie projektu do „tylko szablony” – projekt wraca na listę', async () => {
    baza = new BazaProjektow('n6-migawka-2');
    await baza.zapisz(wlasny('m2'), zasoby);
    const migawka = await baza.migawka(['m2']);
    await baza.usunProjekt('m2');
    expect((await baza.lista()).some((x) => x.id === 'm2')).toBe(false);
    await baza.przywroc(migawka);
    expect((await baza.lista()).some((x) => x.id === 'm2')).toBe(true);
  });
});
