import { expect, test } from '@playwright/test';

async function otworzNowyEdytor(page: import('@playwright/test').Page) {
  await page.goto('./');
  await page.getByTestId('start-nowy-szablon').click();
  await page
    .getByTestId('okno-nowy-szablon')
    .getByRole('button', { name: 'Utwórz szablon' })
    .click();
  await expect(page.getByTestId('kafelek-szablonu')).toHaveCount(1, { timeout: 10000 });
  await page.getByTestId('start-nowe-karty').click();
  const okno = page.getByTestId('okno-nowy-projekt');
  await okno.getByTestId('np-lista-szablonow').locator('button').first().click();
  await okno.getByRole('button', { name: 'Utwórz projekt' }).click();
  await page
    .getByRole('navigation', { name: 'Etapy projektu' })
    .getByRole('link', { name: /Szablony/ })
    .click();
  await expect(page.locator('.karta-podgladu')).toBeVisible();
}

test('R5: linijki w mm, pas zaznaczenia oraz dodawanie, przesuwanie i usuwanie linii pomocniczych', async ({
  page,
}) => {
  await otworzNowyEdytor(page);

  const linijkaH = page.getByTestId('linijka-pozioma');
  const linijkaV = page.getByTestId('linijka-pionowa');
  const karta = page.locator('.karta-podgladu');
  await expect(linijkaH).toBeVisible();
  await expect(linijkaV).toBeVisible();

  // Dodanie elementu Tekst zaznacza go i pokazuje pas na obu linijkach.
  const pasek = page.getByRole('navigation', { name: 'Dodaj element' });
  await pasek.getByRole('button', { name: 'Tekst', exact: true }).click();
  await expect(page.getByTestId('linijka-zazn-x')).toBeVisible();
  await expect(page.getByTestId('linijka-zazn-y')).toBeVisible();

  // Przeciągnięcie z górnej linijki w dół na kartę tworzy linię poziomą.
  const boxH = (await linijkaH.boundingBox())!;
  const boxK = (await karta.boundingBox())!;
  await page.mouse.move(boxH.x + boxH.width / 2, boxH.y + boxH.height / 2);
  await page.mouse.down();
  await page.mouse.move(boxK.x + boxK.width / 2, boxK.y + boxK.height * 0.4, { steps: 5 });
  await expect(page.getByTestId('etykieta-linii')).toBeVisible();
  await page.mouse.up();

  const linie = page.getByTestId('linia-pomocnicza');
  await expect(linie).toHaveCount(1);
  await expect(linie.first()).toHaveAttribute('data-os', 'h');
  const startMm = Number(await linie.first().getAttribute('data-mm'));
  expect(startMm).toBeGreaterThan(10);

  // Przesunięcie istniejącej linii w dół zmienia jej pozycję w mm.
  const boxL = (await linie.first().boundingBox())!;
  await page.mouse.move(boxL.x + boxL.width / 2, boxL.y + boxL.height / 2);
  await page.mouse.down();
  await page.mouse.move(boxK.x + boxK.width / 2, boxK.y + boxK.height * 0.7, { steps: 5 });
  await page.mouse.up();
  const nowyMm = Number(await linie.first().getAttribute('data-mm'));
  expect(nowyMm).toBeGreaterThan(startMm + 5);

  // Skrót Ctrl+; ukrywa i ponownie pokazuje linie pomocnicze.
  await page.keyboard.press('Control+;');
  await expect(linie).toHaveCount(0);
  await page.keyboard.press('Control+;');
  await expect(linie).toHaveCount(1);

  // Dodanie linii pionowej z lewej linijki.
  const boxV = (await linijkaV.boundingBox())!;
  await page.mouse.move(boxV.x + boxV.width / 2, boxV.y + boxV.height / 2);
  await page.mouse.down();
  await page.mouse.move(boxK.x + boxK.width * 0.5, boxK.y + boxK.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(linie).toHaveCount(2);

  // Upuszczenie linii z powrotem na górną linijkę usuwa ją.
  const liniaH = page.locator('[data-testid="linia-pomocnicza"][data-os="h"]').first();
  const boxLH = (await liniaH.boundingBox())!;
  await page.mouse.move(boxLH.x + 24, boxLH.y + boxLH.height / 2);
  await page.mouse.down();
  await page.mouse.move(boxH.x + 24, boxH.y + 4, { steps: 5 });
  await page.mouse.up();
  await expect(linie).toHaveCount(1);

  // Przycisk „Usuń wszystkie linie” w dymku paska stanu usuwa pozostałe linie.
  await page.getByTestId('stan-linie').click();
  await page.getByTestId('usun-linie').click();
  await expect(linie).toHaveCount(0);

  // SVG karty nie zawiera żadnych elementów linii pomocniczych.
  await expect(page.locator('.svg-opakowanie [data-testid="linia-pomocnicza"]')).toHaveCount(0);
});
