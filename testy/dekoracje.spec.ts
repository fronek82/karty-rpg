import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { karta, kartaNaKartce, dodaj, kreator, sekcja, zaznacz } from './szablonUI';
import { kliknijPobierzPdf, zapisano } from './pomoc';
import { porownaj, przygotujStrone } from './pdfSvg';

test('tekstura i postrzępiona krawędź trafiają na kartę, do PDF i pozostają po zapisaniu', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await kreator(page, {
    nazwa: 'Karta z fakturą',
    format: 'Standard / Poker',
    uklad: 'Tytuł i opis',
    rogi: 10,
  });
  const adresSzablonu = page.url();
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 120;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffb3bd';
    ctx.fillRect(0, 0, 120, 120);
    ctx.fillStyle = '#913249';
    for (let i = 0; i < 120; i += 12) ctx.fillRect(0, i, 120, 5);
    return canvas.toDataURL().split(',')[1]!;
  });
  await karta(page);
  await dodaj(page, 'Obraz');
  await kartaNaKartce(page, 'Karta z fakturą', {});
  await page.getByTestId('plik-obrazu').setInputFiles({
    name: 'faktura.png',
    mimeType: 'image/png',
    buffer: Buffer.from(base64, 'base64'),
  });
  const ilustracja = page.getByLabel('Ilustracja z biblioteki', { exact: true });
  await expect(ilustracja).toHaveValue('obraz-faktura');
  await ilustracja.selectOption('');
  await zapisano(page);
  await page.goto(adresSzablonu);
  await karta(page);

  const tlo = await sekcja(page, 'Tło karty');
  await tlo
    .getByRole('group', { name: 'Rodzaj tła' })
    .getByRole('button', { name: 'Obraz' })
    .click();
  await tlo.getByLabel('Obraz tekstury').selectOption({ label: 'faktura.png' });
  const postrzep = await sekcja(page, 'Postrzępiona krawędź');
  await postrzep.getByRole('checkbox', { name: 'Postrzępiona krawędź' }).check();
  const svg = page.locator('.karta-podgladu svg');
  await expect(svg.locator('clipPath path')).toHaveCount(1);
  await expect(svg.locator('image')).toHaveCount(1);

  await karta(page);
  await dodaj(page, 'Separator');
  await zaznacz(page, 'Separator');
  const szkic = await sekcja(page, 'Styl szkicowy');
  await szkic.getByRole('checkbox', { name: 'Styl szkicowy' }).check();
  await expect(svg.locator('path[stroke]')).toHaveCount(1);

  if (process.env.ZRZUTY_M3_5) await page.screenshot({ path: 'docs/obrazy/m3-5-dekoracje.png' });

  await zapisano(page);
  await page.reload();
  await expect(svg.locator('clipPath path')).toHaveCount(1);
  await expect(svg.locator('path[stroke]')).toHaveCount(1);
  await page.getByRole('button', { name: /Edytor kart/ }).click();
  const arkusz = page.locator('.strona-kartki .svg-strony');
  await expect(arkusz.locator('clipPath path')).toHaveCount(1);
  const krawedz = await arkusz.evaluate((svg: SVGSVGElement) => {
    const id = svg.querySelector('clipPath:has(path)')!.id;
    const grupa = svg.querySelector<SVGGraphicsElement>(`[clip-path="url(#${id})"]`)!;
    const m = svg.getCTM()!.inverse().multiply(grupa.getCTM()!);
    const p = new DOMPoint(0, 0).matrixTransform(m);
    return { x: p.x + 3, y: p.y, szer: 57, wys: 1.1 };
  });
  const tekstSvg = (await arkusz.evaluate((e) => e.outerHTML)).replace(
    /href="blob:[^"]+"/g,
    `href="data:image/png;base64,${base64}"`,
  );
  const [pobranie] = await Promise.all([page.waitForEvent('download'), kliknijPobierzPdf(page)]);
  const pdf = await readFile(await pobranie.path());
  await przygotujStrone(page);
  const wynik = await porownaj(page, tekstSvg, pdf, krawedz);
  expect(wynik.ciemneSvg).toBeGreaterThan(100);
  expect(wynik.ciemneSvg / wynik.wszystkie).toBeLessThan(0.9);
  expect(Math.abs(wynik.ciemnePdf - wynik.ciemneSvg) / wynik.wszystkie).toBeLessThan(0.12);
});
