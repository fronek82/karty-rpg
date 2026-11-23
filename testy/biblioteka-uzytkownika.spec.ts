import { expect, test, type Page } from '@playwright/test';
import { dodaj, kreator, panel } from './szablonUI';

/**
 * N8: jedna biblioteka użytkownika – to, co dodane w Bibliotekach albo w edytorze jednego projektu,
 * jest od razu w wyborach każdego projektu (grupy „Systemowe” / „Moja biblioteka”), a ten sam plik
 * wgrany drugi raz nie tworzy nowego wpisu.
 */

test.use({ viewport: { width: 1440, height: 1000 } });

/** Mały jednolity PNG narysowany w przeglądarce (kolor zmienia treść pliku). */
async function png(page: Page, kolor: string): Promise<Buffer> {
  const base64 = await page.evaluate((k) => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = k;
    ctx.fillRect(0, 0, 32, 32);
    return c.toDataURL().split(',')[1]!;
  }, kolor);
  return Buffer.from(base64, 'base64');
}

test('SVG zaimportowany w Bibliotekach → Ozdobniki jest od razu w wyborze ikony w nowym projekcie', async ({
  page,
}) => {
  await page.goto('./#/biblioteki/ozdobniki');
  await page.getByTestId('plik-svg').setInputFiles('testy/zasoby/gwiazdka.svg');
  await page.getByLabel('Nazwa', { exact: true }).fill('Moja gwiazdka');
  await page.getByRole('button', { name: 'Dodaj do biblioteki' }).click();
  await expect(
    page
      .getByTestId('siatka-biblioteki')
      .getByRole('button', { name: 'Moja gwiazdka', exact: true }),
  ).toBeVisible();

  await kreator(page, { nazwa: 'Nowy projekt', format: 'Standard / Poker', uklad: 'Pusta karta' });
  await dodaj(page, 'Ikona', 'Znak');
  await panel(page).getByLabel('Rodzaj grafiki').selectOption('ozdobnik');
  const wybor = page.getByTestId('wybor-ikony-svg');
  await expect(wybor.getByTestId('grupa-systemowe')).toHaveText('Systemowe');
  await expect(wybor.getByTestId('grupa-moja')).toHaveText('Moja biblioteka');
  const moja = wybor.getByRole('button', { name: 'Moja gwiazdka' });
  // Rysunek gwiazdki z pliku testowego w definicjach SVG karty (rysowany przez <use>).
  const gwiazdka = page.locator('.karta-podgladu svg path[d^="M5 0.5L6.3 3.6"]');
  await expect(gwiazdka).toHaveCount(0);
  await moja.click();
  await expect(moja).toHaveAttribute('aria-pressed', 'true');
  // Ikona z biblioteki rysuje się na karcie (bez ostrzeżenia o nieznanym elemencie).
  await expect(gwiazdka.first()).toBeAttached();
  await expect(panel(page).getByRole('alert')).toHaveCount(0);
});

test('obraz wgrany w edytorze jednego projektu jest w wyborze w drugim; ten sam plik – jeden wpis', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await kreator(page, { nazwa: 'Projekt A', format: 'Standard / Poker', uklad: 'Pusta karta' });
  await dodaj(page, 'Obraz');
  await panel(page).getByLabel('Treść', { exact: true }).selectOption('staly');
  const plik = { name: 'herb.png', mimeType: 'image/png', buffer: await png(page, '#2a6fd6') };
  await page.getByTestId('plik-stalego-obrazu').setInputFiles(plik);
  const lista = panel(page).getByLabel('Obraz z biblioteki');
  await expect(lista).toHaveValue('obraz-herb');

  await kreator(page, { nazwa: 'Projekt B', format: 'Standard / Poker', uklad: 'Pusta karta' });
  await dodaj(page, 'Obraz');
  await panel(page).getByLabel('Treść', { exact: true }).selectOption('staly');
  const listaB = panel(page).getByLabel('Obraz z biblioteki');
  await expect(listaB.locator('option', { hasText: 'herb.png' })).toHaveCount(1);
  await listaB.selectOption('obraz-herb');
  await expect(page.locator('.karta-podgladu svg image')).toHaveCount(1);

  // Ten sam plik (inna nazwa) wgrany drugi raz – odwołanie do istniejącego wpisu, bez nowego.
  await page.getByTestId('plik-stalego-obrazu').setInputFiles({ ...plik, name: 'herb-kopia.png' });
  await expect(listaB).toHaveValue('obraz-herb');
  await page.goto('./#/biblioteki/obrazy');
  await expect(page.getByTestId('siatka-biblioteki').getByRole('listitem')).toHaveCount(1);
});
