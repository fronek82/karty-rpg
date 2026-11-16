import { describe, expect, it } from 'vitest';
import { pt } from '../model/jednostki';
import type { StylTekstu } from '../model/szablon';
import { tekstNaScene, ulozDopasowany, ulozTekst } from './tekst';
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
