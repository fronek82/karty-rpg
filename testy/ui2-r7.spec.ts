import { expect, test } from '@playwright/test';

test('R7: Krok 3 Druk – sekcja Linie cięcia (grubość, kolor, kreska, przerwa, podgląd na żywo)', async ({
  page,
}) => {
  // Utworzenie nowego projektu, dodanie karty w Kroku 2 i przejście do Kroku 3 (Druk).
  await page.goto('./');
  await page.getByTestId('start-nowe-karty').click();
  const okno = page.getByRole('dialog', { name: 'Nowy projekt' });
  await expect(okno).toBeVisible();
  await okno.getByRole('button', { name: 'Utwórz projekt' }).click();
  await expect(page.locator('.karta-podgladu')).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Etapy projektu' })
    .getByRole('link', { name: /Karty/ })
    .click();
  const pasekKart = page.getByRole('navigation', { name: 'Dodaj karty' });
  await pasekKart.locator('.ui2-pasek-grupa').first().locator('button').first().click();
  await page.getByRole('button', { name: 'Zapisz', exact: true }).click();
  await page.getByRole('link', { name: 'Do druku →' }).click();

  // Sekcja Linie cięcia jest widoczna i otwarta.
  const sekcja = page.getByTestId('sekcja-linii-ciecia');
  await expect(sekcja).toBeVisible();

  // Zmiana grubości na 0,5 mm.
  const btn05 = sekcja.getByTestId('linia-grubosc-0.5');
  await btn05.click();
  await expect(btn05).toHaveAttribute('aria-pressed', 'true');

  // Zmiana koloru na jasny (#cccccc) przełącza tło podglądu na ciemne.
  await sekcja.getByTestId('linia-probka-cccccc').click();
  const podglad = sekcja.getByTestId('podglad-linii-ciecia');
  await expect(podglad).toHaveAttribute('data-ciemne', '1');
  await expect(podglad.locator('line')).toHaveAttribute('stroke', '#cccccc');

  // Zmiana koloru na czerwony (#c83e3b) przywraca jasne tło podglądu.
  await sekcja.getByTestId('linia-probka-c83e3b').click();
  await expect(podglad).toHaveAttribute('data-ciemne', '0');
  await expect(podglad.locator('line')).toHaveAttribute('stroke', '#c83e3b');

  // Ustawienie przerwy na 0 daje linię ciągłą (brak stroke-dasharray).
  const przerwa = sekcja.locator('#linia-przerwa');
  await przerwa.fill('0');
  await przerwa.blur();
  await expect(podglad.locator('line')).not.toHaveAttribute('stroke-dasharray');

  // Wyłączenie linii cięcia chowa kontrolki grubości/koloru.
  await sekcja.getByTestId('linie-wlacz').uncheck();
  await expect(btn05).toBeHidden();
});
