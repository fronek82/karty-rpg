import { expect, test } from '@playwright/test';
import { otworzDruk, panelDruku, slot, zapisano } from './pomoc';

/**
 * Globalna biblioteka rewersów + wyrównanie lewego menu na ekranie startowym:
 * - lewe menu na ekranie startowym jest obniżone i wyrównane z kartami projektów,
 * - rewers zaprojektowany przez „Nowy szablon od zera → Rewers” trafia do zapisanych rewersów,
 * - w innym projekcie własnym można go wybrać przy dowolnej karcie lub talii; projekt Mausrittera
 *   (karty jednostronne) nie pokazuje rewersów.
 */

test.use({ viewport: { width: 1440, height: 900 } });

test('ekran startowy: lewe menu ma górny odstęp wyrównujący pierwszy przycisk do sekcji projektów', async ({
  page,
}) => {
  await page.goto('./#/');
  await expect(page.getByRole('heading', { level: 2, name: 'Moje projekty' })).toBeVisible();
  const kolumny = (await page.locator('.start-kolumny').boundingBox())!;
  const pierwszyPrzycisk = (await page
    .locator('.start-kolumny > .start-menu .pasek-menu')
    .first()
    .boundingBox())!;
  // padding-top kontenera kolumn + padding-top menu + etykieta „NOWY PROJEKT” obniżają przycisk.
  expect(pierwszyPrzycisk.y - kolumny.y).toBeGreaterThanOrEqual(60);
});

test('zaprojektowany rewers jest dostępny do wybrania przy dowolnej karcie w osobnym projekcie awersu', async ({
  page,
}) => {
  // 1) Zaprojektuj rewers przez „Nowy szablon od zera → Rewers”.
  await page.goto('./#/wlasne/nowy');
  await page.getByRole('button', { name: /^Rewers/ }).click();
  await expect(page).toHaveURL(/#\/projekt\/.+\/rewers\//, { timeout: 15000 });
  const poleNazwy = page.getByLabel('Nazwa rewersu');
  await expect(poleNazwy).toBeVisible({ timeout: 15000 });
  await poleNazwy.fill('Rewers Warlock');
  await zapisano(page);

  // 2) Stwórz osobny projekt awersu („Warlock! Czary”) i dodaj kartę.
  await page.goto('./#/wlasne/nowy/awers');
  await page.getByLabel('Nazwa szablonu').fill('Warlock! Czary');
  await page.getByText('Tytuł i opis').click();
  await page.getByRole('button', { name: /Dalej: układ pól/ }).click();
  await expect(page.getByRole('tree', { name: 'Struktura karty' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Edytor kart ►', exact: true }).click();
  await expect(slot(page, 1, 1, 1)).toBeVisible({ timeout: 15000 });
  await slot(page, 1, 1, 1).click();
  await page.getByRole('menuitem', { name: /Warlock! Czary/ }).click();

  // 3) W panelu zaznaczonej karty wybierz „Rewers Warlock” z zapisanych rewersów.
  const panelKarty = page.getByRole('complementary', { name: 'Zaznaczone karty' });
  const wyborRewersu = panelKarty.getByLabel('Rewers', { exact: true });
  await expect(wyborRewersu.locator('optgroup[label="Zapisane rewersy"] option')).toHaveText([
    'Rewers Warlock',
  ]);
  await wyborRewersu.selectOption({ label: 'Rewers Warlock' });
  await zapisano(page);
  // Po dołączeniu rewers jest już w projekcie i przypisany do karty.
  await expect(wyborRewersu).toHaveValue('rewers');
  await expect(panelKarty.locator('.podglad-rewersu-mini svg')).toBeVisible();

  // 4) W „Drukuj karty” rewers jest widoczny w sekcji Rewersy projektu.
  await otworzDruk(page);
  const druk = panelDruku(page);
  await expect(druk.locator('strong', { hasText: 'Rewers Warlock' })).toBeVisible();

  // 5) Projekt Mausrittera ma karty jednostronne – bez wyboru rewersów (etap N1).
  await page.goto('./#/gra/mausritter');
  await page.getByRole('button', { name: /Pusta kartka A4/ }).click();
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
  const drukMaus = await otworzDruk(page);
  await expect(drukMaus.getByLabel('Domyślny rewers talii')).toHaveCount(0);
  await expect(drukMaus.getByRole('button', { name: /Nowy rewers/ })).toHaveCount(0);
});
