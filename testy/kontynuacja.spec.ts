import { readFile } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { PDFDocument } from 'pdf-lib';
import { expect, test } from '@playwright/test';
import { kreator, panel, rozmiar, zaznacz, kartaNaKartce } from './szablonUI';
import { kliknijPobierzPdf } from './pomoc';

test('dalsze części opisu pojawiają się na arkuszu i w pobraniu kart', async ({ page }) => {
  await kreator(page, {
    nazwa: 'Karta wyprawy',
    format: 'Standard / Poker',
    uklad: 'Tytuł i opis',
  });
  await zaznacz(page, 'Opis');
  await rozmiar(page, 'Wysokość', 'mm', 17);
  await panel(page).getByRole('checkbox', { name: 'Kontynuuj na następnej karcie' }).check();
  const tekst = 'Przeczytaj kolejne wskazówki i znajdź drogę. '.repeat(10).trim();
  await kartaNaKartce(page, 'Karta wyprawy', { Tytuł: 'Północna droga', Opis: tekst });
  const dalsze = page.getByRole('button', { name: /Północna droga – Ciąg dalszy \d/ });
  await expect(dalsze.first()).toBeVisible();
  const liczba = 1 + (await dalsze.count());
  expect(liczba).toBeGreaterThan(1);
  await expect(page.locator('.ostrzezenia-karty')).toHaveCount(0);

  if (process.env.ZRZUTY_M3_4) await page.screenshot({ path: 'docs/obrazy/m3-4-ciag-dalszy.png' });

  const [pdf] = await Promise.all([page.waitForEvent('download'), kliknijPobierzPdf(page)]);
  const dok = await PDFDocument.load(await readFile(await pdf.path()));
  expect(dok.getPageCount()).toBe(await page.locator('.strona-kartki').count());

  await page.getByRole('button', { name: 'Pobierz', exact: true }).click();
  const [png] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Karty osobno – ZIP z PNG, 300 dpi' }).click(),
  ]);
  const pliki = unzipSync(await readFile(await png.path()));
  expect(Object.keys(pliki)).toHaveLength(liczba);
  expect(Object.keys(pliki).filter((s) => s.includes('ciag-dalszy'))).toHaveLength(liczba - 1);

  await page.getByLabel('Rozmiary kart na kartce').selectOption('mieszane');
  await page.getByRole('link', { name: /Powrót/ }).click();
  await expect(page.getByRole('button', { name: /Północna droga – Ciąg dalszy/ })).toHaveCount(
    liczba - 1,
  );
});
