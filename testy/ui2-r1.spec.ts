import { expect, test } from '@playwright/test';

test.describe('UI2 R1 – wspólne komponenty, dymek i wyrównanie linii', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('dymek paska bocznego pojawia się po opóźnieniu 0,5 s i ma tekst', async ({ page }) => {
    await page.goto('#/ui2-podglad');
    await expect(page.getByTestId('ui2-podglad')).toBeVisible();

    const przycisk = page.getByRole('button', { name: 'Swobodny' });
    const dymek = przycisk.locator('.ui2-dymek');

    await expect(dymek).toHaveText('Swobodny – dowolne położenie myszką');
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
    await page.goto('#/ui2-podglad');
    await expect(page.getByTestId('ui2-podglad')).toBeVisible();

    const pomiary = await page.evaluate(() => {
      const r = (sel: string) => {
        const el = document.querySelector(sel);
        if (!el) throw new Error(`Brak elementu ${sel}`);
        const b = el.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, height: b.height };
      };
      return {
        lewyNaglowek: r('.ui2-pasek-boczny-naglowek'),
        pasekRoboczy: r('[data-testid="ui2-pasek-roboczy"]'),
        prawyNaglowek: r('.ui2-panel-naglowek'),
        lewyDol: r('.ui2-pasek-przelacznik'),
        pasekStanu: r('[data-testid="ui2-pasek-stanu"]'),
      };
    });

    // Górna linia pod paskami (lewy nagłówek, pasek roboczy, prawy nagłówek) na tej samej wysokości.
    expect(Math.abs(pomiary.lewyNaglowek.height - 42)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(pomiary.pasekRoboczy.height - 42)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(pomiary.prawyNaglowek.height - 42)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(pomiary.lewyNaglowek.bottom - pomiary.pasekRoboczy.bottom)).toBeLessThanOrEqual(
      0.5,
    );
    expect(
      Math.abs(pomiary.prawyNaglowek.bottom - pomiary.pasekRoboczy.bottom),
    ).toBeLessThanOrEqual(0.5);

    // Dolna linia (przycisk Zwiń lewego paska i pasek stanu) – 44 px, ta sama wysokość i pozycja.
    expect(Math.abs(pomiary.lewyDol.height - 44)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(pomiary.pasekStanu.height - 44)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(pomiary.lewyDol.top - pomiary.pasekStanu.top)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(pomiary.lewyDol.bottom - pomiary.pasekStanu.bottom)).toBeLessThanOrEqual(0.5);
  });

  test('rozwinięcie paska bocznego zapamiętuje się w localStorage', async ({ page }) => {
    await page.goto('#/ui2-podglad');
    const pasek = page.getByRole('navigation', { name: 'Dodaj element' });
    await expect(pasek).toHaveAttribute('data-stan', 'zwiniety');

    await page.getByRole('button', { name: 'Rozwiń pasek' }).click();
    await expect(pasek).toHaveAttribute('data-stan', 'rozwiniety');

    await page.reload();
    await expect(pasek).toHaveAttribute('data-stan', 'rozwiniety');
  });
});
