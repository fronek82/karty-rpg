import { expect, test } from '@playwright/test';
import { dodaj, kreator, panel, sekcja, zaznacz } from './szablonUI';
import { slot, zapisano } from './pomoc';

/**
 * Poprawki UX po uwagach użytkownika:
 * - rozszerzony katalog Google Fonts z podglądem kroju przed pobraniem i filtrem rozwijanym,
 * - nagłówek panelu karty nie przejmuje długiego opisu przy pustej nazwie,
 * - zapamiętywanie wysokości pól wielowierszowych między kartami i elementami szablonu,
 * - listy rozwijane zamiast zawijających się przycisków segmentowych.
 */

test.use({ viewport: { width: 1440, height: 1000 } });

test('nagłówek panelu karty nie pokazuje opisu, wysokość textarea zostaje między kartami i węzłami, opcje nie zawijają się', async ({
  page,
}) => {
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '' }),
  );
  await kreator(page, {
    nazwa: 'Karta zaklęcia',
    format: 'Standard / Poker',
    uklad: 'Tytuł i opis',
  });

  // 1) W edytorze szablonu: Wyrównanie jest listą rozwijaną, a pozostałe segmenty nie zawijają się.
  await zaznacz(page, 'Opis');
  const styl = await sekcja(page, 'Styl tekstu');
  const wyrownanie = styl.getByLabel('Wyrównanie', { exact: true });
  await expect(wyrownanie).toBeVisible();
  await wyrownanie.selectOption('justuj');
  await expect(wyrownanie).toHaveValue('justuj');

  const zawinieteSegmenty = await panel(page)
    .locator('.przelacznik-segmentowy')
    .evaluateAll(
      (grupy) =>
        grupy.filter((g) => {
          const przyciski = [...g.querySelectorAll('button')];
          if (przyciski.length < 2) return false;
          const gory = przyciski.map((b) => Math.round(b.getBoundingClientRect().top));
          return Math.max(...gory) - Math.min(...gory) > 2;
        }).length,
    );
  expect(zawinieteSegmenty).toBe(0);

  // 2) Wysokość pola wielowierszowego w edytorze szablonu zostaje po przełączeniu na inne pole tekstowe.
  await dodaj(page, 'Tekst', 'Notatka');
  const polePrzykladu1 = panel(page).getByLabel('Wartość przykładowa');
  await polePrzykladu1.evaluate((el: HTMLTextAreaElement) => {
    el.style.height = '196px';
  });
  await polePrzykladu1.dispatchEvent('pointerup');

  await zaznacz(page, 'Opis');
  const polePrzykladu2 = panel(page).getByLabel('Wartość przykładowa');
  await expect
    .poll(() => polePrzykladu2.evaluate((el: HTMLTextAreaElement) => el.style.height))
    .toBe('196px');

  // 3) W „Rób karty”: pusty tytuł + długi opis → opis NIE trafia w nagłówek panelu.
  await page.getByRole('button', { name: 'Rób karty ►' }).click();
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
  await slot(page, 1, 1, 1).click();
  await page.getByRole('menuitem', { name: /Karta zaklęcia/ }).click();

  const panelKarty = page.getByRole('complementary', { name: 'Zaznaczone karty' });
  const dlugiOpis =
    'Pewnego jasnego sierpniowego wieczora, pod koniec lat 80., bardzo długi opis zaklęcia testowego.';
  const poleOpisu1 = panelKarty.getByLabel('Opis');
  await poleOpisu1.fill(dlugiOpis);
  await zapisano(page);

  const naglowek = panelKarty.locator('.naglowek-panelu h2');
  await expect(naglowek).not.toContainText('Pewnego jasnego');
  await expect(naglowek).toHaveText('Karta zaklęcia');

  // Rozciągnięcie pola Opis na karcie 1 utrzymuje się po przełączeniu na kartę 2.
  await poleOpisu1.evaluate((el: HTMLTextAreaElement) => {
    el.style.height = '224px';
  });
  await poleOpisu1.dispatchEvent('pointerup');

  await slot(page, 1, 2, 1).click();
  await page.getByRole('menuitem', { name: /Karta zaklęcia/ }).click();
  const poleOpisu2 = panelKarty.getByLabel('Opis');
  await expect
    .poll(() => poleOpisu2.evaluate((el: HTMLTextAreaElement) => el.style.height))
    .toBe('224px');

  // 4) Katalog Google Fonts: ≥ 50 krojów, filtr rozwijany i próbka podglądu przed pobraniem.
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  const ust = page.getByRole('complementary', { name: 'Ustawienia' });
  const katalog = ust.locator('details.katalog-google-fonts');
  await expect(page.locator('link[data-google-fonts-podglad]')).toHaveCount(0);
  await katalog.locator('summary').click();
  await expect
    .poll(() => page.locator('link[data-google-fonts-podglad]').count())
    .toBeGreaterThan(0);
  await expect
    .poll(() => katalog.locator('.pozycja-google-font').count())
    .toBeGreaterThanOrEqual(50);
  const kategoria = katalog.getByLabel('Kategoria krojów');
  await kategoria.selectOption('pisana');
  await expect(katalog.getByText('Eagle Lake', { exact: true })).toBeVisible();
  await expect(katalog.locator('.podglad-google-font').first()).toContainText('Zażółć gęślą jaźń');
});
