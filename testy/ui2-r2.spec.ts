import { expect, test } from '@playwright/test';

test.describe('UI2 R2 – strona główna drukarnia riso', () => {
  test.use({ viewport: { width: 1440, height: 960 } });

  test('tylko dwa przyciski tworzenia (+ NOWE KARTY i Mausritter A4), bez Nowy szablon (D1)', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(page.locator('.riso-tytul')).toHaveText('KARTY RPG');

    const lewa = page.locator('aside.riso-lewa');
    await expect(lewa.getByTestId('start-nowe-karty')).toBeVisible();
    await expect(lewa.getByTestId('start-mausritter')).toBeVisible();
    // W lewej kolumnie są tylko 2 kontrolki tworzenia (+ 1 link wsparcia na dole).
    await expect(lewa.locator('button, a[href^="#/"]')).toHaveCount(2);
    await expect(page.getByText(/Nowy szablon/i)).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Przód \(awers\)/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Tył \(rewers\)/i })).toHaveCount(0);
  });

  test('długa nazwa projektu nie psuje wyrównania przycisków Otwórz/Drukuj w rzędzie (D2)', async ({
    page,
  }) => {
    // Tworzymy dwa projekty: jeden z krótką, drugi z bardzo długą nazwą (3+ linie).
    await page.goto('./#/wlasne');
    await page.getByRole('button', { name: 'Karta z opisem', exact: true }).click();
    await expect(page).toHaveURL(/#\/projekt\//, { timeout: 15000 });
    const poleNazwy = page.getByLabel('Nazwa projektu');
    await poleNazwy.fill('Krótki');
    await page.getByRole('button', { name: /^Zapisz/ }).click();
    await expect(page.getByText(/Zapisano/)).toBeVisible({ timeout: 10000 });

    await page.goto('./#/wlasne');
    await page.getByRole('button', { name: 'Blok statystyk', exact: true }).click();
    await expect(page).toHaveURL(/#\/projekt\//, { timeout: 15000 });
    await page
      .getByLabel('Nazwa projektu')
      .fill(
        'Bestiariusz: Bardzo Długa Nazwa Projektu Która Zająłaby Trzy Lub Cztery Linie Bez Ucięcia',
      );
    await page.getByRole('button', { name: /^Zapisz/ }).click();
    await expect(page.getByText(/Zapisano/)).toBeVisible({ timeout: 10000 });

    await page.goto('./#/');
    const kafelki = page.locator('.riso-kafelek');
    await expect(kafelki).toHaveCount(2);

    // Miniatury prawdziwych kart się wyrenderowały (D3).
    await expect(page.locator('.riso-karta-okladka img')).toHaveCount(2, { timeout: 15000 });

    // Przyciski „Otwórz” w obu kafelkach w tym samym rzędzie leżą na identycznej wysokości.
    const pozycje = await page.locator('.riso-btn-otworz').evaluateAll((els) =>
      els.map((el) => {
        const b = el.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, height: b.height };
      }),
    );
    expect(pozycje).toHaveLength(2);
    expect(Math.abs(pozycje[0]!.top - pozycje[1]!.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(pozycje[0]!.bottom - pozycje[1]!.bottom)).toBeLessThanOrEqual(1);

    // Etykieta wymiarów jest pod podglądem (nie nachodzi na .riso-podglad).
    const nakladanie = await page.evaluate(() => {
      const podglad = document.querySelector('.riso-podglad')!.getBoundingClientRect();
      const wymiar = document.querySelector('.riso-wymiar-badge')!.getBoundingClientRect();
      return wymiar.top >= podglad.bottom;
    });
    expect(nakladanie).toBe(true);
  });
});
