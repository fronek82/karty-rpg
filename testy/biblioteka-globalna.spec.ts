import { readFile } from 'node:fs/promises';
import { expect, test, type Download, type Page } from '@playwright/test';
import { unzipSync, zipSync } from 'fflate';

/**
 * N8: ozdobnik z biblioteki użytkownika przechodzi między przeglądarkami jako paczka
 * `.kartyrpg-ozdobnik`; uszkodzona paczka jest odrzucana, ponowne dodanie nie dubluje wpisu.
 */

async function zPliku(pobranie: Download) {
  return {
    name: pobranie.suggestedFilename(),
    mimeType: 'application/zip',
    buffer: await readFile((await pobranie.path())!),
  };
}

const ozdobniki = (page: Page) => page.goto('./#/biblioteki/ozdobniki');

test('ramka z PNG: pobranie paczki, import w czystej przeglądarce bez duplikatów', async ({
  page,
  browser,
}) => {
  await ozdobniki(page);
  await page.getByTestId('plik-png').setInputFiles('testy/zasoby/ramka-testowa.png');
  const siatka = page.getByTestId('siatka-biblioteki');
  await expect(siatka.getByRole('listitem')).toHaveCount(1, { timeout: 15000 });
  const [pobranie] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Pobierz „ramka-testowa”' }).click(),
  ]);
  const plik = await zPliku(pobranie);
  expect(plik.name).toMatch(/\.kartyrpg-ozdobnik$/);

  const czysta = await browser.newContext({
    locale: 'pl-PL',
    baseURL: new URL('.', page.url()).href,
  });
  try {
    const nowa = await czysta.newPage();
    await ozdobniki(nowa);
    const wejscie = nowa.getByTestId('plik-ozdobnika-globalny');
    const zawartosc = unzipSync(plik.buffer);
    const nazwaObrazu = Object.keys(zawartosc).find((n) => n.startsWith('zasoby/'))!;
    zawartosc[nazwaObrazu] = zawartosc[nazwaObrazu]!.subarray(0, 33);
    await wejscie.setInputFiles({ ...plik, buffer: Buffer.from(zipSync(zawartosc)) });
    await expect(nowa.getByRole('alert')).toContainText('jest nieczytelny');
    await expect(nowa.getByText('Nie ma jeszcze zapisanych ozdobników.')).toBeVisible();

    await wejscie.setInputFiles(plik);
    const kafelki = nowa.getByTestId('siatka-biblioteki').getByRole('listitem');
    await expect(kafelki).toHaveCount(1, { timeout: 15000 });
    await expect(nowa.getByTestId('edytor-ramki9')).toContainText('120×120 px');
    // Ta sama paczka drugi raz – ten sam wpis.
    await wejscie.setInputFiles(plik);
    await expect(nowa.getByRole('status')).toContainText('ramka-testowa');
    await expect(kafelki).toHaveCount(1);

    if (process.env.ZRZUTY)
      await nowa.screenshot({ path: 'docs/obrazy/m2c-1-biblioteka-ozdobnikow.png' });
  } finally {
    await czysta.close();
  }
});
