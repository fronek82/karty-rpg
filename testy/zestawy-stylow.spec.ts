import { expect, test } from '@playwright/test';
import { zapisano } from './pomoc';
import { karta, dodaj, drzewo, kreator, sekcja, zaznacz } from './szablonUI';

test.use({ viewport: { width: 1440, height: 960 } });

test('zestaw stylów zmienia ramkę i separator, daje się cofnąć i zapisać', async ({ page }) => {
  await kreator(page, {
    nazwa: 'Karta z zestawem',
    format: 'Standard / Poker',
    uklad: 'Tytuł i opis',
  });
  await karta(page);
  await dodaj(page, 'Separator');
  await karta(page);

  const podglad = page.locator('.karta-podgladu svg');
  const ozdoby = podglad.locator('use[color]');
  const liczbaWezlow = await drzewo(page).getByRole('treeitem').count();
  await expect(ozdoby).toHaveCount(0);

  const zestawy = await sekcja(page, 'Zestawy stylów');
  await zestawy.getByRole('button', { name: 'Leśny' }).focus();
  await page.keyboard.press('Enter');
  await expect(ozdoby.first()).toHaveAttribute('color', '#36543e');
  await expect(drzewo(page).getByRole('treeitem')).toHaveCount(liczbaWezlow);
  await page.getByRole('button', { name: 'Cofnij', exact: true }).click();
  await expect(ozdoby).toHaveCount(0);
  await expect(drzewo(page).getByRole('treeitem')).toHaveCount(liczbaWezlow);

  await zestawy.getByRole('button', { name: 'Runiczny' }).click();
  await expect(ozdoby.first()).toHaveAttribute('color', '#614633');
  await zapisano(page);
  await page.reload();
  await karta(page);
  await expect(ozdoby.first()).toHaveAttribute('color', '#614633');
  const ramka = await sekcja(page, 'Ramka karty');
  await expect(ramka.getByRole('button', { name: 'runy', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(ramka.getByRole('button', { name: 'okucie', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await zaznacz(page, 'Separator');
  await sekcja(page, 'Separator');
  await expect(page.getByRole('button', { name: 'łańcuch', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
