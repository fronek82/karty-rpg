import { expect, test } from '@playwright/test';

test.describe('UI2 R12 – ekran Druk w stylu UI2, import CSV w kroku Karty i porządki (sekcja 14)', () => {
  test('14.1–14.4: jeden stan zapisu i import CSV w kroku Karty, ekran Druk w stylu UI2 i odznaczanie kart', async ({
    page,
  }) => {
    // 1. Utwórz szablon z polem tekstowym w Moich szablonach i projekt z tego szablonu.
    await page.goto('./#/');
    await page.getByTestId('start-nowy-szablon').click();
    await page
      .getByTestId('okno-nowy-szablon')
      .getByRole('button', { name: 'Utwórz szablon' })
      .click();
    await expect(page).toHaveURL(/#\/szablon\/[^/]+$/, { timeout: 15000 });
    await page
      .getByRole('navigation', { name: 'Dodaj element' })
      .getByRole('button', { name: 'Tekst', exact: true })
      .click();
    await page
      .locator('header.ui2-naglowek')
      .getByRole('button', { name: 'Zapisz', exact: true })
      .click();
    await expect(page.locator('header.ui2-naglowek .ui2-stan-zapisu')).toContainText(/zapisano/i);
    await page.getByRole('link', { name: '← Szablony' }).click();
    await expect(page.getByTestId('kafelek-szablonu')).toHaveCount(1, { timeout: 10000 });

    await page.getByTestId('start-nowe-karty').click();
    const oknoProjektu = page.getByTestId('okno-nowy-projekt');
    await oknoProjektu.getByTestId('np-lista-szablonow').locator('button').first().click();
    await oknoProjektu.getByRole('button', { name: 'Utwórz projekt' }).click();
    await expect(page).toHaveURL(/#\/projekt\/[^/]+\/karty$/, { timeout: 15000 });

    // 2. Krok Karty: dokładnie jeden element stanu zapisu w nagłówku (bez duplikatu „Zapisano”).
    const naglowekKart = page.locator('header.ui2-naglowek');
    await expect(
      naglowekKart.locator(
        '.ui2-stan-zapisu, .ui2-stan-zapisu-btn, .status-zapisu, .przycisk-zapisz',
      ),
    ).toHaveCount(1);

    // 3. Brak podwójnego plusa „+ + Nowy szablon” w lewym pasku.
    const pasekKart = page.getByRole('navigation', { name: 'Dodaj karty' });
    await expect(pasekKart).not.toContainText('＋ Nowy szablon');
    await expect(
      pasekKart
        .locator('[data-grupa="moje-szablony"]')
        .getByRole('button', { name: 'Nowy szablon', exact: true }),
    ).toBeVisible();

    // 4. Import z CSV / Excela w kroku Karty otwiera okno i dodaje karty z małego pliku CSV.
    await pasekKart.getByRole('button', { name: 'Import z CSV / Excela', exact: true }).click();
    const oknoImportu = page.locator('dialog.dialog-importu-tabeli');
    await expect(oknoImportu).toBeVisible();

    const csv = Buffer.from('tekst,ilosc\nKula ognia,2\nTarcza,1\n', 'utf8');
    await oknoImportu.locator('input[type="file"]').setInputFiles({
      name: 'zaklecia.csv',
      mimeType: 'text/csv',
      buffer: csv,
    });
    await expect(oknoImportu.getByRole('button', { name: 'Dodaj karty' })).toBeEnabled({
      timeout: 10000,
    });
    await oknoImportu.getByRole('button', { name: 'Dodaj karty' }).click();
    await expect(oknoImportu).toHaveCount(0);
    await expect(page.getByTestId('kafelek-karty')).toHaveCount(2);

    // Zapisz projekt (jeden przycisk „Zapisz” w nagłówku) i przejdź do kroku Druk.
    await expect(
      naglowekKart.locator(
        '.ui2-stan-zapisu, .ui2-stan-zapisu-btn, .status-zapisu, .przycisk-zapisz',
      ),
    ).toHaveCount(1);
    await naglowekKart.getByRole('button', { name: 'Zapisz', exact: true }).click();
    await expect(naglowekKart.locator('.ui2-stan-zapisu')).toContainText(/zapisano/i);

    await naglowekKart.getByRole('link', { name: 'Do druku →' }).click();
    await expect(page).toHaveURL(/#\/projekt\/[^/]+\/drukuj$/, { timeout: 15000 });

    // 5. Nagłówek ekranu Druk: bez „Eksportuj”, „Powrót”, „Biblioteki”; jest „Pobierz PDF”.
    const naglowekDruku = page.locator('header.ui2-naglowek');
    await expect(naglowekDruku).toBeVisible();
    await expect(naglowekDruku.getByRole('button', { name: /Pobierz PDF/ })).toBeVisible();
    for (const zakazany of ['Eksportuj', 'Powrót', 'Biblioteki']) {
      await expect(naglowekDruku).not.toContainText(zakazany);
    }

    // 6. Prawy panel „Ustawienia druku”: bez „Nowy tył” i „Katalog Google Fonts”.
    const panel = page.getByRole('complementary', { name: 'Opcje druku i arkusza' });
    await expect(panel).toBeVisible();
    await expect(panel).not.toContainText('Nowy tył');
    await expect(panel).not.toContainText('Katalog Google Fonts');

    // 7. Wyrównanie linii nagłówków trzech kolumn (lewy pasek, pasek nad podglądem, prawy panel).
    const hLewy = (await page.locator('.ui2-pasek-boczny-naglowek').boundingBox())!.height;
    const hSrodek = (await page.locator('.druk-ui2-pasek').boundingBox())!.height;
    const hPrawy = (await panel.locator('.ui2-panel-naglowek').boundingBox())!.height;
    expect(Math.abs(hLewy - hSrodek)).toBeLessThanOrEqual(1);
    expect(Math.abs(hSrodek - hPrawy)).toBeLessThanOrEqual(1);

    // 8. Odznaczenie karty w „Karty w druku” zmniejsza liczbę kart w podsumowaniu bez modyfikacji danych.
    const podsumowanie = page.getByTestId('podsumowanie-druku');
    await expect(podsumowanie).toContainText('3 kart');
    const pasekDruku = page.getByRole('navigation', { name: 'Karty w druku' });
    await pasekDruku.getByRole('button', { name: 'Kula ognia' }).click();
    await expect(podsumowanie).toContainText('1 kart');
    await expect(page.getByTestId('druk-licznik-sztuk')).toHaveText('1 szt.');
    // Pominięcie karty nie oznacza projektu jako niezapisanego.
    await expect(naglowekDruku.locator('.ui2-stan-zapisu')).toContainText(/zapisano/i);

    // 9. Pasek stanu 44 px: ? Skróty otwiera dymek, Esc go zamyka.
    const pasekStanu = page.getByTestId('pasek-stanu-druk');
    await expect(pasekStanu).toBeVisible();
    await pasekStanu.getByTestId('stan-skroty').click();
    await expect(page.getByTestId('dymek-skrotow-druk')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dymek-skrotow-druk')).toHaveCount(0);
  });
});
