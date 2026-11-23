import { expect, test } from '@playwright/test';
import { karta, kreator, sekcja } from './szablonUI';
import { zapisano } from './pomoc';

test('wzór tła karty: wybór, parametry, podgląd na żywo i zapis', async ({ page }) => {
  await kreator(page, {
    nazwa: 'Karta w kratkę',
    format: 'Standard / Poker',
    uklad: 'Tytuł i opis',
    rogi: 3,
  });
  await karta(page);
  const tlo = await sekcja(page, 'Tło karty');
  const rodzajTla = tlo.getByRole('group', { name: 'Rodzaj tła' });
  await rodzajTla.getByRole('button', { name: 'Wzór' }).click();
  const podglad = page.locator('.karta-podgladu svg');
  // Domyślnie kratka – linie wektorowe w kolorze wzoru.
  await expect(podglad.locator('path[stroke="#9fb3c8"]')).toHaveCount(1);

  await tlo.getByLabel('Kolor linii').fill('#aa3300');
  await expect(podglad.locator('path[stroke="#aa3300"]')).toHaveCount(1);
  await tlo.getByLabel('Wzór', { exact: true }).selectOption({ label: 'Kropki' });
  await expect(podglad.locator('path[fill="#aa3300"]')).toHaveCount(1);
  await tlo.getByLabel('Wzór', { exact: true }).selectOption({ label: 'Romby' });
  await tlo.getByLabel('Odstęp (mm)').fill('4');
  await tlo.getByLabel('Przezroczystość (%)').fill('40');
  await expect(podglad.locator('g[opacity="0.6"] path[stroke="#aa3300"]')).toHaveCount(1);

  await zapisano(page);
  await page.reload();
  await karta(page);
  const poZapisie = await sekcja(page, 'Tło karty');
  await expect(
    poZapisie.getByRole('group', { name: 'Rodzaj tła' }).getByRole('button', { name: 'Wzór' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(poZapisie.getByLabel('Wzór', { exact: true })).toHaveValue('romby');
  await expect(poZapisie.getByLabel('Odstęp (mm)')).toHaveValue('4');

  // „Brak” usuwa kolor tła i wzór.
  await poZapisie
    .getByRole('group', { name: 'Rodzaj tła' })
    .getByRole('button', { name: 'Brak' })
    .click();
  await expect(podglad.locator('path[stroke="#aa3300"]')).toHaveCount(0);
});
