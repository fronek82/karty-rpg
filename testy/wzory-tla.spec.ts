import { expect, test, type Locator } from '@playwright/test';
import { doBibliotekiOzdobnikow, karta, kreator, sekcja, zBiblioteki, zaznacz } from './szablonUI';
import { zapisano } from './pomoc';

/** Przycisk wbudowanego wzoru w grupie „Wzór” sekcji „Tło karty”. */
const wbudowany = (tlo: Locator, nazwa: string) =>
  tlo.getByTestId('wzory-wbudowane').getByRole('button', { name: nazwa, exact: true });

test('wzór tła karty: wybór, parametry, podgląd na żywo i zapis', async ({ page }) => {
  await kreator(page, {
    nazwa: 'Karta w kratkę',
    format: 'Standard / Poker',
    uklad: 'Tytuł i opis',
    rogi: 3,
  });
  await karta(page);
  const tlo = await sekcja(page, 'Tło karty');
  const rodzajTla = tlo.getByRole('group', { name: 'Rodzaj tła' });
  await rodzajTla.getByRole('button', { name: 'Wzór' }).click();
  const podglad = page.locator('.karta-podgladu svg');
  // Domyślnie kratka – linie wektorowe w kolorze wzoru.
  await expect(podglad.locator('path[stroke="#9fb3c8"]')).toHaveCount(1);

  await tlo.getByLabel('Kolor linii').fill('#aa3300');
  await expect(podglad.locator('path[stroke="#aa3300"]')).toHaveCount(1);
  await wbudowany(tlo, 'Kropki').click();
  await expect(podglad.locator('path[fill="#aa3300"]')).toHaveCount(1);
  await wbudowany(tlo, 'Romby').click();
  await tlo.getByLabel('Odstęp (mm)').fill('4');
  await tlo.getByLabel('Przezroczystość (%)').fill('40');
  await expect(podglad.locator('g[opacity="0.6"] path[stroke="#aa3300"]')).toHaveCount(1);

  await zapisano(page);
  await page.reload();
  await karta(page);
  const poZapisie = await sekcja(page, 'Tło karty');
  await expect(
    poZapisie.getByRole('group', { name: 'Rodzaj tła' }).getByRole('button', { name: 'Wzór' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(wbudowany(poZapisie, 'Romby')).toHaveAttribute('aria-pressed', 'true');
  await expect(poZapisie.getByLabel('Odstęp (mm)')).toHaveValue('4');

  // „Brak” usuwa kolor tła i wzór.
  await poZapisie
    .getByRole('group', { name: 'Rodzaj tła' })
    .getByRole('button', { name: 'Brak' })
    .click();
  await expect(podglad.locator('path[stroke="#aa3300"]')).toHaveCount(0);
});

/** Prosty SVG jako plik do wgrania (bez viewBox – wymiary z obwiedni rysunku). */
const plikSvg = (nazwa: string, tresc: string) => ({
  name: nazwa,
  mimeType: 'image/svg+xml',
  buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg">${tresc}</svg>`),
});

test('wzór z biblioteki SVG: dodanie plikiem, układy, kolor tylko dla jednokolorowych, usunięcie z biblioteki', async ({
  page,
}) => {
  await kreator(page, {
    nazwa: 'Karta w gwiazdki',
    format: 'Standard / Poker',
    uklad: 'Pusta karta',
  });
  await karta(page);
  const tlo = await sekcja(page, 'Tło karty');
  await tlo
    .getByRole('group', { name: 'Rodzaj tła' })
    .getByRole('button', { name: 'Wzór' })
    .click();
  const podglad = page.locator('.karta-podgladu svg');
  await expect(tlo.getByTestId('wzory-biblioteki')).toContainText('Z biblioteki');

  // „+” – plik trafia do biblioteki zwykłym importem i od razu jest wzorem (SVG <pattern>).
  await tlo
    .getByTestId('plik-wzoru-svg')
    .setInputFiles(plikSvg('Kropla.svg', '<path d="M5 0L10 10H0Z" fill="#224466"/>'));
  await expect(tlo.getByRole('button', { name: 'Kropla', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(podglad.locator('pattern[patternUnits="userSpaceOnUse"]')).toHaveCount(1);
  await expect(podglad.locator('pattern use[color="#9fb3c8"]').first()).toBeAttached();
  // Jednokolorowy: kolor wzoru działa (podmiana wypełnienia).
  await tlo.getByLabel('Kolor wzoru').fill('#aa0000');
  await expect(podglad.locator('pattern use[color="#aa0000"]').first()).toBeAttached();

  await tlo.getByLabel('Rozmiar kafelka (mm)').fill('6');
  await tlo.getByLabel('Odstęp X (mm)').fill('2');
  await tlo.getByRole('group', { name: 'Układ' }).getByRole('button', { name: 'Cegiełka' }).click();
  await expect(podglad.locator('pattern')).toHaveAttribute('height', '12');
  await tlo.getByRole('group', { name: 'Układ' }).getByRole('button', { name: 'Pion' }).click();
  await expect(podglad.locator('pattern')).toHaveAttribute('width', '16');
  await tlo.getByLabel('Obrót (°)').fill('45');
  await expect(podglad.locator('pattern')).toHaveAttribute('patternTransform', /matrix\(0\.707/);

  // Wielokolorowy: kolor wzoru wyszarzony z podpowiedzią.
  await tlo
    .getByTestId('plik-wzoru-svg')
    .setInputFiles(
      plikSvg(
        'Dwukolor.svg',
        '<rect width="10" height="10" fill="#ff0000"/><circle cx="5" cy="5" r="3" fill="#0000ff"/>',
      ),
    );
  await expect(tlo.getByRole('button', { name: 'Dwukolor', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(tlo.getByLabel('Kolor wzoru')).toBeDisabled();
  await expect(tlo).toContainText('Dostępne tylko dla jednokolorowych SVG');
  await zapisano(page);

  // Usunięcie używanej grafiki: ostrzeżenie z liczbą kart, po usunięciu – samo tło i ostrzeżenie.
  await doBibliotekiOzdobnikow(page);
  await page.getByRole('button', { name: 'Usuń „Dwukolor” z biblioteki' }).click();
  await expect(page.getByTestId('ostrzezenie-tla')).toContainText('wzorem tła 1 karty');
  await page.getByRole('button', { name: 'Usuń mimo to' }).click();
  await zBiblioteki(page);
  await karta(page);
  const poUsunieciu = await sekcja(page, 'Tło karty');
  await expect(poUsunieciu.getByTestId('brak-grafiki-wzoru')).toBeVisible();
  await expect(page.locator('.karta-podgladu svg pattern')).toHaveCount(0);
});

test('pusta karta: zachęta na podglądzie i w drzewie tylko w edytorze, znika po dodaniu', async ({
  page,
}) => {
  await kreator(page, { nazwa: 'Pusta', format: 'Standard / Poker', uklad: 'Pusta karta' });
  const zacheta = page.getByTestId('pusty-stan-karty');
  await expect(zacheta).toContainText('Pusta karta – kliknij ＋ Dodaj');
  await expect(page.getByTestId('pusty-stan-drzewa')).toContainText('Brak elementów');
  // Zachęta to warstwa HTML – w SVG karty (podgląd, PDF, miniatury) jej nie ma.
  await expect(page.locator('.karta-podgladu svg')).not.toContainText('Pusta karta');
  await page.getByTestId('dodaj-pusta-karta').click();
  await page.getByRole('menuitem', { name: 'Tekst', exact: true }).click();
  await expect(zacheta).toHaveCount(0);
  await expect(page.getByTestId('pusty-stan-drzewa')).toHaveCount(0);
  await karta(page);
  await expect(page.getByText('Karta jest pusta')).toHaveCount(0);
  await zaznacz(page, 'Tekst');
  await page.getByRole('button', { name: 'Usuń', exact: true }).click();
  await expect(zacheta).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Dodaj element' })
    .getByRole('button', { name: 'Obraz', exact: true })
    .click();
  await expect(zacheta).toHaveCount(0);
});
