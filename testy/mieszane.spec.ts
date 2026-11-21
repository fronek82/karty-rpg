import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { projektZPakietu } from '../src/dane/pakiet';
import { PAKIET_WLASNY, pakietWlasny } from '../src/dane/wlasneKarty';
import { eksportujProjekt, eksportujSzablon } from '../src/dane/archiwum';
import { zbudujArkusz } from '../src/druk/arkusz';
import { scenyDoPdf } from '../src/druk/pdf';
import { WERSJA_SCHEMATU, type Projekt } from '../src/model/projekt';
import type { Szablon, Talia } from '../src/model/szablon';
import { konturIkony } from '../src/silnik/ikony';
import { konturNaD, scenaDoSvg } from '../src/silnik/svg';
import { rejestrTestowy } from '../src/silnik/__testy__/pomoc';
import { porownaj, przygotujStrone } from './pdfSvg';
import { kliknijPobierzPdf, przeciagnij, slot, srodek, zapisano } from './pomoc';
import {
  SZABLONY,
  TALIA,
  arkuszMieszany,
  bliskie,
  otworzProjekt,
  polozenia,
  szablonProstokata,
} from './mieszaneUI';

/**
 * M2b-2: mieszane rozmiary kart na jednej kartce – przykład E(1): A4 z 2× 70×120, 3× 63×88
 * i 5× 44×68 w pasach. Wzorzec strony, PDF, kolejność przeciąganiem, „Dodaj w to miejsce”.
 */

test.use({ viewport: { width: 1440, height: 1100 } });
test.setTimeout(120_000);

test('PDF wygląda jak SVG: mieszane rozmiary, także z obróconą kartą', async ({ page }) => {
  await przygotujStrone(page);
  // Papier 150×230: karta 120×70 (obrócona) nie mieści się inaczej niż po obrocie? Tu mieści się
  // w pasie obrócona obok kart tej samej wysokości.
  const a = arkuszMieszany({
    papier: 'wlasny',
    wymiaryPapieru: { szer: 150, wys: 230 },
    mieszane: { kolejnosc: 'najwieksze', obracaj: true, grupujRozmiary: true, odstep: 1 },
  });
  const poziomy = szablonProstokata('lezaca', 'Leżąca', 140, 60, '#3a5ea8');
  const talia: Talia = {
    ...TALIA,
    karty: [
      ...TALIA.karty,
      { id: 'lezaca-1', szablonId: 'lezaca', dane: {}, ilosc: 1 },
      { id: 'lezaca-2', szablonId: 'lezaca', dane: {}, ilosc: 1 },
    ],
  };
  const wynik = zbudujArkusz(a, talia, {
    czcionki: rejestrTestowy(),
    szablony: new Map([...SZABLONY, poziomy].map((s) => [s.id, s])),
  });
  expect(wynik.ostrzezenia).toEqual([]);
  expect(wynik.strony.length).toBeGreaterThan(0);
  for (const scena of wynik.strony) {
    const { bajty } = await scenyDoPdf([scena]);
    const w = await porownaj(page, scenaDoSvg(scena), bajty);
    expect(w.ciemneSvg).toBeGreaterThan(w.wszystkie * 0.005);
    expect(Math.abs(w.ciemnePdf - w.ciemneSvg) / w.ciemneSvg).toBeLessThan(0.05);
    expect(w.rozne / w.wszystkie).toBeLessThan(0.001);
  }
});

test('przeciąganie zmienia kolejność, „Dodaj w to miejsce” wstawia kartę w wolne miejsce', async ({
  page,
}) => {
  await otworzProjekt(page);
  const karta = (id: string) => page.locator(`.strona-kartki [data-karta="${id}"]`).first();

  // Przeciągnięcie czaru 3 na lewą połowę czaru 1: nowa kolejność (przełącza na „własna”).
  const czar1 = (await karta('czar-1').boundingBox())!;
  await przeciagnij(page, await srodek(page, karta('czar-3')), {
    x: czar1.x + czar1.width * 0.2,
    y: czar1.y + czar1.height / 2,
  });
  await expect(page.getByRole('status').filter({ hasText: 'Kolejność własna' })).toBeVisible();
  let p = await polozenia(page);
  bliskie(p['czar-3']!, [10, 130, 63, 88]);
  bliskie(p['czar-1']!, [73, 130, 63, 88]);
  // Karty się nie nakładają i nic nie zniknęło.
  await expect(page.locator('[data-karta]')).toHaveCount(10);
  // Cofnij przywraca poprzedni układ.
  await page.keyboard.press('Control+z');
  p = await polozenia(page);
  bliskie(p['czar-3']!, [136, 130, 63, 88]);

  // „Później” przy zaznaczonej karcie (alternatywa dla przeciągania): czar 1 za czarem 2.
  await karta('czar-1').click();
  await page.getByRole('button', { name: /Później/ }).click();
  p = await polozenia(page);
  bliskie(p['czar-2']!, [10, 130, 63, 88]);
  bliskie(p['czar-1']!, [73, 130, 63, 88]);
  await page.keyboard.press('Control+z');

  // Wolne miejsce pod przedmiotem 1 (44×52): menu ze wszystkimi szablonami, część „nie zmieści się tu”.
  await page.getByRole('button', { name: /Wolne miejsce 44×52 mm/ }).click();
  const menu = page.getByRole('menu');
  await expect(menu).toContainText('Dodaj kartę w to miejsce (wolne 44×52 mm)');
  await expect(menu.getByRole('menuitem', { name: /Arkana/ })).toContainText('nie zmieści się tu');
  await expect(menu.getByRole('menuitem', { name: /Czar/ })).toContainText('nie zmieści się tu');
  await expect(menu.getByRole('menuitem', { name: /Żeton/ })).not.toContainText('nie zmieści');
  if (process.env.ZRZUTY) {
    await page.getByRole('button', { name: /Ustawienia/ }).click();
    await expect(page.getByRole('complementary', { name: 'Ustawienia' })).toBeVisible();
    await zapisano(page);
    await page.screenshot({ path: 'docs/obrazy/m2b-2-mieszane-rozmiary.png' });
  }
  // Żeton 40×40 trafia dokładnie w to wolne miejsce.
  await menu.getByRole('menuitem', { name: /Żeton/ }).click();
  await expect(page.locator('[data-karta]')).toHaveCount(11);
  const wszystkie = await polozenia(page);
  const zeton = Object.entries(wszystkie).find(([id]) => id.startsWith('karta'))!;
  bliskie(zeton[1], [150, 78, 40, 40]);
  await expect(page.getByRole('complementary', { name: 'Zaznaczone karty' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Zaznaczone karty' })).toContainText(
    'Żeton',
  );
});

/** Plik szablonu (.kartyrpg-szablon) z szablonu zbudowanego w kodzie. */
function plikSzablonu(s: Szablon) {
  const projekt: Projekt = {
    wersja: WERSJA_SCHEMATU,
    id: 'zrodlo',
    nazwa: 'źródło',
    utworzono: '2026-01-01T00:00:00.000Z',
    zmieniono: '2026-01-01T00:00:00.000Z',
    role: {},
    zasoby: [],
    szablony: [s],
    talie: [],
    arkusze: [],
  };
  return {
    name: `${s.id}.kartyrpg-szablon`,
    mimeType: 'application/zip',
    buffer: Buffer.from(eksportujSzablon(projekt, new Map(), s.id).bajty),
  };
}

test('przełącznik w ustawieniach: jeden rozmiar ↔ mieszane, własny układ zablokowany', async ({
  page,
}) => {
  await page.goto('./#/');
  await page.getByRole('link', { name: /Stwórz własne karty/ }).click();
  await page.getByTestId('plik-szablonu-start').setInputFiles(plikSzablonu(SZABLONY[0]!));
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
  // Karta 70×120 w slocie (A4: 2 × 2 sloty).
  await slot(page, 1, 1, 1).click();
  await page.getByRole('menuitem', { name: /Arkana/ }).click();
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  const ust = page.getByRole('complementary', { name: 'Ustawienia' });
  // Drugi szablon (63×88) powstaje jako osobna kartka – otwieramy ustawienia pierwszej.
  await ust.getByTestId('plik-szablonu').setInputFiles(plikSzablonu(SZABLONY[1]!));
  await expect(page.locator('.kartka')).toHaveCount(2);
  await page.getByRole('button', { name: 'Zamknij ustawienia' }).click();
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  const rozmiary = ust.getByLabel('Rozmiary kart na kartce');
  const uklad = ust.getByLabel('Układ kart na kartce');
  await expect(rozmiary).toHaveValue('jeden');
  await expect(uklad.locator('option[value="wlasny"]')).toBeEnabled();

  await rozmiary.selectOption('mieszane');
  await expect(rozmiary).toHaveValue('mieszane');
  // Własny układ zablokowany, ostrzeżenie o ignorowanych przypięciach.
  await expect(uklad.locator('option[value="wlasny"]')).toBeDisabled();
  await expect(ust.getByRole('note')).toContainText('działa tylko z jednym rozmiarem');
  await expect(ust.getByRole('note')).toContainText('Przypięcia kart w slotach');
  await expect(ust.getByText('Arkana · 70×120 · 1 szt.')).toBeVisible();

  // Opcje: kolejność własna, obracanie, odstęp.
  const kolejnosc = ust.getByLabel('Kolejność rozmieszczania');
  await kolejnosc.selectOption('wlasna');
  await expect(kolejnosc).toHaveValue('wlasna');
  await ust.getByLabel('Obracaj karty o 90°, gdy oszczędza to papier').check();
  await ust.getByLabel('Odstęp między kartami (mm)').fill('2');

  // Karta innego rozmiaru na tej samej kartce: wolne miejsce → menu → Czar 63×88.
  const kartka = page.locator('.kartka').first();
  await kartka
    .getByRole('button', { name: /Wolne miejsce/ })
    .last()
    .click();
  await page.getByRole('menuitem', { name: /Czar/ }).click();
  await expect(kartka.locator('[data-karta]')).toHaveCount(2);
  // Dodana karta jest zaznaczona – wracamy do ustawień kartki.
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  await expect(ust.getByText('Czar · 63×88 · 1 szt.')).toBeVisible();

  // Powrót do siatki: karty znowu w slotach, własny układ znów dostępny.
  await rozmiary.selectOption('jeden');
  await expect(uklad.locator('option[value="wlasny"]')).toBeEnabled();
  await expect(kartka.locator('.slot')).not.toHaveCount(0);
  await expect(kartka.locator('[data-karta]')).toHaveCount(2);
});

test('MaxRects jest opcjonalny, zachowuje wszystkie karty i trafia do wydruku', async ({
  page,
}) => {
  await otworzProjekt(page);
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  const pakowanie = page.getByLabel('Pakowanie kart');
  await expect(pakowanie).toHaveValue('pasy');
  await pakowanie.selectOption('maxrects');
  await expect(page.locator('.strona-kartki [data-karta]')).toHaveCount(10);
  await expect(
    page.getByText('MaxRects wypełnia wolne prostokąty.', { exact: false }),
  ).toBeVisible();
  if (process.env.ZRZUTY_M3_6) await page.screenshot({ path: 'docs/obrazy/m3-6-maxrects.png' });

  const a = arkuszMieszany({
    mieszane: {
      pakowanie: 'maxrects',
      kolejnosc: 'najwieksze',
      obracaj: true,
      grupujRozmiary: true,
      odstep: 1,
    },
  });
  const wynik = zbudujArkusz(a, TALIA, {
    czcionki: rejestrTestowy(),
    szablony: new Map(SZABLONY.map((s) => [s.id, s])),
  });
  expect(wynik.ostrzezenia).toEqual([]);
  await przygotujStrone(page);
  for (const scena of wynik.strony) {
    const { bajty } = await scenyDoPdf([scena]);
    const w = await porownaj(page, scenaDoSvg(scena), bajty);
    expect(w.ciemneSvg).toBeGreaterThan(w.wszystkie * 0.005);
    expect(w.rozne / w.wszystkie).toBeLessThan(0.001);
  }
});

test('na mieszanej kartce 1×1, 1×2 i 2×1 kalibracja chroni początki linii', async ({ page }) => {
  const nazwa = 'Próba bezpiecznego marginesu';
  const szablony = [
    szablonProstokata('wysoka', 'Wysoka', 25, 50, '#785697'),
    szablonProstokata('szeroka', 'Szeroka', 50, 25, '#4a697f'),
    szablonProstokata('mala', 'Mała', 25, 25, '#964849'),
  ];
  const a = arkuszMieszany({
    orientacja: 'pozioma',
    marginesy: { lewo: 18, gora: 18, prawo: 2, dol: 2 },
    mieszane: { kolejnosc: 'wlasna', obracaj: false, grupujRozmiary: false, odstep: 0 },
    nozyczki: { linia: 'pozioma', indeks: 1, strona: 'poczatek', rozmiar: 5.5, odstep: 7 },
  });
  const talia: Talia = {
    id: a.taliaId,
    nazwa,
    karty: szablony.map(({ id }) => ({ id, szablonId: id, ilosc: 1, dane: {} })),
  };
  const { projekt, zasoby } = await projektZPakietu(
    { ...pakietWlasny(szablony), nazwa, szablony, talie: [talia], arkusze: [a] },
    async (f) => new Uint8Array(await readFile(`public/czcionki/${f}`)),
    () => Promise.reject(new Error('Brak obrazów w przykładzie.')),
    'margines-znacznikow',
  );
  await page.goto('./#/');
  await page.getByTestId('plik-importu').setInputFiles({
    name: 'margines-znacznikow.kartyrpg',
    mimeType: 'application/zip',
    buffer: Buffer.from(eksportujProjekt({ ...projekt, pakiet: PAKIET_WLASNY }, zasoby)),
  });
  await page.getByRole('link', { name: nazwa, exact: true }).first().click();
  const svg = page.locator('svg.svg-strony');
  const d = konturNaD(konturIkony('nozyczki', -2.75, -2.75, 5.5));
  const ikony = svg.locator(`path[d="${d}"]`);
  await expect(ikony).toHaveCount(6);
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  await page.getByLabel('Przesunięcie X (mm)').fill('-7');
  await page.getByLabel('Przesunięcie Y (mm)').fill('6');
  // Ikona przy lewym początku słabiej odstaje od linii, gdy liczy się kalibracja.
  await expect(svg.locator('g[transform="translate(14.75 18)"]')).toHaveCount(1);
  await expect(ikony).toHaveCount(6);
  const pobierz = async (format: 'PNG' | 'JPG') => {
    await page.getByRole('button', { name: 'Pobierz', exact: true }).click();
    const [plik] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: `Obrazy stron – ${format}, 300 dpi` }).click(),
    ]);
    return readFile(await plik.path());
  };
  expect(await pobierz('PNG')).toMatchSnapshot('margines-znacznikow-a4.png', {
    maxDiffPixelRatio: 0.0001,
  });
  const jpg = await pobierz('JPG');
  expect(jpg.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  const pikseleZnacznika = await page.evaluate(
    async (src) => {
      const obraz = new Image();
      obraz.src = src;
      await obraz.decode();
      const canvas = new OffscreenCanvas(obraz.width, obraz.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(obraz, 0, 0);
      const skala = obraz.width / 297;
      const { data } = ctx.getImageData(12 * skala, 15 * skala, 5.5 * skala, 6 * skala);
      let ciemne = 0;
      for (let i = 0; i < data.length; i += 4)
        if (data[i]! < 128 && data[i + 1]! < 128 && data[i + 2]! < 128) ciemne++;
      return ciemne;
    },
    `data:image/jpeg;base64,${jpg.toString('base64')}`,
  );
  expect(pikseleZnacznika).toBeGreaterThan(100);

  const przesuniety = await svg.evaluate((e) => {
    const kopia = e.cloneNode(true) as SVGSVGElement;
    const grupa = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    grupa.setAttribute('transform', 'translate(-7 6)');
    [...kopia.childNodes].forEach((n) => grupa.append(n));
    kopia.append(grupa);
    return kopia.outerHTML;
  });
  const [pdf] = await Promise.all([page.waitForEvent('download'), kliknijPobierzPdf(page)]);
  const bajty = await readFile(await pdf.path());
  await przygotujStrone(page);
  const wynik = await porownaj(page, przesuniety, bajty, { x: 5, y: 20, szer: 6, wys: 8 });
  expect(wynik.ciemneSvg).toBeGreaterThan(100);
  expect(Math.abs(wynik.ciemnePdf - wynik.ciemneSvg) / wynik.ciemneSvg).toBeLessThan(0.08);
});
