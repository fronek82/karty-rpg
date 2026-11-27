// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { WERSJA_SCHEMATU, type Projekt } from '../model/projekt';
import type { Rewers, Szablon } from '../model/szablon';
import {
  aktualizujRewersWProjekcie,
  aktualizujSzablonWProjekcie,
  dodajKopieRewersuDoProjektu,
  dodajKopieSzablonuDoProjektu,
  dopasujPolaSzablonow,
  przeniesKartyNaSzablon,
  wykryjNowszeWersje,
} from './aktualizacjaSzablonu';
import { skrotSzablonu, type WpisSzablonu } from './bibliotekaSzablonow';

function szablonBaza(
  id: string,
  nazwa: string,
  pola: { id: string; nazwa: string; klucz: string }[],
  tlo = '#ffffff',
): Szablon {
  return {
    id,
    nazwa,
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    tlo,
    korzen: {
      id: 'korzen',
      typ: 'kolumna',
      dzieci: pola.map((p) => ({
        id: p.id,
        nazwa: p.nazwa,
        typ: 'tekst' as const,
        klucz: p.klucz,
        styl: { czcionka: 'tytul', rozmiar: 5 },
      })),
    },
  };
}

function rewersBaza(id: string, nazwa: string, tlo = '#1f2937'): Rewers {
  return {
    id,
    nazwa,
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    tlo,
    korzen: {
      id: 'korzen-r',
      typ: 'swobodny',
      dzieci: [],
    },
  };
}

function projektBaza(
  szablony: Szablon[],
  karty: { id: string; szablonId: string; dane: Record<string, string>; ilosc?: number }[],
  rewersy?: Rewers[],
): Projekt {
  const teraz = '2026-11-27T12:00:00.000Z';
  return {
    wersja: WERSJA_SCHEMATU,
    id: 'p1',
    nazwa: 'Projekt testowy',
    utworzono: teraz,
    zmieniono: teraz,
    role: { tytul: 'Inter' },
    zasoby: [],
    szablony,
    ...(rewersy ? { rewersy } : {}),
    talie: [
      {
        id: 't1',
        nazwa: 'Talia',
        karty: karty.map((k) => ({
          id: k.id,
          szablonId: k.szablonId,
          dane: k.dane,
          ilosc: k.ilosc ?? 1,
        })),
      },
    ],
    arkusze: [],
    pakiet: 'wlasne',
  };
}

async function wpisAwers(
  id: string,
  s: Szablon,
  role: Record<string, string> = { tytul: 'Inter' },
): Promise<WpisSzablonu> {
  return {
    id,
    rodzaj: 'awers',
    nazwa: s.nazwa,
    zmieniono: '2026-11-27T12:00:00.000Z',
    hash: await skrotSzablonu(s),
    role,
    szablon: s,
  };
}

async function wpisRewers(
  id: string,
  r: Rewers,
  role: Record<string, string> = { tytul: 'Inter' },
): Promise<WpisSzablonu> {
  return {
    id,
    rodzaj: 'rewers',
    nazwa: r.nazwa,
    zmieniono: '2026-11-27T12:00:00.000Z',
    hash: await skrotSzablonu(r),
    role,
    rewers: r,
  };
}

describe('wykrywanie nowszych wersji szablonów (S2)', () => {
  it('wykrywa zmianę hash przodu i tyłu; brak zmiany lub usunięcie z Moich szablonów nie daje alarmu', async () => {
    const s1 = szablonBaza('s1', 'Zaklęcie', [{ id: 'p1', nazwa: 'Nazwa', klucz: 'nazwa' }]);
    const r1 = rewersBaza('r1', 'Tył główny', '#112233');
    const wA = await wpisAwers('lib-a', s1);
    const wR = await wpisRewers('lib-r', r1);

    const kopiaS: Szablon = { ...s1, rewersId: 'r1', zrodlo: { id: 'lib-a', hash: wA.hash } };
    const kopiaR: Rewers = { ...r1, zrodlo: { id: 'lib-r', hash: wR.hash } };
    const projekt = projektBaza(
      [kopiaS],
      [
        { id: 'k1', szablonId: 's1', dane: { nazwa: 'Kula ognia' } },
        { id: 'k2', szablonId: 's1', dane: { nazwa: 'Tarcza' } },
      ],
      [kopiaR],
    );

    // Ten sam hash – brak nowszych wersji.
    expect(wykryjNowszeWersje(projekt, [wA, wR])).toEqual([]);

    // Usunięcie z Moich szablonów – projekt działa dalej, bez alarmu.
    expect(wykryjNowszeWersje(projekt, [])).toEqual([]);

    // Edycja szablonu i tyłu w Moich szablonach (inny hash) – wykrywa oba z liczbą kart.
    const wANowy = await wpisAwers(
      'lib-a',
      szablonBaza('lib-a', 'Zaklęcie', [{ id: 'p1', nazwa: 'Nazwa', klucz: 'nazwa' }], '#faf0e6'),
    );
    const wRNowy = await wpisRewers('lib-r', rewersBaza('lib-r', 'Tył główny', '#334455'));
    const wykryte = wykryjNowszeWersje(projekt, [wANowy, wRNowy]);
    expect(wykryte).toHaveLength(2);
    expect(wykryte[0]).toMatchObject({
      rodzaj: 'awers',
      idWProjekcie: 's1',
      liczbaKart: 2,
    });
    expect(wykryte[1]).toMatchObject({
      rodzaj: 'rewers',
      idWProjekcie: 'r1',
      liczbaKart: 2,
    });
  });
});

describe('aktualizacja kopii szablonu w projekcie (S2)', () => {
  it('aktualizacja podmienia kopię, aktualizuje zrodlo.hash i zachowuje dane kart (po kluczu i po nazwie)', async () => {
    const stary = szablonBaza('s1', 'Zaklęcie', [
      { id: 'p1', nazwa: 'Nazwa', klucz: 'nazwa' },
      { id: 'p2', nazwa: 'Opis efektu', klucz: 'opis_stary' },
      { id: 'p3', nazwa: 'Stare pole', klucz: 'stare' },
    ]);
    const staryWpis = await wpisAwers('lib-1', stary);
    const kopia: Szablon = {
      ...stary,
      rewersId: 'r-lokalny',
      zrodlo: { id: 'lib-1', hash: staryWpis.hash },
    };
    const projekt = projektBaza(
      [kopia],
      [
        {
          id: 'k1',
          szablonId: 's1',
          dane: { nazwa: 'Kula ognia', opis_stary: 'Zadaje 3k6 obrażeń.', stare: 'do usunięcia' },
          ilosc: 3,
        },
      ],
      [rewersBaza('r-lokalny', 'Tył')],
    );

    // Nowsza wersja: tło zmienione, pole „Opis efektu” ma inny klucz (`efekt`), dodano „Koszt”, usunięto „Stare pole”.
    const nowy = szablonBaza(
      'lib-1',
      'Zaklęcie v2',
      [
        { id: 'p1', nazwa: 'Nazwa', klucz: 'nazwa' },
        { id: 'p2', nazwa: 'Opis efektu', klucz: 'efekt' },
        { id: 'p4', nazwa: 'Koszt', klucz: 'koszt' },
      ],
      '#fff8e7',
    );
    const nowyWpis = await wpisAwers('lib-1', nowy, { tytul: 'Inter', ozdoba: 'Playfair' });

    const {
      projekt: po,
      dopasowanie,
      zaktualizowaneKarty,
    } = aktualizujSzablonWProjekcie(projekt, 's1', nowyWpis);

    expect(zaktualizowaneKarty).toBe(1);
    expect(po.szablony[0]!.id).toBe('s1');
    expect(po.szablony[0]!.rewersId).toBe('r-lokalny');
    expect(po.szablony[0]!.tlo).toBe('#fff8e7');
    expect(po.szablony[0]!.zrodlo).toEqual({ id: 'lib-1', hash: nowyWpis.hash });
    expect(po.role.ozdoba).toBe('Playfair');

    // Dane kart: „nazwa” po kluczu, „Opis efektu” po nazwie -> `efekt`, „stare” pominięte, ilosc zachowana.
    expect(po.talie[0]!.karty[0]!.dane).toEqual({
      nazwa: 'Kula ognia',
      efekt: 'Zadaje 3k6 obrażeń.',
    });
    expect(po.talie[0]!.karty[0]!.ilosc).toBe(3);
    expect(dopasowanie.przeniesione.map((p) => p.nazwa)).toEqual(['Nazwa', 'Opis efektu']);
    expect(dopasowanie.pominiete.map((p) => p.nazwa)).toEqual(['Stare pole']);
    expect(dopasowanie.nowe.map((p) => p.nazwa)).toEqual(['Koszt']);

    // Po aktualizacji brak już nowszej wersji.
    expect(wykryjNowszeWersje(po, [nowyWpis])).toEqual([]);
  });

  it('aktualizacja kopii tyłu podmienia wygląd i zrodlo.hash bez zmiany lokalnego id', async () => {
    const r1 = rewersBaza('r1', 'Tył', '#111111');
    const w1 = await wpisRewers('lib-r', r1);
    const projekt = projektBaza(
      [szablonBaza('s1', 'Karta', [])],
      [],
      [{ ...r1, zrodlo: { id: 'lib-r', hash: w1.hash } }],
    );
    const w2 = await wpisRewers('lib-r', rewersBaza('lib-r', 'Tył złoty', '#d4af37'));
    const po = aktualizujRewersWProjekcie(projekt, 'r1', w2);
    expect(po.rewersy?.[0]!.id).toBe('r1');
    expect(po.rewersy?.[0]!.tlo).toBe('#d4af37');
    expect(po.rewersy?.[0]!.nazwa).toBe('Tył złoty');
    expect(po.rewersy?.[0]!.zrodlo).toEqual({ id: 'lib-r', hash: w2.hash });
  });
});

describe('kopiowanie z Moich szablonów i przenoszenie kart (S2/S5)', () => {
  it('dodajKopieSzablonuDoProjektu i dodajKopieRewersuDoProjektu tworzą kopie z zrodlo', async () => {
    const projekt = projektBaza([], []);
    const wR = await wpisRewers('lib-r', rewersBaza('lib-r', 'Tył magii', '#223344'));
    const wA = await wpisAwers(
      'lib-a',
      szablonBaza('lib-a', 'Zaklęcie', [{ id: 'p1', nazwa: 'Nazwa', klucz: 'nazwa' }]),
    );
    const dodany = dodajKopieSzablonuDoProjektu(projekt, wA, { domyslnyRewers: wR });
    expect(dodany.projekt.szablony).toHaveLength(1);
    expect(dodany.projekt.rewersy).toHaveLength(1);
    expect(dodany.projekt.szablony[0]!.zrodlo).toEqual({ id: 'lib-a', hash: wA.hash });
    expect(dodany.projekt.szablony[0]!.rewersId).toBe(dodany.rewersId);
    expect(dodany.projekt.rewersy?.[0]!.zrodlo).toEqual({ id: 'lib-r', hash: wR.hash });

    const dodanyTyl2 = dodajKopieRewersuDoProjektu(dodany.projekt, wR);
    expect(dodanyTyl2.projekt.rewersy).toHaveLength(2);
    expect(dodanyTyl2.rewersId).not.toBe(dodany.rewersId);
  });

  it('przeniesKartyNaSzablon przenosi dane zaznaczonych kart po nazwach pól i nie zmienia szablonów', () => {
    const s1 = szablonBaza('s1', 'Zaklęcie', [
      { id: 'p1', nazwa: 'Nazwa', klucz: 'nazwa' },
      { id: 'p2', nazwa: 'Opis', klucz: 'opis' },
    ]);
    const s2 = szablonBaza('s2', 'Zaklęcie z obrazkiem', [
      { id: 'p1', nazwa: 'Nazwa', klucz: 'tytul_karty' },
      { id: 'p2', nazwa: 'Opis', klucz: 'opis' },
      { id: 'p3', nazwa: 'Ilustracja', klucz: 'ilustracja' },
    ]);
    const projekt = projektBaza(
      [s1, s2],
      [
        { id: 'k1', szablonId: 's1', dane: { nazwa: 'Kula ognia', opis: 'Boom' } },
        { id: 'k2', szablonId: 's1', dane: { nazwa: 'Tarcza', opis: '+2 KP' } },
      ],
    );

    const dop = dopasujPolaSzablonow(s1, s2);
    expect(dop.przeniesione.map((p) => p.nazwa)).toEqual(['Opis', 'Nazwa']);
    expect(dop.nowe.map((p) => p.nazwa)).toEqual(['Ilustracja']);

    const { projekt: po, przeniesioneKarty } = przeniesKartyNaSzablon(
      projekt,
      new Set(['k1']),
      's2',
    );
    expect(przeniesioneKarty).toBe(1);
    expect(po.talie[0]!.karty[0]!.szablonId).toBe('s2');
    expect(po.talie[0]!.karty[0]!.dane).toEqual({ tytul_karty: 'Kula ognia', opis: 'Boom' });
    // Druga karta nietknięta.
    expect(po.talie[0]!.karty[1]!.szablonId).toBe('s1');
    // Szablony nietknięte.
    expect(po.szablony).toEqual(projekt.szablony);
  });

  it('zachowuje i przemapowuje ustawienia kadrowania karta.obrazy oraz obsługuje 0 kart i brak zrodlo', async () => {
    const stary: Szablon = {
      id: 's-obr',
      nazwa: 'Z obrazkiem',
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      korzen: {
        id: 'k',
        typ: 'kolumna',
        dzieci: [
          {
            id: 'obr-stary',
            nazwa: 'Ilustracja',
            typ: 'obraz',
            klucz: 'img_old',
            dopasowanie: 'dopasuj',
          },
          {
            id: 'obr-usuniety',
            nazwa: 'Mini',
            typ: 'obraz',
            klucz: 'mini',
            dopasowanie: 'dopasuj',
          },
        ],
      },
    };
    const nowy: Szablon = {
      id: 'lib-obr',
      nazwa: 'Z obrazkiem v2',
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      korzen: {
        id: 'k',
        typ: 'kolumna',
        dzieci: [
          {
            id: 'obr-nowy',
            nazwa: 'Ilustracja',
            typ: 'obraz',
            klucz: 'img_new',
            dopasowanie: 'wypelnij',
          },
        ],
      },
    };
    const wStary = await wpisAwers('lib-obr', stary);
    const wNowy = await wpisAwers('lib-obr', nowy);

    const projekt = projektBaza(
      [
        { ...stary, zrodlo: { id: 'lib-obr', hash: wStary.hash } },
        szablonBaza('s-bez-zrodla', 'Lokalny', []),
      ],
      [{ id: 'k1', szablonId: 's-obr', dane: { img_old: 'zasob-1', mini: 'zasob-2' } }],
    );
    projekt.talie[0]!.karty[0]!.obrazy = {
      'obr-stary': { skala: 1.5, obrot: 10 },
      'obr-usuniety': { skala: 2 },
    };

    // Szablon bez `zrodlo` jest pomijany przez wykryjNowszeWersje.
    expect(wykryjNowszeWersje(projekt, [wNowy]).map((w) => w.idWProjekcie)).toEqual(['s-obr']);

    const { projekt: po } = aktualizujSzablonWProjekcie(projekt, 's-obr', wNowy);
    expect(po.talie[0]!.karty[0]!.dane).toEqual({ img_new: 'zasob-1' });
    expect(po.talie[0]!.karty[0]!.obrazy).toEqual({ 'obr-nowy': { skala: 1.5, obrot: 10 } });

    // Aktualizacja szablonu z 0 kartami nie psuje projektu.
    const pusty = projektBaza([{ ...stary, zrodlo: { id: 'lib-obr', hash: wStary.hash } }], []);
    const { zaktualizowaneKarty } = aktualizujSzablonWProjekcie(pusty, 's-obr', wNowy);
    expect(zaktualizowaneKarty).toBe(0);
  });
});
