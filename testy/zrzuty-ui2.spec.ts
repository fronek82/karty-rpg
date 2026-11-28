import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const KATALOG = join(process.cwd(), 'docs', 'obrazy', 'ui2');

test.describe('Zrzuty UI2 (jasny i ciemny motyw)', () => {
  test.skip(process.env.ZRZUTY_UI2 !== '1', 'Uruchamiane jawnie z ZRZUTY_UI2=1');
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const motyw of ['light', 'dark'] as const) {
    test(`galeria zrzutów UI2 – ${motyw}`, async ({ page }) => {
      test.setTimeout(90_000);
      mkdirSync(KATALOG, { recursive: true });
      await page.addInitScript((m) => {
        window.localStorage.setItem('karty.motyw', m);
      }, motyw);

      // 1. Utworzenie szablonu (przód + tył) w Moich szablonach
      await page.goto('./');
      await expect(page.getByTestId('start-nowy-szablon')).toBeVisible();
      await page.getByTestId('start-nowy-szablon').click();
      const oknoSz = page.getByTestId('okno-nowy-szablon');
      await oknoSz.getByRole('button', { name: /Tył \(rewers\)/ }).click();
      await oknoSz.getByRole('button', { name: 'Utwórz szablon' }).click();
      await expect(page).toHaveURL(/#\/szablon\/[^/]+$/, { timeout: 15000 });
      await expect(page.locator('.karta-podgladu')).toBeVisible();
      await page
        .getByRole('navigation', { name: 'Dodaj element' })
        .getByRole('button', { name: 'Tekst', exact: true })
        .click();
      await page
        .locator('header.ui2-naglowek')
        .getByRole('button', { name: 'Zapisz', exact: true })
        .click();
      await expect(page.locator('header.ui2-naglowek')).toContainText(/zapisano/i);
      await page.screenshot({ path: join(KATALOG, `edytor-${motyw}.png`) });

      // 2. Powrót i utworzenie projektu z szablonu
      await page.getByRole('link', { name: '← Szablony' }).click();
      await expect(page.getByTestId('kafelek-szablonu')).toHaveCount(2, { timeout: 10000 });
      await page.getByTestId('start-nowe-karty').click();
      const okno = page.getByTestId('okno-nowy-projekt');
      await expect(okno).toBeVisible();
      await page.screenshot({ path: join(KATALOG, `nowy-projekt-${motyw}.png`) });
      await okno.getByTestId('np-lista-szablonow').locator('button').first().click();
      await okno.getByRole('button', { name: 'Utwórz projekt' }).click();
      await expect(page).toHaveURL(/#\/projekt\/[^/]+\/karty$/, { timeout: 15000 });

      // 3. Krok 1: Karty
      const pasekKart = page.getByRole('navigation', { name: 'Dodaj karty' });
      const btnSz = pasekKart.locator('.ui2-pasek-grupa').first().locator('button').first();
      await btnSz.click();
      await btnSz.click();
      await expect(page.getByTestId('kafelek-karty')).toHaveCount(2);
      await page.getByRole('button', { name: 'Zapisz', exact: true }).click();
      await expect(page.locator('header.ui2-naglowek')).toContainText(/zapisano/i);
      await page.screenshot({ path: join(KATALOG, `karty-${motyw}.png`) });

      // 4. Krok 2: Druk
      await page.getByRole('link', { name: 'Do druku →' }).click();
      await expect(page.getByTestId('sekcja-linii-ciecia')).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('podsumowanie-druku')).toBeVisible();
      await page.screenshot({ path: join(KATALOG, `druk-${motyw}.png`) });
    });
  }
});
