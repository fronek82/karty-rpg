import { readFile } from 'node:fs/promises';
import { expect, test, type Download, type Locator, type Page } from '@playwright/test';
import { unzipSync, zipSync } from 'fflate';
import { nowaPustaKartka, otworzDruk } from './pomoc';

const ramka = 'ramka-testowa';

async function zPliku(pobranie: Download) {
  return {
    name: pobranie.suggestedFilename(),
    mimeType: 'application/zip',
    buffer: await readFile((await pobranie.path())!),
  };
}

async function pobierz(page: Page, przycisk: Locator) {
  const [pobranie] = await Promise.all([page.waitForEvent('download'), przycisk.click()]);
  return zPliku(pobranie);
}

test('globalna ramka z PNG przechodzi między przeglądarkami; usunięcie wpisu usuwa ją z biblioteki użytkownika', async ({
  page,
  browser,
}) => {
  await nowaPustaKartka(page);
  await otworzDruk(page);
  await page.getByRole('link', { name: 'Biblioteka ozdobników', exact: true }).click();
  await page.getByTestId('plik-png').setInputFiles('testy/zasoby/ramka-testowa.png');
  await page.getByRole('button', { name: /Zapisz „ramka-testowa” w bibliotece globalnej/ }).click();
  await page.getByText('Globalna biblioteka ozdobników', { exact: true }).click();
  const biblioteka = page.locator('details.biblioteka-globalna');
  const plik = await pobierz(
    page,
    biblioteka.getByRole('button', { name: /Pobierz „ramka-testowa”/ }),
  );
  expect(plik.name).toMatch(/\.kartyrpg-ozdobnik$/);

  const czysta = await browser.newContext({
    locale: 'pl-PL',
    baseURL: new URL('.', page.url()).href,
  });
  try {
    const nowa = await czysta.newPage();
    await nowaPustaKartka(nowa);
    await otworzDruk(nowa);
    await nowa.getByRole('link', { name: 'Biblioteka ozdobników', exact: true }).click();
    await nowa.getByText('Globalna biblioteka ozdobników', { exact: true }).click();
    const panel = nowa.locator('details.biblioteka-globalna');
    const zawartosc = unzipSync(plik.buffer);
    const nazwaObrazu = Object.keys(zawartosc).find((n) => n.startsWith('zasoby/'))!;
    zawartosc[nazwaObrazu] = zawartosc[nazwaObrazu]!.subarray(0, 33);
    await panel.getByTestId('globalna-import-ozdobnik').setInputFiles({
      ...plik,
      buffer: Buffer.from(zipSync(zawartosc)),
    });
    await expect(panel.getByRole('alert')).toContainText('jest nieczytelny');
    await expect(panel.getByText('Biblioteka jest pusta.')).toBeVisible();
    await panel.getByTestId('globalna-import-ozdobnik').setInputFiles(plik);
    await panel.getByRole('button', { name: /Użyj „ramka-testowa”/ }).click();
    const lokalna = nowa
      .getByTestId('lista-wlasnych')
      .getByRole('button', { name: new RegExp(ramka) });
    await expect(lokalna).toHaveAttribute('aria-pressed', 'true');
    await expect(nowa.getByTestId('edytor-ramki9')).toContainText('120×120 px');

    if (process.env.ZRZUTY) {
      await panel.scrollIntoViewIfNeeded();
      await nowa.screenshot({ path: 'docs/obrazy/m2c-1-biblioteka-ozdobnikow.png' });
    }
    // Usuwanie wpisu – w „Bibliotekach”. N8: jedna biblioteka użytkownika – ozdobnika nie ma już
    // też w projekcie (szablony rysują w jego miejscu zastępczy rysunek).
    const adresProjektu = nowa.url();
    await nowa.goto('./#/biblioteki/ozdobniki');
    await nowa.getByRole('button', { name: 'Usuń „ramka-testowa” z biblioteki' }).click();
    await expect(nowa.getByText('Nie ma jeszcze zapisanych ozdobników.')).toBeVisible();
    await nowa.goto(adresProjektu);
    await nowa.reload();
    await expect(
      nowa.getByTestId('lista-wlasnych').getByRole('button', { name: new RegExp(ramka) }),
    ).toHaveCount(0);
  } finally {
    await czysta.close();
  }
});
