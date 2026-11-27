import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { eksportujSzablon } from '../src/dane/archiwum';
import { WERSJA_SCHEMATU, type Projekt } from '../src/model/projekt';
import type { Szablon } from '../src/model/szablon';
import { szablonCzaru, szablonStatystyk } from '../src/silnik/__testy__/przyklady';
import { kliknijPobierzPdf, otworzDruk, slot, zapisano } from './pomoc';
import { porownaj, przygotujStrone } from './pdfSvg';

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
  await page.goto('./#/wlasne');
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
  const ust = await otworzDruk(page);
  await ust.getByRole('button', { name: 'poziomo' }).click();
  await ust.getByLabel('Papier', { exact: true }).selectOption('foto-10x15');
  await expect(ust.getByLabel('Margines bezpieczeństwa (mm)')).toHaveValue('3');
  await expect(page.locator('.strefa-bezpieczenstwa')).toBeVisible();
  await expect(ust).toContainText('Strona 152 × 102 mm');
  await expect(ust.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.ostrzezenia-projektu')).toHaveCount(0);
  // Eksport szablonu z projektu.
  const [plik] = await Promise.all([
    page.waitForEvent('download'),
    ust.getByRole('button', { name: 'Eksportuj szablon Czar (test)' }).click(),
  ]);
  expect(plik.suggestedFilename()).toBe('czar-test.kartyrpg-szablon');

  // PDF się pobiera.
  const [pdf] = await Promise.all([page.waitForEvent('download'), kliknijPobierzPdf(page)]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);

  // Karta została na kartce (poza strefą).
  await page.getByRole('link', { name: '← Powrót' }).click();
  await expect(page.locator('[data-karta]')).toHaveCount(1);
});

test('szablon innego rozmiaru: własna kartka, w menu pierwszej kartki zablokowany', async ({
  page,
}) => {
  await page.goto('./#/wlasne');
  await page.getByTestId('plik-szablonu-start').setInputFiles(plikSzablonu(szablonCzaru));
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
  const ust = await otworzDruk(page);
  await ust.getByTestId('plik-szablonu').setInputFiles(plikSzablonu(szablonStatystyk));
  await expect(ust.locator('.sekcja-szablonow [role="status"]')).toContainText(
    'Dodano szablon „Blok statystyk (test)”',
  );
  // Powrót do edytora kart: druga kartka dla kart 88×63 (A4 poziomo, 3 × 3).
  await page.getByRole('link', { name: '← Powrót' }).click();
  await expect(page.locator('.kartka')).toHaveCount(2);
  await expect(page.locator('.kartka').nth(1).locator('.slot')).toHaveCount(9);

  await slot(page, 1, 1, 1).first().click();
  // Zablokowana pozycja zostaje osiągalna z klawiatury, z powodem w treści.
  const zablokowany = page.getByRole('menuitem', { name: /Blok statystyk/ });
  await expect(zablokowany).toHaveAttribute('aria-disabled', 'true');
  await expect(zablokowany).toContainText('Inny rozmiar karty (88×63 mm)');
  await expect(page.getByRole('menuitem', { name: /Czar \(test\)/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(zablokowany).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-karta]')).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: /Czar \(test\)/ })).toBeEnabled();
});

test('własny papier: pola wymiarów, odrzucenie zbyt małego, Cofnij przywraca pole', async ({
  page,
}) => {
  await page.goto('./#/wlasne');
  await page.getByTestId('plik-szablonu-start').setInputFiles(plikSzablonu(szablonCzaru));
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
  await slot(page, 1, 1, 1).click();
  await page.getByRole('menuitem', { name: /Czar \(test\)/ }).click();
  const ust = await otworzDruk(page);
  await ust.getByLabel('Papier', { exact: true }).selectOption('wlasny');
  const szer = ust.getByLabel('Szerokość w pionie (mm)');
  await expect(szer).toHaveValue('210');
  await szer.fill('150');
  await expect(ust).toContainText('Strona 150 × 297 mm');
  // 50 mm – karta 63 mm się nie zmieści: zmiana odrzucona, pole wraca po wyjściu z niego.
  await szer.fill('50');
  await expect(ust.getByRole('alert')).toContainText('nie zmieściłyby się');
  await szer.blur();
  await expect(szer).toHaveValue('150');
  await page.keyboard.press('Control+z');
  await expect(szer).toHaveValue('210');
});

test('pole tekstu zawija ciąg bez spacji i zachowuje szerokość panelu na kartce', async ({
  page,
}) => {
  const s: Szablon = {
    id: 'proba-tekstu',
    nazwa: 'Próba tekstu',
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    korzen: {
      id: 'korzen',
      typ: 'kolumna',
      padding: 4,
      dzieci: [
        {
          id: 'tekst',
          typ: 'tekst',
          klucz: 'tekst',
          nazwa: 'Tekst',
          szerokosc: { mm: 34 },
          wysokosc: { mm: 24 },
          styl: { czcionka: 'tresc', rozmiar: 4 },
        },
      ],
    },
  };
  await page.goto('./#/wlasne');
  await page.getByTestId('plik-szablonu-start').setInputFiles(plikSzablonu(s));
  await slot(page, 1, 2, 1).click();
  await page.getByRole('menuitem', { name: /Próba tekstu/ }).click();
  const panel = page.getByRole('complementary', { name: 'Zaznaczone karty' });
  const pole = panel.getByLabel('Tekst', { exact: true });
  const tekst = 'a'.repeat(46);
  await pole.fill(tekst);
  await expect(panel.getByRole('heading', { name: tekst })).toBeVisible();
  const svg = page.locator('.strona-kartki svg.svg-strony');
  const glify = svg.locator('use[transform^="matrix"]');
  await expect(glify).toHaveCount(46);
  const wiersze = await glify.evaluateAll(
    (els) => new Set(els.map((el) => el.getAttribute('transform')!.split(' ').at(-1))).size,
  );
  expect(wiersze).toBeGreaterThan(1);

  await pole.fill(tekst.repeat(8));
  await expect(svg.locator('g[clip-path]')).toHaveCount(1);
  await expect(panel).toContainText('tekst nie mieści się');
  expect(await panel.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1);

  const svgTekst = await svg.evaluate((e) => e.outerHTML);
  const [pdf] = await Promise.all([page.waitForEvent('download'), kliknijPobierzPdf(page)]);
  const bajty = await readFile(await pdf.path());
  await przygotujStrone(page);
  const wydruk = await porownaj(page, svgTekst, bajty, { x: 76, y: 12, szer: 55, wys: 40 });
  expect(wydruk.ciemneSvg).toBeGreaterThan(100);
  expect(wydruk.rozne / wydruk.wszystkie).toBeLessThan(0.001);
});
