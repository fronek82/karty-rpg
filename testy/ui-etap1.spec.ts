import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Etap 1 przebudowy UI:
 * - gradacja kolorów menu (jasny = jaśnieją, ciemny = ciemnieją) z kontrastem AA,
 * - przyciski akcji po lewej stronie w „Nowy szablon karty” i „Układ ze zdjęcia (AI)”
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
  test(`gradacja kolorów menu i układ kreatora/AI (${motyw})`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.emulateMedia({ colorScheme: motyw });

    // 1) Start: krok 1 dla obu ścieżek.
    await page.goto('./#/');
    await page.mouse.move(0, 0);
    const startWlasne = page.getByRole('link', { name: /Stwórz własne karty/ });
    const startGra = page.getByRole('link', { name: /Stwórz karty do Mausrittera/ });
    const kWlasne1 = await kolory(startWlasne);
    const kGra1 = await kolory(startGra);
    expect(kontrastRgb(kWlasne1.tekst, kWlasne1.tlo)).toBeGreaterThanOrEqual(4.5);
    expect(kontrastRgb(kGra1.tekst, kGra1.tlo)).toBeGreaterThanOrEqual(4.5);

    // 2) Mausritter: krok 2 (morski) + filtrowanie środka.
    await startGra.click();
    await page.mouse.move(0, 0);
    const menuGry = page.getByRole('navigation', { name: 'Od czego zacząć' });
    const btnPusta = menuGry.getByRole('button', { name: /^Pusta kartka/ });
    const btnUklady = menuGry.getByRole('button', { name: /^Zacznij od gotowego układu/ });
    const kGra2 = await kolory(btnPusta);
    expect(kGra2.tlo).toBe((await kolory(btnUklady)).tlo);
    expect(kontrastRgb(kGra2.tekst, kGra2.tlo)).toBeGreaterThanOrEqual(4.5);
    if (motyw === 'light') expect(kGra2.lum).toBeGreaterThan(kGra1.lum);
    else expect(kGra2.lum).toBeLessThan(kGra1.lum);

    await expect(page.locator('[data-grupa="pusta"]')).toBeVisible();
    await expect(page.locator('[data-grupa="uklady"]')).toHaveCount(0);
    await btnUklady.click();
    await expect(page.locator('[data-grupa="uklady"]')).toBeVisible();
    await expect(page.locator('[data-grupa="pusta"]')).toHaveCount(0);

    // 3) Własne karty: krok 2 (terakota) i szerokość kafelków menu.
    await page.goto('./#/wlasne');
    await page.mouse.move(0, 0);
    const linkNowy = page.getByRole('link', { name: /Nowy szablon od zera/ });
    const linkAi = page.getByRole('link', { name: /Układ ze zdjęcia \(AI\)/ });
    const btnImport = page.getByRole('button', { name: /Importuj szablon/ });
    const kWlasne2 = await kolory(linkNowy);
    expect(kWlasne2.tlo).toBe((await kolory(linkAi)).tlo);
    expect(kWlasne2.tlo).toBe((await kolory(btnImport)).tlo);
    expect(kontrastRgb(kWlasne2.tekst, kWlasne2.tlo)).toBeGreaterThanOrEqual(4.5);
    if (motyw === 'light') expect(kWlasne2.lum).toBeGreaterThan(kWlasne1.lum);
    else expect(kWlasne2.lum).toBeLessThan(kWlasne1.lum);
    const szerMenu = (await linkNowy.boundingBox())!.width;

    // 4) Krok 3 (Awers / Rewers) po kliknięciu „Nowy szablon od zera”.
    await linkNowy.click();
    await page.mouse.move(0, 0);
    const linkAwers = page.getByRole('link', { name: /^Awers/ });
    const btnRewers = page.getByRole('button', { name: /^Rewers/ });
    const kWlasne3 = await kolory(linkAwers);
    expect(kWlasne3.tlo).toBe((await kolory(btnRewers)).tlo);
    expect(kontrastRgb(kWlasne3.tekst, kWlasne3.tlo)).toBeGreaterThanOrEqual(4.5);
    if (motyw === 'light') expect(kWlasne3.lum).toBeGreaterThan(kWlasne2.lum);
    else expect(kWlasne3.lum).toBeLessThan(kWlasne2.lum);

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
    expect(kontrastRgb(kWlasne4.tekst, kWlasne4.tlo)).toBeGreaterThanOrEqual(4.5);
    if (motyw === 'light') expect(kWlasne4.lum).toBeGreaterThan(kWlasne3.lum);
    else expect(kWlasne4.lum).toBeLessThan(kWlasne3.lum);

    const kAnuluj = await kolory(anuluj);
    expect(kAnuluj.tlo).toBe(await tloStrony(page));
    expect(kontrastRgb(kAnuluj.tekst, kAnuluj.tlo)).toBeGreaterThanOrEqual(4.5);

    // 6) Układ ze zdjęcia (AI): Rozpoznaj i Anuluj w lewym menu, te same kolory i szerokość.
    await page.goto('./#/wlasne/ai');
    const rozpoznaj = page.getByRole('button', { name: 'Rozpoznaj układ', exact: true });
    const anulujAi = page.getByRole('link', { name: 'Anuluj', exact: true });
    const formAi = page.locator('.kreator-formularz');
    const bRozp = (await rozpoznaj.boundingBox())!;
    const bAnulujAi = (await anulujAi.boundingBox())!;
    const bFormAi = (await formAi.boundingBox())!;
    expect(bRozp.x + bRozp.width).toBeLessThan(bFormAi.x);
    expect(Math.abs(bRozp.width - szerMenu)).toBeLessThanOrEqual(2);
    expect(Math.abs(bAnulujAi.width - szerMenu)).toBeLessThanOrEqual(2);

    expect((await kolory(rozpoznaj)).tlo).toBe(kWlasne4.tlo);
    expect((await kolory(anulujAi)).tlo).toBe(await tloStrony(page));

    // Hover na kolorowym przycisku nie wprowadza niebieskiego obrysu i zachowuje kontrast AA.
    await rozpoznaj.hover();
    const kHover = await kolory(rozpoznaj);
    expect(kontrastRgb(kHover.tekst, kHover.tlo)).toBeGreaterThanOrEqual(4.5);
    const obrysHover = await rozpoznaj.evaluate((e) => getComputedStyle(e).borderTopColor);
    expect(obrysHover).not.toBe('rgb(27, 127, 168)');
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
