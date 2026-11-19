import { expect, test, type Page } from '@playwright/test';
import { slot, zapisano } from './pomoc';

/** Edytor szablonu od zera: kreator, drzewo, podgląd z zaznaczaniem, „Rób karty”, powrót. */

test.use({ viewport: { width: 1440, height: 1000 } });

const drzewo = (page: Page) => page.getByRole('tree', { name: 'Struktura karty' });
const element = (page: Page, nazwa: string | RegExp) =>
  drzewo(page).getByRole('treeitem', { name: nazwa });
const wlasciwosci = (page: Page) => page.getByRole('complementary', { name: 'Właściwości' });

async function dodaj(page: Page, rodzaj: string) {
  await page.getByRole('button', { name: '＋ Dodaj ▾' }).click();
  await page.getByRole('menuitem', { name: rodzaj, exact: true }).click();
}

test('kreator domyślnie tworzy kartę swobodną, a pusty układ jest ostatni', async ({ page }) => {
  await page.goto('./#/wlasne/nowy');
  await page.getByLabel('Nazwa szablonu').fill('Karta w układzie swobodnym');
  const opcje = page.locator('input[name="uklad"]');
  expect(await opcje.evaluateAll((pola: HTMLInputElement[]) => pola.map((p) => p.value))).toEqual([
    'swobodny',
    'tytul-opis',
    'tytul-siatka-opis-stopka',
    'pusty',
  ]);
  await expect(opcje.first()).toBeChecked();
  await page.getByRole('button', { name: /Dalej: układ pól/ }).click();
  await expect(element(page, /^Karta – Swobodny/)).toBeVisible();
});

test('kreator → edytor: drzewo, dodawanie, przesuwanie, podgląd; Rób karty i powrót', async ({
  page,
}) => {
  await page.goto('./#/wlasne');
  await page.getByRole('link', { name: /Nowy szablon od zera/ }).click();
  await page.getByLabel('Nazwa szablonu').fill('Karta testowa');
  await page.getByText('Mini Euro').click();
  await page.getByRole('button', { name: 'poziomo' }).click();
  await expect(page.getByLabel('Podgląd rozmiaru')).toContainText('68×44 mm');
  await page.getByText('Tytuł i opis').click();
  await page.getByRole('button', { name: /Dalej: układ pól/ }).click();

  // Edytor: drzewo z układem startowym.
  await expect(drzewo(page)).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel('Nazwa szablonu')).toHaveValue('Karta testowa');
  await expect(element(page, /^Tytuł – Tekst/)).toBeVisible();
  await expect(element(page, /^Karta – /)).toHaveAttribute('aria-expanded', 'true');
  await expect(element(page, /^Opis – Tekst/)).toBeVisible();

  // Klik w podglądzie zaznacza element w drzewie.
  await page.locator('[data-obszar="tekst"]').click();
  await expect(element(page, /^Tytuł – /)).toHaveAttribute('aria-selected', 'true');
  await wlasciwosci(page).getByLabel('Wartość przykładowa').fill('Smok');
  await expect(
    page.locator('.karta-podgladu svg text, .karta-podgladu svg use').first(),
  ).toBeAttached();

  // Dodanie wiersza i wartości w kształcie do wiersza, przesunięcie w górę.
  await page
    .getByRole('treeitem', { name: /^Karta – / })
    .locator('.wezel-etykieta')
    .first()
    .click();
  await dodaj(page, 'Wiersz');
  await expect(element(page, /^Wiersz – Wiersz/)).toHaveAttribute('aria-selected', 'true');
  await dodaj(page, 'Wartość w kształcie');
  const wartosc = element(page, /^Wartość w kształcie – /);
  await expect(wartosc).toHaveAttribute('aria-level', '3');
  await wlasciwosci(page).getByLabel('Nazwa', { exact: true }).fill('Siła');
  await expect(element(page, /^Siła – Wartość w kształcie/)).toBeVisible();
  await expect(wlasciwosci(page)).toContainText('Pole danych karty: wartosc_w_ksztalcie');
  // Szerokość stała w mm.
  await wlasciwosci(page)
    .getByRole('group', { name: 'Szerokość' })
    .getByRole('button', { name: 'mm' })
    .click();
  await wlasciwosci(page).getByLabel('Rozmiar (mm)').fill('12');
  await element(page, /^Wiersz – /)
    .locator('.wezel-etykieta')
    .first()
    .click();
  await page.getByRole('button', { name: '↑ Wyżej' }).click();
  await page.getByRole('button', { name: '↑ Wyżej' }).click();
  const kolejnosc = await drzewo(page)
    .locator('[aria-level="2"]')
    .evaluateAll((e) => e.map((x) => x.getAttribute('aria-label')));
  expect(kolejnosc[0]).toMatch(/^Wiersz/);
  // Cofnij przywraca kolejność.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+z');
  const poCofnieciu = await drzewo(page)
    .locator('[aria-level="2"]')
    .evaluateAll((e) => e.map((x) => x.getAttribute('aria-label')));
  expect(poCofnieciu[1]).toMatch(/^Wiersz/);
  // Klawiatura w drzewie: strzałki, Shift+strzałka dokłada, Delete usuwa i fokus zostaje.
  await element(page, /^Tytuł – /).focus();
  await page.keyboard.press('ArrowDown');
  await expect(element(page, /^Wiersz – /)).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(element(page, /^Siła – /)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(drzewo(page).locator('[aria-selected="true"]')).toHaveCount(2);
  await page.keyboard.press('Home');
  await expect(element(page, /^Karta – /)).toBeFocused();
  await zapisano(page);

  // Rób karty: kartka dla rozmiaru 68×44, karta z menu, pola z nazwami z szablonu.
  await page.getByRole('button', { name: 'Rób karty ►' }).click();
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible();
  await slot(page, 1, 1, 1).click();
  await page.getByRole('menuitem', { name: /Karta testowa/ }).click();
  const panel = page.getByRole('complementary', { name: 'Zaznaczone karty' });
  await panel.getByLabel('Siła', { exact: true }).fill('7');
  await panel.getByLabel('Tytuł', { exact: true }).fill('Gryf');
  await expect(page.locator('[data-karta]')).toHaveAttribute('aria-label', /^Gryf – /);

  // Powrót do szablonu z panelu karty; usunięcie pola nie kasuje danych karty.
  await panel.getByRole('link', { name: /Edytuj szablon „Karta testowa”/ }).click();
  await expect(drzewo(page)).toBeVisible();
  await element(page, /^Siła – /)
    .locator('.wezel-etykieta')
    .click();
  await page.keyboard.press('Delete');
  await expect(element(page, /^Siła – /)).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(element(page, /^Siła – /)).toBeVisible();
  await page.getByRole('link', { name: '← Kartki' }).click();
  await page.locator('[data-karta]').click();
  await expect(panel.getByLabel('Siła', { exact: true })).toHaveValue('7');
});

test('nowy szablon w istniejącym projekcie: kreator z kartki, siatka 2×2', async ({ page }) => {
  await page.goto('./#/wlasne/nowy');
  await page.getByRole('button', { name: /Dalej: układ pól/ }).click();
  await expect(drzewo(page)).toBeVisible({ timeout: 15000 });
  await page.getByRole('link', { name: '← Kartki' }).click();
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  await page.getByRole('link', { name: '＋ Nowy szablon' }).click();
  await page.getByLabel('Nazwa szablonu').fill('Druga');
  await page.getByText('Tytuł, siatka 2×2, opis i stopka').click();
  await page.getByRole('button', { name: /Dalej: układ pól/ }).click();
  await expect(page.getByLabel('Nazwa szablonu')).toHaveValue('Druga');
  for (const n of [1, 2, 3, 4])
    await expect(element(page, new RegExp(`^Pole ${n} – `))).toBeVisible();
  await expect(element(page, /^Stopka – lewa – /)).toBeVisible();
});

test('edytor szablonu nie otwiera się dla projektu gry ani nieznanego szablonu', async ({
  page,
}) => {
  await page.goto('./#/gra/mausritter');
  await page.getByRole('button', { name: /Pusta kartka A4/ }).click();
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
  const adres = page.url().replace(/#.*$/, '');
  const id = page.url().split('/projekt/')[1]!;
  await page.goto(`${adres}#/projekt/${id}/szablon/mausritter-bron`);
  await expect(page.getByRole('alert')).toContainText('Szablony z pakietu gry');
  await page.goto('./#/wlasne/nowy');
  await page.getByRole('button', { name: /Dalej: układ pól/ }).click();
  await expect(drzewo(page)).toBeVisible({ timeout: 15000 });
  const wlasny = page.url().split('/szablon/')[0]!;
  await page.goto(`${wlasny}/szablon/nie-ma-takiego`);
  await expect(
    page.getByRole('heading', { name: 'Nie ma takiego szablonu w projekcie' }),
  ).toBeVisible();
});

test('duplikuje szablon z paska i ustawień, a Cofnij pozostawia oryginał w edytorze', async ({
  page,
}) => {
  await page.goto('./#/wlasne/nowy');
  await page.getByLabel('Nazwa szablonu').fill('Oryginał');
  await page.getByText('Tytuł i opis').click();
  await page.getByRole('button', { name: /Dalej: układ pól/ }).click();
  const duplikuj = page.getByRole('button', { name: 'Duplikuj szablon', exact: true });
  await duplikuj.click();
  const otworz = page.getByRole('link', { name: 'Otwórz kopię „Oryginał (kopia)”' });
  await expect(otworz).toBeVisible();
  await page.getByRole('button', { name: 'Cofnij', exact: true }).click();
  await expect(otworz).toHaveCount(0);
  await expect(page.getByLabel('Nazwa szablonu')).toHaveValue('Oryginał');
  await page.getByRole('button', { name: 'Ponów', exact: true }).click();
  await expect(otworz).toBeVisible();
  await page.getByRole('button', { name: /Rób karty/ }).click();
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  const lista = page.getByRole('group', { name: 'Szablony projektu' });
  await lista.getByRole('button', { name: 'Duplikuj szablon Oryginał', exact: true }).click();
  await expect(
    lista.getByRole('link', { name: 'Edytuj szablon Oryginał (kopia 2)' }),
  ).toBeVisible();
});
