import { expect, type Page } from '@playwright/test';

/** Wspólne kroki testów edytora kartki. */

export async function nowaPustaKartka(page: Page) {
  await page.goto('./#/');
  await page.getByTestId('start-mausritter').click();
  await page.getByTestId('start-pusty-arkusz').click();
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
}

export async function gotowyUklad(page: Page, nazwa: string) {
  await page.goto('./#/');
  await page.getByTestId('start-mausritter').click();
  const wzorzec = new RegExp(`^${nazwa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
  await page.getByTestId('okno-startu-mausritter').getByRole('button', { name: wzorzec }).click();
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

export async function zapisano(page: Page) {
  const przycisk = page
    .locator('.pasek-gorny, header.ui2-naglowek')
    .getByRole('button', { name: 'Zapisz', exact: true });
  if (await przycisk.isVisible().catch(() => false)) {
    if (await przycisk.isEnabled().catch(() => false)) await przycisk.click();
  }
  await expect(page.locator('.status-zapisu, .ui2-stan-zapisu')).toHaveText(
    /^(Zapisano|✓ zapisano)$/,
  );
}

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

/** Przechodzi do widoku „Drukuj karty” (jeśli jeszcze nie otwarty) i zwraca stały panel opcji druku. */
export const panelDruku = (page: Page, en = false) =>
  page.getByRole('complementary', {
    name: en ? 'Print & sheet options' : 'Opcje druku i arkusza',
  });

export async function otworzDruk(page: Page, en = false) {
  const panel = panelDruku(page, en);
  if (!(await panel.isVisible())) {
    await page
      .getByRole('link', { name: en ? /^(Print cards|Go to print)/ : /^(Drukuj karty|Do druku)/ })
      .click();
    await expect(panel).toBeVisible({ timeout: 15000 });
  }
  return panel;
}

/** Otwiera górne rozwijane menu „Ustawienia” / „Settings” i zwraca jego panel. */
export async function otworzUstawieniaAplikacji(page: Page) {
  const przycisk = page.getByRole('button', { name: /^(⚙\s*)?(Ustawienia|Settings)(\s*▾)?$/ });
  if ((await przycisk.getAttribute('aria-expanded')) !== 'true') {
    await przycisk.click();
  }
  const panel = page.locator('.menu-ustawien-panel, .ui2-ustawienia-panel');
  await expect(panel).toBeVisible();
  return panel;
}

/** Otwiera okno „Kopia i import” na stronie startowej (UI2 R2). */
export async function otworzImport(page: Page) {
  await page.getByRole('button', { name: /^(Kopia i import|Backup & import)$/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

/** Zamyka otwarte okno „Kopia i import” po zakończeniu importu. */
export async function zamknijImport(page: Page) {
  const okno = page.getByRole('dialog');
  if (await okno.isVisible()) {
    await page.keyboard.press('Escape');
    await expect(okno).toHaveCount(0);
  }
}

/** Otwiera rozwijane menu „Pobierz” (w razie potrzeby przechodzi najpierw do „Drukuj karty”) i klika „Pobierz PDF (do druku)”. */
export async function kliknijPobierzPdf(page: Page, en = false) {
  const pobierz = page.getByRole('button', { name: en ? 'Download' : 'Pobierz', exact: true });
  if (!(await pobierz.isVisible())) {
    await otworzDruk(page, en);
  }
  await pobierz.click();
  await page
    .getByRole('menuitem', {
      name: en ? 'Download PDF (for printing)' : 'Pobierz PDF (do druku)',
    })
    .click();
}
