import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WpisBibliotekiGlobalnej, WpisRewersuZProjektu } from '../dane/baza';
import { dodajRewersZPaczki, eksportujRewers, importujRewers } from '../dane/archiwum';
import { przypiszRewers } from '../dane/rewers';
import { WERSJA_SCHEMATU, type DaneZasobow, type Projekt } from '../model/projekt';
import { kluczTresciSzablonu, type Rewers } from '../model/szablon';
import type { ProjektWEdycji } from './useProjekt';

const biblioteka = new Map<string, { wpis: WpisBibliotekiGlobalnej; dane: Uint8Array }>();
const projektyWBazie = new Map<string, { projekt: Projekt; zasoby: DaneZasobow }>();

vi.mock('./bazaUI', () => ({
  baza: () => ({
    bibliotekaGlobalna: async (rodzaj: WpisBibliotekiGlobalnej['rodzaj']) =>
      [...biblioteka.values()].map((v) => v.wpis).filter((w) => w.rodzaj === rodzaj),
    zapiszWBibliotece: async (
      rodzaj: WpisBibliotekiGlobalnej['rodzaj'],
      nazwa: string,
      dane: Uint8Array,
      id = `gen-${biblioteka.size + 1}`,
    ) => {
      biblioteka.set(id, { wpis: { id, rodzaj, nazwa }, dane });
    },
    odczytajZBiblioteki: async (id: string) => {
      const v = biblioteka.get(id);
      if (!v) throw new Error(`Brak wpisu ${id}`);
      return v.dane;
    },
    usunZBiblioteki: async (id: string) => {
      biblioteka.delete(id);
    },
    rewersyZProjektow: async (pomijajProjektId?: string): Promise<WpisRewersuZProjektu[]> => {
      const wynik: WpisRewersuZProjektu[] = [];
      for (const [pid, { projekt }] of projektyWBazie) {
        if (pid === pomijajProjektId) continue;
        for (const r of projekt.rewersy ?? []) {
          wynik.push({
            projektId: pid,
            rewersId: r.id,
            nazwa: r.nazwa,
            kluczTresci: kluczTresciSzablonu(r),
          });
        }
      }
      return wynik;
    },
    wczytaj: async (id: string) => {
      const v = projektyWBazie.get(id);
      if (!v) throw new Error(`Brak projektu ${id}`);
      return v;
    },
  }),
}));

import {
  dolaczRewersGlobalnyDoProjektu,
  listaRewersowGlobalnych,
  zapiszRewersGlobalnie,
} from './rewersyGlobalne';

const przykladowyRewers = (id: string, nazwa: string, obrazId?: string): Rewers => ({
  id,
  nazwa,
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
  tlo: '#1f2937',
  ...(obrazId ? { teksturaTla: obrazId } : {}),
  korzen: {
    id: 'rewers',
    nazwa,
    typ: 'swobodny',
    dzieci: obrazId
      ? [
          {
            id: 'obr1',
            typ: 'obraz',
            klucz: 'tlo',
            zasob: obrazId,
            dopasowanie: 'dopasuj',
            szerokosc: { mm: 50 },
            wysokosc: { mm: 50 },
          },
        ]
      : [],
  },
});

const projektZ = (id: string, rewersy: Rewers[] = []): Projekt => ({
  wersja: WERSJA_SCHEMATU,
  id,
  nazwa: `Projekt ${id}`,
  utworzono: '2026-01-01T00:00:00Z',
  zmieniono: '2026-01-01T00:00:00Z',
  szablony: [
    {
      id: 'sz1',
      nazwa: 'Karta',
      rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
      korzen: { id: 'k', nazwa: 'Karta', typ: 'swobodny', dzieci: [] },
    },
  ],
  ...(rewersy.length > 0 ? { rewersy } : {}),
  role: {},
  talie: [{ id: 't1', nazwa: 'Talia', karty: [] }],
  arkusze: [],
  zasoby: [],
});

beforeEach(() => {
  biblioteka.clear();
  projektyWBazie.clear();
});

describe('rewersyGlobalne i paczka rewersu', () => {
  it('eksportuje, importuje i dołącza rewers wraz z obrazem i przemianowaniem kolizji id', () => {
    const png = new Uint8Array(readFileSync('testy/zasoby/litera-f.png'));
    const zrodlowy: Projekt = {
      ...projektZ('p-rewers', [przykladowyRewers('rewers', 'Warlock tył', 'obr-logo')]),
      zasoby: [
        {
          rodzaj: 'obraz',
          id: 'obr-logo',
          nazwa: 'litera-f.png',
          format: 'png',
          szerokosc: 64,
          wysokosc: 64,
        },
      ],
    };
    const daneZrodlowe: DaneZasobow = new Map([['obr-logo', png]]);

    const bajty = eksportujRewers(zrodlowy, daneZrodlowe, 'rewers');
    const paczka = importujRewers(bajty);
    expect(paczka.rewers.nazwa).toBe('Warlock tył');
    expect(paczka.zasoby).toHaveLength(1);

    // Projekt docelowy ma już własny rewers o id „rewers” – kolizja powinna nadać nowe id.
    const docelowy = projektZ('p-awers', [przykladowyRewers('rewers', 'Inny rewers')]);
    const dodany = dodajRewersZPaczki(docelowy, new Map(), paczka);
    expect(dodany.rewersId).toBe('rewers-2');
    expect(dodany.projekt.rewersy).toHaveLength(2);
    expect(dodany.projekt.zasoby.some((z) => z.id === 'obr-logo')).toBe(true);
    expect(dodany.dane.has('obr-logo')).toBe(true);
  });

  it('zapiszRewersGlobalnie aktualizuje istniejący wpis bez duplikatów i udostępnia go w innym projekcie', async () => {
    const pRewers = projektZ('proj-r', [przykladowyRewers('rewers', 'Rewers 1')]);
    await zapiszRewersGlobalnie(pRewers, new Map(), 'rewers');
    // Zmiana nazwy i ponowny zapis aktualizuje ten sam wpis (bez tworzenia kopii).
    const pZmieniony = projektZ('proj-r', [przykladowyRewers('rewers', 'Rewers Warlock')]);
    await zapiszRewersGlobalnie(pZmieniony, new Map(), 'rewers');
    expect(biblioteka.size).toBe(1);

    // Starszy projekt sprzed biblioteki również pojawia się na liście.
    const pStary = projektZ('proj-stary', [przykladowyRewers('r-stary', 'Stary rewers')]);
    projektyWBazie.set('proj-stary', { projekt: pStary, zasoby: new Map() });

    const lista = await listaRewersowGlobalnych('proj-awers', new Set());
    expect(lista.map((x) => x.nazwa)).toEqual(['Rewers Warlock', 'Stary rewers']);

    // Dołączenie i jednoczesne przypisanie do talii w projekcie awersu.
    let stanProj = projektZ('proj-awers');
    let stanDane: DaneZasobow = new Map();
    const edycja = {
      get projekt() {
        return stanProj;
      },
      zmienZZasobami: async (
        f: (p: Projekt, d: DaneZasobow) => { projekt: Projekt; dane: DaneZasobow },
      ) => {
        const w = f(stanProj, stanDane);
        stanProj = w.projekt;
        stanDane = w.dane;
      },
    } as unknown as ProjektWEdycji;

    const wpisWarlock = lista.find((x) => x.nazwa === 'Rewers Warlock')!;
    const noweId = await dolaczRewersGlobalnyDoProjektu(wpisWarlock, edycja, (p, rid) =>
      przypiszRewers(p, { rodzaj: 'talia', id: 't1' }, rid),
    );
    expect(stanProj.rewersy?.some((r) => r.id === noweId && r.nazwa === 'Rewers Warlock')).toBe(
      true,
    );
    expect(stanProj.talie[0]?.rewersId).toBe(noweId);

    // Po dodaniu do projektu ten sam rewers nie dubluje się już w grupie zapisanych.
    const poDodaniu = await listaRewersowGlobalnych(
      'proj-awers',
      new Set((stanProj.rewersy ?? []).map(kluczTresciSzablonu)),
    );
    expect(poDodaniu.map((x) => x.nazwa)).toEqual(['Stary rewers']);

    // W trzecim projekcie „Rewers Warlock” również pojawia się tylko raz (mimo kopii w proj-awers).
    projektyWBazie.set('proj-awers', { projekt: stanProj, zasoby: stanDane });
    const wTrzecim = await listaRewersowGlobalnych('proj-trzeci', new Set());
    expect(wTrzecim.map((x) => x.nazwa)).toEqual(['Rewers Warlock', 'Stary rewers']);
  });

  it('rewersy o tej samej nazwie, ale innej treści, są na liście osobno', async () => {
    const inny = { ...przykladowyRewers('r2', 'Tył'), tlo: '#ffffff' };
    projektyWBazie.set('pa', {
      projekt: projektZ('pa', [przykladowyRewers('r1', 'Tył')]),
      zasoby: new Map(),
    });
    projektyWBazie.set('pb', { projekt: projektZ('pb', [inny]), zasoby: new Map() });
    // Identyczna kopia pierwszego (inne id) – pomijana.
    projektyWBazie.set('pc', {
      projekt: projektZ('pc', [przykladowyRewers('r9', 'Tył')]),
      zasoby: new Map(),
    });
    const lista = await listaRewersowGlobalnych('inny', new Set());
    expect(lista.map((x) => `${x.projektId}:${x.rewersId}`).sort()).toEqual(['pa:r1', 'pb:r2']);
  });
});
