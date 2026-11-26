import { expect, test } from '@playwright/test';

/**
 * N7, N8: menu „Biblioteki” – trzy podstrony o tym samym układzie (Obrazy, Czcionki, Ozdobniki):
 * „Dodaj”, wyszukiwarka, siatka podglądów na środku, zmiana nazwy, pobieranie, usuwanie
 * nieużywanego wpisu bez potwierdzenia z „Cofnij”.
 */

test('Biblioteki: obrazy, czcionki (próbka kroju) i ozdobniki – dodawanie, szukanie, usuwanie z „Cofnij”', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('./#/');
  await page.getByRole('link', { name: 'Biblioteka', exact: true }).click();
  await expect(page).toHaveURL(/#\/biblioteki$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Biblioteki' })).toBeVisible();
  const zakladki = page.getByRole('navigation', { name: 'Rodzaje bibliotek' });
  await expect(zakladki.getByRole('link', { name: 'Obrazy' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByText('Nie ma jeszcze zapisanych obrazów.')).toBeVisible();

  // Obrazy: dwa pliki, podglądy w siatce wyśrodkowanej na stronie.
  await page
    .getByTestId('plik-obrazu-globalny')
    .setInputFiles(['testy/zasoby/litera-f.png', 'testy/zasoby/ramka-testowa.png']);
  const siatka = page.getByTestId('siatka-biblioteki');
  await expect(siatka.getByRole('listitem')).toHaveCount(2, { timeout: 15000 });
  await expect(siatka.locator('img').first()).toBeVisible();
  const ramkaSiatki = (await siatka.boundingBox())!;
  const kafelki = siatka.getByRole('listitem');
  const pierwszy = (await kafelki.first().boundingBox())!;
  const ostatni = (await kafelki.last().boundingBox())!;
  const lewo = pierwszy.x - ramkaSiatki.x;
  const prawo = ramkaSiatki.x + ramkaSiatki.width - (ostatni.x + ostatni.width);
  expect(Math.abs(lewo - prawo)).toBeLessThanOrEqual(2);

  // Szukanie bez znaków diakrytycznych i wielkości liter.
  const szukaj = page.getByRole('searchbox', { name: 'Szukaj obrazów po nazwie' });
  await szukaj.fill('LITERA');
  await expect(kafelki).toHaveCount(1);
  await szukaj.fill('');

  // Usuwanie bez potwierdzenia, pasek „Cofnij” na dole ekranu przywraca wpis.
  await page.getByRole('button', { name: 'Usuń „litera-f.png” z biblioteki' }).click();
  await expect(kafelki).toHaveCount(1);
  const pasek = page.getByTestId('pasek-komunikatu');
  await expect(pasek).toContainText('Usunięto: litera-f.png');
  await pasek.getByRole('button', { name: 'Cofnij' }).click();
  await expect(kafelki).toHaveCount(2);

  // Czcionki: próbka tekstu tym krojem.
  await zakladki.getByRole('link', { name: 'Czcionki' }).click();
  await expect(page).toHaveURL(/#\/biblioteki\/czcionki$/);
  await page
    .getByTestId('plik-czcionki-globalny')
    .setInputFiles('public/czcionki/CinzelDecorative-Bold.ttf');
  const probka = page.getByTestId('probka-czcionki');
  await expect(probka).toHaveCSS('font-family', /karty-bib-/, { timeout: 15000 });
  await expect(siatka).toContainText('Cinzel Decorative');
  await expect(page.getByText('Katalog Google Fonts', { exact: true })).toBeVisible();

  // Ozdobniki: SVG i PNG (ramka 9-slice) dodane wprost, podglądy na środku.
  await zakladki.getByRole('link', { name: 'Ozdobniki' }).click();
  await page
    .getByTestId('plik-ozdobnika-globalny')
    .setInputFiles(['testy/zasoby/gwiazdka.svg', 'testy/zasoby/ramka-testowa.png']);
  await expect(kafelki).toHaveCount(2, { timeout: 15000 });
  await expect(siatka.locator('svg.miniatura-ozdobnika')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Pobierz „gwiazdka”' })).toBeVisible();

  // Zmiana nazwy w kafelku.
  await page.getByRole('button', { name: 'Zmień nazwę „gwiazdka”' }).click();
  await page.getByRole('textbox', { name: 'Nowa nazwa „gwiazdka”' }).fill('Gwiazda');
  await page.keyboard.press('Enter');
  await expect(siatka).toContainText('Gwiazda');

  if (process.env.ZRZUTY) await page.screenshot({ path: 'docs/obrazy/n7-biblioteki.png' });

  // W Ustawieniach zostaje tylko konfiguracja.
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  await expect(page.locator('.menu-ustawien-panel')).not.toContainText('Wgrywanie');
});
