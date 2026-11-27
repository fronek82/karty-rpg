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

      // 1. Okno Nowy projekt
      await page.goto('./');
      await expect(page.getByTestId('start-nowe-karty')).toBeVisible();
      await page.getByTestId('start-nowe-karty').click();
      const okno = page.getByRole('dialog', { name: 'Nowy projekt' });
      await expect(okno).toBeVisible();
      await page.screenshot({ path: join(KATALOG, `nowy-projekt-${motyw}.png`) });

      // 2. Edytor szablonu z linijkami i elementem (projekt z przodem i tyłem)
      await okno.getByPlaceholder(/Zaklęcia/).fill('Karty zaklęć');
      await okno.getByRole('button', { name: /Tył \(rewers\)/ }).click();
      await okno.getByRole('button', { name: 'Utwórz projekt' }).click();
      await expect(page.locator('.karta-podgladu')).toBeVisible();
      await page
        .getByRole('navigation', { name: 'Dodaj element' })
        .getByRole('button', { name: 'Tekst', exact: true })
        .click();
      await page.screenshot({ path: join(KATALOG, `edytor-${motyw}.png`) });

      // 3. Krok 2: Karty
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

      // 4. Krok 3: Druk
      await page.getByRole('button', { name: 'Zapisz', exact: true }).click();
      await page.getByRole('link', { name: 'Do druku →' }).click();
      await expect(page.getByTestId('sekcja-linii-ciecia')).toBeVisible();
      await page.screenshot({ path: join(KATALOG, `druk-${motyw}.png`) });

      // 5. Drugi projekt – sam przód (poziomo) dla podglądu na stronie głównej
      await page.goto('./#/');
      await page.getByTestId('start-nowe-karty').click();
      const okno2 = page.getByRole('dialog', { name: 'Nowy projekt' });
      await okno2.getByPlaceholder(/Zaklęcia/).fill('Ekwipunek poziomy');
      await okno2.getByRole('button', { name: 'Poziomo' }).click();
      await okno2.getByRole('button', { name: 'Utwórz projekt' }).click();
      await expect(page.locator('.karta-podgladu')).toBeVisible();
      await page
        .getByRole('navigation', { name: 'Dodaj element' })
        .getByRole('button', { name: 'Tekst', exact: true })
        .click();
      await page
        .locator('header.ui2-naglowek')
        .getByRole('button', { name: 'Zapisz', exact: true })
        .click();
      await expect(page.locator('header.ui2-naglowek')).toContainText(/zapisano/i, {
        timeout: 10000,
      });

      // 6. Mausritter
      await page.goto('./#/');
      await page.getByTestId('start-mausritter').click();
      await page.getByTestId('start-pusty-arkusz').click();
      await expect(page.getByTestId('licznik-kafelkow')).toBeVisible();
      await page.screenshot({ path: join(KATALOG, `mausritter-${motyw}.png`) });

      // 7. Start z miniaturami projektów (przód+tył, sam przód poziomy, Mausritter)
      await page.goto('./#/');
      await expect(page.locator('.riso-kafelek')).toHaveCount(3, { timeout: 15000 });
      await expect(
        page.locator('.riso-kafelek', { hasText: 'Karty zaklęć' }).locator('.riso-podglad img'),
      ).toHaveCount(2, { timeout: 15000 });
      await expect(
        page
          .locator('.riso-kafelek', { hasText: 'Ekwipunek poziomy' })
          .locator('.riso-podglad img'),
      ).toHaveCount(1, { timeout: 15000 });
      await page.screenshot({ path: join(KATALOG, `start-${motyw}.png`) });
    });
  }
});
