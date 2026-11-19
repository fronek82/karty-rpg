import { expect, test } from '@playwright/test';
import { utils, write } from 'xlsx';
import { strToU8, zipSync } from 'fflate';
import { WERSJA_SCHEMATU } from '../src/model/projekt';
import { kartaNaKartce, kreator, dodaj as dodajPole } from './szablonUI';
import { nowaPustaKartka, zapisano } from './pomoc';

test('CSV: ręczne mapowanie, blokada błędnej partii i cofnięcie w jednym kroku', async ({
  page,
}) => {
  await kreator(page, { nazwa: 'Wyprawa', format: 'Standard / Poker', uklad: 'Tytuł i opis' });
  await dodajPole(page, 'Obraz', 'Ilustracja');
  await kartaNaKartce(page, 'Wyprawa', {});
  await page.getByTestId('plik-obrazu').setInputFiles('testy/zasoby/litera-f.png');
  const obraz = page.getByLabel('Ilustracja z biblioteki', { exact: true });
  await expect(obraz).not.toHaveValue('');
  await obraz.selectOption('');
  await expect(page.locator('.svg-strony image')).toHaveCount(0);
  const karty = page.locator('.strona-kartki [data-karta]');
  const start = await karty.count();
  expect(start).toBeGreaterThan(0);
  const importuj = page.getByRole('button', { name: 'Importuj CSV lub XLSX' });
  await importuj.click();
  const okno = page.getByRole('dialog');
  await okno.getByRole('button', { name: 'Anuluj' }).press('Escape');
  await expect(okno).toHaveCount(0);
  await expect(importuj).toBeFocused();
  await importuj.click();
  const plik = okno.getByLabel('Plik CSV lub XLSX');
  const dodaj = okno.getByRole('button', { name: 'Dodaj karty' });
  await plik.setInputFiles({
    name: 'karty.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Okolica;Ilość\nSzczyt;2\nLas;0'),
  });
  await expect(okno.getByRole('alert')).toContainText('Wiersz 3');
  await expect(dodaj).toBeDisabled();
  await expect(karty).toHaveCount(start);
  await plik.setInputFiles({
    name: 'karty.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Okolica;Ilość;Ilustracja\nSzczyt;2;litera-f.png\nLas;1;'),
  });
  await okno.getByRole('combobox', { name: 'Tytuł', exact: true }).selectOption('0');
  await expect(okno.getByRole('table')).toContainText('Szczyt');
  await expect(okno.getByRole('status')).toContainText('3 sztuk');
  if (process.env.ZRZUTY_M3_7) await page.screenshot({ path: 'docs/obrazy/m3-7-import.png' });
  await dodaj.click();
  await expect(okno).toHaveCount(0);
  await expect(karty).toHaveCount(start + 3);
  await expect(page.locator('.svg-strony image')).toHaveCount(2);
  await zapisano(page);
  await page.getByRole('button', { name: 'Cofnij', exact: true }).first().click();
  await expect(karty).toHaveCount(start);
});

test('XLSX: wybór drugiego arkusza, ilość i dane trafiają na kartkę', async ({ page }) => {
  await kreator(page, { nazwa: 'Przeprawa', format: 'Standard / Poker', uklad: 'Tytuł i opis' });
  await kartaNaKartce(page, 'Przeprawa', {});
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, utils.aoa_to_sheet([['Pusta']]), 'Notatki');
  utils.book_append_sheet(
    workbook,
    utils.aoa_to_sheet([
      ['Tytuł', 'Ilość'],
      ['Przystań', 2],
    ]),
    'Karty',
  );
  const plik = Buffer.from(write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
  await page.getByRole('button', { name: 'Importuj CSV lub XLSX' }).click();
  const okno = page.getByRole('dialog');
  await okno.getByLabel('Plik CSV lub XLSX').setInputFiles({
    name: 'karty.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: plik,
  });
  await okno.getByLabel('Arkusz z pliku XLSX').selectOption({ label: 'Karty' });
  await expect(okno.getByRole('table')).toContainText('Przystań');
  await okno.getByRole('button', { name: 'Dodaj karty' }).click();
  await expect(page.getByRole('button', { name: /Przystań/ })).toHaveCount(2);
});

test('kartka pakietu oferuje tylko szablony dopuszczone w menu dodawania', async ({ page }) => {
  await nowaPustaKartka(page);
  const kartki = page.locator('.kartka');
  await expect(kartki).toHaveCount(1);
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  const szablonWlasny = {
    wersja: WERSJA_SCHEMATU,
    szablon: {
      id: 'pomiar',
      nazwa: 'Pomiar terenowy',
      rozmiar: { tryb: 'mm', szerokosc: 25.75, wysokosc: 25.75 },
      korzen: { id: 'karta', typ: 'kolumna', dzieci: [] },
    },
    role: {},
    zasoby: [],
  };
  await page.getByTestId('plik-szablonu').setInputFiles({
    name: 'pomiar.kartyrpg-szablon',
    mimeType: 'application/zip',
    buffer: Buffer.from(zipSync({ 'szablon.json': strToU8(JSON.stringify(szablonWlasny)) })),
  });
  await expect(kartki).toHaveCount(2);
  await kartki.last().getByRole('button', { name: 'Importuj CSV lub XLSX' }).click();
  const wlasna = page.getByRole('dialog');
  await expect(
    wlasna.getByRole('combobox', { name: 'Szablon nowych kart' }).locator('option'),
  ).toHaveCount(1);
  await expect(wlasna.getByRole('combobox', { name: 'Szablon nowych kart' })).toHaveValue('pomiar');
  await wlasna.getByRole('button', { name: 'Anuluj' }).click();
  await kartki.first().getByRole('button', { name: 'Importuj CSV lub XLSX' }).click();
  const okno = page.getByRole('dialog');
  const szablon = okno.getByRole('combobox', { name: 'Szablon nowych kart' });
  const bron = szablon.locator('option[value="mausritter-bron"]');
  await expect(bron).toHaveCount(1);
  await expect(szablon.locator('option[value="pomiar"]')).toHaveCount(0);
  await szablon.selectOption('mausritter-bron');
  await okno.getByLabel('Plik CSV lub XLSX').setInputFiles({
    name: 'karty.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Nazwa,Ilość\nPróba,1'),
  });
  await expect(okno.getByRole('table')).toContainText('Próba');
  await okno.getByRole('button', { name: 'Dodaj karty' }).click();
  await expect(kartki.first().locator('[data-karta]')).toHaveCount(1);
});
