import { expect, test, type Page } from '@playwright/test';
import { nowaPustaKartka, otworzDruk, otworzUstawieniaAplikacji } from './pomoc';

/** Motyw jasny/ciemny i rozwijane menu „Ustawienia” w pasku górnym. */

const motyw = (page: Page) => page.locator('html').getAttribute('data-theme');
const tloStrony = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

async function pasek(page: Page) {
  const panel = await otworzUstawieniaAplikacji(page);
  await expect(panel.getByRole('link', { name: /Instrukcja/ })).toBeVisible();
  await expect(panel.getByRole('group', { name: 'Język' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Motyw ciemny' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Motyw jasny' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Kolory przycisków' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Biblioteki', exact: true })).toBeVisible();
  return panel;
}

test('domyślnie motyw według prefers-color-scheme (jasny)', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./');
  expect(await motyw(page)).toBe('light');
  const panel = await otworzUstawieniaAplikacji(page);
  await expect(panel.getByRole('button', { name: 'Motyw jasny' })).toHaveAttribute(
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
  const panel = await otworzUstawieniaAplikacji(page);
  await expect(panel.getByRole('button', { name: 'Motyw ciemny' })).toHaveAttribute(
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
  await (
    await otworzUstawieniaAplikacji(page)
  )
    .getByRole('button', { name: 'Motyw ciemny' })
    .click();
  expect(await motyw(page)).toBe('dark');
  expect(await tloStrony(page)).not.toBe(jasne);
  expect(await page.evaluate(() => localStorage.getItem('karty.motyw'))).toBe('dark');
  await page.reload();
  expect(await motyw(page)).toBe('dark');
  await expect(
    (await otworzUstawieniaAplikacji(page)).getByRole('button', { name: 'Motyw ciemny' }),
  ).toHaveAttribute('aria-pressed', 'true');
  // Jawny wybór wygrywa z ustawieniem systemu.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.reload();
  expect(await motyw(page)).toBe('dark');
  await (
    await otworzUstawieniaAplikacji(page)
  )
    .getByRole('button', { name: 'Motyw jasny' })
    .click();
  await page.reload();
  expect(await motyw(page)).toBe('light');
});

test('motyw ustawiony przed pierwszym malowaniem i bez migotania', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('karty.motyw', 'dark');
    // Zapis każdej wartości data-theme, jaka kiedykolwiek pojawi się na <html>.
    const w = ((window as unknown as { __motywy: string[] }).__motywy = [] as string[]);
    new MutationObserver(() =>
      w.push(document.documentElement.getAttribute('data-theme') ?? ''),
    ).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-theme'] });
  });
  // Opóźniony pakiet skryptów: motyw musi być ustawiony, zanim aplikacja się uruchomi.
  await page.route('**/assets/*.js', async (route) => {
    await new Promise((r) => setTimeout(r, 1200));
    await route.continue();
  });
  await page.goto('./', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  expect(await page.locator('#root').evaluate((el) => el.childElementCount)).toBe(0);
  await expect(page.getByRole('button', { name: /Ustawienia/ })).toBeVisible({ timeout: 10000 });
  const zapisane = await page.evaluate(
    () => (window as unknown as { __motywy: string[] }).__motywy,
  );
  expect(zapisane.length).toBeGreaterThan(0);
  expect(zapisane.every((m) => m === 'dark')).toBe(true);
});

test('pasek górny: menu Ustawienia na starcie, Instrukcja w nowym oknie, język PL aktywny', async ({
  page,
}) => {
  await page.goto('./');
  const panel = await pasek(page);
  const instrukcja = panel.getByRole('link', { name: /Instrukcja/ });
  await expect(instrukcja).toHaveAttribute('target', '_blank');
  await expect(instrukcja).toHaveAttribute('rel', /noopener/);
  const jezyk = panel.getByRole('group', { name: 'Język' });
  await expect(jezyk.getByRole('button', { name: 'PL' })).toHaveAttribute('aria-pressed', 'true');
  await expect(jezyk.getByRole('button', { name: 'EN' })).toBeEnabled();
});

test('pasek górny w edytorze kartki i szablonu; motyw trzyma się między ekranami', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await nowaPustaKartka(page);
  const panel = await pasek(page);
  await panel.getByRole('button', { name: 'Motyw ciemny' }).click();
  // Karta na podglądzie zawsze na białym papierze, niezależnie od motywu aplikacji.
  const papier = await page
    .locator('.strona-kartki')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(papier).toBe('rgb(255, 255, 255)');
  await page.goto('./#/wlasne/nowy/awers');
  expect(await motyw(page)).toBe('dark');
  await pasek(page);
});

test('pasek w edytorze szablonu', async ({ page }) => {
  await page.goto('./#/wlasne/nowy/awers');
  await page.getByLabel('Nazwa szablonu').fill('Karta');
  await page.getByText('Mini Euro').click();
  await page.getByText('Tytuł i opis').click();
  await page.getByRole('button', { name: /Dalej: układ pól/ }).click();
  await expect(page.getByRole('tree', { name: 'Struktura karty' })).toBeVisible({ timeout: 15000 });
  await pasek(page);
});

/** Kontrast WCAG dwóch kolorów „rgb(r, g, b)”. */
function kontrast(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = (c.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map((x) => {
      const v = Number(x) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

async function otworzMenuPobierz(page: Page) {
  await otworzDruk(page);
  await page.getByRole('button', { name: /^Pobierz/ }).click();
  const poz = page.getByRole('menuitem').first();
  await expect(poz).toBeVisible();
  return poz;
}

for (const kolorSystemu of ['light', 'dark'] as const) {
  test(`menu Pobierz na pasku (${kolorSystemu}): czytelne pozycje i widoczny fokus`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: kolorSystemu });
    await nowaPustaKartka(page);
    const poz = await otworzMenuPobierz(page);
    const kolory = await poz.evaluate((el) => ({
      tekst: getComputedStyle(el).color,
      tlo: getComputedStyle(el.closest('.menu-typu')!).backgroundColor,
    }));
    expect(kontrast(kolory.tekst, kolory.tlo)).toBeGreaterThanOrEqual(4.5);
    await page.keyboard.press('ArrowDown');
    const fokus = page.locator('.menu-typu :focus');
    await expect(fokus).toHaveCount(1);
    const obrys = await fokus.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        styl: cs.outlineStyle,
        szer: parseFloat(cs.outlineWidth),
        kolor: cs.outlineColor,
        tlo: getComputedStyle(el.closest('.menu-typu')!).backgroundColor,
      };
    });
    expect(obrys.styl).toBe('solid');
    expect(obrys.szer).toBeGreaterThanOrEqual(2);
    expect(kontrast(obrys.kolor, obrys.tlo)).toBeGreaterThanOrEqual(3);
  });
}

test.describe('zrzuty UI-1', () => {
  test.skip(!process.env.ZRZUTY, 'tylko przy ZRZUTY=1');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('start jasny i ciemny, edytor ciemny', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Moje projekty' })).toBeVisible();
    await page.screenshot({ path: 'docs/obrazy/ui-1-start-jasny.png' });
    await (
      await otworzUstawieniaAplikacji(page)
    )
      .getByRole('button', { name: 'Motyw ciemny' })
      .click();
    await page.keyboard.press('Escape');
    await page.screenshot({ path: 'docs/obrazy/ui-1-start-ciemny.png' });
    await nowaPustaKartka(page);
    await page.screenshot({ path: 'docs/obrazy/ui-1-edytor-ciemny.png' });
    await otworzMenuPobierz(page);
    await page.screenshot({ path: 'docs/obrazy/ui-1-menu-pobierz-ciemny.png' });
    await (
      await otworzUstawieniaAplikacji(page)
    )
      .getByRole('button', { name: 'Motyw jasny' })
      .click();
    await page.keyboard.press('Escape');
    await otworzMenuPobierz(page);
    await page.screenshot({ path: 'docs/obrazy/ui-1-menu-pobierz-jasny.png' });
  });
});
