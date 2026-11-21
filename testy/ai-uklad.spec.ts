import { expect, test } from '@playwright/test';
import { ADRES_CLAUDE_API, KLUCZ_STORAGE_AI } from '../src/dane/aiUklad';
import { otworzUstawieniaAplikacji } from './pomoc';

/**
 * M5-2: rozpoznawanie układu karty ze zdjęcia przez Claude API (zapisana odpowiedź offline):
 * obsługa błędu 401, lokalny zapis/usunięcie klucza w localStorage, podgląd SVG, otwarcie w edytorze
 * z rozpoznanymi polami i podkładem oraz PL/EN + ciemny motyw.
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

test('układ ze zdjęcia (AI): błąd klucza, rozpoznanie z zapisanej odpowiedzi, podgląd SVG, edytor i PL/EN + ciemny motyw', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./#/wlasne');
  await page.getByRole('link', { name: /Układ ze zdjęcia \(AI\)/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Układ karty ze zdjęcia (AI)' }),
  ).toBeVisible();

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

  // Wpisz klucz (zapis lokalny), wgraj zdjęcie testowe i przetestuj błąd 401.
  await page.getByLabel('Klucz Claude API').fill('sk-ant-test-local');
  await page.getByLabel('Zapamiętaj klucz w tej przeglądarce').check();
  await page.getByTestId('plik-zdjecia-ai').setInputFiles('testy/zasoby/podklad-testowy.png');
  await page.getByRole('button', { name: 'Rozpoznaj układ' }).click();
  await expect(page.getByRole('alert')).toContainText(/401\/403/);
  expect(await page.evaluate((k) => localStorage.getItem(k), KLUCZ_STORAGE_AI)).toBe(
    'sk-ant-test-local',
  );

  // Poprawna odpowiedź AI → podgląd SVG z 4 rozpoznanymi polami.
  statusApi = 200;
  await page.getByRole('button', { name: 'Rozpoznaj układ' }).click();
  await expect(page.getByRole('heading', { name: 'Rozpoznany układ (4 pola)' })).toBeVisible();
  await expect(page.getByTestId('podglad-szablonu-ai').locator('svg')).toBeVisible();

  // EN + ciemny motyw przed otwarciem edytora oraz usunięcie zapisanego klucza.
  const menuUst = await otworzUstawieniaAplikacji(page);
  await menuUst
    .getByRole('group', { name: /^(Język|Language)$/ })
    .getByRole('button', { name: 'EN', exact: true })
    .click();
  await menuUst.getByRole('button', { name: /Dark theme|Motyw ciemny/ }).click();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Card layout from photo (AI)' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Remove saved key' }).click();
  expect(await page.evaluate((k) => localStorage.getItem(k), KLUCZ_STORAGE_AI)).toBeNull();

  // Otwórz rozpoznany układ w edytorze szablonu – pola są widoczne w drzewie i edytowalne.
  await page.getByRole('button', { name: 'Open in template editor' }).click();
  const drzewo = page.getByRole('tree', { name: 'Card structure' });
  await expect(drzewo).toBeVisible({ timeout: 15000 });
  await expect(drzewo.getByRole('treeitem', { name: /^Tytuł/ })).toBeVisible();
  await expect(drzewo.getByRole('treeitem', { name: /^Ilustracja/ })).toBeVisible();
  await expect(drzewo.getByRole('treeitem', { name: /^Opis/ })).toBeVisible();
});
