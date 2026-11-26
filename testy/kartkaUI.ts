import { expect, type Page } from '@playwright/test';
import { eksportujSzablon } from '../src/dane/archiwum';
import { WERSJA_SCHEMATU, type Projekt } from '../src/model/projekt';
import { szablonCzaru } from '../src/silnik/__testy__/przyklady';
import { otworzDruk, slot } from './pomoc';

/** Wspólny początek testów układu kartki: karta czaru (z pliku szablonu) w slocie 1×1 i panel opcji druku. */

export function plikSzablonu() {
  const projekt: Projekt = {
    wersja: WERSJA_SCHEMATU,
    id: 'zrodlo',
    nazwa: 'źródło',
    utworzono: '2026-01-01T00:00:00.000Z',
    zmieniono: '2026-01-01T00:00:00.000Z',
    role: {},
    zasoby: [],
    szablony: [szablonCzaru],
    talie: [],
    arkusze: [],
  };
  return {
    name: 'czar.kartyrpg-szablon',
    mimeType: 'application/zip',
    buffer: Buffer.from(eksportujSzablon(projekt, new Map(), szablonCzaru.id).bajty),
  };
}

export async function kartkaCzaru(page: Page) {
  await page.goto('./#/');
  await page.getByRole('link', { name: /\+ NOWE KARTY/i }).click();
  await page.getByTestId('plik-szablonu-start').setInputFiles(plikSzablonu());
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
  await slot(page, 1, 1, 1).click();
  await page.getByRole('menuitem', { name: /Czar \(test\)/ }).click();
  await page
    .getByRole('complementary', { name: 'Zaznaczone karty' })
    .getByLabel('Nazwa', { exact: true })
    .fill('Ognista kula');
  return otworzDruk(page);
}
