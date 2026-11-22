import { expect, test, type Page } from '@playwright/test';
import { otworzDruk, otworzUstawieniaAplikacji } from './pomoc';

/** Język interfejsu PL | EN (UI-2): domyślny z przeglądarki, przełączanie bez przeładowania, pamięć. */

const jezykDokumentu = (page: Page) => page.locator('html').getAttribute('lang');
const zapamietany = (page: Page) => page.evaluate(() => localStorage.getItem('karty.jezyk'));

async function wybierz(page: Page, jezyk: 'PL' | 'EN') {
  const panel = await otworzUstawieniaAplikacji(page);
  await panel
    .getByRole('group', { name: /^(Język|Language)$/ })
    .getByRole('button', { name: jezyk, exact: true })
    .click();
  await page.keyboard.press('Escape');
}

test.describe('język domyślny według przeglądarki (D8)', () => {
  test.describe('en-US', () => {
    test.use({ locale: 'en-US' });

    test('angielski interfejs na starcie, lang i przyciski paska', async ({ page }) => {
      await page.goto('./');
      expect(await jezykDokumentu(page)).toBe('en');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Game Cards – Design and Print' }),
      ).toBeVisible();
      await expect(page.getByRole('link', { name: /Create cards for Mausritter/ })).toBeVisible();
      await expect(page.getByRole('link', { name: /Create your own cards/ })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'My projects' })).toBeVisible();
      await expect(page.getByText('You have no projects yet.')).toBeVisible();
      const panel = await otworzUstawieniaAplikacji(page);
      await expect(panel.getByRole('link', { name: /^Guide/ })).toHaveAttribute(
        'href',
        'instrukcja/?lang=en',
      );
      const grupa = panel.getByRole('group', { name: 'Language' });
      await expect(grupa.getByRole('button', { name: 'EN' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(grupa.getByRole('button', { name: 'PL' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      await expect(grupa.getByRole('button', { name: 'PL' })).toHaveAttribute('lang', 'pl');
      await expect(grupa.getByRole('button', { name: 'EN' })).toHaveAttribute('lang', 'en');
      await expect(panel.getByRole('button', { name: 'Dark theme' })).toBeVisible();
      await expect(page).toHaveTitle('Cards');
    });
  });

  test.describe('pl-PL', () => {
    test.use({ locale: 'pl-PL' });

    test('polski interfejs na starcie', async ({ page }) => {
      await page.goto('./');
      expect(await jezykDokumentu(page)).toBe('pl');
      await expect(
        page.getByRole('heading', { level: 1, name: 'Karty do gier – zaprojektuj i wydrukuj' }),
      ).toBeVisible();
      const panel = await otworzUstawieniaAplikacji(page);
      const grupa = panel.getByRole('group', { name: 'Język' });
      await expect(grupa.getByRole('button', { name: 'PL' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(grupa.getByRole('button', { name: 'EN' })).toBeEnabled();
      await expect(page).toHaveTitle('Karty');
    });
  });

  test.describe('inny język przeglądarki', () => {
    test.use({ locale: 'de-DE' });

    test('reszta świata dostaje angielski', async ({ page }) => {
      await page.goto('./');
      expect(await jezykDokumentu(page)).toBe('en');
    });
  });

  test.describe('wybór zapamiętany wygrywa z ustawieniem przeglądarki', () => {
    test.use({ locale: 'en-US' });

    test('en-US z zapisanym „pl”', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('karty.jezyk', 'pl'));
      await page.goto('./');
      expect(await jezykDokumentu(page)).toBe('pl');
      await expect(page.getByRole('heading', { name: 'Moje projekty' })).toBeVisible();
    });
  });
});

test('przełączenie PL → EN → PL bez przeładowania, język zapamiętany po przeładowaniu', async ({
  page,
}) => {
  await page.goto('./');
  // Znacznik w DOM przeżywa przerysowanie tylko wtedy, gdy strona się nie przeładowała.
  await page.evaluate(
    () => ((window as unknown as { __bezPrzeladowania: boolean }).__bezPrzeladowania = true),
  );
  await wybierz(page, 'EN');
  await expect(page.getByRole('heading', { name: 'My projects' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Create cards for Mausritter/ })).toBeVisible();
  expect(await jezykDokumentu(page)).toBe('en');
  expect(await zapamietany(page)).toBe('en');
  expect(
    await page.evaluate(
      () => (window as unknown as { __bezPrzeladowania?: boolean }).__bezPrzeladowania,
    ),
  ).toBe(true);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'My projects' })).toBeVisible();
  expect(await jezykDokumentu(page)).toBe('en');
  await expect(
    (await otworzUstawieniaAplikacji(page)).getByRole('button', { name: 'EN' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');

  await wybierz(page, 'PL');
  await expect(page.getByRole('heading', { name: 'Moje projekty' })).toBeVisible();
  expect(await zapamietany(page)).toBe('pl');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Moje projekty' })).toBeVisible();
  expect(await jezykDokumentu(page)).toBe('pl');
});

test('klawiatura: przycisk języka działa spacją i Enter, fokus zostaje na nim', async ({
  page,
}) => {
  await page.goto('./');
  const panel = await otworzUstawieniaAplikacji(page);
  const en = panel.getByRole('button', { name: 'EN', exact: true });
  await en.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'My projects' })).toBeVisible();
  await expect(en).toBeFocused();
  const pl = panel.getByRole('button', { name: 'PL', exact: true });
  await pl.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('heading', { name: 'Moje projekty' })).toBeVisible();
});

test('ekran Mausrittera i nazwy gotowych układów po angielsku', async ({ page }) => {
  await page.goto('./#/gra/mausritter');
  await wybierz(page, 'EN');
  await expect(page.getByRole('heading', { level: 1, name: 'Cards for Mausritter' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Blank A4 sheet/ })).toBeEnabled();
  await page.getByRole('button', { name: /^Start from a ready-made layout/ }).click();
  for (const u of ['Weapons and armor', 'Gear', 'Conditions', 'All three'])
    await expect(page.getByRole('button', { name: u, exact: true })).toBeVisible();
});

test('kreator szablonu: napisy po angielsku, bez przeładowania i z zachowaniem wpisanych wartości', async ({
  page,
}) => {
  await page.goto('./#/wlasne/nowy/awers');
  await page.getByLabel('Nazwa szablonu').fill('Moja karta testowa');
  await wybierz(page, 'EN');
  const nazwa = page.getByLabel('Template name');
  await expect(nazwa).toHaveValue('Moja karta testowa');
  await expect(page.getByText('Card format')).toBeVisible();
  await expect(page.getByLabel('Corner radius (mm)')).toBeVisible();
  await expect(page.getByRole('button', { name: /Next: field layout/ })).toBeVisible();
});

test.describe('edytor kartki po angielsku', () => {
  test.use({ locale: 'en-US' });

  test('tworzenie kartki, dodanie karty, menu typów i panel kart po angielsku', async ({
    page,
  }) => {
    await page.goto('./#/');
    await page.getByRole('link', { name: /Create cards for Mausritter/ }).click();
    await page.getByRole('button', { name: /Blank A4 sheet/ }).click();
    await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('link', { name: /^Print cards/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Nothing selected' })).toBeVisible();
    // Nazwa projektu powstała w języku z chwili utworzenia.
    await expect(page.getByRole('textbox', { name: 'Project name' })).toHaveValue('My cards');

    await page
      .getByRole('button', {
        name: 'Empty slot – page 1, column 1, row 1. Add a card',
        exact: true,
      })
      .click();
    for (const typ of ['Weapon', 'Armor', 'Equipment', 'Spell', 'Condition', 'Blank card'])
      await expect(
        page.getByRole('menuitem', { name: new RegExp(`^${typ}`) }).first(),
      ).toBeVisible();
    await page.getByRole('menuitem', { name: /^Weapon/ }).click();
    const panel = page.getByRole('complementary', { name: 'Selected cards' });
    await expect(panel).toBeVisible();
    await expect(panel.getByLabel('Number of copies')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Duplicate', exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: /1×2 heavy/ })).toBeVisible();
  });

  test('zmiana języka w trakcie edycji nie gubi zaznaczenia ani wpisanej wartości', async ({
    page,
  }) => {
    await page.goto('./#/');
    await page.getByRole('link', { name: /Create cards for Mausritter/ }).click();
    await page.getByRole('button', { name: /Blank A4 sheet/ }).click();
    await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
    await page
      .getByRole('button', {
        name: 'Empty slot – page 1, column 1, row 1. Add a card',
        exact: true,
      })
      .click();
    await page.getByRole('menuitem', { name: /^Weapon/ }).click();
    let panel = page.getByRole('complementary', { name: 'Selected cards' });
    await panel.getByLabel('Name', { exact: true }).fill('Fireball');
    const kartaNaKartce = page.locator('[data-karta][aria-label^="Fireball – "]');
    await expect(kartaNaKartce).toHaveCount(1);
    await expect(kartaNaKartce).toHaveClass(/zaznaczona/);
    await page.evaluate(() => ((window as unknown as { __bez: boolean }).__bez = true));

    await wybierz(page, 'PL');
    panel = page.getByRole('complementary', { name: 'Zaznaczone karty' });
    await expect(panel).toBeVisible();
    // Ta sama karta nadal zaznaczona, wpisana wartość zachowana, etykiety po polsku.
    await expect(panel.getByLabel('Nazwa', { exact: true })).toHaveValue('Fireball');
    await expect(page.locator('[data-karta][aria-label^="Fireball – strona 1"]')).toHaveClass(
      /zaznaczona/,
    );
    await expect(page.getByRole('textbox', { name: 'Nazwa projektu' })).toHaveValue('My cards');
    expect(await page.evaluate(() => (window as unknown as { __bez?: boolean }).__bez)).toBe(true);

    // Edycja po zmianie języka działa, a przycisk „Zapisz” zapisuje zmiany.
    await panel.getByLabel('Nazwa', { exact: true }).fill('Kula ognia');
    await expect(page.locator('[data-karta][aria-label^="Kula ognia – strona 1"]')).toHaveCount(1);
    await expect(page.locator('.status-zapisu')).toHaveText('Niezapisane zmiany');
    await page.getByRole('button', { name: 'Zapisz', exact: true }).click();
    await expect(page.locator('.status-zapisu')).toHaveText('Zapisano');
    await wybierz(page, 'EN');
    await expect(page.locator('.status-zapisu')).toHaveText('Saved');
    await expect(page.locator('[data-karta][aria-label^="Kula ognia – page 1"]')).toHaveCount(1);
  });

  test('opcje druku po angielsku: tytuł, papier, kalibracja', async ({ page }) => {
    await page.goto('./#/');
    await page.getByRole('link', { name: /Create cards for Mausritter/ }).click();
    await page.getByRole('button', { name: /Blank A4 sheet/ }).click();
    await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
    const opcje = await otworzDruk(page, true);
    await expect(opcje.getByLabel('Sheet title')).toHaveValue('My cards');
    await expect(opcje.getByLabel('Paper')).toHaveValue('A4');
    await expect(opcje.getByRole('option', { name: 'Photo 10 × 15 cm' })).toBeAttached();
    await expect(opcje.getByText('Printer calibration')).toBeVisible();
  });
});

test.describe('edytor szablonu po angielsku', () => {
  test.use({ locale: 'en-US' });

  test('kreator i edytor: napisy EN; przełączenie w trakcie zachowuje zaznaczenie', async ({
    page,
  }) => {
    await page.goto('./#/wlasne/nowy/awers');
    await page.getByLabel('Template name').fill('Test card');
    await page.locator('label.format', { hasText: 'Mini Euro' }).click();
    await page.locator('label.uklad', { hasText: 'Title and description' }).click();
    await page.getByRole('button', { name: /Next: field layout/ }).click();
    const drzewo = page.getByRole('tree', { name: 'Card structure' });
    await expect(drzewo).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Card editor ►' })).toBeVisible();
    await expect(page.getByRole('button', { name: '＋ Add ▾' })).toBeVisible();

    const tytul = drzewo.getByRole('treeitem', { name: /^Title – / });
    await tytul.locator(':scope > .wezel-etykieta').click();
    await expect(tytul).toHaveAttribute('aria-selected', 'true');
    const wlasciwosci = page.getByRole('complementary', { name: 'Properties' });
    await expect(wlasciwosci).toBeVisible();
    await expect(wlasciwosci.getByLabel('Name', { exact: true })).toHaveValue('Title');

    await wybierz(page, 'PL');
    // Nazwa elementu to treść szablonu (powstała po angielsku), typ elementu – po polsku.
    const tytulPl = page
      .getByRole('tree', { name: 'Struktura karty' })
      .getByRole('treeitem', { name: /^Title – Tekst/ });
    await expect(tytulPl).toHaveAttribute('aria-selected', 'true');
    const panelPl = page.getByRole('complementary', { name: 'Właściwości' });
    await expect(panelPl.getByLabel('Nazwa', { exact: true })).toHaveValue('Title');
    await expect(page.getByRole('button', { name: 'Edytor kart ►' })).toBeVisible();
  });
});

test.describe('zrzuty UI-2', () => {
  test.skip(!process.env.ZRZUTY, 'tylko przy ZRZUTY=1');
  test.use({ locale: 'en-US', viewport: { width: 1440, height: 900 } });

  test('start EN jasny, edytor EN ciemny', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'My projects' })).toBeVisible();
    await page.screenshot({ path: 'docs/obrazy/ui-2-start-en-jasny.png' });
    await (
      await otworzUstawieniaAplikacji(page)
    )
      .getByRole('button', { name: 'Dark theme' })
      .click();
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: /Create cards for Mausritter/ }).click();
    await page.getByRole('button', { name: /Blank A4 sheet/ }).click();
    await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
    await page
      .getByRole('button', {
        name: 'Empty slot – page 1, column 1, row 1. Add a card',
        exact: true,
      })
      .click();
    await page.screenshot({ path: 'docs/obrazy/ui-2-edytor-en-ciemny.png' });
  });
});
