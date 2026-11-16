import { expect, type Page } from '@playwright/test';

/** Wspólne kroki testów edytora kartki. */

export async function nowaPustaKartka(page: Page) {
  await page.goto('./#/');
  await page.getByRole('link', { name: /Stwórz karty do Mausrittera/ }).click();
  await page.getByRole('button', { name: /Pusta kartka/ }).click();
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
}

export async function gotowyUklad(page: Page, nazwa: string) {
  await page.goto('./#/gra/mausritter');
  await page.getByRole('button', { name: nazwa, exact: true }).click();
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
}

export const slot = (page: Page, s: number, k: number, r: number) =>
  page.getByRole('button', {
    name: `Pusty slot – strona ${s}, kolumna ${k}, rząd ${r}. Dodaj kartę`,
    exact: true,
  });

/** Karta po nazwie (początek etykiety „nazwa – strona …”). */
export const karta = (page: Page, nazwa: string) =>
  page.locator(`[data-karta][aria-label^="${nazwa} – "]`);

export async function dodajKarte(
  page: Page,
  s: number,
  k: number,
  r: number,
  typ: string,
  wariant?: string,
) {
  await slot(page, s, k, r).click();
  await page.getByRole('menuitem', { name: new RegExp(typ) }).click();
  if (wariant) await page.getByRole('menuitem', { name: wariant, exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Zaznaczone karty' })).toBeVisible();
}

export const zapisano = (page: Page) =>
  expect(page.locator('.status-zapisu')).toHaveText('Zapisano');

/** Środek elementu w pikselach ekranu. */
export async function srodek(_page: Page, selektor: ReturnType<Page['locator']>) {
  const r = (await selektor.boundingBox())!;
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

/** Przeciągnięcie myszą między dwoma punktami. */
export async function przeciagnij(
  page: Page,
  z: { x: number; y: number },
  do_: { x: number; y: number },
) {
  await page.mouse.move(z.x, z.y);
  await page.mouse.down();
  await page.mouse.move(do_.x, do_.y, { steps: 10 });
  await page.mouse.up();
}
