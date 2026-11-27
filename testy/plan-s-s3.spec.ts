import { expect, test } from '@playwright/test';
import { plikSzablonu } from './kartkaUI';

test.describe('Plan S (S3) – Moje szablony, Nowy szablon i Nowy projekt', () => {
  test.use({ viewport: { width: 1440, height: 960 } });

  test('utworzenie szablonu w Moich szablonach i projektu z wybranych szablonów', async ({
    page,
  }) => {
    await page.goto('./');

    // Lewa kolumna: + NOWE KARTY, + NOWY SZABLON, Mausritter A4 (sekcja 5.1).
    const lewa = page.locator('aside.riso-lewa');
    await expect(lewa.getByTestId('start-nowe-karty')).toBeVisible();
    await expect(lewa.getByTestId('start-nowy-szablon')).toBeVisible();
    await expect(lewa.getByTestId('start-mausritter')).toBeVisible();

    // Gdy Moje szablony są puste, Nowy projekt podpowiada „+ Nowy szablon”.
    await lewa.getByTestId('start-nowe-karty').click();
    const oknoProjekt = page.getByTestId('okno-nowy-projekt');
    await expect(oknoProjekt).toBeVisible();
    await oknoProjekt.getByRole('button', { name: '+ Nowy szablon' }).click();

    // 1) Tworzymy szablon „Zaklęcie” (przód + tył, Poziomo 88×63 mm).
    const oknoSzablon = page.getByTestId('okno-nowy-szablon');
    await expect(oknoSzablon).toBeVisible();
    await oknoSzablon.getByLabel('Nazwa szablonu').fill('Zaklęcie');
    await oknoSzablon.getByRole('button', { name: 'Poziomo' }).click();
    await expect(oknoSzablon.getByRole('button', { name: /Poker/ })).toContainText('88×63');
    await oknoSzablon.getByRole('button', { name: /Tył \(rewers\)/ }).click();
    await oknoSzablon.getByRole('button', { name: 'Utwórz szablon' }).click();

    // Automatycznie przełącza na zakładkę Moje szablony i pokazuje nowy szablon (+ przypięty tył).
    await expect(page.getByRole('tab', { name: /Moje szablony/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const kafelkiSzablonow = page.getByTestId('kafelek-szablonu');
    await expect(kafelkiSzablonow).toHaveCount(2, { timeout: 10000 });
    await expect(kafelkiSzablonow.filter({ hasText: 'Zaklęcie' }).first()).toContainText('88×63');
    await expect(kafelkiSzablonow.filter({ hasText: 'Zaklęcie' }).first()).toContainText(
      'nieużywany',
    );

    // 2) Import drugiego szablonu z pliku `.kartyrpg-szablon`.
    await lewa.getByTestId('start-nowy-szablon').click();
    await oknoSzablon.getByRole('button', { name: /Import pliku/ }).click();
    await oknoSzablon.getByTestId('ns-plik-szablonu').setInputFiles(plikSzablonu());
    await oknoSzablon.getByRole('button', { name: 'Utwórz szablon' }).click();
    await expect(kafelkiSzablonow).toHaveCount(3, { timeout: 10000 });

    // 3) Duplikuj i Usuń z „Cofnij” w Moich szablonach.
    const kafelekZaklecie = kafelkiSzablonow.filter({ hasText: /^.*Zaklęcie/ }).first();
    await kafelekZaklecie.getByRole('button', { name: 'Duplikuj' }).click();
    await expect(kafelkiSzablonow).toHaveCount(4, { timeout: 10000 });
    await kafelkiSzablonow
      .filter({ hasText: 'Zaklęcie (2)' })
      .getByRole('button', { name: 'Usuń' })
      .click();
    await expect(kafelkiSzablonow).toHaveCount(3, { timeout: 10000 });
    await expect(page.getByTestId('pasek-komunikatu')).toBeVisible();
    await page.getByTestId('pasek-komunikatu').getByRole('button', { name: 'Cofnij' }).click();
    await expect(kafelkiSzablonow).toHaveCount(4, { timeout: 10000 });

    // 4) Tworzenie projektu z 2 wybranych szablonów w oknie „Nowy projekt”.
    await lewa.getByTestId('start-nowe-karty').click();
    await expect(oknoProjekt).toBeVisible();
    await oknoProjekt.getByLabel('Nazwa projektu').fill('Talia testowa S3');
    const listaWyboru = oknoProjekt.getByTestId('np-lista-szablonow');
    await expect(listaWyboru.locator('button')).toHaveCount(3);
    await listaWyboru
      .getByRole('button', { name: /Zaklęcie/ })
      .first()
      .click();
    await listaWyboru.getByRole('button', { name: /Czar/i }).first().click();
    await expect(oknoProjekt).toContainText('Wybrano szablonów: 2');
    await oknoProjekt.getByRole('button', { name: 'Utwórz projekt' }).click();

    // Otwiera się krok Karty z kopiami obu wybranych szablonów w lewym pasku.
    await expect(page).toHaveURL(/#\/projekt\/[^/]+\/karty$/, { timeout: 15000 });
    const lewyPasek = page.getByRole('navigation', { name: /Dodaj karty/i });
    await expect(lewyPasek).toContainText('Zaklęcie');
    await expect(lewyPasek).toContainText('Czar');

    // Powrót na start: przy szablonach widać „kopia w 1 projekcie”.
    await page.goto('./#/');
    await page.getByRole('tab', { name: /Moje szablony/ }).click();
    await expect(
      page.getByTestId('kafelek-szablonu').filter({ hasText: 'Czar' }).first(),
    ).toContainText('kopia w 1 projekcie');
  });
});
