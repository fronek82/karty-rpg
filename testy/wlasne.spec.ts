import { expect, test } from '@playwright/test';
import { eksportujSzablon } from '../src/dane/archiwum';
import { WERSJA_SCHEMATU, type Projekt } from '../src/model/projekt';
import type { Szablon } from '../src/model/szablon';
import { szablonCzaru, szablonStatystyk } from '../src/silnik/__testy__/przyklady';
import { slot, zapisano } from './pomoc';

/** Własne karty: import szablonu, karty w mm na kartce, papier, eksport i import szablonów. */

test.use({ viewport: { width: 1440, height: 1100 } });

/** Plik szablonu (.kartyrpg-szablon) z szablonu zbudowanego w kodzie. */
function plikSzablonu(s: Szablon) {
  const projekt: Projekt = {
    wersja: WERSJA_SCHEMATU,
    id: 'zrodlo',
    nazwa: 'źródło',
    utworzono: '2026-01-01T00:00:00.000Z',
    zmieniono: '2026-01-01T00:00:00.000Z',
    role: {},
    zasoby: [],
    szablony: [s],
    talie: [],
    arkusze: [],
  };
  return {
    name: `${s.id}.kartyrpg-szablon`,
    mimeType: 'application/zip',
    buffer: Buffer.from(eksportujSzablon(projekt, new Map(), s.id).bajty),
  };
}

test('import szablonu → kartka 63×88 (3×3), karta z menu, papier zdjęciowy, eksport', async ({
  page,
}) => {
  await page.goto('./#/');
  await page.getByRole('link', { name: /Stwórz własne karty/ }).click();
  await page.getByTestId('plik-szablonu-start').setInputFiles(plikSzablonu(szablonCzaru));
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.nazwa-projektu')).toHaveValue('Czar (test)');
  // A4 pionowo, karta 63×88 – 3 × 3 sloty.
  await expect(page.locator('.slot')).toHaveCount(9);

  await slot(page, 1, 2, 1).click();
  const pozycja = page.getByRole('menuitem', { name: /Czar \(test\)/ });
  await expect(pozycja).toContainText('63×88 mm');
  await pozycja.click();
  const panel = page.getByRole('complementary', { name: 'Zaznaczone karty' });
  await panel.getByLabel('Nazwa', { exact: true }).fill('Ognista kula');
  await expect(page.locator('[data-karta]')).toHaveAttribute('aria-label', /^Ognista kula – /);
  await zapisano(page);

  // Papier zdjęciowy 10×15: strefa bezpieczeństwa 3 mm widoczna; karta 63×88 mieści się
  // w orientacji poziomej (2 karty).
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  const ust = page.getByRole('complementary', { name: 'Ustawienia' });
  await ust.getByRole('button', { name: 'poziomo' }).click();
  await ust.getByLabel('Papier', { exact: true }).selectOption('foto-10x15');
  await expect(ust.getByLabel('Margines bezpieczeństwa (mm)')).toHaveValue('3');
  await expect(page.locator('.strefa-bezpieczenstwa')).toBeVisible();
  await expect(ust).toContainText('Strona 152 × 102 mm');
  await expect(ust.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.ostrzezenia-projektu')).toHaveCount(0);
  // Karta została na kartce (poza strefą).
  await expect(page.locator('[data-karta]')).toHaveCount(1);

  // Eksport szablonu z projektu.
  const [plik] = await Promise.all([
    page.waitForEvent('download'),
    ust.getByRole('button', { name: 'Eksportuj szablon Czar (test)' }).click(),
  ]);
  expect(plik.suggestedFilename()).toBe('czar-test.kartyrpg-szablon');

  // PDF się pobiera.
  const [pdf] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Pobierz PDF/ }).click(),
  ]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
});

test('szablon innego rozmiaru: własna kartka, w menu pierwszej kartki zablokowany', async ({
  page,
}) => {
  await page.goto('./#/wlasne');
  await page.getByTestId('plik-szablonu-start').setInputFiles(plikSzablonu(szablonCzaru));
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  const ust = page.getByRole('complementary', { name: 'Ustawienia' });
  await ust.getByTestId('plik-szablonu').setInputFiles(plikSzablonu(szablonStatystyk));
  await expect(ust.locator('.sekcja-szablonow [role="status"]')).toContainText(
    'Dodano szablon „Blok statystyk (test)”',
  );
  // Druga kartka dla kart 88×63 (A4 poziomo, 3 × 3).
  await expect(page.locator('.kartka')).toHaveCount(2);
  await expect(page.locator('.kartka').nth(1).locator('.slot')).toHaveCount(9);

  await slot(page, 1, 1, 1).first().click();
  const zablokowany = page.getByRole('menuitem', { name: /Blok statystyk/ });
  await expect(zablokowany).toBeDisabled();
  await expect(zablokowany).toHaveAttribute('title', /Inny rozmiar karty \(88×63 mm\)/);
  await expect(page.getByRole('menuitem', { name: /Czar \(test\)/ })).toBeEnabled();
});
