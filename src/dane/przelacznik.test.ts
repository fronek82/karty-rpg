import { describe, expect, it } from 'vitest';
import { kolumnySzablonu } from './edycja';
import { migruj, przygotujProjekt } from './schemat';
import {
  dodajOdmiane,
  duplikujWezel,
  maPolaWPrzelaczniku,
  zawartoscJakoOdmiana,
  kluczeSzablonu,
  opakuj,
  pokazOdmianyZaznaczenia,
  przeniesWezel,
  usunWezly,
  wstawWezel,
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

  it('pusty przełącznik nic nie pokazuje; powtórzona wartość – pierwsza odmiana', () => {
    expect(widoczne(szablon(przelacznik({ dzieci: [] })), { rodzaj: '1' }).w.ostrzezenia).toEqual(
      [],
    );
    const dwa = przelacznik({ dzieci: [ikona('a', 5, 'X'), ikona('b', 5, 'x')] });
    const { ids } = widoczne(szablon(dwa), { rodzaj: 'x' });
    expect(ids).toContain('a');
    expect(ids).not.toContain('b');
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

  it('dwa przełączniki przodu o tej samej nazwie i różnych kluczach – tył bez danych', () => {
    const s = szablon();
    const drugi = przelacznik({ id: 'rodzaj2', przelacznik: { klucz: 'inny' } });
    const przod: Szablon = { ...s, korzen: { ...s.korzen, dzieci: [...s.korzen.dzieci, drugi] } };
    const r = renderujRewers(rewers, ctx, { awers: { szablon: przod, dane: { rodzaj: '2' } } });
    expect(r.wezly.map((w) => w.id)).toContain('t1');
    expect(wspolneKluczeRewersu(przod, rewers).size).toBe(0);
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

  it('podgląd pokazuje odmianę z zaznaczonym elementem (także przy powtórzonej wartości)', () => {
    const s = szablon();
    expect(pokazOdmianyZaznaczenia(s, ['stopka'])).toBe(s);
    const p = pokazOdmianyZaznaczenia(s, ['miejsce']);
    expect(widoczne(p, { rodzaj: '1' }).ids).toContain('miejsce');
    const dwa = szablon(przelacznik({ dzieci: [ikona('a', 5, 'X'), ikona('b', 5, 'X')] }));
    expect(widoczne(pokazOdmianyZaznaczenia(dwa, ['b']), {}).ids).toContain('b');
    // Wejście bez zmian.
    expect((dwa.korzen.dzieci[0] as Kontener).dzieci.map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('kopia, przeniesienie i nowy element nie zasłaniają istniejących odmian', () => {
    const odmiany = (s: Szablon) => {
      const k = znajdzWezel(s, 'rodzaj') as Kontener;
      return k.dzieci.map((_, i) => wartoscOdmiany(k, i));
    };
    // Kopia odmiany „1” dostaje pierwszy wolny numer.
    const k = duplikujWezel(szablon(), 'podejrzany', 'kopia');
    expect(znajdzWezel(k.szablon, k.id)?.odmiana).toBe('2');
    // Po usunięciu środkowej odmiany nowy element nie powtarza „3”.
    const bezSrodka = usunWezly(przeniesWezel(szablon(), 'miejsce', 'rodzaj', 3), ['wskazowka']);
    const zNowym = wstawWezel(bezSrodka, 'rodzaj', ikona('nowy', 5));
    expect(new Set(odmiany(zNowym)).size).toBe(odmiany(zNowym).length);
    // Wyjęcie z przełącznika usuwa wartość odmiany.
    const wyjety = przeniesWezel(szablon(), 'wskazowka', 'korzen', 0);
    expect(znajdzWezel(wyjety, 'wskazowka')?.odmiana).toBeUndefined();
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

describe('cały wiersz jako odmiana', () => {
  /** Wiersz „ikona + ikona” na karcie – jak wiersz z ikoną i tekstem. */
  const wiersz: Kontener = {
    id: 'wiersz',
    nazwa: 'Rodzaj',
    typ: 'wiersz',
    odstep: 2,
    dzieci: [ikona('ludzik', 6), ikona('napis', 10)],
  };
  const sz = szablon(wiersz);

  it('zawartość wiersza staje się jedną odmianą – układ karty bez zmian', () => {
    expect(maPolaWPrzelaczniku(wiersz)).toBe(true);
    const k = zawartoscJakoOdmiana(sz, wiersz, 'Odmiana 1');
    expect(k.dzieci).toHaveLength(1);
    const o = k.dzieci[0] as Kontener;
    expect(o).toMatchObject({ typ: 'wiersz', nazwa: 'Odmiana 1', odmiana: '1', odstep: 2 });
    expect(o.dzieci.map((d) => d.id)).toEqual(['ludzik', 'napis']);
    expect(maPolaWPrzelaczniku(k)).toBe(false);
    const po = szablon({ ...k, przelacznik: { klucz: 'rodzaj' } });
    const pozycje = (x: Szablon) =>
      renderujKarte(x, { dane: {} }, ctx)
        .wezly.filter((w) => w.id === 'ludzik' || w.id === 'napis' || w.id === 'stopka')
        .map(({ id, x: px, y, szer, wys }) => ({ id, px, y, szer, wys }));
    expect(pozycje(po)).toEqual(pozycje(sz));
  });

  it('„Dodaj odmianę” kopiuje cały ostatni wiersz z kolejnym numerem', () => {
    const k = { ...zawartoscJakoOdmiana(sz, wiersz, 'Odmiana 1'), przelacznik: { klucz: 'r' } };
    const s1 = szablon(k);
    const { szablon: s2, id } = dodajOdmiane(s1, 'wiersz', 'Odmiana 2', 'kopia');
    const nowa = znajdzWezel(s2, id) as Kontener;
    expect(nowa).toMatchObject({ nazwa: 'Odmiana 2', odmiana: '2', typ: 'wiersz' });
    expect(nowa.dzieci).toHaveLength(2);
    expect(widoczne(s2, { r: '2' }).ids).toContain(nowa.dzieci[0]!.id);
    expect(widoczne(s2, { r: '2' }).ids).not.toContain('ludzik');
    // Złożenie usuwa nieaktualną odmianę domyślną, zostawia klucz.
    const zDomyslna = zawartoscJakoOdmiana(
      sz,
      { ...wiersz, przelacznik: { klucz: 'r', domyslna: '2' } },
      'Odmiana 1',
    );
    expect(zDomyslna.przelacznik).toEqual({ klucz: 'r' });
    // Pusty przełącznik – pusty kontener.
    const pusty = szablon({ ...wiersz, dzieci: [], przelacznik: {} });
    const p = dodajOdmiane(pusty, 'wiersz', 'Odmiana 1', 'kopia');
    expect(znajdzWezel(p.szablon, p.id)).toMatchObject({ typ: 'wiersz', dzieci: [], odmiana: '1' });
  });

  it('złożona kolumna i swobodny zachowują położenia; kopia w swobodnym leży jak oryginał', () => {
    for (const typ of ['kolumna', 'swobodny'] as const) {
      const k: Kontener = {
        ...wiersz,
        typ,
        dzieci:
          typ === 'swobodny'
            ? [
                { ...ikona('ludzik', 6), pozycja: { x: 2, y: 3 } },
                { ...ikona('napis', 10), pozycja: { x: 12, y: 1 } },
              ]
            : wiersz.dzieci,
      };
      const przed = szablon(k);
      const po = szablon({ ...zawartoscJakoOdmiana(przed, k, 'Odmiana 1'), przelacznik: {} });
      const pozycje = (x: Szablon) =>
        renderujKarte(x, { dane: {} }, ctx)
          .wezly.filter((w) => ['ludzik', 'napis', 'stopka'].includes(w.id))
          .map(({ id, x: px, y }) => ({ id, px, y }));
      expect(pozycje(po)).toEqual(pozycje(przed));
      if (typ === 'swobodny') {
        const d = dodajOdmiane(po, 'wiersz', 'Odmiana 2', 'kopia');
        expect(znajdzWezel(d.szablon, d.id)?.pozycja).toEqual({ x: 0, y: 0 });
      }
    }
  });
});
