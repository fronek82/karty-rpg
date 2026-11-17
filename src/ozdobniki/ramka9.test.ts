import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { scenyDoPdf } from '../druk/pdf';
import type { OzdobaRamka9, Szablon } from '../model/szablon';
import { rejestrTestowy } from '../silnik/__testy__/pomoc';
import { renderujKarte } from '../silnik/karta';
import { scenaDoSvg } from '../silnik/svg';
import { tekstOstrzezenia } from '../ui/ostrzezenia';
import {
  NAKLADKA_KAWALKOW,
  dpiRogow,
  kawalkiRamki9,
  podzialBoku,
  przytnijWciecia,
  ramka9ZElementu,
  type ElementOzdobny,
  type UstawieniaRamki9,
} from '.';

const WCIECIA = { gora: 30, prawo: 30, dol: 30, lewo: 30 };
const ust = (z: Partial<UstawieniaRamki9> = {}) => ({
  wciecia: WCIECIA,
  boki: 'powtarzaj' as const,
  srodek: 'wypelnij' as const,
  ...z,
});
const OBSZAR = { x: 0, y: 0, szer: 63, wys: 88 };

/** Pole kawałków nie może mieć dziur: suma pól celów = pole obszaru (przy środku „wypełnij”). */
const pole = (k: { cel: { szer: number; wys: number } }[]) =>
  k.reduce((s, x) => s + x.cel.szer * x.cel.wys, 0);

describe('geometria 9-slice', () => {
  it('wcięcia przycinane do źródła', () => {
    expect(przytnijWciecia({ gora: -3, prawo: 200, dol: 80, lewo: 90 }, 100, 100)).toEqual({
      gora: 0,
      prawo: 10,
      dol: 80,
      lewo: 90,
    });
  });

  it('podział boku: rozciągnij = 1 kawałek, powtarzaj = całkowita liczba równych', () => {
    expect(podzialBoku(50, 8, 'rozciagnij')).toEqual({ n: 1, krok: 50 });
    const p = podzialBoku(50, 8, 'powtarzaj');
    expect(p.n).toBe(6);
    expect(p.krok).toBeCloseTo(50 / 6, 10);
    expect(podzialBoku(3, 8, 'powtarzaj').n).toBe(1);
    expect(podzialBoku(0, 8, 'powtarzaj').n).toBe(0);
  });

  for (const [szer, wys, grubosc] of [
    [63, 88, 2.5],
    [88, 63, 4],
    [50, 18, 3],
    [20, 20, 6],
  ] as const) {
    it(`obszar ${szer}×${wys}, grubość ${grubosc}: rogi 1:1, brak dziur, rogi na wierzchu`, () => {
      const g = kawalkiRamki9(ust(), 120, 120, { x: 0, y: 0, szer, wys }, grubosc);
      expect(g.skala).toBeCloseTo(grubosc / 30, 10);
      const rogi = g.kawalki.filter((k) => k.rola === 'naroznik');
      expect(rogi).toHaveLength(4);
      for (const r of rogi) {
        // Rogi skalowane jednakowo w obu osiach – bez zniekształceń.
        expect(r.cel.szer / r.zrodlo.szer).toBeCloseTo(g.skala, 10);
        expect(r.cel.wys / r.zrodlo.wys).toBeCloseTo(g.skala, 10);
      }
      expect(pole(g.kawalki)).toBeCloseTo(szer * wys, 6);
      // Kolejność: środek, boki, rogi.
      const role = g.kawalki.map((k) => k.rola);
      expect(role[0]).toBe('srodek');
      expect(role.slice(-4)).toEqual(['naroznik', 'naroznik', 'naroznik', 'naroznik']);
    });
  }

  it('powtarzanie równo: kawalki boku mają równą szerokość i wypełniają bok bez szczelin', () => {
    const g = kawalkiRamki9(ust(), 120, 120, OBSZAR, 2.5);
    const gora = g.kawalki.filter((k) => k.rola === 'gora').sort((a, b) => a.cel.x - b.cel.x);
    // Bok między rogami: 63 − 2·2,5 = 58 mm, kafelek naturalny 60 · (2,5/30) = 5 mm → 12 kawałków.
    expect(gora).toHaveLength(12);
    const krok = 58 / 12;
    gora.forEach((k, i) => {
      expect(k.cel.szer).toBeCloseTo(krok, 10);
      expect(k.cel.x).toBeCloseTo(2.5 + i * krok, 10);
    });
    const ostatni = gora[11]!;
    expect(ostatni.cel.x + ostatni.cel.szer).toBeCloseTo(63 - 2.5, 10);
  });

  it('rozciągnij: po jednym kawałku na bok', () => {
    const g = kawalkiRamki9(ust({ boki: 'rozciagnij' }), 120, 120, OBSZAR, 2.5);
    for (const rola of ['gora', 'prawy', 'dol', 'lewy', 'srodek'] as const)
      expect(g.kawalki.filter((k) => k.rola === rola)).toHaveLength(1);
  });

  it('środek „pomiń”: brak kawałka środkowego, reszta bez zmian', () => {
    const a = kawalkiRamki9(ust(), 120, 120, OBSZAR, 2.5);
    const b = kawalkiRamki9(ust({ srodek: 'pomin' }), 120, 120, OBSZAR, 2.5);
    expect(b.kawalki.some((k) => k.rola === 'srodek')).toBe(false);
    expect(b.kawalki).toHaveLength(a.kawalki.length - 1);
  });

  it('nakładanie: 0,05 mm między sąsiadami, zero od strony zewnętrznej i pustego środka', () => {
    const g = kawalkiRamki9(ust({ srodek: 'pomin' }), 120, 120, OBSZAR, 2.5);
    const rog = g.kawalki.find((k) => k.rola === 'naroznik' && k.cel.x === 0 && k.cel.y === 0)!;
    // Lewy górny róg: zewnątrz bez zakładki, w prawo i w dół o połowę zakładki.
    expect(rog.przyciecie.x).toBe(0);
    expect(rog.przyciecie.y).toBe(0);
    expect(rog.przyciecie.szer).toBeCloseTo(rog.cel.szer + NAKLADKA_KAWALKOW / 2, 10);
    // Sąsiad (pierwszy kafelek górnego boku) zachodzi na róg o dokładnie 0,05 mm łącznie.
    const bok = g.kawalki.find(
      (k) => k.rola === 'gora' && Math.abs(k.cel.x - rog.cel.szer) < 1e-9,
    )!;
    const zachod = rog.przyciecie.x + rog.przyciecie.szer - bok.przyciecie.x;
    expect(zachod).toBeCloseTo(NAKLADKA_KAWALKOW, 10);
    // Strona boku zwrócona do pustego środka nie jest poszerzana.
    expect(bok.przyciecie.y + bok.przyciecie.wys).toBeCloseTo(bok.cel.y + bok.cel.wys, 10);
  });

  it('rogi większe niż obszar: skala zmniejszona, nic nie wychodzi poza obszar', () => {
    const g = kawalkiRamki9(ust(), 120, 120, { x: 5, y: 7, szer: 10, wys: 10 }, 20);
    expect(g.skala).toBeCloseTo(10 / 60, 10);
    for (const k of g.kawalki) {
      expect(k.cel.x).toBeGreaterThanOrEqual(5 - 1e-9);
      expect(k.cel.x + k.cel.szer).toBeLessThanOrEqual(15 + 1e-9);
      expect(k.cel.y + k.cel.wys).toBeLessThanOrEqual(17 + 1e-9);
    }
  });

  it('różne wcięcia: najgrubszy bok ma zadaną grubość, boki cieńsze proporcjonalnie', () => {
    const g = kawalkiRamki9(
      ust({ wciecia: { gora: 10, prawo: 40, dol: 20, lewo: 40 } }),
      100,
      80,
      { x: 0, y: 0, szer: 60, wys: 60 },
      4,
    );
    expect(g.skala).toBeCloseTo(0.1, 10);
    const gora = g.kawalki.find((k) => k.rola === 'gora')!;
    const lewy = g.kawalki.find((k) => k.rola === 'lewy')!;
    expect(gora.cel.wys).toBeCloseTo(1, 10);
    expect(lewy.cel.szer).toBeCloseTo(4, 10);
    expect(pole(g.kawalki)).toBeCloseTo(3600, 6);
  });

  it('źródło nieprostokątne i zerowe wcięcia nie psują geometrii', () => {
    expect(kawalkiRamki9(ust(), 0, 10, OBSZAR, 2).kawalki).toEqual([]);
    const g = kawalkiRamki9(
      ust({ wciecia: { gora: 0, prawo: 0, dol: 0, lewo: 0 } }),
      10,
      10,
      OBSZAR,
      2,
    );
    expect(g.kawalki).toHaveLength(1);
    expect(g.kawalki[0]!.rola).toBe('srodek');
  });

  it('dpi rogów', () => {
    // 30 px na 2,5 mm → 0,0833 mm/px → 304,8 dpi.
    expect(dpiRogow(2.5 / 30)).toBeCloseTo(304.8, 1);
  });
});

// ---------------------------------------------------------------------------------------------
// Scena i PDF

const PNG = new Uint8Array(readFileSync('testy/zasoby/ramka-testowa.png'));
const ELEMENT_PNG: ElementOzdobny = {
  id: 'wl:ramka-png',
  nazwa: 'Ramka PNG',
  rodzaj: 'ramka9',
  szer: 120,
  wys: 120,
  kontury: [],
  ramka9: { ...ust(), zrodlo: { typ: 'obraz', zasob: 'ramka' } },
};
const ELEMENT_SVG: ElementOzdobny = {
  id: 'wl:ramka-svg',
  nazwa: 'Ramka SVG',
  rodzaj: 'ramka9',
  szer: 30,
  wys: 30,
  kolorowanie: 'jednolity',
  kontury: [
    {
      kontur: [['M', 0, 0], ['L', 30, 0], ['L', 30, 30], ['L', 0, 30], ['Z']],
      wypelnienie: 'kolor',
    },
  ],
  ramka9: {
    ...ust({ wciecia: { gora: 10, prawo: 10, dol: 10, lewo: 10 } }),
    zrodlo: { typ: 'svg' },
  },
};

const ctx = {
  czcionki: rejestrTestowy(),
  elementy: [ELEMENT_PNG, ELEMENT_SVG],
  obraz: (id: string) => (id === 'ramka' ? { szerokosc: 120, wysokosc: 120 } : undefined),
};

const karta = (o: OzdobaRamka9, w = 63, h = 88): Szablon => ({
  id: 't',
  nazwa: 'Test',
  rozmiar: { tryb: 'mm', szerokosc: w, wysokosc: h },
  tlo: '#fdf6e3',
  ramka: { grubosc: 0.3, kolor: '#000000', odsuniecie: 1, ozdoba: o },
  korzen: { id: 'korzen', typ: 'kolumna', dzieci: [] },
});
const ozdoba = (element: string, grubosc: number): OzdobaRamka9 => ({
  rodzaj: 'ramka9',
  element,
  grubosc,
});

describe('ramka 9-slice w scenie', () => {
  it('PNG: kawałki to obrazy z przycięciem; całe źródło ustawione tak, by fragment trafił w cel', () => {
    const w = ramka9ZElementu(ozdoba(ELEMENT_PNG.id, 2.5), OBSZAR, {
      wlasne: [ELEMENT_PNG],
      maObraz: () => true,
    });
    expect(w.elementy.length).toBeGreaterThan(20);
    for (const e of w.elementy) expect(e.typ).toBe('obraz');
    const g = kawalkiRamki9(ust(), 120, 120, OBSZAR, 2.5);
    const e0 = w.elementy[w.elementy.length - 4]! as Extract<
      (typeof w.elementy)[number],
      { typ: 'obraz' }
    >;
    const k = g.kawalki[g.kawalki.length - 4]!;
    // Lewy górny róg: źródło (0,0,30,30) → cel (0,0,2,5 × 2,5).
    expect(e0.x).toBeCloseTo(k.cel.x - k.zrodlo.x * g.skala, 10);
    expect(e0.szer).toBeCloseTo(120 * g.skala, 10);
    expect(w.dpi).toBeCloseTo(304.8, 1);
    expect(w.symbole).toEqual({});
  });

  it('SVG: grupy z macierzą i przycięciem, symbol raz', () => {
    const w = ramka9ZElementu(ozdoba(ELEMENT_SVG.id, 3), OBSZAR, { wlasne: [ELEMENT_SVG] });
    expect(w.elementy.every((e) => e.typ === 'grupa' && !!e.przyciecie && !!e.macierz)).toBe(true);
    expect(Object.keys(w.symbole)).toEqual([ELEMENT_SVG.id]);
    expect(w.dpi).toBeUndefined();
  });

  it('nieznany element i element innego rodzaju', () => {
    expect(ramka9ZElementu(ozdoba('wl:nie-ma', 3), OBSZAR).nieznany).toBe('wl:nie-ma');
    expect(ramka9ZElementu(ozdoba('wb:pnacze', 3), OBSZAR).nieznany).toBe('wb:pnacze');
  });

  it('brak obrazu w zasobach', () => {
    const w = ramka9ZElementu(ozdoba(ELEMENT_PNG.id, 3), OBSZAR, {
      wlasne: [ELEMENT_PNG],
      maObraz: () => false,
    });
    expect(w.brakObrazu).toBe('ramka');
  });

  it('karta: PNG 304 dpi bez ostrzeżeń, 150 dpi – ostrzeżenie z wartością', () => {
    const dobra = renderujKarte(karta(ozdoba(ELEMENT_PNG.id, 2.5)), { dane: {} }, ctx);
    expect(dobra.ostrzezenia).toEqual([]);
    const slaba = renderujKarte(karta(ozdoba(ELEMENT_PNG.id, 5)), { dane: {} }, ctx);
    expect(slaba.ostrzezenia).toEqual([
      { pole: 'ramka-karty', komunikat: 'niska-rozdzielczosc-ramki', szczegoly: '152' },
    ]);
    expect(tekstOstrzezenia(slaba.ostrzezenia[0]!)).toContain('152');
  });

  it('karta: brak obrazu i nieznany element dają ostrzeżenie i cienką linię', () => {
    const bez = renderujKarte(
      karta(ozdoba(ELEMENT_PNG.id, 2.5)),
      { dane: {} },
      {
        ...ctx,
        obraz: () => undefined,
      },
    );
    expect(bez.ostrzezenia.map((o) => o.komunikat)).toEqual(['brak-obrazu']);
    const nieznana = renderujKarte(karta(ozdoba('wl:nie-ma', 2.5)), { dane: {} }, ctx);
    expect(nieznana.ostrzezenia.map((o) => o.komunikat)).toEqual(['nieznany-element-ozdobny']);
    expect(
      nieznana.scena.elementy.some((e) => e.typ === 'prostokat' && e.obrys?.grubosc === 0.3),
    ).toBe(true);
  });

  it('panel z ramką 9-slice i narożnikami nad nią', () => {
    const sz: Szablon = {
      ...karta(ozdoba(ELEMENT_SVG.id, 3), 40, 30),
      ramka: undefined,
      korzen: {
        id: 'korzen',
        typ: 'kolumna',
        padding: 4,
        dzieci: [
          {
            id: 'panel',
            typ: 'tekst',
            tekst: 'x',
            styl: { czcionka: 'tresc', rozmiar: 3 },
            ozdoba: ozdoba(ELEMENT_SVG.id, 2),
            narozniki: { element: 'wb:kat', rozmiar: 3 },
          },
        ],
      },
    };
    const w = renderujKarte(sz, { dane: {} }, ctx);
    expect(w.ostrzezenia).toEqual([]);
    expect(w.scena.elementy.filter((e) => e.typ === 'symbol')).toHaveLength(4);
  });
});

describe('wzorce SVG ramki 9-slice', () => {
  it('SVG: karta 63 × 88, powtarzane boki', async () => {
    const { scena, ostrzezenia } = renderujKarte(
      karta(ozdoba(ELEMENT_SVG.id, 4)),
      { dane: {} },
      ctx,
    );
    expect(ostrzezenia).toEqual([]);
    await expect(scenaDoSvg(scena)).toMatchFileSnapshot('./__snapshots__/ramka9-svg-karta.svg');
  });

  it('PNG: mała ramka 50 × 18, rozciągnięte boki, środek pominięty', async () => {
    const element: ElementOzdobny = {
      ...ELEMENT_PNG,
      ramka9: { ...ELEMENT_PNG.ramka9!, boki: 'rozciagnij', srodek: 'pomin' },
    };
    const { scena } = renderujKarte(
      karta(ozdoba(element.id, 2.5), 50, 18),
      { dane: {} },
      { ...ctx, elementy: [element] },
    );
    await expect(scenaDoSvg(scena, { adresObrazu: (id) => `obraz:${id}` })).toMatchFileSnapshot(
      './__snapshots__/ramka9-png-mala.svg',
    );
  });
});

describe('PDF z ramką 9-slice', () => {
  it('obraz PNG zapisany raz mimo dziesiątek kawałków i kilku stron; deterministyczny', async () => {
    const { scena } = renderujKarte(karta(ozdoba(ELEMENT_PNG.id, 2.5)), { dane: {} }, ctx);
    const uzycia = scena.elementy.filter((e) => e.typ === 'obraz');
    expect(uzycia.length).toBeGreaterThan(30);
    const opcje = { obraz: () => ({ dane: PNG, format: 'png' as const }) };
    const a = await scenyDoPdf([scena, scena], opcje);
    const tekst = Buffer.from(a.bajty).toString('latin1');
    expect(tekst.match(/\/Subtype \/Image/g)).toHaveLength(1);
    const b = await scenyDoPdf([scena, scena], opcje);
    expect(Buffer.from(b.bajty).equals(Buffer.from(a.bajty))).toBe(true);
    expect((await PDFDocument.load(a.bajty)).getPageCount()).toBe(2);
  });

  it('SVG: symbol ramki jako jeden XObject', async () => {
    const { scena } = renderujKarte(karta(ozdoba(ELEMENT_SVG.id, 4)), { dane: {} }, ctx);
    const w = await scenyDoPdf([scena, scena]);
    expect(w.liczbaSymboli).toBe(1);
  });
});
