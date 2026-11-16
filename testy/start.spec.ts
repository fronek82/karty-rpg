import { expect, test } from '@playwright/test';

test('strona startowa wyświetla się po polsku', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'Karty RPG' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
});

test('nieznana trasa pokazuje komunikat i link powrotu', async ({ page }) => {
  await page.goto('./#/nie-ma-takiej');
  await expect(page.getByRole('heading', { name: 'Nie ma takiej strony.' })).toBeVisible();
  await page.getByRole('link', { name: 'Wróć na stronę startową' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Karty RPG' })).toBeVisible();
});
