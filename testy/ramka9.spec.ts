import { expect, test } from '@playwright/test';
import { karta, kreator, panel, sekcja } from './szablonUI';

/** M2b-7: ramka 9-slice – import PNG do biblioteki, edytor wcięć, użycie jako ramka karty. */

test.use({ viewport: { width: 1440, height: 1250 } });

test('ramka 9-slice z PNG: edytor wcięć, podglądy, dpi i użycie w panelu Ramka', async ({
  page,
}) => {
  await kreator(page, {
    nazwa: 'Ramka PNG',
    format: 'Standard / Poker',
    rogi: 0,
    kolor: '#f3e6c8',
    uklad: 'Tytuł i opis',
  });
  await karta(page);
  const rodzaj = (await sekcja(page, 'Ramka karty')).getByRole('group', {
    name: 'Ramka karty',
    exact: true,
  });
  await expect(rodzaj.getByRole('button', { name: /z obrazu/ })).toBeDisabled();

  await page.getByRole('link', { name: 'Biblioteka ozdobników', exact: true }).click();
  await page.getByTestId('plik-png').setInputFiles('testy/zasoby/ramka-testowa.png');
  const lista = page.getByTestId('lista-wlasnych');
  await expect(lista.getByRole('button', { name: /ramka-testowa/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const edytor = page.getByTestId('edytor-ramki9');
  await expect(edytor).toContainText('120×120 px');

  // Wcięcia: pola liczb i przeciąganie linii.
  const lewo = edytor.getByLabel('Lewo', { exact: true });
  await expect(lewo).toHaveValue('40');
  await lewo.fill('30');
  for (const s of ['Prawo', 'Dół', 'Góra']) await edytor.getByLabel(s, { exact: true }).fill('30');
  const zrodlo = edytor.locator('.zrodlo-ramki9');
  const r = (await zrodlo.boundingBox())!;
  const linia = edytor.getByTestId('linia-lewo');
  const l = (await linia.boundingBox())!;
  await page.mouse.move(l.x + l.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width * 0.2, r.y + r.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(lewo).toHaveValue('24');
  await linia.focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(lewo).toHaveValue('30');
  // „Takie same na wszystkich bokach” ustawia cztery wcięcia naraz.
  await edytor.getByLabel('Takie same na wszystkich bokach').check();
  await edytor.getByLabel('Góra', { exact: true }).fill('30');
  for (const s of ['Prawo', 'Dół', 'Lewo'])
    await expect(edytor.getByLabel(s, { exact: true })).toHaveValue('30');
  await edytor.getByLabel('Takie same na wszystkich bokach').uncheck();

  // Grubość i dpi: 30 px na 2,5 mm to 305 dpi (bez ostrzeżenia), na 5 mm – 152 dpi.
  const dpi = edytor.getByTestId('dpi-ramki');
  await expect(dpi).toContainText('305 dpi');
  await expect(dpi).not.toContainText('poniżej 300 dpi (');
  await edytor.getByLabel('Grubość ramki na karcie (mm)').fill('5');
  await expect(dpi).toContainText('152 dpi');
  await expect(dpi).toContainText('Rogi mają tylko 152 dpi');
  await edytor.getByLabel('Grubość ramki na karcie (mm)').fill('2.5');

  // Boki i środek zmieniają podglądy (liczba obrazów w SVG).
  const podglad = page.getByTestId('podglad-ramki9-0').locator('svg');
  await expect(podglad.locator('image')).not.toHaveCount(0);
  const powtarzane = await podglad.locator('image').count();
  await edytor.getByRole('button', { name: 'rozciągnij' }).click();
  await expect(podglad.locator('image')).toHaveCount(9);
  expect(powtarzane).toBeGreaterThan(9);
  await edytor.getByRole('button', { name: 'pomiń' }).click();
  await expect(podglad.locator('image')).toHaveCount(8);
  await edytor.getByRole('button', { name: 'powtarzaj równo' }).click();
  await edytor.getByRole('button', { name: 'wypełnij' }).click();
  await expect(podglad.locator('image')).toHaveCount(powtarzane);
  await expect(page.getByTestId('podglad-ramki9-2')).toBeVisible();
  if (process.env.ZRZUTY) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: 'docs/obrazy/m2b-7-ramka-9slice.png' });
  }

  // Użycie: rodzaj „z obrazu” w panelu Ramka karty.
  await page.goBack();
  await expect(page.getByRole('tree', { name: 'Struktura karty' })).toBeVisible({ timeout: 15000 });
  await karta(page);
  const r2 = await sekcja(page, 'Ramka karty');
  const rodzaj2 = r2.getByRole('group', { name: 'Ramka karty', exact: true });
  await expect(rodzaj2.getByRole('button', { name: /z obrazu/ })).toBeEnabled();
  await rodzaj2.getByRole('button', { name: /z obrazu/ }).click();
  const podgladKarty = page.locator('.karta-podgladu svg');
  await expect(podgladKarty.locator('image')).not.toHaveCount(0);
  await r2.getByLabel('Grubość ramki (mm)').fill('2.5');
  await expect(panel(page).getByRole('alert')).toHaveCount(0);
  await r2.getByLabel('Grubość ramki (mm)').fill('5');
  await expect(page.getByText(/152 dpi/).first()).toBeVisible();
  // Powrót do „brak” czyści ozdobę.
  await rodzaj2.getByRole('button', { name: 'brak', exact: true }).click();
  await expect(podgladKarty.locator('image')).toHaveCount(0);
});
