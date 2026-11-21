import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { dodaj, kartaNaKartce, kreator, panel, karta, zaznacz } from './szablonUI';
import { otworzDruk, zapisano } from './pomoc';

test('wgrany stały obraz jest wybrany w polu, widoczny w PNG i cofany w jednym kroku', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await kreator(page, {
    nazwa: 'Stała ilustracja',
    format: 'Standard / Poker',
    uklad: 'Pusta karta',
  });
  await dodaj(page, 'Obraz');
  const wgraj = panel(page).getByRole('button', { name: 'Wgraj obraz…', exact: true });
  await expect(wgraj).toHaveCount(0);
  await panel(page).getByLabel('Treść', { exact: true }).selectOption('staly');

  const [wybor] = await Promise.all([page.waitForEvent('filechooser'), wgraj.press('Enter')]);
  await wybor.setFiles({ name: 'zly.png', mimeType: 'image/png', buffer: Buffer.from('tekst') });
  await expect(panel(page).getByRole('alert')).toContainText('nie jest obrazem PNG ani JPG');
  await expect(wgraj).toBeFocused();

  const base64 = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#f70707';
    ctx.fillRect(0, 0, 64, 64);
    return c.toDataURL().split(',')[1]!;
  });
  await page.getByTestId('plik-stalego-obrazu').setInputFiles({
    name: 'proba-stalego.png',
    mimeType: 'image/png',
    buffer: Buffer.from(base64, 'base64'),
  });
  const lista = panel(page).getByLabel('Obraz z biblioteki');
  const svg = page.locator('.karta-podgladu svg image');
  await expect(lista).toHaveValue('obraz-proba-stalego');
  await expect(svg).toHaveCount(1);
  await zapisano(page);

  await page.getByRole('button', { name: 'Cofnij', exact: true }).click();
  await expect(lista).toHaveValue('');
  await expect(lista.locator('option').filter({ hasText: 'proba-stalego.png' })).toHaveCount(0);
  await expect(svg).toHaveCount(0);

  await page.getByRole('button', { name: 'Ponów', exact: true }).click();
  await expect(svg).toHaveCount(1);
  await zapisano(page);
  await kartaNaKartce(page, 'Stała ilustracja', {});
  await expect(page.locator('.strona-kartki svg image')).toHaveCount(1);
  await otworzDruk(page);
  await page.getByRole('button', { name: 'Pobierz', exact: true }).click();
  const [plik] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Obrazy stron – PNG, 300 dpi', exact: true }).click(),
  ]);
  const bajty = await readFile(await plik.path());
  expect([...bajty.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const czerwone = await page.evaluate(
    async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = c.height = 300;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0, 300, 300);
      let liczba = 0;
      const { data } = ctx.getImageData(0, 0, 300, 300);
      for (let i = 0; i < data.length; i += 4)
        if (data[i]! > 200 && data[i + 1]! < 20 && data[i + 2]! < 20) liczba++;
      return liczba;
    },
    `data:image/png;base64,${bajty.toString('base64')}`,
  );
  expect(czerwone).toBeGreaterThan(500);
});

test('zakończenie odczytu po opuszczeniu pola nie dodaje obrazu do biblioteki', async ({
  page,
}) => {
  await kreator(page, {
    nazwa: 'Próba anulowania',
    format: 'Standard / Poker',
    uklad: 'Pusta karta',
  });
  await dodaj(page, 'Obraz', 'Ilustracja');
  await panel(page).getByLabel('Treść', { exact: true }).selectOption('staly');
  await page.evaluate(() => {
    const dekoduj = window.createImageBitmap;
    window.createImageBitmap = ((obraz: ImageBitmapSource, opcje?: ImageBitmapOptions) =>
      new Promise<ImageBitmap>((resolve, reject) => {
        window.addEventListener(
          'odblokuj-obraz-testowy',
          () => {
            void dekoduj(obraz, opcje).then(resolve, reject);
          },
          { once: true },
        );
        document.body.dataset.oczekujeObraz = 'tak';
      })) as typeof window.createImageBitmap;
  });
  await page.getByTestId('plik-stalego-obrazu').setInputFiles('testy/zasoby/litera-f.png');
  await expect(page.locator('body')).toHaveAttribute('data-oczekuje-obraz', 'tak');
  await karta(page);
  await page.evaluate(() => window.dispatchEvent(new Event('odblokuj-obraz-testowy')));
  await zaznacz(page, 'Ilustracja');
  const lista = panel(page).getByLabel('Obraz z biblioteki');
  await expect(lista).toHaveValue('');
  await expect(lista.locator('option').filter({ hasText: 'litera-f.png' })).toHaveCount(0);
});
