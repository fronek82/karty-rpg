import { expect, test } from '@playwright/test';
import { dodajKarte, nowaPustaKartka } from './pomoc';

test.use({ viewport: { width: 1440, height: 1050 } });

test('tworzy, przypisuje i zapisuje rewers z dwiema warstwami', async ({ page }) => {
  await nowaPustaKartka(page);
  await dodajKarte(page, 1, 1, 1, 'Ekwipunek', 'Przedmiot');
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  await page.getByRole('link', { name: 'Rewersy', exact: true }).click();
  await page.getByRole('button', { name: 'Dodaj rewers' }).click();
  await page.getByLabel('Nazwa rewersu').fill('Mapa próbna');
  const podglad = page.getByRole('region', { name: 'Podgląd rewersu' });
  await page.getByLabel('Wgraj tło').setInputFiles('testy/zasoby/litera-f.png');
  await expect(podglad.locator('image')).toHaveCount(1);
  const dopasowanie = page.getByRole('combobox', { name: 'Dopasowanie tła' });
  await dopasowanie.selectOption('kafelki');
  await expect(podglad.locator('image')).not.toHaveCount(1);
  await dopasowanie.selectOption('dopasuj');
  await expect(podglad.locator('image')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Obraz tła' }).selectOption('');
  await page.getByRole('button', { name: 'Dodaj napis' }).click();
  await page.getByRole('textbox', { name: 'Tekst rewersu' }).fill('Mapa');
  await expect(podglad.locator('use')).toHaveCount(4);
  await page.getByRole('button', { name: 'Dodaj grafikę' }).click();
  await page.getByLabel('Wgraj grafikę').setInputFiles({
    name: 'kierunek.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M1 1L9 2L1 8Z"/></svg>',
    ),
  });
  await expect(podglad.locator('g > path[d^="M1"]')).not.toHaveCount(0);
  await page.getByRole('button', { name: 'Przyciągnij do lewego górnego rogu' }).click();
  await page.getByRole('button', { name: 'Niżej', exact: true }).click();
  await expect(page.locator('.rewers-warstwy li').first()).toContainText('Grafika');
  await page.getByRole('button', { name: 'Cofnij', exact: true }).click();
  await expect(page.locator('.rewers-warstwy li').first()).toContainText('Napis');

  await page.getByText('Przypisania', { exact: true }).click();
  const karta = page.getByRole('combobox', { name: 'Karta 1', exact: true });
  await karta.selectOption({ label: 'Mapa próbna' });
  await karta.selectOption({ label: 'Brak' });
  await expect(karta).toHaveValue('-');
  await page.getByRole('button', { name: 'Cofnij', exact: true }).click();
  await expect(karta).toHaveValue(/^r:/);
  await expect(page.getByRole('status')).toContainText('Zapisano');
  await page.reload();
  await expect(page.getByLabel('Nazwa rewersu')).toHaveValue('Mapa próbna');
  await expect(podglad.locator('use')).toHaveCount(4);
  await page.getByRole('button', { name: 'EN' }).click();
  await page.getByRole('button', { name: 'Dark theme' }).click();
  await expect(page.getByRole('heading', { name: 'Card backs' })).toBeVisible();
  if (process.env.ZRZUTY_M4_2)
    await page.screenshot({ path: 'docs/obrazy/m4-2-edytor-rewersu.png' });
});
