import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

/** Projekty w IndexedDB: nowy z pakietu, arkusze z projektu, eksport, import, usuwanie (E7a). */

async function pobierz(page: Page, przycisk: () => Promise<void>) {
  const [pobranie] = await Promise.all([page.waitForEvent('download'), przycisk()]);
  return { nazwa: pobranie.suggestedFilename(), sciezka: await pobranie.path() };
}

test('nowy projekt z pakietu → arkusze i PDF → eksport → import jako kopia → usunięcie', async ({
  page,
}) => {
  await page.goto('./#/projekty');
  await expect(page.getByText('Nie masz jeszcze żadnych projektów.')).toBeVisible();

  await page.getByRole('button', { name: /Nowy projekt z pakietu/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Mausritter/ })).toBeVisible();
  await expect(page.getByText(/Karty stanów – \d+ kart/)).toBeVisible();

  await page.getByRole('link', { name: /Podgląd i PDF arkuszy \(3\)/ }).click();
  await expect(page.getByRole('img', { name: 'Strona 1' })).toBeVisible();
  // Obrazy z biblioteki projektu jako blob:, nie data:.
  const href = await page.locator('.strona-arkusza image').first().getAttribute('href');
  expect(href).toMatch(/^blob:/);
  const pdf = await pobierz(page, () => page.getByRole('button', { name: 'Pobierz PDF' }).click());
  expect(pdf.nazwa).toBe('mausritter-arkusz-bron.pdf');
  expect((await PDFDocument.load(readFileSync(pdf.sciezka))).getPageCount()).toBe(1);

  await page.getByRole('link', { name: 'Projekty' }).first().click();
  const wiersz = page.getByRole('listitem').filter({ hasText: 'Mausritter' });
  await expect(wiersz).toHaveCount(1);
  const eksport = await pobierz(page, () =>
    wiersz.getByRole('button', { name: 'Eksportuj' }).click(),
  );
  expect(eksport.nazwa).toMatch(/\.kartyrpg$/);

  // Import tego samego pliku – kolizja id → pytanie; wybór „jako kopię”.
  await page.getByTestId('plik-projektu').setInputFiles(eksport.sciezka);
  await expect(page.getByRole('alertdialog')).toContainText('jest już w tej przeglądarce');
  await page.getByRole('button', { name: 'Zapisz jako kopię' }).click();
  await expect(page.getByRole('status')).toContainText('Zaimportowano');
  await expect(page.getByRole('listitem').filter({ hasText: 'Mausritter' })).toHaveCount(2);
  await expect(page.getByRole('link', { name: /\(kopia\)/ })).toBeVisible();

  // Usunięcie kopii z potwierdzeniem.
  await page
    .getByRole('listitem')
    .filter({ hasText: '(kopia)' })
    .getByRole('button', { name: 'Usuń' })
    .click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Mausritter' })).toHaveCount(1);

  // Projekt przetrwał przeładowanie strony (IndexedDB).
  await page.reload();
  await expect(page.getByRole('listitem').filter({ hasText: 'Mausritter' })).toHaveCount(1);
});

test('import uszkodzonego pliku – komunikat po polsku', async ({ page }) => {
  await page.goto('./#/projekty');
  await page.getByTestId('plik-projektu').setInputFiles({
    name: 'zly.kartyrpg',
    mimeType: 'application/zip',
    buffer: Buffer.from('to nie jest zip'),
  });
  await expect(page.getByRole('alert')).toHaveText(/nie jest poprawny plik \.kartyrpg/);
});

test('nieistniejący projekt – komunikat i powrót do listy', async ({ page }) => {
  await page.goto('./#/projekt/nie-ma');
  await expect(page.getByRole('alert')).toContainText('Nie ma projektu „nie-ma”');
  await expect(page.getByRole('link', { name: 'Wróć do listy projektów' })).toBeVisible();
});
