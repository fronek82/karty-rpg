import { expect, test, type Page } from '@playwright/test';
import { nowaPustaKartka, slot } from './pomoc';

/**
 * Ekran „Karty do Mausrittera” (UI-4): menu po lewej, podglądy pustej kartki i czterech układów
 * liczone silnikiem, klik tworzy projekt; menu typów kart w slocie bez ikon.
 */

const UKLADY = ['Broń i pancerze', 'Wyposażenie', 'Stany', 'Wszystkie trzy'];

async function wejdz(page: Page) {
  await page.goto('./#/gra/mausritter');
  await expect(page.getByRole('heading', { level: 2, name: 'Pusta kartka' })).toBeVisible();
  // Domyślnie w środku jest tylko pusta kartka (bez gotowych układów).
  await expect(page.locator('[data-podglad]')).toHaveCount(1);
  await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
}

async function pokazUklady(page: Page) {
  await page.getByRole('button', { name: /^Zacznij od gotowego układu/ }).click();
  await expect(page.getByRole('heading', { level: 2, name: /Gotowe układy/ })).toBeVisible();
  await expect(page.locator('[data-podglad]')).toHaveCount(4);
  await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
}

async function projektMaKarty(page: Page): Promise<number> {
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
  return page.locator('[data-karta]').count();
}

test('wejście: okruszki, menu, na środku tylko pusta kartka, a po kliknięciu tylko cztery układy', async ({
  page,
}) => {
  await wejdz(page);
  const okruszki = page.getByRole('navigation', { name: 'Ścieżka' });
  await expect(okruszki).toContainText('Start');
  await expect(okruszki.locator('[aria-current="page"]')).toHaveText('Karty do Mausrittera');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Karty do Mausrittera');

  const menu = page.getByRole('navigation', { name: 'Od czego zacząć' });
  await expect(menu.getByRole('button', { name: /^Pusta kartka/ })).toHaveAttribute(
    'aria-current',
    'true',
  );
  await expect(
    menu.getByRole('button', { name: /^Zacznij od gotowego układu/ }),
  ).not.toHaveAttribute('aria-current', 'true');
  await expect(menu).toContainText('Siatka 10×7 slotów, bez kart');

  // Pusta kartka: podgląd z siatką 10×7 narysowaną z geometrii układu; brak gotowych układów.
  const pusta = page.locator('[data-podglad="pusta"]');
  await expect(pusta).toContainText('Pusta kartka A4');
  await expect(pusta).toContainText('10×7 slotów (25,75 mm)');
  await expect(pusta).toContainText('Kliknij, aby zacząć');
  await expect(pusta.locator('.papier-svg svg')).toHaveCount(1);
  await expect(pusta.locator('.siatka-slotow rect')).toHaveCount(70);
  await expect(page.locator('[data-grupa="uklady"]')).toHaveCount(0);

  // Po kliknięciu „Zacznij od gotowego układu”: zniknie pusta kartka, pojawiają się 4 układy.
  await pokazUklady(page);
  await expect(page.locator('[data-grupa="pusta"]')).toHaveCount(0);
  for (const u of UKLADY) {
    const kafelek = page.getByRole('button', { name: u, exact: true });
    await expect(kafelek).toBeEnabled();
    await expect(kafelek).toContainText('Kliknij, aby zacząć');
    await expect(kafelek.locator('.papier-svg svg').first()).toBeVisible();
  }
  await expect(page.locator('[data-podglad="wszystkie"] .papier')).toHaveCount(3);
  await expect(page.locator('[data-podglad="bron"] .papier')).toHaveCount(1);
  // Identyfikatory glifów w SVG są unikalne na całej stronie (kilka SVG naraz).
  const powtorzone = await page.evaluate(() => {
    const id = [...document.querySelectorAll('svg [id]')].map((e) => e.id);
    return id.length - new Set(id).size;
  });
  expect(powtorzone).toBe(0);
});

test('klik w „Pusta kartka” tworzy projekt z pustą kartką', async ({ page }) => {
  await wejdz(page);
  await page.getByRole('button', { name: /Pusta kartka A4/ }).click();
  expect(await projektMaKarty(page)).toBe(0);
  await expect(slot(page, 1, 1, 1)).toBeVisible();
});

test('klik w „Broń i pancerze” tworzy projekt z kartami', async ({ page }) => {
  await wejdz(page);
  await pokazUklady(page);
  await page.getByRole('button', { name: 'Broń i pancerze', exact: true }).click();
  expect(await projektMaKarty(page)).toBeGreaterThan(20);
});

test('dwuklik w kafelek tworzy jeden projekt', async ({ page }) => {
  await wejdz(page);
  await pokazUklady(page);
  await page.getByRole('button', { name: 'Stany', exact: true }).dblclick();
  expect(await projektMaKarty(page)).toBeGreaterThan(10);
  await page.waitForTimeout(500);
  await page.getByRole('link', { name: 'Karty RPG' }).click();
  await expect(page.locator('.kafelek-projektu')).toHaveCount(1);
});

test('błąd wczytania czcionek: jeden komunikat, szkielety w kafelkach, „Spróbuj ponownie”', async ({
  page,
}) => {
  await page.route('**/czcionki/*', (r) => r.abort());
  await page.goto('./#/gra/mausritter');
  await expect(page.locator('[data-podglad]')).toHaveCount(1);
  const alert = page.getByRole('alert');
  await expect(alert).toHaveCount(1);
  await expect(alert).toContainText('Nie udało się przygotować podglądów');
  await expect(page.locator('.szkielet')).toHaveCount(1);
  await page.unroute('**/czcionki/*');
  await alert.getByRole('button', { name: 'Spróbuj ponownie' }).click();
  await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('[data-podglad] .papier-svg svg').first()).toBeVisible();
});

test('klawiatura: Tab do kafelka i Enter / Spacja tworzy projekt', async ({ page }) => {
  await wejdz(page);
  await pokazUklady(page);
  const stany = page.getByRole('button', { name: 'Stany', exact: true });
  await stany.focus();
  await expect(stany).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await projektMaKarty(page)).toBeGreaterThan(10);

  await wejdz(page);
  await pokazUklady(page);
  const wyposazenie = page.getByRole('button', { name: 'Wyposażenie', exact: true });
  await wyposazenie.focus();
  await page.keyboard.press('Space');
  expect(await projektMaKarty(page)).toBeGreaterThan(20);
});

test.describe('skróty w lewym menu', () => {
  test.use({ viewport: { width: 1280, height: 520 } });

  test('przełączają widok na środku (tylko jedna grupa naraz) i działają z klawiatury', async ({
    page,
  }) => {
    await wejdz(page);
    const menu = page.getByRole('navigation', { name: 'Od czego zacząć' });
    const uklady = menu.getByRole('button', { name: /^Zacznij od gotowego układu/ });
    const pusta = menu.getByRole('button', { name: /^Pusta kartka/ });

    await expect(page.locator('[data-grupa="pusta"]')).toBeVisible();
    await expect(page.locator('[data-grupa="uklady"]')).toHaveCount(0);

    await uklady.click();
    await expect(uklady).toHaveAttribute('aria-current', 'true');
    await expect(pusta).not.toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-grupa="uklady"]')).toBeVisible();
    await expect(page.locator('[data-grupa="pusta"]')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: /Gotowe układy/ })).toBeFocused();

    await pusta.focus();
    await page.keyboard.press('Enter');
    await expect(pusta).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-grupa="pusta"]')).toBeVisible();
    await expect(page.locator('[data-grupa="uklady"]')).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2, name: 'Pusta kartka' })).toBeFocused();
  });
});

test('powrót na ekran pokazuje podglądy od razu (pamięć)', async ({ page }) => {
  await wejdz(page);
  await pokazUklady(page);
  await page.getByRole('link', { name: 'Start', exact: true }).click();
  await page.getByRole('link', { name: /Stwórz karty do Mausrittera/ }).click();
  await expect(page.locator('[data-podglad]')).toHaveCount(1, { timeout: 1000 });
  // Ten sam moment, w którym kafelki wchodzą do DOM, ma już wszystkie kartki (bez szkieletów).
  expect(await page.locator('.szkielet').count()).toBe(0);
  await page.getByRole('button', { name: /^Zacznij od gotowego układu/ }).click();
  await expect(page.locator('[data-podglad]')).toHaveCount(4, { timeout: 1000 });
  expect(await page.locator('.szkielet').count()).toBe(0);
  expect(await page.locator('[data-podglad] .papier').count()).toBe(6);
});

test('czas liczenia podglądów (pomiar; próg luźny)', async ({ page }) => {
  await page.goto('./#/gra/mausritter');
  await expect(page.locator('[data-podglad]')).toHaveCount(1, { timeout: 15000 });
  await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
  await page.getByRole('button', { name: /^Zacznij od gotowego układu/ }).click();
  await expect(page.locator('[data-podglad]')).toHaveCount(4, { timeout: 15000 });
  await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
  const czasy = await page.evaluate(() => {
    const dane = (n: string) => performance.getEntriesByName(n).at(-1)?.startTime;
    return { start: dane('podglady-start'), koniec: dane('podglady-gotowe') };
  });
  expect(czasy.start).toBeDefined();
  expect(czasy.koniec).toBeDefined();
  const ms = czasy.koniec! - czasy.start!;
  console.log(`Podglądy Mausrittera: ${Math.round(ms)} ms (od załadowania modułów do ostatniego)`);
  expect(ms).toBeLessThan(5000);
});

test('menu typów kart w pustym slocie: same napisy, bez ikon', async ({ page }) => {
  await nowaPustaKartka(page);
  await slot(page, 1, 1, 1).click();
  const menu = page.getByRole('menu', { name: 'Dodaj kartę' });
  await expect(menu).toBeVisible();
  await expect(menu.locator('.ikona')).toHaveCount(0);
  const pozycje = menu.getByRole('menuitem');
  expect(await pozycje.count()).toBeGreaterThanOrEqual(6);
  for (const nazwa of ['Broń', 'Zbroja', 'Ekwipunek', 'Zaklęcie', 'Stan', 'Pusta karta'])
    await expect(menu.getByRole('menuitem', { name: new RegExp(`^${nazwa}`) })).toBeVisible();
  // Treść każdej pozycji zaczyna się od litery (żadnych emoji ani symboli przed nazwą).
  for (const tekst of await pozycje.allTextContents()) expect(tekst, tekst).toMatch(/^\p{L}/u);
  if (process.env.ZRZUTY) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: 'docs/obrazy/ui-4-menu-typow-bez-ikon.png' });
  }
});

test.describe('angielski', () => {
  test.use({ locale: 'en-US' });

  test('ekran w EN: menu, podglądy i klik tworzą projekt', async ({ page }) => {
    await page.goto('./#/gra/mausritter');
    await expect(page.locator('[data-podglad]')).toHaveCount(1);
    await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByRole('navigation', { name: 'Where to start' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Blank sheet' })).toBeVisible();
    await expect(page.locator('[data-grupa="uklady"]')).toHaveCount(0);
    await expect(page.locator('[data-podglad="pusta"]')).toContainText(
      'Blank A4 sheetA landscape A4 page with a 10×7 grid of slots (25.75 mm)',
    );
    await expect(page.getByText('Click to start').first()).toBeVisible();
    await page.getByRole('button', { name: /^Start from a ready-made layout/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: /Ready-made layouts/ })).toBeVisible();
    await expect(page.locator('[data-grupa="pusta"]')).toHaveCount(0);
    for (const u of ['Weapons and armor', 'Gear', 'Conditions', 'All three'])
      await expect(page.getByRole('button', { name: u, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Weapons and armor', exact: true }).click();
    expect(await projektMaKarty(page)).toBeGreaterThan(20);
  });

  test('zmiana języka na ekranie przelicza podglądy', async ({ page }) => {
    await page.goto('./#/gra/mausritter');
    await expect(page.locator('[data-podglad]')).toHaveCount(1);
    await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
    await page.getByRole('button', { name: /Settings/ }).click();
    await page
      .getByRole('group', { name: 'Language' })
      .getByRole('button', { name: 'PL', exact: true })
      .click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { level: 2, name: 'Pusta kartka' })).toBeVisible();
    await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator('[data-podglad]')).toHaveCount(1);
    await expect(page.locator('[data-podglad] .papier-svg svg').first()).toBeVisible();
  });
});

test.describe('zrzuty UI-4', () => {
  test.skip(!process.env.ZRZUTY, 'tylko przy ZRZUTY=1');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Mausritter jasny i ciemny, EN jasny', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await wejdz(page);
    await pokazUklady(page);
    await page.getByRole('button', { name: 'Broń i pancerze', exact: true }).hover();
    await page.screenshot({ path: 'docs/obrazy/ui-4-mausritter-jasny.png' });
    await page.getByRole('button', { name: /Ustawienia/ }).click();
    await page.getByRole('button', { name: 'Motyw ciemny' }).click();
    await page.keyboard.press('Escape');
    await page.screenshot({ path: 'docs/obrazy/ui-4-mausritter-ciemny.png' });
  });

  test.describe('EN', () => {
    test.use({ locale: 'en-US' });

    test('Mausritter EN jasny', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('./#/gra/mausritter');
      await expect(page.locator('[data-podglad]')).toHaveCount(1);
      await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
      await page.getByRole('button', { name: /^Start from a ready-made layout/ }).click();
      await expect(page.locator('[data-podglad]')).toHaveCount(4);
      await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
      await page.getByRole('button', { name: 'Weapons and armor', exact: true }).hover();
      await page.screenshot({ path: 'docs/obrazy/ui-4-mausritter-en-jasny.png' });
    });
  });
});
