import { expect, test, type Page } from '@playwright/test';
import { gotowyUklad, karta, srodek } from './pomoc';
import { PODKLAD, obszar, polozenie, przesun, pxNaMm, swobodny, uchwyt } from './swobodnyUI';
import { doBibliotekiOzdobnikow, dodaj, kreator, panel, sekcja, zaznacz } from './szablonUI';

/**
 * UI-7: zrzuty edytorów w nowej palecie do docs/obrazy (tylko przy ZRZUTY=1). Edytory są
 * wypełnione kartami i polami, żeby było co oceniać. Kolory kart i arkuszy nie zależą od motywu.
 */

test.skip(!process.env.ZRZUTY, 'tylko przy ZRZUTY=1');
test.use({ viewport: { width: 1440, height: 900 } });

const MOTYWY = { jasny: 'light', ciemny: 'dark' } as const;

for (const [nazwa, schemat] of Object.entries(MOTYWY)) {
  test(`edytor kartki, ${nazwa}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: schemat });
    await gotowyUklad(page, 'Broń i pancerze');
    await karta(page, 'Miecz').first().click();
    await expect(page.getByRole('complementary', { name: 'Zaznaczone karty' })).toBeVisible();
    await page.screenshot({ path: `docs/obrazy/ui-7-edytor-kartki-${nazwa}.png` });
  });

  test(`edytor szablonu, ${nazwa}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: schemat });
    await kreator(page, {
      nazwa: 'Zrzut',
      format: 'Standard / Poker',
      rogi: 3,
      kolor: '#f4ecd8',
      uklad: 'Tytuł, siatka 2×2, opis i stopka',
    });
    await dodaj(page, 'Etykieta + wartość', 'Siła');
    await dodaj(page, 'Wartość w kształcie', 'Koszt');
    await zaznacz(page, 'Opis');
    await sekcja(page, 'Etykieta');
    await page.screenshot({ path: `docs/obrazy/ui-7-edytor-szablonu-${nazwa}.png` });
  });
}

test('tryb swobodny z prowadnicami, ciemny', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await swobodny(page, 'Zrzut');
  await page.getByTestId('plik-podkladu').setInputFiles(PODKLAD);
  await dodaj(page, 'Obraz', 'Ilustracja');
  await przesun(page, 'Ilustracja', -3, -3);
  await uchwyt(page, 'se', 33, 16);
  await dodaj(page, 'Wartość w kształcie', 'Koszt');
  await panel(page).getByLabel('Kształt').selectOption('kolo');
  await uchwyt(page, 'se', -18, 2);
  await dodaj(page, 'Wartość w kształcie', 'Atak');
  await panel(page).getByLabel('Kształt').selectOption('tarcza');
  const polAtak = await polozenie(page);
  await polAtak.getByLabel('X (mm)').fill('3');
  await polAtak.getByLabel('Y (mm)').fill('75');
  await zaznacz(page, 'Koszt');
  const k = await pxNaMm(page);
  const s = await srodek(page, obszar(page, 'Koszt'));
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move(s.x + 0.2 * k, s.y + 62 * k, { steps: 10 });
  await page.screenshot({ path: 'docs/obrazy/ui-7-swobodny-ciemny.png' });
  await page.mouse.up();
});

test('biblioteka ozdobników, ciemny', async ({ page }: { page: Page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await kreator(page, {
    nazwa: 'Zrzut',
    format: 'Standard / Poker',
    rogi: 3,
    uklad: 'Pusta karta',
  });
  await dodaj(page, 'Wartość w kształcie', 'Siła');
  await doBibliotekiOzdobnikow(page);
  await page.getByTestId('plik-svg').setInputFiles('testy/zasoby/gwiazdka.svg');
  await expect(page.getByTestId('podglad-elementu')).toBeVisible();
  await page
    .getByRole('group', { name: 'Użyj jako' })
    .getByRole('button', { name: 'narożnik' })
    .click();
  await page.getByLabel('Nazwa', { exact: true }).fill('Gwiazdka');
  await page.getByRole('button', { name: 'Dodaj do biblioteki' }).click();
  await page.getByTestId('plik-svg').setInputFiles('testy/zasoby/zlosliwy.svg');
  await expect(page.getByTestId('raport-pominieto')).toBeVisible();
  await page.screenshot({ path: 'docs/obrazy/ui-7-biblioteka-ciemny.png' });
});
