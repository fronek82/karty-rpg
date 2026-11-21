import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WpisBibliotekiGlobalnej } from '../dane/baza';
import { MAKS_BAJTOW_OBRAZU } from '../dane/obrazy';
import { BladDanych } from '../dane/schemat';
import { WERSJA_SCHEMATU, type DaneZasobow, type Projekt } from '../model/projekt';
import type { ProjektWEdycji } from './useProjekt';

const magazyn = new Map<string, { wpis: WpisBibliotekiGlobalnej; dane: Uint8Array }>();

vi.mock('./baza', () => ({
  baza: () => ({
    bibliotekaGlobalna: async (rodzaj?: WpisBibliotekiGlobalnej['rodzaj']) =>
      [...magazyn.values()].map((v) => v.wpis).filter((w) => (rodzaj ? w.rodzaj === rodzaj : true)),
    odczytajZBiblioteki: async (id: string) => {
      const wpis = magazyn.get(id);
      if (!wpis) throw new Error(`Brak wpisu ${id}`);
      return wpis.dane;
    },
    zapiszWBibliotece: async (
      rodzaj: WpisBibliotekiGlobalnej['rodzaj'],
      nazwa: string,
      dane: Uint8Array,
    ) => {
      const id = `${rodzaj}-${magazyn.size + 1}-${nazwa}`;
      const wpis: WpisBibliotekiGlobalnej = {
        id,
        rodzaj,
        nazwa,
      };
      magazyn.set(id, { wpis, dane });
    },
    usunZBiblioteki: async (id: string) => {
      magazyn.delete(id);
    },
  }),
}));

vi.mock('./obrazy', () => ({
  przygotujObraz: async (dane: Uint8Array) => ({
    dane,
    szerokosc: 64,
    wysokosc: 64,
  }),
}));

import {
  dodajGlobalnaCzcionkeDoProjektu,
  dodajGlobalnyObrazDoProjektu,
  dolaczZasobyGlobalne,
  wgrajCzcionkiGlobalnie,
  wgrajObrazyGlobalnie,
} from './zasobyGlobalne';

const pustyProjekt = (): Projekt => ({
  wersja: WERSJA_SCHEMATU,
  id: 'proj-test',
  nazwa: 'Test',
  utworzono: '2026-01-01T00:00:00Z',
  zmieniono: '2026-01-01T00:00:00Z',
  szablony: [],
  role: {},
  talie: [],
  arkusze: [],
  zasoby: [],
});

function atrapaEdycji(poczatkowy: Projekt): {
  edycja: ProjektWEdycji;
  stan: () => { projekt: Projekt; dane: DaneZasobow };
} {
  let projekt = poczatkowy;
  let dane: DaneZasobow = new Map();
  const edycja = {
    get projekt() {
      return projekt;
    },
    zmienZZasobami: async (
      f: (p: Projekt, d: DaneZasobow) => { projekt: Projekt; dane: DaneZasobow },
    ) => {
      const w = f(projekt, dane);
      projekt = w.projekt;
      dane = w.dane;
    },
  } as unknown as ProjektWEdycji;
  return { edycja, stan: () => ({ projekt, dane }) };
}

beforeEach(() => {
  magazyn.clear();
});

describe('zasobyGlobalne', () => {
  it('zwraca niezmieniony projekt, gdy biblioteka globalna jest pusta', async () => {
    const projekt = pustyProjekt();
    const dane: DaneZasobow = new Map();
    const wynik = await dolaczZasobyGlobalne(projekt, dane);
    expect(wynik.projekt).toBe(projekt);
    expect(wynik.dane).toBe(dane);
  });

  it('dołącza zapisane globalnie czcionki i obrazy do nowo tworzonego projektu i pomija duplikaty oraz uszkodzone wpisy', async () => {
    const ttf = new Uint8Array(readFileSync('public/czcionki/CinzelDecorative-Bold.ttf'));
    const png = new Uint8Array(readFileSync('testy/zasoby/litera-f.png'));

    const plikCzcionki = new File([ttf], 'CinzelDecorative-Bold.ttf', { type: 'font/ttf' });
    const wgrane = await wgrajCzcionkiGlobalnie([plikCzcionki]);
    expect(wgrane).toHaveLength(1);
    expect(wgrane[0]).toContain('Cinzel Decorative');
    // Ponowne wgranie tego samego pliku zastępuje wpis bez tworzenia duplikatu w IndexedDB.
    await wgrajCzcionkiGlobalnie([plikCzcionki]);
    expect([...magazyn.values()].filter((v) => v.wpis.rodzaj === 'czcionka')).toHaveLength(1);

    // Dodatkowy uszkodzony wpis nie może zablokować tworzenia projektu.
    magazyn.set('uszkodzona', {
      wpis: { id: 'uszkodzona', rodzaj: 'czcionka', nazwa: 'zepsuta.ttf' },
      dane: new Uint8Array([1, 2, 3]),
    });

    const plikObrazu = new File([png], 'litera-f.png', { type: 'image/png' });
    await wgrajObrazyGlobalnie([plikObrazu]);
    await wgrajObrazyGlobalnie([plikObrazu]);
    expect([...magazyn.values()].filter((v) => v.wpis.rodzaj === 'obraz')).toHaveLength(1);

    const wynik = await dolaczZasobyGlobalne(pustyProjekt(), new Map());
    const czcionka = wynik.projekt.zasoby.find((z) => z.rodzaj === 'czcionka');
    const obraz = wynik.projekt.zasoby.find((z) => z.rodzaj === 'obraz');
    expect(czcionka?.rodzaj === 'czcionka' && czcionka.rodzina).toBe('Cinzel Decorative');
    expect(obraz?.rodzaj === 'obraz' && obraz.nazwa).toBe('litera-f.png');
    expect(wynik.dane.has(czcionka!.id)).toBe(true);
    expect(wynik.dane.has(obraz!.id)).toBe(true);

    // Ponowne dołączenie do projektu, który już ma te zasoby, nie tworzy kopii.
    const drugiRaz = await dolaczZasobyGlobalne(wynik.projekt, wynik.dane);
    expect(drugiRaz.projekt.zasoby).toHaveLength(wynik.projekt.zasoby.length);
  });

  it('wgrajObrazyGlobalnie odrzuca zbyt duży plik lub zły format bez częściowego zapisu', async () => {
    const png = new Uint8Array(readFileSync('testy/zasoby/litera-f.png'));
    const dobry = new File([png], 'dobry.png', { type: 'image/png' });
    const zly = new File([new Uint8Array([1, 2, 3, 4])], 'zly.png', { type: 'image/png' });
    await expect(wgrajObrazyGlobalnie([dobry, zly])).rejects.toBeInstanceOf(BladDanych);
    expect(magazyn.size).toBe(0);

    const zaDuzy = new File([new Uint8Array(1)], 'wielki.png', { type: 'image/png' });
    Object.defineProperty(zaDuzy, 'size', { value: MAKS_BAJTOW_OBRAZU + 1 });
    await expect(wgrajObrazyGlobalnie([zaDuzy])).rejects.toBeInstanceOf(BladDanych);
    expect(magazyn.size).toBe(0);
  });

  it('dodajGlobalnaCzcionkeDoProjektu i dodajGlobalnyObrazDoProjektu kopiują zasoby do aktywnego projektu', async () => {
    const ttf = new Uint8Array(readFileSync('public/czcionki/CinzelDecorative-Bold.ttf'));
    const png = new Uint8Array(readFileSync('testy/zasoby/litera-f.png'));
    await wgrajCzcionkiGlobalnie([new File([ttf], 'CinzelDecorative-Bold.ttf')]);
    await wgrajObrazyGlobalnie([new File([png], 'litera-f.png', { type: 'image/png' })]);

    const wpisCz = [...magazyn.values()].find((v) => v.wpis.rodzaj === 'czcionka')!.wpis;
    const wpisOb = [...magazyn.values()].find((v) => v.wpis.rodzaj === 'obraz')!.wpis;
    const { edycja, stan } = atrapaEdycji(pustyProjekt());

    const etykietaCz = await dodajGlobalnaCzcionkeDoProjektu(wpisCz, edycja);
    const nazwaOb = await dodajGlobalnyObrazDoProjektu(wpisOb, edycja);
    expect(etykietaCz).toContain('Cinzel Decorative');
    expect(nazwaOb).toBe('litera-f.png');
    expect(stan().projekt.zasoby.some((z) => z.rodzaj === 'czcionka')).toBe(true);
    expect(stan().projekt.zasoby.some((z) => z.rodzaj === 'obraz')).toBe(true);
  });
});
