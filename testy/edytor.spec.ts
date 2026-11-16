import { expect, test, type Page } from '@playwright/test';
import { dodajKarte, karta, nowaPustaKartka, przeciagnij, slot, srodek, zapisano } from './pomoc';

/** Edytor kartki: dodawanie i edycja kart, rozmiary, duplikowanie, usuwanie, przeciąganie. */

test.use({ viewport: { width: 1440, height: 1600 } });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Zaznaczone karty' });

test('dodanie karty z menu, pola, znaczniki, rozmiar; zapis po przeładowaniu', async ({ page }) => {
  await nowaPustaKartka(page);
  await dodajKarte(page, 1, 3, 2, 'Broń');
  await panel(page).getByLabel('Nazwa', { exact: true }).fill('Miecz');
  await panel(page).getByLabel('Wartość').fill('k8');
  await expect(karta(page, 'Miecz')).toHaveAttribute(
    'aria-label',
    'Miecz – strona 1, kolumna 3, rząd 2',
  );
  await panel(page).getByRole('button', { name: 'Użycia: więcej' }).click();
  await expect(panel(page).locator('.licznik output')).toHaveText('4');
  await panel(page).getByRole('button', { name: '1×2 ciężka' }).click();
  await expect(panel(page).getByRole('button', { name: '1×2 ciężka' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const r = (await karta(page, 'Miecz').boundingBox())!;
  expect(r.height / r.width).toBeCloseTo(2, 1);

  // Zbroja w ostatnim rzędzie: ciężka 1×2 się nie zmieści – lekka 2×1.
  await dodajKarte(page, 1, 6, 7, 'Zbroja');
  const z = (await page.locator('[data-karta].zaznaczona').boundingBox())!;
  expect(z.width / z.height).toBeCloseTo(2, 1);

  await zapisano(page);
  await page.reload();
  await karta(page, 'Miecz').click();
  await expect(panel(page).getByLabel('Wartość')).toHaveValue('k8');
  await expect(panel(page).locator('.licznik output')).toHaveText('4');
});

test('duplikuj ×N, usuń z „Cofnij”, skróty klawiszowe', async ({ page }) => {
  await nowaPustaKartka(page);
  await dodajKarte(page, 1, 1, 1, 'Broń');
  await panel(page).getByLabel('Nazwa', { exact: true }).fill('Kula ognia');
  await panel(page).getByLabel('Liczba kopii').fill('3');
  await panel(page).getByRole('button', { name: 'Duplikuj ×3' }).click();
  await expect(karta(page, 'Kula ognia')).toHaveCount(4);
  await expect(page.locator('.toast')).toContainText('Dodano kopie: 3.');
  await expect(panel(page).getByRole('heading')).toHaveText('Zaznaczone karty: 3');

  // Delete usuwa zaznaczone (3 kopie); „Cofnij” w komunikacie je przywraca.
  await page.keyboard.press('Delete');
  await expect(karta(page, 'Kula ognia')).toHaveCount(1);
  await expect(page.locator('.toast')).toContainText('Usunięto karty: 3.');
  await page.locator('.toast').getByRole('button', { name: 'Cofnij' }).click();
  await expect(karta(page, 'Kula ognia')).toHaveCount(4);

  // Ctrl+D, Ctrl+Z, Ctrl+Shift+Z, strzałka.
  await karta(page, 'Kula ognia').first().click();
  await page.keyboard.press('Control+d');
  await expect(karta(page, 'Kula ognia')).toHaveCount(5);
  await page.keyboard.press('Control+z');
  await expect(karta(page, 'Kula ognia')).toHaveCount(4);
  await page.keyboard.press('Control+Shift+z');
  await expect(karta(page, 'Kula ognia')).toHaveCount(5);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Nic nie zaznaczono' })).toBeVisible();
  await karta(page, 'Kula ognia').first().click();
  const przed = await karta(page, 'Kula ognia').first().getAttribute('aria-label');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-karta].zaznaczona')).not.toHaveAttribute('aria-label', przed!);
});

test('przeciąganie: wolne miejsce i zajęte; prostokąt i edycja wielu kart naraz', async ({
  page,
}) => {
  await nowaPustaKartka(page);
  await dodajKarte(page, 1, 1, 1, 'Broń');
  await panel(page).getByLabel('Nazwa', { exact: true }).fill('A');
  await dodajKarte(page, 1, 2, 1, 'Broń');
  await panel(page).getByLabel('Nazwa', { exact: true }).fill('B');

  await przeciagnij(
    page,
    await srodek(page, karta(page, 'A')),
    await srodek(page, slot(page, 1, 5, 4)),
  );
  await expect(karta(page, 'A')).toHaveAttribute('aria-label', 'A – strona 1, kolumna 5, rząd 4');
  // Na zajęte miejsce – karta wraca.
  await przeciagnij(
    page,
    await srodek(page, karta(page, 'A')),
    await srodek(page, karta(page, 'B')),
  );
  await expect(karta(page, 'A')).toHaveAttribute('aria-label', 'A – strona 1, kolumna 5, rząd 4');

  // Prostokąt od pustego slotu przez obie karty.
  await przeciagnij(
    page,
    await srodek(page, slot(page, 1, 1, 1)),
    await srodek(page, slot(page, 1, 6, 4)),
  );
  await expect(panel(page).getByRole('heading')).toHaveText('Zaznaczone karty: 2');
  await panel(page).getByLabel('Klasa').fill('Lekka');
  for (const n of ['A', 'B']) {
    await karta(page, n).click();
    await expect(panel(page).getByLabel('Klasa')).toHaveValue('Lekka');
  }
  // Shift+klik: zaznaczenie obu, różne nazwy – pole puste z podpowiedzią „różne”.
  await karta(page, 'A').click();
  await karta(page, 'B').click({ modifiers: ['Shift'] });
  await expect(panel(page).getByLabel('Nazwa', { exact: true })).toHaveAttribute(
    'placeholder',
    'różne',
  );
});

test('strony: dodaj, przeciągnij kartę na drugą, usuń pustą', async ({ page }) => {
  await nowaPustaKartka(page);
  await dodajKarte(page, 1, 1, 1, 'Stan');
  await panel(page).getByLabel('Nazwa', { exact: true }).fill('Ranny');
  await page.getByRole('button', { name: /Dodaj stronę/ }).click();
  await expect(page.getByText('Strona 2 z 2')).toBeVisible();
  await przeciagnij(
    page,
    await srodek(page, karta(page, 'Ranny')),
    await srodek(page, slot(page, 2, 3, 3)),
  );
  await expect(karta(page, 'Ranny')).toHaveAttribute(
    'aria-label',
    'Ranny – strona 2, kolumna 3, rząd 3',
  );
  await page.getByRole('button', { name: 'Usuń pustą stronę' }).click();
  await expect(page.getByText('Strona 1 z 1')).toBeVisible();
  await expect(karta(page, 'Ranny')).toHaveAttribute(
    'aria-label',
    'Ranny – strona 1, kolumna 3, rząd 3',
  );
});
