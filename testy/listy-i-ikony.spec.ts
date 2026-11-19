import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { kartaNaKartce, kreator, panel, zaznacz } from './szablonUI';
import { porownaj, przygotujStrone } from './pdfSvg';

test('listy i ikony zachowują wygląd w edytorze, na arkuszu i w pobranych plikach', async ({
  page,
}) => {
  const opis =
    '1. Najpierw sprawdź znak :star: i zdecyduj, jak poprowadzisz dalszą drogę.\n8. Wytnij :scissors: gotową kartę.';
  await kreator(page, {
    nazwa: 'Karta wyprawy',
    format: 'Standard / Poker',
    uklad: 'Tytuł i opis',
  });
  await zaznacz(page, 'Opis');
  const p = panel(page);
  await p.getByLabel('Wartość przykładowa').fill(opis);
  const rysunki = page.locator('.karta-podgladu svg path[fill]');
  await expect(rysunki).toHaveCount(0);
  await p.getByRole('checkbox', { name: 'Listy numerowane' }).check();
  await p.getByRole('checkbox', { name: 'Ikony w tekście' }).check();
  await expect(rysunki).toHaveCount(2);
  if (process.env.ZRZUTY_M3_3)
    await page.screenshot({ path: 'docs/obrazy/m3-3-listy-i-ikony.png' });

  await kartaNaKartce(page, 'Karta wyprawy', { Opis: opis });
  const svgStrony = page.locator('.strona-kartki .svg-strony');
  await expect(svgStrony.locator('path[fill]')).toHaveCount(2);
  const { svg, szer, wys } = await svgStrony.evaluate((e: SVGSVGElement) => ({
    svg: e.outerHTML,
    szer: e.viewBox.baseVal.width,
    wys: e.viewBox.baseVal.height,
  }));
  const obszary = await svgStrony.locator('path[fill]').evaluateAll((elementy) =>
    elementy.map((e) => {
      const p = e as SVGGraphicsElement;
      const { x, y, width: szer, height: wys } = p.getBBox();
      const macierz = p.ownerSVGElement!.getCTM()!.inverse().multiply(p.getCTM()!);
      const a = new DOMPoint(x, y).matrixTransform(macierz);
      const b = new DOMPoint(x + szer, y + wys).matrixTransform(macierz);
      return { x: a.x, y: a.y, szer: b.x - a.x, wys: b.y - a.y };
    }),
  );

  const [pdf] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Pobierz PDF/ }).click(),
  ]);
  const bajtyPdf = await readFile(await pdf.path());

  await page.getByRole('button', { name: 'Pobierz', exact: true }).click();
  const [png] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('menuitem', { name: 'Obrazy stron – PNG, 300 dpi', exact: true }).click(),
  ]);
  const bajtyPng = await readFile(await png.path());
  expect([...bajtyPng.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const obszaryPng = await page.evaluate(
    async ({ src, obszary, szer, wys }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const canvas = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const skalaX = img.naturalWidth / szer;
      const skalaY = img.naturalHeight / wys;
      return obszary.map((r) => {
        const { data } = ctx.getImageData(
          Math.floor(r.x * skalaX),
          Math.floor(r.y * skalaY),
          Math.ceil(r.szer * skalaX),
          Math.ceil(r.wys * skalaY),
        );
        let ciemne = 0;
        for (let i = 0; i < data.length; i += 4)
          if ((data[i]! + data[i + 1]! + data[i + 2]!) / 3 < 128) ciemne++;
        return ciemne;
      });
    },
    { src: `data:image/png;base64,${bajtyPng.toString('base64')}`, obszary, szer, wys },
  );
  await przygotujStrone(page);
  for (const [i, obszar] of obszary.entries()) {
    const wynik = await porownaj(page, svg, bajtyPdf, obszar);
    expect(wynik.ciemneSvg).toBeGreaterThan(40);
    expect(wynik.rozne / wynik.wszystkie).toBeLessThan(0.08);
    expect(obszaryPng[i]! / wynik.ciemneSvg).toBeGreaterThan(0.75);
    expect(obszaryPng[i]! / wynik.ciemneSvg).toBeLessThan(1.25);
  }
});
