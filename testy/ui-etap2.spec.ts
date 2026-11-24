import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { kliknijPobierzPdf, nowaPustaKartka, otworzDruk, otworzUstawieniaAplikacji } from './pomoc';

/**
 * Etap 2 przebudowy UI:
 * - pośredni krok „Awers / Rewers” po „Nowy szablon od zera” (Awers → kreator, Rewers → edytor rewersu),
 * - przeniesienie „Pobierz PDF” do rozwijanego menu „Pobierz” (bez osobnego przycisku obok).
 */

test('Nowy szablon od zera: krok Przód / Tył (PL i EN), Tył przez kreator otwiera edytor tyłu', async ({
  page,
}) => {
  await page.goto('./#/wlasne/nowy');

  const menu = page.getByRole('navigation', { name: 'Strona karty' });
  const linkAwers = menu.getByRole('link', { name: /^Przód/ });
  const btnRewers = menu.getByRole('link', { name: /^Tył/ });
  await expect(linkAwers).toBeVisible();
  await expect(btnRewers).toBeVisible();

  // Awers otwiera kreator, a Anuluj wraca do wyboru strony.
  await linkAwers.click();
  await expect(page).toHaveURL(/#\/wlasne\/nowy\/awers$/);
  await expect(page.getByLabel('Nazwa szablonu')).toBeVisible();
  await page.getByRole('button', { name: 'Anuluj', exact: true }).click();
  await expect(page).toHaveURL(/#\/wlasne\/nowy$/);

  // Język angielski: Front i Back.
  const menuUst = await otworzUstawieniaAplikacji(page);
  await menuUst
    .getByRole('group', { name: /^(Język|Language)$/ })
    .getByRole('button', { name: 'EN', exact: true })
    .click();
  await page.keyboard.press('Escape');
  const menuEn = page.getByRole('navigation', { name: 'Card side' });
  await expect(menuEn.getByRole('link', { name: /^Front/ })).toBeVisible();
  await expect(menuEn.getByRole('link', { name: /^Back/ })).toBeVisible();

  // Tył: kreator (krok 1), potem nowy projekt i edytor tyłu.
  await menuEn.getByRole('link', { name: /^Back/ }).click();
  await expect(page).toHaveURL(/#\/wlasne\/nowy\/rewers$/);
  await page.getByRole('button', { name: /Next: back editor/ }).click();
  await expect(page).toHaveURL(/#\/projekt\/[^/]+\/rewers\/[^/]+$/, { timeout: 15000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Card back editor' })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByRole('tree', { name: 'Card structure' })).toBeVisible({ timeout: 15000 });
});

test('Pobierz PDF znajduje się wyłącznie w rozwijanym menu Pobierz i pobiera poprawny PDF', async ({
  page,
}) => {
  await nowaPustaKartka(page);
  await otworzDruk(page);
  await expect(page.getByRole('button', { name: /Pobierz PDF/ })).toHaveCount(0);

  const przyciskPobierz = page.getByRole('button', { name: 'Pobierz', exact: true });
  await expect(przyciskPobierz).toHaveClass(/glowny/);

  const sprawdzKontrast = async (opis: string) => {
    const { tlo, tekst } = await przyciskPobierz.evaluate((el) => {
      const naRgb = (w: string): [number, number, number] => {
        const c = document.createElement('canvas');
        c.width = 1;
        c.height = 1;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = w;
        ctx.fillRect(0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        return [r!, g!, b!];
      };
      const cs = getComputedStyle(el);
      return { tlo: naRgb(cs.backgroundColor), tekst: naRgb(cs.color) };
    });
    const lum = ([r, g, b]: [number, number, number]) => {
      const lin = (v: number) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    };
    const [a, b] = [lum(tlo), lum(tekst)].sort((x, y) => y - x);
    expect(tlo, `${opis}: białe tło przycisku głównego`).toEqual([255, 255, 255]);
    expect((a! + 0.05) / (b! + 0.05), `${opis}: kontrast AA`).toBeGreaterThanOrEqual(4.5);
  };

  await sprawdzKontrast('spoczynek');
  await przyciskPobierz.hover();
  await sprawdzKontrast('hover');
  await przyciskPobierz.click();
  await expect(przyciskPobierz).toHaveAttribute('aria-expanded', 'true');
  await sprawdzKontrast('otwarte menu');
  await page.keyboard.press('Escape');

  const [pobranie] = await Promise.all([page.waitForEvent('download'), kliknijPobierzPdf(page)]);
  expect(pobranie.suggestedFilename()).toMatch(/\.pdf$/);
  const bajty = await readFile((await pobranie.path())!);
  expect(bajty.subarray(0, 5).toString()).toBe('%PDF-');
});
