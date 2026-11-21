import { mkdir, readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ADRES_CLAUDE_API } from '../src/dane/aiUklad';

/**
 * M5-6: neutralny odbiór całego kamienia milowego M5 w PL i EN oraz w motywie jasnym i ciemnym:
 * - kuratorowana galeria szablonów online z podglądem awersu i rewersu z silnika (M5-3),
 * - automatyczne czyszczenie tekstu wklejanego z PDF w polu karty (M5-1),
 * - opcjonalna niewidoczna warstwa tekstowa w PDF (3 Tr) weryfikowana przez pdfjs-dist (M5-4),
 * - rozpoznawanie układu karty ze zdjęcia przez Claude API z zapisanej odpowiedzi offline (M5-2).
 */

const ODPOWIEDZ_AI = {
  nazwa: 'Karta kompasu AI',
  tlo: '#fbf6ea',
  promienRogowMm: 3,
  ramka: { styl: 'ciagla', kolor: '#1e3a5f', gruboscMm: 0.45, odsuniecieMm: 2 },
  pola: [
    {
      typ: 'tekst',
      nazwa: 'Nagłówek',
      xPct: 6,
      yPct: 6,
      szerPct: 88,
      wysPct: 12,
      rozmiarPt: 13,
      wariant: 'pogrubiony',
      wyrownanie: 'srodek',
      kolor: '#1e3a5f',
    },
    { typ: 'obraz', nazwa: 'Szkic', xPct: 8, yPct: 22, szerPct: 84, wysPct: 34 },
    { typ: 'tekst', nazwa: 'Notatka', xPct: 8, yPct: 60, szerPct: 84, wysPct: 32, rozmiarPt: 9 },
  ],
};

async function tekstZPdf(bajty: Uint8Array): Promise<string> {
  const zadanie = getDocument({ data: bajty, useSystemFonts: false, verbosity: 0 });
  const pdf = await zadanie.promise;
  try {
    const czesci: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const strona = await pdf.getPage(i);
      const zawartosc = await strona.getTextContent();
      czesci.push(zawartosc.items.map((el) => ('str' in el ? el.str : '')).join(' '));
    }
    return czesci.join('\n');
  } finally {
    await zadanie.destroy();
  }
}

for (const en of [false, true]) {
  for (const motyw of ['light', 'dark'] as const) {
    const jezyk = en ? 'en' : 'pl';

    test(`M5: odbiór funkcji M5-1…M5-4 w ${jezyk.toUpperCase()} i motywie ${motyw}`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width: 1440, height: 1160 });
      await page.emulateMedia({ colorScheme: motyw });
      await page.addInitScript((lang) => localStorage.setItem('karty.jezyk', lang), jezyk);

      // Wszystkie zewnętrzne domeny zablokowane poza zapisaną odpowiedzią Claude API.
      await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, async (route) => {
        if (route.request().url() === ADRES_CLAUDE_API) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              content: [{ type: 'text', text: JSON.stringify(ODPOWIEDZ_AI) }],
            }),
          });
          return;
        }
        await route.abort();
      });

      // 1. Kuratorowana galeria szablonów online z podglądem awersu + rewersu (M5-3).
      await page.goto('./#/wlasne');
      await expect(page.locator('html')).toHaveAttribute('lang', jezyk);
      await expect(page.locator('html')).toHaveAttribute('data-theme', motyw);
      const sekcja = page.locator('.galeria-online');
      await expect(sekcja.locator('[data-galeria-szablon]')).toHaveCount(5, { timeout: 15000 });

      const przedmiot = sekcja.locator('[data-galeria-szablon="przedmiot-z-rewersem"]');
      await przedmiot.getByRole('button', { name: en ? 'Preview' : 'Podgląd' }).click();
      await expect(przedmiot.locator('.galeria-podglad-svg svg')).toHaveCount(2, {
        timeout: 15000,
      });
      await expect(
        przedmiot.locator('.galeria-podglad-svg svg').nth(0).locator('defs [id]').first(),
      ).toHaveAttribute('id', /^gal-przedmiot-z-rewersem-a-/);
      await expect(
        przedmiot.locator('.galeria-podglad-svg svg').nth(1).locator('defs [id]').first(),
      ).toHaveAttribute('id', /^gal-przedmiot-z-rewersem-r-/);

      if (process.env.ZRZUTY_M5_6 === '1') {
        await sekcja.scrollIntoViewIfNeeded();
        await page.evaluate(() => document.fonts.ready);
        await page.mouse.move(0, 0);
        await mkdir('docs/obrazy/m5-6', { recursive: true });
        await page.screenshot({ path: `docs/obrazy/m5-6/${jezyk}-${motyw}.png` });
      }

      // Utwórz projekt z szablonu galerii (działa dalej lokalnie).
      await przedmiot.getByRole('button', { name: en ? 'Use template' : 'Użyj szablonu' }).click();
      await expect(page).toHaveURL(/#\/projekt\//, { timeout: 15000 });
      await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });

      // 2. Dodaj kartę z pobranego szablonu i wklej tekst z PDF w polu opisu karty (M5-1).
      await page.locator('.strona-kartki .slot').first().click();
      await page.getByRole('menu').getByRole('menuitem').first().click();
      const poleOpisu = page
        .getByRole('complementary', { name: en ? 'Selected cards' : 'Zaznaczone karty' })
        .locator('textarea')
        .first();
      await expect(poleOpisu).toBeVisible();
      await poleOpisu.fill('');

      const tekstZPdfSurowy = en
        ? 'Ancient lan-\ntern lighting\nthe trail.\n\n1. First step\n2. Second step'
        : 'Stara latar-\nnia oświetla\nżółty szlak.\n\n1. Pierwszy krok\n2. Drugi krok';
      const oczekiwanyTekst = en
        ? 'Ancient lantern lighting the trail.\n\n1. First step\n2. Second step'
        : 'Stara latarnia oświetla żółty szlak.\n\n1. Pierwszy krok\n2. Drugi krok';

      await poleOpisu.evaluate((el, tekst) => {
        const dt = new DataTransfer();
        dt.setData('text/plain', tekst);
        el.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
        );
      }, tekstZPdfSurowy);
      await expect(poleOpisu).toHaveValue(oczekiwanyTekst);

      // 3. Niewidoczna warstwa tekstowa w PDF (M5-4) – włączenie i odczyt przez pdfjs-dist.
      await page.getByRole('button', { name: new RegExp(en ? 'Settings' : 'Ustawienia') }).click();
      const przelacznikPdf = page.getByLabel(
        en
          ? 'Invisible text layer in PDF (search and copy)'
          : 'Niewidoczna warstwa tekstowa w PDF (wyszukiwanie i kopiowanie)',
      );
      await przelacznikPdf.check();
      await expect(przelacznikPdf).toBeChecked();

      const [pobranie] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: en ? 'Download PDF' : 'Pobierz PDF' }).click(),
      ]);
      const sciezkaPdf = await pobranie.path();
      expect(sciezkaPdf).toBeTruthy();
      const zawartoscPdf = await tekstZPdf(new Uint8Array(await readFile(sciezkaPdf!)));
      expect(zawartoscPdf).toContain(en ? 'lantern' : 'latarnia');
      if (!en) expect(zawartoscPdf).toContain('żółty');

      // 4. Rozpoznawanie układu ze zdjęcia AI z zapisanej odpowiedzi (M5-2).
      await page.goto('./#/wlasne/ai');
      await page.getByLabel(en ? 'Claude API key' : 'Klucz Claude API').fill('sk-ant-odbior-m5');
      await page.getByTestId('plik-zdjecia-ai').setInputFiles('testy/zasoby/podklad-testowy.png');
      await expect(page.locator('.ai-miniatura-zdjecia img')).toBeVisible();
      await page.getByRole('button', { name: en ? 'Detect layout' : 'Rozpoznaj układ' }).click();
      await expect(page.getByTestId('podglad-szablonu-ai').locator('svg')).toBeVisible({
        timeout: 15000,
      });
      await expect(
        page.getByTestId('podglad-szablonu-ai').locator('svg defs [id]').first(),
      ).toHaveAttribute('id', /^ai-/);
      await page
        .getByRole('button', {
          name: en ? 'Open in template editor' : 'Otwórz w edytorze szablonu',
        })
        .click();
      await expect(
        page.getByRole('tree', { name: en ? 'Card structure' : 'Struktura karty' }),
      ).toBeVisible({
        timeout: 15000,
      });
    });
  }
}
