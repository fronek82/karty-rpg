import { expect, test, type Page } from '@playwright/test';

/** Tabela danych talii (E7b): edycja, dodawanie, kopiowanie, usuwanie; zapis w IndexedDB. */

async function nowyProjekt(page: Page) {
  await page.goto('./#/projekty');
  await page.getByRole('button', { name: /Nowy projekt z pakietu/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Mausritter/ })).toBeVisible();
}

test('edycja talii stanów i zapis po przeładowaniu', async ({ page }) => {
  await nowyProjekt(page);
  await page.getByRole('link', { name: 'Karty stanów' }).click();
  await expect(page.getByLabel('Nazwa talii:')).toHaveValue('Karty stanów');
  const wiersze = page.locator('.tabela-danych tbody tr');
  const przed = await wiersze.count();

  // Edycja nazwy i ilości pierwszej karty.
  const nazwa = page.getByLabel('Nazwa, karta 1', { exact: true });
  await nazwa.fill('Przemoczony');
  await page.getByLabel('Ilość, karta 1', { exact: true }).fill('5');
  // Parametr szablonu – pusta komórka pokazuje wartość domyślną.
  await expect(page.getByLabel('Etykieta usunięcia, karta 1', { exact: true })).toHaveAttribute(
    'placeholder',
    'Usunięcie:',
  );

  // Kopia karty 1 → karta 2 z tą samą nazwą; usunięcie kopii.
  await page.getByRole('button', { name: 'Kopiuj kartę 1' }).click();
  await expect(wiersze).toHaveCount(przed + 1);
  await expect(page.getByLabel('Nazwa, karta 2', { exact: true })).toHaveValue('Przemoczony');
  await page.getByRole('button', { name: 'Usuń kartę 2' }).click();
  await expect(wiersze).toHaveCount(przed);

  // Nowa karta na końcu, przesunięcie w górę.
  await page.getByRole('button', { name: 'Dodaj kartę' }).click();
  await expect(wiersze).toHaveCount(przed + 1);
  await page.getByLabel(`Nazwa, karta ${przed + 1}`, { exact: true }).fill('Nowy stan');
  await page.getByRole('button', { name: `Przesuń kartę ${przed + 1} wyżej` }).click();
  await expect(page.getByLabel(`Nazwa, karta ${przed}`, { exact: true })).toHaveValue('Nowy stan');

  await expect(page.getByRole('status')).toHaveText('Zapisano');
  await page.reload();
  await expect(page.getByLabel('Nazwa, karta 1', { exact: true })).toHaveValue('Przemoczony');
  await expect(page.getByLabel('Ilość, karta 1', { exact: true })).toHaveValue('5');
  await expect(page.getByLabel(`Nazwa, karta ${przed}`, { exact: true })).toHaveValue('Nowy stan');
});

test('talia broni: komórki spoza szablonu nieaktywne, zmiana rozmiaru karty', async ({ page }) => {
  await nowyProjekt(page);
  await page.getByRole('link', { name: 'Karty broni i pancerzy' }).click();
  // Broń nie ma parametru „Obrona” (to pole zbroi).
  await expect(page.getByLabel('Obrona, karta 1', { exact: true })).toHaveCount(0);
  const rozmiar = page.getByLabel('Rozmiar, karta 1', { exact: true });
  await expect(rozmiar).toHaveValue('1×1');
  await rozmiar.selectOption('1×2');
  await expect(page.getByRole('status')).toHaveText('Zapisano');
  await page.reload();
  await expect(page.getByLabel('Rozmiar, karta 1', { exact: true })).toHaveValue('1×2');
});
