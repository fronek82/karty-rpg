import { expect, test } from '@playwright/test';

test.describe('UI2 R2 – strona główna drukarnia riso', () => {
  test.use({ viewport: { width: 1440, height: 960 } });

  test('trzy przyciski tworzenia (+ NOWE KARTY, + NOWY SZABLON i Mausritter A4 – Plan S 5.1)', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(page.locator('.riso-tytul')).toHaveText('KARTY RPG');

    const lewa = page.locator('aside.riso-lewa');
    await expect(lewa.getByTestId('start-nowe-karty')).toBeVisible();
    await expect(lewa.getByTestId('start-nowy-szablon')).toBeVisible();
    await expect(lewa.getByTestId('start-mausritter')).toBeVisible();
    // W lewej kolumnie są 3 kontrolki tworzenia (+ 1 link wsparcia na dole).
    await expect(lewa.locator('button, a[href^="#/"]')).toHaveCount(3);
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

  test('miniatury projektów bez znaczników cięcia: para przód+tył wyśrodkowana (≤ 4 px) i 1 miniatura bez tyłu (D17)', async ({
    page,
  }) => {
    // 1. Szablon dwustronny + szablon jednostronny w Moich szablonach (z polem Tekst do miniatur).
    await page.goto('./');
    await page.getByTestId('start-nowy-szablon').click();
    let oknoSz = page.getByTestId('okno-nowy-szablon');
    await oknoSz.getByLabel('Nazwa szablonu').fill('SzDwustronny');
    await oknoSz.getByRole('button', { name: /Tył \(rewers\)/ }).click();
    await oknoSz.getByRole('button', { name: 'Utwórz szablon' }).click();
    await expect(page).toHaveURL(/#\/szablon\/[^/]+$/, { timeout: 15000 });
    await expect(page.locator('.karta-podgladu')).toBeVisible({ timeout: 15000 });
    await page
      .getByRole('navigation', { name: 'Dodaj element' })
      .getByRole('button', { name: 'Tekst', exact: true })
      .click();
    await page
      .locator('header.ui2-naglowek')
      .getByRole('button', { name: 'Zapisz', exact: true })
      .click();
    await expect(page.locator('header.ui2-naglowek')).toContainText(/zapisano/i, {
      timeout: 10000,
    });
    await page.getByRole('link', { name: '← Szablony' }).click();
    await expect(page.getByTestId('kafelek-szablonu')).toHaveCount(2, { timeout: 10000 });

    await page.getByTestId('start-nowy-szablon').click();
    oknoSz = page.getByTestId('okno-nowy-szablon');
    await oknoSz.getByLabel('Nazwa szablonu').fill('SzJednostronny');
    await oknoSz.getByRole('button', { name: 'Utwórz szablon' }).click();
    await expect(page).toHaveURL(/#\/szablon\/[^/]+$/, { timeout: 15000 });
    await expect(page.locator('.karta-podgladu')).toBeVisible({ timeout: 15000 });
    await page
      .getByRole('navigation', { name: 'Dodaj element' })
      .getByRole('button', { name: 'Tekst', exact: true })
      .click();
    await page
      .locator('header.ui2-naglowek')
      .getByRole('button', { name: 'Zapisz', exact: true })
      .click();
    await expect(page.locator('header.ui2-naglowek')).toContainText(/zapisano/i, {
      timeout: 10000,
    });
    await page.getByRole('link', { name: '← Szablony' }).click();
    await expect(page.getByTestId('kafelek-szablonu')).toHaveCount(3, { timeout: 10000 });

    // 2. Projekt dwustronny z szablonu SzDwustronny.
    await page.getByTestId('start-nowe-karty').click();
    let okno = page.getByTestId('okno-nowy-projekt');
    await okno.getByPlaceholder(/Zaklęcia/).fill('Dwustronny');
    await okno
      .getByTestId('np-lista-szablonow')
      .getByRole('button', { name: /SzDwustronny/ })
      .click();
    await okno.getByRole('button', { name: 'Utwórz projekt' }).click();
    await expect(page).toHaveURL(/#\/projekt\/[^/]+\/karty$/, { timeout: 15000 });

    // 3. Projekt jednostronny z szablonu SzJednostronny.
    await page.goto('./#/');
    await page.getByTestId('start-nowe-karty').click();
    okno = page.getByTestId('okno-nowy-projekt');
    await okno.getByPlaceholder(/Zaklęcia/).fill('Jednostronny');
    await okno
      .getByTestId('np-lista-szablonow')
      .getByRole('button', { name: /SzJednostronny/ })
      .click();
    await okno.getByRole('button', { name: 'Utwórz projekt' }).click();
    await expect(page).toHaveURL(/#\/projekt\/[^/]+\/karty$/, { timeout: 15000 });

    // Powrót na stronę główną (zakładka Moje projekty).
    await page.goto('./#/');
    await page.getByRole('tab', { name: 'Moje projekty' }).click();
    await expect(page.locator('.riso-kafelek')).toHaveCount(2);

    // Brak znaczników cięcia w rogach.
    await expect(page.locator('.riso-rog')).toHaveCount(0);

    const kafelekDwustronny = page.locator('.riso-kafelek', { hasText: 'Dwustronny' });
    const kafelekJednostronny = page.locator('.riso-kafelek', { hasText: 'Jednostronny' });

    // Projekt z tyłem pokazuje 2 miniatury (przód i tył obok siebie), bez tyłu – 1 miniaturę.
    await expect(kafelekDwustronny.locator('.riso-podglad img')).toHaveCount(2, {
      timeout: 15000,
    });
    await expect(kafelekJednostronny.locator('.riso-podglad img')).toHaveCount(1, {
      timeout: 15000,
    });

    // Para miniatur jest wyśrodkowana w obszarze podglądu (różnica marginesów ≤ 4 px).
    const paraMarginesy = await kafelekDwustronny.locator('.riso-podglad').evaluate((podglad) => {
      const p = podglad.getBoundingClientRect();
      const imgs = [...podglad.querySelectorAll('img')].map((i) => i.getBoundingClientRect());
      const left = Math.min(...imgs.map((r) => r.left));
      const right = Math.max(...imgs.map((r) => r.right));
      const top = Math.min(...imgs.map((r) => r.top));
      const bottom = Math.max(...imgs.map((r) => r.bottom));
      return {
        roznicaPoziom: Math.abs(left - p.left - (p.right - right)),
        roznicaPion: Math.abs(top - p.top - (p.bottom - bottom)),
        odstep: imgs[1]!.left - imgs[0]!.right,
      };
    });
    expect(paraMarginesy.roznicaPoziom).toBeLessThanOrEqual(4);
    expect(paraMarginesy.roznicaPion).toBeLessThanOrEqual(4);
    expect(paraMarginesy.odstep).toBeGreaterThanOrEqual(10);

    // Pojedyncza miniatura również jest wyśrodkowana (różnica marginesów ≤ 4 px).
    const soloMarginesy = await kafelekJednostronny.locator('.riso-podglad').evaluate((podglad) => {
      const p = podglad.getBoundingClientRect();
      const r = podglad.querySelector('img')!.getBoundingClientRect();
      return {
        roznicaPoziom: Math.abs(r.left - p.left - (p.right - r.right)),
        roznicaPion: Math.abs(r.top - p.top - (p.bottom - r.bottom)),
      };
    });
    expect(soloMarginesy.roznicaPoziom).toBeLessThanOrEqual(4);
    expect(soloMarginesy.roznicaPion).toBeLessThanOrEqual(4);
  });
});
