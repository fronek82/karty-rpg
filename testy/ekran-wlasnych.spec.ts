import { expect, test, type Page } from '@playwright/test';
import { strToU8, zipSync } from 'fflate';
import { plikSzablonu } from './kartkaUI';

/**
 * Ekran „Stwórz własne karty” (UI-5): menu po lewej, kafelki z podglądem karty liczonym
 * silnikiem (pusta karta i pięć przykładów), klik tworzy projekt z kartą i otwiera edytor kartki.
 */

const NAZWY = [
  'Pusta karta',
  'Karta z opisem',
  'Blok statystyk',
  'Karta z rzędem wartości',
  'Karta ozdobna',
  'Karta swobodna',
];

async function wejdz(page: Page) {
  await page.goto('./#/wlasne');
  await expect(page.locator('[data-podglad]')).toHaveCount(6);
  await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
}

async function edytorOtwarty(page: Page) {
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
}

test('wejście: okruszki, menu, sześć kafelków z podglądem z silnika', async ({ page }) => {
  await wejdz(page);
  const okruszki = page.getByRole('navigation', { name: 'Ścieżka' });
  await expect(okruszki).toContainText('Start');
  await expect(okruszki.locator('[aria-current="page"]')).toHaveText('Stwórz własne karty');
  const menu = page.getByRole('navigation', { name: 'Własny szablon' });
  await expect(menu.getByRole('link', { name: /Nowy szablon od zera/ })).toBeVisible();
  await expect(menu.getByRole('button', { name: /Importuj szablon/ })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: /Przykładowe szablony/ })).toBeVisible();
  const kafelki = page.locator('[data-podglad]');
  for (let i = 0; i < NAZWY.length; i++) {
    await expect(kafelki.nth(i).locator('b')).toHaveText(NAZWY[i]!);
    await expect(kafelki.nth(i)).toContainText('Kliknij, aby zacząć od tego szablonu');
    await expect(kafelki.nth(i).locator('.papier-svg svg')).toBeVisible();
  }
  // Pusta karta jest pierwsza; przykłady z tekstem mają ścieżki glifów.
  await expect(kafelki.nth(1).locator('svg path').first()).toBeAttached();
  // Żadnych nazw gier na ekranie.
  for (const gra of ['Mausritter', 'Dungeons', 'Warhammer', 'Pierścień'])
    await expect(page.getByText(gra)).toHaveCount(0);
});

test('miniatury nie są zniekształcone: proporcje papieru poziomego i pionowego', async ({
  page,
}) => {
  await wejdz(page);
  const proporcje = async (id: string) => {
    const r = (await page.locator(`[data-podglad="${id}"] .papier`).boundingBox())!;
    return r.width / r.height;
  };
  expect(Math.abs((await proporcje('statystyki')) - 88 / 63)).toBeLessThan(0.02);
  expect(Math.abs((await proporcje('opis')) - 63 / 88)).toBeLessThan(0.02);
  expect(Math.abs((await proporcje('pusta')) - 63 / 88)).toBeLessThan(0.02);
  // Karta pozioma mieści się w kafelku i w miniaturze.
  const kafelek = (await page.locator('[data-podglad="statystyki"]').boundingBox())!;
  const papier = (await page.locator('[data-podglad="statystyki"] .papier').boundingBox())!;
  expect(papier.width).toBeLessThanOrEqual(kafelek.width);
  expect(papier.height).toBeLessThanOrEqual(16 * 16);
});

test('klik w „Karta z opisem” tworzy projekt z kartą i otwiera edytor kartki', async ({ page }) => {
  await wejdz(page);
  await page.getByRole('button', { name: 'Karta z opisem' }).click();
  await edytorOtwarty(page);
  await expect(page).toHaveURL(/#\/projekt\//);
  await expect(page.locator('[data-karta]')).toHaveCount(1);
  await page.goto('./#/');
  await expect(page.locator('.kafelek-projektu')).toHaveCount(1);
  await expect(page.locator('.kafelek-projektu')).toContainText('Karta z opisem');
});

test('klik w „Pusta karta” tworzy projekt z jedną pustą kartą', async ({ page }) => {
  await wejdz(page);
  await page.getByRole('button', { name: 'Pusta karta' }).click();
  await edytorOtwarty(page);
  await expect(page.locator('[data-karta]')).toHaveCount(1);
});

test('każdy przykład tworzy projekt z kartą', async ({ page }) => {
  for (const nazwa of NAZWY.slice(2)) {
    await wejdz(page);
    await page.getByRole('button', { name: nazwa, exact: true }).click();
    await edytorOtwarty(page);
    await expect(page.locator('[data-karta]')).toHaveCount(1);
  }
});

test('podwójne kliknięcie tworzy jeden projekt', async ({ page }) => {
  await wejdz(page);
  await page.getByRole('button', { name: 'Blok statystyk' }).dblclick();
  await edytorOtwarty(page);
  await page.goto('./#/');
  await expect(page.locator('.kafelek-projektu')).toHaveCount(1);
});

test('„Nowy szablon od zera” otwiera kreator', async ({ page }) => {
  await wejdz(page);
  await page.getByRole('link', { name: /Nowy szablon od zera/ }).click();
  await expect(page).toHaveURL(/#\/wlasne\/nowy$/);
  await expect(page.getByLabel('Nazwa szablonu')).toBeVisible();
});

test('„Importuj szablon” z plikiem tworzy projekt i otwiera edytor kartki', async ({ page }) => {
  await wejdz(page);
  await page.getByTestId('plik-szablonu-start').setInputFiles(plikSzablonu());
  await edytorOtwarty(page);
  await expect(page).toHaveURL(/#\/projekt\//);
});

test('„Importuj szablon” z błędnym plikiem pokazuje komunikat i zostaje na ekranie', async ({
  page,
}) => {
  await wejdz(page);
  await page.getByTestId('plik-szablonu-start').setInputFiles({
    name: 'zepsuty.kartyrpg-szablon',
    mimeType: 'application/zip',
    buffer: Buffer.from('to nie jest archiwum'),
  });
  await expect(page.getByRole('alert')).toContainText('Nie udało się zaimportować szablonu');
  await expect(page).toHaveURL(/#\/wlasne$/);
  await expect(page.getByRole('button', { name: 'Karta z opisem' })).toBeEnabled();
});

test('„Importuj szablon” z plikiem projektu podpowiada ekran startowy', async ({ page }) => {
  await wejdz(page);
  await page.getByTestId('plik-szablonu-start').setInputFiles({
    name: 'moj.kartyrpg',
    mimeType: 'application/zip',
    buffer: Buffer.from(zipSync({ 'projekt.json': strToU8('{}') })),
  });
  await expect(page.getByRole('alert')).toContainText('To jest plik projektu');
  await expect(page.getByRole('alert')).toContainText('Importuj pliki…');
  await expect(page).toHaveURL(/#\/wlasne$/);
  // Po błędzie fokus wraca na przycisk importu.
  await expect(page.getByRole('button', { name: /Importuj szablon/ })).toBeFocused();
});

test('klawiatura: Enter i Spacja na kafelku tworzą projekt, Tab przechodzi po kafelkach', async ({
  page,
}) => {
  await wejdz(page);
  const k = page.getByRole('button', { name: 'Karta z rzędem wartości' });
  await k.focus();
  await page.keyboard.press('Enter');
  await edytorOtwarty(page);
  await wejdz(page);
  await page.getByRole('button', { name: 'Karta ozdobna' }).focus();
  await page.keyboard.press('Space');
  await edytorOtwarty(page);
  await wejdz(page);
  await page.getByRole('button', { name: 'Pusta karta' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Karta z opisem' })).toBeFocused();
});

test('powrót na ekran pokazuje podglądy od razu (pamięć)', async ({ page }) => {
  await wejdz(page);
  await page.getByRole('link', { name: 'Start' }).click();
  await page.getByRole('link', { name: /Stwórz własne karty/ }).click();
  await expect(page.locator('.papier-svg svg')).toHaveCount(6);
  await expect(page.locator('.szkielet')).toHaveCount(0);
});

test('błąd ładowania czcionek: komunikat i „Spróbuj ponownie”', async ({ page }) => {
  let blokuj = true;
  await page.route('**/czcionki/*', (r) => (blokuj ? r.abort() : r.continue()));
  await page.goto('./#/wlasne');
  const alert = page.getByRole('alert').filter({ hasText: 'Nie udało się przygotować podglądów' });
  await expect(alert).toBeVisible({ timeout: 15000 });
  blokuj = false;
  await alert.getByRole('button', { name: 'Spróbuj ponownie' }).click();
  await expect(page.locator('.papier-svg svg')).toHaveCount(6, { timeout: 15000 });
});

test.describe('angielski', () => {
  test.use({ locale: 'en-US' });

  test('ekran w EN: nazwy, menu i klik tworzą projekt', async ({ page }) => {
    await page.goto('./#/wlasne');
    await expect(page.locator('.papier-svg svg')).toHaveCount(6, { timeout: 15000 });
    const kafelki = page.locator('[data-podglad]');
    const nazwy = [
      'Blank card',
      'Card with a description',
      'Stat block',
      'Card with a row of values',
      'Ornate card',
      'Free-form card',
    ];
    for (let i = 0; i < nazwy.length; i++)
      await expect(kafelki.nth(i).locator('b')).toHaveText(nazwy[i]!);
    await expect(page.getByRole('link', { name: /New template from scratch/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Import a template/ })).toBeVisible();
    await expect(page.getByText('Click to start from this template').first()).toBeVisible();
    await page.getByRole('button', { name: 'Card with a description' }).click();
    await edytorOtwarty(page);
    await expect(page.locator('[data-karta]')).toHaveCount(1);
  });
});

test.describe('zrzuty UI-5', () => {
  test.skip(!process.env.ZRZUTY, 'tylko przy ZRZUTY=1');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('własne karty jasny i ciemny, EN jasny', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await wejdz(page);
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: 'Karta z opisem' }).hover();
    await page.screenshot({ path: 'docs/obrazy/ui-5-wlasne-jasny.png' });
    await page.getByRole('button', { name: 'Motyw ciemny' }).click();
    await page.screenshot({ path: 'docs/obrazy/ui-5-wlasne-ciemny.png' });
    await page.getByRole('button', { name: 'Motyw jasny' }).click();
    await page.getByRole('button', { name: 'EN' }).click();
    await expect(page.getByRole('button', { name: 'Card with a description' })).toBeVisible();
    await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
    await page.getByRole('button', { name: 'Card with a description' }).hover();
    await page.screenshot({ path: 'docs/obrazy/ui-5-wlasne-en-jasny.png' });
  });
});
