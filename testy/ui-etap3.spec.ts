import { expect, test } from '@playwright/test';
import { otworzDruk, panelDruku, slot, zapisano } from './pomoc';

/**
 * Etap 3 przebudowy UI + poprawki wizualne:
 * - rozdzielenie przepływu: Edytor szablonu → „Edytor kart ►” → „Drukuj karty ►” + „← Powrót”,
 * - stały prawy panel „Opcje druku i arkusza” w widoku druku (bez przycisku zamykania),
 * - rozwijane menu „⚙ Ustawienia ▾” w pasku górnym (motyw, język, wgrywanie czcionek i obrazów, instrukcja),
 * - opisy tekstowe (bez dekoracyjnych grafik SVG) na ekranie wyboru strony Awers / Rewers,
 * - obniżone położenie przycisków lewego menu pod nagłówkiem strony.
 */

test.use({ viewport: { width: 1440, height: 900 } });

test('ekran wyboru strony Awers / Rewers ma opisy na środku bez SVG i wyrównane przyciski po lewej', async ({
  page,
}) => {
  await page.goto('./#/wlasne');
  await expect(page.getByRole('heading', { level: 1, name: 'Własne karty' })).toBeVisible();
  const kolWlasne = (await page.locator('.wybor-kolumny').boundingBox())!;
  const przyciskWlasne = (await page
    .locator('.wybor-kolumny > .start-menu .pasek-menu')
    .first()
    .boundingBox())!;
  // Górny odstęp menu + etykieta sekcji obniżają pierwszy przycisk poniżej górnej krawędzi sekcji.
  expect(przyciskWlasne.y - kolWlasne.y).toBeGreaterThanOrEqual(40);

  await page.goto('./#/wlasne/nowy');
  await expect(page.getByRole('heading', { level: 1, name: 'Wybierz stronę karty' })).toBeVisible();
  const kolStrona = (await page.locator('.wybor-kolumny').boundingBox())!;
  const przyciskStrona = (await page
    .locator('.wybor-kolumny > .start-menu .pasek-menu')
    .first()
    .boundingBox())!;
  expect(przyciskStrona.y - kolStrona.y).toBeGreaterThanOrEqual(40);

  // Opisy po prawej (na środku treści) dla Awersu i Rewersu, bez dekoracyjnych SVG.
  const opisy = page.locator('.opisy-stron-karty .opis-strony-karty');
  await expect(opisy).toHaveCount(2);
  await expect(opisy.nth(0)).toContainText('Przód');
  await expect(opisy.nth(0)).toContainText('Przód karty');
  await expect(opisy.nth(1)).toContainText('Tył');
  await expect(opisy.nth(1)).toContainText('Wspólny tył');
  await expect(page.locator('.opisy-stron-karty svg')).toHaveCount(0);

  // Przyciski po lewej w kreatorze awersu także mają etykietę sekcji i obniżenie pod nagłówkiem.
  await page.getByRole('link', { name: /^Przód/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Nowy szablon karty' })).toBeVisible();
  const kolKreator = (await page.locator('.kreator').boundingBox())!;
  const przyciskKreator = (await page
    .locator('.kreator > .start-menu .pasek-menu')
    .first()
    .boundingBox())!;
  expect(przyciskKreator.y - kolKreator.y).toBeGreaterThanOrEqual(40);
});

test('przepływ Szablon → Edytor kart → Drukuj karty oraz przycisk ← Powrót na każdym kroku', async ({
  page,
}) => {
  await page.goto('./#/wlasne/nowy/awers');
  await page.getByLabel('Nazwa szablonu').fill('Karta etapu 3');
  await page.getByText('Tytuł i opis').click();
  await page.getByRole('button', { name: /Dalej: układ pól/ }).click();
  await expect(page.getByRole('tree', { name: 'Struktura karty' })).toBeVisible({ timeout: 15000 });

  // W edytorze szablonu (R10): „← Projekty” i „Przejdź do kart →”.
  await expect(page.getByRole('link', { name: '← Projekty', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Przejdź do kart →', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Rób karty|← Kartki/ })).toHaveCount(0);

  // Przejście do „Edytor kart”.
  await page.getByRole('button', { name: 'Przejdź do kart →', exact: true }).click();
  await expect(slot(page, 1, 1, 1)).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('link', { name: '← Powrót', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Drukuj karty ►', exact: true })).toBeVisible();
  // W edytorze kart nie ma przycisku „Pobierz” ani otwartego panelu opcji druku.
  await expect(page.getByRole('button', { name: 'Pobierz', exact: true })).toHaveCount(0);
  await expect(panelDruku(page)).toHaveCount(0);

  // Przejście do „Drukuj karty”: stały prawy panel Ustawienia druku bez przycisku ✕, z Pobierz PDF i bez Eksportuj.
  await otworzDruk(page);
  await expect(page).toHaveURL(/#\/projekt\/.+\/drukuj/);
  const panel = panelDruku(page);
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Ustawienia druku' })).toBeVisible();
  await expect(panel.getByRole('button', { name: /Zamknij/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pobierz', exact: true })).toBeVisible();
  await expect(
    page.locator('header.ui2-naglowek').getByRole('button', { name: /Pobierz PDF/ }),
  ).toBeVisible();
  await expect(
    page.locator('header.ui2-naglowek').getByRole('button', { name: /Eksportuj/ }),
  ).toHaveCount(0);
  // Na podglądzie arkusza w widoku druku nie ma interaktywnych slotów ani przycisku „Dodaj stronę”.
  await expect(page.getByRole('button', { name: /Dodaj stronę/ })).toHaveCount(0);

  // Bezpośrednia edycja opcji druku w prawym panelu działa od razu.
  const pionowo = panel.getByRole('button', { name: 'pionowo', exact: true });
  await pionowo.click();
  await expect(pionowo).toHaveAttribute('aria-pressed', 'true');
  await zapisano(page);

  // Powrót przeglądarki z widoku druku wraca do „Edytor kart”.
  await page.goBack();
  await expect(slot(page, 1, 1, 1)).toBeVisible();
  await expect(page).not.toHaveURL(/\/drukuj/);

  // „← Powrót” z „Edytor kart” (dla projektu z własnego szablonu) wraca do edytora szablonu.
  await page.getByRole('link', { name: '← Powrót', exact: true }).click();
  await expect(page.getByRole('tree', { name: 'Struktura karty' })).toBeVisible();
});

// Wgrywanie globalnych czcionek i obrazów: testy/biblioteki.spec.ts (menu „Biblioteki”, N7).

test('projekt gry (Mausritter): karty jednostronne – bez rewersów i druku dwustronnego', async ({
  page,
}) => {
  await page.goto('./#/');
  await page.getByTestId('start-mausritter').click();
  await page.getByTestId('start-pusty-arkusz').click();
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });

  const panel = await otworzDruk(page);
  await expect(panel.getByRole('button', { name: /Nowy tył/ })).toHaveCount(0);
  await expect(panel.getByLabel('Domyślny tył talii')).toHaveCount(0);
  await expect(page.locator('.warstwa-rewersu')).toHaveCount(0);
});
