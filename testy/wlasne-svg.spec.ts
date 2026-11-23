import { expect, test } from '@playwright/test';
import {
  doBibliotekiOzdobnikow,
  dodaj,
  kreator,
  karta,
  panel,
  sekcja,
  wyglad,
  zaznacz,
} from './szablonUI';

/** M2b-6, N8: biblioteka ozdobników użytkownika – import własnego SVG i użycie w szablonie. */

test.use({ viewport: { width: 1440, height: 1000 } });

test('import SVG: raport „co pominięto”, użycie jako kształt wartości i narożnik, usuwanie', async ({
  page,
}) => {
  await kreator(page, {
    nazwa: 'Własne SVG',
    format: 'Standard / Poker',
    rogi: 3,
    uklad: 'Pusta karta',
  });
  await dodaj(page, 'Wartość w kształcie', 'Siła');
  await doBibliotekiOzdobnikow(page);

  // 1. Plik testowy: gwiazdka z otworem (evenodd) jako kształt wartości.
  await page.getByTestId('plik-svg').setInputFiles('testy/zasoby/gwiazdka.svg');
  await expect(page.getByTestId('raport-import')).toContainText('Ścieżek: 1, kolorów: 1');
  await expect(page.getByText('Nic nie pominięto.')).toBeVisible();
  await expect(page.getByTestId('podglad-elementu')).toBeVisible();
  const uzyj = page.getByRole('group', { name: 'Użyj jako' });
  await uzyj.getByRole('button', { name: 'kształt wartości' }).click();
  await page.getByLabel('Nazwa', { exact: true }).fill('Gwiazdka');
  await page.getByRole('button', { name: 'Dodaj do biblioteki' }).click();
  const lista = page.getByTestId('siatka-biblioteki');
  await expect(lista.getByRole('button', { name: 'Gwiazdka', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByTestId('uzycie-elementu')).toContainText('Nie jest używany');
  // Kształt ma prostokąt na tekst do ustawienia i podgląd w użyciu (pole wartości).
  await expect(page.getByRole('group', { name: /Prostokąt na tekst/ })).toBeVisible();
  await expect(page.getByTestId('podglad-elementu').locator('path[fill="#fff8e6"]')).toBeVisible();

  // 2. Plik z elementami niebezpiecznymi: usunięte i zgłoszone, rysunek zostaje.
  await page.getByTestId('plik-svg').setInputFiles('testy/zasoby/zlosliwy.svg');
  const pominieto = page.getByTestId('raport-pominieto');
  for (const tekst of [
    'skrypty',
    'atrybuty zdarzeń',
    'odwołania do zewnętrznych plików',
    'treść <foreignObject>',
    'obrazy <image>',
    'filtr',
  ])
    await expect(pominieto).toContainText(tekst);
  await expect(page.getByTestId('raport-import')).toContainText('Ścieżek: 2');
  // Podgląd jest generowany z konturów: żadnego skryptu ani zdarzeń w drzewie strony.
  await expect(page.locator('script:not([src])').filter({ hasText: 'cookie' })).toHaveCount(0);
  expect(await page.locator('[onload], [onclick]').count()).toBe(0);
  await expect(page.getByTestId('podglad-elementu').locator('use')).toHaveCount(4);
  await page.getByLabel('Nazwa', { exact: true }).fill('Pióro');
  if (process.env.ZRZUTY) {
    await page.setViewportSize({ width: 1440, height: 1500 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'docs/obrazy/m2b-6-biblioteka-ozdobnikow.png' });
  }
  await page.getByRole('button', { name: 'Dodaj do biblioteki' }).click(); // domyślnie: narożnik
  await expect(lista.getByRole('listitem')).toHaveCount(2);
  await expect(lista.getByRole('button', { name: 'Pióro', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(
    page.getByRole('group', { name: 'Użyj jako' }).getByRole('button', { name: 'narożnik' }),
  ).toHaveAttribute('aria-pressed', 'true');

  // 3. Użycie w szablonie: własny kształt wartości i własny narożnik ramki karty.
  await page.getByTestId('biblioteka-gotowe').click();
  await expect(page.getByRole('tree', { name: 'Struktura karty' })).toBeVisible({ timeout: 15000 });
  await zaznacz(page, 'Siła');
  await panel(page).getByLabel('Kształt').selectOption('wlasny');
  const wybor = panel(page).getByTestId('wybor-ksztaltu');
  await expect(wybor.getByRole('button')).toHaveCount(1); // tylko elementy rodzaju „kształt”
  await expect(wybor.getByRole('button', { name: 'Gwiazdka' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await wyglad(page, { tlo: '#ffe9a8', ramka: { grubosc: 0.4, kolor: '#7a2e24' } });
  const podglad = page.locator('.karta-podgladu svg');
  // Tło pola to ścieżka (kształt z pliku), nie prostokąt.
  await expect(podglad.locator('path[fill="#ffe9a8"]')).toHaveCount(1);
  await expect(podglad.locator('path[fill="#ffe9a8"]')).toHaveAttribute('d', /C/);

  await karta(page);
  const r = await sekcja(page, 'Ramka karty');
  await r.getByLabel('Ramka karty', { exact: true }).selectOption('linia');
  const naroz = r.getByRole('group', { name: 'Narożniki' });
  await expect(naroz.getByRole('button')).toHaveCount(8); // brak + 6 wbudowanych + własny
  await expect(naroz.getByTestId('grupa-systemowe')).toHaveText('Systemowe');
  await expect(naroz.getByTestId('grupa-moja')).toHaveText('Moja biblioteka');
  await naroz.getByRole('button', { name: 'Pióro' }).click();
  await expect(podglad.locator('use[color]')).toHaveCount(4);
  await expect(podglad.locator('defs g[id]')).toHaveCount(1);

  // 4. Usuwanie używanego elementu wymaga potwierdzenia (nazwy projektów); ozdoba znika.
  await doBibliotekiOzdobnikow(page);
  await lista.getByRole('button', { name: 'Pióro', exact: true }).click();
  await expect(page.getByTestId('uzycie-elementu')).toContainText('Własne SVG');
  await page.getByRole('button', { name: 'Usuń „Pióro” z biblioteki' }).click();
  await expect(page.getByTestId('ostrzezenie-usuwania')).toContainText('Własne SVG');
  await page.getByRole('button', { name: 'Usuń mimo to' }).click();
  await expect(lista.getByRole('listitem')).toHaveCount(1);
  await page.getByTestId('biblioteka-gotowe').click();
  await expect(page.getByRole('tree', { name: 'Struktura karty' })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('.karta-podgladu svg use[color]')).toHaveCount(0);
});

test('uszkodzone i nieobsługiwane pliki są odrzucane z komunikatem', async ({ page }) => {
  await kreator(page, { nazwa: 'Błędy', format: 'Standard / Poker', uklad: 'Pusta karta' });
  await doBibliotekiOzdobnikow(page);
  const wejscie = page.getByTestId('plik-svg');
  await wejscie.setInputFiles({
    name: 'zly.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg><g></svg>'),
  });
  await expect(page.getByTestId('blad-importu')).toContainText('zly.svg');
  await wejscie.setInputFiles({
    name: 'tekst.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg viewBox="0 0 10 10"><text x="1" y="5">Napis</text></svg>'),
  });
  await expect(page.getByTestId('blad-importu')).toContainText('nie ma kształtów');
  await wejscie.setInputFiles({
    name: 'duzy.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(`<svg viewBox="0 0 10 10"><!--${'x'.repeat(600 * 1024)}--></svg>`),
  });
  await expect(page.getByTestId('blad-importu')).toContainText('512 KB');
  await expect(page.getByText('Nie ma jeszcze zapisanych ozdobników.')).toBeVisible();
});
