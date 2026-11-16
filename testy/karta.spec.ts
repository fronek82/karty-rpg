import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/** Podgląd karty i ustawienia obrazu (E7c). */

async function taliaBroni(page: Page) {
  await page.goto('./#/projekty');
  await page.getByRole('button', { name: /Nowy projekt z pakietu/ }).click();
  await page.getByRole('link', { name: 'Karty broni i pancerzy' }).click();
}

const obraz = (page: Page) => page.locator('.podglad-karty image');

test('podgląd karty, skala polem i myszą, przesunięcie przeciąganiem, reset', async ({ page }) => {
  await taliaBroni(page);
  // Domyślnie zaznaczona pierwsza karta – podgląd z ilustracją.
  await expect(page.getByRole('img', { name: 'Podgląd karty' })).toBeVisible();
  await expect(obraz(page)).toHaveCount(1);
  const reset = page.getByRole('button', { name: 'Resetuj' });
  await expect(reset).toBeDisabled();

  // Wybór innej karty klikiem w wiersz.
  await page.getByLabel('Nazwa, karta 2', { exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Wybrana karta' })).toContainText('Igła');

  const przed = await obraz(page).boundingBox();
  await page.getByLabel('Skala').fill('2');
  await expect(reset).toBeEnabled();
  const po = await obraz(page).boundingBox();
  expect(po!.width).toBeGreaterThan(przed!.width * 1.5);

  // Przeciąganie przesuwa obraz (pola X/Y w mm rosną).
  const podglad = page.locator('.podglad-karty svg');
  const r = (await podglad.boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + 30, r.y + r.height / 2 + 15, { steps: 5 });
  await page.mouse.up();
  expect(Number(await page.getByLabel('X (mm)').inputValue())).toBeGreaterThan(3);
  expect(Number(await page.getByLabel('Y (mm)').inputValue())).toBeGreaterThan(1);

  // Kółko myszy zmniejsza skalę.
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.wheel(0, 100);
  await expect(page.getByLabel('Skala')).toHaveValue(String(Math.round((2 / 1.1) * 1000) / 1000));

  await page.getByLabel('Obrót (°)').fill('15');
  await expect(page.getByRole('status')).toHaveText('Zapisano');
  await page.reload();
  await page.getByLabel('Nazwa, karta 2', { exact: true }).click();
  await expect(page.getByLabel('Obrót (°)')).toHaveValue('15');

  await page.getByRole('button', { name: 'Resetuj' }).click();
  await expect(page.getByLabel('Skala')).toHaveValue('1');
  await expect(page.getByLabel('Obrót (°)')).toHaveValue('0');
});

test('wgranie obrazu do biblioteki i przypisanie do karty', async ({ page }) => {
  await taliaBroni(page);
  await page.getByTestId('plik-obrazu').setInputFiles({
    name: 'Mój miecz.png',
    mimeType: 'image/png',
    buffer: readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png'),
  });
  await expect(page.getByLabel('Plik:')).toHaveValue('obraz-Moj-miecz');
  await expect(page.getByLabel('Obraz, karta 1', { exact: true })).toHaveValue('obraz-Moj-miecz');
  await expect(obraz(page)).toHaveAttribute('href', /^blob:/);

  // Zły plik – komunikat po polsku.
  await page.getByTestId('plik-obrazu').setInputFiles({
    name: 'a.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('GIF89a'),
  });
  await expect(page.getByRole('alert')).toHaveText(/nie jest obrazem PNG ani JPG/);

  await page.reload();
  await expect(page.getByLabel('Obraz, karta 1', { exact: true })).toHaveValue('obraz-Moj-miecz');
});
