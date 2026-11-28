import { describe, expect, it } from 'vitest';
import { pt } from '../model/jednostki';
import type { Szablon } from '../model/szablon';
import { renderujKarte } from '../silnik/karta';
import { rejestrTestowy, zawartoscKarty } from '../silnik/__testy__/pomoc';
import type { ElementSceny, Scena } from '../silnik/scena';
import { scenaDoSvg } from '../silnik/svg';
import { scenyDoPdf } from '../druk/pdf';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { osieLinii, pelnaGrubosc } from '../silnik/karta';
import { tekstOstrzezenia, tekstOstrzezeniaArkusza } from '../ui/ostrzezenia';
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
  it('ma 14 wbudowanych narożników o unikalnych identyfikatorach wb:…', () => {
    expect(NAROZNIKI_WBUDOWANE).toHaveLength(14);
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
    const r = zawartoscKarty(scena).filter((e) => e.typ === 'prostokat' && e.obrys);
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
    NAROZNIKI_WBUDOWANE.slice(0, 6).forEach((e, i) => {
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

/** Dekodowana treść wszystkich strumieni zawartości strony i XObjectów formularzy. */
async function strumienie(bajty: Uint8Array) {
  const doc = await PDFDocument.load(bajty);
  const tekst = (s: unknown) =>
    Buffer.from(decodePDFRawStream(s as PDFRawStream).decode()).toString('latin1');
  const strona = doc.getPage(0);
  const tresc = strona.node.Contents();
  const glowny =
    tresc instanceof PDFRawStream ? tresc : (tresc as PDFArray).lookup(0, PDFRawStream);
  const formularze: { tresc: string; bbox: number[] }[] = [];
  for (const [, obiekt] of doc.context.enumerateIndirectObjects()) {
    if (
      obiekt instanceof PDFRawStream &&
      obiekt.dict.get(PDFName.of('Subtype')) === PDFName.of('Form')
    ) {
      const bbox = (obiekt.dict.lookup(PDFName.of('BBox'), PDFArray) as PDFArray)
        .asArray()
        .map((n) => Number(String(n)));
      formularze.push({ tresc: tekst(obiekt), bbox });
    }
  }
  return { glowny: tekst(glowny), formularze };
}

describe('PDF – szczegóły symboli i grup', () => {
  it('symbol z obrysem „kolor” (zawijas): obrys bez własnego koloru, zaokrąglone końce, BBox z zapasem', async () => {
    const e = znajdzElement('wb:zawijas')!;
    const scena: Scena = {
      szer: 20,
      wys: 20,
      glify: {},
      symbole: { [e.id]: { kontury: e.kontury, szer: e.szer, wys: e.wys } },
      elementy: [{ typ: 'symbol', klucz: e.id, macierz: [1, 0, 0, 1, 2, 3], kolor: '#ff0000' }],
    };
    const { glowny, formularze } = await strumienie((await scenyDoPdf([scena])).bajty);
    const f = formularze.find((x) => x.tresc.includes(' w'))!;
    // Szerokość linii, zakończenia i łączenia okrągłe (1 J, 1 j), brak ustawiania koloru obrysu (RG).
    expect(f.tresc).toMatch(/0\.9 w/);
    expect(f.tresc).toMatch(/\b1 J\b/);
    expect(f.tresc).toMatch(/\b1 j\b/);
    expect(f.tresc).not.toMatch(/ RG\b/);
    expect(f.tresc).not.toMatch(/ rg\b/);
    // BBox: pole 10×10 plus zapas na grubość obrysu.
    expect(f.bbox[0]).toBeLessThan(0);
    expect(f.bbox[2]).toBeGreaterThan(10);
    // Wstawienie: kolor wypełnienia i obrysu ustawiony przed Do.
    expect(glowny).toMatch(/1 0 0 rg[\s\S]*1 0 0 RG[\s\S]*\/S[-\w]+ Do/);
  });

  it('grupa z macierzą i przycięciem: przycięcie, potem obrót/przesunięcie, na końcu macierz', async () => {
    const scena: Scena = {
      szer: 20,
      wys: 20,
      glify: {},
      elementy: [
        {
          typ: 'grupa',
          x: 5,
          y: 6,
          macierz: [2, 0, 0, 3, 1, 1],
          przyciecie: { x: 1, y: 2, szer: 10, wys: 11 },
          elementy: [{ typ: 'prostokat', x: 0, y: 0, szer: 1, wys: 1, wypelnienie: '#000000' }],
        },
      ],
    };
    const { glowny } = await strumienie((await scenyDoPdf([scena])).bajty);
    const iClip = glowny.indexOf('1 2 10 11 re');
    const iObrot = glowny.indexOf('1 0 0 1 5 6 cm');
    const iMacierz = glowny.indexOf('2 0 0 3 1 1 cm');
    expect(iClip).toBeGreaterThan(0);
    expect(glowny.indexOf('W\nn')).toBeGreaterThan(iClip);
    expect(iObrot).toBeGreaterThan(glowny.indexOf('W\nn'));
    expect(iMacierz).toBeGreaterThan(iObrot);
  });
});

describe('osieLinii i pełna grubość – brzegi', () => {
  it('ciągła: jedna oś; podwójna: dwie osie, przerwa 0 i domyślna', () => {
    expect(osieLinii({ grubosc: 1 })).toEqual([0.5]);
    expect(osieLinii({ grubosc: 1, styl: 'podwojna' })).toEqual([0.5, 3.5]);
    expect(osieLinii({ grubosc: 1, styl: 'podwojna', przerwa: 0 })).toEqual([0.5, 1.5]);
    expect(pelnaGrubosc({ grubosc: 1, styl: 'podwojna', przerwa: 0 })).toBe(2);
    expect(pelnaGrubosc({ grubosc: 1, styl: 'podwojna' })).toBe(4);
    expect(pelnaGrubosc({ grubosc: 1, styl: 'przerywana' })).toBe(1);
  });

  it('grubość 0: nic nie jest rysowane', () => {
    const { scena } = renderujKarte(
      szablon({ ramka: { grubosc: 0, kolor: '#000000', styl: 'podwojna' } }),
      { dane: {} },
      ctx,
    );
    expect(scena.elementy.filter((e) => e.typ === 'prostokat' && e.obrys)).toHaveLength(0);
  });
});

describe('linia podwójna na kształtach węzła', () => {
  const wartosc = (ksztalt: 'romb' | 'tarcza' | 'sciety') =>
    renderujKarte(
      szablon({
        korzen: {
          id: 'korzen',
          typ: 'kolumna',
          dzieci: [
            {
              id: 'w',
              typ: 'wartosc',
              klucz: 'w',
              ksztalt,
              promien: 2,
              minSzerokosc: 14,
              minWysokosc: 14,
              obramowanie: { grubosc: 0.4, kolor: '#000000', styl: 'podwojna' },
              styl: { czcionka: 'tresc', rozmiar: pt(10) },
            },
          ],
        },
      }),
      { dane: { w: '2' } },
      ctx,
    ).scena;

  for (const k of ['romb', 'tarcza', 'sciety'] as const)
    it(`${k}: dwa kontury obrysu, wewnętrzny mniejszy`, () => {
      const s = wartosc(k);
      const kontury = s.elementy.filter((e) => e.typ === 'sciezka' && e.obrys);
      expect(kontury).toHaveLength(2);
      const szer = (e: ElementSceny) => {
        const xs = (e as Extract<ElementSceny, { typ: 'sciezka' }>).kontur.flatMap((c) =>
          c[0] === 'Z' ? [] : [c[1] as number],
        );
        return Math.max(...xs) - Math.min(...xs);
      };
      expect(szer(kontury[1]!)).toBeLessThan(szer(kontury[0]!));
    });
});

describe('ostrzeżenie o nieznanym elemencie ozdobnym', () => {
  it('ma czytelny polski tekst z identyfikatorem', () => {
    expect(
      tekstOstrzezenia({
        pole: 'ramka-karty',
        komunikat: 'nieznany-element-ozdobny',
        szczegoly: 'wb:x',
      }),
    ).toContain('wb:x');
    expect(
      tekstOstrzezeniaArkusza(
        { komunikat: 'nieznany-element-ozdobny:ramka-karty:wb:x', kartaId: 'k' },
        'Karta',
      ),
    ).toMatch(/nieznany element ozdobny/);
  });
});
