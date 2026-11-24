import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Etap 1 przebudowy UI:
 * - gradacja kolorów menu (jasny = jaśnieją, ciemny = ciemnieją) z kontrastem AA,
 * - przyciski akcji po lewej stronie w „Nowy szablon karty”
 *   (główny w kolorze kroku, Anuluj w kolorze tła, szerokość jak w poprzednim menu),
 * - filtrowanie środka na ekranie Mausrittera (tylko Pusta kartka albo tylko Gotowe układy).
 */

function luminancjaRgb(rgb: string): number {
  const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map((x) => {
    const v = Number(x) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

function kontrastRgb(a: string, b: string): number {
  const [x, y] = [luminancjaRgb(a), luminancjaRgb(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

async function kolory(el: Locator): Promise<{ tlo: string; tekst: string; lum: number }> {
  return el.evaluate((e) => {
    const naRgb = (wartosc: string): [number, number, number] => {
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = wartosc;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      return [r!, g!, b!];
    };
    const cs = getComputedStyle(e);
    const [r, g, b] = naRgb(cs.backgroundColor);
    const [tr, tg, tb] = naRgb(cs.color);
    const lin = (v: number) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    return {
      tlo: `rgb(${r}, ${g}, ${b})`,
      tekst: `rgb(${tr}, ${tg}, ${tb})`,
      lum: 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b),
    };
  });
}

async function tloStrony(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

for (const motyw of ['light', 'dark'] as const) {
  test(`jednolite kolory kroków menu, Awers/Rewers i układ kreatora (${motyw})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.emulateMedia({ colorScheme: motyw });

    // 1) Start: krok 1 dla obu ścieżek.
    await page.goto('./#/');
    await page.mouse.move(0, 0);
    const startWlasne = page.getByRole('link', { name: /Stwórz własne karty/ });
    const startGra = page.getByRole('link', { name: /Stwórz karty do Mausrittera/ });
    const kWlasne1 = await kolory(startWlasne);
    const kGra1 = await kolory(startGra);
    if (motyw === 'dark') {
      expect(kontrastRgb(kWlasne1.tekst, kWlasne1.tlo)).toBeGreaterThanOrEqual(4.5);
      expect(kontrastRgb(kGra1.tekst, kGra1.tlo)).toBeGreaterThanOrEqual(4.5);
    }

    // 2) Mausritter: krok 2 ma ten sam kolor co krok 1 (bez rozjaśnień) + filtrowanie środka.
    await startGra.click();
    await page.mouse.move(0, 0);
    const menuGry = page.getByRole('navigation', { name: 'Od czego zacząć' });
    const btnPusta = menuGry.getByRole('button', { name: /^Pusta kartka/ });
    const btnUklady = menuGry.getByRole('button', { name: /^Zacznij od gotowego układu/ });
    const kGra2 = await kolory(btnPusta);
    expect(kGra2.tlo).toBe((await kolory(btnUklady)).tlo);
    expect(kGra2.tlo).toBe(kGra1.tlo);
    if (motyw === 'dark') expect(kontrastRgb(kGra2.tekst, kGra2.tlo)).toBeGreaterThanOrEqual(4.5);

    await expect(page.locator('[data-grupa="pusta"]')).toBeVisible();
    await expect(page.locator('[data-grupa="uklady"]')).toHaveCount(0);
    await btnUklady.click();
    await expect(page.locator('[data-grupa="uklady"]')).toBeVisible();
    await expect(page.locator('[data-grupa="pusta"]')).toHaveCount(0);

    // 3) Własne karty: krok 2 ma ten sam kolor co krok 1 i stałą szerokość kafelków menu.
    await page.goto('./#/wlasne');
    await page.mouse.move(0, 0);
    const btnImport = page.getByRole('button', { name: /Importuj szablon/ });
    const kWlasne2 = await kolory(btnImport);
    expect(kWlasne2.tlo).toBe(kWlasne1.tlo);
    if (motyw === 'dark') {
      expect(kontrastRgb(kWlasne2.tekst, kWlasne2.tlo)).toBeGreaterThanOrEqual(4.5);
    }
    const szerMenu = (await btnImport.boundingBox())!.width;

    // 4) Wybór strony (Awers / Rewers) – odrębne kolory.
    await page.goto('./#/wlasne/nowy');
    await page.mouse.move(0, 0);
    const linkAwers = page.getByRole('link', { name: /^Przód/ });
    const btnRewers = page.getByRole('link', { name: /^Tył/ });
    const kAwers = await kolory(linkAwers);
    const kRewers = await kolory(btnRewers);
    expect(kAwers.tlo).not.toBe(kRewers.tlo);
    if (motyw === 'dark') {
      expect(kontrastRgb(kAwers.tekst, kAwers.tlo)).toBeGreaterThanOrEqual(4.5);
      expect(kontrastRgb(kRewers.tekst, kRewers.tlo)).toBeGreaterThanOrEqual(4.5);
    }

    // 5) Krok 4: Kreator nowego szablonu (Awers) – przyciski w lewym menu, tej samej szerokości; Anuluj = tło.
    await linkAwers.click();
    await page.mouse.move(0, 0);
    const dalej = page.getByRole('button', { name: /Dalej: układ pól/ });
    const anuluj = page.getByRole('button', { name: 'Anuluj', exact: true });
    const formularz = page.locator('.kreator-formularz');
    const bDalej = (await dalej.boundingBox())!;
    const bAnuluj = (await anuluj.boundingBox())!;
    const bForm = (await formularz.boundingBox())!;
    expect(bDalej.x + bDalej.width).toBeLessThan(bForm.x);
    expect(Math.abs(bDalej.width - szerMenu)).toBeLessThanOrEqual(2);
    expect(Math.abs(bAnuluj.width - szerMenu)).toBeLessThanOrEqual(2);

    const kWlasne4 = await kolory(dalej);
    expect(kWlasne4.tlo).toBe(kWlasne1.tlo);
    if (motyw === 'dark') {
      expect(kontrastRgb(kWlasne4.tekst, kWlasne4.tlo)).toBeGreaterThanOrEqual(4.5);
    }

    const kAnuluj = await kolory(anuluj);
    expect(kAnuluj.tlo).toBe(await tloStrony(page));
    expect(kontrastRgb(kAnuluj.tekst, kAnuluj.tlo)).toBeGreaterThanOrEqual(4.5);
  });
}

test('kreator: na mobile formularz jest nad przyciskami, a Enter zatwierdza formularz', async ({
  page,
}) => {
  await page.setViewportSize({ width: 420, height: 900 });
  await page.goto('./#/wlasne/nowy/awers');
  const form = (await page.locator('.kreator-formularz').boundingBox())!;
  const dalej = (await page.getByRole('button', { name: /Dalej: układ pól/ }).boundingBox())!;
  expect(dalej.y).toBeGreaterThan(form.y);

  const nazwa = page.getByLabel('Nazwa szablonu');
  await nazwa.fill('Karta z Entera');
  await nazwa.press('Enter');
  await expect(page.getByRole('tree', { name: 'Struktura karty' })).toBeVisible({ timeout: 15000 });
});
