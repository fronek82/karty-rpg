import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { scenyDoPdf } from '../druk/pdf';
import { pt } from '../model/jednostki';
import type { Szablon } from '../model/szablon';
import { rejestrTestowy } from '../silnik/__testy__/pomoc';
import { renderujKarte } from '../silnik/karta';
import { scenaDoSvg } from '../silnik/svg';
import { importujSvg, symbolZElementu, znajdzElement, type ElementOzdobny } from '.';

const svgPlik = (tresc: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10">${tresc}</svg>`;

/** Własny element z pliku SVG (jak po imporcie w bibliotece). */
function wlasny(
  id: string,
  rodzaj: ElementOzdobny['rodzaj'],
  tresc: string,
  kolorowanie?: 'jednolity' | 'oryginal',
) {
  const { element } = importujSvg(svgPlik(tresc), {
    rodzaj,
    ...(kolorowanie ? { kolorowanie } : {}),
  });
  return { ...element, id, nazwa: id } as ElementOzdobny;
}

const STRZALKA =
  '<path d="M0 5 L10 0 L10 10 Z" fill="#336699"/><rect x="10" y="3" width="10" height="4" fill="#cc0000"/>';
const ctx = (elementy: ElementOzdobny[]) => ({ czcionki: rejestrTestowy(), elementy });

const szablon = (reszta: Partial<Szablon>, dzieci: Szablon['korzen']['dzieci'] = []): Szablon => ({
  id: 't',
  nazwa: 'Test',
  rozmiar: { tryb: 'mm', szerokosc: 50, wysokosc: 70 },
  korzen: { id: 'korzen', typ: 'kolumna', padding: 6, dzieci },
  ...reszta,
});

describe('własne elementy w silniku', () => {
  it('wbudowane mają pierwszeństwo, własne znajdowane po id', () => {
    const e = wlasny('wl:x', 'naroznik', STRZALKA);
    expect(znajdzElement('wl:x', [e])).toBe(e);
    expect(znajdzElement('wl:x')).toBeUndefined();
    expect(znajdzElement('wb:kat', [e])?.id).toBe('wb:kat');
  });

  it('symbol: jednolity – wszystko kolorowalne, oryginał – kolory z pliku', () => {
    const jedn = symbolZElementu(wlasny('wl:a', 'naroznik', STRZALKA, 'jednolity'));
    expect(jedn.kontury.every((c) => c.wypelnienie === 'kolor')).toBe(true);
    const oryg = symbolZElementu(wlasny('wl:a', 'naroznik', STRZALKA, 'oryginal'));
    expect(oryg.kontury.map((c) => c.wypelnienie)).toEqual(['#336699', '#cc0000']);
  });

  it('narożnik: 4 użycia symbolu, kolor ramki dziedziczony; bez elementu w kontekście – ostrzeżenie', () => {
    const e = wlasny('wl:rog', 'naroznik', '<path d="M0 0H10V4H4V10H0Z"/>');
    const sz = szablon({
      ramka: { grubosc: 0.4, kolor: '#aa0000', narozniki: { element: e.id, rozmiar: 8 } },
    });
    const w = renderujKarte(sz, { dane: {} }, ctx([e]));
    expect(w.ostrzezenia).toEqual([]);
    expect(w.scena.elementy.filter((x) => x.typ === 'symbol')).toHaveLength(4);
    expect(Object.keys(w.scena.symbole ?? {})).toEqual(['wl:rog']);
    const svg = scenaDoSvg(w.scena);
    expect(svg).toContain('color="#aa0000"');
    const brak = renderujKarte(sz, { dane: {} }, { czcionki: rejestrTestowy() });
    expect(brak.ostrzezenia.map((o) => o.komunikat)).toEqual(['nieznany-element-ozdobny']);
    expect(brak.scena.symbole).toBeUndefined();
  });

  it('kafelek motywu: własny motyw rozłożony na czterech bokach, róg z kwadratu pasa', () => {
    const e = wlasny('wl:m', 'motyw', '<circle cx="10" cy="5" r="4"/>');
    const sz = szablon({
      ramka: {
        grubosc: 0.3,
        kolor: '#000000',
        ozdoba: { rodzaj: 'motyw', element: e.id, szerokosc: 5, kolor: '#005500' },
      },
    });
    const w = renderujKarte(sz, { dane: {} }, ctx([e]));
    expect(w.ostrzezenia).toEqual([]);
    expect(w.scena.elementy.filter((x) => x.typ === 'symbol').length).toBeGreaterThan(8);
  });

  it('zakończenie i środek separatora z własnych elementów; PDF zapisuje każdy rysunek raz', async () => {
    const zak = wlasny('wl:zak', 'zakonczenie', '<path d="M0 5L10 0V10Z"/>');
    const sr = wlasny('wl:sr', 'srodek', '<circle cx="10" cy="5" r="4.5"/>');
    const sz = szablon({}, [
      {
        id: 'sep',
        typ: 'separator',
        kierunek: 'poziomy',
        grubosc: 0.3,
        zakonczenia: { element: zak.id, rozmiar: 3 },
        srodek: { element: sr.id, rozmiar: 3 },
      },
    ]);
    const w = renderujKarte(sz, { dane: {} }, ctx([zak, sr]));
    expect(w.ostrzezenia).toEqual([]);
    expect(w.scena.elementy.filter((x) => x.typ === 'symbol')).toHaveLength(3);
    const wynik = await scenyDoPdf([w.scena, w.scena]);
    expect(wynik.liczbaSymboli).toBe(2);
    // Ten sam model → ten sam SVG (deterministycznie).
    expect(scenaDoSvg(renderujKarte(sz, { dane: {} }, ctx([zak, sr])).scena)).toBe(
      scenaDoSvg(w.scena),
    );
  });

  it('kształt wartości z własnego SVG: tło i obramowanie jako ścieżka, treść w prostokącie z elementu', () => {
    const e = {
      ...wlasny('wl:ks', 'ksztalt', '<path d="M10 0L20 10H0Z"/>'),
      tresc: { x: 0.25, y: 0.4, szer: 0.5, wys: 0.5 },
    };
    const sz = szablon({}, [
      {
        id: 'w',
        typ: 'wartosc',
        tekst: '7',
        ksztalt: 'wlasny',
        ksztaltElement: e.id,
        minSzerokosc: 20,
        minWysokosc: 20,
        tlo: '#ffeecc',
        obramowanie: { grubosc: 0.4, kolor: '#112233' },
        styl: { czcionka: 'tresc', rozmiar: pt(10) },
      },
    ]);
    const w = renderujKarte(sz, { dane: {} }, ctx([e]));
    expect(w.ostrzezenia).toEqual([]);
    const sciezki = w.scena.elementy.filter((x) => x.typ === 'sciezka');
    expect(sciezki.some((s) => s.typ === 'sciezka' && s.wypelnienie === '#ffeecc')).toBe(true);
    expect(sciezki.some((s) => s.typ === 'sciezka' && s.obrys?.kolor === '#112233')).toBe(true);
    // Kontur dopasowany do pola: trójkąt o wierzchołku w środku górnej krawędzi pola.
    const pole = w.wezly.find((x) => x.id === 'w')!;
    const tlo = sciezki.find((s) => s.typ === 'sciezka' && s.wypelnienie === '#ffeecc')!;
    if (tlo.typ !== 'sciezka') throw new Error();
    const [m, l] = tlo.kontur;
    expect(m![1]).toBeCloseTo(pole.x + pole.szer / 2, 6);
    expect(m![2]).toBeCloseTo(pole.y, 6);
    expect(l![0]).toBe('L');
    // Pole musi być większe niż sam tekst: treść = 50 % × 50 % kształtu.
    expect(pole.szer).toBeGreaterThanOrEqual(20);
  });

  it('kształt: brak elementu albo zły rodzaj – ostrzeżenie i prostokąt', () => {
    const naroz = wlasny('wl:n', 'naroznik', '<rect width="5" height="5"/>');
    for (const lista of [[], [naroz]]) {
      const sz = szablon({}, [
        {
          id: 'w',
          typ: 'wartosc',
          tekst: '7',
          ksztalt: 'wlasny',
          ksztaltElement: lista.length ? 'wl:n' : 'wl:nie-ma',
          tlo: '#ffffff',
          styl: { czcionka: 'tresc', rozmiar: pt(10) },
        },
      ]);
      const w = renderujKarte(sz, { dane: {} }, ctx(lista));
      expect(w.ostrzezenia.map((o) => o.komunikat)).toContain('nieznany-element-ozdobny');
      expect(
        w.scena.elementy.some((x) => x.typ === 'prostokat' && x.wypelnienie === '#ffffff'),
      ).toBe(true);
    }
  });

  it('evenodd: SVG ma fill-rule, PDF używa f* (dziura w pierścieniu)', async () => {
    const e = wlasny(
      'wl:o',
      'naroznik',
      '<path fill-rule="evenodd" d="M0 0H10V10H0ZM3 3H7V7H3Z"/>',
    );
    const sz = szablon({
      ramka: { grubosc: 0.3, kolor: '#000000', narozniki: { element: e.id, rozmiar: 8 } },
    });
    const w = renderujKarte(sz, { dane: {} }, ctx([e]));
    expect(scenaDoSvg(w.scena)).toContain('fill-rule="evenodd"');
    const pdf = await scenyDoPdf([w.scena]);
    expect(pdf.liczbaSymboli).toBe(1);
  });
});

/** Dekodowana treść strumieni strony i wszystkich XObjectów formularzy. */
async function tresciPdf(bajty: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bajty);
  const tekst = (x: unknown) =>
    Buffer.from(decodePDFRawStream(x as PDFRawStream).decode()).toString('latin1');
  const tresc = doc.getPage(0).node.Contents();
  const glowny =
    tresc instanceof PDFRawStream ? tresc : (tresc as PDFArray).lookup(0, PDFRawStream);
  const czesci = [tekst(glowny)];
  for (const [, o] of doc.context.enumerateIndirectObjects())
    if (o instanceof PDFRawStream && o.dict.get(PDFName.of('Subtype')) === PDFName.of('Form'))
      czesci.push(tekst(o));
  return czesci.join('\n');
}

describe('evenodd w PDF i w tle własnego kształtu', () => {
  const dziury = '<path fill-rule="evenodd" d="M0 0H20V10H0ZM5 3H15V7H5Z"/>';

  it('symbol z evenodd: XObject używa f*, bez evenodd – f', async () => {
    const e = wlasny('wl:o', 'naroznik', dziury);
    const sz = szablon({
      ramka: { grubosc: 0.3, kolor: '#000000', narozniki: { element: e.id, rozmiar: 8 } },
    });
    const pdf = await scenyDoPdf([renderujKarte(sz, { dane: {} }, ctx([e])).scena]);
    const tresc = await tresciPdf(pdf.bajty);
    expect(tresc).toMatch(/\bf\*/);
    const zwykly = wlasny('wl:z', 'naroznik', '<path d="M0 0H20V10H0Z"/>');
    const sz2 = szablon({
      ramka: { grubosc: 0.3, kolor: '#000000', narozniki: { element: zwykly.id, rozmiar: 8 } },
    });
    const pdf2 = await scenyDoPdf([renderujKarte(sz2, { dane: {} }, ctx([zwykly])).scena]);
    expect(await tresciPdf(pdf2.bajty)).not.toMatch(/\bf\*/);
  });

  it('tło własnego kształtu z dziurą: ścieżka sceny ma evenodd (SVG fill-rule, PDF f*)', async () => {
    const e = wlasny('wl:ks', 'ksztalt', dziury);
    const sz = szablon({}, [
      {
        id: 'w',
        typ: 'wartosc',
        tekst: '1',
        ksztalt: 'wlasny',
        ksztaltElement: e.id,
        minSzerokosc: 20,
        minWysokosc: 20,
        tlo: '#ffeecc',
        styl: { czcionka: 'tresc', rozmiar: pt(10) },
      },
    ]);
    const w = renderujKarte(sz, { dane: {} }, ctx([e]));
    const tlo = w.scena.elementy.find((x) => x.typ === 'sciezka' && x.wypelnienie === '#ffeecc');
    expect(tlo && tlo.typ === 'sciezka' && tlo.evenodd).toBe(true);
    expect(scenaDoSvg(w.scena)).toContain('fill-rule="evenodd"');
    expect(await tresciPdf((await scenyDoPdf([w.scena])).bajty)).toMatch(/\bf\*/);
  });
});
