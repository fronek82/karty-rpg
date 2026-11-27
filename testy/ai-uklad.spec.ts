import { expect, test } from '@playwright/test';
import { ADRES_CLAUDE_API, KLUCZ_STORAGE_AI } from '../src/dane/aiUklad';
import { otworzUstawieniaAplikacji } from './pomoc';
import { drzewo, kreator } from './szablonUI';

/**
 * M5-2 / N7: układ ze zdjęcia przez Claude API (zapisana odpowiedź offline) w Edytorze szablonu:
 * błąd 401, lokalny zapis/usunięcie klucza w localStorage, podgląd SVG, „Dodaj obok” / „Zastąp
 * elementy”, podkład ze zdjęcia oraz EN.
 */

const ODPOWIEDZ_AI = {
  nazwa: 'Karta terenowa AI',
  tlo: '#fbf6ea',
  promienRogowMm: 3,
  ramka: { styl: 'ciagla', kolor: '#1e3a5f', gruboscMm: 0.45, odsuniecieMm: 2 },
  pola: [
    {
      typ: 'tekst',
      nazwa: 'Tytuł',
      xPct: 6,
      yPct: 5,
      szerPct: 88,
      wysPct: 12,
      rozmiarPt: 13,
      wariant: 'pogrubiony',
      wyrownanie: 'srodek',
      kolor: '#1e3a5f',
    },
    { typ: 'obraz', nazwa: 'Ilustracja', xPct: 8, yPct: 20, szerPct: 84, wysPct: 36 },
    { typ: 'separator', xPct: 8, yPct: 59, szerPct: 84, wysPct: 1, kolor: '#1e3a5f' },
    { typ: 'tekst', nazwa: 'Opis', xPct: 8, yPct: 63, szerPct: 84, wysPct: 30, rozmiarPt: 9 },
  ],
};

test('układ ze zdjęcia (AI) w edytorze szablonu: błąd klucza, podgląd, zastąp / dodaj obok, podkład i EN', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await kreator(page, { nazwa: 'Karta AI', format: 'Standard / Poker', uklad: 'Tytuł i opis' });
  const liczbaPrzed = await drzewo(page).getByRole('treeitem').count();

  let statusApi = 401;
  await page.route(ADRES_CLAUDE_API, async (route) => {
    const naglowki = route.request().headers();
    expect(naglowki['anthropic-dangerous-direct-browser-access']).toBe('true');
    if (statusApi !== 200) {
      await route.fulfill({ status: statusApi, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [{ type: 'text', text: JSON.stringify(ODPOWIEDZ_AI) }],
      }),
    });
  });

  // Pozycja w menu „Szablon ▾” otwiera okno AI.
  await page.getByTestId('menu-szablon-przycisk').click();
  await page
    .getByTestId('menu-szablon')
    .getByRole('menuitem', { name: /Układ ze zdjęcia/ })
    .click();
  const okno = page.getByRole('dialog', { name: 'Układ ze zdjęcia (AI)' });
  await expect(okno).toBeVisible();
  await okno.getByLabel('Klucz Claude API').fill('sk-ant-test-local');
  await okno.getByLabel('Zapamiętaj klucz w tej przeglądarce').check();
  await okno.getByTestId('plik-zdjecia-ai').setInputFiles('testy/zasoby/podklad-testowy.png');
  await expect(okno.locator('.ai-miniatura-zdjecia img')).toBeVisible();
  await okno.getByRole('button', { name: 'Rozpoznaj układ' }).click();
  await expect(okno.getByRole('alert')).toContainText(/401\/403/);
  expect(await page.evaluate((k) => localStorage.getItem(k), KLUCZ_STORAGE_AI)).toBe(
    'sk-ant-test-local',
  );

  // Poprawna odpowiedź → podgląd i pytanie (strona ma już elementy): „Dodaj obok”.
  statusApi = 200;
  await okno.getByRole('button', { name: 'Rozpoznaj układ' }).click();
  await expect(okno.getByRole('heading', { name: 'Rozpoznany układ (4 pola)' })).toBeVisible();
  await expect(okno.getByTestId('podglad-szablonu-ai').locator('svg')).toBeVisible();
  await expect(okno.getByText('Ta strona ma już elementy.', { exact: false })).toBeVisible();
  await okno.getByRole('button', { name: 'Dodaj obok' }).click();
  await expect(okno).toBeHidden();
  await expect(drzewo(page).getByRole('treeitem', { name: /^Ilustracja/ })).toBeVisible();
  // Korzeń „Tytuł i opis” to kolumna: dawny układ trafia do kontenera na całą kartę (+1) obok 4 pól.
  await expect(drzewo(page).getByRole('treeitem')).toHaveCount(liczbaPrzed + 5);
  // Zdjęcie jako podkład (domyślnie zaznaczone).
  await expect(page.getByTestId('podklad-podgladu')).toBeVisible();

  // „Zastąp elementy”: zostają tylko rozpoznane pola (korzeń + 4).
  await page.getByTestId('menu-szablon-przycisk').click();
  await page
    .getByTestId('menu-szablon')
    .getByRole('menuitem', { name: /Układ ze zdjęcia/ })
    .click();
  await okno.getByTestId('plik-zdjecia-ai').setInputFiles('testy/zasoby/podklad-testowy.png');
  await okno.getByRole('button', { name: 'Rozpoznaj układ' }).click();
  await okno.getByRole('button', { name: 'Zastąp elementy' }).click();
  await expect(drzewo(page).getByRole('treeitem')).toHaveCount(5);
  await expect(drzewo(page).getByRole('treeitem', { name: /^Opis/ })).toBeVisible();

  // EN: przycisk i okno po angielsku, usunięcie zapisanego klucza.
  const menuUst = await otworzUstawieniaAplikacji(page);
  await menuUst
    .getByRole('group', { name: /^(Język|Language)$/ })
    .getByRole('button', { name: 'EN', exact: true })
    .click();
  await page.keyboard.press('Escape');
  await page.getByTestId('menu-szablon-przycisk').click();
  await page
    .getByTestId('menu-szablon')
    .getByRole('menuitem', { name: /Layout from photo/ })
    .click();
  const oknoEn = page.getByRole('dialog', { name: 'Layout from photo (AI)' });
  await oknoEn.getByRole('button', { name: 'Remove saved key' }).click();
  expect(await page.evaluate((k) => localStorage.getItem(k), KLUCZ_STORAGE_AI)).toBeNull();
});
