import { expect, test } from '@playwright/test';
import { plikSzablonu } from './kartkaUI';

test.describe('Plan S (S5) – Projekt: Karty → Druk, Z Moich szablonów, tył i Przenieś na szablon', () => {
  test.use({ viewport: { width: 1440, height: 960 } });

  test('dodanie karty z Moich szablonów, zmiana tyłu karty i przeniesienie kart z „Cofnij”', async ({
    page,
  }) => {
    // 1) Przygotuj 2 przody („Czar (test)” i „Broń”) oraz 1 samodzielny tył („Rewers S5”) w Moich szablonach.
    await page.goto('./');

    // Przód 1: import „Czar (test)”
    await page.getByTestId('start-nowy-szablon').click();
    let oknoSz = page.getByTestId('okno-nowy-szablon');
    await oknoSz.getByRole('button', { name: /Import pliku/ }).click();
    await oknoSz.getByTestId('ns-plik-szablonu').setInputFiles(plikSzablonu());
    await oknoSz.getByRole('button', { name: 'Utwórz szablon' }).click();
    await expect(page).toHaveURL(/#\/szablon\/[^/]+$/, { timeout: 15000 });
    await page.getByRole('link', { name: '← Szablony' }).click();

    // Przód 2: „Broń” (z polem Tekst o nazwie jak w Czar albo własnym)
    await page.getByTestId('start-nowy-szablon').click();
    oknoSz = page.getByTestId('okno-nowy-szablon');
    await oknoSz.getByLabel('Nazwa szablonu').fill('Broń');
    await oknoSz.getByRole('button', { name: 'Utwórz szablon' }).click();
    await expect(page).toHaveURL(/#\/szablon\/[^/]+$/, { timeout: 15000 });
    await page
      .getByRole('navigation', { name: 'Dodaj element' })
      .getByRole('button', { name: 'Tekst', exact: true })
      .click();
    await page
      .locator('header.ui2-naglowek')
      .getByRole('button', { name: 'Zapisz', exact: true })
      .click();
    await expect(page.locator('header.ui2-naglowek')).toContainText(/zapisano/i);
    await page.getByRole('link', { name: '← Szablony' }).click();

    // Samodzielny tył: „Rewers S5”
    await page.getByTestId('start-nowy-szablon').click();
    oknoSz = page.getByTestId('okno-nowy-szablon');
    await oknoSz.getByLabel('Nazwa szablonu').fill('Rewers S5');
    await oknoSz.getByRole('button', { name: /Tył \(rewers\)/ }).click();
    await oknoSz.getByRole('button', { name: /Przód \(awers\)/ }).click();
    await oknoSz.getByRole('button', { name: 'Utwórz szablon' }).click();
    await expect(page).toHaveURL(/#\/szablon\/[^/]+$/, { timeout: 15000 });
    await page.getByRole('link', { name: '← Szablony' }).click();

    // 2) Utwórz projekt wybierając TYLKO „Czar (test)” (żeby „Broń” była w „Z Moich szablonów”).
    await page.getByTestId('start-nowe-karty').click();
    const oknoPr = page.getByTestId('okno-nowy-projekt');
    await oknoPr.getByLabel('Nazwa projektu').fill('Kampania S5');
    await oknoPr
      .getByTestId('np-lista-szablonow')
      .getByRole('button', { name: /Czar \(test\)/ })
      .click();
    await oknoPr.getByRole('button', { name: 'Utwórz projekt' }).click();
    await expect(page).toHaveURL(/#\/projekt\/[^/]+\/karty$/, { timeout: 15000 });

    // Kroki w nagłówku: wyłącznie 1 Karty → 2 Druk (bez kroku Szablony).
    const kroki = page.getByRole('navigation', { name: 'Etapy projektu' });
    await expect(kroki).toContainText('1');
    await expect(kroki).toContainText('Karty');
    await expect(kroki).toContainText('2');
    await expect(kroki).toContainText('Druk');
    await expect(kroki).not.toContainText('Szablony');

    // Lewy pasek ma dwie grupy: „W projekcie” (Czar) i „Z Moich szablonów” (Broń).
    const lewy = page.getByRole('navigation', { name: 'Dodaj karty' });
    await expect(lewy.locator('[data-grupa="w-projekcie"]')).toContainText('Czar (test)');
    await expect(lewy.locator('[data-grupa="moje-szablony"]')).toContainText('Broń');

    // 3) Kliknij „Broń” w grupie „Z Moich szablonów” → kopiuje szablon do projektu i dodaje kartę.
    await lewy
      .locator('[data-grupa="moje-szablony"]')
      .getByRole('button', { name: 'Broń' })
      .click();
    await expect(page.getByTestId('kafelek-karty')).toHaveCount(1);
    await expect(lewy.locator('[data-grupa="w-projekcie"]')).toContainText('Broń');

    // Panel karty pokazuje „Edytuj w Moich szablonach ↗” (link do #/szablon/<id>?powrot=...).
    const panelPrawy = page.getByRole('complementary', { name: 'Karta' });
    const linkEdytuj = panelPrawy.getByRole('link', { name: /Edytuj w Moich szablonach/ });
    await expect(linkEdytuj).toBeVisible();
    await expect(linkEdytuj).toHaveAttribute('href', /#\/szablon\/.+\?powrot=/);

    // 4) Zmień tył karty na „Rewers S5” z grupy „Z Moich szablonów”.
    const wyborTylu = page.getByTestId('wybor-tylu-karty');
    await wyborTylu.selectOption({ label: 'Rewers S5' });
    await expect(panelPrawy.locator('.karty-ui2-podglad-tyl svg')).toBeVisible();

    // 5) „Przenieś na szablon…” przenosi kartę na „Czar (test)”, pokazuje listę pól i pasek „Cofnij”.
    await page.getByTestId('przenies-na-szablon-btn').click();
    const oknoPrzenies = page.getByRole('dialog');
    await expect(oknoPrzenies).toBeVisible();
    await oknoPrzenies
      .getByTestId('przenies-wybor-szablonu')
      .selectOption({ label: 'Czar (test)' });
    await expect(oknoPrzenies).not.toContainText('[object Object]');
    await expect(oknoPrzenies.locator('.karty-ui2-dopasowanie')).toBeVisible();
    await oknoPrzenies.getByTestId('przenies-zatwierdz').click();

    await expect(oknoPrzenies).toBeHidden();
    await expect(panelPrawy).toContainText('Czar (test)');
    const pasek = page.getByTestId('pasek-komunikatu');
    await expect(pasek).toBeVisible();

    // Kliknięcie „Cofnij” przywraca kartę z powrotem na szablon „Broń”.
    await pasek.getByRole('button', { name: 'Cofnij' }).click();
    await expect(panelPrawy).toContainText('Broń');
  });
});
