import { expect, test } from '@playwright/test';

test('start: wybór gry po polsku, pusta lista projektów', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await expect(page.locator('.riso-tytul')).toHaveText('KARTY RPG');
  await expect(page.getByRole('button', { name: /Mausritter A4/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /\+ NOWE KARTY/ })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: /Moje projekty/ })).toBeVisible();
  await expect(page.getByText('Nie masz jeszcze żadnych projektów.')).toBeVisible();
});

test('własne karty: menu z importem, kafelki przykładów, bez listy gier; stara trasa działa', async ({
  page,
}) => {
  await page.goto('./#/wlasne');
  const naglowek = page.getByRole('heading', { level: 1, name: 'Stwórz własne karty' });
  await expect(naglowek).toBeVisible();
  await expect(page.getByRole('link', { name: /Nowy szablon od zera/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Importuj szablon/ })).toBeVisible();
  await expect(page.locator('[data-podglad]')).toHaveCount(6);
  for (const gra of ['Dungeons & Dragons', 'Warhammer', 'Jedyny Pierścień'])
    await expect(page.getByText(gra)).toHaveCount(0);
  await page.goto('./#/gry/inne');
  await expect(naglowek).toBeVisible();
});

test('Mausritter: okno „Od czego zaczynamy?” z pustym arkuszem i gotowymi arkuszami', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByTestId('start-mausritter').click();
  const okno = page.getByTestId('okno-startu-mausritter');
  await expect(okno).toBeVisible();
  await expect(okno.getByRole('heading', { name: 'Od czego zaczynamy?' })).toBeVisible();
  await expect(okno.getByTestId('start-pusty-arkusz')).toBeEnabled();
  for (const u of ['Broń i pancerze', 'Wyposażenie', 'Stany', 'Wszystkie trzy'])
    await expect(okno.getByRole('button', { name: new RegExp(`^${u}`) })).toBeVisible();
});

test('nieznana trasa i dawne trasy', async ({ page }) => {
  await page.goto('./#/nie-ma-takiej');
  await expect(page.getByRole('heading', { name: 'Nie ma takiej strony.' })).toBeVisible();
  await page.getByRole('link', { name: 'Wróć na stronę startową' }).click();
  await expect(page.locator('.riso-tytul')).toHaveText('KARTY RPG');
  await page.goto('./#/arkusze');
  await expect(page).toHaveURL(/#\/$/);
  await page.goto('./#/projekt/nie-ma');
  await expect(page.getByRole('alert')).toContainText('Nie ma projektu „nie-ma”');
});

test('odnośnik pomija pasek, a przejścia klawiaturą przenoszą fokus do głównego nagłówka', async ({
  page,
}) => {
  await page.goto('./');
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toBeVisible();
  const pomin = page.getByRole('link', { name: 'Przejdź do treści' });
  await page.keyboard.press('Tab');
  await expect(pomin).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(main.getByRole('heading', { level: 1 })).toBeFocused();
  await page.getByTestId('start-mausritter').press('Enter');
  const przyciskPusty = page.getByTestId('start-pusty-arkusz');
  await expect(przyciskPusty).toBeFocused();
  await przyciskPusty.press('Enter');
  await expect(page.getByTestId('okno-startu-mausritter')).toHaveCount(0);
  await expect(main).toHaveCount(1);
  await expect(page.getByRole('banner')).toHaveCount(1);
});
