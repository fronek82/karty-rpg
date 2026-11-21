import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { eksportujProjekt } from '../src/dane/archiwum';
import { projektZPakietu } from '../src/dane/pakiet';
import { pakietWlasny } from '../src/dane/wlasneKarty';
import type { Karta } from '../src/model/szablon';
import { arkuszeMausrittera } from '../src/pakiety/mausritter/arkusze';
import { SLOT, szablonBron, szablonPrzedmiot } from '../src/pakiety/mausritter/szablony';
import { konturIkony } from '../src/silnik/ikony';
import { konturNaD } from '../src/silnik/svg';
import { karta, kliknijPobierzPdf, otworzDruk } from './pomoc';
import { porownaj, przygotujStrone } from './pdfSvg';

const NAZWA = 'Próba linii arkusza broni';
const d = konturNaD(konturIkony('nozyczki', -2.75, -2.75, 5.5));

async function otworz(page: Page, pion: boolean) {
  const szablony = [szablonBron, szablonPrzedmiot];
  const arkusz = arkuszeMausrittera[0]!;
  const karty: Karta[] = [
    {
      id: 'oslona',
      szablonId: szablonPrzedmiot.id,
      ilosc: 1,
      dane: { nazwa: 'Duża karta' },
      rozmiar: { kolumny: pion ? 2 : 1, rzedy: pion ? 1 : 2 },
    },
    { id: 'patyk', szablonId: szablonBron.id, ilosc: 1, dane: { nazwa: 'Patyk' } },
  ];
  const { projekt, zasoby } = await projektZPakietu(
    {
      ...pakietWlasny(szablony),
      nazwa: NAZWA,
      szablony,
      talie: [{ id: arkusz.taliaId, nazwa: NAZWA, karty }],
      arkusze: [
        {
          ...arkusz,
          ustawienia: {
            ...arkusz.ustawienia,
            ...(pion
              ? { nozyczki: { ...arkusz.ustawienia.nozyczki!, linia: 'pionowa' as const } }
              : {}),
          },
          przypiete: [
            { kartaId: 'oslona', kolumna: pion ? 1 : 0, rzad: pion ? 0 : 1 },
            { kartaId: 'patyk', kolumna: 1, rzad: 1 },
          ],
        },
      ],
    },
    async (f) => new Uint8Array(await readFile(`public/czcionki/${f}`)),
    () => Promise.reject(new Error('Brak obrazów w przykładzie.')),
    'proba-znacznika-arkusza',
  );
  await page.goto('./#/');
  await page.getByTestId('plik-importu').setInputFiles({
    name: 'arkusz-broni.kartyrpg',
    mimeType: 'application/zip',
    buffer: Buffer.from(eksportujProjekt({ ...projekt, pakiet: 'mausritter' }, zasoby)),
  });
  await page.getByRole('link', { name: NAZWA, exact: true }).first().click();
  await expect(karta(page, 'Patyk')).toBeVisible();
  await expect(karta(page, 'Duża karta')).toBeVisible();
}

for (const pion of [false, true]) {
  test(`arkusz broni: jeden bezpieczny znacznik linii ${pion ? 'pionowej' : 'poziomej'}`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await otworz(page, pion);
    const plansza = page.locator('.strona-kartki').first();
    const scena = plansza.locator('.svg-opakowanie');
    const svg = scena.locator('svg.svg-strony');
    const nazwa = pion ? 'znacznik-pionowy.png' : 'znacznik-poziomy.png';
    // Przycisk pustego slotu może pojawić się pod kursorem po otwarciu kartki.
    const nakladka = await page.addStyleTag({
      content: '.strona-kartki > .warstwa { visibility: hidden }',
    });
    await expect(scena).toHaveScreenshot(nazwa, { maxDiffPixels: 25 });
    await nakladka.evaluate((e) => {
      e.parentNode?.removeChild(e);
    });
    const ikona = svg.locator(`path[d="${d}"]`);
    await expect(ikona).toHaveCount(1);
    const punkt = await ikona.evaluate((e: SVGPathElement) => {
      const svg = e.ownerSVGElement!;
      const { x, y } = new DOMPoint().matrixTransform(
        svg.getCTM()!.inverse().multiply(e.getCTM()!),
      );
      return { x, y };
    });
    const poczatek = arkuszeMausrittera[0]!.ustawienia.poczatekSiatki!;
    // W pionie kolejna linia ma wolny początek. W poziomie tytuł zasłania lewy
    // margines kolejnej linii, więc bezpieczny jest koniec odcinka przy Patyku.
    expect(pion ? punkt.x : punkt.y).toBeCloseTo(
      pion ? poczatek.x + 3 * SLOT : poczatek.y + 2 * SLOT,
      2,
    );
    const krawedz = pion ? poczatek.y : poczatek.x + 2 * SLOT;
    const stala = pion ? punkt.x : punkt.y;
    const linie = await svg
      .locator(':scope > line')
      .evaluateAll((els) =>
        els.map((e) => ['x1', 'y1', 'x2', 'y2'].map((a) => Number(e.getAttribute(a)))),
      );
    const przewodnia = pion
      ? [stala, 5 + 5.5, stala, krawedz]
      : [krawedz, stala, krawedz + 7, stala];
    expect(linie.some((l) => l.every((v, i) => Math.abs(v - przewodnia[i]!) < 0.002))).toBe(true);

    const prostokaty = [
      {
        x: poczatek.x + (pion ? SLOT : 0),
        y: poczatek.y + (pion ? 0 : SLOT),
        szer: (pion ? 2 : 1) * SLOT,
        wys: (pion ? 1 : 2) * SLOT,
      },
      { x: poczatek.x + SLOT, y: poczatek.y + SLOT, szer: SLOT, wys: SLOT },
    ];
    const E = 0.002;
    for (const [x1, y1, x2, y2] of linie as [number, number, number, number][]) {
      for (const k of prostokaty) {
        if (Math.abs(y2 - y1) < E && y1 > k.y + E && y1 < k.y + k.wys - E) {
          expect(Math.min(x2, k.x + k.szer) - Math.max(x1, k.x)).toBeLessThanOrEqual(E);
        }
        if (Math.abs(x2 - x1) < E && x1 > k.x + E && x1 < k.x + k.szer - E) {
          expect(Math.min(y2, k.y + k.wys) - Math.max(y1, k.y)).toBeLessThanOrEqual(E);
        }
      }
    }
    const obszar = pion
      ? { x: punkt.x - 3, y: punkt.y - 3, szer: 6, wys: 11 }
      : { x: punkt.x - 8, y: punkt.y - 3, szer: 11, wys: 6 };
    const svgTekst = await svg.evaluate((e) => e.outerHTML);

    await otworzDruk(page);
    for (const f of ['png', 'jpg'] as const) {
      await page.getByRole('button', { name: 'Pobierz', exact: true }).click();
      const [plik] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('menuitem', { name: `Obrazy stron – ${f.toUpperCase()}, 300 dpi` }).click(),
      ]);
      const bajty = await readFile(await plik.path());
      const piksele = await page.evaluate(
        async ({ src, obszar }) => {
          const obraz = new Image();
          obraz.src = src;
          await obraz.decode();
          const c = document.createElement('canvas');
          c.width = obraz.naturalWidth;
          c.height = obraz.naturalHeight;
          const ctx = c.getContext('2d')!;
          ctx.drawImage(obraz, 0, 0);
          const skala = c.width / 297;
          const { x, y, szer, wys } = obszar;
          const { data } = ctx.getImageData(x * skala, y * skala, szer * skala, wys * skala);
          let ile = 0;
          for (let i = 0; i < data.length; i += 4)
            if (data[i]! < 128 && data[i + 1]! < 128 && data[i + 2]! < 128 && data[i + 3]) ile++;
          return ile;
        },
        {
          src: `data:image/${f === 'jpg' ? 'jpeg' : 'png'};base64,${bajty.toString('base64')}`,
          obszar,
        },
      );
      expect(piksele).toBeGreaterThan(100);
    }
    const [pdf] = await Promise.all([page.waitForEvent('download'), kliknijPobierzPdf(page)]);
    const bajty = await readFile(await pdf.path());
    await przygotujStrone(page);
    const wynik = await porownaj(page, svgTekst, bajty, obszar);
    expect(wynik.ciemneSvg).toBeGreaterThan(100);
    expect(Math.abs(wynik.ciemnePdf - wynik.ciemneSvg) / wynik.ciemneSvg).toBeLessThan(0.08);
  });
}
