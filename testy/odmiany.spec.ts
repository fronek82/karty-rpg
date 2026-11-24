import { expect, test } from '@playwright/test';
import { zapisano } from './pomoc';
import { dodaj, drzewo, karta, kartaNaKartce, kreator, sekcja, zaznacz } from './szablonUI';

/*
 * N12: przełącznik odmian – kolumna z dwiema odmianami, na karcie widać jedną, wybraną
 * wartością w danych karty.
 */

test('przełącznik odmian: jedna odmiana na podglądzie, wartości i wybór w panelu karty', async ({
  page,
}) => {
  await kreator(page, { nazwa: 'Śledztwo', format: 'Standard / Poker', uklad: 'Pusta karta' });
  await karta(page);
  await dodaj(page, 'Kolumna', 'Rodzaj');
  await dodaj(page, 'Tekst', 'Podejrzany');
  await zaznacz(page, 'Rodzaj');
  await dodaj(page, 'Tekst', 'Wskazówka');

  const obszar = (nazwa: string) =>
    page.locator(`.karta-podgladu .obszar-wezla[aria-label="${nazwa}"]`);
  await expect(obszar('Podejrzany')).toHaveCount(1);
  await expect(obszar('Wskazówka')).toHaveCount(1);

  await zaznacz(page, 'Rodzaj');
  const s = await sekcja(page, 'Odmiany z danych');
  await s.getByLabel('Pokazuj jedną odmianę wybraną w danych karty').check();
  await expect(s).toContainText('Pole danych karty: rodzaj');
  // Bez wartości – pierwsza odmiana; druga nie zajmuje miejsca na karcie.
  await expect(obszar('Podejrzany')).toHaveCount(1);
  await expect(obszar('Wskazówka')).toHaveCount(0);
  await expect(drzewo(page).getByRole('treeitem', { name: /^Wskazówka – / })).toContainText('= 2');

  await s.getByLabel('Wartość odmiany „Wskazówka”').fill('W');
  await expect(drzewo(page).getByRole('treeitem', { name: /^Wskazówka – / })).toContainText('= W');

  // Zaznaczenie elementu w odmianie pokazuje ją w podglądzie.
  await zaznacz(page, 'Wskazówka');
  await expect(obszar('Wskazówka')).toHaveCount(1);
  await expect(obszar('Podejrzany')).toHaveCount(0);
  await zapisano(page);

  // Edytor kart: lista wyboru odmiany.
  const p = await kartaNaKartce(page, 'Śledztwo', {});
  const wybor = p.getByLabel('Rodzaj', { exact: true });
  await expect(wybor.locator('option')).toHaveText([
    '— domyślna —',
    '1 – Podejrzany',
    'W – Wskazówka',
  ]);
  await wybor.selectOption('W');
  await expect(wybor).toHaveValue('W');
});
