/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { beforeAll, describe, expect, it } from 'vitest';
import { WERSJA_SCHEMATU, type DaneZasobow, type Projekt } from '../model/projekt';
import type { Szablon } from '../model/szablon';
import { importujSvg, type ElementOzdobny } from '../ozdobniki';
import { pakietMausritter } from '../pakiety/mausritter';
import {
  dodajSzablon,
  eksportujProjekt,
  eksportujSzablon,
  importujProjekt,
  importujSzablon,
} from './archiwum';
import {
  MAKS_ELEMENTOW_BIBLIOTEKI,
  dodajElementDoBiblioteki,
  dolaczElementy,
  elementyUzyteWSzablonie,
  noweIdElementu,
  przytnijTresc,
  odwolaniaDoElementow,
  przepiszOdwolania,
  szablonyUzywajace,
  usunElementZBiblioteki,
  zmienElementBiblioteki,
} from './biblioteka';
import { projektZPakietu } from './pakiet';
import { migruj, ostrzezeniaProjektu, przygotujProjekt } from './schemat';

const czcionka = async (plik: string) => new Uint8Array(readFileSync(`public/czcionki/${plik}`));
const obraz = async () =>
  new Uint8Array(readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png'));

let baza: Projekt;
let zasoby: DaneZasobow;
beforeAll(async () => {
  ({ projekt: baza, zasoby } = await projektZPakietu(pakietMausritter, czcionka, obraz, 'p1'));
});

const plikSvg = readFileSync('testy/zasoby/gwiazdka.svg', 'utf8');
const nowy = (rodzaj: ElementOzdobny['rodzaj'] = 'ksztalt') =>
  importujSvg(plikSvg, { rodzaj }).element;

/** Projekt z dwoma własnymi elementami i szablonem, który ich używa na wiele sposobów. */
function projektZElementami(): { p: Projekt; szablon: Szablon } {
  let p = baza;
  p = dodajElementDoBiblioteki(p, 'Gwiazdka.svg', nowy('ksztalt')).projekt;
  p = dodajElementDoBiblioteki(p, 'Rog', nowy('naroznik')).projekt;
  const wzor = p.szablony.find((s) => s.id === 'mausritter-bron')!;
  const szablon: Szablon = {
    ...structuredClone(wzor),
    id: 'ozdobny',
    nazwa: 'Ozdobny',
    ramka: {
      grubosc: 0.3,
      kolor: '#000000',
      narozniki: { element: 'wl:Rog', rozmiar: 6 },
    },
    korzen: {
      id: 'korzen',
      typ: 'kolumna',
      dzieci: [
        {
          id: 'w',
          typ: 'wartosc',
          tekst: '3',
          ksztalt: 'wlasny',
          ksztaltElement: 'wl:Gwiazdka',
          styl: { czcionka: 'tresc', rozmiar: 3 },
        },
        {
          id: 'sep',
          typ: 'separator',
          kierunek: 'poziomy',
          grubosc: 0.3,
          srodek: { element: 'wl:Rog', rozmiar: 3 },
        },
      ],
    },
  };
  return { p: { ...p, szablony: [...p.szablony, szablon] }, szablon };
}

describe('biblioteka ozdobników projektu', () => {
  it('dodawanie nadaje unikalne id wl:…, usuwanie czyści pole biblioteki', () => {
    expect(noweIdElementu('Moja Gwiazda.svg', baza)).toBe('wl:Moja-Gwiazda');
    const a = dodajElementDoBiblioteki(baza, 'Gwiazdka', nowy());
    const b = dodajElementDoBiblioteki(a.projekt, 'Gwiazdka', nowy());
    expect(a.id).toBe('wl:Gwiazdka');
    expect(b.id).toBe('wl:Gwiazdka-2');
    expect(b.projekt.biblioteka!.ozdobniki).toHaveLength(2);
    // Stary projekt nie został zmieniony (niemutowalnie).
    expect(baza.biblioteka).toBeUndefined();
    const bez = usunElementZBiblioteki(usunElementZBiblioteki(b.projekt, a.id), b.id);
    expect(bez.biblioteka).toBeUndefined();
    expect(usunElementZBiblioteki(bez, 'wl:brak')).toBe(bez);
  });

  it('zmiana rodzaju, nazwy, kolorowania i prostokąta treści', () => {
    const a = dodajElementDoBiblioteki(baza, 'G', nowy('naroznik'));
    const p = zmienElementBiblioteki(a.projekt, a.id, {
      rodzaj: 'ksztalt',
      nazwa: 'Gwiazda',
      kolorowanie: 'oryginal',
      tresc: { x: 0.2, y: 0.2, szer: 0.6, wys: 0.6 },
    });
    expect(p.biblioteka!.ozdobniki[0]).toMatchObject({
      rodzaj: 'ksztalt',
      nazwa: 'Gwiazda',
      kolorowanie: 'oryginal',
      tresc: { x: 0.2, y: 0.2, szer: 0.6, wys: 0.6 },
    });
    expect(() => przygotujProjekt(p)).not.toThrow();
  });

  it('odwołania do elementów: lista, użycie, przepisanie identyfikatorów', () => {
    const { p, szablon } = projektZElementami();
    expect(odwolaniaDoElementow(szablon).sort()).toEqual(['wl:Gwiazdka', 'wl:Rog', 'wl:Rog']);
    expect(szablonyUzywajace(p, 'wl:Rog').map((s) => s.id)).toEqual(['ozdobny']);
    expect(szablonyUzywajace(p, 'wl:Gwiazdka')).toHaveLength(1);
    expect(
      elementyUzyteWSzablonie(p, szablon)
        .map((e) => e.id)
        .sort(),
    ).toEqual(['wl:Gwiazdka', 'wl:Rog']);
    const kopia = structuredClone(szablon);
    przepiszOdwolania(kopia, new Map([['wl:Rog', 'wl:Rog-2']]));
    expect(odwolaniaDoElementow(kopia).sort()).toEqual(['wl:Gwiazdka', 'wl:Rog-2', 'wl:Rog-2']);
    expect(odwolaniaDoElementow(szablon)).toContain('wl:Rog');
  });
});

describe('eksport i import z elementami', () => {
  it('round-trip projektu (.kartyrpg) zachowuje bibliotekę', () => {
    const { p } = projektZElementami();
    const wynik = importujProjekt(eksportujProjekt(p, zasoby));
    expect(wynik.projekt).toEqual(p);
    expect(wynik.projekt.biblioteka!.ozdobniki).toHaveLength(2);
    // Plik projektu to czysty JSON – bez surowego SVG.
    const json = strFromU8(unzipSync(eksportujProjekt(p, zasoby))['projekt.json']!);
    expect(json).not.toMatch(/<svg|<script|onload/);
  });

  it('plik szablonu niesie tylko użyte elementy; import do innego projektu je dodaje', () => {
    const { p, szablon } = projektZElementami();
    // Trzeci, nieużywany element nie trafia do pliku szablonu.
    const z3 = dodajElementDoBiblioteki(p, 'Nieuzywany', nowy()).projekt;
    const { bajty } = eksportujSzablon(z3, zasoby, szablon.id);
    const paczka = importujSzablon(bajty);
    expect(paczka.biblioteka!.map((e) => e.id).sort()).toEqual(['wl:Gwiazdka', 'wl:Rog']);
    const w = dodajSzablon(baza, zasoby, paczka);
    expect(w.projekt.biblioteka!.ozdobniki.map((e) => e.id).sort()).toEqual([
      'wl:Gwiazdka',
      'wl:Rog',
    ]);
    expect(ostrzezeniaProjektu(w.projekt).filter((o) => /element ozdobny/.test(o))).toEqual([]);
  });

  it('import szablonu: ten sam element współdzielony, inny o zajętym id dostaje nowe id i odwołania', () => {
    const { p, szablon } = projektZElementami();
    const paczka = importujSzablon(eksportujSzablon(p, zasoby, szablon.id).bajty);
    // Projekt docelowy ma już „wl:Rog” – ale innego (kształt zamiast narożnika) i identyczną gwiazdkę.
    let cel = dodajElementDoBiblioteki(baza, 'Gwiazdka.svg', nowy('ksztalt')).projekt;
    cel = dodajElementDoBiblioteki(
      cel,
      'Rog',
      importujSvg('<svg viewBox="0 0 5 5"><rect width="5" height="5"/></svg>', {
        rodzaj: 'srodek',
      }).element,
    ).projekt;
    const w = dodajSzablon(cel, zasoby, paczka);
    const ids = w.projekt.biblioteka!.ozdobniki.map((e) => e.id).sort();
    expect(ids).toEqual(['wl:Gwiazdka', 'wl:Rog', 'wl:Rog-2']);
    const dodany = w.projekt.szablony.find((s) => s.id === w.szablonId)!;
    expect(odwolaniaDoElementow(dodany).sort()).toEqual(['wl:Gwiazdka', 'wl:Rog-2', 'wl:Rog-2']);
    // Element już w projekcie pozostał nietknięty.
    expect(w.projekt.biblioteka!.ozdobniki.find((e) => e.id === 'wl:Rog')!.rodzaj).toBe('srodek');
    expect(dolaczElementy(cel, []).lista).toHaveLength(2);
  });

  it('szablon bez własnych elementów nie ma pola biblioteka', () => {
    const { bajty } = eksportujSzablon(baza, zasoby, 'mausritter-bron');
    expect(importujSzablon(bajty).biblioteka).toBeUndefined();
    const json = JSON.parse(strFromU8(unzipSync(bajty)['szablon.json']!));
    expect('biblioteka' in json).toBe(false);
  });
});

describe('walidacja i migracja (schemat 13)', () => {
  it('migracja 12→13 jest tożsamościowa; stary projekt bez biblioteki się otwiera', () => {
    expect(migruj({ wersja: 12, a: 1 }, 'projekt')).toEqual({ wersja: WERSJA_SCHEMATU, a: 1 });
    expect(migruj({ wersja: 12, a: 1 }, 'szablon')).toEqual({ wersja: WERSJA_SCHEMATU, a: 1 });
    const stary = { ...structuredClone(baza), wersja: 12 };
    const w = przygotujProjekt(stary);
    expect(w.biblioteka).toBeUndefined();
    expect(w.szablony).toEqual(baza.szablony);
  });

  it('odrzuca element z wb: w id, zły kolor, złą komendę, zbyt wiele komend i powtórzone id', () => {
    const { p } = projektZElementami();
    const e = p.biblioteka!.ozdobniki[0]!;
    const z = (zmiana: Partial<ElementOzdobny> | ElementOzdobny[]): Projekt => ({
      ...p,
      biblioteka: {
        ozdobniki: Array.isArray(zmiana) ? zmiana : [{ ...e, ...zmiana }],
      },
    });
    expect(() => przygotujProjekt(z({ id: 'wb:kat' }))).toThrow();
    expect(() => przygotujProjekt(z({ id: 'inny' }))).toThrow();
    expect(() =>
      przygotujProjekt(z({ kontury: [{ kontur: [['M', 0, 0]], wypelnienie: 'url(#x)' }] })),
    ).toThrow();
    expect(() =>
      przygotujProjekt(z({ kontury: [{ kontur: [['X', 0, 0] as never], wypelnienie: 'kolor' }] })),
    ).toThrow();
    expect(() =>
      przygotujProjekt(z({ kontury: [{ kontur: [['M', Infinity, 0]], wypelnienie: 'kolor' }] })),
    ).toThrow();
    const duzo = Array.from({ length: 20001 }, () => ['L', 1, 1] as ['L', number, number]);
    expect(() =>
      przygotujProjekt(z({ kontury: [{ kontur: duzo, wypelnienie: 'kolor' }] })),
    ).toThrow(/kontury/);
    expect(() => przygotujProjekt(z([e, { ...e }]))).toThrow(/powtórzony|wielokrotnie|id/i);
    expect(() => przygotujProjekt(z({ szer: 0 }))).toThrow();
    expect(() => przygotujProjekt(z({ tresc: { x: 2, y: 0, szer: 1, wys: 1 } }))).toThrow();
  });

  it('ostrzega o elemencie użytym w szablonie, którego nie ma w bibliotece', () => {
    const { p } = projektZElementami();
    const bez = usunElementZBiblioteki(p, 'wl:Rog');
    const o = ostrzezeniaProjektu(bez).filter((x) => x.includes('wl:Rog'));
    expect(o).toHaveLength(1);
    expect(ostrzezeniaProjektu(p).filter((x) => x.includes('wl:'))).toEqual([]);
  });

  it('limit liczby elementów biblioteki jest stały i rozsądny', () => {
    expect(MAKS_ELEMENTOW_BIBLIOTEKI).toBe(200);
  });

  it('plik szablonu z uszkodzonym elementem jest odrzucany', () => {
    const { p, szablon } = projektZElementami();
    const { bajty } = eksportujSzablon(p, zasoby, szablon.id);
    const pliki = unzipSync(bajty);
    const j = JSON.parse(strFromU8(pliki['szablon.json']!));
    j.biblioteka[0].id = 'cokolwiek';
    expect(() =>
      importujSzablon(zipSync({ ...pliki, 'szablon.json': strToU8(JSON.stringify(j)) })),
    ).toThrow();
  });
});

describe('poprawki po przeglądzie (paczka, limity, walidacja)', () => {
  const paczkaZ = (p: Projekt, szablon: Szablon) =>
    importujSzablon(eksportujSzablon(p, zasoby, szablon.id).bajty);

  it('duplikat id elementu w paczce jest odrzucany', () => {
    const { p, szablon } = projektZElementami();
    const pliki = unzipSync(eksportujSzablon(p, zasoby, szablon.id).bajty);
    const j = JSON.parse(strFromU8(pliki['szablon.json']!));
    j.biblioteka.push(structuredClone(j.biblioteka[0]));
    expect(() =>
      importujSzablon(zipSync({ ...pliki, 'szablon.json': strToU8(JSON.stringify(j)) })),
    ).toThrow(/powtórzony/);
    const e = j.biblioteka[0] as ElementOzdobny;
    expect(() => dolaczElementy(baza, [e, e])).toThrow(/powtórzony/);
  });

  it('limit 200 elementów w projekcie i w paczce (schemat) oraz po dołączeniu', () => {
    const { p } = projektZElementami();
    const e = p.biblioteka!.ozdobniki[0]!;
    const wiele = (n: number): ElementOzdobny[] =>
      Array.from({ length: n }, (_, i) => ({ ...e, id: `wl:e${i}` }));
    expect(() => przygotujProjekt({ ...p, biblioteka: { ozdobniki: wiele(200) } })).not.toThrow();
    expect(() => przygotujProjekt({ ...p, biblioteka: { ozdobniki: wiele(201) } })).toThrow();
    // Po dołączeniu do pełnej biblioteki limit też obowiązuje.
    const pelny: Projekt = { ...baza, biblioteka: { ozdobniki: wiele(200) } };
    expect(() => dolaczElementy(pelny, [{ ...e, id: 'wl:nowy' }])).toThrow(/limit/);
    const pliki = unzipSync(eksportujSzablon(p, zasoby, 'ozdobny').bajty);
    const j = JSON.parse(strFromU8(pliki['szablon.json']!));
    j.biblioteka = wiele(201);
    expect(() =>
      importujSzablon(zipSync({ ...pliki, 'szablon.json': strToU8(JSON.stringify(j)) })),
    ).toThrow();
  });

  it('dodajSzablon dołącza tylko elementy używane przez szablon', () => {
    const { p, szablon } = projektZElementami();
    const paczka = paczkaZ(p, szablon);
    const nadmiar = { ...paczka.biblioteka![0]!, id: 'wl:zbedny' };
    const w = dodajSzablon(baza, zasoby, {
      ...paczka,
      biblioteka: [...paczka.biblioteka!, nadmiar],
    });
    expect(w.projekt.biblioteka!.ozdobniki.map((x) => x.id)).not.toContain('wl:zbedny');
    expect(w.projekt.biblioteka!.ozdobniki).toHaveLength(2);
  });

  it('ostrzega, gdy szablon odwołuje się do elementu spoza paczki, a projekt go ma', () => {
    const { p, szablon } = projektZElementami();
    const paczka = paczkaZ(p, szablon);
    const bez = { ...paczka, biblioteka: paczka.biblioteka!.filter((e) => e.id !== 'wl:Rog') };
    const w = dodajSzablon(p, zasoby, bez);
    expect(w.ostrzezenia.some((o) => o.includes('wl:Rog'))).toBe(true);
    // Brak także w projekcie – tylko ostrzeżenie projektu (nie ostrzeżenie importu).
    const w2 = dodajSzablon(baza, zasoby, bez);
    expect(w2.ostrzezenia.some((o) => o.includes('wl:Rog'))).toBe(false);
    expect(ostrzezeniaProjektu(w2.projekt).some((o) => o.includes('wl:Rog'))).toBe(true);
  });

  it('id: bardzo długa nazwa jest obcinana tak, by wl: + id mieściło się w 103 znakach', () => {
    const dluga = 'a'.repeat(300);
    const id = noweIdElementu(dluga, baza);
    expect(id.length).toBeLessThanOrEqual(103);
    // Kolizje nie wydłużają id ponad limit i dają poprawny element.
    const p1 = dodajElementDoBiblioteki(baza, dluga, nowy());
    const kopie = dolaczElementy(p1.projekt, [
      { ...p1.projekt.biblioteka!.ozdobniki[0]!, nazwa: 'inny' },
    ]);
    expect(kopie.lista.every((e) => e.id.length <= 103)).toBe(true);
    expect(() =>
      przygotujProjekt({ ...p1.projekt, biblioteka: { ozdobniki: kopie.lista } }),
    ).not.toThrow();
  });

  it('schemat: kostka z limitem komend, zakres liczb, grubość obrysu, prostokąt treści', () => {
    const { p } = projektZElementami();
    const e = p.biblioteka!.ozdobniki[0]!;
    const z = (zmiana: Partial<ElementOzdobny>): Projekt => ({
      ...p,
      biblioteka: { ozdobniki: [{ ...e, ...zmiana }] },
    });
    const duzo = Array.from({ length: 20001 }, () => ['L', 1, 1] as ['L', number, number]);
    expect(() =>
      przygotujProjekt(z({ kostka: [{ kontur: duzo, wypelnienie: 'kolor' }] })),
    ).toThrow();
    expect(() =>
      przygotujProjekt(z({ kontury: [{ kontur: [['M', 2e6, 0]], wypelnienie: 'kolor' }] })),
    ).toThrow();
    expect(() =>
      przygotujProjekt(
        z({ kontury: [{ kontur: [['M', 0, 0]], obrys: { grubosc: 2e6, kolor: 'kolor' } }] }),
      ),
    ).toThrow();
    expect(() => przygotujProjekt(z({ szer: 2e6 }))).toThrow();
    for (const tresc of [
      { x: 0.1, y: 0.1, szer: 0, wys: 0.5 },
      { x: 0.1, y: 0.1, szer: 0.5, wys: 0.005 },
      { x: 0.6, y: 0, szer: 0.6, wys: 0.5 },
      { x: 0, y: 0.7, szer: 0.5, wys: 0.5 },
    ])
      expect(() => przygotujProjekt(z({ tresc })), JSON.stringify(tresc)).toThrow();
    expect(() =>
      przygotujProjekt(z({ tresc: { x: 0.5, y: 0.5, szer: 0.5, wys: 0.5 } })),
    ).not.toThrow();
  });

  it('przytnijTresc: wymiary ≥ 1 %, całość w zakresie 0–1', () => {
    expect(przytnijTresc({ x: 0.9, y: -1, szer: 0.5, wys: 0 })).toEqual({
      x: 0.5,
      y: 0,
      szer: 0.5,
      wys: 0.01,
    });
    const a = dodajElementDoBiblioteki(baza, 'G', nowy());
    const p = zmienElementBiblioteki(a.projekt, a.id, {
      tresc: { x: 0.9, y: 0.9, szer: 0.5, wys: 0.5 },
    });
    expect(() => przygotujProjekt(p)).not.toThrow();
  });
});

describe('wzór tła karty (schemat 29, N5)', () => {
  const wzor = {
    rodzaj: 'romby' as const,
    grubosc: 0.25,
    odstep: 4,
    kolor: '#884422',
    krycie: 0.5,
    obrot: 15,
    przesuniecie: { x: 1, y: -2 },
    podTekstura: true,
  };

  it('migracja 28→29 nie zmienia danych', () => {
    expect(migruj({ wersja: 28, a: 1 }, 'projekt', 29)).toEqual({ wersja: 29, a: 1 });
    expect(migruj({ wersja: 28, a: 1 }, 'szablon', 29)).toEqual({ wersja: 29, a: 1 });
  });

  it('wzór awersu i rewersu przechodzi eksport i import szablonu oraz projektu', () => {
    const szablon: Szablon = { ...baza.szablony[0]!, wzorTla: wzor, rewersId: 'rw' };
    const p: Projekt = {
      ...baza,
      szablony: [szablon, ...baza.szablony.slice(1)],
      rewersy: [
        {
          id: 'rw',
          nazwa: 'Rewers',
          rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
          tlo: '#ffffff',
          wzorTla: { ...wzor, rodzaj: 'kropki' },
          korzen: { id: 'k', typ: 'swobodny', dzieci: [] },
        },
      ],
    };
    const paczka = importujSzablon(eksportujSzablon(p, zasoby, szablon.id).bajty);
    expect(paczka.szablon.wzorTla).toEqual(wzor);
    expect(paczka.rewers?.wzorTla).toEqual({ ...wzor, rodzaj: 'kropki' });
    const projekt = importujProjekt(eksportujProjekt(p, zasoby)).projekt;
    expect(projekt.szablony[0]!.wzorTla).toEqual(wzor);
    expect(projekt.rewersy![0]!.wzorTla?.rodzaj).toBe('kropki');
  });

  it('schemat odrzuca nieznany rodzaj wzoru i zerowy odstęp', () => {
    for (const zly of [
      { ...wzor, rodzaj: 'fale' },
      { ...wzor, odstep: 0 },
    ]) {
      const p = { ...baza, szablony: [{ ...baza.szablony[0]!, wzorTla: zly }] };
      expect(() => przygotujProjekt(JSON.parse(JSON.stringify(p)))).toThrow();
    }
  });
});
