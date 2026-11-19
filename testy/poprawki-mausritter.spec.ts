import { readFile } from 'node:fs/promises';
import { eksportujProjekt } from '../src/dane/archiwum';
import { projektZPakietu } from '../src/dane/pakiet';
import type { Karta } from '../src/model/szablon';
import { pakietWlasny } from '../src/dane/wlasneKarty';
import { ustawieniaNowejKartki } from '../src/pakiety/mausritter/arkusze';
import { szablonPrzedmiot, szablonZbroja } from '../src/pakiety/mausritter/szablony';
import { expect, test, type Page } from '@playwright/test';
import { konturIkony } from '../src/silnik/ikony';
import { porownaj, przygotujStrone } from './pdfSvg';
import { konturNaD } from '../src/silnik/svg';
import { dodajKarte, karta, nowaPustaKartka, przeciagnij, slot, srodek } from './pomoc';

test.use({ viewport: { width: 1440, height: 1150 } });

const panel = (page: Page) => page.getByRole('complementary', { name: 'Zaznaczone karty' });
const pasek = (page: Page) => page.locator('.pasek-karty');
const nastepny = (page: Page, rozmiar: string) =>
  pasek(page).getByRole('button', { name: `Rozmiar: ${rozmiar}`, exact: true });

async function przedmiot(page: Page, kolumna: number, rzad: number, nazwa: string) {
  await dodajKarte(page, 1, kolumna, rzad, 'Ekwipunek', 'Przedmiot');
  await panel(page).getByLabel('Nazwa', { exact: true }).fill(nazwa);
}

test('zewnętrzne nożyczki na ręcznej kartce 1×1, 1×2 i 2×1 omijają karty', async ({ page }) => {
  test.setTimeout(60_000);
  await nowaPustaKartka(page);
  await przedmiot(page, 2, 1, 'Pionowa');
  await panel(page).getByRole('button', { name: '1×2', exact: true }).click();
  await przedmiot(page, 3, 2, 'Mała');
  await przedmiot(page, 4, 1, 'Pozioma');
  await nastepny(page, '2×1').click();
  await page.keyboard.press('Escape');

  const arkusz = page.locator('.strona-kartki').first();
  const d = konturNaD(konturIkony('nozyczki', -2.75, -2.75, 5.5));
  const ikony = arkusz.locator(`svg path[d="${d}"]`);
  await expect(ikony).toHaveCount(2);
  const prostokaty = await Promise.all(
    ['Pionowa', 'Mała', 'Pozioma'].map((n) => karta(page, n).boundingBox()),
  );
  for (const ikona of await ikony.all()) {
    const i = (await ikona.boundingBox())!;
    for (const k of prostokaty) {
      expect(k).not.toBeNull();
      const przeciecie =
        Math.min(i.x + i.width, k!.x + k!.width) - Math.max(i.x, k!.x) > 0.5 &&
        Math.min(i.y + i.height, k!.y + k!.height) - Math.max(i.y, k!.y) > 0.5;
      expect(przeciecie).toBe(false);
    }
  }
  await page.mouse.move(0, 0);
  await expect(arkusz).toHaveScreenshot('mausritter-nozyczki-trzy-rozmiary.png', {
    maxDiffPixelRatio: 0.001,
  });

  const okolice = await ikony.evaluateAll((elementy: SVGPathElement[]) =>
    elementy.map((e) => {
      const svg = e.ownerSVGElement!;
      const { x, y } = new DOMPoint().matrixTransform(
        svg.getCTM()!.inverse().multiply(e.getCTM()!),
      );
      return { x: x - 2.5, y: y - 2.5, szer: 5, wys: 5 };
    }),
  );
  const svg = await arkusz.locator('svg.svg-strony').evaluate((e) => {
    const kopia = e.cloneNode(true) as SVGSVGElement;
    kopia.querySelectorAll('image').forEach((i) => i.remove());
    return kopia.outerHTML;
  });

  for (const f of ['png', 'jpg'] as const) {
    await page.getByRole('button', { name: 'Pobierz', exact: true }).click();
    const [plik] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: `Obrazy stron – ${f.toUpperCase()}, 300 dpi` }).click(),
    ]);
    const bajty = await readFile(await plik.path());
    const ciemne = await page.evaluate(
      async ({ src, okolice }) => {
        const obraz = new Image();
        obraz.src = src;
        await obraz.decode();
        const c = document.createElement('canvas');
        c.width = obraz.naturalWidth;
        c.height = obraz.naturalHeight;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(obraz, 0, 0);
        const skala = c.width / 297;
        return okolice.map((o) => {
          const { data } = ctx.getImageData(
            o.x * skala,
            o.y * skala,
            o.szer * skala,
            o.wys * skala,
          );
          let ile = 0;
          for (let i = 0; i < data.length; i += 4)
            if (data[i]! < 128 && data[i + 1]! < 128 && data[i + 2]! < 128 && data[i + 3]) ile++;
          return ile;
        });
      },
      {
        src: `data:image/${f === 'jpg' ? 'jpeg' : 'png'};base64,${bajty.toString('base64')}`,
        okolice,
      },
    );
    for (const ile of ciemne) expect(ile).toBeGreaterThan(100);
  }

  const [pdf] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Pobierz PDF/ }).click(),
  ]);
  const bajty = await readFile(await pdf.path());
  await przygotujStrone(page);
  for (const o of okolice) {
    const p = await porownaj(page, svg, bajty, o);
    expect(p.ciemneSvg).toBeGreaterThan(100);
    expect(Math.abs(p.ciemneSvg - p.ciemnePdf) / p.ciemneSvg).toBeLessThan(0.08);
  }
});

for (const operacja of ['przeciągnięcie', 'usunięcie'] as const) {
  test(`rozmiar 2×1 wraca do cyklu po zwolnieniu slotu przez ${operacja}`, async ({ page }) => {
    await nowaPustaKartka(page);
    await przedmiot(page, 3, 2, 'Rozkładana');
    await expect(nastepny(page, '2×1')).toBeVisible();
    await nastepny(page, '2×1').click();
    await nastepny(page, '1×2').click();
    await nastepny(page, '1×1').click();

    await przedmiot(page, 4, 2, 'Sąsiednia');
    await karta(page, 'Rozkładana').click();
    await expect(nastepny(page, '2×1')).toHaveCount(0);
    await nastepny(page, '1×2').click();
    await expect(nastepny(page, '1×1')).toBeVisible();

    const sasiad = karta(page, 'Sąsiednia');
    if (operacja === 'przeciągnięcie') {
      await przeciagnij(page, await srodek(page, sasiad), await srodek(page, slot(page, 1, 6, 2)));
      await expect(sasiad).toHaveAttribute('aria-label', /kolumna 6, rząd 2/);
    } else {
      await sasiad.click();
      await pasek(page).getByRole('button', { name: 'Usuń' }).click();
      await expect(sasiad).toHaveCount(0);
    }
    await karta(page, 'Rozkładana').click();
    await nastepny(page, '1×1').click();
    await expect(nastepny(page, '2×1')).toBeVisible();
    await nastepny(page, '2×1').click();
    const wynik = (await karta(page, 'Rozkładana').boundingBox())!;
    expect(wynik.width / wynik.height).toBeCloseTo(2, 1);
  });
}

test('zwolnione 2×1 jest pierwszym dostępnym wyborem dla zbroi zapisanej jako 1×1', async ({
  page,
}) => {
  const tlo = (id: string, nazwa: string): Karta => ({
    id,
    szablonId: 'mausritter-przedmiot',
    ilosc: 1,
    dane: { nazwa },
  });
  const szablony = [szablonPrzedmiot, szablonZbroja];
  const { projekt, zasoby } = await projektZPakietu(
    {
      ...pakietWlasny(szablony),
      szablony,
      nazwa: 'Próba rozmiarów',
      talie: [
        {
          id: 'talia',
          nazwa: 'Talia',
          karty: [
            {
              id: 'zbroja',
              szablonId: 'mausritter-zbroja',
              ilosc: 1,
              rozmiar: { kolumny: 1, rzedy: 1 },
              dane: { nazwa: 'Stara zbroja' },
            },
            tlo('obok', 'Obok'),
            tlo('ponizej', 'Poniżej'),
          ],
        },
      ],
      arkusze: [
        {
          id: 'arkusz',
          taliaId: 'talia',
          nazwa: 'Kartka',
          ustawienia: ustawieniaNowejKartki('Kartka'),
          przypiete: [
            { kartaId: 'zbroja', kolumna: 2, rzad: 1 },
            { kartaId: 'obok', kolumna: 3, rzad: 1 },
            { kartaId: 'ponizej', kolumna: 2, rzad: 2 },
          ],
        },
      ],
    },
    async (f) => new Uint8Array(await readFile(`public/czcionki/${f}`)),
    () => Promise.reject(new Error('Nie ma plików obrazów.')),
    'proba-rozmiarow',
  );
  await page.goto('./#/');
  await page.getByTestId('plik-importu').setInputFiles({
    name: 'rozmiary.kartyrpg',
    mimeType: 'application/zip',
    buffer: Buffer.from(eksportujProjekt({ ...projekt, pakiet: 'mausritter' }, zasoby)),
  });
  await page.getByRole('link', { name: 'Próba rozmiarów', exact: true }).first().click();
  const zbroja = karta(page, 'Stara zbroja');
  await zbroja.click();
  const poziomy = pasek(page).getByRole('button', { name: /Rozmiar: 2×1/ });
  await expect(poziomy).toHaveCount(0);
  await karta(page, 'Obok').click();
  await pasek(page).getByRole('button', { name: 'Usuń' }).click();
  await zbroja.click();
  await expect(poziomy).toBeVisible();
  await poziomy.click();
  const obwiednia = (await zbroja.boundingBox())!;
  expect(obwiednia.width / obwiednia.height).toBeCloseTo(2, 1);
});
