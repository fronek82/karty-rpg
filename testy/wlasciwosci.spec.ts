import { expect, test, type Page } from '@playwright/test';
import { slot } from './pomoc';

/** Panel właściwości edytora szablonu: wszystkie ustawienia z ogólnych klocków. */

test.use({ viewport: { width: 1440, height: 1100 } });

const drzewo = (page: Page) => page.getByRole('tree', { name: 'Struktura karty' });
const element = (page: Page, nazwa: RegExp) => drzewo(page).getByRole('treeitem', { name: nazwa });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Właściwości' });
const sekcja = (page: Page, nazwa: string) =>
  panel(page).locator('details.sekcja-panelu', {
    has: page.locator(`summary:text-is("${nazwa}")`),
  });
async function otworz(page: Page, nazwa: string) {
  const s = sekcja(page, nazwa).first();
  if (!(await s.evaluate((d) => (d as HTMLDetailsElement).open)))
    await s.locator('summary').first().click();
  return s;
}
async function dodaj(page: Page, rodzaj: string) {
  await page.getByRole('button', { name: '＋ Dodaj ▾' }).click();
  await page.getByRole('menuitem', { name: rodzaj, exact: true }).click();
}
async function nowySzablon(page: Page) {
  await page.goto('./#/wlasne/nowy');
  await page.getByText('Pusta karta').click();
  await page.getByRole('button', { name: /Dalej: układ pól/ }).click();
  await expect(drzewo(page)).toBeVisible({ timeout: 15000 });
}

test('tabela: kolumny, wiersze, nagłówki, linie; komórki to pola karty', async ({ page }) => {
  await nowySzablon(page);
  await dodaj(page, 'Tabela');
  await panel(page).getByLabel('Nazwa', { exact: true }).fill('Cechy');
  const kol = await otworz(page, 'Kolumny (3)');
  await kol.getByLabel('Nagłówek kolumny 1').fill('Siła');
  await kol.getByLabel('Nagłówek kolumny 2').fill('Zręczność');
  await kol.getByRole('button', { name: 'Usuń kolumnę 3' }).click();
  await expect(sekcja(page, 'Kolumny (2)')).toBeVisible();
  await panel(page).getByRole('button', { name: '＋ Dodaj kolumnę' }).click();
  await panel(page).getByLabel('Nagłówek kolumny 3').fill('Wola');
  await panel(page).getByRole('button', { name: 'Przesuń kolumnę 3 w lewo' }).click();
  await expect(panel(page).getByLabel('Nagłówek kolumny 2')).toHaveValue('Wola');
  // Wiersze, nagłówki, linie.
  await panel(page).getByLabel('Liczba wierszy wartości').fill('2');
  await panel(page).getByLabel('Pokaż wiersz nagłówków').uncheck();
  await panel(page).getByLabel('Pokaż wiersz nagłówków').check();
  await otworz(page, 'Linie siatki');
  await panel(page).getByLabel('Obwódka tabeli').uncheck();
  await panel(page).getByLabel('Linie siatki', { exact: true }).uncheck();
  await expect(page.locator('.karta-podgladu svg line')).toHaveCount(0);

  // Na kartce: komórki 2 wierszy × 3 kolumn jako osobne pola.
  await page.getByRole('button', { name: 'Rób karty ►' }).click();
  await slot(page, 1, 1, 1).click();
  await page.getByRole('menuitem', { name: /Moja karta/ }).click();
  const karta = page.getByRole('complementary', { name: 'Zaznaczone karty' });
  for (const n of [
    'Siła (1)',
    'Wola (1)',
    'Zręczność (1)',
    'Siła (2)',
    'Wola (2)',
    'Zręczność (2)',
  ])
    await expect(karta.getByLabel(`Cechy – ${n}`, { exact: true })).toBeVisible();
});

test('kształt z listy, styl tekstu, stały tekst, ramka pola i karty; kopiuj/wklej styl, wiele naraz', async ({
  page,
}) => {
  await nowySzablon(page);
  await dodaj(page, 'Wartość w kształcie');
  await panel(page).getByLabel('Kształt').selectOption('tarcza');
  await expect(page.locator('.karta-podgladu svg path').first()).toBeAttached();
  // Styl tekstu: rozmiar i pogrubienie.
  const styl = await otworz(page, 'Styl tekstu');
  await styl.getByLabel('Rozmiar (pt)').fill('14');
  await styl.getByRole('button', { name: 'B', exact: true }).click();
  await expect(styl.getByRole('button', { name: 'B', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Stały tekst – ten sam na każdej karcie; klucz danych znika.
  await panel(page).getByRole('button', { name: 'stała (na każdej karcie)' }).click();
  await panel(page).getByLabel('Stały tekst').fill('★');
  await expect(panel(page)).not.toContainText('Pole danych karty');
  // Ramka pola.
  const wyglad = await otworz(page, 'Wygląd (tło, ramka, rogi)');
  await wyglad.getByLabel('Tło', { exact: true }).locator('xpath=..').getByRole('checkbox').check();
  // Drugi element: tekst; kopiuj styl z pierwszego i wklej.
  await element(page, /^Karta – /)
    .locator('.wezel-etykieta')
    .first()
    .click();
  await dodaj(page, 'Wartość w kształcie');
  await element(page, /^Wartość w kształcie – /)
    .first()
    .locator('.wezel-etykieta')
    .click();
  await panel(page).getByRole('button', { name: 'Kopiuj styl' }).click();
  await element(page, /^Wartość w kształcie – /)
    .nth(1)
    .locator('.wezel-etykieta')
    .click();
  await panel(page).getByRole('button', { name: 'Wklej styl' }).click();
  await expect(panel(page).getByLabel('Kształt')).toHaveValue('tarcza');
  // Wiele naraz: oba elementy, zmiana kształtu dla obu.
  await element(page, /^Wartość w kształcie – /)
    .first()
    .locator('.wezel-etykieta')
    .click({ modifiers: ['Shift'] });
  await expect(panel(page)).toContainText('Zmiany dotyczą wszystkich zaznaczonych');
  await panel(page).getByLabel('Kształt').selectOption('romb');
  for (const i of [0, 1]) {
    await element(page, /^Wartość w kształcie – /)
      .nth(i)
      .locator('.wezel-etykieta')
      .click();
    await expect(panel(page).getByLabel('Kształt')).toHaveValue('romb');
  }
  // Ramka karty.
  await page.keyboard.press('Escape');
  await page.locator('.karta-podgladu').click({ position: { x: 2, y: 2 } });
  const r = await otworz(page, 'Ramka karty');
  await r
    .getByRole('group', { name: 'Ramka karty', exact: true })
    .getByRole('button', { name: 'linia', exact: true })
    .click();
  await r.getByLabel('Odsunięcie od krawędzi (mm)').fill('2');
  await expect(page.locator('.karta-podgladu svg rect[stroke]').last()).toBeAttached();
});

test('zmiana typu pola zachowuje nazwę i klucz; kontener wiersz ↔ kolumna', async ({ page }) => {
  await nowySzablon(page);
  await dodaj(page, 'Tekst');
  await panel(page).getByLabel('Nazwa', { exact: true }).fill('Moc');
  await panel(page).getByLabel('Typ').selectOption('wartosc');
  await expect(element(page, /^Moc – Wartość w kształcie/)).toBeVisible();
  // Klucz nadany przy utworzeniu pola zostaje (zmiana nazwy i typu go nie zmienia).
  await expect(panel(page)).toContainText('Pole danych karty: tekst');
  await element(page, /^Karta – /)
    .locator('.wezel-etykieta')
    .first()
    .click();
  await dodaj(page, 'Wiersz');
  await panel(page).getByLabel('Typ').selectOption('kolumna');
  await expect(element(page, /^Wiersz – Kolumna/)).toBeVisible();
});
