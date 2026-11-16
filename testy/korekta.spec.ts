import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

/** Arkusz w projekcie: ustawienia, tryb czarno-biały, ręczna korekta układu (E7e). */

async function arkuszeProjektu(page: Page) {
  await page.goto('./#/projekty');
  await page.getByRole('button', { name: /Nowy projekt z pakietu/ }).click();
  await page.getByRole('link', { name: /Podgląd i PDF arkuszy/ }).click();
  await expect(page.getByRole('img', { name: 'Strona 1' })).toBeVisible();
}

const zapisano = (page: Page) => expect(page.locator('.status-zapisu')).toHaveText('Zapisano');

test('ręczna korekta: zamiana miejscami, odpięcie, przeniesienie do slotu', async ({ page }) => {
  await arkuszeProjektu(page);
  await page.getByLabel('Ręczna korekta układu').check();
  // Pakiet ma pełny ręczny układ – wszystkie karty przypięte.
  const igla = page.getByRole('button', { name: /^Igła \(przypięta\) – strona 1/ });
  const sztylet = page.getByRole('button', { name: /^Sztylet \(przypięta\) – strona 1/ });
  const pozycja = async (l: typeof igla) =>
    (await l.first().getAttribute('aria-label'))!.replace(/^.* – /, '');
  const pIgly = await pozycja(igla);
  const pSztyletu = await pozycja(sztylet);

  await igla.first().click();
  await expect(igla.first()).toHaveAttribute('aria-pressed', 'true');
  await sztylet.first().click();
  await zapisano(page);
  const pozycje = async (l: typeof igla) =>
    (await l.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')!))).map((x) =>
      x.replace(/^.* – /, ''),
    );
  expect(await pozycje(igla)).toContain(pSztyletu);
  expect(await pozycje(igla)).not.toContain(pIgly);
  expect(await pozycje(sztylet)).toContain(pIgly);

  // Odepnij wszystkie → karty układają się automatycznie (bez „przypięta”).
  await page.getByRole('button', { name: 'Odepnij wszystkie' }).click();
  await expect(page.getByRole('button', { name: /\(przypięta\)/ })).toHaveCount(0);

  // Przeniesienie karty do slotu → przypięta w tym miejscu, także po przeładowaniu.
  await page
    .getByRole('button', { name: /^Igła – strona 1/ })
    .first()
    .click();
  // Cel zajęty przez kartę rozmieszczoną automatycznie – kliknięcie tej karty = ten slot.
  await page.locator('.karta-korekty[aria-label$="strona 1, kolumna 10, rząd 7"]').click();
  await expect(
    page.getByRole('button', { name: 'Igła (przypięta) – strona 1, kolumna 10, rząd 7' }),
  ).toBeVisible();
  await zapisano(page);
  await page.reload();
  await page.getByLabel('Ręczna korekta układu').check();
  await expect(
    page.getByRole('button', { name: 'Igła (przypięta) – strona 1, kolumna 10, rząd 7' }),
  ).toBeVisible();

  // Karta 1×2 w ostatnim rzędzie – poza siatką, komunikat.
  await page
    .getByRole('button', { name: /^Młot bojowy – strona 1/ })
    .first()
    .click();
  await page
    .locator('.nakladka-korekty [aria-label$="strona 1, kolumna 1, rząd 7"]')
    .last()
    .click();
  await expect(page.locator('.pasek-korekty [role=status]')).toHaveText(
    'Nie można: karta wyszłaby poza siatkę.',
  );

  // Zamrożenie układu przypina wszystko.
  await page.getByRole('button', { name: 'Przypnij wszystkie (zamroź układ)' }).click();
  await expect(page.getByRole('button', { name: /^[^(]+ – strona/ })).toHaveCount(0);
});

test('arkusz z grupami – korekta niedostępna', async ({ page }) => {
  await arkuszeProjektu(page);
  await page.getByLabel('Arkusz:').selectOption({ label: 'Karty stanów' });
  await expect(page.getByLabel('Ręczna korekta układu')).toBeDisabled();
  await expect(
    page.getByText(/ręczna korekta jest dostępna tylko dla arkuszy bez grup/),
  ).toBeVisible();
});

test('tryb czarno-biały: szare obrazy w podglądzie i PDF', async ({ page }) => {
  await arkuszeProjektu(page);
  const obraz = page.locator('.strona-arkusza image').first();
  const kolorowy = await obraz.getAttribute('href');
  await page.getByText('Ustawienia arkusza').click();
  await page.getByLabel('Czarno-biały (skala szarości, także obrazy)').check();
  await expect(obraz).not.toHaveAttribute('href', kolorowy!);
  // Piksele obrazu w podglądzie są szare (R = G = B).
  const szary = await obraz.evaluate(async (el) => {
    const img = new Image();
    img.src = el.getAttribute('href')!;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < d.length; i += 4)
      if (d[i] !== d[i + 1] || d[i + 1] !== d[i + 2]) return false;
    return true;
  });
  expect(szary).toBe(true);
  await zapisano(page);

  const [pobranie] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Pobierz PDF' }).click(),
  ]);
  const pdf = await PDFDocument.load(readFileSync(await pobranie.path()));
  expect(pdf.getPageCount()).toBe(1);
});
