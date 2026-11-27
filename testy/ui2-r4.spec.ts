import { expect, test } from '@playwright/test';

async function otworzNowyEdytor(page: import('@playwright/test').Page) {
  await page.goto('./');
  await page.getByTestId('start-nowe-karty').click();
  const okno = page.getByRole('dialog', { name: 'Nowy projekt' });
  await expect(okno).toBeVisible();
  await okno.getByRole('button', { name: 'Utwórz projekt' }).click();
  await expect(page.locator('.karta-podgladu')).toBeVisible();
}

test('R4: lewy pasek zwinięty domyślnie, Swobodny pierwszy z odznaką DOMYŚLNY', async ({
  page,
}) => {
  await otworzNowyEdytor(page);

  const pasek = page.getByRole('navigation', { name: 'Dodaj element' });
  await expect(pasek).toBeVisible();
  await expect(pasek).toHaveAttribute('data-stan', 'zwiniety');

  // Rozwinięcie paska pokazuje grupy i odznakę DOMYŚLNY przy Układzie swobodnym.
  await pasek.getByRole('button', { name: /Rozwiń pasek/i }).click();
  await expect(pasek).toHaveAttribute('data-stan', 'rozwiniety');
  const przyciski = pasek.locator('.ui2-pasek-grupa button');
  await expect(przyciski.first()).toContainText('Swobodny');
  await expect(przyciski.first()).toContainText('DOMYŚLNY');
});

test('R4: przeciągnięcie elementu z lewego paska na kartę dodaje go w miejscu upuszczenia', async ({
  page,
}) => {
  await otworzNowyEdytor(page);

  const pasek = page.getByRole('navigation', { name: 'Dodaj element' });
  const btnTekst = pasek.getByRole('button', { name: 'Tekst', exact: true });
  const karta = page.locator('.karta-podgladu');

  // Przeciągnięcie elementu Tekst na kartę (dragTo używa HTML5 DnD).
  await btnTekst.dragTo(karta, { targetPosition: { x: 80, y: 100 } });

  const drzewo = page.getByRole('tree', { name: 'Struktura karty' });
  await expect(drzewo.getByRole('treeitem', { name: /Tekst/ })).toBeVisible();
});

test('R4: zwijana i przesuwana Struktura w prawej kolumnie + pasek stanu z zoomem', async ({
  page,
}) => {
  await otworzNowyEdytor(page);

  // Zwijanie i rozwijanie Struktury.
  const przelacz = page.getByTestId('przelacz-strukture');
  await expect(przelacz).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('tree', { name: 'Struktura karty' })).toBeVisible();

  await przelacz.click();
  await expect(przelacz).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('tree', { name: 'Struktura karty' })).toBeHidden();

  await przelacz.click();
  await expect(przelacz).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('granica-struktury')).toBeVisible();

  // Pasek stanu i powiększenie.
  const stan = page.getByTestId('pasek-stanu-edytora');
  await expect(stan).toContainText('63 × 88 mm');
  await expect(page.getByTestId('zoom-wartosc')).toHaveText('Dopasuj');
  await stan.getByRole('button', { name: 'Powiększ' }).click();
  await expect(page.getByTestId('zoom-wartosc')).toHaveText('125%');
  await stan.getByRole('button', { name: 'Dopasuj' }).click();
  await expect(page.getByTestId('zoom-wartosc')).toHaveText('Dopasuj');
});

test('R4: zakładki szablonów i dodanie nowego szablonu w projekcie', async ({ page }) => {
  await otworzNowyEdytor(page);

  const pasekZakladek = page.getByRole('toolbar', { name: 'Szablony' });
  await expect(pasekZakladek.locator('.edytor-ui2-zakladka')).toHaveCount(1);

  await pasekZakladek.getByRole('button', { name: '＋ Nowy szablon' }).click();
  await expect(pasekZakladek.locator('.edytor-ui2-zakladka')).toHaveCount(2);
});
