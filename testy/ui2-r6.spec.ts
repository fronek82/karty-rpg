import { expect, test } from '@playwright/test';

test('R6: Krok 2 Karty – dodawanie kart, Podgląd/Tabela, Przód/Tył/Obie, kopie i tył karty', async ({
  page,
}) => {
  // Utworzenie szablonu (przód + tył) i projektu z tego szablonu (Plan S S3).
  await page.goto('./');
  await page.getByTestId('start-nowy-szablon').click();
  const oknoSz = page.getByTestId('okno-nowy-szablon');
  await oknoSz.getByRole('button', { name: /Tył \(rewers\)/ }).click();
  await oknoSz.getByRole('button', { name: 'Utwórz szablon' }).click();
  await expect(page).toHaveURL(/#\/szablon\/[^/]+$/, { timeout: 15000 });
  await page.getByRole('link', { name: '← Szablony' }).click();
  await expect(page.getByTestId('kafelek-szablonu')).toHaveCount(2, { timeout: 10000 });

  await page.getByTestId('start-nowe-karty').click();
  const okno = page.getByTestId('okno-nowy-projekt');
  await okno.getByTestId('np-lista-szablonow').locator('button').first().click();
  await okno.getByRole('button', { name: 'Utwórz projekt' }).click();
  await page
    .getByRole('navigation', { name: 'Etapy projektu' })
    .getByRole('link', { name: /Szablony/ })
    .click();
  await expect(page.locator('.karta-podgladu')).toBeVisible();

  // Dodajemy pole Tekst w szablonie, zapisujemy i przechodzimy do kroku „2 Karty”.
  const pasekEdytora = page.getByRole('navigation', { name: 'Dodaj element' });
  await pasekEdytora.getByRole('button', { name: 'Tekst', exact: true }).click();
  await page
    .locator('header.ui2-naglowek')
    .getByRole('button', { name: 'Zapisz', exact: true })
    .click();
  await page
    .getByRole('navigation', { name: 'Etapy projektu' })
    .getByRole('link', { name: /Karty/ })
    .click();

  await expect(page.getByTestId('pasek-stanu-kart')).toBeVisible();

  // Dodajemy dwie karty klikając szablon w lewym pasku „Dodaj karty”.
  const pasekKart = page.getByRole('navigation', { name: 'Dodaj karty' });
  const btnSzablon = pasekKart.locator('.ui2-pasek-grupa').first().locator('button').first();
  await btnSzablon.click();
  await btnSzablon.click();
  await expect(page.getByTestId('kafelek-karty')).toHaveCount(2);

  // Zmiana liczby kopii (− / +) aktualizuje odznakę ×N na kafelku i pasek stanu.
  await page.getByTestId('kopie-plus').click();
  await page.getByTestId('kopie-plus').click();
  await expect(page.getByTestId('kopie-wartosc')).toHaveText('3');
  await expect(page.getByTestId('odznaka-kopii')).toHaveText('×3');
  await expect(page.getByTestId('pasek-stanu-kart')).toContainText('2 kart · 4 do druku');

  // Wybór tyłu karty (Brak tyłu vs Domyślny).
  const wyborTylu = page.getByTestId('wybor-tylu-karty');
  await wyborTylu.selectOption('__brak__');
  await expect(wyborTylu).toHaveValue('__brak__');
  await wyborTylu.selectOption('__domyslny__');

  // Przełącznik strony: Przód → Tył → Obie.
  await page.getByRole('tab', { name: 'Tył' }).click();
  await expect(page.getByTestId('podglad-tyl')).toHaveCount(2);
  await page.getByRole('tab', { name: 'Obie' }).click();
  await expect(page.getByTestId('podglad-przod')).toHaveCount(2);
  await expect(page.getByTestId('podglad-tyl')).toHaveCount(2);

  // Przełącznik widoku: Podgląd → Tabela i edycja komórki.
  await page.getByRole('tab', { name: 'Tabela' }).click();
  const tabela = page.getByTestId('tabela-kart');
  await expect(tabela).toBeVisible();
  const pierwszaKomorka = tabela.locator('tbody tr').first().locator('input[type="text"]').first();
  await pierwszaKomorka.fill('Miecz ognia');
  await expect(pierwszaKomorka).toHaveValue('Miecz ognia');

  // Powrót do Podglądu pokazuje wpisaną nazwę na kafelku.
  await page.getByRole('tab', { name: 'Podgląd' }).click();
  await expect(page.getByTestId('kafelek-karty').first()).toContainText('Miecz ognia');
});
