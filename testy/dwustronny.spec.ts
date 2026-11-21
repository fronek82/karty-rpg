import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { zbudujArkusz } from '../src/druk/arkusz';
import { zbudujStronyRewersow } from '../src/druk/dwustronny';
import { scenyDoPdf } from '../src/druk/pdf';
import { pt } from '../src/model/jednostki';
import type { Arkusz } from '../src/model/arkusz';
import type { Karta, Rewers, Szablon, Talia } from '../src/model/szablon';
import { scenaDoSvg } from '../src/silnik/svg';
import { rejestrTestowy } from '../src/silnik/__testy__/pomoc';
import { porownaj, przygotujStrone } from './pdfSvg';
import { kliknijPobierzPdf, zapisano } from './pomoc';
import { dodaj, kreator, panel } from './szablonUI';

/**
 * M4-4: Dwustronny podgląd (pary przód/tył), przełączanie krawędzi odwracania,
 * lokalna korekta rewersu X/Y, pobieranie dwustronnego PDF i wydruku próbnego,
 * i18n PL/EN, motyw jasny/ciemny oraz zgodność pikseli PDF↔SVG dla odbitego obróconego rewersu.
 */

const czcionki = rejestrTestowy();

test('PDF wygląda jak SVG: odbita strona rewersów z niesymetryczną obróconą kartą (MaxRects, obie krawędzie)', async ({
  page,
}) => {
  await przygotujStrone(page);

  const szablon: Szablon = {
    id: 's-asym',
    nazwa: 'Asymetryczna',
    rozmiar: { tryb: 'mm', szerokosc: 60, wysokosc: 90 },
    tlo: '#ffffff',
    korzen: {
      id: 'k',
      typ: 'kolumna',
      padding: 2,
      dzieci: [
        {
          id: 'n',
          typ: 'tekst',
          klucz: 'nazwa',
          styl: { czcionka: 'tytul', rozmiar: pt(10), kolor: '#111111' },
        },
      ],
    },
  };
  const rewers: Rewers = {
    id: 'rev-asym',
    nazwa: 'Rewers asymetryczny',
    rozmiar: { tryb: 'mm', szerokosc: 60, wysokosc: 90 },
    tlo: '#f4ecd8',
    ramka: { styl: 'ciagla', grubosc: 0.5, kolor: '#7c2d12', odsuniecie: 2.5, promien: 2 },
    korzen: {
      id: 'rk',
      typ: 'swobodny',
      dzieci: [
        {
          id: 'gora',
          typ: 'tekst',
          tekst: 'GÓRA KARTY',
          tlo: '#1e293b',
          pozycja: { x: 6, y: 6 },
          szerokosc: { mm: 34 },
          wysokosc: { mm: 11 },
          styl: {
            czcionka: 'tytul',
            rozmiar: pt(10),
            kolor: '#ffffff',
            wyrownanie: 'srodek',
            wyrownaniePionowe: 'srodek',
          },
        },
        {
          id: 'znak',
          typ: 'ikona',
          ikona: 'gwiazdka',
          rozmiar: 10,
          kolor: '#b91c1c',
          pozycja: { x: 42, y: 70 },
        },
      ],
    },
  };
  const karta: Karta = { id: 'k1', szablonId: szablon.id, ilosc: 1, dane: { nazwa: 'Karta 1' } };
  const talia: Talia = { id: 't1', nazwa: 'Talia', karty: [karta], rewersId: rewers.id };

  for (const krawedz of ['dluga', 'krotka'] as const) {
    const arkusz: Arkusz = {
      id: `a-${krawedz}`,
      nazwa: 'Arkusz',
      taliaId: talia.id,
      ustawienia: {
        papier: 'wlasny',
        wymiaryPapieru: { szer: 110, wys: 130 },
        orientacja: 'pionowa',
        marginesy: { gora: 30, prawo: 5, dol: 30, lewo: 5 },
        linie: { grubosc: 0.2, kolor: '#888888', kreska: 2, przerwa: 2 },
        rozmiary: 'mieszane',
        mieszane: {
          pakowanie: 'maxrects',
          kolejnosc: 'najwieksze',
          obracaj: true,
          grupujRozmiary: false,
          odstep: 0,
        },
        dwustronny: { wlaczony: true, krawedz },
      },
    };
    const ctx = { czcionki, szablony: new Map([[szablon.id, szablon]]) };
    const przod = zbudujArkusz(arkusz, talia, ctx);
    expect(przod.pozycjeKart[0]?.obrot).toBe(90);
    const tyly = zbudujStronyRewersow(arkusz, talia, przod, {
      ...ctx,
      rewersy: new Map([[rewers.id, rewers]]),
    });
    const scena = tyly.strony[0]!;
    const { bajty } = await scenyDoPdf([scena]);
    const svg = scenaDoSvg(scena);
    const w = await porownaj(page, svg, bajty);
    expect(w.ciemneSvg).toBeGreaterThan(w.wszystkie * 0.005);
    expect(Math.abs(w.ciemnePdf - w.ciemneSvg) / w.ciemneSvg).toBeLessThan(0.05);
    expect(w.rozne / w.wszystkie).toBeLessThan(0.005);
  }
});

test('druk dwustronny E2E: podgląd pary, zmiana krawędzi, korekta X/Y, PDF i wydruk próbny (PL/EN, oba motywy)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await kreator(page, {
    nazwa: 'Karta dwustronna',
    format: 'Poker',
    uklad: 'Swobodny',
  });
  await page.getByRole('button', { name: 'Rób karty' }).click();
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });

  // Utwórz niesymetryczny rewers.
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  const ust = page.getByRole('complementary', { name: 'Ustawienia' });
  await ust.getByRole('button', { name: 'Nowy rewers' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Edytor rewersu' })).toBeVisible();
  await dodaj(page, 'Tekst', 'Napis góry');
  await panel(page).getByLabel('Stały tekst').fill('TYŁ KARTY');
  await zapisano(page);

  // Wróć na kartkę, przypisz rewers do talii i włącz druk dwustronny.
  await page.getByRole('link', { name: /Kartki|Wróć do kartek/ }).click();
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });

  // Dodaj jedną kartę na arkuszu (w pierwszym wolnym slocie).
  await page.locator('.strona-kartki [data-slot="0,0"]').click();
  await page.getByRole('menuitem').first().click();

  await page.getByRole('button', { name: /Ustawienia/ }).click();
  const panelUst = page.getByRole('complementary', { name: 'Ustawienia' });
  await panelUst.getByLabel('Domyślny rewers talii').selectOption({ index: 1 });
  await panelUst.getByLabel('Drukuj rewersy (przód i tył w parach stron)').check();

  // Podgląd pokazuje parę przód + tył tej samej strony.
  const para = page.locator('.para-stron').first();
  await expect(para).toBeVisible();
  const stronaRewersu = para.locator('[data-strona-rewersu="0"]');
  await expect(stronaRewersu).toBeVisible();
  await expect(stronaRewersu.locator('svg use').first()).toBeVisible();

  // Przełączenie na krótką krawędź przy pionowym A4 obraca rewers o 180°.
  const krawedz = panelUst.getByRole('group', { name: 'Krawędź odwracania' });
  await krawedz.getByRole('button', { name: 'Krótka krawędź', exact: true }).click();
  await expect(panelUst.getByText('Oś odbicia: pozioma (jak kalendarz).')).toBeVisible();
  await expect(stronaRewersu.locator('svg g[transform*="rotate(180)"]')).toHaveCount(1);

  // Regresja: przeciągnięcie karty nad sąsiedni podgląd rewersu nie psuje liczby stron (brak NaN).
  const kartaEl = para.locator('.karta-na-kartce').first();
  const boxKarty = await kartaEl.boundingBox();
  const boxTylu = await stronaRewersu.boundingBox();
  expect(boxKarty).toBeTruthy();
  expect(boxTylu).toBeTruthy();
  await page.mouse.move(boxKarty!.x + boxKarty!.width / 2, boxKarty!.y + boxKarty!.height / 2);
  await page.mouse.down();
  await page.mouse.move(boxTylu!.x + boxTylu!.width / 2, boxTylu!.y + boxTylu!.height / 2, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(page.locator('.para-stron')).toHaveCount(1);
  await expect(page.locator('.strona-kartki[data-strona="0"] .karta-na-kartce')).toHaveCount(1);
  // Ponownie otwórz panel ustawień (klik na kartę mógł go przełączyć na panel karty).
  if (!(await panelUst.isVisible())) await page.getByRole('button', { name: /Ustawienia/ }).click();

  // Lokalna korekta rewersu X/Y.
  await panelUst.getByLabel('Korekta rewersu X (mm)').fill('1.5');
  await panelUst.getByLabel('Korekta rewersu Y (mm)').fill('-0.5');
  await zapisano(page);

  // Pobierz dwustronny PDF -> 2 strony (przód + tył).
  const [pobraniePdf] = await Promise.all([page.waitForEvent('download'), kliknijPobierzPdf(page)]);
  const sciezkaPdf = await pobraniePdf.path();
  expect(sciezkaPdf).toBeTruthy();
  const docPdf = await PDFDocument.load(readFileSync(sciezkaPdf!));
  expect(docPdf.getPageCount()).toBe(2);

  // Pobierz dwustronny wydruk próbny -> 2 strony (przód + lustrzany tył).
  const [pobranieProbny] = await Promise.all([
    page.waitForEvent('download'),
    panelUst.getByRole('button', { name: 'Wydruk próbny dwustronny (PDF)' }).click(),
  ]);
  const sciezkaProbny = await pobranieProbny.path();
  expect(sciezkaProbny).toBeTruthy();
  const docProbny = await PDFDocument.load(readFileSync(sciezkaProbny!));
  expect(docProbny.getPageCount()).toBe(2);

  // Przeładowanie utrwala zarówno druk dwustronny (IndexedDB), jak i lokalną korektę rewersu (localStorage).
  await page.reload();
  await expect(page.locator('.para-stron [data-strona-rewersu="0"]')).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  const panelPo = page.getByRole('complementary', { name: 'Ustawienia' });
  await expect(panelPo.getByLabel('Korekta rewersu X (mm)')).toHaveValue('1.5');
  await expect(panelPo.getByLabel('Korekta rewersu Y (mm)')).toHaveValue('-0.5');

  // EN + ciemny motyw.
  await page
    .getByRole('group', { name: /^(Język|Language)$/ })
    .getByRole('button', { name: 'EN', exact: true })
    .click();
  await page.getByRole('button', { name: /Dark theme|Ciemny motyw/ }).click();
  const panelEn = page.getByRole('complementary', { name: 'Settings' });
  await expect(panelEn.getByLabel('Print both sides (front and back page pairs)')).toBeChecked();
  await expect(
    panelEn
      .getByRole('group', { name: 'Flip edge' })
      .getByRole('button', { name: 'Short edge', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(panelEn.getByLabel('Back offset X (mm)')).toHaveValue('1.5');
  await expect(
    panelEn.getByRole('button', { name: 'Duplex calibration test (PDF)' }),
  ).toBeVisible();
});
