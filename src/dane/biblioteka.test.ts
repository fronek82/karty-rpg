/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DaneZasobow, Projekt } from '../model/projekt';
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
    expect(migruj({ wersja: 12, a: 1 }, 'projekt')).toEqual({ wersja: 13, a: 1 });
    expect(migruj({ wersja: 12, a: 1 }, 'szablon')).toEqual({ wersja: 13, a: 1 });
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
