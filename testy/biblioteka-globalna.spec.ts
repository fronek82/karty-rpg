import { readFile } from 'node:fs/promises';
import { expect, test, type Download, type Locator, type Page } from '@playwright/test';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { WERSJA_SCHEMATU } from '../src/model/projekt';
import { nowaPustaKartka, zapisano } from './pomoc';

const nazwa = 'Karta geometryczna';
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

async function otworzSzablony(page: Page) {
  await page.getByText('Globalna biblioteka szablonów', { exact: true }).click();
  return page.locator('details.biblioteka-globalna');
}

test('globalny szablon trafia na własną kartkę projektu pakietowego i można odtworzyć go z pliku', async ({
  page,
  browser,
}) => {
  await page.goto('./#/wlasne');
  const katalog = await otworzSzablony(page);
  const dane = {
    wersja: WERSJA_SCHEMATU,
    szablon: {
      id: 'geometria',
      nazwa,
      rozmiar: { tryb: 'mm', szerokosc: 25.75, wysokosc: 25.75 },
      korzen: { id: 'karta', typ: 'kolumna', dzieci: [] },
    },
    role: {},
    zasoby: [],
  };
  await katalog.getByTestId('globalna-import-szablon').setInputFiles({
    name: 'geometria.kartyrpg-szablon',
    mimeType: 'application/zip',
    buffer: Buffer.from(zipSync({ 'szablon.json': strToU8(JSON.stringify(dane)) })),
  });
  const plik = await pobierz(
    page,
    katalog.getByRole('button', { name: /Pobierz „Karta geometryczna”/ }),
  );
  expect(plik.name).toMatch(/\.kartyrpg-szablon$/);
  const czysta = await browser.newContext({
    locale: 'pl-PL',
    baseURL: new URL('.', page.url()).href,
  });
  try {
    const nowa = await czysta.newPage();
    await nowa.goto('./#/wlasne');
    const docelowy = await otworzSzablony(nowa);
    await expect(docelowy.getByText('Biblioteka jest pusta.')).toBeVisible();
    await docelowy.getByTestId('globalna-import-szablon').setInputFiles(plik);
    await docelowy.getByRole('button', { name: /Użyj „Karta geometryczna”/ }).click();
    await expect(nowa.locator('.strona-kartki')).toBeVisible();
  } finally {
    await czysta.close();
  }

  await nowaPustaKartka(page);
  const kartki = page.locator('.kartka');
  expect(await kartki.count()).toBe(1);
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  const ustawienia = await otworzSzablony(page);
  await ustawienia.getByRole('button', { name: /Użyj „Karta geometryczna”/ }).click();
  await expect(kartki).toHaveCount(2);
  await page.getByRole('button', { name: 'Cofnij', exact: true }).click();
  await expect(kartki).toHaveCount(1);
  await ustawienia.getByRole('button', { name: /Użyj „Karta geometryczna”/ }).click();
  await expect(kartki).toHaveCount(2);
  await zapisano(page);
  await page.reload();
  await expect(kartki).toHaveCount(2);
  await kartki
    .first()
    .getByRole('button', { name: /Pusty slot.*kolumna 1, rząd 1\./ })
    .click();
  await expect(page.getByRole('menuitem', { name: /Broń/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Karta geometryczna/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  const slot = kartki.last().getByRole('button', { name: /Pusty slot.*kolumna 1, rząd 1\./ });
  const ustawieniaWlasnejKartki = async () => {
    await page.getByRole('button', { name: /Ustawienia/ }).click();
    await page.getByRole('button', { name: 'Nowa kartka dla szablonu Karta geometryczna' }).click();
  };
  await ustawieniaWlasnejKartki();
  await page.getByLabel('Układ kart na kartce').selectOption('wlasny');
  const szerokoscSlotu = page.getByLabel('Szerokość karty (mm)', { exact: true });
  await szerokoscSlotu.fill('30');
  await slot.click();
  const wlasnyTyp = page.getByRole('menuitem', { name: /Karta geometryczna/ });
  await expect(wlasnyTyp).toHaveAttribute('aria-disabled', 'true');
  await expect(wlasnyTyp).toContainText('Inny rozmiar karty');
  await page.keyboard.press('Escape');
  await ustawieniaWlasnejKartki();
  await szerokoscSlotu.fill('25.75');
  await slot.click();
  await expect(page.getByRole('menuitem', { name: /Broń/ })).toHaveCount(0);
  await wlasnyTyp.click();
  await expect(kartki.last().locator('[data-karta]')).toHaveCount(1);
  await page.getByRole('link', { name: /Edytuj szablon/ }).click();
  await expect(page.getByLabel('Nazwa szablonu')).toHaveValue(nazwa);
  await page.getByRole('link', { name: '← Kartki' }).click();
  await expect(kartki).toHaveCount(2);
  const projekt = await pobierz(page, page.getByRole('button', { name: /^⤓ Eksportuj$/ }));
  const pustaBaza = await browser.newContext({
    locale: 'pl-PL',
    baseURL: new URL('.', page.url()).href,
  });
  try {
    const nowa = await pustaBaza.newPage();
    await nowa.goto('./#/');
    await nowa.getByTestId('plik-importu').setInputFiles(projekt);
    await nowa.locator('.kafelek-projektu').first().click();
    await expect(nowa.locator('.kartka')).toHaveCount(2);
    await expect(nowa.locator('.kartka').last().locator('[data-karta]')).toHaveCount(1);
    await nowa.goto(`${nowa.url()}/szablon/mausritter-bron`);
    await expect(nowa.getByRole('alert')).toContainText('Szablony z pakietu gry');
  } finally {
    await pustaBaza.close();
  }

  await page.getByRole('button', { name: /Ustawienia/ }).click();
  const biblioteka = await otworzSzablony(page);
  page.once('dialog', (dialog) => void dialog.accept());
  await biblioteka.getByRole('button', { name: /Usuń „Karta geometryczna”/ }).click();
  await expect(biblioteka.getByText('Biblioteka jest pusta.')).toBeVisible();
  await page
    .getByRole('button', { name: /Zapisz „Karta geometryczna” w bibliotece globalnej/ })
    .click();
  await expect(
    page.getByText('Zapisano „Karta geometryczna” w bibliotece globalnej.', { exact: true }),
  ).toBeVisible();
  if (process.env.ZRZUTY) {
    await page.locator('.biblioteka-globalna').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'docs/obrazy/m2c-1-biblioteka-szablonow.png' });
  }
});

test('globalna ramka z PNG przechodzi między przeglądarkami i zachowuje lokalną kopię po usunięciu wpisu', async ({
  page,
  browser,
}) => {
  await nowaPustaKartka(page);
  await page.getByRole('button', { name: /Ustawienia/ }).click();
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
    await nowa.getByRole('button', { name: /Ustawienia/ }).click();
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
    nowa.once('dialog', (dialog) => void dialog.accept());
    await panel
      .getByRole('button', { name: /Usuń „ramka-testowa” z biblioteki globalnej/ })
      .click();
    await expect(panel.getByText('Biblioteka jest pusta.')).toBeVisible();
    await expect(lokalna).toBeVisible();
    await nowa.reload();
    await nowa
      .getByTestId('lista-wlasnych')
      .getByRole('button', { name: new RegExp(ramka) })
      .click();
    await expect(nowa.getByTestId('edytor-ramki9')).toContainText('120×120 px');
  } finally {
    await czysta.close();
  }
});
