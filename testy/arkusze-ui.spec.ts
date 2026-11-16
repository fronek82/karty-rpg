import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

/** Strona „Arkusze do druku”: podgląd w przeglądarce i pobieranie PDF (E5). */

const A4_POZIOMO = { szer: 841.89, wys: 595.28 };

async function pobierzPdf(page: import('@playwright/test').Page, przycisk: string) {
  const [pobranie] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: przycisk }).click(),
  ]);
  const sciezka = await pobranie.path();
  return { nazwa: pobranie.suggestedFilename(), bajty: readFileSync(sciezka) };
}

test('podgląd arkusza i pobranie PDF jednego arkusza', async ({ page }) => {
  await page.goto('./#/arkusze');
  await expect(page.getByRole('heading', { level: 1, name: 'Arkusze do druku' })).toBeVisible();
  const strona = page.getByRole('img', { name: 'Strona 1' });
  await expect(strona).toBeVisible();
  // Podgląd dopasowany do szerokości – proporcje A4 poziomo.
  const ramka = (await strona.boundingBox())!;
  expect(ramka.width / ramka.height).toBeCloseTo(297 / 210, 2);

  const { nazwa, bajty } = await pobierzPdf(page, 'Pobierz PDF');
  expect(nazwa).toBe('karty-broni-i-pancerzy.pdf');
  await expect(page.getByRole('status')).toHaveText('PDF gotowy – sprawdź pobrane pliki.');
  expect(bajty.subarray(0, 5).toString()).toBe('%PDF-');
  const pdf = await PDFDocument.load(bajty);
  expect(pdf.getPageCount()).toBe(1);
  const { width, height } = pdf.getPage(0).getSize();
  expect(width).toBeCloseTo(A4_POZIOMO.szer, 1);
  expect(height).toBeCloseTo(A4_POZIOMO.wys, 1);
  expect(pdf.getTitle()).toBe('Karty broni i pancerzy');
  // Tekst jako krzywe, glify wspólne – arkusz pełen tekstu i tak jest mały.
  expect(bajty.length).toBeLessThan(400_000);
});

test('wybór arkusza, skala 1:1 i PDF wszystkich arkuszy', async ({ page }) => {
  await page.goto('./#/arkusze');
  await expect(page.getByRole('img', { name: 'Strona 1' })).toBeVisible();
  await page.getByLabel('Arkusz:').selectOption({ label: 'Karty stanów' });
  await page.getByLabel('rozmiar rzeczywisty (1:1)').check();
  // Zakładamy zoom 100% i DPR = 1 (domyślne ustawienia Playwright).
  const strona = page.getByRole('img', { name: 'Strona 1' });
  await expect(strona).toHaveAttribute('width', '297mm');
  // 297 mm w CSS = 297 / 25,4 × 96 px.
  expect((await strona.boundingBox())!.width).toBeCloseTo((297 / 25.4) * 96, 0);

  const { nazwa, bajty } = await pobierzPdf(page, 'Pobierz wszystkie arkusze (PDF)');
  expect(nazwa).toBe('mausritter-karty-ekwipunku-i-stanow-arkusze.pdf');
  const pdf = await PDFDocument.load(bajty);
  expect(pdf.getPageCount()).toBe(3);
});

test('nieudane wczytanie czcionki – komunikat i ponowna próba', async ({ page }) => {
  let blokuj = true;
  await page.route('**/czcionki/GrenzeGotisch-Bold.ttf', (route) =>
    blokuj ? route.fulfill({ status: 404 }) : route.continue(),
  );
  await page.goto('./#/arkusze');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Nie udało się wczytać czcionek lub obrazów pakietu.');
  await expect(page.getByRole('button', { name: 'Pobierz PDF' })).toBeDisabled();
  blokuj = false;
  await alert.getByRole('button', { name: 'Spróbuj ponownie' }).click();
  await expect(page.getByRole('img', { name: 'Strona 1' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
