import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WpisBibliotekiGlobalnej, WpisCzcionkiZProjektu } from '../dane/baza';
import { wgrajCzcionke } from '../dane/czcionki';
import { MAKS_BAJTOW_OBRAZU } from '../dane/obrazy';
import { BladDanych } from '../dane/schemat';
import { WERSJA_SCHEMATU, type DaneZasobow, type Projekt } from '../model/projekt';
import type { ProjektWEdycji } from './useProjekt';

const magazyn = new Map<string, { wpis: WpisBibliotekiGlobalnej; dane: Uint8Array }>();
const projektyWBazie = new Map<string, { projekt: Projekt; zasoby: DaneZasobow }>();

vi.mock('./bazaUI', () => ({
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
      id = `${rodzaj}-${magazyn.size + 1}-${nazwa}`,
    ) => {
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
    czcionkiZProjektow: async (pomijajProjektId?: string): Promise<WpisCzcionkiZProjektu[]> => {
      const wynik: WpisCzcionkiZProjektu[] = [];
      for (const [pid, { projekt }] of projektyWBazie) {
        if (pid === pomijajProjektId) continue;
        for (const z of projekt.zasoby) {
          if (z.rodzaj !== 'czcionka' || z.zrodlo === 'wbudowana') continue;
          wynik.push({
            projektId: pid,
            zasobId: z.id,
            nazwa: z.nazwa,
            rodzina: z.rodzina,
            wariant: z.wariant,
            zrodlo: z.zrodlo,
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

vi.mock('./obrazyUI', () => ({
  przygotujObraz: async (dane: Uint8Array) => ({
    dane,
    szerokosc: 64,
    wysokosc: 64,
  }),
}));

import {
  dodajGlobalnaCzcionkeDoProjektu,
  dodajGlobalnyObrazDoProjektu,
  dolaczRodzineGlobalnaDoProjektu,
  dolaczZasobyGlobalne,
  listaRodzinCzcionekGlobalnych,
  wgrajCzcionkiGlobalnie,
  wgrajObrazyGlobalnie,
  wyczyscPamiecCzcionekGlobalnych,
  zapiszCzcionkiGlobalnie,
} from './zasobyGlobalne';

const pustyProjekt = (id = 'proj-test'): Projekt => ({
  wersja: WERSJA_SCHEMATU,
  id,
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
    zmien: (f: (p: Projekt) => Projekt) => {
      projekt = f(projekt);
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
  projektyWBazie.clear();
  wyczyscPamiecCzcionekGlobalnych();
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

  it('zapiszCzcionkiGlobalnie i czcionki z innych projektów są dostępne i automatycznie dołączane do innego projektu', async () => {
    const cinzel = new Uint8Array(readFileSync('public/czcionki/CinzelDecorative-Bold.ttf'));
    const garamond = new Uint8Array(readFileSync('public/czcionki/EBGaramond-Regular.ttf'));
    const wGoogle = wgrajCzcionke('Almendra-Regular.ttf', garamond, { zrodlo: 'google' });
    await zapiszCzcionkiGlobalnie([
      { opis: { ...wGoogle.opis, rodzina: 'Almendra', wariant: 'normalny' }, dane: wGoogle.dane },
    ]);

    // Starszy projekt z własną czcionką (spoza biblioteki globalnej) także jest wykrywany.
    const wStary = wgrajCzcionke('CinzelDecorative-Bold.ttf', cinzel, { zrodlo: 'wlasna' });
    const projStary: Projekt = { ...pustyProjekt('proj-stary'), zasoby: [wStary.opis] };
    projektyWBazie.set('proj-stary', {
      projekt: projStary,
      zasoby: new Map([[wStary.opis.id, wStary.dane]]),
    });

    const lista = await listaRodzinCzcionekGlobalnych('proj-nowy', new Set());
    expect(lista.map((g) => g.rodzina)).toEqual(['Almendra', 'Cinzel Decorative']);

    const { edycja, stan } = atrapaEdycji(pustyProjekt('proj-nowy'));
    const dodanoGoogle = await dolaczRodzineGlobalnaDoProjektu('Almendra', edycja);
    const dodanoStara = await dolaczRodzineGlobalnaDoProjektu('Cinzel Decorative', edycja);
    expect(dodanoGoogle).toBe(true);
    expect(dodanoStara).toBe(true);
    expect(
      stan()
        .projekt.zasoby.filter((z) => z.rodzaj === 'czcionka')
        .map((z) => z.rodzina)
        .sort(),
    ).toEqual(['Almendra', 'Cinzel Decorative']);
  });
});
