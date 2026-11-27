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

      // 1. Start
      await page.goto('./');
      await expect(page.getByTestId('start-nowe-karty')).toBeVisible();
      await page.screenshot({ path: join(KATALOG, `start-${motyw}.png`) });

      // 2. Okno Nowy projekt
      await page.getByTestId('start-nowe-karty').click();
      const okno = page.getByRole('dialog', { name: 'Nowy projekt' });
      await expect(okno).toBeVisible();
      await page.screenshot({ path: join(KATALOG, `nowy-projekt-${motyw}.png`) });

      // 3. Edytor szablonu z linijkami i elementem
      await okno.getByRole('button', { name: /Tył \(rewers\)/ }).click();
      await okno.getByRole('button', { name: 'Utwórz projekt' }).click();
      await expect(page.locator('.karta-podgladu')).toBeVisible();
      await page
        .getByRole('navigation', { name: 'Dodaj element' })
        .getByRole('button', { name: 'Tekst', exact: true })
        .click();
      await page.screenshot({ path: join(KATALOG, `edytor-${motyw}.png`) });

      // 4. Krok 2: Karty
      await page
        .locator('header.ui2-naglowek')
        .getByRole('button', { name: 'Zapisz', exact: true })
        .click();
      await page
        .getByRole('navigation', { name: 'Etapy projektu' })
        .getByRole('link', { name: /Karty/ })
        .click();
      const pasekKart = page.getByRole('navigation', { name: 'Dodaj karty' });
      await pasekKart.locator('.ui2-pasek-grupa').first().locator('button').first().click();
      await pasekKart.locator('.ui2-pasek-grupa').first().locator('button').first().click();
      await expect(page.getByTestId('kafelek-karty')).toHaveCount(2);
      await page.screenshot({ path: join(KATALOG, `karty-${motyw}.png`) });

      // 5. Krok 3: Druk
      await page.getByRole('button', { name: 'Zapisz', exact: true }).click();
      await page.getByRole('link', { name: 'Do druku →' }).click();
      await expect(page.getByTestId('sekcja-linii-ciecia')).toBeVisible();
      await page.screenshot({ path: join(KATALOG, `druk-${motyw}.png`) });

      // 6. Mausritter
      await page.goto('./#/gra/mausritter');
      await page.locator('[data-podglad="pusta"]').click();
      await expect(page.getByTestId('licznik-kafelkow')).toBeVisible();
      await page.screenshot({ path: join(KATALOG, `mausritter-${motyw}.png`) });
    });
  }
});
