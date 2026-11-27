import { expect, test } from '@playwright/test';
import { plikSzablonu } from './kartkaUI';

test.describe('Plan S (S4) – Edytor szablonu poza projektem (#/szablon/<id>)', () => {
  test.use({ viewport: { width: 1440, height: 960 } });

  test('edycja szablonu w Moich szablonach nie zmienia karty w projekcie, dopóki nie „Aktualizuj”', async ({
    page,
  }) => {
    // 1) Import szablonu „Czar (test)” do Moich szablonów → otwiera się #/szablon/<id>.
    await page.goto('./');
    await page.getByTestId('start-nowy-szablon').click();
    const oknoSz = page.getByTestId('okno-nowy-szablon');
    await oknoSz.getByRole('button', { name: /Import pliku/ }).click();
    await oknoSz.getByTestId('ns-plik-szablonu').setInputFiles(plikSzablonu());
    await oknoSz.getByRole('button', { name: 'Utwórz szablon' }).click();

    await expect(page).toHaveURL(/#\/szablon\/[^/]+$/, { timeout: 15000 });

    // Nagłówek: „← Szablony”, nazwa szablonu, bez mapy kroków (sekcja 5.4).
    const naglowek = page.locator('.ui2-naglowek');
    await expect(naglowek.getByRole('link', { name: '← Szablony' })).toBeVisible();
    await expect(naglowek.locator('.ui2-kroki')).toHaveCount(0);
    await expect(naglowek.locator('input.nazwa-projektu')).toHaveValue('Czar (test)');

    // Pasek nad kartą: bez zakładek wielu szablonów i bez „＋ Nowy szablon”, jest „Szablon ▾” i „brak tyłu”.
    await expect(page.locator('.edytor-ui2-zakladka')).toHaveCount(0);
    await expect(page.locator('.edytor-ui2-brak-tylu')).toBeVisible();
    await page.getByTestId('menu-szablon-przycisk').click();
    const menu = page.getByTestId('menu-szablon');
    await expect(menu.getByRole('menuitem', { name: 'Duplikuj szablon' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Eksport do pliku' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Importuj (zastąp)…' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Układ ze zdjęcia (AI)…' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Zmień rozmiar karty…' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Usuń szablon' })).toBeVisible();
    await page.keyboard.press('Escape');

    // 2) Wróć do Startu i utwórz projekt z tego szablonu + dodaj kartę.
    await naglowek.getByRole('link', { name: '← Szablony' }).click();
    await page.getByTestId('start-nowe-karty').click();
    const oknoPr = page.getByTestId('okno-nowy-projekt');
    await oknoPr.getByLabel('Nazwa projektu').fill('Projekt S4');
    await oknoPr.getByTestId('np-lista-szablonow').locator('button').first().click();
    await oknoPr.getByRole('button', { name: 'Utwórz projekt' }).click();

    await expect(page).toHaveURL(/#\/projekt\/[^/]+\/karty$/, { timeout: 15000 });
    const urlProjektu = page.url();

    // Dodaj jedną kartę i zapisz projekt.
    await page
      .getByRole('navigation', { name: /Dodaj karty/i })
      .getByRole('button', { name: /Czar \(test\)/ })
      .click();
    await expect(page.locator('.karty-ui2-kafelek')).toHaveCount(1);
    await page.keyboard.press('Control+s');
    await expect(page.locator('.ui2-naglowek')).toContainText('Zapisano');

    // 3) Wróć na Start → Moje szablony → Edytuj szablon „Czar (test)”.
    await page.goto('./#/');
    await page.getByRole('tab', { name: /^Szablony/ }).click();
    await page
      .getByTestId('kafelek-szablonu')
      .filter({ hasText: 'Czar (test)' })
      .getByRole('link', { name: 'Edytuj' })
      .click();
    await expect(page).toHaveURL(/#\/szablon\/[^/]+$/, { timeout: 15000 });

    // Dopisek o kopiach w projektach (sekcja 5.4).
    await expect(page.getByTestId('naglowek-dopisek-kopii')).toContainText(
      'Kopia w 1 projekcie – zmiany nie zmienią jej, dopóki jej nie zaktualizujesz',
    );

    // Zmień szablon (dodaj nowe pole tekstowe) i zapisz.
    await page
      .getByRole('button', { name: /Pole tekstowe/i })
      .first()
      .click();
    await page.keyboard.press('Control+s');
    await expect(page.locator('.ui2-naglowek')).toContainText('Zapisano');

    // 4) Wróć do projektu: karta NIE zmieniła się automatycznie, a w nagłówku pojawił się baner aktualizacji.
    await page.goto(urlProjektu);
    await expect(page.locator('.karty-ui2-kafelek')).toHaveCount(1);
    const baner = page.getByTestId('baner-aktualizacji-szablonu');
    await expect(baner).toBeVisible({ timeout: 10000 });
    await expect(baner).toContainText('Jest nowsza wersja szablonu');

    // Kliknij „Aktualizuj karty (1)” → otwiera się okno z podglądem Przed/Po; potwierdź.
    await baner.getByRole('button', { name: /Aktualizuj karty \(1\)/ }).click();
    const oknoAkt = page.getByTestId('okno-aktualizacji-szablonu');
    await expect(oknoAkt).toBeVisible();
    await oknoAkt.getByRole('button', { name: /Aktualizuj/ }).click();

    await expect(oknoAkt).toBeHidden();
    await expect(baner).toHaveCount(0);
    await expect(page.getByTestId('pasek-komunikatu')).toBeVisible();
  });

  test('+ Dodaj tył, przełącznik Przód | Tył oraz Usuń szablon z potwierdzeniem', async ({
    page,
  }) => {
    await page.goto('./');
    await page.getByTestId('start-nowy-szablon').click();
    const oknoSz = page.getByTestId('okno-nowy-szablon');
    await oknoSz.getByLabel('Nazwa szablonu').fill('Szablon z tyłem');
    await oknoSz.getByRole('button', { name: 'Utwórz szablon' }).click();
    await expect(page).toHaveURL(/#\/szablon\/[^/]+$/, { timeout: 15000 });

    // Najpierw brak tyłu → kliknięcie „+ Dodaj tył” tworzy tył i przechodzi do jego edycji.
    await expect(page.locator('.edytor-ui2-brak-tylu')).toBeVisible();
    await page.getByRole('button', { name: '+ Dodaj tył' }).click();
    await expect(page).toHaveURL(/#\/szablon\/[^/]+$/, { timeout: 15000 });

    // Przełącznik Przód | Tył pozwala wrócić na Przód.
    const przelacznik = page.getByRole('tablist', { name: /Strona karty/i });
    await expect(przelacznik.getByRole('tab', { name: 'Tył' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await przelacznik.getByRole('tab', { name: 'Przód' }).click();
    await expect(przelacznik.getByRole('tab', { name: 'Przód' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Menu Szablon ▾ → Usuń szablon pokazuje okno potwierdzenia i wraca do Moich szablonów.
    await page.getByTestId('menu-szablon-przycisk').click();
    await page.getByTestId('menu-szablon').getByRole('menuitem', { name: 'Usuń szablon' }).click();
    const oknoUsun = page.getByRole('dialog');
    await expect(oknoUsun).toContainText('Usunąć szablon');
    await oknoUsun.getByRole('button', { name: 'Usuń szablon' }).click();
    await expect(page).toHaveURL(/#\/$/, { timeout: 15000 });
  });
});
