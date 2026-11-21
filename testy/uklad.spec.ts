import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { unzipSync } from 'fflate';
import { kartkaCzaru } from './kartkaUI';
import { nowaPustaKartka, slot } from './pomoc';

/** M2-6: własny układ arkusza, „Moje układy”, kalibracja, wydruk testowy, eksport obrazów. */

test.use({ viewport: { width: 1440, height: 1100 } });
test.setTimeout(120_000);

/** Wymiary obrazu PNG z nagłówka IHDR. */
const wymiaryPng = (b: Uint8Array) => {
  const v = new DataView(b.buffer, b.byteOffset);
  return [v.getUint32(16), v.getUint32(20)];
};

test('diagram wymiarów pokazuje całą siatkę i prowadzi do edycji pola', async ({ page }) => {
  const ust = await kartkaCzaru(page);
  await ust.getByLabel('Układ kart na kartce').selectOption('wlasny');
  await ust.getByLabel('Margines lewy (mm)').fill('5');
  await ust.getByLabel('Margines górny (mm)').fill('10');
  await ust.getByLabel('Odstęp poziomy (mm)').fill('3');
  await ust.getByLabel('Odstęp pionowy (mm)').fill('4');
  await expect(ust).toContainText('prawy margines 10 mm · dolny 15 mm');
  const strona = page.locator('.strona-kartki .svg-strony').first();
  const scenaPrzed = await strona.innerHTML();
  const podglad = ust.locator('.podglad-wymiarow');
  await ust.getByText('Podgląd wymiarów', { exact: true }).click();
  await expect(podglad).toContainText('Siatka 3 × 3 · 195 × 272 mm');
  const wymiar = (etykieta: string) => podglad.locator('dl > div').filter({ hasText: etykieta });
  await expect(wymiar('Szerokość papieru')).toContainText('210 mm');
  await expect(wymiar('Wysokość papieru')).toContainText('297 mm');
  await expect(wymiar('Margines prawy')).toContainText('10 mm');
  await expect(wymiar('Margines dolny')).toContainText('15 mm');
  await expect(wymiar('Margines prawy').getByRole('button')).toHaveCount(0);
  expect(await strona.innerHTML()).toBe(scenaPrzed);

  const lewyMargines = ust.getByLabel('Margines lewy (mm)');
  await podglad
    .getByRole('button', { name: 'Margines lewy, 5 mm. Przejdź do pola.' })
    .press('Enter');
  await expect(lewyMargines).toBeFocused();
  await podglad.locator('svg text').filter({ hasText: /^4$/ }).click();
  await expect(ust.getByLabel('Odstęp pionowy (mm)')).toBeFocused();
  await ust.getByLabel('Odstęp poziomy (mm)').fill('5');
  await expect(podglad).toContainText('Siatka 3 × 3 · 199 × 272 mm');
  await expect(wymiar('Margines prawy')).toContainText('6 mm');
  await ust.getByLabel('Nazwa układu').fill('Siatka z odstępami');
  await ust.getByRole('button', { name: 'Zapisz jako mój układ' }).click();
  await expect(ust).toContainText('Zapisano układ „Siatka z odstępami”');

  await ust.getByLabel('Kolumny').fill('4');
  await expect(
    ust.getByRole('alert').filter({ hasText: 'Siatka wychodzi poza papier' }),
  ).toBeVisible();
  await expect(wymiar('Margines prawy')).toContainText('-62 mm');
  await ust.getByLabel('Kolumny').fill('1');
  await ust.getByLabel('Rzędy').fill('2');
  await expect(wymiar('Odstęp poziomy')).toHaveCount(0);
  await ust.getByLabel('Odstęp pionowy (mm)').fill('0');
  await expect(wymiar('Odstęp pionowy')).toContainText('0 mm');
  await ust.getByRole('button', { name: 'poziomo', exact: true }).click();
  await expect(wymiar('Szerokość papieru')).toContainText('297 mm');
  await expect(wymiar('Wysokość papieru')).toContainText('210 mm');
  await ust.getByRole('button', { name: 'Użyj układu Siatka z odstępami' }).click();
  await expect(wymiar('Szerokość papieru')).toContainText('210 mm');
  await expect(podglad).toContainText('Siatka 3 × 3 · 199 × 272 mm');

  if (process.env.ZRZUTY) {
    await podglad.scrollIntoViewIfNeeded();
    await podglad.screenshot({ path: 'docs/obrazy/m2c-2-podglad-wymiarow.png' });
  }

  await slot(page, 1, 3, 1).click();
  await page.getByRole('menuitem', { name: /Czar \(test\)/ }).click();
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  await ust.getByText('Podgląd wymiarów', { exact: true }).click();
  await ust.getByLabel('Kolumny').fill('2');
  await expect(ust.getByText(/Po tej zmianie karty nie zmieściłyby się/)).toBeVisible();
  await expect(podglad).toContainText('Siatka 3 × 3 · 199 × 272 mm');
  await expect(wymiar('Margines prawy')).toContainText('6 mm');
  await expect(page.locator('[data-karta]')).toHaveCount(2);

  await ust.getByLabel('Papier', { exact: true }).selectOption('wlasny');
  await ust.getByRole('button', { name: 'poziomo', exact: true }).click();
  await podglad
    .getByRole('button', { name: 'Szerokość papieru, 297 mm. Przejdź do pola.' })
    .press('Space');
  await expect(ust.locator('#papier-wys')).toBeFocused();
  await podglad.locator('svg text[data-pole="papier-szer"]').click();
  await expect(ust.locator('#papier-szer')).toBeFocused();
  await ust.locator('#papier-szer').fill('333.33');
  await ust.locator('#papier-wys').fill('500');
  const wysokoscPapieru = podglad.locator('svg text[data-pole="papier-szer"]');
  await expect(wysokoscPapieru).toHaveText('333,33');
  const etykieta = (await wysokoscPapieru.boundingBox())!;
  const rysunek = (await podglad.locator('svg').boundingBox())!;
  expect(etykieta.x + etykieta.width).toBeLessThanOrEqual(rysunek.x + rysunek.width);
});

test('diagram małego slotu rozdziela etykiety rozmiaru i zerowego odstępu', async ({ page }) => {
  await nowaPustaKartka(page);
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  const ust = page.getByRole('complementary', { name: 'Ustawienia' });
  await ust.getByLabel('Układ kart na kartce').selectOption('wlasny');
  await ust.getByText('Podgląd wymiarów', { exact: true }).click();
  const podpis = (pole: string) => ust.locator(`.podglad-wymiarow svg text[data-pole="${pole}"]`);
  const rozmiar = podpis('uklad-szerokosc');
  const odstep = podpis('uklad-odstep-x');
  const wysokosc = podpis('uklad-wysokosc');
  await expect(rozmiar).toHaveText('25,75');
  await expect(odstep).toHaveText('0');
  const a = (await rozmiar.boundingBox())!;
  const b = (await odstep.boundingBox())!;
  const c = (await wysokosc.boundingBox())!;
  expect(b.y).toBeGreaterThanOrEqual(a.y + a.height);
  expect(c.x + c.width).toBeLessThanOrEqual(a.x);
  await rozmiar.click();
  await expect(ust.getByLabel('Szerokość karty (mm)')).toBeFocused();
  await wysokosc.click();
  await expect(ust.getByLabel('Wysokość karty (mm)')).toBeFocused();
  await odstep.click();
  await expect(ust.getByLabel('Odstęp poziomy (mm)')).toBeFocused();
});

test('własny układ: siatka z odstępami, wynik pod formularzem, poza papierem, presety', async ({
  page,
}) => {
  const ust = await kartkaCzaru(page);
  const tryb = ust.getByLabel('Układ kart na kartce');
  await tryb.selectOption('wlasny');
  await expect(tryb).toHaveValue('wlasny');
  // Start z bieżącej siatki (A4 pionowo, 3×3).
  await expect(ust.getByLabel('Kolumny')).toHaveValue('3');
  await expect(ust.getByLabel('Rzędy')).toHaveValue('3');
  await ust.getByLabel('Margines lewy (mm)').fill('8');
  await ust.getByLabel('Margines górny (mm)').fill('12');
  await ust.getByLabel('Odstęp poziomy (mm)').fill('4');
  await ust.getByLabel('Odstęp pionowy (mm)').fill('3');
  await expect(ust).toContainText('Kart na stronie: 9 · prawy margines 5 mm · dolny 15 mm');
  // Slot (2, 1) przesunięty o kartę i odstęp: (8 + 63 + 4) / 210.
  const s21 = slot(page, 1, 2, 1);
  const s11 = page.locator('[data-karta]');
  const [a, b] = [await s11.boundingBox(), await s21.boundingBox()];
  const strona = (await page.locator('.strona-kartki').first().boundingBox())!;
  expect((b!.x - strona.x) / strona.width).toBeCloseTo(75 / 210, 2);
  expect((b!.x - a!.x - a!.width) / strona.width).toBeCloseTo(4 / 210, 2);
  await expect(page.locator('.ostrzezenia-projektu')).toHaveCount(0);

  // Za dużo kolumn – ostrzeżenie pod formularzem i w projekcie.
  await ust.getByLabel('Kolumny').fill('4');
  await expect(ust.getByRole('alert')).toContainText('Siatka wychodzi poza papier');
  await expect(page.locator('.ostrzezenia-projektu')).toContainText('poza papier');
  await ust.getByLabel('Kolumny').fill('3');
  await ust.getByLabel('Linie cięcia wokół kart').uncheck();

  // „Moje układy”: zapis, zmiana nazwy, powrót do automatycznego i „Użyj”.
  await ust.getByLabel('Nazwa układu').fill('Perforacja 3×3');
  await ust.getByRole('button', { name: 'Zapisz jako mój układ' }).click();
  await expect(ust).toContainText('Zapisano układ „Perforacja 3×3”');
  await ust.getByRole('button', { name: 'Zmień nazwę układu Perforacja 3×3' }).click();
  await ust.getByLabel('Nowa nazwa układu „Perforacja 3×3”').fill('Arkusz z perforacją');
  await ust.getByLabel('Nowa nazwa układu „Perforacja 3×3”').press('Enter');
  await expect(ust.locator('.moje-uklady')).toContainText('Arkusz z perforacją');
  await expect(ust.locator('.moje-uklady')).toContainText('A4 (210 × 297 mm), karta 63×88 mm, 3×3');
  await tryb.selectOption('auto');
  await expect(ust.getByLabel('Kolumny')).toHaveCount(0);
  await ust.getByRole('button', { name: 'Użyj układu Arkusz z perforacją' }).click();
  await expect(ust.getByLabel('Odstęp poziomy (mm)')).toHaveValue('4');
  await expect(ust.getByLabel('Linie cięcia wokół kart')).not.toBeChecked();
  // Presety są w przeglądarce – widać je w innym projekcie po przeładowaniu.
  await page.reload();
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  await expect(ust.locator('.moje-uklady')).toContainText('Arkusz z perforacją');
  await ust.getByRole('button', { name: 'Usuń układ Arkusz z perforacją' }).click();
  await expect(ust).toContainText('Nie masz jeszcze zapisanych układów.');
});

test('kalibracja zapamiętana w przeglądarce, wydruk testowy, eksport PNG/JPG 300 dpi', async ({
  page,
}) => {
  const ust = await kartkaCzaru(page);
  await ust.getByLabel('Przesunięcie X (mm)').fill('1.5');
  await ust.getByLabel('Przesunięcie Y (mm)').fill('-0.5');
  await page.reload();
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  await expect(ust.getByLabel('Przesunięcie X (mm)')).toHaveValue('1.5');
  await expect(ust.getByLabel('Przesunięcie Y (mm)')).toHaveValue('-0.5');

  const [test] = await Promise.all([
    page.waitForEvent('download'),
    ust.getByRole('button', { name: 'Wydruk testowy (PDF)' }).click(),
  ]);
  expect(test.suggestedFilename()).toMatch(/wydruk-testowy.*\.pdf$/);
  expect(
    readFileSync(await test.path())
      .subarray(0, 5)
      .toString(),
  ).toBe('%PDF-');
  await expect(page.getByRole('status').filter({ hasText: 'skali 100%' })).toBeVisible();

  // Obrazy stron: jedna strona A4 → jeden PNG 2480×3508 px (300 dpi).
  const pobierz = async (pozycja: string) => {
    await page.getByRole('button', { name: 'Pobierz', exact: true }).click();
    const [p] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: pozycja }).click(),
    ]);
    return p;
  };
  const png = await pobierz('Obrazy stron – PNG, 300 dpi');
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  expect(wymiaryPng(readFileSync(await png.path()))).toEqual([2480, 3508]);

  // Karty osobno: druga karta → ZIP z dwoma JPG.
  await slot(page, 1, 2, 1).click();
  await page.getByRole('menuitem', { name: /Czar \(test\)/ }).click();
  await page
    .getByRole('complementary', { name: 'Zaznaczone karty' })
    .getByLabel('Nazwa', { exact: true })
    .fill('Tarcza');
  const zip = await pobierz('Karty osobno – ZIP z JPG, 300 dpi');
  expect(zip.suggestedFilename()).toMatch(/\.zip$/);
  const pliki = unzipSync(readFileSync(await zip.path()));
  expect(Object.keys(pliki).sort()).toEqual(['1-ognista-kula.jpg', '2-tarcza.jpg']);
  // JPG: znacznik SOI.
  expect([...pliki['1-ognista-kula.jpg']!.subarray(0, 2)]).toEqual([0xff, 0xd8]);
});

test('luz karty w slocie (M2b-1): 63×88 w slocie 63,5×89 bez ostrzeżeń, luz w presecie', async ({
  page,
}) => {
  const ust = await kartkaCzaru(page);
  await ust.getByLabel('Układ kart na kartce').selectOption('wlasny');
  const sekcja = ust.getByRole('group', { name: 'Karta w slocie' });
  // Nowa kartka: luz 1 mm.
  await expect(sekcja.getByLabel('Luz (mm)')).toHaveValue('1');
  await ust.getByLabel('Szerokość karty (mm)').fill('63.5');
  await ust.getByLabel('Wysokość karty (mm)').fill('89');
  await expect(page.locator('.ostrzezenia-projektu')).toHaveCount(0);
  // Luz 0 – karta mniejsza od slotu już nie pasuje.
  await sekcja.getByLabel('Luz (mm)').fill('0');
  await expect(page.locator('.ostrzezenia-projektu')).toContainText('innym rozmiarze');
  await sekcja.getByLabel('Luz (mm)').fill('1.5');
  await expect(page.locator('.ostrzezenia-projektu')).toHaveCount(0);
  await sekcja.getByRole('button', { name: 'Lewy górny róg' }).click();
  await sekcja.getByLabel('Tło do krawędzi slotu').check();
  await sekcja.getByRole('button', { name: 'Wokół karty' }).click();
  await expect(sekcja.getByRole('button', { name: 'Wokół karty' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  if (process.env.ZRZUTY) await ust.screenshot({ path: 'docs/obrazy/m2b-1-karta-w-slocie.png' });
  // Preset zapisuje luz i „Użyj” go przywraca.
  await ust.getByLabel('Nazwa układu').fill('Perforacja 63,5×89');
  await ust.getByRole('button', { name: 'Zapisz jako mój układ' }).click();
  await expect(ust).toContainText('Zapisano układ');
  await sekcja.getByLabel('Luz (mm)').fill('0.5');
  await ust.getByRole('button', { name: 'Użyj układu Perforacja 63,5×89' }).click();
  await expect(sekcja.getByLabel('Luz (mm)')).toHaveValue('1.5');
  await ust.getByRole('button', { name: 'Usuń układ Perforacja 63,5×89' }).click();
  const [test] = await Promise.all([
    page.waitForEvent('download'),
    ust.getByRole('button', { name: 'Wydruk testowy (PDF)' }).click(),
  ]);
  expect(test.suggestedFilename()).toMatch(/wydruk-testowy.*\.pdf$/);
});
