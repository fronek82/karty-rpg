import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

/** Biblioteka czcionek i role (E7d). */

test('wgranie czcionki, nazwa rodziny, rola, czcionka zapasowa', async ({ page }) => {
  await page.goto('./#/projekty');
  await page.getByRole('button', { name: /Nowy projekt z pakietu/ }).click();
  await page.getByRole('link', { name: /Czcionki i role \(6 plików\)/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Czcionki' })).toBeVisible();
  const tytul = page.getByLabel('Rodzina dla roli „Tytuł”');
  await expect(tytul).toHaveValue('Grenze Gotisch');

  await page.getByTestId('plik-czcionki').setInputFiles({
    name: 'Moja czcionka.ttf',
    mimeType: 'font/ttf',
    buffer: readFileSync('public/czcionki/GrenzeGotisch-Regular.ttf'),
  });
  await expect(page.locator('.czcionki').getByRole('status')).toHaveText(
    /Wgrano: Grenze Gotisch \(normalny\)/,
  );
  // Ta sama rodzina i wariant co wbudowana – ostrzeżenie projektu.
  await expect(page.getByText(/Ostrzeżenia projektu/)).toBeVisible();

  // Wgrana czcionka jest w rodzinie „Grenze Gotisch”; wydzielamy ją przez zmianę wariantu
  // na kursywę, a nazwę rodziny wbudowanej zmieniamy – rola idzie za nią.
  await page.getByLabel('Wariant czcionki Moja czcionka.ttf').selectOption('kursywa');
  const nazwa = page.getByLabel('Nazwa rodziny Grenze Gotisch');
  await nazwa.fill('Gotyk');
  await nazwa.press('Enter');
  await expect(tytul).toHaveValue('Gotyk');
  await expect(page.getByText(/Ostrzeżenia projektu/)).toHaveCount(0);

  // Rola bez rodziny → podgląd karty z czcionką zapasową i ostrzeżeniem.
  await tytul.selectOption('');
  await expect(page.locator('.status-zapisu')).toHaveText('Zapisano');
  await page.getByRole('link', { name: /Mausritter/ }).click();
  await page.getByRole('link', { name: 'Karty stanów' }).click();
  await expect(page.getByRole('img', { name: 'Podgląd karty' })).toBeVisible();
  await expect(
    page.getByText('Brak czcionki dla: Tytuł – użyto czcionki zapasowej.'),
  ).toBeVisible();

  await page.reload();
  await page.goto(page.url().replace(/talia\/.*/, 'czcionki'));
  await expect(page.getByLabel('Rodzina dla roli „Tytuł”')).toHaveValue('');
  // Usunięcie wgranej czcionki.
  await page.getByRole('button', { name: 'Usuń czcionkę Moja czcionka.ttf' }).click();
  await expect(page.locator('.czcionki').getByRole('status')).toHaveText(
    'Usunięto „Moja czcionka.ttf”.',
  );
  await expect(page.locator('.czcionki .plik', { hasText: 'Moja czcionka.ttf' })).toHaveCount(0);
});

test('zły plik czcionki – komunikat po polsku', async ({ page }) => {
  await page.goto('./#/projekty');
  await page.getByRole('button', { name: /Nowy projekt z pakietu/ }).click();
  await page.getByRole('link', { name: /Czcionki i role/ }).click();
  await page.getByTestId('plik-czcionki').setInputFiles({
    name: 'zla.ttf',
    mimeType: 'font/ttf',
    buffer: Buffer.from('to nie czcionka'),
  });
  await expect(page.getByRole('alert')).toHaveText(/uszkodzony albo to nie czcionka/);
});
