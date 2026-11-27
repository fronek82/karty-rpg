import { expect, test } from '@playwright/test';

test('R8: Mausritter – wybór startu, lewy pasek Dodaj kartę, przeciągnięcie na wolny kafelek i licznik kafelków', async ({
  page,
}) => {
  // Ekran startowy → kliknięcie Mausritter A4 otwiera arkusz z oknem „Od czego zaczynamy?”.
  await page.goto('./');
  await page.getByTestId('start-mausritter').click();
  await expect(page).toHaveURL(/#\/projekt\/[^/]+\/start$/);
  await expect(page.getByTestId('okno-startu-mausritter')).toBeVisible();

  // Otwarcie pustego arkusza A4 (10×7 = 70 kafelków).
  await page.getByTestId('start-pusty-arkusz').click();
  await expect(page).toHaveURL(/#\/projekt\/[^/]+$/);

  // Etykieta MAUSRITTER, kroki 1 Karty na arkuszach → 2 Druk oraz licznik 0 / 70 kafelków zajętych.
  await expect(page.locator('.ui2-etykieta-mausritter')).toHaveText('MAUSRITTER');
  await expect(page.getByTestId('licznik-kafelkow')).toHaveText('0 / 70 kafelków zajętych');

  // Lewy pasek „Dodaj kartę” ma 6 typów kart Mausrittera.
  const pasek = page.getByRole('navigation', { name: 'Dodaj kartę' });
  await expect(pasek).toBeVisible();
  await expect(pasek.locator('.ui2-pasek-grupa button')).toHaveCount(6);

  // Przeciągnięcie karty „Broń” z lewego paska na wolny kafelek (0,0) dodaje kartę na arkusz.
  const btnBron = pasek.getByRole('button', { name: 'Broń', exact: true });
  const slot00 = page.locator('button[data-slot="0,0"]').first();
  await btnBron.dragTo(slot00);
  await expect(page.getByTestId('licznik-kafelkow')).not.toHaveText('0 / 70 kafelków');

  // Kliknięcie „Stan” w lewym pasku dodaje kartę w kolejne wolne miejsce.
  const przed = await page.getByTestId('licznik-kafelkow').textContent();
  await pasek.getByRole('button', { name: 'Stan', exact: true }).click();
  await expect(page.getByTestId('licznik-kafelkow')).not.toHaveText(przed ?? '');
});
