import { expect, test } from '@playwright/test';

async function otworzNowyEdytor(page: import('@playwright/test').Page) {
  await page.goto('./');
  await page.getByTestId('start-nowy-szablon').click();
  await page
    .getByTestId('okno-nowy-szablon')
    .getByRole('button', { name: 'Utwórz szablon' })
    .click();
  await expect(page).toHaveURL(/#\/szablon\/[^/]+$/, { timeout: 15000 });
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

  // Pasek stanu i powiększenie (między − i + wartość w procentach, np. 180%).
  const stan = page.getByTestId('pasek-stanu-edytora');
  await expect(stan).toContainText('63 × 88 mm');
  const zoomWartosc = page.getByTestId('zoom-wartosc');
  await expect(zoomWartosc).toHaveText(/^\d+%$/);
  const poczatkowyZoom = await zoomWartosc.textContent();
  await stan.getByRole('button', { name: 'Pomniejsz' }).click();
  await expect(zoomWartosc).toHaveText(/^\d+%$/);
  await expect(zoomWartosc).not.toHaveText(poczatkowyZoom!);
  await stan.getByRole('button', { name: 'Dopasuj' }).click();
  await expect(zoomWartosc).toHaveText(poczatkowyZoom!);
});

test('R4 / Plan S: pasek nad kartą bez zakładek wielu szablonów, z menu Szablon ▾', async ({
  page,
}) => {
  await otworzNowyEdytor(page);

  const pasekZakladek = page.getByRole('toolbar', { name: 'Szablon ▾' });
  await expect(pasekZakladek.locator('.edytor-ui2-zakladka')).toHaveCount(0);
  await expect(pasekZakladek.getByTestId('menu-szablon-przycisk')).toBeVisible();
});
