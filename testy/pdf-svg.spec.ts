import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { scenyDoPdf } from '../src/druk/pdf';
import { pt } from '../src/model/jednostki';
import type { Szablon } from '../src/model/szablon';
import { renderujKarte } from '../src/silnik/karta';
import { scenaDoSvg } from '../src/silnik/svg';
import { rejestrTestowy, szablonBroni } from '../src/silnik/__testy__/pomoc';
import { szablonBron } from '../src/pakiety/mausritter/szablony';
import { OBRAZ_ZASTEPCZY } from '../src/pakiety/mausritter/talie';

const PNG_ZASTEPCZY = readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png');

/**
 * Podgląd = wydruk: ta sama scena zapisana jako SVG (rysuje Chromium) i jako PDF (rysuje pdf.js)
 * musi dać prawie ten sam obraz. Różnice dopuszczamy tylko na wygładzanych krawędziach.
 */

const PX_NA_MM = 12;
const ADRES = 'http://karty.test/';
const pdfjs = readFileSync('node_modules/pdfjs-dist/build/pdf.min.mjs');
const pdfjsWorker = readFileSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs');

async function przygotujStrone(page: Page) {
  await page.route(`${ADRES}**`, (route) => {
    const sciezka = new URL(route.request().url()).pathname;
    if (sciezka === '/pdf.mjs')
      return route.fulfill({ body: pdfjs, contentType: 'text/javascript' });
    if (sciezka === '/pdf.worker.mjs')
      return route.fulfill({ body: pdfjsWorker, contentType: 'text/javascript' });
    return route.fulfill({
      body: '<!doctype html><body style="margin:0"></body>',
      contentType: 'text/html',
    });
  });
  await page.goto(ADRES);
  await page.addScriptTag({ url: '/pdf.mjs', type: 'module' });
  await page.waitForFunction(() => 'pdfjsLib' in globalThis);
}

interface Porownanie {
  rozne: number;
  wszystkie: number;
  ciemneSvg: number;
  ciemnePdf: number;
}

async function porownaj(page: Page, svg: string, pdf: Uint8Array): Promise<Porownanie> {
  return page.evaluate(
    async ({ svg, pdf, pxNaMm }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lib = (globalThis as any).pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
      const dok = await lib.getDocument({ data: new Uint8Array(pdf) }).promise;
      const strona = await dok.getPage(1);
      const viewport = strona.getViewport({ scale: (pxNaMm * 25.4) / 72 });
      const szer = Math.round(viewport.width);
      const wys = Math.round(viewport.height);
      const pdfCanvas = new OffscreenCanvas(szer, wys);
      const pctx = pdfCanvas.getContext('2d')!;
      pctx.fillStyle = '#fff';
      pctx.fillRect(0, 0, szer, wys);
      await strona.render({
        canvas: pdfCanvas,
        canvasContext: pctx,
        viewport,
        background: '#ffffff',
      }).promise;

      const obraz = new Image();
      obraz.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      await obraz.decode();
      const svgCanvas = new OffscreenCanvas(szer, wys);
      const sctx = svgCanvas.getContext('2d')!;
      sctx.fillStyle = '#fff';
      sctx.fillRect(0, 0, szer, wys);
      sctx.drawImage(obraz, 0, 0, szer, wys);

      const a = pctx.getImageData(0, 0, szer, wys).data;
      const b = sctx.getImageData(0, 0, szer, wys).data;
      let rozne = 0;
      let ciemneSvg = 0;
      let ciemnePdf = 0;
      for (let i = 0; i < a.length; i += 4) {
        const ga = (a[i]! + a[i + 1]! + a[i + 2]!) / 3;
        const gb = (b[i]! + b[i + 1]! + b[i + 2]!) / 3;
        if (ga < 128) ciemnePdf++;
        if (gb < 128) ciemneSvg++;
        if (Math.abs(ga - gb) > 96) rozne++;
      }
      return { rozne, wszystkie: a.length / 4, ciemneSvg, ciemnePdf };
    },
    { svg, pdf: [...pdf], pxNaMm: PX_NA_MM },
  );
}

const czcionki = rejestrTestowy();

const szablonOpisu: Szablon = {
  id: 'opis',
  nazwa: 'Opis',
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 44 },
  korzen: {
    id: 'k',
    typ: 'kolumna',
    padding: 2,
    odstep: 1,
    obramowanie: { grubosc: 0.3, kolor: '#7a2e1f', styl: 'przerywana' },
    dzieci: [
      {
        id: 'tytul',
        typ: 'tekst',
        klucz: 'tytul',
        styl: { czcionka: 'tytul', wariant: 'pogrubiony', rozmiar: pt(14), wyrownanie: 'srodek' },
      },
      {
        id: 'opis',
        typ: 'tekst',
        klucz: 'opis',
        styl: { czcionka: 'tresc', wariant: 'kursywa', rozmiar: pt(8) },
      },
      {
        id: 'gwiazdka',
        typ: 'ikona',
        ikona: 'gwiazdka',
        rozmiar: 4,
        wyrownanie: { poziomo: 'koniec' },
      },
    ],
  },
};

const PRZYPADKI: { nazwa: string; wynik: () => ReturnType<typeof renderujKarte> }[] = [
  {
    nazwa: 'Mausritter: broń z obrazkiem i białą obwódką klasy',
    wynik: () =>
      renderujKarte(
        szablonBron,
        { dane: { nazwa: 'Igła', wartosc: 'k6', klasa: 'Lekka', obraz: OBRAZ_ZASTEPCZY } },
        { czcionki, obraz: () => ({ szerokosc: 512, wysokosc: 512 }) },
      ),
  },
  {
    nazwa: 'karta broni 1×2',
    wynik: () =>
      renderujKarte(
        szablonBroni,
        {
          dane: { nazwa: 'Żelazny kij', obrazenia: 'k6/k8', klasa: 'Ciężka', uzycia: '6' },
          rozmiar: { kolumny: 1, rzedy: 2 },
        },
        { czcionki },
      ),
  },
  {
    nazwa: 'karta z akapitem, kursywą i kolorami',
    wynik: () =>
      renderujKarte(
        szablonOpisu,
        {
          dane: {
            tytul: 'Źródło światła',
            opis: 'Gdy płomień przygasa, mysz musi zdecydować: zawrócić czy iść dalej w głąb, gdzie żaby strzegą skarbu? Effi, fiolka, flaszka.',
          },
        },
        { czcionki },
      ),
  },
];

for (const p of PRZYPADKI) {
  test(`PDF wygląda jak SVG: ${p.nazwa}`, async ({ page }) => {
    await przygotujStrone(page);
    const { scena, ostrzezenia } = p.wynik();
    expect(ostrzezenia).toEqual([]);
    const { bajty } = await scenyDoPdf([scena], {
      obraz: (z) =>
        z === OBRAZ_ZASTEPCZY ? { dane: new Uint8Array(PNG_ZASTEPCZY), format: 'png' } : undefined,
    });
    const svg = scenaDoSvg(scena, {
      adresObrazu: (z) =>
        z === OBRAZ_ZASTEPCZY
          ? 'data:image/png;base64,' + PNG_ZASTEPCZY.toString('base64')
          : undefined,
    });
    const w = await porownaj(page, svg, bajty);
    test.info().annotations.push({ type: 'porównanie', description: JSON.stringify(w) });
    console.info(p.nazwa, w);
    // Coś narysowano i oba obrazy mają podobną ilość „tuszu”.
    expect(w.ciemneSvg).toBeGreaterThan(w.wszystkie * 0.01);
    expect(Math.abs(w.ciemnePdf - w.ciemneSvg) / w.ciemneSvg).toBeLessThan(0.05);
    // Piksele wyraźnie różne: tylko krawędzie po wygładzaniu.
    expect(w.rozne / w.wszystkie).toBeLessThan(0.001);
  });
}
