import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { otworzDruk, slot, zapisano } from './pomoc';
import { dodaj, kreator, sekcja, zaznacz } from './szablonUI';

/**
 * Nowe poprawki UX:
 * 1. Globalne czcionki (pobrane z Google Fonts i wgrane) są pamiętane między projektami
 *    i dostępne od razu na listach wyboru w edytorze szablonu oraz opcjach druku bez ponownego wgrywania.
 * 2. Katalog Google Fonts ma ≥120 krojów i obsługuje pobieranie dowolnego kroju po nazwie.
 * 3. W Edytorze kart u dołu prawego panelu dostępny jest przycisk „Eksportuj szablon CSV”
 *    generujący gotowy plik CSV z nagłówkami pól szablonu do uzupełnienia.
 */

test.use({ viewport: { width: 1440, height: 1000 } });

const ttf = (nazwa: string) => readFileSync(resolve('public/czcionki', nazwa));

test('czcionka pobrana z Google Fonts w projekcie A jest od razu dostępna w istniejącym projekcie B i w edytorze szablonu', async ({
  page,
}) => {
  const garamond = ttf('EBGaramond-Regular.ttf');
  const cinzel = ttf('CinzelDecorative-Bold.ttf');
  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '' }),
  );
  await page.route(
    /^https:\/\/(cdn\.jsdelivr\.net|raw\.githubusercontent\.com)\//,
    async (route) => {
      const cialo = /cinzel/i.test(route.request().url()) ? cinzel : garamond;
      await route.fulfill({ status: 200, contentType: 'font/ttf', body: cialo });
    },
  );
  await page.route(
    /^https:\/\/api\.github\.com\/repos\/google\/fonts\/contents\//,
    async (route) => {
      if (route.request().url().endsWith('/ofl/cinzel')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ name: 'Cinzel-Regular.ttf', type: 'file' }]),
        });
        return;
      }
      await route.fulfill({ status: 404, body: '{}' });
    },
  );

  // 1) Utwórz projekt B (istniejący wcześniej, bez dodatkowych czcionek).
  await kreator(page, {
    nazwa: 'Projekt B',
    format: 'Standard / Poker',
    uklad: 'Tytuł i opis',
  });
  await zapisano(page);
  const urlProjektuB = page.url();

  // 2) Utwórz projekt A, pobierz krój z katalogu (MedievalSharp) oraz dowolny po nazwie (Cinzel).
  await kreator(page, {
    nazwa: 'Projekt A',
    format: 'Standard / Poker',
    uklad: 'Tytuł i opis',
  });
  await page.getByRole('button', { name: 'Przejdź do kart →', exact: true }).click();
  await expect(slot(page, 1, 1, 1)).toBeVisible({ timeout: 15000 });
  const drukA = await otworzDruk(page);
  const katalog = drukA.locator('details.katalog-google-fonts');
  await katalog.locator('summary').click();
  await expect
    .poll(() => katalog.locator('.pozycja-google-font').count())
    .toBeGreaterThanOrEqual(120);

  await katalog.getByLabel('Szukaj kroju').fill('MedievalSharp');
  await katalog.getByRole('button', { name: 'Pobierz krój MedievalSharp z Google Fonts' }).click();
  await expect(katalog.getByRole('button', { name: 'MedievalSharp – dodano' })).toBeDisabled();

  // Pobierz też dowolny krój spoza katalogu po nazwie.
  await katalog.getByLabel('Inny krój z Google Fonts (ponad 1700 rodzin)').fill('Cinzel');
  await katalog.locator('.katalog-google-dowolny button').click();
  await expect(drukA.locator('fieldset.sekcja-czcionek [role="status"]')).toContainText(
    /Pobrano krój/,
  );

  // 3) Wróć do istniejącego projektu B – MedievalSharp jest od razu do wyboru w Stylu tekstu!
  // (Najpierw zapis projektu A – inaczej wyjście zatrzymuje okno „Niezapisane zmiany”.)
  await zapisano(page);
  await page.goto(urlProjektuB);
  await expect(page.getByRole('tree', { name: 'Struktura karty' })).toBeVisible({ timeout: 15000 });
  await zaznacz(page, 'Opis');
  const styl = await sekcja(page, 'Styl tekstu');
  const wyborCzcionki = styl.getByLabel('Czcionka', { exact: true });
  await expect(wyborCzcionki.locator('option[value="MedievalSharp"]')).toHaveCount(1);
  await wyborCzcionki.selectOption('MedievalSharp');
  await zapisano(page);
  await expect(wyborCzcionki).toHaveValue('MedievalSharp');
});

test('Edytor kart: eksport przygotowanego szablonu CSV u dołu prawego panelu', async ({ page }) => {
  await kreator(page, {
    nazwa: 'Zaklęcia Warlocka',
    format: 'Standard / Poker',
    uklad: 'Tytuł i opis',
  });
  await dodaj(page, 'Tekst', 'Koszt');
  await page.getByRole('button', { name: 'Przejdź do kart →', exact: true }).click();
  await expect(slot(page, 1, 1, 1)).toBeVisible({ timeout: 15000 });

  // Bez zaznaczonej karty: przycisk eksportu szablonu CSV jest u dołu prawego panelu.
  const panelPomoc = page.getByRole('complementary', { name: 'Pomoc' });
  const przyciskCsv = panelPomoc.getByRole('button', { name: 'Eksportuj szablon CSV' });
  await expect(przyciskCsv).toBeVisible();

  const [pobranie] = await Promise.all([page.waitForEvent('download'), przyciskCsv.click()]);
  expect(pobranie.suggestedFilename()).toMatch(/\.csv$/);
  const sciezka = await pobranie.path();
  const tresc = readFileSync(sciezka!, 'utf8');
  expect(tresc.startsWith('\uFEFF')).toBe(true);
  const naglowki = tresc
    .replace(/^\uFEFF/, '')
    .trim()
    .split(';');
  expect(naglowki).toEqual(['Tytuł', 'Opis', 'Koszt', 'Ilość']);

  // Po zaznaczeniu karty: przycisk jest także u dołu panelu zaznaczonej karty.
  await slot(page, 1, 1, 1).click();
  await page.getByRole('menuitem', { name: /Zaklęcia Warlocka/ }).click();
  const panelKarty = page.getByRole('complementary', { name: 'Zaznaczone karty' });
  await expect(panelKarty.getByRole('button', { name: 'Eksportuj szablon CSV' })).toBeVisible();
});
