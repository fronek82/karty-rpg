import { describe, expect, it } from 'vitest';
import { kolumnySzablonu } from './edycja';
import { migruj, przygotujProjekt } from './schemat';
import {
  duplikujWezel,
  kluczeSzablonu,
  opakuj,
  pokazOdmianyZaznaczenia,
  znajdzWezel,
} from './szablon';
import { WERSJA_SCHEMATU, type Projekt } from '../model/projekt';
import {
  type Kontener,
  type PoleIkona,
  type Rewers,
  type Szablon,
  wartoscOdmiany,
  wybranaOdmiana,
} from '../model/szablon';
import { renderujKarte, renderujRewers, wspolneKluczeRewersu } from '../silnik/karta';
import { rejestrTestowy } from '../silnik/__testy__/pomoc';

const ctx = { czcionki: rejestrTestowy(), obraz: () => undefined };

const ikona = (id: string, rozmiar: number, odmiana?: string): PoleIkona => ({
  id,
  typ: 'ikona',
  ikona: 'gwiazdka',
  rozmiar,
  ...(odmiana !== undefined ? { odmiana } : {}),
});

/** Kolumna: przełącznik „Rodzaj” (3 odmiany różnej wysokości), pod nim stopka. */
const przelacznik = (zmiany: Partial<Kontener> = {}): Kontener => ({
  id: 'rodzaj',
  nazwa: 'Rodzaj',
  typ: 'kolumna',
  przelacznik: { klucz: 'rodzaj' },
  dzieci: [ikona('podejrzany', 10, '1'), ikona('wskazowka', 20, 'Wskazówka'), ikona('miejsce', 5)],
  ...zmiany,
});

const szablon = (p: Kontener = przelacznik()): Szablon => ({
  id: 's',
  nazwa: 'Karta',
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
  korzen: { id: 'korzen', typ: 'kolumna', dzieci: [p, ikona('stopka', 4)] },
});

const widoczne = (s: Szablon, dane: Record<string, string>) => {
  const w = renderujKarte(s, { dane }, ctx);
  return { ids: w.wezly.map((x) => x.id), w };
};

describe('wybranaOdmiana', () => {
  const k = przelacznik();
  it('dopasowuje wartość bez wielkości liter i spacji; puste – numer pozycji', () => {
    expect(wartoscOdmiany(k, 2)).toBe('3');
    expect(wybranaOdmiana(k, ' wskazówka ').wezel?.id).toBe('wskazowka');
    expect(wybranaOdmiana(k, '3').wezel?.id).toBe('miejsce');
    expect(wybranaOdmiana(k, '1')).toEqual({ wezel: k.dzieci[0], nieznana: false });
  });
  it('bez wartości – odmiana domyślna, potem pierwsza; nieznana wartość jest zgłaszana', () => {
    expect(wybranaOdmiana(k, undefined)).toEqual({ wezel: k.dzieci[0], nieznana: false });
    const zDomyslna = przelacznik({ przelacznik: { klucz: 'rodzaj', domyslna: '3' } });
    expect(wybranaOdmiana(zDomyslna, '').wezel?.id).toBe('miejsce');
    expect(wybranaOdmiana(zDomyslna, 'xyz')).toEqual({
      wezel: zDomyslna.dzieci[2],
      nieznana: true,
    });
  });
});

describe('renderujKarte z przełącznikiem odmian', () => {
  it('układa tylko wybraną odmianę – pozostałe nie zajmują miejsca', () => {
    const s = szablon();
    const a = widoczne(s, { rodzaj: '1' });
    expect(a.ids).toContain('podejrzany');
    expect(a.ids).not.toContain('wskazowka');
    expect(a.ids).not.toContain('miejsce');
    const b = widoczne(s, { rodzaj: 'Wskazówka' });
    expect(b.ids).toContain('wskazowka');
    expect(b.ids).not.toContain('podejrzany');
    const stopka = (x: typeof a) => x.w.wezly.find((w) => w.id === 'stopka')!.y;
    // Stopka leży tuż pod widoczną odmianą (10 mm albo 20 mm).
    expect(stopka(b) - stopka(a)).toBeCloseTo(10);
    expect(a.w.ostrzezenia).toEqual([]);
  });

  it('nieznana wartość: odmiana domyślna i ostrzeżenie', () => {
    const { ids, w } = widoczne(szablon(), { rodzaj: 'Miejsce zbrodni' });
    expect(ids).toContain('podejrzany');
    expect(w.ostrzezenia).toContainEqual({
      pole: 'Rodzaj',
      komunikat: 'nieznana-odmiana',
      szczegoly: 'Miejsce zbrodni',
    });
  });

  it('przełącznik w ukrytej odmianie nie daje ostrzeżeń', () => {
    const wewn = przelacznik({ id: 'wewn', nazwa: 'Wewn', przelacznik: { klucz: 'inny' } });
    const zew = przelacznik({ dzieci: [ikona('a', 5), wewn] });
    const { w } = widoczne(szablon(zew), { rodzaj: '1', inny: '?' });
    expect(w.ostrzezenia).toEqual([]);
  });
});

describe('przełącznik na tyle karty', () => {
  const rewers: Rewers = {
    id: 'r',
    nazwa: 'Tył',
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    korzen: {
      id: 'tyl',
      typ: 'swobodny',
      dzieci: [
        {
          ...przelacznik({ id: 'rodzaj-tyl', nazwa: 'rodzaj', przelacznik: {} }),
          dzieci: [ikona('t1', 10), ikona('t2', 10)],
        },
      ],
    },
  };
  const ids = (dane: Record<string, string>) =>
    renderujRewers(rewers, ctx, { awers: { szablon: szablon(), dane } }).wezly.map((w) => w.id);

  it('przełącznik o tej samej nazwie bierze wartość z danych karty przodu', () => {
    expect(ids({ rodzaj: '2' })).toContain('t2');
    expect(ids({ rodzaj: '2' })).not.toContain('t1');
    expect(ids({})).toContain('t1');
    expect(wspolneKluczeRewersu(szablon(), rewers)).toEqual(new Set(['rodzaj']));
  });
});

describe('dane szablonu z przełącznikiem', () => {
  it('kolumna danych z listą odmian i klucz w kluczach szablonu', () => {
    const s = szablon();
    expect(kolumnySzablonu(s)).toContainEqual({
      klucz: 'rodzaj',
      nazwa: 'Rodzaj',
      rodzaj: 'pole',
      opcje: [
        { wartosc: '1', nazwa: '' },
        { wartosc: 'Wskazówka', nazwa: '' },
        { wartosc: '3', nazwa: '' },
      ],
    });
    expect(kluczeSzablonu(s).has('rodzaj')).toBe(true);
  });

  it('kopia przełącznika dostaje nowy klucz; opakowanie odmiany zachowuje jej wartość', () => {
    const { szablon: s, id } = duplikujWezel(szablon(), 'rodzaj', 'kopia');
    const kopia = znajdzWezel(s, id) as Kontener;
    expect(kopia.przelacznik?.klucz).toBe('rodzaj_kopia');
    const o = opakuj(szablon(), ['wskazowka'], 'wiersz', 'Wiersz');
    expect(znajdzWezel(o.szablon, o.id)?.odmiana).toBe('Wskazówka');
  });

  it('podgląd pokazuje odmianę z zaznaczonym elementem', () => {
    const s = szablon();
    expect(pokazOdmianyZaznaczenia(s, ['stopka'])).toBe(s);
    const p = pokazOdmianyZaznaczenia(s, ['miejsce']);
    expect(widoczne(p, { rodzaj: '1' }).ids).toContain('miejsce');
  });

  it('schemat przyjmuje przełącznik, a migracja 33→34 nie zmienia danych', () => {
    const p: Projekt = {
      wersja: WERSJA_SCHEMATU,
      id: 'p',
      nazwa: 'P',
      utworzono: '2026-01-01T00:00:00.000Z',
      zmieniono: '2026-01-01T00:00:00.000Z',
      role: {},
      zasoby: [],
      szablony: [szablon()],
      talie: [],
      arkusze: [],
    };
    expect(przygotujProjekt(p).szablony[0]!.korzen.dzieci[0]).toEqual(przelacznik());
    const stary = { ...p, wersja: 33 };
    expect(migruj(stary)).toEqual({ ...stary, wersja: WERSJA_SCHEMATU });
  });
});
