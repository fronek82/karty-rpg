import { describe, expect, it } from 'vitest';
import { pt } from '../model/jednostki';
import type { Szablon } from '../model/szablon';
import { renderujKarte } from '../silnik/karta';
import { rejestrTestowy } from '../silnik/__testy__/pomoc';
import type { ElementSceny, Scena } from '../silnik/scena';
import { scenaDoSvg } from '../silnik/svg';
import { scenyDoPdf } from '../druk/pdf';
import { PDFDocument, PDFName, PDFDict } from 'pdf-lib';
import {
  ELEMENTY_WBUDOWANE,
  NAROZNIKI_WBUDOWANE,
  macierzeNarozniki,
  narozniki,
  znajdzElement,
} from '.';

const ctx = { czcionki: rejestrTestowy() };

const szablon = (reszta: Partial<Szablon>): Szablon => ({
  id: 't',
  nazwa: 'Test',
  rozmiar: { tryb: 'mm', szerokosc: 40, wysokosc: 60 },
  tlo: '#fdf6e3',
  korzen: {
    id: 'korzen',
    typ: 'kolumna',
    padding: 4,
    dzieci: [
      { id: 'nazwa', typ: 'tekst', klucz: 'nazwa', styl: { czcionka: 'tresc', rozmiar: pt(10) } },
    ],
  },
  ...reszta,
});

describe('katalog narożników', () => {
  it('ma 6 wbudowanych narożników o unikalnych identyfikatorach wb:…', () => {
    expect(NAROZNIKI_WBUDOWANE).toHaveLength(6);
    const id = ELEMENTY_WBUDOWANE.map((e) => e.id);
    expect(new Set(id).size).toBe(id.length);
    for (const e of NAROZNIKI_WBUDOWANE) {
      expect(e.id).toMatch(/^wb:/);
      expect(e.rodzaj).toBe('naroznik');
      expect(znajdzElement(e.id)).toBe(e);
    }
  });

  it('rysunki są skończone, mieszczą się w polu i mają kolorowalne części', () => {
    for (const e of NAROZNIKI_WBUDOWANE) {
      expect(e.kontury.length).toBeGreaterThan(0);
      for (const c of e.kontury) {
        expect(c.wypelnienie === 'kolor' || c.obrys?.kolor === 'kolor').toBe(true);
        for (const k of c.kontur) {
          for (const v of k.slice(1) as number[]) {
            expect(Number.isFinite(v)).toBe(true);
            expect(v).toBeGreaterThanOrEqual(-0.5);
            expect(v).toBeLessThanOrEqual(e.szer + 0.5);
          }
        }
      }
    }
  });
});

describe('narożniki na rogach', () => {
  it('macierze odbijają lustrzanie rysunek na cztery rogi', () => {
    const ms = macierzeNarozniki({ szer: 10, wys: 10 }, { x: 1, y: 2, szer: 30, wys: 50 }, 5);
    const p = (m: number[], x: number, y: number) => [
      m[0]! * x + m[2]! * y + m[4]!,
      m[1]! * x + m[3]! * y + m[5]!,
    ];
    // Punkt (0, 0) rysunku ląduje w rogu, (10, 10) – 5 mm w głąb prostokąta.
    expect(p(ms[0]!, 0, 0)).toEqual([1, 2]);
    expect(p(ms[1]!, 0, 0)).toEqual([31, 2]);
    expect(p(ms[2]!, 0, 0)).toEqual([1, 52]);
    expect(p(ms[3]!, 0, 0)).toEqual([31, 52]);
    expect(p(ms[3]!, 10, 10)).toEqual([26, 47]);
  });

  it('rozmiar nie przekracza połowy krótszego boku; nieznany element daje wynik z ostrzeżeniem', () => {
    const w = narozniki(
      { element: 'wb:kat', rozmiar: 100 },
      { x: 0, y: 0, szer: 20, wys: 40 },
      '#000',
    );
    expect(w.elementy).toHaveLength(4);
    expect(w.elementy[0]).toMatchObject({ macierz: [1, 0, 0, 1, 0, 0] });
    const brak = narozniki(
      { element: 'wb:nie-ma', rozmiar: 5 },
      { x: 0, y: 0, szer: 20, wys: 40 },
      '#000',
    );
    expect(brak.nieznany).toBe('wb:nie-ma');
    expect(brak.elementy).toEqual([]);
  });
});

describe('ramka z narożnikami w scenie', () => {
  const sz = szablon({
    ramka: {
      grubosc: 0.3,
      kolor: '#2f5d8a',
      styl: 'podwojna',
      odsuniecie: 1,
      narozniki: { element: 'wb:lisc', rozmiar: 7 },
    },
  });

  it('cztery symbole z kolorem linii i jeden wpis w słowniku symboli', () => {
    const { scena, ostrzezenia } = renderujKarte(sz, { dane: { nazwa: 'Ala' } }, ctx);
    expect(ostrzezenia).toEqual([]);
    const sym = scena.elementy.filter((e) => e.typ === 'symbol');
    expect(sym).toHaveLength(4);
    expect(sym.every((e) => e.typ === 'symbol' && e.kolor === '#2f5d8a')).toBe(true);
    expect(Object.keys(scena.symbole ?? {})).toEqual(['wb:lisc']);
  });

  it('linia podwójna to dwa prostokąty, wewnętrzny o promieniu pomniejszonym', () => {
    const { scena } = renderujKarte(
      { ...sz, promienRogow: 3, ramka: { grubosc: 0.3, kolor: '#000000', styl: 'podwojna' } },
      { dane: {} },
      ctx,
    );
    const r = scena.elementy.filter((e) => e.typ === 'prostokat' && e.obrys);
    expect(r).toHaveLength(2);
    const [z, w] = r as Extract<ElementSceny, { typ: 'prostokat' }>[];
    // Przerwa domyślna 2× grubość: oś wewnętrznej 0,15 + 0,3 + 0,6 od krawędzi.
    expect(z!.x).toBeCloseTo(0.15);
    expect(w!.x).toBeCloseTo(1.05);
    expect(z!.promien! - w!.promien!).toBeCloseTo(0.9);
    expect(z!.obrys!.kreska).toBeUndefined();
  });

  it('nieznany element: ostrzeżenie, brak symboli, linia zostaje', () => {
    const { scena, ostrzezenia } = renderujKarte(
      szablon({
        ramka: { grubosc: 0.3, kolor: '#000000', narozniki: { element: 'x', rozmiar: 5 } },
      }),
      { dane: {} },
      ctx,
    );
    expect(ostrzezenia).toEqual([
      { pole: 'ramka-karty', komunikat: 'nieznany-element-ozdobny', szczegoly: 'x' },
    ]);
    expect(scena.symbole).toBeUndefined();
    expect(scena.elementy.some((e) => e.typ === 'prostokat' && e.obrys)).toBe(true);
  });

  it('narożniki i linia podwójna na węźle szablonu (obramowanie, ścięcie, krawędzie)', () => {
    const wezel = (extra: object) =>
      szablon({
        korzen: {
          id: 'korzen',
          typ: 'kolumna',
          padding: 4,
          obramowanie: { grubosc: 0.4, kolor: '#8b0000', styl: 'podwojna', przerwa: 0.4 },
          narozniki: { element: 'wb:gwiazda', rozmiar: 5 },
          dzieci: [],
          ...extra,
        },
      });
    const a = renderujKarte(wezel({}), { dane: {} }, ctx).scena;
    expect(a.elementy.filter((e) => e.typ === 'symbol')).toHaveLength(4);
    expect(a.elementy.filter((e) => e.typ === 'prostokat' && e.obrys)).toHaveLength(2);
    const b = renderujKarte(
      wezel({
        obramowanie: {
          grubosc: 0.4,
          kolor: '#8b0000',
          styl: 'podwojna',
          krawedzie: { gora: true },
        },
      }),
      { dane: {} },
      ctx,
    ).scena;
    expect(b.elementy.filter((e) => e.typ === 'linia')).toHaveLength(2);
  });

  it('separator i tabela w stylu podwójnym', () => {
    const { scena } = renderujKarte(
      szablon({
        korzen: {
          id: 'korzen',
          typ: 'kolumna',
          dzieci: [
            {
              id: 'sep',
              typ: 'separator',
              kierunek: 'poziomy',
              grubosc: 0.3,
              stylLinii: 'podwojna',
            },
            {
              id: 'tab',
              typ: 'tabela',
              kolumny: [{ naglowek: 'A', klucz: 'a' }],
              styl: { czcionka: 'tresc', rozmiar: pt(8) },
              linie: { grubosc: 0.3, kolor: '#000000', styl: 'podwojna' },
            },
          ],
        },
      }),
      { dane: { a: 'x' } },
      ctx,
    );
    const linie = scena.elementy.filter((e) => e.typ === 'linia');
    // Separator: dwie linie 0,9 mm od siebie w osiach (0,3 + przerwa 0,6).
    // + jedna linia siatki tabeli (między nagłówkiem a wierszem wartości).
    expect(linie).toHaveLength(3);
    const [l1, l2] = linie as Extract<ElementSceny, { typ: 'linia' }>[];
    expect(Math.abs(l2!.y1 - l1!.y1)).toBeCloseTo(0.9);
    expect(scena.elementy.filter((e) => e.typ === 'prostokat' && e.obrys)).toHaveLength(2);
  });
});

describe('galeria wzorców', () => {
  it('sześć narożników na ramce podwójnej – wzorzec SVG', async () => {
    const elementy: ElementSceny[] = [];
    const symbole: NonNullable<Scena['symbole']> = {};
    NAROZNIKI_WBUDOWANE.forEach((e, i) => {
      const w = narozniki(
        { element: e.id, rozmiar: 12 },
        { x: 4 + (i % 3) * 34, y: 4 + Math.floor(i / 3) * 34, szer: 30, wys: 30 },
        '#2f5d8a',
      );
      elementy.push(...w.elementy);
      Object.assign(symbole, w.symbole);
    });
    const scena: Scena = { szer: 108, wys: 72, elementy, glify: {}, symbole };
    await expect(scenaDoSvg(scena)).toMatchFileSnapshot('./__snapshots__/naroznik-galeria.svg');
  });

  it('karta z ramką podwójną i narożnikami – wzorzec SVG', async () => {
    const { scena } = renderujKarte(
      szablon({
        promienRogow: 3,
        ramka: {
          grubosc: 0.3,
          kolor: '#2f5d8a',
          styl: 'podwojna',
          odsuniecie: 1,
          narozniki: { element: 'wb:wezel', rozmiar: 6 },
        },
      }),
      { dane: { nazwa: 'Ala' } },
      ctx,
    );
    await expect(scenaDoSvg(scena)).toMatchFileSnapshot('./__snapshots__/ramka-podwojna.svg');
  });
});

describe('SVG z symbolami i grupą z macierzą', () => {
  const { scena } = renderujKarte(
    szablon({
      ramka: { grubosc: 0.3, kolor: '#2f5d8a', narozniki: { element: 'wb:zawijas', rozmiar: 6 } },
    }),
    { dane: {} },
    ctx,
  );

  it('rysunek raz w <defs>, cztery <use>; wynik deterministyczny', () => {
    const svg = scenaDoSvg(scena);
    expect(svg.match(/<use /g)).toHaveLength(4);
    expect(svg.match(/id="s0"/g)).toHaveLength(1);
    expect(svg).toContain('color="#2f5d8a"');
    expect(svg).toContain('stroke="currentColor"');
    expect(scenaDoSvg(scena)).toBe(svg);
  });

  it('narożniki – wzorzec SVG', async () => {
    await expect(scenaDoSvg(scena)).toMatchFileSnapshot('./__snapshots__/naroznik-zawijas.svg');
  });

  it('grupa: macierz po obrocie i przesunięciu, przycięcie w układzie otaczającym', () => {
    const s: Scena = {
      szer: 20,
      wys: 20,
      glify: {},
      elementy: [
        {
          typ: 'grupa',
          x: 5,
          y: 5,
          obrot: 90,
          macierz: [2, 0, 0, 2, 1, 1],
          przyciecie: { x: 0, y: 0, szer: 10, wys: 10 },
          elementy: [{ typ: 'okrag', cx: 0, cy: 0, r: 1 }],
        },
        { typ: 'grupa', x: 3, y: 4, elementy: [] },
      ],
    };
    const svg = scenaDoSvg(s);
    expect(svg).toContain(
      '<g clip-path="url(#p0)"><g transform="translate(5 5) rotate(90) matrix(2 0 0 2 1 1)">',
    );
    // Dotychczasowa grupa bez zmian.
    expect(svg).toContain('<g transform="translate(3 4)"></g>');
  });
});

describe('PDF z symbolami', () => {
  it('symbol zapisany raz jako XObject, wstawiany wiele razy', async () => {
    const { scena } = renderujKarte(
      szablon({
        ramka: { grubosc: 0.3, kolor: '#000000', narozniki: { element: 'wb:okucie', rozmiar: 6 } },
      }),
      { dane: {} },
      ctx,
    );
    const dwie: Scena[] = [scena, scena, scena];
    const wynik = await scenyDoPdf(dwie);
    expect(wynik.liczbaSymboli).toBe(1);
    const doc = await PDFDocument.load(wynik.bajty);
    // Jeden obiekt Form XObject symbolu dla wszystkich stron: ta sama referencja.
    const refy = new Set<string>();
    for (const strona of doc.getPages()) {
      const xo = strona.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict);
      for (const [nazwa, ref] of xo?.entries() ?? [])
        if (nazwa.toString().startsWith('/S')) refy.add(String(ref));
    }
    expect(refy.size).toBe(1);
    const a = (await scenyDoPdf(dwie)).bajty;
    expect(Buffer.from(a).equals(Buffer.from(wynik.bajty))).toBe(true);
  });
});
