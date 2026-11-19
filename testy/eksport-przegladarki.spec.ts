import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { WERSJA_SCHEMATU } from '../src/model/projekt';
import type { Szablon } from '../src/model/szablon';
import { dodajKarte, zapisano } from './pomoc';

const NAZWA = 'Karta geometryczna';
const NAZWA_PLIKU = 'karta-geometryczna';
const SZABLON: Szablon = {
  id: 'karta-geometryczna',
  nazwa: NAZWA,
  rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
  korzen: {
    id: 'korzen',
    typ: 'kolumna',
    padding: 3,
    dzieci: [
      {
        id: 'obraz',
        typ: 'obraz',
        klucz: 'ilustracja',
        wysokosc: { mm: 33 },
        dopasowanie: 'dopasuj',
      },
    ],
  },
};

type Format = 'png' | 'jpg';

async function sprawdzObraz(page: Page, format: Format, bajty: Uint8Array, rozmiar: number[]) {
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';
  const sygnatura = format === 'png' ? [137, 80, 78, 71, 13, 10, 26, 10] : [255, 216, 255];
  expect([...bajty.subarray(0, sygnatura.length)]).toEqual(sygnatura);
  const wynik = await page.evaluate(
    async (src) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = document.createElement('canvas');
      // Wystarczy próbka 1:4, a rozmiary sprawdzamy na zdekodowanym oryginale.
      canvas.width = Math.ceil(img.naturalWidth / 4);
      canvas.height = Math.ceil(img.naturalHeight / 4);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let czerwone = 0;
      for (let i = 0; i < data.length; i += 4)
        if (data[i]! >= 210 && data[i + 1]! <= 45 && data[i + 2]! <= 45 && data[i + 3] === 255)
          czerwone++;
      return { rozmiar: [img.naturalWidth, img.naturalHeight], czerwone };
    },
    `data:${mime};base64,${Buffer.from(bajty).toString('base64')}`,
  );
  expect(wynik.rozmiar).toEqual(rozmiar);
  // Czerwień pochodzi wyłącznie z osadzonego obrazu. Próg dopuszcza kompresję JPG.
  expect(wynik.czerwone).toBeGreaterThan(100);
}

async function pobierz(page: Page, rodzaj: 'strony' | 'karty', format: Format) {
  await page.getByRole('button', { name: 'Pobierz', exact: true }).click();
  const opcja =
    rodzaj === 'strony'
      ? `Obrazy stron – ${format.toUpperCase()}, 300 dpi`
      : `Karty osobno – ZIP z ${format.toUpperCase()}, 300 dpi`;
  const [plik] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: opcja, exact: true }).click(),
  ]);
  await expect(
    page.getByText('Obrazy gotowe – sprawdź pobrane pliki.', { exact: true }),
  ).toBeVisible();
  return { nazwa: plik.suggestedFilename(), bajty: await readFile(await plik.path()) };
}

const stronaA4 = [2480, 3508];
const karta = [744, 1039];

for (const format of ['png', 'jpg'] as const) {
  test(`eksport ${format.toUpperCase()} pobiera osobne pliki i ZIP stron oraz kart z ilustracją`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto('./#/wlasne');
    const json = { wersja: WERSJA_SCHEMATU, szablon: SZABLON, role: {}, zasoby: [] };
    await page.getByTestId('plik-szablonu-start').setInputFiles({
      name: 'geometria.kartyrpg-szablon',
      mimeType: 'application/zip',
      buffer: Buffer.from(zipSync({ 'szablon.json': strToU8(JSON.stringify(json)) })),
    });
    await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Ustawienia/ }).click();
    await page.getByRole('button', { name: 'pionowo', exact: true }).click();

    const piksele = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#f60606';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return canvas.toDataURL().split(',')[1]!;
    });
    const dodajZObrazem = async (strona: number) => {
      await dodajKarte(page, strona, 1, 1, NAZWA);
      await page.getByTestId('plik-obrazu').setInputFiles({
        name: 'czerwony-kwadrat.png',
        mimeType: 'image/png',
        buffer: Buffer.from(piksele, 'base64'),
      });
      await expect(page.locator('.strona-kartki .svg-strony image')).toHaveCount(strona);
      await zapisano(page);
    };
    await dodajZObrazem(1);
    await page.reload();
    await expect(page.locator('.strona-kartki .svg-strony image')).toHaveCount(1);

    if (process.env.ZRZUTY && format === 'png') {
      await page.getByRole('button', { name: 'Pobierz', exact: true }).click();
      await page.screenshot({ path: `docs/obrazy/m2c-3-eksport-${test.info().project.name}.png` });
      await page.keyboard.press('Escape');
    }

    const jednaStrona = await pobierz(page, 'strony', format);
    expect(jednaStrona.nazwa).toBe(`${NAZWA_PLIKU}.${format}`);
    await sprawdzObraz(page, format, jednaStrona.bajty, stronaA4);
    const jednaKarta = await pobierz(page, 'karty', format);
    expect(jednaKarta.nazwa).toBe(`1-${NAZWA_PLIKU}.${format}`);
    await sprawdzObraz(page, format, jednaKarta.bajty, karta);

    await page.getByRole('button', { name: /Dodaj stronę/ }).click();
    await dodajZObrazem(2);
    for (const [rodzaj, docelowyRozmiar] of [
      ['strony', stronaA4],
      ['karty', karta],
    ] as const) {
      const zip = await pobierz(page, rodzaj, format);
      expect(zip.nazwa).toBe(`${NAZWA_PLIKU}-${rodzaj}.zip`);
      const pliki = Object.entries(unzipSync(zip.bajty));
      expect(pliki.map(([nazwa]) => nazwa).sort()).toEqual(
        [1, 2].map(
          (n) => `${rodzaj === 'strony' ? `${NAZWA_PLIKU}-${n}` : `${n}-${NAZWA_PLIKU}`}.${format}`,
        ),
      );
      for (const [, bajty] of pliki) await sprawdzObraz(page, format, bajty, docelowyRozmiar);
    }
  });
}
