import { expect, test } from '@playwright/test';
import { plikSzablonu } from './kartkaUI';

test.describe('UI2 R3 – okno Nowy projekt (3 ścieżki startu)', () => {
  test.use({ viewport: { width: 1440, height: 960 } });

  test('ścieżka 1: Pusta karta – orientacja Poziomo, sam Tył (D4, D5) i przód w układzie swobodnym (D7)', async ({
    page,
  }) => {
    await page.goto('./');
    await page.getByTestId('start-nowe-karty').click();
    const okno = page.getByRole('dialog', { name: 'Nowy projekt' });
    await expect(okno).toBeVisible();

    // Gdy brak szablonów, przycisk „Z szablonu” jest nieaktywny z dopiskiem.
    const btnSzablon = okno.getByRole('button', { name: /Z szablonu/ });
    await expect(btnSzablon).toBeDisabled();
    await expect(btnSzablon).toContainText('Brak szablonów');

    // Przełączenie orientacji Pionowo → Poziomo zamienia wymiary (63×88 → 88×63).
    await expect(okno.getByRole('button', { name: /Poker/ })).toContainText('63×88');
    await okno.getByRole('button', { name: 'Poziomo' }).click();
    await expect(okno.getByRole('button', { name: /Poker/ })).toContainText('88×63');

    // Walidacja stron (D5): można wybrać sam tył, nie można odznaczyć ostatniej strony.
    const btnPrzod = okno.getByRole('button', { name: /Przód \(awers\)/ });
    const btnTyl = okno.getByRole('button', { name: /Tył \(rewers\)/ });
    await btnPrzod.click();
    await expect(btnPrzod).toHaveAttribute('aria-pressed', 'true');
    await btnTyl.click();
    await expect(okno).toContainText('Otworzy się edytor z zakładkami Przód i Tył.');
    await btnPrzod.click();
    await expect(btnPrzod).toHaveAttribute('aria-pressed', 'false');
    await expect(okno).toContainText('Otworzy się edytor tyłu. Przód dodasz później.');

    // Tworzymy projekt z samym przodem (88×63 mm, poziomo).
    await btnPrzod.click();
    await btnTyl.click();
    await okno.getByPlaceholder(/Zaklęcia/).fill('Moje zaklęcia');
    await okno.getByRole('button', { name: 'Utwórz projekt' }).click();

    await expect(page).toHaveURL(/#\/projekt\/[^/]+\/szablon\//, { timeout: 15000 });
    await expect(page.getByLabel('Nazwa szablonu')).toHaveValue('Moje zaklęcia', {
      timeout: 15000,
    });
  });

  test('ścieżka 2 i 3: Import pliku (przycisk nieaktywny bez pliku) oraz Z szablonu', async ({
    page,
  }) => {
    // 1) Import pliku szablonu z okna Nowy projekt.
    await page.goto('./');
    await page.getByTestId('start-nowe-karty').click();
    const okno = page.getByRole('dialog', { name: 'Nowy projekt' });
    await okno.getByRole('button', { name: /Import pliku/ }).click();

    const btnUtworz = okno.getByRole('button', { name: 'Utwórz projekt' });
    await expect(btnUtworz).toBeDisabled();

    await okno.getByTestId('np-plik-szablonu').setInputFiles(plikSzablonu());
    await expect(btnUtworz).toBeEnabled();
    await expect(okno).toContainText('czar.kartyrpg-szablon');
    await okno.getByPlaceholder(/Zaklęcia/).fill('Projekt z pliku');
    await btnUtworz.click();

    await expect(page).toHaveURL(/#\/projekt\/[^/]+$/, { timeout: 15000 });
    await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });

    // 2) Teraz w przeglądarce jest już szablon – ścieżka „Z szablonu” jest aktywna.
    await page.goto('./#/');
    await page.getByTestId('start-nowe-karty').click();
    await expect(okno).toBeVisible();
    const btnSzablon = okno.getByRole('button', { name: /Z szablonu/ });
    await expect(btnSzablon).toBeEnabled();
    await btnSzablon.click();
    await okno.getByPlaceholder(/Zaklęcia/).fill('Kopia z szablonu');
    await okno.getByRole('button', { name: 'Utwórz projekt' }).click();

    await expect(page).toHaveURL(/#\/projekt\/[^/]+$/, { timeout: 15000 });
    await expect(page.locator('input.nazwa-projektu')).toHaveValue('Kopia z szablonu', {
      timeout: 15000,
    });
  });
});
