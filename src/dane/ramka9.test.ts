import { readFileSync } from 'node:fs';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { beforeAll, describe, expect, it } from 'vitest';
import { WERSJA_SCHEMATU, type DaneZasobow, type OpisObrazu, type Projekt } from '../model/projekt';
import type { Szablon } from '../model/szablon';
import { importujSvg } from '../ozdobniki';
import { pakietMausritter } from '../pakiety/mausritter';
import {
  dodajOzdobnikZPaczki,
  dodajSzablon,
  eksportujOzdobnik,
  eksportujProjekt,
  eksportujSzablon,
  importujProjekt,
  importujOzdobnik,
  importujSzablon,
} from './archiwum';
import {
  dodajElementDoBiblioteki,
  dodajRamke9ZObrazu,
  usunElementZBiblioteki,
  elementyProjektu,
  ramka9Domyslna,
  zasobyObrazowSzablonu,
  zmienElementBiblioteki,
} from './biblioteka';
import { dodajZasoby } from './edycja';
import { obrazyCzarnoBialych } from '../ui/szareObrazy';
import type { ZasobyPakietu } from '../ui/zasoby';
import { projektZPakietu } from './pakiet';
import { migruj, ostrzezeniaProjektu, przygotujProjekt } from './schemat';

const czcionka = async (plik: string) => new Uint8Array(readFileSync(`public/czcionki/${plik}`));
const obraz = async () =>
  new Uint8Array(readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png'));
const PNG = new Uint8Array(readFileSync('testy/zasoby/ramka-testowa.png'));
const opisPng = (id: string): OpisObrazu => ({
  rodzaj: 'obraz',
  id,
  nazwa: `${id}.png`,
  format: 'png',
  szerokosc: 120,
  wysokosc: 120,
});

let baza: Projekt;
let zasoby: DaneZasobow;
beforeAll(async () => {
  ({ projekt: baza, zasoby } = await projektZPakietu(pakietMausritter, czcionka, obraz, 'p1'));
});

/** Projekt z PNG w zasobach, ramką 9-slice z PNG i drugą z SVG oraz szablonem, który ich używa. */
function projektZRamkami(): { p: Projekt; d: DaneZasobow; szablon: Szablon } {
  const w = dodajZasoby(baza, zasoby, [{ opis: opisPng('ramka-testowa'), dane: PNG }]);
  let p = dodajRamke9ZObrazu(w.projekt, 'Ramka PNG', opisPng('ramka-testowa')).projekt;
  const svg = importujSvg(readFileSync('testy/zasoby/gwiazdka.svg', 'utf8'), {
    rodzaj: 'ramka9',
  }).element;
  p = dodajElementDoBiblioteki(p, 'Ramka SVG', {
    ...svg,
    rodzaj: 'ramka9',
    ramka9: ramka9Domyslna({ typ: 'svg' }, svg.szer, svg.wys),
  }).projekt;
  const szablon: Szablon = {
    id: 'z-ramka',
    nazwa: 'Z ramką',
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    ramka: {
      grubosc: 0.3,
      kolor: '#000000',
      ozdoba: { rodzaj: 'ramka9', element: 'wl:Ramka-PNG', grubosc: 2.5 },
    },
    korzen: {
      id: 'korzen',
      typ: 'kolumna',
      dzieci: [
        {
          id: 'panel',
          typ: 'tekst',
          tekst: 'x',
          styl: { czcionka: 'tresc', rozmiar: 3 },
          ozdoba: { rodzaj: 'ramka9', element: 'wl:Ramka-SVG', grubosc: 2, kolor: '#112233' },
        },
      ],
    },
  };
  return { p: { ...p, szablony: [...p.szablony, szablon] }, d: w.dane, szablon };
}

describe('niezależna paczka ozdobnika', () => {
  it('przenosi dokładnie wskazaną ramkę i jej obraz, również przy kolizji identyfikatora', () => {
    const { p, d } = projektZRamkami();
    const bajty = eksportujOzdobnik(p, d, 'wl:Ramka-PNG');
    const paczka = importujOzdobnik(bajty);
    expect(Array.from(paczka.dane.keys())).toEqual(['ramka-testowa']);
    const kolizja = {
      ...baza,
      zasoby: [...baza.zasoby, { ...opisPng('ramka-testowa'), nazwa: 'Inny obraz' }],
    };
    const stareDane = new Map([...zasoby, ['ramka-testowa', PNG]]);
    const wynik = dodajOzdobnikZPaczki(kolizja, stareDane, bajty);
    const zrodlo = elementyProjektu(wynik.projekt)[0]!.ramka9!.zrodlo;
    expect(zrodlo.typ).toBe('obraz');
    if (zrodlo.typ !== 'obraz') throw new Error();
    expect(zrodlo.zasob).not.toBe('ramka-testowa');
    expect(wynik.dane.get(zrodlo.zasob)).toEqual(PNG);
    expect(wynik.projekt.zasoby.find((z) => z.id === 'ramka-testowa')?.nazwa).toBe('Inny obraz');
    expect(kolizja.biblioteka).toBeUndefined();
    expect(importujOzdobnik(eksportujOzdobnik(p, d, 'wl:Ramka-SVG')).dane.size).toBe(0);
  });

  it('odrzuca uszkodzony plik, brak obrazu i nierozpoznaną wersję przed zmianą projektu', () => {
    const { p, d } = projektZRamkami();
    const pliki = unzipSync(eksportujOzdobnik(p, d, 'wl:Ramka-PNG'));
    const wadliwa = { ...pliki };
    const obraz = Object.keys(wadliwa).find((n) => n.startsWith('zasoby/'))!;
    delete wadliwa[obraz];
    const przed = structuredClone(baza);
    expect(() => dodajOzdobnikZPaczki(baza, zasoby, zipSync(wadliwa))).toThrow();
    expect(baza).toEqual(przed);
    expect(() => importujOzdobnik(zipSync({ ...pliki, [obraz]: PNG.subarray(0, 20) }))).toThrow();
    const inneWymiary = PNG.slice();
    new DataView(inneWymiary.buffer).setUint32(16, 121);
    expect(() => importujOzdobnik(zipSync({ ...pliki, [obraz]: inneWymiary }))).toThrow();
    expect(() =>
      importujOzdobnik(zipSync({ ...pliki, [obraz]: Uint8Array.of(255, 216, 255) })),
    ).toThrow();
    const json = JSON.parse(strFromU8(pliki['ozdobnik.json']!)) as { wersja: number };
    json.wersja = 2;
    pliki['ozdobnik.json'] = strToU8(JSON.stringify(json));
    expect(() => importujOzdobnik(zipSync(pliki))).toThrow();
  });

  it('zachowuje bajty potrzebne historii cofania, także przy kolizji 100-znakowego id', () => {
    const id = 'a'.repeat(100);
    const opis = opisPng(id);
    const wynik = dodajRamke9ZObrazu({ ...baza, zasoby: [...baza.zasoby, opis] }, 'Nowa', opis);
    const plik = eksportujOzdobnik(wynik.projekt, new Map([...zasoby, [id, PNG]]), wynik.id);
    const starszeBajty = Uint8Array.of(3, 1, 4);
    // Ten zasób zniknął z dokumentu, ale jego bajty są nadal dostępne dla Cofnij.
    const d = new Map([...zasoby, [id, starszeBajty]]);
    const odczyt = dodajOzdobnikZPaczki(baza, d, plik);
    const zrodlo = elementyProjektu(odczyt.projekt)[0]!.ramka9!.zrodlo;
    expect(zrodlo).toEqual({ typ: 'obraz', zasob: `${'a'.repeat(98)}-2` });
    expect(odczyt.dane.get(id)).toEqual(starszeBajty);
  });
});

describe('schemat 14 i ramka 9-slice', () => {
  it('numer wersji i migracja 13→14 tożsamościowa (projekt i szablon)', () => {
    expect(WERSJA_SCHEMATU).toBeGreaterThanOrEqual(14);
    expect(migruj({ wersja: 13, a: 1 }, 'projekt', 14)).toEqual({ wersja: 14, a: 1 });
    expect(migruj({ wersja: 13, a: 1 }, 'szablon', 14)).toEqual({ wersja: 14, a: 1 });
  });

  it('element z PNG ma domyślne wcięcia po trzeciej części i nie ma konturów', () => {
    const { p } = projektZRamkami();
    const e = elementyProjektu(p).find((x) => x.id === 'wl:Ramka-PNG')!;
    expect(e).toMatchObject({
      rodzaj: 'ramka9',
      szer: 120,
      kontury: [],
      ramka9: {
        zrodlo: { typ: 'obraz', zasob: 'ramka-testowa' },
        wciecia: { gora: 40, prawo: 40, dol: 40, lewo: 40 },
        boki: 'powtarzaj',
        srodek: 'wypelnij',
      },
    });
  });

  it('przygotujProjekt przyjmuje projekt z ramkami; ostrzega o brakującym obrazie', () => {
    const { p } = projektZRamkami();
    expect(() => przygotujProjekt(structuredClone(p))).not.toThrow();
    expect(ostrzezeniaProjektu(p)).toEqual([]);
    const bez = { ...p, zasoby: p.zasoby.filter((z) => z.id !== 'ramka-testowa') };
    expect(ostrzezeniaProjektu(bez).some((o) => o.includes('ramka-testowa'))).toBe(true);
  });

  it('odrzuca: ramka9 bez ustawień, ustawienia przy innym rodzaju, wcięcia poza źródłem, zły id obrazu', () => {
    const { p } = projektZRamkami();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mutuj = (f: (j: any) => void) => {
      const j = JSON.parse(JSON.stringify(p));
      f(j);
      return () => przygotujProjekt(j);
    };
    expect(mutuj((j) => delete j.biblioteka.ozdobniki[0].ramka9)).toThrow();
    expect(mutuj((j) => (j.biblioteka.ozdobniki[0].rodzaj = 'motyw'))).toThrow();
    expect(mutuj((j) => (j.biblioteka.ozdobniki[0].ramka9.wciecia.lewo = 200))).toThrow();
    expect(mutuj((j) => (j.biblioteka.ozdobniki[0].ramka9.wciecia.gora = -1))).toThrow();
    expect(mutuj((j) => (j.biblioteka.ozdobniki[0].ramka9.zrodlo.zasob = '../zly id'))).toThrow();
    expect(mutuj((j) => (j.biblioteka.ozdobniki[0].ramka9.boki = 'inne'))).toThrow();
    expect(mutuj((j) => (j.szablony.at(-1).ramka.ozdoba.grubosc = 0))).toThrow();
    expect(mutuj((j) => (j.szablony.at(-1).ramka.ozdoba.grubosc = 'x'))).toThrow();
  });

  it('zmiana rodzaju SVG na ramkę dodaje wcięcia; z powrotem je usuwa; ramka z PNG zostaje ramką', () => {
    let p = dodajElementDoBiblioteki(
      baza,
      'G',
      importujSvg(readFileSync('testy/zasoby/gwiazdka.svg', 'utf8')).element,
    ).projekt;
    p = zmienElementBiblioteki(p, 'wl:G', { rodzaj: 'ramka9' });
    expect(elementyProjektu(p)[0]!.ramka9).toMatchObject({ zrodlo: { typ: 'svg' } });
    expect(() => przygotujProjekt(structuredClone(p))).not.toThrow();
    p = zmienElementBiblioteki(p, 'wl:G', { rodzaj: 'motyw' });
    expect(elementyProjektu(p)[0]!.ramka9).toBeUndefined();
    const { p: z } = projektZRamkami();
    const po = zmienElementBiblioteki(z, 'wl:Ramka-PNG', { rodzaj: 'motyw' });
    expect(elementyProjektu(po).find((e) => e.id === 'wl:Ramka-PNG')!.rodzaj).toBe('ramka9');
  });

  it('wcięcia zapisane przy zmianie są przycinane do źródła', () => {
    const { p } = projektZRamkami();
    const po = zmienElementBiblioteki(p, 'wl:Ramka-PNG', {
      ramka9: {
        ...elementyProjektu(p)[0]!.ramka9!,
        wciecia: { gora: 100, prawo: 90, dol: 90, lewo: 90 },
      },
    });
    expect(elementyProjektu(po)[0]!.ramka9!.wciecia).toEqual({
      gora: 100,
      prawo: 30,
      dol: 20,
      lewo: 90,
    });
  });
});

describe('eksport i import ramek 9-slice', () => {
  it('zasoby obrazów szablonu obejmują PNG ramki', () => {
    const { p, szablon } = projektZRamkami();
    expect(zasobyObrazowSzablonu(szablon, elementyProjektu(p))).toEqual(['ramka-testowa']);
    expect(zasobyObrazowSzablonu(szablon, [])).toEqual([]);
  });

  it('round-trip projektu zachowuje ramki i obraz', () => {
    const { p, d } = projektZRamkami();
    const w = importujProjekt(eksportujProjekt(p, d));
    expect(w.projekt).toEqual(p);
    expect(w.zasoby.get('ramka-testowa')).toEqual(PNG);
  });

  it('plik szablonu niesie ramki i ich obraz; import do czystego projektu je odtwarza', () => {
    const { p, d, szablon } = projektZRamkami();
    const { bajty } = eksportujSzablon(p, d, szablon.id);
    const pliki = unzipSync(bajty);
    expect(Object.keys(pliki).some((n) => n.startsWith('zasoby/'))).toBe(true);
    const paczka = importujSzablon(bajty);
    expect(paczka.biblioteka!.map((e) => e.id).sort()).toEqual(['wl:Ramka-PNG', 'wl:Ramka-SVG']);
    const w = dodajSzablon(baza, zasoby, paczka);
    expect(w.projekt.zasoby.some((z) => z.id === 'ramka-testowa')).toBe(true);
    expect(w.zasoby.get('ramka-testowa')).toEqual(PNG);
    expect(ostrzezeniaProjektu(w.projekt)).toEqual([]);
  });

  it('kolizja id obrazu: inny obraz o tym samym id – nowe id i przepisany element, bez kolizji', () => {
    const { p, d, szablon } = projektZRamkami();
    const paczka = importujSzablon(eksportujSzablon(p, d, szablon.id).bajty);
    // Projekt docelowy ma INNY obraz pod id „ramka-testowa”.
    const inny = new Uint8Array(readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png'));
    const cel = dodajZasoby(baza, zasoby, [{ opis: opisPng('ramka-testowa'), dane: inny }]);
    const w = dodajSzablon(cel.projekt, cel.dane, paczka);
    const ids = w.projekt.zasoby.filter((z) => z.rodzaj === 'obraz').map((z) => z.id);
    const nowyId = ids.find((id) => id.startsWith('ramka-testowa') && id !== 'ramka-testowa')!;
    expect(nowyId).toBeDefined();
    expect(w.zasoby.get(nowyId)).toEqual(PNG);
    expect(w.zasoby.get('ramka-testowa')).toEqual(inny);
    const e = elementyProjektu(w.projekt).find((x) => x.id === 'wl:Ramka-PNG')!;
    expect(e.ramka9!.zrodlo).toEqual({ typ: 'obraz', zasob: nowyId });
    expect(ostrzezeniaProjektu(w.projekt)).toEqual([]);
  });

  it('import ponowny tego samego szablonu współdzieli obraz i element', () => {
    const { p, d, szablon } = projektZRamkami();
    const paczka = importujSzablon(eksportujSzablon(p, d, szablon.id).bajty);
    const w = dodajSzablon(p, d, paczka);
    expect(
      w.projekt.zasoby.filter((z) => z.rodzaj === 'obraz' && z.id.startsWith('ramka')),
    ).toHaveLength(1);
    expect(elementyProjektu(w.projekt)).toHaveLength(2);
  });

  it('uszkodzone ustawienia w pliku szablonu są odrzucane', () => {
    const { p, d, szablon } = projektZRamkami();
    const pliki = unzipSync(eksportujSzablon(p, d, szablon.id).bajty);
    const j = JSON.parse(strFromU8(pliki['szablon.json']!));
    j.biblioteka[0].ramka9.wciecia.lewo = 'x';
    expect(() =>
      importujSzablon(zipSync({ ...pliki, 'szablon.json': strToU8(JSON.stringify(j)) })),
    ).toThrow();
  });
});

describe('ramka 9-slice: czarno-biały, usuwanie, walidacja', () => {
  it('obrazyCzarnoBialych obejmuje PNG ramki użytej w szablonie karty arkusza czarno-białego', () => {
    const { p, szablon } = projektZRamkami();
    const arkusz = {
      ...p.arkusze[0]!,
      taliaId: 'tt',
      ustawienia: { ...p.arkusze[0]!.ustawienia, czarnoBialy: true },
    };
    const talie = [
      { id: 'tt', nazwa: 'T', karty: [{ id: 'k', szablonId: szablon.id, dane: {}, ilosc: 1 }] },
    ];
    const z = {
      obrazy: new Map(),
      szablony: new Map([[szablon.id, szablon]]),
      elementy: elementyProjektu(p),
    } as unknown as ZasobyPakietu;
    expect([...obrazyCzarnoBialych({ arkusze: [arkusz], talie }, z)]).toEqual(['ramka-testowa']);
    // Bez elementów w zasobach – brak obrazu ramki (szablon sam go nie wskazuje).
    expect(
      obrazyCzarnoBialych({ arkusze: [arkusz], talie }, { ...z, elementy: [] } as ZasobyPakietu)
        .size,
    ).toBe(0);
  });

  it('usunięcie elementu zostawia obraz w zasobach (decyzja B86), projekt dalej się waliduje', () => {
    const { p } = projektZRamkami();
    const po = usunElementZBiblioteki(p, 'wl:Ramka-PNG');
    expect(po.zasoby.some((z) => z.id === 'ramka-testowa')).toBe(true);
    expect(elementyProjektu(po).map((e) => e.id)).toEqual(['wl:Ramka-SVG']);
    expect(() => przygotujProjekt(structuredClone(po))).not.toThrow();
    // Odwołanie w szablonie zostaje – ostrzeżenie o nieznanym elemencie.
    expect(ostrzezeniaProjektu(po).some((o) => o.includes('wl:Ramka-PNG'))).toBe(true);
  });

  it('zod: ramka z obrazu nie może mieć konturów', () => {
    const { p } = projektZRamkami();
    const j = JSON.parse(JSON.stringify(p));
    j.biblioteka.ozdobniki[0].kontury = [
      { kontur: [['M', 0, 0], ['L', 1, 1], ['Z']], wypelnienie: 'kolor' },
    ];
    expect(() => przygotujProjekt(j)).toThrow();
  });

  it('ostrzeżenia: wymiary elementu niezgodne z obrazem i źródło SVG bez rysunku', () => {
    const { p } = projektZRamkami();
    const inne = {
      ...p,
      zasoby: p.zasoby.map((z) => (z.id === 'ramka-testowa' ? { ...z, szerokosc: 200 } : z)),
    } as Projekt;
    expect(ostrzezeniaProjektu(inne).some((o) => o.includes('200'))).toBe(true);
    const pusty = {
      ...p,
      biblioteka: {
        ozdobniki: elementyProjektu(p).map((e) =>
          e.id === 'wl:Ramka-SVG' ? { ...e, kontury: [] } : e,
        ),
      },
    } as Projekt;
    expect(ostrzezeniaProjektu(pusty).some((o) => o.includes('bez rysunku'))).toBe(true);
  });

  it('importujSzablon odrzuca ramkę z PNG bez obrazu w paczce', () => {
    const { p, d, szablon } = projektZRamkami();
    const pliki = unzipSync(eksportujSzablon(p, d, szablon.id).bajty);
    const j = JSON.parse(strFromU8(pliki['szablon.json']!));
    j.zasoby = [];
    const bez = Object.fromEntries(Object.entries(pliki).filter(([n]) => !n.startsWith('zasoby/')));
    expect(() =>
      importujSzablon(zipSync({ ...bez, 'szablon.json': strToU8(JSON.stringify(j)) })),
    ).toThrow(/ramka-testowa/);
  });
});
