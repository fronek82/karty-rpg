import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { scenyDoPdf } from '../src/druk/pdf';
import { pt } from '../src/model/jednostki';
import type { Szablon } from '../src/model/szablon';
import { renderujKarte } from '../src/silnik/karta';
import { scenaDoSvg } from '../src/silnik/svg';
import { rejestrTestowy } from '../src/silnik/__testy__/pomoc';
import { porownaj, przygotujStrone } from './pdfSvg';
import {
  kliknijPobierzPdf,
  otworzDruk,
  otworzUstawieniaAplikacji,
  panelDruku,
  zapisano,
} from './pomoc';

/**
 * M5-4: opcjonalna niewidoczna warstwa tekstowa w PDF (`3 Tr`):
 * 1. Zgodność pikseli PDF z warstwą tekstową ↔ SVG oraz 0 różnic pikseli względem PDF bez warstwy.
 * 2. Przełącznik w Ustawieniach (PL i EN), zapamiętywanie w localStorage i pobranie PDF z tekstem PL.
 */

const czcionki = rejestrTestowy();

const szablonTestowy: Szablon = {
  id: 'tekst-parytet',
  nazwa: 'Karta testowa',
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 44 },
  tlo: '#fbf6ea',
  korzen: {
    id: 'k',
    typ: 'kolumna',
    padding: 3,
    odstep: 1.5,
    obramowanie: { grubosc: 0.35, kolor: '#2c3e50' },
    dzieci: [
      {
        id: 'tytul',
        typ: 'tekst',
        klucz: 'tytul',
        styl: { czcionka: 'tytul', wariant: 'pogrubiony', rozmiar: pt(12), wyrownanie: 'srodek' },
      },
      {
        id: 'opis',
        typ: 'tekst',
        klucz: 'opis',
        styl: { czcionka: 'tresc', rozmiar: pt(8.5) },
      },
    ],
  },
};

test('niewidoczna warstwa tekstowa (3 Tr) nie zmienia ani jednego piksela względem PDF i zgadza się z SVG', async ({
  page,
}) => {
  await przygotujStrone(page);
  const { scena } = renderujKarte(
    szablonTestowy,
    {
      dane: {
        tytul: 'Zażółć gęślą jaźń',
        opis: 'ĄĆĘŁŃÓŚŹŻ – niewidoczna warstwa tekstowa w PDF.',
      },
    },
    { czcionki },
  );
  const svg = scenaDoSvg(scena);
  const pdfBez = (await scenyDoPdf([scena])).bajty;
  const pdfZ = (await scenyDoPdf([scena], { warstwaTekstowa: true })).bajty;

  // Parytet wizualny PDF z warstwą tekstową ↔ SVG.
  const wynik = await porownaj(page, svg, pdfZ);
  expect(wynik.rozne / wynik.wszystkie).toBeLessThan(0.005);

  // Identyczność piksel po pikselu między PDF bez warstwy i z warstwą tekstową (0 różnych pikseli).
  const roznicaPdf = await page.evaluate(
    async ({ a, b }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lib = (globalThis as any).pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
      const renderuj = async (dane: number[]) => {
        const dok = await lib.getDocument({ data: new Uint8Array(dane) }).promise;
        const strona = await dok.getPage(1);
        const vp = strona.getViewport({ scale: 2 });
        const c = new OffscreenCanvas(Math.round(vp.width), Math.round(vp.height));
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        await strona.render({ canvas: c, canvasContext: ctx, viewport: vp, background: '#ffffff' })
          .promise;
        const tekst = (await strona.getTextContent()).items
          .map((i: { str?: string }) => i.str ?? '')
          .join(' ');
        return { piksele: ctx.getImageData(0, 0, c.width, c.height).data, tekst };
      };
      const r1 = await renderuj(a);
      const r2 = await renderuj(b);
      let rozne = 0;
      for (let i = 0; i < r1.piksele.length; i++) {
        if (r1.piksele[i] !== r2.piksele[i]) rozne++;
      }
      return { rozne, tekstBez: r1.tekst, tekstZ: r2.tekst };
    },
    { a: [...pdfBez], b: [...pdfZ] },
  );
  expect(roznicaPdf.rozne).toBe(0);
  expect(roznicaPdf.tekstBez.trim()).toBe('');
  expect(roznicaPdf.tekstZ).toContain('Zażółć gęślą jaźń');
  expect(roznicaPdf.tekstZ).toContain('ĄĆĘŁŃÓŚŹŻ');
});

test('przełącznik warstwy tekstowej PDF w Ustawieniach działa (PL/EN), pamięta wybór i zapisuje tekst do PDF', async ({
  page,
}) => {
  await page.goto('./#/wlasne');
  await page.getByRole('button', { name: 'Karta z opisem' }).click();
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });

  // Wpisz polskie znaki w tytule karty.
  await page.locator('[data-karta]').first().click();
  const panelKart = page.getByRole('complementary', { name: /Zaznaczona karta|Zaznaczone karty/ });
  const poleTytul = panelKart.getByLabel('Nazwa');
  await poleTytul.fill('Żółty kompas łąkowy');
  await zapisano(page);

  // Otwórz widok drukowania i włącz niewidoczną warstwę tekstową PDF.
  const ustawienia = await otworzDruk(page);
  const przelacznik = ustawienia.getByLabel(/Niewidoczna warstwa tekstowa w PDF/);
  await expect(przelacznik).not.toBeChecked();
  await przelacznik.check();
  await expect(przelacznik).toBeChecked();

  // Przeładuj i potwierdź zapamiętanie w localStorage + etykietę EN.
  await zapisano(page);
  await page.reload();
  await expect(panelDruku(page)).toBeVisible({ timeout: 15000 });
  const menuUst = await otworzUstawieniaAplikacji(page);
  await menuUst.getByRole('button', { name: 'EN', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(panelDruku(page, true).getByLabel(/Invisible text layer in PDF/)).toBeChecked();

  // Pobierz PDF i sprawdź zawartość tekstową w pdfjs-dist.
  const [pobranie] = await Promise.all([
    page.waitForEvent('download'),
    kliknijPobierzPdf(page, true),
  ]);
  const sciezka = await pobranie.path();
  expect(sciezka).toBeTruthy();
  const bajty = new Uint8Array(await readFile(sciezka!));
  const zadanie = getDocument({ data: bajty, verbosity: 0 });
  const dok = await zadanie.promise;
  const strona = await dok.getPage(1);
  const tresc = (await strona.getTextContent()).items
    .map((i) => ('str' in i ? i.str : ''))
    .join(' ');
  await zadanie.destroy();
  expect(tresc).toContain('Żółty kompas łąkowy');
});
