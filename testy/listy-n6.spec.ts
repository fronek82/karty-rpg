import { expect, test, type Page } from '@playwright/test';

/**
 * Etap N6: „Moje szablony” na ekranie „Stwórz własne karty” (przed przykładami i galerią),
 * wyszukiwarka i sortowanie list, „Duplikuj”, usuwanie bez pytania z paskiem „Cofnij”
 * (pojedynczo i zbiorczo).
 */

async function zPrzykladu(page: Page, nazwa: string) {
  await page.goto('./#/wlasne');
  await page.getByRole('button', { name: nazwa, exact: true }).click();
  await expect(page).toHaveURL(/#\/projekt\//, { timeout: 15000 });
}

const nazwyKafelkow = (page: Page) =>
  page.locator('.kafelek-projektu .naglowek-kafelka-projektu .nazwa').allTextContents();

test('Moje szablony: sekcja na ekranie własnych kart, szukanie, sortowanie, duplikat, usuwanie zbiorcze z Cofnij', async ({
  page,
}) => {
  await zPrzykladu(page, 'Karta z opisem');
  await zPrzykladu(page, 'Blok statystyk');

  // Ekran „Stwórz własne karty”: Moje szablony → Przykładowe szablony → Galeria online.
  await page.goto('./#/wlasne');
  const moje = page.getByRole('region', { name: /Moje szablony/ });
  await expect(moje.locator('[data-moj-szablon]')).toHaveCount(2);
  await expect(moje.locator('img.miniatura-wlasna')).toHaveCount(2, { timeout: 15000 });
  const sekcje = await page
    .locator('.grupy-podgladow > section h2')
    .evaluateAll((h) => h.map((x) => x.id));
  expect(sekcje).toEqual(['wlasne-moje', 'wlasne-przyklady', 'galeria-online-tytul']);
  await expect(page.getByText('Globalna biblioteka szablonów')).toHaveCount(0);
  if (process.env.ZRZUTY) {
    await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
    await page.screenshot({ path: 'docs/obrazy/n6-wlasne-karty.png' });
  }
  await moje.getByRole('button', { name: 'Pokaż wszystkie' }).click();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.getByRole('tab', { name: 'Moje szablony' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  // Szukanie i sortowanie.
  const kafelki = page.locator('.kafelek-projektu');
  await expect(kafelki).toHaveCount(2);
  const szukaj = page.getByRole('searchbox', { name: 'Szukaj szablonów po nazwie' });
  const [pierwsza] = await nazwyKafelkow(page);
  await szukaj.fill(pierwsza!.slice(0, 4).toUpperCase());
  await expect(kafelki).toHaveCount(1);
  await szukaj.fill('nie-ma-takiego');
  await expect(page.getByText('Nic nie pasuje do „nie-ma-takiego”.')).toBeVisible();
  await szukaj.fill('');
  await page.getByLabel('Sortuj').selectOption('nazwa-az');
  const az = await nazwyKafelkow(page);
  expect(az).toEqual([...az].sort((a, b) => a.localeCompare(b, 'pl')));
  await page.getByLabel('Sortuj').selectOption('nazwa-za');
  expect(await nazwyKafelkow(page)).toEqual([...az].reverse());

  // Duplikuj: kopia z dopiskiem „(kopia)”.
  await page.getByRole('button', { name: `Duplikuj szablon ${az[0]}` }).click();
  await expect(kafelki).toHaveCount(3);
  await expect(
    page.locator('.kafelek-projektu .nazwa', { hasText: `${az[0]} (kopia)` }),
  ).toHaveCount(1);

  // Szablonu używanego przez karty projektu nie da się usunąć (projekt by się zepsuł).
  await page.getByRole('button', { name: `Usuń projekt ${az[0]}`, exact: true }).click();
  await expect(page.locator('.lista-projektow [role=alert]')).toContainText(
    `Nie usunięto: ${az[0]}`,
  );
  await expect(kafelki).toHaveCount(3);
  const pasek = page.getByTestId('pasek-komunikatu');
  await expect(pasek).toHaveCount(0);

  // Moje projekty: zaznacz wszystkie → jeden pasek, Cofnij przywraca oba projekty.
  await page.getByRole('tab', { name: 'Moje projekty' }).click();
  await expect(kafelki).toHaveCount(2);
  await page.getByRole('button', { name: 'Zaznacz…' }).click();
  await page.getByRole('checkbox', { name: 'Zaznacz wszystkie' }).check();
  await expect(page.getByText('Zaznaczono: 2')).toBeVisible();
  await page.getByRole('button', { name: 'Usuń zaznaczone' }).click();
  await expect(kafelki).toHaveCount(0);
  await expect(pasek).toHaveCount(1);
  await expect(pasek).toContainText('Usunięto 2 elementy');
  // Kursor nad paskiem – pasek nie znika po 8 s.
  await pasek.hover();
  await page.waitForTimeout(9000);
  await expect(pasek).toBeVisible();
  await pasek.getByRole('button', { name: 'Cofnij' }).click();
  await expect(pasek).toHaveCount(0);
  await expect(kafelki).toHaveCount(2);
  await expect(page.locator('.kafelek-projektu .miniatura img').first()).toBeVisible();

  // Pojedyncze usunięcie projektu – szablony zostają w „Moich szablonach”.
  await page
    .getByRole('button', { name: /^Usuń projekt / })
    .first()
    .click();
  await expect(pasek).toContainText(/^Usunięto: /);
  await page
    .getByRole('button', { name: /^Usuń projekt / })
    .first()
    .click();
  await expect(kafelki).toHaveCount(0);

  // Moje szablony: wszystkie da się teraz usunąć naraz i przywrócić z miniaturami.
  await page.getByRole('tab', { name: 'Moje szablony' }).click();
  await expect(kafelki).toHaveCount(3);
  await page.getByRole('button', { name: 'Zaznacz…' }).click();
  await page.getByRole('checkbox', { name: 'Zaznacz wszystkie' }).check();
  await page.getByRole('button', { name: 'Usuń zaznaczone' }).click();
  await expect(kafelki).toHaveCount(0);
  await expect(pasek).toContainText('Usunięto 3 elementy');
  await pasek.getByRole('button', { name: 'Cofnij' }).click();
  await expect(kafelki).toHaveCount(3);
  await expect(page.locator('.kafelek-projektu .miniatura img')).toHaveCount(3, {
    timeout: 15000,
  });
});
