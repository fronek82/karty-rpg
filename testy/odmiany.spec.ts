import { expect, test } from '@playwright/test';
import { zapisano } from './pomoc';
import { dodaj, drzewo, karta, kartaNaKartce, kreator, sekcja, zaznacz } from './szablonUI';

/*
 * N12: przełącznik odmian – wiersz „ikona + tekst” staje się pierwszą odmianą, „Dodaj odmianę”
 * kopiuje cały wiersz; na karcie widać jedną odmianę, wybraną wartością w danych karty.
 */

test('przełącznik odmian: cały wiersz jako odmiana, kopia odmiany, wybór w panelu karty', async ({
  page,
}) => {
  await kreator(page, { nazwa: 'Śledztwo', format: 'Standard / Poker', uklad: 'Pusta karta' });
  await karta(page);
  await dodaj(page, 'Wiersz', 'Rodzaj');
  await dodaj(page, 'Ikona', 'Ludzik');
  await zaznacz(page, 'Rodzaj');
  await dodaj(page, 'Tekst', 'Podejrzany');

  const obszar = (nazwa: string) =>
    page.locator(`.karta-podgladu .obszar-wezla[aria-label="${nazwa}"]`);
  const wDrzewie = (nazwa: string) =>
    drzewo(page).getByRole('treeitem', { name: new RegExp(`^${nazwa} – `) });

  // Włączenie na wierszu z polami: ikona i tekst razem tworzą odmianę 1.
  await zaznacz(page, 'Rodzaj');
  const s = await sekcja(page, 'Wersje z danych');
  await s.getByLabel('Pokazuj jedną wersję wybraną w danych karty').check();
  await expect(s).toContainText('Pole danych karty: rodzaj');
  await expect(wDrzewie('Wersja 1')).toContainText('= 1');
  await expect(wDrzewie('Ludzik')).not.toContainText('=');
  await expect(obszar('Ludzik')).toHaveCount(1);
  await expect(obszar('Podejrzany')).toHaveCount(1);

  // „Dodaj odmianę” – kopia całego wiersza; podgląd dalej pokazuje jedną odmianę.
  await s.getByRole('button', { name: '＋ Dodaj wersję' }).click();
  await expect(wDrzewie('Wersja 2')).toContainText('= 2');
  await expect(obszar('Ludzik')).toHaveCount(1);
  await expect(obszar('Ludzik (kopia)')).toHaveCount(0);

  // Zaznaczenie elementu w odmianie 2 pokazuje ją w podglądzie.
  await zaznacz(page, 'Podejrzany (kopia)');
  await expect(obszar('Podejrzany (kopia)')).toHaveCount(1);
  await expect(obszar('Podejrzany')).toHaveCount(0);
  await zapisano(page);

  // Edytor kart: lista wyboru odmiany.
  const p = await kartaNaKartce(page, 'Śledztwo', {});
  const wybor = p.getByLabel('Rodzaj', { exact: true });
  await expect(wybor.locator('option')).toHaveText([
    '— domyślna —',
    '1 – Wersja 1',
    '2 – Wersja 2',
  ]);
  await wybor.selectOption('2');
  await expect(wybor).toHaveValue('2');
});
