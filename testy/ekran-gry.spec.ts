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
  // Wszystkie podglądy gotowe: żaden szkielet, każdy kafelek ma kartkę.
  await expect(page.locator('[data-podglad]')).toHaveCount(5);
  await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
}

async function projektMaKarty(page: Page): Promise<number> {
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
  return page.locator('[data-karta]').count();
}

test('wejście: okruszki, menu, jeden podgląd pustej kartki i cztery układy z silnika', async ({
  page,
}) => {
  await wejdz(page);
  const okruszki = page.getByRole('navigation', { name: 'Ścieżka' });
  await expect(okruszki).toContainText('Start');
  await expect(okruszki.locator('[aria-current="page"]')).toHaveText('Karty do Mausrittera');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Karty do Mausrittera');

  const menu = page.getByRole('navigation', { name: 'Od czego zacząć' });
  await expect(menu.getByRole('button', { name: /^Pusta kartka/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(menu.getByRole('button', { name: /^Zacznij od gotowego układu/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(menu).toContainText('Siatka 10×7 slotów, bez kart');

  // Pusta kartka: podgląd z siatką 10×7 narysowaną z geometrii układu.
  const pusta = page.locator('[data-podglad="pusta"]');
  await expect(pusta).toContainText('Pusta kartka A4');
  await expect(pusta).toContainText('10×7 slotów (25,75 mm)');
  await expect(pusta).toContainText('Kliknij, aby zacząć');
  await expect(pusta.locator('.papier-svg svg')).toHaveCount(1);
  await expect(pusta.locator('.siatka-slotow rect')).toHaveCount(70);

  // Układy: nazwa pod spodem, SVG sceny; „Wszystkie trzy” to stos trzech kartek.
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
  await page.getByRole('button', { name: 'Broń i pancerze', exact: true }).click();
  expect(await projektMaKarty(page)).toBeGreaterThan(20);
});

test('klawiatura: Tab do kafelka i Enter / Spacja tworzy projekt', async ({ page }) => {
  await wejdz(page);
  const stany = page.getByRole('button', { name: 'Stany', exact: true });
  await stany.focus();
  await expect(stany).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await projektMaKarty(page)).toBeGreaterThan(10);

  await wejdz(page);
  const wyposazenie = page.getByRole('button', { name: 'Wyposażenie', exact: true });
  await wyposazenie.focus();
  await page.keyboard.press('Space');
  expect(await projektMaKarty(page)).toBeGreaterThan(20);
});

test.describe('skróty w lewym menu', () => {
  test.use({ viewport: { width: 1280, height: 520 } });

  test('przewijają do grupy, podświetlają ją i działają z klawiatury', async ({ page }) => {
    await wejdz(page);
    const menu = page.getByRole('navigation', { name: 'Od czego zacząć' });
    const uklady = menu.getByRole('button', { name: /^Zacznij od gotowego układu/ });
    const pusta = menu.getByRole('button', { name: /^Pusta kartka/ });
    const sekcjaUkladow = page.locator('[data-grupa="uklady"]');
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await uklady.click();
    await expect(uklady).toHaveAttribute('aria-pressed', 'true');
    await expect(pusta).toHaveAttribute('aria-pressed', 'false');
    await expect(sekcjaUkladow).toHaveClass(/wyrozniona/);
    await expect(page.getByRole('heading', { level: 2, name: /Gotowe układy/ })).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(200);
    const nizej = await page.evaluate(() => window.scrollY);
    await expect(sekcjaUkladow.getByRole('heading')).toBeInViewport();

    await pusta.focus();
    await page.keyboard.press('Enter');
    await expect(pusta).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-grupa="pusta"]')).toHaveClass(/wyrozniona/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(nizej - 100);
    await expect(page.getByRole('heading', { level: 2, name: 'Pusta kartka' })).toBeInViewport();
  });
});

test('powrót na ekran pokazuje podglądy od razu (pamięć)', async ({ page }) => {
  await wejdz(page);
  await page.getByRole('link', { name: 'Start', exact: true }).click();
  await page.getByRole('link', { name: /Stwórz karty do Mausrittera/ }).click();
  await expect(page.locator('[data-podglad]')).toHaveCount(5, { timeout: 1000 });
  // Ten sam moment, w którym kafelki wchodzą do DOM, ma już wszystkie kartki (bez szkieletów).
  expect(await page.locator('.szkielet').count()).toBe(0);
  expect(await page.locator('[data-podglad] .papier').count()).toBe(7);
});

test('czas liczenia podglądów (pomiar; próg luźny)', async ({ page }) => {
  await page.goto('./#/gra/mausritter');
  await expect(page.locator('[data-podglad]')).toHaveCount(5, { timeout: 15000 });
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
    await expect(page.locator('[data-podglad]')).toHaveCount(5);
    await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
    await expect(page.getByRole('navigation', { name: 'Where to start' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Blank sheet' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /Ready-made layouts/ })).toBeVisible();
    await expect(page.locator('[data-podglad="pusta"]')).toContainText(
      'Blank A4 sheetA landscape A4 page with a 10×7 grid of slots (25.75 mm)',
    );
    await expect(page.getByText('Click to start').first()).toBeVisible();
    for (const u of ['Weapons and armor', 'Gear', 'Conditions', 'All three'])
      await expect(page.getByRole('button', { name: u, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Weapons and armor', exact: true }).click();
    expect(await projektMaKarty(page)).toBeGreaterThan(20);
  });

  test('zmiana języka na ekranie przelicza podglądy', async ({ page }) => {
    await page.goto('./#/gra/mausritter');
    await expect(page.locator('[data-podglad]')).toHaveCount(5);
    await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
    await page
      .getByRole('group', { name: 'Language' })
      .getByRole('button', { name: 'PL', exact: true })
      .click();
    await expect(page.getByRole('heading', { level: 2, name: 'Pusta kartka' })).toBeVisible();
    await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
    await expect(page.locator('[data-podglad]')).toHaveCount(5);
    await expect(page.locator('[data-podglad] .papier-svg svg').first()).toBeVisible();
  });
});

test.describe('zrzuty UI-4', () => {
  test.skip(!process.env.ZRZUTY, 'tylko przy ZRZUTY=1');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Mausritter jasny i ciemny, EN jasny', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await wejdz(page);
    await page.getByRole('button', { name: 'Broń i pancerze', exact: true }).hover();
    await page.screenshot({ path: 'docs/obrazy/ui-4-mausritter-jasny.png' });
    await page.getByRole('button', { name: 'Motyw ciemny' }).click();
    await page.screenshot({ path: 'docs/obrazy/ui-4-mausritter-ciemny.png' });
  });

  test.describe('EN', () => {
    test.use({ locale: 'en-US' });

    test('Mausritter EN jasny', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('./#/gra/mausritter');
      await expect(page.locator('[data-podglad]')).toHaveCount(5);
      await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
      await page.getByRole('button', { name: 'Weapons and armor', exact: true }).hover();
      await page.screenshot({ path: 'docs/obrazy/ui-4-mausritter-en-jasny.png' });
    });
  });
});
