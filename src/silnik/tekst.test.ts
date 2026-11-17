import { describe, expect, it, vi } from 'vitest';
import { pt } from '../model/jednostki';
import type { StylTekstu } from '../model/szablon';
import {
  parsujFormatowanie,
  SKALA_KAPITALIKOW,
  tekstNaScene,
  ulozDopasowany,
  ulozTekst,
} from './tekst';
import { rejestrTestowy } from './__testy__/pomoc';

const czcionki = rejestrTestowy();
const styl: StylTekstu = { czcionka: 'tresc', rozmiar: pt(10) };
const DLUGI = 'Mysz przemierza ciemne korytarze, niosąc pochodnię i odrobinę sera na drogę.';

describe('ulozTekst', () => {
  it('bez limitu szerokości daje jeden wiersz', () => {
    const u = ulozTekst([{ tekst: DLUGI, styl }], undefined, czcionki);
    expect(u.wiersze).toHaveLength(1);
    expect(u.wysokosc).toBeCloseTo(pt(10) * 1.2, 6);
  });

  it('łamie na spacjach i nie przekracza szerokości', () => {
    const u = ulozTekst([{ tekst: DLUGI, styl }], 30, czcionki);
    expect(u.wiersze.length).toBeGreaterThan(2);
    for (const w of u.wiersze) expect(w.szerokosc).toBeLessThanOrEqual(30 + 1e-6);
    expect(u.zaSzeroki).toBe(false);
  });

  it('zgłasza słowo szersze niż ramka', () => {
    expect(ulozTekst([{ tekst: 'Najdłuższewyrazisko', styl }], 5, czcionki).zaSzeroki).toBe(true);
  });

  it('nowy wiersz w danych zaczyna akapit', () => {
    expect(ulozTekst([{ tekst: 'raz\ndwa', styl }], undefined, czcionki).wiersze).toHaveLength(2);
  });

  it('łączy style w jednym wierszu (etykieta przed wartością)', () => {
    const u = ulozTekst(
      [
        { tekst: 'Usunięcie: ', styl: { ...styl, wariant: 'pogrubiony' } },
        { tekst: 'odpoczynek', styl },
      ],
      undefined,
      czcionki,
    );
    expect(u.wiersze).toHaveLength(1);
    const czcionkiWWierszu = new Set(u.wiersze[0]!.glify.map((g) => g.czcionka.id));
    expect(czcionkiWWierszu).toEqual(new Set(['EBGaramond-Bold.ttf', 'EBGaramond-Regular.ttf']));
  });

  it('wielkie litery i odstęp liter zmieniają szerokość', () => {
    const zwykly = ulozTekst([{ tekst: 'mysz', styl }], undefined, czcionki).szerokosc;
    const wielkie = ulozTekst(
      [{ tekst: 'mysz', styl: { ...styl, wielkieLitery: true } }],
      undefined,
      czcionki,
    );
    const rozstrzelony = ulozTekst(
      [{ tekst: 'mysz', styl: { ...styl, odstepLiter: 1 } }],
      undefined,
      czcionki,
    );
    expect(wielkie.szerokosc).toBeGreaterThan(zwykly);
    expect(rozstrzelony.szerokosc).toBeCloseTo(zwykly + 3, 6);
  });
});

describe('ulozDopasowany', () => {
  it('zmniejsza tekst, aż się zmieści', () => {
    const u = ulozDopasowany([{ tekst: DLUGI, styl }], 40, 8, czcionki, true, 0.5);
    expect(u.przepelnienie).toBe(false);
    expect(u.wysokosc).toBeLessThanOrEqual(8);
  });

  it('nie schodzi poniżej minimum i zgłasza przepełnienie', () => {
    const u = ulozDopasowany([{ tekst: DLUGI, styl }], 20, 3, czcionki, true, 0.9);
    expect(u.przepelnienie).toBe(true);
  });
});

describe('tekstNaScene', () => {
  it('wyrównuje do prawej i zapisuje każdy glif raz w słowniku', () => {
    const u = ulozTekst([{ tekst: 'aaa', styl }], undefined, czcionki);
    const slownik = {};
    const [el] = tekstNaScene(u, { x: 0, y: 0, szer: 50, wys: 10 }, 'prawo', 'poczatek', slownik);
    expect(Object.keys(slownik)).toHaveLength(1);
    expect(el?.typ).toBe('tekst');
    if (el?.typ !== 'tekst') return;
    expect(el.glify).toHaveLength(3);
    expect(el.glify[0]!.x).toBeCloseTo(50 - u.szerokosc, 6);
  });
});

describe('formatowanie w treści', () => {
  const w = (t: string, st: StylTekstu = styl) =>
    parsujFormatowanie(t, st).map((f) => [f.tekst, f.styl.wariant ?? 'normalny']);

  it('**pogrubienie**, *kursywa*, ***oba***', () => {
    expect(w('a **b** c *d* ***e***')).toEqual([
      ['a ', 'normalny'],
      ['b', 'pogrubiony'],
      [' c ', 'normalny'],
      ['d', 'kursywa'],
      [' ', 'normalny'],
      ['e', 'pogrubiona-kursywa'],
    ]);
  });

  it('znacznik bez pary i \\* zostają zwykłym tekstem', () => {
    expect(w('5 * 3 = 15')).toEqual([['5 * 3 = 15', 'normalny']]);
    expect(w('\\*gwiazdka\\* **x')).toEqual([['*gwiazdka* **x', 'normalny']]);
  });

  it('łączy się z wariantem stylu i zachowuje nowe wiersze', () => {
    expect(w('**Uwaga:** tekst\n*dalej*', { ...styl, wariant: 'kursywa' })).toEqual([
      ['Uwaga:', 'pogrubiona-kursywa'],
      [' tekst\ndalej', 'kursywa'], // *…* w kursywie zostaje kursywą
    ]);
  });
});

describe('akapity, justowanie, kapitaliki', () => {
  const xGlifow = (u: ReturnType<typeof ulozTekst>, szer: number, wyr: 'lewo' | 'justuj') => {
    const sl = {};
    const el = tekstNaScene(u, { x: 0, y: 0, szer, wys: 100 }, wyr, 'poczatek', sl);
    return el.flatMap((e) => (e.typ === 'tekst' ? e.glify : []));
  };

  it('justuj: wiersze (bez ostatniego w akapicie) kończą się przy prawej krawędzi', () => {
    const u = ulozTekst([{ tekst: DLUGI, styl }], 30, czcionki);
    const lewo = xGlifow(u, 30, 'lewo');
    const just = xGlifow(u, 30, 'justuj');
    expect(u.wiersze.at(-1)!.ostatni).toBe(true);
    expect(u.wiersze[0]!.ostatni).toBe(false);
    // Pierwszy glif bez zmian, ostatni glif pierwszego wiersza przesunięty w prawo.
    const n0 = u.wiersze[0]!.glify.length;
    expect(just[0]!.x).toBeCloseTo(lewo[0]!.x, 6);
    expect(just[n0 - 1]!.x).toBeGreaterThan(lewo[n0 - 1]!.x + 0.1);
    // Ostatni wiersz akapitu – jak do lewej.
    expect(just.at(-1)!.x).toBeCloseTo(lewo.at(-1)!.x, 6);
  });

  it('wcięcie pierwszego wiersza i odstęp po akapicie', () => {
    const zwykly = ulozTekst([{ tekst: 'raz\ndwa', styl }], undefined, czcionki);
    const st = { ...styl, wciecie: 3, odstepAkapitow: 2 };
    const u = ulozTekst([{ tekst: 'raz\ndwa', styl: st }], undefined, czcionki);
    expect(u.wiersze[0]!.glify[0]!.x).toBeCloseTo(zwykly.wiersze[0]!.glify[0]!.x + 3, 6);
    expect(u.wiersze[0]!.szerokosc).toBeCloseTo(zwykly.wiersze[0]!.szerokosc + 3, 6);
    expect(u.wysokosc).toBeCloseTo(zwykly.wysokosc + 2, 6); // tylko między akapitami
  });

  it('akapit z samą etykietą nie dostaje wcięcia ani odstępu', () => {
    const st = { ...styl, wciecie: 3, odstepAkapitow: 2 };
    const u = ulozTekst(
      [
        { tekst: 'ETYKIETA\n', styl: st, etykieta: true },
        { tekst: 'wartość', styl: st },
      ],
      undefined,
      czcionki,
    );
    const zwykly = ulozTekst([{ tekst: 'ETYKIETA', styl }], undefined, czcionki);
    expect(u.wiersze[0]!.glify[0]!.x).toBeCloseTo(zwykly.wiersze[0]!.glify[0]!.x, 6);
    expect(u.wiersze[0]!.wysokosc).toBeCloseTo(zwykly.wiersze[0]!.wysokosc, 6);
    expect(u.wiersze[1]!.glify[0]!.x).toBeGreaterThan(3 - 1e-6);
  });

  it('kapitaliki bez cechy smcp: małe litery jako mniejsze wersaliki', () => {
    const u = ulozTekst(
      [{ tekst: 'Ab', styl: { ...styl, kapitaliki: true } }],
      undefined,
      czcionki,
    );
    const [a, b] = u.wiersze[0]!.glify;
    expect(b!.skala).toBeCloseTo(a!.skala * SKALA_KAPITALIKOW, 6);
    const B = ulozTekst([{ tekst: 'B', styl }], undefined, czcionki).wiersze[0]!.glify[0]!;
    expect(b!.id).toBe(B.id); // „b” zamienione na „B”
  });

  it('kapitaliki z cechą smcp: kształtowanie z cechą, bez zmiany rozmiaru', () => {
    const cz = czcionki.pobierz('tresc');
    const ma = vi.spyOn(cz, 'maCeche').mockReturnValue(true);
    const uloz = vi.spyOn(cz, 'uloz');
    try {
      ulozTekst(
        [{ tekst: 'Kapitaliki', styl: { ...styl, kapitaliki: true } }],
        undefined,
        czcionki,
      );
      expect(uloz).toHaveBeenCalledWith('Kapitaliki', ['smcp']);
    } finally {
      ma.mockRestore();
      uloz.mockRestore();
    }
  });
});
