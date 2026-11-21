import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { otworzUstawieniaAplikacji } from './pomoc';

/**
 * Kuratorowana galeria szablonów online i import z linku URL (M5-3):
 * filtrowanie, wyszukiwanie, podgląd awers+rewers z silnika, zapis do biblioteki,
 * pobranie projektu i dalsza praca w trybie offline oraz import z URL (PL/EN + ciemny motyw).
 */

test('galeria online: filtry, podgląd awers+rewers, zapis do biblioteki, pobranie i tryb offline', async ({
  page,
  context,
}) => {
  // Startujemy ze strony głównej, żeby wczytać moduł listy projektów przed testem offline.
  await page.goto('./#/');
  await page.getByRole('link', { name: /Stwórz własne karty/ }).click();

  const sekcja = page.locator('.galeria-online');
  await expect(
    sekcja.getByRole('heading', { level: 2, name: /Galeria szablonów online/ }),
  ).toBeVisible();
  await expect(sekcja.locator('[data-galeria-szablon]')).toHaveCount(5);

  // Informacja o autorze i licencji jest widoczna na karcie szablonu.
  const przedmiot = sekcja.locator('[data-galeria-szablon="przedmiot-z-rewersem"]');
  await expect(przedmiot).toContainText('Licencja: MIT');
  await expect(przedmiot).toContainText('z rewersem');

  // Podgląd z silnika renderuje zarówno awers, jak i rewers (SVG z konturami glifów).
  await przedmiot.getByRole('button', { name: 'Podgląd' }).click();
  await expect(przedmiot.locator('.galeria-podglad-svg svg')).toHaveCount(2, { timeout: 15000 });
  await expect(
    przedmiot.locator('.galeria-podglad-svg svg').nth(1).locator('path').first(),
  ).toBeAttached();
  await expect(przedmiot).toContainText('Awers');
  await expect(przedmiot).toContainText('Rewers');

  // Zapis do lokalnej biblioteki szablonów aktualizuje listę na żywo.
  await przedmiot.getByRole('button', { name: 'Do biblioteki' }).click();
  await expect(sekcja.getByRole('status')).toContainText(
    'Zapisano „Karta przedmiotu (z rewersem)”',
  );
  const biblioteka = page.locator('.biblioteka-globalna');
  await biblioteka.locator('summary').click();
  await expect(biblioteka).toContainText('Karta przedmiotu (z rewersem)');

  // Filtrowanie po frazie i przełączniku „Tylko z rewersem”.
  await sekcja.getByLabel('Szukaj szablonu').fill('tarot');
  await expect(sekcja.locator('[data-galeria-szablon]')).toHaveCount(1);
  await expect(sekcja.locator('[data-galeria-szablon="postac-tarot"]')).toBeVisible();

  await sekcja.getByLabel('Szukaj szablonu').fill('');
  await sekcja.getByLabel('Tylko z rewersem').check();
  await expect(sekcja.locator('[data-galeria-szablon]')).toHaveCount(3);
  await sekcja.getByLabel('Tylko z rewersem').uncheck();

  // Pobranie i utworzenie projektu jednym kliknięciem.
  await przedmiot.getByRole('button', { name: 'Użyj szablonu' }).click();
  await expect(page).toHaveURL(/#\/projekt\//, { timeout: 15000 });
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });

  // Zapisany projekt działa lokalnie w IndexedDB po przełączeniu w tryb offline (zero zapytań sieciowych).
  await context.setOffline(true);
  expect(await page.evaluate(() => navigator.onLine)).toBe(false);
  await page.getByRole('link', { name: 'Karty RPG' }).click();
  await expect(page.locator('.kafelek-projektu').first()).toContainText('Karta przedmiotu');
  await expect(
    page.locator('.kafelek-projektu').filter({ hasText: 'Rewers przedmiotu' }),
  ).toHaveCount(1);
  await page.locator('.kafelek-projektu').first().click();
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
  await context.setOffline(false);
});

test('import szablonu z linku URL (walidacja, błąd HTTP, poprawna paczka) oraz EN + ciemny motyw', async ({
  page,
}) => {
  const paczkaBajty = readFileSync(resolve('public/galeria/zdarzenie-poziome.kartyrpg-szablon'));

  await page.route('https://szablony.example/**', async (route) => {
    const url = route.request().url();
    if (url.endsWith('brak.kartyrpg-szablon')) {
      await route.fulfill({ status: 404, body: 'not found' });
      return;
    }
    if (url.endsWith('zepsuty.kartyrpg-szablon')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/zip',
        body: 'to-nie-jest-zip',
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/zip',
      body: paczkaBajty,
    });
  });

  await page.goto('./#/wlasne');
  const sekcja = page.locator('.galeria-online');
  const poleUrl = sekcja.getByLabel('Adres URL pliku .kartyrpg-szablon');
  const przyciskUrl = sekcja.getByRole('button', { name: 'Pobierz i utwórz projekt' });

  // Niebezpieczny schemat odrzucony przed zapytaniem sieciowym.
  await poleUrl.fill('javascript:alert(1)');
  await przyciskUrl.click();
  await expect(sekcja.getByRole('alert')).toContainText('https://');

  // Błąd HTTP 404 pokazuje czytelny komunikat.
  await poleUrl.fill('https://szablony.example/brak.kartyrpg-szablon');
  await przyciskUrl.click();
  await expect(sekcja.getByRole('alert')).toContainText('404');

  // Uszkodzony plik odrzucony przed zapisem do bazy.
  await poleUrl.fill('https://szablony.example/zepsuty.kartyrpg-szablon');
  await przyciskUrl.click();
  await expect(sekcja.getByRole('alert')).toBeVisible();

  // Przełączenie na angielski i ciemny motyw.
  const menuUst = await otworzUstawieniaAplikacji(page);
  await menuUst.getByRole('button', { name: 'EN', exact: true }).click();
  await menuUst.getByRole('button', { name: /Dark theme|Motyw ciemny/i }).click();
  await page.keyboard.press('Escape');
  await expect(
    sekcja.getByRole('heading', { level: 2, name: /Online template gallery/ }),
  ).toBeVisible();
  await expect(sekcja.locator('[data-galeria-szablon="przedmiot-z-rewersem"]')).toContainText(
    'Item card (with back)',
  );

  // Poprawna paczka z URL otwiera nowy projekt w edytorze.
  await sekcja
    .getByLabel('URL of a .kartyrpg-szablon file')
    .fill('https://szablony.example/zdarzenie.kartyrpg-szablon');
  await sekcja.getByRole('button', { name: 'Download and create project' }).click();
  await expect(page).toHaveURL(/#\/projekt\//, { timeout: 15000 });
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
});
