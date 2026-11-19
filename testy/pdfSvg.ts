import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

/**
 * Porównanie PDF (pdf.js) z SVG (Chromium) tej samej sceny – wspólne dla testów „podgląd = wydruk”.
 */

export const PX_NA_MM = 12;
const ADRES = 'http://karty.test/';
const pdfjs = readFileSync('node_modules/pdfjs-dist/build/pdf.min.mjs');
const pdfjsWorker = readFileSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs');

export async function przygotujStrone(page: Page) {
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

export interface Porownanie {
  rozne: number;
  wszystkie: number;
  ciemneSvg: number;
  ciemnePdf: number;
}

/** Opcjonalnie liczy piksele w prostokącie sceny podanym w mm. */
export async function porownaj(
  page: Page,
  svg: string,
  pdf: Uint8Array,
  obszar?: { x: number; y: number; szer: number; wys: number },
): Promise<Porownanie> {
  return page.evaluate(
    async ({ svg, pdf, pxNaMm, obszar }) => {
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

      const x = obszar ? Math.floor(obszar.x * pxNaMm) : 0;
      const y = obszar ? Math.floor(obszar.y * pxNaMm) : 0;
      const w = obszar ? Math.ceil((obszar.x + obszar.szer) * pxNaMm) - x : szer;
      const h = obszar ? Math.ceil((obszar.y + obszar.wys) * pxNaMm) - y : wys;
      const a = pctx.getImageData(x, y, w, h).data;
      const b = sctx.getImageData(x, y, w, h).data;
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
    { svg, pdf: [...pdf], pxNaMm: PX_NA_MM, obszar },
  );
}
