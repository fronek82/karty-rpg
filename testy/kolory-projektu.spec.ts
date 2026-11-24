import { expect, test, type Page } from '@playwright/test';
import { zapisano } from './pomoc';
import { drzewo } from './szablonUI';

/*
 * N11: kolory projektu przy polach koloru – kolor tyłu wybrany na przodzie jednym kliknięciem,
 * zapisanie i usunięcie koloru z palety projektu.
 */

const poleTla = (page: Page) =>
  page.locator('.pole-koloru', { has: page.locator('#karta-tlo-kolor') });

test('kolor tła tyłu wybrany na przodzie z „Kolorów projektu”, zapis i usunięcie koloru', async ({
  page,
}) => {
  // Tył z ciemnym tłem.
  await page.goto('./#/wlasne/nowy/rewers');
  await page.getByLabel('Nazwa tyłu').fill('Tył kolorowy');
  await page.locator('label.format', { hasText: 'Standard / Poker' }).click();
  await page.locator('label.uklad', { hasText: 'Pusta karta' }).click();
  await page.getByRole('button', { name: /Dalej: edytor tyłu/ }).click();
  await expect(drzewo(page)).toBeVisible({ timeout: 15000 });
  const id = /#\/projekt\/([^/]+)\//.exec(page.url())![1]!;
  await page.locator('#karta-tlo-kolor').fill('#112233');
  await zapisano(page);

  // Przód w tym samym projekcie.
  await page.goto(`./#/projekt/${id}/nowy-szablon`);
  await page.getByLabel('Nazwa szablonu').fill('Przód kolorowy');
  await page.getByRole('button', { name: /Dalej: układ pól/ }).click();
  await expect(page).toHaveURL(/\/szablon\//, { timeout: 15000 });
  await expect(drzewo(page)).toBeVisible({ timeout: 15000 });

  const pole = poleTla(page);
  const przycisk = pole.locator('.przycisk-kolorow-projektu');
  await expect(przycisk).toHaveAttribute('aria-expanded', 'false');
  await przycisk.click();
  const kolory = pole.getByRole('group', { name: 'Kolory projektu' });
  await expect(kolory.locator('[data-grupa="zapisane"]')).toContainText('Brak');
  await kolory.locator('[data-grupa="uzyte"] [data-kolor="#112233"]').click();
  await expect(page.locator('#karta-tlo-kolor')).toHaveValue('#112233');
  await expect(page.locator('.karta-podgladu svg [fill="#112233"]').first()).toBeAttached();

  // Zapisanie bieżącego koloru – trafia do „Zapisane”, znika z „Użyte w projekcie”.
  await kolory.getByRole('button', { name: 'Zapisz ten kolor' }).click();
  await expect(kolory.locator('[data-grupa="zapisane"] [data-kolor="#112233"]')).toBeVisible();
  await expect(kolory.locator('[data-grupa="uzyte"] [data-kolor="#112233"]')).toHaveCount(0);
  await expect(kolory.getByRole('button', { name: 'Zapisz ten kolor' })).toHaveCount(0);

  // „Cofnij” cofa zapisanie, ponowne zapisanie i usunięcie przyciskiem ×.
  await page.getByRole('button', { name: 'Cofnij', exact: true }).click();
  await expect(kolory.locator('[data-grupa="zapisane"] [data-kolor="#112233"]')).toHaveCount(0);
  await kolory.getByRole('button', { name: 'Zapisz ten kolor' }).click();
  await kolory.getByRole('button', { name: 'Usuń #112233 z zapisanych' }).click();
  await expect(kolory.locator('[data-grupa="zapisane"]')).toContainText('Brak');
});
