import { expect, test, type Page } from '@playwright/test';

/** Tworzy szablon z polem Tekst („Nazwa”) i nowy projekt w kroku Karty. */
async function utworzProjektWKrokuKarty(page: Page) {
  await page.goto('./');
  await page.getByTestId('start-nowy-szablon').click();
  const oknoSz = page.getByTestId('okno-nowy-szablon');
  await oknoSz.getByRole('button', { name: 'Utwórz szablon' }).click();
  await expect(page).toHaveURL(/#\/szablon\/[^/]+$/, { timeout: 15000 });
  await expect(page.locator('.karta-podgladu')).toBeVisible();

  // Dodajemy pole tekstowe, żeby CSV mógł mapować kolumnę.
  const pasekEdytora = page.getByRole('navigation', { name: 'Dodaj element' });
  await pasekEdytora.getByRole('button', { name: 'Tekst', exact: true }).click();
  await page
    .locator('header.ui2-naglowek')
    .getByRole('button', { name: 'Zapisz', exact: true })
    .click();
  await expect(page.locator('header.ui2-naglowek')).toContainText(/zapisano/i);

  await page.getByRole('link', { name: '← Szablony' }).click();
  await expect(page.getByTestId('kafelek-szablonu')).toHaveCount(1, { timeout: 10000 });

  await page.getByTestId('start-nowe-karty').click();
  const okno = page.getByTestId('okno-nowy-projekt');
  await okno.getByTestId('np-lista-szablonow').locator('button').first().click();
  await okno.getByRole('button', { name: 'Utwórz projekt' }).click();
  await expect(page).toHaveURL(/#\/projekt\/[^/]+\/karty$/, { timeout: 15000 });
  await expect(page.getByTestId('pasek-stanu-kart')).toBeVisible();
}

test('R12: Krok Karty – pojedynczy stan zapisu, brak „+ +” oraz Import z CSV / Excela', async ({
  page,
}) => {
  await utworzProjektWKrokuKarty(page);

  // W nagłówku kroku Karty jest dokładnie jeden element stanu zapisu (bez starego .status-zapisu).
  const naglowek = page.locator('header.ui2-naglowek');
  await expect(naglowek.locator('.ui2-stan-zapisu, .ui2-stan-zapisu-btn')).toHaveCount(1);
  await expect(naglowek.locator('.status-zapisu')).toHaveCount(0);

  // W lewym pasku nie ma zdublowanego „+ +” przy Nowy szablon.
  const pasekKart = page.getByRole('navigation', { name: 'Dodaj karty' });
  await expect(pasekKart).not.toContainText(/\+\s*[+＋]/);

  // Przycisk „Import z CSV / Excela” otwiera okno importu i dodaje karty z małego pliku CSV.
  await pasekKart.getByRole('button', { name: 'Import z CSV / Excela' }).click();
  const dialog = page.locator('dialog.dialog-importu-tabeli');
  await expect(dialog).toBeVisible();

  const csv = 'tekst,Ilosc\nKula ognia,2\nTarcza,1\n';
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'zaklecia.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });

  // Zmapuj pierwszą kolumnę (tekst) na pierwsze pole szablonu, jeśli nie zmapowało się automatycznie.
  const pierwszeMapowanie = dialog.locator('fieldset select').first();
  if ((await pierwszeMapowanie.inputValue()) === '') {
    await pierwszeMapowanie.selectOption('0');
  }
  await dialog.getByRole('button', { name: 'Dodaj karty' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByTestId('kafelek-karty')).toHaveCount(2);
  await expect(page.getByTestId('kafelek-karty').first()).toContainText('Kula ognia');
});

test('R12: Ekran Druk – nagłówek UI2, brak starych sekcji i odznaczanie w Karty w druku', async ({
  page,
}) => {
  await utworzProjektWKrokuKarty(page);

  // Dodajemy dwie karty w kroku Karty, zapisujemy i przechodzimy do Druku.
  const pasekKart = page.getByRole('navigation', { name: 'Dodaj karty' });
  const btnSzablon = pasekKart.locator('.ui2-pasek-grupa').first().locator('button').first();
  await btnSzablon.click();
  await btnSzablon.click();
  await page.getByRole('button', { name: 'Zapisz', exact: true }).click();
  await expect(page.locator('header.ui2-naglowek')).toContainText(/zapisano/i);

  await page.getByRole('link', { name: 'Do druku →' }).click();
  await expect(page).toHaveURL(/#\/projekt\/[^/]+\/drukuj$/, { timeout: 15000 });

  // Nagłówek ekranu Druk nie zawiera Eksportuj, Powrót, Biblioteki; zawiera Pobierz PDF.
  const naglowek = page.locator('header.ui2-naglowek');
  await expect(naglowek).toBeVisible();
  await expect(naglowek.getByRole('button', { name: /Eksportuj/ })).toHaveCount(0);
  await expect(naglowek.getByRole('link', { name: /Powrót/ })).toHaveCount(0);
  await expect(naglowek.getByRole('link', { name: /Biblioteki/ })).toHaveCount(0);
  await expect(naglowek.getByRole('button', { name: /Pobierz PDF/ })).toBeVisible();

  // W panelu Ustawienia druku nie ma „Nowy tył” ani „Katalog Google Fonts”.
  const panel = page.getByRole('complementary', { name: 'Ustawienia druku' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Nowy tył' })).toHaveCount(0);
  await expect(panel).not.toContainText('Katalog Google Fonts');

  // Odznaczenie karty w „Karty w druku” zmniejsza liczbę kart w podsumowaniu bez zmiany stanu zapisu.
  const podsumowanie = page.getByTestId('podsumowanie-druku');
  await expect(podsumowanie).toContainText(/^2 kart\b/);

  const lista = page.getByTestId('lista-kart-druku');
  await lista.locator('button.druk-ui2-karta-czek').first().click();
  await expect(podsumowanie).toContainText(/^1 kart\b/);
  await expect(naglowek).toContainText(/zapisano/i);

  // Wyrównanie linii: wysokości nagłówków lewego paska, paska roboczego i prawego panelu są równe.
  const hLewo = await page
    .locator('.ui2-pasek-boczny-naglowek')
    .evaluate((el) => el.getBoundingClientRect().height);
  const hSrodek = await page
    .locator('.druk-ui2-pasek-gorny')
    .evaluate((el) => el.getBoundingClientRect().height);
  const hPrawo = await page
    .locator('.ui2-panel-naglowek')
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(Math.abs(hLewo - hSrodek)).toBeLessThanOrEqual(1);
  expect(Math.abs(hSrodek - hPrawo)).toBeLessThanOrEqual(1);
});
