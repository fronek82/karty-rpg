import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { eksportujProjekt } from '../src/dane/archiwum';
import { projektZPakietu } from '../src/dane/pakiet';
import { arkuszeMausrittera } from '../src/pakiety/mausritter/arkusze';
import { szablonyMausrittera } from '../src/pakiety/mausritter/szablony';
import { OBRAZ_ZASTEPCZY, talieMausrittera } from '../src/pakiety/mausritter/talie';
import type { Pakiet } from '../src/pakiety/typy';
import { gotowyUklad, karta, kliknijPobierzPdf, otworzDruk, zapisano } from './pomoc';

/** Gotowe układy z pakietu, nagłówki grup, PDF, eksport/import i projekty sprzed edytora. */

test.use({ viewport: { width: 1440, height: 1000 } });

test('stany: nagłówki grup z odstępami, edycja nagłówka', async ({ page }) => {
  await gotowyUklad(page, 'Stany');
  await expect(page.locator('[data-naglowek]')).toHaveCount(6);
  await expect(page.locator('[data-karta]')).toHaveCount(60);
  await page.getByRole('button', { name: 'Nagłówek grupy: Ranna' }).click();
  const panel = page.getByRole('complementary', { name: 'Nagłówek grupy' });
  await expect(panel.getByRole('button', { name: /2,9 mm/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await panel.getByLabel('Nagłówek', { exact: true }).fill('Ranna mysz');
  await expect(page.getByRole('button', { name: 'Nagłówek grupy: Ranna mysz' })).toBeVisible();
  // Szersza grupa nachodziłaby na sąsiednią – odrzucona z komunikatem.
  await panel.getByRole('button', { name: '3 kol.' }).click();
  await expect(panel.getByRole('alert')).toContainText('nachodzi');
});

test('wszystkie trzy: trzy kartki; PDF z nazwą projektu ma trzy strony', async ({ page }) => {
  await gotowyUklad(page, 'Wszystkie trzy');
  for (const t of ['Karty broni i pancerzy', 'Karty niezbędnego wyposażenia', 'Karty stanów'])
    await expect(page.getByRole('heading', { level: 2, name: t })).toBeVisible();
  const [pobranie] = await Promise.all([page.waitForEvent('download'), kliknijPobierzPdf(page)]);
  expect(pobranie.suggestedFilename()).toBe('wszystkie-trzy.pdf');
  const pdf = await PDFDocument.load(readFileSync(await pobranie.path()));
  expect(pdf.getPageCount()).toBe(3);
});

test('eksport → import jako kopia → lista z miniaturą → usunięcie', async ({ page }) => {
  await gotowyUklad(page, 'Broń i pancerze');
  await zapisano(page);
  await otworzDruk(page);
  const [eksport] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Eksportuj/ }).click(),
  ]);
  expect(eksport.suggestedFilename()).toBe('bron-i-pancerze.kartyrpg');
  await page.waitForTimeout(1800); // miniatura zapisywana po chwili
  await page.getByRole('link', { name: 'Karty' }).click();
  // Plik z pobrania ma w katalogu tymczasowym losową nazwę bez rozszerzenia – nadajemy tę z pobrania.
  await page.getByTestId('plik-importu').setInputFiles({
    name: eksport.suggestedFilename(),
    mimeType: 'application/zip',
    buffer: readFileSync(await eksport.path()),
  });
  await expect(page.getByRole('alertdialog')).toContainText('jest już w tej przeglądarce');
  await page.getByRole('button', { name: 'Zapisz jako kopię' }).click();
  await expect(page.locator('.kafelek-projektu')).toHaveCount(2);
  await expect(page.locator('.kafelek-projektu .miniatura img').first()).toBeVisible();
  await expect(page.locator('.kafelek-projektu').first()).toContainText('stron: 1, kart: 51');
  const usun = page.getByRole('button', { name: 'Usuń projekt Broń i pancerze (kopia)' });
  await usun.press('Enter');
  const dialog = page.getByRole('alertdialog');
  await expect(dialog.getByRole('button', { name: 'Anuluj' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(usun).toBeFocused();
  await usun.press('Enter');
  await page.getByRole('alertdialog').getByRole('button', { name: 'Usuń' }).click();
  await expect(page.locator('.kafelek-projektu')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Moje projekty' })).toBeFocused();
});

test('projekt sprzed edytora (ilości, bez przypięć, grupy) otwiera się jako zwykłe karty', async ({
  page,
}) => {
  // Plik w starym formacie: talie z ilościami, rozmieszczenie automatyczne, grupy talii.
  // Pakiet złożony z modułów (indeks importuje PNG przez Vite).
  const pakiet = {
    id: 'mausritter',
    nazwa: 'Mausritter',
    czcionki: [
      {
        rola: 'tytul',
        rodzina: 'Grenze Gotisch',
        warianty: { normalny: 'GrenzeGotisch-Regular.ttf', pogrubiony: 'GrenzeGotisch-Bold.ttf' },
      },
      {
        rola: 'tresc',
        rodzina: 'EB Garamond',
        warianty: {
          normalny: 'EBGaramond-Regular.ttf',
          pogrubiony: 'EBGaramond-Bold.ttf',
          kursywa: 'EBGaramond-Italic.ttf',
        },
      },
    ],
    szablony: szablonyMausrittera,
    talie: talieMausrittera,
    arkusze: arkuszeMausrittera,
    zasoby: [{ id: OBRAZ_ZASTEPCZY, plik: '', szerokosc: 512, wysokosc: 512, format: 'png' }],
  } as unknown as Pakiet;
  const { projekt, zasoby } = await projektZPakietu(
    pakiet,
    async (f) => new Uint8Array(readFileSync(`public/czcionki/${f}`)),
    async () => new Uint8Array(readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png')),
    'stary',
  );
  const stary = {
    ...projekt,
    nazwa: 'Stary projekt',
    arkusze: projekt.arkusze.map((a) => ({ ...a, przypiete: [] })),
  };
  const sztuk = stary.talie.reduce((s, t) => s + t.karty.reduce((a, k) => a + k.ilosc, 0), 0);
  await page.goto('./#/');
  await page.getByTestId('plik-importu').setInputFiles({
    name: 'stary.kartyrpg',
    mimeType: 'application/zip',
    buffer: Buffer.from(eksportujProjekt(stary, zasoby)),
  });
  await page.getByRole('link', { name: 'Stary projekt' }).first().click();
  await expect(page.locator('[data-karta]')).toHaveCount(sztuk, { timeout: 15000 });
  await expect(page.locator('[data-naglowek]')).toHaveCount(6);
  await zapisano(page);
  await karta(page, 'Igła').first().click();
  await expect(page.getByRole('complementary', { name: 'Zaznaczone karty' })).toContainText('Broń');
});
