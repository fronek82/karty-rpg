import { expect, test } from '@playwright/test';

test('start: wybór gry po polsku, pusta lista projektów', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Karty do gier – zaprojektuj i wydrukuj' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Stwórz karty do Mausrittera/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Stwórz własne karty/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Moje projekty' })).toBeVisible();
  await expect(page.getByText('Nie masz jeszcze żadnych projektów.')).toBeVisible();
});

test('własne karty: zapowiedź edytora od zera, bez listy gier; stara trasa działa', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.getByText('Od zera: własny rozmiar karty i własny układ pól')).toBeVisible();
  await page.getByRole('link', { name: /Stwórz własne karty/ }).click();
  await expect(page).toHaveURL(/#\/wlasne$/);
  const naglowek = page.getByRole('heading', {
    level: 1,
    name: 'Edytor własnych kart – w budowie',
  });
  await expect(naglowek).toBeVisible();
  for (const gra of ['Dungeons & Dragons', 'Warhammer', 'Jedyny Pierścień'])
    await expect(page.getByText(gra)).toHaveCount(0);
  await page.goto('./#/gry/inne');
  await expect(naglowek).toBeVisible();
});

test('Mausritter: drugi ekran z pustą kartką i gotowymi układami', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('link', { name: /Stwórz karty do Mausrittera/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Karty do Mausrittera' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Pusta kartka/ })).toBeEnabled();
  for (const u of ['Broń i pancerze', 'Wyposażenie', 'Stany', 'Wszystkie trzy'])
    await expect(page.getByRole('button', { name: u, exact: true })).toBeVisible();
});

test('nieznana trasa i dawne trasy', async ({ page }) => {
  await page.goto('./#/nie-ma-takiej');
  await expect(page.getByRole('heading', { name: 'Nie ma takiej strony.' })).toBeVisible();
  await page.getByRole('link', { name: 'Wróć na stronę startową' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Karty do gier/ })).toBeVisible();
  await page.goto('./#/arkusze');
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('./#/projekt/nie-ma');
  await expect(page.getByRole('alert')).toContainText('Nie ma projektu „nie-ma”');
});
