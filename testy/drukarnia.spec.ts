import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { zbudujArkusz } from '../src/druk/arkusz';
import { zbudujStronyRewersow } from '../src/druk/dwustronny';
import { scenyDoPdf } from '../src/druk/pdf';
import type { Arkusz } from '../src/model/arkusz';
import { PT_NA_MM, pt } from '../src/model/jednostki';
import type { Karta, Rewers, Szablon, Talia } from '../src/model/szablon';
import { scenaDoSvg } from '../src/silnik/svg';
import { rejestrTestowy } from '../src/silnik/__testy__/pomoc';
import { porownaj, przygotujStrone } from './pdfSvg';
import {
  kliknijPobierzPdf,
  otworzDruk,
  otworzUstawieniaAplikacji,
  panelDruku,
  zapisano,
} from './pomoc';
import { dodaj, kreator } from './szablonUI';

/**
 * M4-5: Tryb drukarni (spad, znaczniki cięcia, układ siatki i pojedynczej karty,
 * ostrzeżenia efektywnego DPI, trwałość po przeładowaniu, PL/EN, oba motywy)
 * oraz zgodność pikseli PDF↔SVG dla spadu i znaczników.
 */

const czcionki = rejestrTestowy();

test('PDF wygląda jak SVG: tryb drukarni (siatka i pojedyncza karta ze spadem 3 mm, znacznikami i rewersem)', async ({
  page,
}) => {
  await przygotujStrone(page);

  const szablon: Szablon = {
    id: 's-druk',
    nazwa: 'Drukarska',
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    promienRogow: 3,
    tlo: '#1e293b',
    ramka: { styl: 'ciagla', grubosc: 0.5, kolor: '#f59e0b', odsuniecie: 2.5 },
    korzen: {
      id: 'k',
      typ: 'kolumna',
      padding: 4,
      dzieci: [
        {
          id: 'tytul',
          typ: 'tekst',
          klucz: 'nazwa',
          styl: { czcionka: 'tytul', rozmiar: pt(12), kolor: '#ffffff', wyrownanie: 'srodek' },
        },
        {
          id: 'ikona',
          typ: 'ikona',
          ikona: 'gwiazdka',
          element: 'wb:gwiazda',
          rozmiar: 18,
          kolor: '#facc15',
        },
      ],
    },
  };
  const rewers: Rewers = {
    id: 'rev-druk',
    nazwa: 'Rewers drukarski',
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    tlo: '#7c2d12',
    ramka: { styl: 'ciagla', grubosc: 0.5, kolor: '#fef3c7', odsuniecie: 2.5 },
    korzen: {
      id: 'rk',
      typ: 'swobodny',
      dzieci: [
        {
          id: 'znak',
          typ: 'ikona',
          ikona: 'gwiazdka',
          rozmiar: 14,
          kolor: '#fde68a',
          pozycja: { x: 24, y: 36 },
        },
      ],
    },
  };
  const karty: Karta[] = [
    { id: 'k1', szablonId: szablon.id, ilosc: 1, dane: { nazwa: 'Karta 1' } },
    { id: 'k2', szablonId: szablon.id, ilosc: 1, dane: { nazwa: 'Karta 2' } },
  ];
  const talia: Talia = { id: 't1', nazwa: 'Talia', karty, rewersId: rewers.id };
  const ctx = { czcionki, szablony: new Map([[szablon.id, szablon]]) };

  for (const uklad of ['siatka', 'pojedyncza'] as const) {
    const arkusz: Arkusz = {
      id: `a-${uklad}`,
      nazwa: 'Arkusz',
      taliaId: talia.id,
      ustawienia: {
        papier: 'A4',
        orientacja: 'pionowa',
        marginesy: { gora: 10, prawo: 10, dol: 10, lewo: 10 },
        linie: { grubosc: 0.2, kolor: '#888888', kreska: 2, przerwa: 2 },
        drukarnia: { wlaczony: true, spad: 3, znacznikiCiecia: true, uklad },
        dwustronny: { wlaczony: true, krawedz: 'dluga' },
      },
    };
    const przod = zbudujArkusz(arkusz, talia, ctx);
    const tyly = zbudujStronyRewersow(arkusz, talia, przod, {
      ...ctx,
      rewersy: new Map([[rewers.id, rewers]]),
    });
    for (const scena of [przod.strony[0]!, tyly.strony[0]!]) {
      const { bajty } = await scenyDoPdf([scena]);
      const pdf = await PDFDocument.load(bajty);
      const { width, height } = pdf.getPage(0).getSize();
      expect(width / PT_NA_MM).toBeCloseTo(scena.szer, 1);
      expect(height / PT_NA_MM).toBeCloseTo(scena.wys, 1);
      const svg = scenaDoSvg(scena);
      const w = await porownaj(page, svg, bajty);
      expect(w.ciemneSvg).toBeGreaterThan(w.wszystkie * 0.01);
      expect(Math.abs(w.ciemnePdf - w.ciemneSvg) / w.ciemneSvg).toBeLessThan(0.05);
      expect(w.rozne / w.wszystkie).toBeLessThan(0.005);
    }
  }
});

test('tryb drukarni E2E: spad, znaczniki, ostrzeżenie DPI, układ pojedynczej karty, PDF i PL/EN + ciemny motyw', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await kreator(page, {
    nazwa: 'Karta drukarska',
    format: 'Poker',
    uklad: 'Swobodny',
  });
  await dodaj(page, 'Obraz', 'Ilustracja');
  await page.getByRole('button', { name: /Przejdź do kart/ }).click();
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });

  // Dodaj kartę z rastrem 640×480 px (litera-f.png) i powiększ kadr 3×, żeby efektywne DPI spadło poniżej 300.
  await page.locator('.strona-kartki .slot').first().click();
  await page.getByRole('menu').getByRole('menuitem').first().click();
  const panelKarty = page.getByRole('complementary', { name: 'Zaznaczone karty' });
  await expect(panelKarty).toBeVisible();
  await panelKarty.locator('input[type="file"]').setInputFiles('testy/zasoby/litera-f.png');
  await panelKarty.getByLabel('Skala').fill('3');
  await zapisano(page);

  // Otwórz widok drukowania i włącz Tryb drukarni.
  const ust = await otworzDruk(page);
  const wlacz = ust.getByLabel('Przygotuj do drukarni (spad i znaczniki cięcia)');
  await expect(wlacz).not.toBeChecked();
  await wlacz.check();
  await expect(ust.getByLabel('Spad (mm)')).toHaveValue('3');
  await expect(ust.getByLabel('Znaczniki cięcia', { exact: true })).toBeChecked();
  await expect(ust.getByText(/Netto: 63 × 88 mm · Brutto ze spadem: 69 × 94 mm/)).toBeVisible();

  // Ostrzeżenie o niskim DPI po kadrowaniu widoczne w panelu opcji druku i na pasku ostrzeżeń projektu.
  await expect(ust.getByText(/poniżej 300 dpi/)).toBeVisible();
  await expect(page.locator('details.ostrzezenia-projektu')).toBeVisible();

  // Przełącz układ na „Jedna karta na stronę” i pobierz PDF o wymiarach 83×108 mm.
  await ust.getByLabel('Układ drukarski').selectOption('pojedyncza');
  await zapisano(page);

  const [pobranie] = await Promise.all([page.waitForEvent('download'), kliknijPobierzPdf(page)]);
  const sciezka = await pobranie.path();
  expect(sciezka).toBeTruthy();
  const pdf = await PDFDocument.load(readFileSync(sciezka!));
  expect(pdf.getPageCount()).toBe(1);
  const { width, height } = pdf.getPage(0).getSize();
  expect(width / PT_NA_MM).toBeCloseTo(83, 1);
  expect(height / PT_NA_MM).toBeCloseTo(108, 1);

  // Powrót do Edytora kart: kliknięcie karty w układzie pojedynczej karty otwiera panel z dokładnym ostrzeżeniem DPI.
  await page.getByRole('link', { name: '← Powrót' }).click();
  await page.locator('.strona-kartki .karta-na-kartce').first().click();
  await expect(
    page.getByRole('complementary', { name: 'Zaznaczone karty' }).getByText(/dpi/i),
  ).toBeVisible();

  // Przeładowanie utrwala ustawienia trybu drukarni w IndexedDB.
  await page.reload();
  await expect(page.locator('.strona-kartki .karta-na-kartce').first()).toBeVisible({
    timeout: 15000,
  });
  const ustPo = await otworzDruk(page);
  await expect(ustPo.getByLabel('Przygotuj do drukarni (spad i znaczniki cięcia)')).toBeChecked();
  await expect(ustPo.getByLabel('Układ drukarski')).toHaveValue('pojedyncza');

  // EN + ciemny motyw.
  const menuUst = await otworzUstawieniaAplikacji(page);
  await menuUst
    .getByRole('group', { name: /^(Język|Language)$/ })
    .getByRole('button', { name: 'EN', exact: true })
    .click();
  await menuUst.getByRole('button', { name: /Dark theme|Motyw ciemny/ }).click();
  await page.keyboard.press('Escape');
  const ustEn = panelDruku(page, true);
  await expect(ustEn.getByLabel('Prepare for print shop (bleed and crop marks)')).toBeChecked();
  await expect(ustEn.getByLabel('Bleed (mm)')).toHaveValue('3');
  await expect(ustEn.getByLabel('Crop marks', { exact: true })).toBeChecked();
  await expect(ustEn.getByLabel('Print layout')).toHaveValue('pojedyncza');
  await expect(ustEn.getByText(/below 300 dpi/)).toBeVisible();
});
