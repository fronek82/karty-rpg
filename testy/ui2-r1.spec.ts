import { expect, test } from '@playwright/test';

async function otworzEdytor(page: import('@playwright/test').Page) {
  await page.goto('./');
  await page.getByTestId('start-nowe-karty').click();
  const okno = page.getByRole('dialog', { name: 'Nowy projekt' });
  await expect(okno).toBeVisible();
  await okno.getByRole('button', { name: 'Utwórz projekt' }).click();
  await expect(page.locator('.karta-podgladu')).toBeVisible();
}

test.describe('UI2 R1 – wspólne komponenty, dymek i wyrównanie linii (na prawdziwym edytorze)', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('dymek paska bocznego pojawia się po opóźnieniu 0,5 s i ma tekst', async ({ page }) => {
    await otworzEdytor(page);

    const przycisk = page
      .getByRole('navigation', { name: 'Dodaj element' })
      .getByRole('button', { name: 'Swobodny', exact: true });
    const dymek = przycisk.locator('.ui2-dymek');

    await expect(dymek).toContainText('Swobodny');
    await expect(dymek).toHaveCSS('visibility', 'hidden');

    await przycisk.hover();
    // Zaraz po najechaniu (100 ms) dymek nie jest jeszcze widoczny (opóźnienie 0,5 s).
    await page.waitForTimeout(100);
    await expect(dymek).toHaveCSS('visibility', 'hidden');

    // Po upływie opóźnienia (łącznie > 600 ms) dymek jest widoczny i czytelny.
    await expect(dymek).toHaveCSS('visibility', 'visible', { timeout: 1500 });
    await expect(dymek).toHaveCSS('opacity', '1');

    // Po zjechaniu myszą znika od razu.
    await page.mouse.move(600, 400);
    await expect(dymek).toHaveCSS('visibility', 'hidden');
  });

  test('wysokości pasków i poziome linie sąsiednich kolumn są równe', async ({ page }) => {
    await otworzEdytor(page);

    const pomiary = await page.evaluate(() => {
      const r = (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`Brak elementu ${sel}`);
        const b = el.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, height: b.height };
      };
      return {
        lewyNaglowek: r('.ui2-pasek-boczny-naglowek'),
        pasekZakladek: r('.edytor-ui2-zakladki'),
        lewyDol: r('.ui2-pasek-przelacznik'),
        pasekStanu: r('[data-testid="pasek-stanu-edytora"]'),
      };
    });

    // Górna linia pod paskami (lewy nagłówek i pasek zakładek) – 42 px na tej samej wysokości.
    expect(Math.abs(pomiary.lewyNaglowek.height - 42)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(pomiary.pasekZakladek.height - 42)).toBeLessThanOrEqual(0.5);
    expect(
      Math.abs(pomiary.lewyNaglowek.bottom - pomiary.pasekZakladek.bottom),
    ).toBeLessThanOrEqual(0.5);

    // Dolna linia (przycisk Zwiń lewego paska i pasek stanu) – 44 px, ta sama wysokość i pozycja.
    expect(Math.abs(pomiary.lewyDol.height - 44)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(pomiary.pasekStanu.height - 44)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(pomiary.lewyDol.top - pomiary.pasekStanu.top)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(pomiary.lewyDol.bottom - pomiary.pasekStanu.bottom)).toBeLessThanOrEqual(0.5);
  });

  test('rozwinięcie paska bocznego zapamiętuje się w localStorage', async ({ page }) => {
    await otworzEdytor(page);
    const pasek = page.getByRole('navigation', { name: 'Dodaj element' });
    await expect(pasek).toHaveAttribute('data-stan', 'zwiniety');

    await page.getByRole('button', { name: /Rozwiń pasek/i }).click();
    await expect(pasek).toHaveAttribute('data-stan', 'rozwiniety');

    await page.reload();
    await expect(pasek).toHaveAttribute('data-stan', 'rozwiniety');
  });
});
