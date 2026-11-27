// @vitest-environment node
import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { WERSJA_SCHEMATU, type DaneZasobow, type Projekt } from '../model/projekt';
import type { Rewers, Szablon } from '../model/szablon';
import { pakietMausritter } from '../pakiety/mausritter';
import { eksportujProjekt, importujProjekt } from './archiwum';
import { BazaDexie, BazaProjektow } from './baza';
import { skrotSzablonu, unikalnaNazwaSzablonu } from './bibliotekaSzablonow';
import { ZNACZNIK_MIGRACJI } from './migracjaBiblioteki';
import { migrujSzablonyDoBiblioteki, ZNACZNIK_MIGRACJI_SZABLONOW } from './migracjaSzablonow';
import { projektZPakietu } from './pakiet';
import { migruj, przygotujProjekt } from './schemat';

const czcionka = async (plik: string) => new Uint8Array(readFileSync(`public/czcionki/${plik}`));
const PNG = new Uint8Array(readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png'));

function szablonTestowy(id: string, nazwa: string, tlo = '#ffffff'): Szablon {
  return {
    id,
    nazwa,
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    tlo,
    korzen: {
      id: 'korzen',
      typ: 'kolumna',
      dzieci: [
        {
          id: 'tytul',
          typ: 'tekst',
          klucz: 'nazwa',
          styl: { czcionka: 'tytul', rozmiar: 5 },
        },
      ],
    },
  };
}

function rewersTestowy(id: string, nazwa: string, tlo = '#1f2937'): Rewers {
  return {
    id,
    nazwa,
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    tlo,
    korzen: {
      id: 'korzen-r',
      typ: 'swobodny',
      dzieci: [
        {
          id: 'napis-r',
          typ: 'tekst',
          tekst: 'TYŁ',
          styl: { czcionka: 'tytul', rozmiar: 6, kolor: '#ffffff' },
          pozycja: { x: 10, y: 10 },
        },
      ],
    },
  };
}

function projektWlasny(
  id: string,
  nazwa: string,
  szablony: Szablon[],
  opcje: {
    rewersy?: Rewers[];
    karty?: { id: string; szablonId: string; rewersId?: string | null; nazwa: string }[];
    zmieniono?: string;
    wersja?: number;
  } = {},
): Projekt {
  const teraz = opcje.zmieniono ?? '2026-11-27T10:00:00.000Z';
  return {
    wersja: opcje.wersja ?? WERSJA_SCHEMATU,
    id,
    nazwa,
    utworzono: teraz,
    zmieniono: teraz,
    role: { tytul: 'Inter', tresc: 'Inter' },
    zasoby: [],
    szablony,
    ...(opcje.rewersy ? { rewersy: opcje.rewersy } : {}),
    talie: [
      {
        id: 't1',
        nazwa: 'Talia',
        karty: (opcje.karty ?? []).map((k) => ({
          id: k.id,
          szablonId: k.szablonId,
          ...(k.rewersId !== undefined ? { rewersId: k.rewersId } : {}),
          dane: { nazwa: k.nazwa },
          ilosc: 1,
        })),
      },
    ],
    arkusze: [
      {
        id: 'a1',
        nazwa: 'Arkusz',
        taliaId: 't1',
        ustawienia: {
          papier: 'A4',
          orientacja: 'pionowa',
          marginesy: { gora: 10, prawo: 10, dol: 10, lewo: 10 },
          linie: { grubosc: 0.2, kolor: '#999999', kreska: 2, przerwa: 2 },
        },
      },
    ],
    pakiet: 'wlasne',
  };
}

describe('biblioteka szablonów: skrót i nazwy', () => {
  it('skrotSzablonu pomija id, nazwę, zrodlo, rewersId i podklad', async () => {
    const a = szablonTestowy('s1', 'Zaklęcie', '#ffffff');
    const b: Szablon = {
      ...szablonTestowy('inny-id', 'Inna nazwa', '#ffffff'),
      rewersId: 'r1',
      zrodlo: { id: 'lib-1', hash: 'abc' },
      podklad: { zasob: 'obr', przezroczystosc: 50, widoczny: true },
    };
    const c = szablonTestowy('s3', 'Zaklęcie', '#f5f0e6');
    expect(await skrotSzablonu(a)).toBe(await skrotSzablonu(b));
    expect(await skrotSzablonu(a)).not.toBe(await skrotSzablonu(c));
  });

  it('unikalnaNazwaSzablonu dopisuje kolejne sufiksy (2), (3) bez względu na wielkość liter', () => {
    const zajete = new Set(['Zaklęcie', 'zaklęcie (2)']);
    expect(unikalnaNazwaSzablonu('Zaklęcie', zajete)).toBe('Zaklęcie (3)');
    expect(unikalnaNazwaSzablonu('Przedmiot', zajete)).toBe('Przedmiot');
  });
});

describe('migracja schematu 35 → 36', () => {
  it('migruje projekt v35 do v36 i zachowuje zrodlo w eksporcie/imporcie', () => {
    const stary = projektWlasny('p-35', 'Stary', [szablonTestowy('s1', 'Zaklęcie')], {
      wersja: 35,
    });
    const zmigrowany = migruj(stary, 'projekt') as Projekt;
    expect(zmigrowany.wersja).toBe(36);
    const zZrodlem = przygotujProjekt({
      ...zmigrowany,
      szablony: [{ ...zmigrowany.szablony[0]!, zrodlo: { id: 'bib-1', hash: 'abcd' } }],
    });
    const poZip = importujProjekt(eksportujProjekt(zZrodlem, new Map())).projekt;
    expect(poZip.szablony[0]!.zrodlo).toEqual({ id: 'bib-1', hash: 'abcd' });
  });
});

describe('migracja S1: przeniesienie szablonów do tabeli szablony', () => {
  it('łączy duplikaty, nadaje sufiksy, usuwa nieużywane z projektów, zostawia pakiety bez zmian', async () => {
    const nazwaBazy = 's1-migracja-duplikaty';
    // Przygotowujemy bazę z danymi sprzed migracji S1 (jak w wersji 5 Dexie).
    const bazaBez = new BazaProjektow(nazwaBazy, { bezMigracji: true });
    const db = new BazaDexie(nazwaBazy);
    await db.meta.put({ klucz: ZNACZNIK_MIGRACJI, wartosc: 'gotowa' });

    const tylA = rewersTestowy('r-a', 'Tył główny', '#112233');
    const tylNieuzywany = rewersTestowy('r-nieuz', 'Tył zapasowy', '#445566');
    const szZaklecie = { ...szablonTestowy('s-zakl', 'Zaklęcie', '#ffffff'), rewersId: 'r-a' };
    const szNieuzywany = szablonTestowy('s-nieuz', 'Warlock', '#eeeeee');

    const projA = projektWlasny('pA', 'Projekt A', [szZaklecie, szNieuzywany], {
      rewersy: [tylA],
      karty: [{ id: 'k1', szablonId: 's-zakl', nazwa: 'Kula ognia' }],
      zmieniono: '2026-11-20T10:00:00.000Z',
    });

    // Projekt B: identyczna kopia „Zaklęcie” (inne id) + INNY szablon o tej samej nazwie „Zaklęcie”
    // + identyczny tył + nieużywany tył.
    const szZaklecieKopia = szablonTestowy('s-zakl-kopia', 'Zaklęcie', '#ffffff');
    const szZaklecieInne = szablonTestowy('s-zakl-inne', 'Zaklęcie', '#fff0d0');
    const tylAKopia = rewersTestowy('r-a-kopia', 'Tył główny', '#112233');
    const projB = projektWlasny('pB', 'Projekt B', [szZaklecieKopia, szZaklecieInne], {
      rewersy: [tylAKopia, tylNieuzywany],
      karty: [
        { id: 'k2', szablonId: 's-zakl-kopia', rewersId: 'r-a-kopia', nazwa: 'Błyskawica' },
        { id: 'k3', szablonId: 's-zakl-inne', nazwa: 'Tarcza' },
      ],
      zmieniono: '2026-11-21T10:00:00.000Z',
    });

    // Projekt pakietowy (Mausritter) – nie wchodzi do biblioteki szablonów (D-S5).
    const { projekt: mausritter, zasoby: mausZasoby } = await projektZPakietu(
      pakietMausritter,
      czcionka,
      async () => PNG,
      'pMaus',
    );

    // Dawny schowek `tylkoSzablony` – szablony trafiają do biblioteki, schowek znika.
    const projSchowek = projektWlasny(
      'pSchowek',
      'Usunięty',
      [szablonTestowy('s-schowek', 'Z usuniętego', '#ddeeff')],
      { zmieniono: '2026-11-22T10:00:00.000Z' },
    );

    await bazaBez.zapisz(projA);
    await bazaBez.zapisz(projB);
    await bazaBez.zapisz(mausritter, mausZasoby);
    await bazaBez.zapisz(projSchowek, undefined, { tylkoSzablony: true });

    // Uruchomienie migracji S1.
    await migrujSzablonyDoBiblioteki(db, bazaBez);

    // Znacznik gotowości i wyczyszczona kopia bezpieczeństwa.
    expect((await db.meta.get(ZNACZNIK_MIGRACJI_SZABLONOW))?.wartosc).toBe('gotowa');
    expect(await db.kopiaMigracji.count()).toBe(0);

    // W bibliotece szablonów: 4 przody (Zaklęcie, Warlock, Zaklęcie (2), Z usuniętego)
    // i 2 tyły (Tył główny, Tył zapasowy) – duplikaty połączone, Mausritter pominięty.
    const awersy = await bazaBez.szablonyBiblioteki('awers');
    const rewersy = await bazaBez.szablonyBiblioteki('rewers');
    expect(awersy.map((w) => w.nazwa).sort()).toEqual(
      ['Warlock', 'Zaklęcie', 'Zaklęcie (2)', 'Z usuniętego'].sort(),
    );
    expect(rewersy.map((w) => w.nazwa).sort()).toEqual(['Tył główny', 'Tył zapasowy'].sort());

    const wpisZaklecie = awersy.find((w) => w.nazwa === 'Zaklęcie')!;
    const wpisTylGlowny = rewersy.find((w) => w.nazwa === 'Tył główny')!;
    expect(wpisZaklecie.domyslnyRewersId).toBe(wpisTylGlowny.id);

    // Projekt A: nieużywany „Warlock” usunięty, używany „Zaklęcie” ma `zrodlo`, karty działają.
    const poA = (await bazaBez.wczytaj('pA')).projekt;
    expect(poA.szablony.map((s) => s.id)).toEqual(['s-zakl']);
    expect(poA.szablony[0]!.zrodlo).toEqual({ id: wpisZaklecie.id, hash: wpisZaklecie.hash });
    expect(poA.rewersy?.map((r) => r.id)).toEqual(['r-a']);
    expect(poA.rewersy?.[0]!.zrodlo).toEqual({ id: wpisTylGlowny.id, hash: wpisTylGlowny.hash });
    expect(poA.talie[0]!.karty[0]!.szablonId).toBe('s-zakl');

    // Projekt B: identyczna kopia wskazuje ten sam rekord „Zaklęcie”, inna na „Zaklęcie (2)”,
    // a nieużywany tył został usunięty z projektu (ale jest w bibliotece).
    const poB = (await bazaBez.wczytaj('pB')).projekt;
    expect(poB.szablony.map((s) => s.id)).toEqual(['s-zakl-kopia', 's-zakl-inne']);
    expect(poB.szablony[0]!.zrodlo?.id).toBe(wpisZaklecie.id);
    expect(poB.szablony[1]!.zrodlo?.id).toBe(awersy.find((w) => w.nazwa === 'Zaklęcie (2)')!.id);
    expect(poB.rewersy?.map((r) => r.id)).toEqual(['r-a-kopia']);
    expect(poB.rewersy?.[0]!.zrodlo?.id).toBe(wpisTylGlowny.id);

    // Mausritter nietknięty.
    const poMaus = (await bazaBez.wczytaj('pMaus')).projekt;
    expect(poMaus.szablony.length).toBe(mausritter.szablony.length);
    expect(poMaus.szablony.every((s) => s.zrodlo === undefined)).toBe(true);

    // Schowek `tylkoSzablony` usunięty.
    expect(await bazaBez.istnieje('pSchowek')).toBe(false);

    // Zliczanie projektów z kopią szablonu.
    const zKopia = await bazaBez.projektyZKopiaSzablonu(wpisZaklecie.id);
    expect(zKopia.map((p) => p.id).sort()).toEqual(['pA', 'pB']);

    // Ponowne uruchomienie migracji jest idempotentne.
    await migrujSzablonyDoBiblioteki(db, bazaBez);
    expect(await bazaBez.szablonyBiblioteki('awers')).toHaveLength(4);
    expect(await bazaBez.szablonyBiblioteki('rewers')).toHaveLength(2);

    db.close();
    bazaBez.zamknij();
  });

  it('przerwana migracja (w-toku z kopią bezpieczeństwa) wznawia się bezpiecznie', async () => {
    const nazwaBazy = 's1-migracja-wznowienie';
    const bazaBez = new BazaProjektow(nazwaBazy, { bezMigracji: true });
    const db = new BazaDexie(nazwaBazy);
    await db.meta.put({ klucz: ZNACZNIK_MIGRACJI, wartosc: 'gotowa' });

    const proj = projektWlasny('p1', 'Projekt', [szablonTestowy('s1', 'Karta')], {
      karty: [{ id: 'k1', szablonId: 's1', nazwa: 'Test' }],
    });
    await bazaBez.zapisz(proj);

    // Symulujemy przerwanie po zrobieniu kopii bezpieczeństwa i ustawieniu `w-toku`.
    const wpis = (await db.projekty.get('p1'))!;
    await db.kopiaMigracji.put(wpis);
    await db.meta.put({ klucz: ZNACZNIK_MIGRACJI_SZABLONOW, wartosc: 'w-toku' });

    await migrujSzablonyDoBiblioteki(db, bazaBez);
    expect((await db.meta.get(ZNACZNIK_MIGRACJI_SZABLONOW))?.wartosc).toBe('gotowa');
    expect(await db.kopiaMigracji.count()).toBe(0);
    expect(await bazaBez.szablonyBiblioteki('awers')).toHaveLength(1);
    const po = (await bazaBez.wczytaj('p1')).projekt;
    expect(po.szablony[0]!.zrodlo?.id).toBe((await bazaBez.szablonyBiblioteki('awers'))[0]!.id);

    db.close();
    bazaBez.zamknij();
    await Dexie.delete(nazwaBazy);
  });
});

describe('biblioteka szablonów: import i eksport plików', () => {
  it('eksport i import .kartyrpg-szablon działa bezpośrednio na bibliotece (przód z tyłem i sam tył)', async () => {
    const baza1 = new BazaProjektow('s1-eksport-1');
    const baza2 = new BazaProjektow('s1-eksport-2');

    // Obraz w bibliotece użytkownika, użyty jako tekstura tła szablonu.
    const obrazId = await baza1.dodajZasobDoBiblioteki(
      {
        rodzaj: 'obraz',
        id: 'tlo-1',
        nazwa: 'tlo.png',
        format: 'png',
        szerokosc: 100,
        wysokosc: 100,
      },
      PNG,
    );
    const rewers = rewersTestowy('r1', 'Tył testowy', '#223344');
    const dodanyRewers = await baza1.dodajRewersDoBiblioteki(rewers, { tytul: 'Inter' });
    const szablon: Szablon = {
      ...szablonTestowy('s1', 'Szablon z tłem', '#ffffff'),
      teksturaTla: obrazId,
    };
    const dodanySzablon = await baza1.dodajSzablonDoBiblioteki(
      szablon,
      { tytul: 'Inter' },
      { domyslnyRewersId: dodanyRewers.id },
    );

    // Eksport przodu (z przypiętym tyłem) z bazy 1 i import do pustej bazy 2.
    const { bajty } = await baza1.eksportujSzablonZBiblioteki(dodanySzablon.id);
    const zaimportowany = await baza2.importujSzablonDoBiblioteki(bajty);
    expect(zaimportowany.rodzaj).toBe('awers');
    expect(zaimportowany.nowy).toBe(true);
    expect(zaimportowany.rewersId).toBeDefined();

    // Obraz trafił do biblioteki zasobów bazy 2, a szablon i tył do biblioteki szablonów.
    expect(await baza2.wpisyBiblioteki('obraz')).toHaveLength(1);
    expect(await baza2.szablonyBiblioteki('awers')).toHaveLength(1);
    expect(await baza2.szablonyBiblioteki('rewers')).toHaveLength(1);

    // Ponowny import tego samego pliku deduplikuje po skrócie.
    const drugi = await baza2.importujSzablonDoBiblioteki(bajty);
    expect(drugi.nowy).toBe(false);
    expect(drugi.id).toBe(zaimportowany.id);
    expect(await baza2.szablonyBiblioteki('awers')).toHaveLength(1);

    // Eksport samego tyłu z bazy 1 i import do świeżej bazy 3.
    const baza3 = new BazaProjektow('s1-eksport-3');
    const { bajty: bajtyTylu } = await baza1.eksportujSzablonZBiblioteki(dodanyRewers.id);
    const impTyl = await baza3.importujSzablonDoBiblioteki(bajtyTylu);
    expect(impTyl.rodzaj).toBe('rewers');
    expect(impTyl.nowy).toBe(true);
    expect(await baza3.szablonyBiblioteki('rewers')).toHaveLength(1);

    baza1.zamknij();
    baza2.zamknij();
    baza3.zamknij();
  });

  it('import projektu .kartyrpg rejestruje szablony w bibliotece i ustawia zrodlo w kopiach', async () => {
    const baza = new BazaProjektow('s1-import-projektu');
    const proj = projektWlasny(
      'p-imp',
      'Zaimportowany',
      [szablonTestowy('s1', 'Przedmiot', '#ffffff')],
      {
        rewersy: [rewersTestowy('r1', 'Tył przedmiotu', '#334455')],
        karty: [{ id: 'k1', szablonId: 's1', rewersId: 'r1', nazwa: 'Miecz' }],
      },
    );
    const zasoby: DaneZasobow = new Map();
    const bajty = eksportujProjekt(proj, zasoby);
    const wczytany = importujProjekt(bajty);
    await baza.zapisz(wczytany.projekt, wczytany.zasoby, { rejestrujSzablony: true });

    const awersy = await baza.szablonyBiblioteki('awers');
    const rewersy = await baza.szablonyBiblioteki('rewers');
    expect(awersy).toHaveLength(1);
    expect(rewersy).toHaveLength(1);

    const zapisany = (await baza.wczytaj('p-imp')).projekt;
    expect(zapisany.szablony[0]!.zrodlo).toEqual({ id: awersy[0]!.id, hash: awersy[0]!.hash });
    expect(zapisany.rewersy?.[0]!.zrodlo).toEqual({ id: rewersy[0]!.id, hash: rewersy[0]!.hash });

    // Drugi projekt z innym szablonem o tej samej nazwie dostaje sufiks „(2)”.
    const proj2 = projektWlasny(
      'p-imp-2',
      'Zaimportowany 2',
      [szablonTestowy('s2', 'Przedmiot', '#ffeedd')],
      { karty: [{ id: 'k2', szablonId: 's2', nazwa: 'Topór' }] },
    );
    const wczytany2 = importujProjekt(eksportujProjekt(proj2, new Map()));
    await baza.zapisz(wczytany2.projekt, wczytany2.zasoby, { rejestrujSzablony: true });
    expect((await baza.szablonyBiblioteki('awers')).map((w) => w.nazwa).sort()).toEqual([
      'Przedmiot',
      'Przedmiot (2)',
    ]);

    baza.zamknij();
  });

  it('CRUD biblioteki szablonów: zapis, duplikacja (bezDeduplikacji), usunięcie, przywrócenie i jako:rewers', async () => {
    const baza = new BazaProjektow('s1-crud');
    const s1 = szablonTestowy('s1', 'Karta', '#ffffff');
    const dodany = await baza.dodajSzablonDoBiblioteki(s1, { tytul: 'Inter' });
    const duplikat = await baza.dodajSzablonDoBiblioteki(
      s1,
      { tytul: 'Inter' },
      { bezDeduplikacji: true },
    );
    expect(duplikat.id).not.toBe(dodany.id);
    expect((await baza.szablonyBiblioteki('awers')).map((w) => w.nazwa).sort()).toEqual([
      'Karta',
      'Karta (2)',
    ]);

    // Edycja zmienia hash.
    const wpis = (await baza.szablonBiblioteki(dodany.id))!;
    const zmieniony = await baza.zapiszSzablonWBibliotece({
      ...wpis,
      szablon: { ...wpis.szablon!, tlo: '#f0f0f0' },
    });
    expect(zmieniony.hash).not.toBe(dodany.hash);

    // Usunięcie i przywrócenie (Cofnij).
    const usuniety = await baza.usunSzablonZBiblioteki(duplikat.id);
    expect(usuniety?.id).toBe(duplikat.id);
    expect(await baza.szablonBiblioteki(duplikat.id)).toBeUndefined();
    await baza.przywrocSzablonWBibliotece(usuniety!);
    expect(await baza.szablonBiblioteki(duplikat.id)).toBeDefined();

    // Import pliku dwustronnego z opcją `jako: 'rewers'` zapisuje tylko tył.
    const r1 = await baza.dodajRewersDoBiblioteki(rewersTestowy('r1', 'Tył A', '#222222'), {
      tytul: 'Inter',
    });
    await baza.zapiszSzablonWBibliotece({ ...zmieniony, domyslnyRewersId: r1.id });
    const { bajty } = await baza.eksportujSzablonZBiblioteki(dodany.id);
    const bazaTyl = new BazaProjektow('s1-crud-tyl');
    const imp = await bazaTyl.importujSzablonDoBiblioteki(bajty, { jako: 'rewers' });
    expect(imp.rodzaj).toBe('rewers');
    expect(await bazaTyl.szablonyBiblioteki('awers')).toHaveLength(0);
    expect(await bazaTyl.szablonyBiblioteki('rewers')).toHaveLength(1);

    baza.zamknij();
    bazaTyl.zamknij();
  });

  it('migracja samodzielnego projektu rewersowego przenosi tył i usuwa pusty schowek', async () => {
    const nazwaBazy = 's1-migracja-rewersowy';
    const bazaBez = new BazaProjektow(nazwaBazy, { bezMigracji: true });
    const db = new BazaDexie(nazwaBazy);
    await db.meta.put({ klucz: ZNACZNIK_MIGRACJI, wartosc: 'gotowa' });

    const pustyPrzod: Szablon = {
      id: 'pusty',
      nazwa: 'Pusty',
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      korzen: { id: 'k', typ: 'swobodny', dzieci: [] },
    };
    const projRew = projektWlasny('pRew', 'Mój tył', [pustyPrzod], {
      rewersy: [rewersTestowy('r-sam', 'Samodzielny tył', '#123456')],
    });
    await bazaBez.zapisz(projRew);

    await migrujSzablonyDoBiblioteki(db, bazaBez);
    expect(await bazaBez.istnieje('pRew')).toBe(false);
    expect(await bazaBez.szablonyBiblioteki('awers')).toHaveLength(0);
    expect((await bazaBez.szablonyBiblioteki('rewers')).map((w) => w.nazwa)).toEqual([
      'Samodzielny tył',
    ]);

    db.close();
    bazaBez.zamknij();
    await Dexie.delete(nazwaBazy);
  });
});
