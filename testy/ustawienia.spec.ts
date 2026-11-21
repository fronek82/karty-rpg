import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import {
  dodajKarte,
  gotowyUklad,
  nowaPustaKartka,
  przeciagnij,
  slot,
  srodek,
  zapisano,
} from './pomoc';

/** Ustawienia kartki, nagłówek grupy na pustej kartce, ilustracje kart. */

test.use({ viewport: { width: 1440, height: 1100 } });
const ustawienia = (page: import('@playwright/test').Page) =>
  page.getByRole('complementary', { name: 'Ustawienia' });

test('tytuł, położenie tytułu, czarno-biały, czcionki; zmiana papieru odrzucona, gdy karty się nie mieszczą', async ({
  page,
}) => {
  await gotowyUklad(page, 'Broń i pancerze');
  const otworz = page.getByRole('button', { name: /Ustawienia/ });
  await otworz.press('Enter');
  await expect(ustawienia(page).getByRole('heading', { name: 'Ustawienia' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(otworz).toBeFocused();
  await otworz.press('Enter');
  await ustawienia(page).getByRole('button', { name: 'Zamknij ustawienia' }).press('Enter');
  await expect(otworz).toBeFocused();
  await otworz.press('Enter');
  await ustawienia(page).getByLabel('Tytuł kartki').fill('Moja broń');
  await zapisano(page);
  await ustawienia(page).getByLabel('Położenie tytułu').selectOption('brak');
  await expect(ustawienia(page).getByLabel('Tytuł kartki')).toBeDisabled();
  await ustawienia(page).getByLabel('Położenie tytułu').selectOption('lewo');
  await expect(ustawienia(page).getByLabel('Tytuł kartki')).toHaveValue('Moja broń');

  // Letter jest węższy – pełna siatka 10 kolumn się nie zmieści.
  const papier = ustawienia(page).getByLabel('Papier', { exact: true });
  await papier.selectOption('Letter');
  await expect(ustawienia(page).getByRole('alert')).toContainText('nie zmieściłyby się');
  await expect(papier).toHaveValue('A4');

  // Czarno-biały: ilustracje w skali szarości.
  const obraz = page.locator('.strona-kartki image').first();
  const kolorowy = await obraz.getAttribute('href');
  await ustawienia(page).getByRole('button', { name: 'czarno-biały' }).click();
  await expect(obraz).not.toHaveAttribute('href', kolorowy!);

  // Własna czcionka i rola.
  await page.getByTestId('plik-czcionki').setInputFiles({
    name: 'Moja.ttf',
    mimeType: 'font/ttf',
    buffer: readFileSync('public/czcionki/EBGaramond-Bold.ttf'),
  });
  await expect(
    ustawienia(page).getByRole('group', { name: 'Czcionki' }).getByRole('status'),
  ).toContainText('Wgrano: EB Garamond');
  await ustawienia(page).getByLabel('Rodzina dla roli „Tytuł”').selectOption('EB Garamond');
  await zapisano(page);
});

test('nagłówek grupy nad zaznaczonymi kolumnami na pustej kartce', async ({ page }) => {
  await nowaPustaKartka(page);
  await dodajKarte(page, 1, 2, 1, 'Stan');
  await dodajKarte(page, 1, 3, 1, 'Stan');
  await przeciagnij(
    page,
    await srodek(page, slot(page, 1, 1, 2)),
    await srodek(page, slot(page, 1, 4, 1)),
  );
  await page.getByRole('button', { name: /Nagłówek grupy nad zaznaczonymi kolumnami/ }).click();
  const panel = page.getByRole('complementary', { name: 'Nagłówek grupy' });
  await expect(panel).toContainText('nad kolumnami 2–3');
  await panel.getByLabel('Nagłówek', { exact: true }).fill('Zmęczona');
  await expect(page.getByRole('button', { name: 'Nagłówek grupy: Zmęczona' })).toBeVisible();
  await page.keyboard.press('Escape');
  const naglowek = page.getByRole('button', { name: 'Nagłówek grupy: Zmęczona' });
  await naglowek.press('Enter');
  await expect(naglowek).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByLabel('Nagłówek', { exact: true })).toHaveValue('Zmęczona');
  await page.keyboard.press('Delete');
  await expect(page.locator('[data-naglowek]')).toHaveCount(0);
  await page.locator('.toast').getByRole('button', { name: 'Cofnij' }).click();
  await expect(page.locator('[data-naglowek]')).toHaveCount(1);
});

/** JPEG 40×20 (z kanwy w przeglądarce) z dopisanym EXIF: orientacja 6 (obrót o 90°). */
async function jpegZObrotem(page: import('@playwright/test').Page): Promise<Buffer> {
  const jpeg = Buffer.from(
    await page.evaluate(async () => {
      const c = new OffscreenCanvas(40, 20);
      const x = c.getContext('2d')!;
      x.fillStyle = '#d00';
      x.fillRect(0, 0, 20, 20);
      x.fillStyle = '#00d';
      x.fillRect(20, 0, 20, 20);
      const b = await c.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
      return [...new Uint8Array(await b.arrayBuffer())];
    }),
  );
  const tiff = Buffer.alloc(26);
  tiff.write('II', 0, 'latin1');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x0112, 10);
  tiff.writeUInt16LE(3, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt16LE(6, 18);
  const app1 = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const naglowek = Buffer.from([0xff, 0xe1, (app1.length + 2) >> 8, (app1.length + 2) & 0xff]);
  return Buffer.concat([jpeg.subarray(0, 2), naglowek, app1, jpeg.subarray(2)]);
}

test('ilustracja: zdjęcie z obrotem EXIF, kółko myszy skaluje, Alt + przeciąganie przesuwa', async ({
  page,
}) => {
  await nowaPustaKartka(page);
  await dodajKarte(page, 1, 2, 2, 'Broń');
  const panel = page.getByRole('complementary', { name: 'Zaznaczone karty' });
  await page.getByTestId('plik-obrazu').setInputFiles({
    name: 'zdjecie.jpg',
    mimeType: 'image/jpeg',
    buffer: await jpegZObrotem(page),
  });
  await expect(panel.getByLabel('Ilustracja z biblioteki')).toHaveValue('obraz-zdjecie');
  const href = await page.locator('.strona-kartki image').first().getAttribute('href');
  const wynik = await page.evaluate(async (adres) => {
    const dane = new Uint8Array(await (await fetch(adres!)).arrayBuffer());
    const b = await createImageBitmap(new Blob([dane]), { imageOrientation: 'none' });
    const c = new OffscreenCanvas(b.width, b.height).getContext('2d')!;
    c.drawImage(b, 0, 0);
    const kolor = (x: number, y: number) => {
      const [r, , bl] = c.getImageData(x, y, 1, 1).data;
      return r! > 150 && bl! < 100 ? 'czerwony' : bl! > 150 && r! < 100 ? 'niebieski' : 'inny';
    };
    return { szer: b.width, wys: b.height, gora: kolor(10, 8), dol: kolor(10, 32) };
  }, href);
  // Orientacja 6: lewa, czerwona połowa na górze – zapisane piksele już obrócone.
  expect(wynik).toEqual({ szer: 20, wys: 40, gora: 'czerwony', dol: 'niebieski' });

  const k = page.locator('[data-karta].zaznaczona');
  await k.hover();
  await page.mouse.wheel(0, -100);
  await expect(panel.getByLabel('Skala')).not.toHaveValue('1');
  const c = await srodek(page, k);
  await page.keyboard.down('Alt');
  await przeciagnij(page, c, { x: c.x + 20, y: c.y });
  await page.keyboard.up('Alt');
  expect(Number(await panel.getByLabel('X (mm)').inputValue())).toBeGreaterThan(1);
});
