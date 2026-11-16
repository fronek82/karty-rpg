import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/** Podgląd karty i ustawienia obrazu (E7c). */

async function taliaBroni(page: Page) {
  await page.goto('./#/projekty');
  await page.getByRole('button', { name: /Nowy projekt z pakietu/ }).click();
  await page.getByRole('link', { name: 'Karty broni i pancerzy' }).click();
}

const obraz = (page: Page) => page.locator('.podglad-karty image');

test('podgląd karty, skala polem i myszą, przesunięcie przeciąganiem, reset', async ({ page }) => {
  await taliaBroni(page);
  // Domyślnie zaznaczona pierwsza karta – podgląd z ilustracją.
  await expect(page.getByRole('img', { name: 'Podgląd karty' })).toBeVisible();
  await expect(obraz(page)).toHaveCount(1);
  const reset = page.getByRole('button', { name: 'Resetuj' });
  await expect(reset).toBeDisabled();

  // Wybór innej karty klikiem w wiersz.
  await page.getByLabel('Nazwa, karta 2', { exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Wybrana karta' })).toContainText('Igła');

  const przed = await obraz(page).boundingBox();
  await page.getByLabel('Skala').fill('2');
  await expect(reset).toBeEnabled();
  const po = await obraz(page).boundingBox();
  expect(po!.width).toBeGreaterThan(przed!.width * 1.5);

  // Przeciąganie przesuwa obraz (pola X/Y w mm rosną).
  const podglad = page.locator('.podglad-karty svg');
  const r = (await podglad.boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.down();
  await page.mouse.move(r.x + r.width / 2 + 30, r.y + r.height / 2 + 15, { steps: 5 });
  await page.mouse.up();
  expect(Number(await page.getByLabel('X (mm)').inputValue())).toBeGreaterThan(3);
  expect(Number(await page.getByLabel('Y (mm)').inputValue())).toBeGreaterThan(1);

  // Kółko myszy zmniejsza skalę.
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  await page.mouse.wheel(0, 100);
  // Krok kółka: exp(−deltaY · 0,00095).
  await expect(page.getByLabel('Skala')).toHaveValue(
    String(Math.round(2 * Math.exp(-100 * 0.00095) * 1000) / 1000),
  );

  await page.getByLabel('Obrót (°)').fill('15');
  await expect(page.getByRole('status')).toHaveText('Zapisano');
  await page.reload();
  await page.getByLabel('Nazwa, karta 2', { exact: true }).click();
  await expect(page.getByLabel('Obrót (°)')).toHaveValue('15');

  await page.getByRole('button', { name: 'Resetuj' }).click();
  await expect(page.getByLabel('Skala')).toHaveValue('1');
  await expect(page.getByLabel('Obrót (°)')).toHaveValue('0');
});

test('wgranie obrazu do biblioteki i przypisanie do karty', async ({ page }) => {
  await taliaBroni(page);
  await page.getByTestId('plik-obrazu').setInputFiles({
    name: 'Mój miecz.png',
    mimeType: 'image/png',
    buffer: readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png'),
  });
  await expect(page.getByLabel('Plik:')).toHaveValue('obraz-Moj-miecz');
  await expect(page.getByLabel('Obraz, karta 1', { exact: true })).toHaveValue('obraz-Moj-miecz');
  await expect(obraz(page)).toHaveAttribute('href', /^blob:/);

  // Zły plik – komunikat po polsku.
  await page.getByTestId('plik-obrazu').setInputFiles({
    name: 'a.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('GIF89a'),
  });
  await expect(page.getByRole('alert')).toHaveText(/nie jest obrazem PNG ani JPG/);

  await page.reload();
  await expect(page.getByLabel('Obraz, karta 1', { exact: true })).toHaveValue('obraz-Moj-miecz');
});

/** JPEG 40×20 (z kanwy w przeglądarce) z dopisanym EXIF: orientacja 6 (obrót o 90°). */
async function jpegZObrotem(page: Page): Promise<Buffer> {
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

test('zdjęcie z obrotem EXIF jest zapisywane już obrócone (podgląd = PDF)', async ({ page }) => {
  await taliaBroni(page);
  await page.getByTestId('plik-obrazu').setInputFiles({
    name: 'zdjecie.jpg',
    mimeType: 'image/jpeg',
    buffer: await jpegZObrotem(page),
  });
  await expect(page.getByLabel('Plik:')).toHaveValue('obraz-zdjecie');
  const href = await obraz(page).getAttribute('href');
  const wynik = await page.evaluate(async (adres) => {
    const dane = new Uint8Array(await (await fetch(adres!)).arrayBuffer());
    // Bez orientacji z pliku: zapisane piksele muszą już być obrócone.
    const b = await createImageBitmap(new Blob([dane]), { imageOrientation: 'none' });
    const c = new OffscreenCanvas(b.width, b.height).getContext('2d')!;
    c.drawImage(b, 0, 0);
    const kolor = (x: number, y: number) => {
      const [r, , bl] = c.getImageData(x, y, 1, 1).data;
      return r! > 150 && bl! < 100 ? 'czerwony' : bl! > 150 && r! < 100 ? 'niebieski' : 'inny';
    };
    const tekst = new TextDecoder('latin1').decode(dane.subarray(0, 200));
    return {
      szer: b.width,
      wys: b.height,
      exif: tekst.includes('Exif'),
      gora: kolor(10, 8),
      dol: kolor(10, 32),
    };
  }, href);
  // Orientacja 6 (obrót o 90° zgodnie z zegarem): lewa, czerwona połowa trafia na górę.
  expect(wynik).toEqual({ szer: 20, wys: 40, exif: false, gora: 'czerwony', dol: 'niebieski' });
});
