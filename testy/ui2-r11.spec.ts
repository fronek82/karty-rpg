import { expect, test } from '@playwright/test';

test.describe('UI2 R11 – Mausritter w stylu UI2 (sekcja 13)', () => {
  test('13.1–13.6: start z oknem, wspólny nagłówek, 6 różnych ikon, brak pływającego paska, panel Arkusz i pasek stanu', async ({
    page,
  }) => {
    // 1. Brak starej trasy #/gra/mausritter.
    await page.goto('./#/gra/mausritter');
    await expect(page.getByRole('heading', { name: 'Nie ma takiej strony.' })).toBeVisible();

    // 2. „Mausritter A4” na Starcie tworzy projekt i otwiera ekran arkusza z oknem „Od czego zaczynamy?”.
    await page.goto('./#/');
    await page.getByTestId('start-mausritter').click();
    await expect(page).toHaveURL(/#\/projekt\/[^/]+\/start$/);

    const okno = page.getByTestId('okno-startu-mausritter');
    await expect(okno).toBeVisible();
    await expect(okno.getByRole('heading', { name: 'Od czego zaczynamy?' })).toBeVisible();
    await expect(okno).toContainText('10 × 7');
    await expect(okno).toContainText('Isaac Williams');

    // „Pusty arkusz A4” zamyka okno i czyści adres do #/projekt/<id>.
    await page.getByTestId('start-pusty-arkusz').click();
    await expect(okno).toHaveCount(0);
    await expect(page).toHaveURL(/#\/projekt\/[^/]+$/);
    await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });

    // 3. Wspólny NaglowekProjektu: bez „Powrót”, „Drukuj karty”, „Biblioteki”; jest „Do druku →” i MAUSRITTER.
    const naglowek = page.locator('header.ui2-naglowek');
    await expect(naglowek).toBeVisible();
    await expect(naglowek.locator('.ui2-etykieta-mausritter')).toHaveText('MAUSRITTER');
    await expect(naglowek.getByRole('link', { name: 'Do druku →', exact: true })).toBeVisible();
    for (const zakazany of ['Powrót', 'Drukuj karty', 'Biblioteki']) {
      await expect(naglowek).not.toContainText(zakazany);
    }

    // 4. Lewy pasek „Dodaj kartę”: 6 przycisków z 6 różnymi ikonami SVG (różne atrybuty d).
    const pasek = page.getByRole('navigation', { name: 'Dodaj kartę' });
    await expect(pasek).toBeVisible();
    const przyciskiTypow = pasek.locator('.ui2-pasek-grupa button');
    await expect(przyciskiTypow).toHaveCount(6);
    const sciezki = await przyciskiTypow
      .locator('svg path')
      .evaluateAll((els) => els.map((el) => el.getAttribute('d') ?? ''));
    expect(new Set(sciezki).size).toBe(6);

    // 5. Pasek zakładek arkuszy + licznik „0 / 70 kafelków zajętych” (bez „Strona 1 z 1”).
    await expect(page.getByTestId('licznik-kafelkow')).toHaveText('0 / 70 kafelków zajętych');
    await expect(page.locator('.etykieta-strony')).toHaveCount(0);

    // 6. Prawy panel bez zaznaczenia: „Arkusz”, Tytuł arkusza, brak „Przód dla wszystkich kart”.
    const panelArkusz = page.getByRole('complementary', { name: 'Arkusz' });
    await expect(panelArkusz).toBeVisible();
    await expect(panelArkusz.getByLabel('Tytuł arkusza')).toBeVisible();
    await expect(panelArkusz).not.toContainText('Przód dla wszystkich kart');

    // 7. Pasek stanu 44 px na dole: A4 poziomo, 10 × 7, ? Skróty z dymkiem i zoom.
    const pasekStanu = page.getByTestId('pasek-stanu-mausritter');
    await expect(pasekStanu).toBeVisible();
    await expect(pasekStanu).toContainText('A4 poziomo');
    await expect(pasekStanu).toContainText('10 × 7');
    await pasekStanu.getByTestId('stan-skroty').click();
    await expect(page.getByTestId('dymek-skrotow-mausritter')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dymek-skrotow-mausritter')).toHaveCount(0);

    // 8. Dodanie karty: pusta karta ma szarą nazwę typu, brak pływającego paska .pasek-karty,
    // w nagłówku prawego panelu są Duplikuj i Usuń.
    await pasek.getByRole('button', { name: 'Broń', exact: true }).click();
    await expect(page.getByTestId('licznik-kafelkow')).toHaveText('1 / 70 kafelków zajętych');
    await expect(page.locator('.pasek-karty')).toHaveCount(0);
    await expect(page.locator('.mausritter-karta-typ-pusta')).toHaveText('Broń');

    const panelKarty = page.getByRole('complementary', { name: 'Zaznaczone karty' });
    await expect(panelKarty).toBeVisible();
    const naglowekPanelu = panelKarty.locator('.ui2-panel-naglowek');
    await expect(naglowekPanelu.getByRole('button', { name: /Duplikuj/ })).toBeVisible();
    await expect(naglowekPanelu.getByRole('button', { name: /Usuń/ })).toBeVisible();

    // Duplikuj z nagłówka panelu dodaje drugą kartę; Usuń usuwa zaznaczoną.
    await naglowekPanelu.getByRole('button', { name: /Duplikuj/ }).click();
    await expect(page.getByTestId('licznik-kafelkow')).toHaveText('2 / 70 kafelków zajętych');
    await naglowekPanelu.getByRole('button', { name: /Usuń/ }).click();
    await expect(page.getByTestId('licznik-kafelkow')).toHaveText('1 / 70 kafelków zajętych');
  });

  test('okno startowe: Esc zamyka z pustym arkuszem, a gotowy arkusz wczytuje karty', async ({
    page,
  }) => {
    await page.goto('./#/');
    await page.getByTestId('start-mausritter').click();
    const okno = page.getByTestId('okno-startu-mausritter');
    await expect(okno).toBeVisible();

    // Escape zamyka okno z pustym arkuszem.
    await page.keyboard.press('Escape');
    await expect(okno).toHaveCount(0);
    await expect(page.getByTestId('licznik-kafelkow')).toHaveText('0 / 70 kafelków zajętych');

    // Wybór gotowego układu „Wszystkie trzy” ładuje 3 zakładki arkuszy.
    await page.goto('./#/');
    await page.getByTestId('start-mausritter').click();
    await expect(okno).toBeVisible();
    await okno.locator('[data-uklad="wszystkie"]').click();
    await expect(okno).toHaveCount(0);
    await expect(page.locator('.mausritter-ui2-zakladka')).toHaveCount(3);
  });
});
