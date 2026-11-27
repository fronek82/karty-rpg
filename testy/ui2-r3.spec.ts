import { expect, test } from '@playwright/test';
import { plikSzablonu } from './kartkaUI';

test.describe('UI2 R3 / Plan S S3 – okna Nowy szablon i Nowy projekt', () => {
  test.use({ viewport: { width: 1440, height: 960 } });

  test('Nowy szablon: orientacja Poziomo, walidacja stron Przód/Tył i zapis w Moich szablonach', async ({
    page,
  }) => {
    await page.goto('./');
    await page.getByTestId('start-nowy-szablon').click();
    const okno = page.getByTestId('okno-nowy-szablon');
    await expect(okno).toBeVisible();

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
    await expect(okno).toContainText('Utworzy przód i przypięty do niego tył w Moich szablonach.');
    await btnPrzod.click();
    await expect(btnPrzod).toHaveAttribute('aria-pressed', 'false');
    await expect(okno).toContainText('Utworzy szablon tyłu w Moich szablonach.');

    // Tworzymy szablon przodu (88×63 mm, poziomo).
    await btnPrzod.click();
    await btnTyl.click();
    await okno.getByLabel('Nazwa szablonu').fill('Moje zaklęcia');
    await okno.getByRole('button', { name: 'Utwórz szablon' }).click();

    await expect(page.getByRole('tab', { name: /Moje szablony/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByTestId('kafelek-szablonu').first()).toContainText('Moje zaklęcia');
  });

  test('Nowy szablon (import .kartyrpg-szablon) i Nowy projekt z Moich szablonów', async ({
    page,
  }) => {
    // 1) Import pliku szablonu do Moich szablonów.
    await page.goto('./');
    await page.getByTestId('start-nowy-szablon').click();
    const oknoSz = page.getByTestId('okno-nowy-szablon');
    await oknoSz.getByRole('button', { name: /Import pliku/ }).click();

    const btnUtworzSz = oknoSz.getByRole('button', { name: 'Utwórz szablon' });
    await expect(btnUtworzSz).toBeDisabled();

    await oknoSz.getByTestId('ns-plik-szablonu').setInputFiles(plikSzablonu());
    await expect(btnUtworzSz).toBeEnabled();
    await expect(oknoSz).toContainText('czar.kartyrpg-szablon');
    await btnUtworzSz.click();
    await expect(page.getByTestId('kafelek-szablonu')).toHaveCount(1, { timeout: 10000 });

    // 2) Utworzenie projektu z tego szablonu w oknie Nowy projekt.
    await page.getByTestId('start-nowe-karty').click();
    const oknoPr = page.getByTestId('okno-nowy-projekt');
    await expect(oknoPr).toBeVisible();
    await oknoPr.getByLabel('Nazwa projektu').fill('Kopia z szablonu');
    await oknoPr.getByTestId('np-lista-szablonow').locator('button').first().click();
    await oknoPr.getByRole('button', { name: 'Utwórz projekt' }).click();

    await expect(page).toHaveURL(/#\/projekt\/[^/]+\/karty$/, { timeout: 15000 });
    await expect(page.locator('header.ui2-naglowek')).toContainText('Kopia z szablonu', {
      timeout: 15000,
    });
  });
});
