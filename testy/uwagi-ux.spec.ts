import { expect, test } from '@playwright/test';
import { dodaj, kreator, panel, sekcja, zaznacz } from './szablonUI';
import { otworzUstawieniaAplikacji, slot, zapisano } from './pomoc';

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

  // 3) W „Edytor kart”: pusty tytuł + długi opis → opis NIE trafia w nagłówek panelu.
  await page.getByRole('button', { name: 'Przejdź do kart →' }).click();
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

  // 4) Katalog Google Fonts w Bibliotekach: ≥ 50 krojów, filtr rozwijany i próbka podglądu przed pobraniem.
  await zapisano(page);
  await page.goto('./#/biblioteki/czcionki');
  const katalog = page.locator('details.katalog-google-fonts');
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

test('panel właściwości pola: Położenie i rozmiar (#1), Wygląd (#2), Styl tekstu (#3), Odstępy (#4) i pola wyboru na dole w PL i EN', async ({
  page,
}) => {
  await kreator(page, {
    nazwa: 'Kolejność sekcji',
    format: 'Standard / Poker',
    uklad: 'Swobodny: pola w dowolnych miejscach',
  });
  await dodaj(page, 'Tekst', 'Opis');

  const sekcje = panel(page).locator('.panel-edytora > details.sekcja-panelu > summary');
  await expect(sekcje.nth(0)).toHaveText('Położenie i rozmiar');
  await expect(sekcje.nth(1)).toHaveText('Wygląd (tło, ramka, rogi)');
  await expect(sekcje.nth(2)).toHaveText('Styl tekstu');
  await expect(sekcje.nth(3)).toHaveText('Odstępy');

  // Pola wyboru (Wiele wierszy, Formatowanie itd.) leżą na samym dole panelu – poniżej Stylu tekstu i Odstępów.
  const pudelkoStylu = (await panel(page)
    .locator('.panel-edytora > details.sekcja-panelu')
    .nth(2)
    .boundingBox())!;
  const pudelkoWyboru = (await panel(page)
    .getByLabel('Łam tekst na wiele wierszy', { exact: true })
    .boundingBox())!;
  expect(pudelkoWyboru.y).toBeGreaterThan(pudelkoStylu.y + pudelkoStylu.height - 1);

  // Pierwsza sekcja jest domyślnie zwinięta i po rozwinięciu zawiera jednocześnie położenie i rozmiar.
  const pierwsza = panel(page).locator('.panel-edytora > details.sekcja-panelu').nth(0);
  await expect(pierwsza).not.toHaveAttribute('open', '');
  await pierwsza.locator(':scope > summary').click();
  await expect(pierwsza.getByLabel('X (mm)')).toBeVisible();
  await expect(pierwsza.getByLabel('Y (mm)')).toBeVisible();
  await expect(pierwsza.getByLabel('Szerokość', { exact: true })).toBeVisible();
  await expect(pierwsza.getByLabel('Wysokość', { exact: true })).toBeVisible();

  // Pole w zwykłym kontenerze (kolumna): Rozmiar, Wygląd, Styl tekstu, Odstępy.
  await dodaj(page, 'Kolumna', 'Blok');
  await dodaj(page, 'Tekst', 'Wewnatrz');
  await expect(sekcje.nth(0)).toHaveText('Rozmiar');
  await expect(sekcje.nth(1)).toHaveText('Wygląd (tło, ramka, rogi)');
  await expect(sekcje.nth(2)).toHaveText('Styl tekstu');
  await expect(sekcje.nth(3)).toHaveText('Odstępy');
  await expect(
    panel(page).locator('.panel-edytora > details.sekcja-panelu').nth(0),
  ).not.toHaveAttribute('open', '');

  // Przełączenie na angielski zachowuje kolejność i etykiety w obu wariantach.
  const menuUst = await otworzUstawieniaAplikacji(page);
  await menuUst
    .getByRole('group', { name: /^(Język|Language)$/ })
    .getByRole('button', { name: 'EN', exact: true })
    .click();
  await page.keyboard.press('Escape');
  const sekcjeEn = page
    .getByRole('complementary', { name: 'Properties' })
    .locator('.panel-edytora > details.sekcja-panelu > summary');
  await expect(sekcjeEn.nth(0)).toHaveText('Size');
  await expect(sekcjeEn.nth(1)).toHaveText('Appearance (background, frame, corners)');
  await expect(sekcjeEn.nth(2)).toHaveText('Text style');
  await expect(sekcjeEn.nth(3)).toHaveText('Spacing');

  await page
    .getByRole('tree', { name: 'Card structure' })
    .getByText('Opis', { exact: false })
    .click();
  await expect(sekcjeEn.nth(0)).toHaveText('Position and size');
  await expect(sekcjeEn.nth(1)).toHaveText('Appearance (background, frame, corners)');
  await expect(sekcjeEn.nth(2)).toHaveText('Text style');
  await expect(sekcjeEn.nth(3)).toHaveText('Spacing');
});
