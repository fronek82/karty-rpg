import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { scenyDoPdf } from '../src/druk/pdf';
import { pt } from '../src/model/jednostki';
import type { Rewers } from '../src/model/szablon';
import { renderujRewers } from '../src/silnik/karta';
import { scenaDoSvg } from '../src/silnik/svg';
import { rejestrTestowy } from '../src/silnik/__testy__/pomoc';
import { porownaj, przygotujStrone } from './pdfSvg';
import { dodaj, kreator, panel, sekcja } from './szablonUI';
import { zapisano } from './pomoc';

/**
 * M4-3: Zgodność PDF i SVG dla tekstu po łuku (góra/dół, polskie znaki, obwódka),
 * izolowanych grup krycia warstw oraz krycia i zabarwienia tekstury tła,
 * a także E2E kontrolek tych efektów w edytorze rewersu (PL i EN).
 */

const PNG_LITERA = readFileSync('testy/zasoby/litera-f.png');
const czcionki = rejestrTestowy();

test('PDF wygląda jak SVG: tekst po łuku, krycie warstw (grupa izolowana) i zabarwienie tekstury tła', async ({
  page,
}) => {
  await przygotujStrone(page);

  const rewers: Rewers = {
    id: 'rewers-m43-pdf-svg',
    nazwa: 'Rewers efekty',
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    tlo: '#f4ecd8',
    teksturaTla: 'litera-f',
    teksturaTryb: 'wypelnij',
    teksturaKrycie: 0.45,
    teksturaZabarwienie: { kolor: '#1d4ed8', krycie: 0.3 },
    ramka: { styl: 'ciagla', grubosc: 0.5, kolor: '#7c2d12', odsuniecie: 2.5, promien: 2 },
    korzen: {
      id: 'k',
      typ: 'swobodny',
      dzieci: [
        {
          id: 'gora',
          typ: 'tekst',
          tekst: 'ŻÓŁĆ I MROK',
          pozycja: { x: 5, y: 6 },
          szerokosc: { mm: 53 },
          styl: {
            czcionka: 'tytul',
            wariant: 'pogrubiony',
            rozmiar: pt(12),
            kolor: '#111827',
            wyrownanie: 'srodek',
            obwodka: { grubosc: 0.5, kolor: '#ffffff' },
          },
          luk: { promien: 36, kierunek: 'gora' },
        },
        {
          id: 'emblemat',
          typ: 'ikona',
          ikona: 'gwiazdka',
          element: 'wb:kat',
          rozmiar: 14,
          kolor: '#7c2d12',
          krycie: 0.55,
          pozycja: { x: 24.5, y: 27 },
        },
        {
          id: 'pudelko-krycie',
          typ: 'tekst',
          tekst: 'TAJEMNICA',
          krycie: 0.6,
          tlo: '#1e293b',
          obramowanie: { grubosc: 0.5, kolor: '#facc15' },
          padding: 1.5,
          pozycja: { x: 11, y: 45, obrot: 12 },
          szerokosc: { mm: 41 },
          wysokosc: { mm: 11 },
          styl: {
            czcionka: 'tytul',
            rozmiar: pt(11),
            kolor: '#ffffff',
            wyrownanie: 'srodek',
            wyrownaniePionowe: 'srodek',
            obwodka: { grubosc: 0.35, kolor: '#000000' },
          },
        },
        {
          id: 'dol',
          typ: 'tekst',
          tekst: 'KARTA PRZYGODY',
          pozycja: { x: 5, y: 66 },
          szerokosc: { mm: 53 },
          styl: {
            czcionka: 'tytul',
            rozmiar: pt(10),
            kolor: '#111827',
            wyrownanie: 'srodek',
          },
          luk: { promien: 38, kierunek: 'dol' },
        },
      ],
    },
  };

  const { scena, ostrzezenia } = renderujRewers(rewers, {
    czcionki,
    obraz: (id) => (id === 'litera-f' ? { szerokosc: 640, wysokosc: 480 } : undefined),
  });
  expect(ostrzezenia).toEqual([]);

  const { bajty } = await scenyDoPdf([scena], {
    obraz: (id) =>
      id === 'litera-f' ? { dane: new Uint8Array(PNG_LITERA), format: 'png' } : undefined,
  });
  const svg = scenaDoSvg(scena, {
    adresObrazu: (id) =>
      id === 'litera-f' ? 'data:image/png;base64,' + PNG_LITERA.toString('base64') : undefined,
  });

  const w = await porownaj(page, svg, bajty);
  test.info().annotations.push({ type: 'porównanie', description: JSON.stringify(w) });
  expect(w.ciemneSvg).toBeGreaterThan(w.wszystkie * 0.01);
  expect(Math.abs(w.ciemnePdf - w.ciemneSvg) / w.ciemneSvg).toBeLessThan(0.05);
  expect(w.rozne / w.wszystkie).toBeLessThan(0.005);
});

test('edytor rewersu: tekst po łuku, krycie warstw oraz krycie i zabarwienie tekstury tła (PL/EN)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await kreator(page, {
    nazwa: 'Karta łuku',
    format: 'Poker',
    uklad: 'Swobodny',
  });
  await page.getByRole('button', { name: 'Rób karty' }).click();
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: /Ustawienia/ }).click();
  const ust = page.getByRole('complementary', { name: 'Ustawienia' });
  await ust.getByRole('button', { name: 'Nowy rewers' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Edytor rewersu' })).toBeVisible();

  // Tekstura tła + krycie tekstury + zabarwienie kolorem.
  await page.getByTestId('plik-tekstury-rewersu').setInputFiles('testy/zasoby/litera-f.png');
  await page.getByLabel('Krycie tekstury (%)').fill('60');
  await page.getByLabel('Zabarwienie tła').check();
  await page.getByLabel('Kolor zabarwienia').fill('#1d4ed8');
  await page.getByLabel('Siła zabarwienia (%)').fill('35');

  const podgladSvg = page.locator('.karta-podgladu .svg-opakowanie svg');
  await expect(podgladSvg.locator('g[opacity="0.6"]')).toHaveCount(1);
  await expect(podgladSvg.locator('g[opacity="0.35"] rect[fill="#1d4ed8"]')).toHaveCount(1);

  // Warstwa tekstu po łuku + krycie warstwy.
  await dodaj(page, 'Tekst', 'Łuk górny');
  const p = panel(page);
  await p.getByLabel('Stały tekst').fill('ARKANA');
  await p.getByLabel('Tekst po łuku').check();
  await p.getByLabel('Promień łuku (mm)').fill('34');
  await p
    .getByRole('group', { name: 'Kierunek łuku' })
    .getByRole('button', { name: 'wklęsły (dół)', exact: true })
    .click();
  const wyglad = await sekcja(page, 'Wygląd (tło, ramka, rogi)');
  await wyglad.getByLabel('Krycie (%)').fill('75');

  await expect(podgladSvg.locator('g[opacity="0.75"]')).toHaveCount(1);
  await expect(podgladSvg.locator('use[transform^="matrix("]').first()).toBeVisible();

  await zapisano(page);

  // Przeładowanie strony i weryfikacja zachowania ustawień oraz etykiet EN.
  await page.reload();
  await expect(podgladSvg.locator('g[opacity="0.6"]')).toHaveCount(1);
  await expect(podgladSvg.locator('g[opacity="0.35"] rect[fill="#1d4ed8"]')).toHaveCount(1);
  await expect(podgladSvg.locator('g[opacity="0.75"]')).toHaveCount(1);

  await page
    .getByRole('group', { name: /^(Język|Language)$/ })
    .getByRole('button', { name: 'EN', exact: true })
    .click();
  await expect(page.getByLabel('Texture opacity (%)')).toHaveValue('60');
  await expect(page.getByLabel('Background color tint')).toBeChecked();
  await expect(page.getByLabel('Tint strength (%)')).toHaveValue('35');

  await page
    .getByRole('treeitem', { name: /^Łuk górny – / })
    .locator(':scope > .wezel-etykieta')
    .click();
  const pEn = page.getByRole('complementary', { name: 'Properties' });
  await expect(pEn.getByLabel('Curved text')).toBeChecked();
  await expect(pEn.getByLabel('Arc radius (mm)')).toHaveValue('34');
  await expect(
    pEn
      .getByRole('group', { name: 'Arc direction' })
      .getByRole('button', { name: 'concave (bottom)', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  const appearance = pEn
    .locator('details.sekcja-panelu', {
      has: page.locator(':scope > summary:text-is("Appearance (background, frame, corners)")'),
    })
    .first();
  await appearance.locator(':scope > summary').click();
  await expect(appearance.getByLabel('Opacity (%)')).toHaveValue('75');
});
