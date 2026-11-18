import { expect, test, type Page } from '@playwright/test';
import { nowaPustaKartka } from './pomoc';

/** Motyw jasny/ciemny, pasek górny z trzema elementami (UI-1). */

const motyw = (page: Page) => page.locator('html').getAttribute('data-theme');
const tloStrony = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

async function pasek(page: Page) {
  await expect(page.getByRole('link', { name: 'Instrukcja' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Język' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Motyw ciemny' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Motyw jasny' })).toBeVisible();
}

test('domyślnie motyw według prefers-color-scheme (jasny)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./');
  expect(await motyw(page)).toBe('light');
  await expect(page.getByRole('button', { name: 'Motyw jasny' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('domyślnie motyw według prefers-color-scheme (ciemny) i reakcja na zmianę systemu', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./');
  expect(await motyw(page)).toBe('dark');
  await expect(page.getByRole('button', { name: 'Motyw ciemny' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => motyw(page)).toBe('light');
});

test('przełączenie motywu zmienia kolory i jest zapamiętane po przeładowaniu', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./');
  const jasne = await tloStrony(page);
  await page.getByRole('button', { name: 'Motyw ciemny' }).click();
  expect(await motyw(page)).toBe('dark');
  expect(await tloStrony(page)).not.toBe(jasne);
  expect(await page.evaluate(() => localStorage.getItem('karty.motyw'))).toBe('dark');
  await page.reload();
  expect(await motyw(page)).toBe('dark');
  await expect(page.getByRole('button', { name: 'Motyw ciemny' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Jawny wybór wygrywa z ustawieniem systemu.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  expect(await motyw(page)).toBe('dark');
  await page.getByRole('button', { name: 'Motyw jasny' }).click();
  await page.reload();
  expect(await motyw(page)).toBe('light');
});

test('motyw ustawiony przed pierwszym malowaniem (bez migotania)', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('karty.motyw', 'dark'));
  await page.goto('./', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  expect(await motyw(page)).toBe('dark');
});

test('pasek górny: trzy elementy na starcie, Instrukcja w nowym oknie, język PL aktywny', async ({
  page,
}) => {
  await page.goto('./');
  await pasek(page);
  const instrukcja = page.getByRole('link', { name: 'Instrukcja' });
  await expect(instrukcja).toHaveAttribute('target', '_blank');
  await expect(instrukcja).toHaveAttribute('rel', /noopener/);
  const jezyk = page.getByRole('group', { name: 'Język' });
  await expect(jezyk.getByRole('button', { name: 'PL' })).toHaveAttribute('aria-pressed', 'true');
  await expect(jezyk.getByRole('button', { name: 'EN' })).toBeDisabled();
});

test('pasek górny w edytorze kartki i szablonu; motyw trzyma się między ekranami', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await nowaPustaKartka(page);
  await pasek(page);
  await page.getByRole('button', { name: 'Motyw ciemny' }).click();
  // Karta na podglądzie zawsze na białym papierze, niezależnie od motywu aplikacji.
  const papier = await page
    .locator('.strona-kartki')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(papier).toBe('rgb(255, 255, 255)');
  await page.goto('./#/wlasne/nowy');
  expect(await motyw(page)).toBe('dark');
  await pasek(page);
});

test('pasek w edytorze szablonu', async ({ page }) => {
  await page.goto('./#/wlasne/nowy');
  await page.getByLabel('Nazwa szablonu').fill('Karta');
  await page.getByText('Mini Euro').click();
  await page.getByText('Tytuł i opis').click();
  await page.getByRole('button', { name: /Dalej: układ pól/ }).click();
  await expect(page.getByRole('tree', { name: 'Struktura karty' })).toBeVisible({ timeout: 15000 });
  await pasek(page);
});

test.describe('zrzuty UI-1', () => {
  test.skip(!process.env.ZRZUTY, 'tylko przy ZRZUTY=1');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('start jasny i ciemny, edytor ciemny', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Moje projekty' })).toBeVisible();
    await page.screenshot({ path: 'docs/obrazy/ui-1-start-jasny.png' });
    await page.getByRole('button', { name: 'Motyw ciemny' }).click();
    await page.screenshot({ path: 'docs/obrazy/ui-1-start-ciemny.png' });
    await nowaPustaKartka(page);
    await page.screenshot({ path: 'docs/obrazy/ui-1-edytor-ciemny.png' });
  });
});
