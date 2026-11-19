import { expect, test } from '@playwright/test';
import { eksportujSzablon } from '../src/dane/archiwum';
import { zbudujArkusz } from '../src/druk/arkusz';
import { scenyDoPdf } from '../src/druk/pdf';
import { WERSJA_SCHEMATU, type Projekt } from '../src/model/projekt';
import type { Szablon, Talia } from '../src/model/szablon';
import { scenaDoSvg } from '../src/silnik/svg';
import { rejestrTestowy } from '../src/silnik/__testy__/pomoc';
import { porownaj, przygotujStrone } from './pdfSvg';
import { przeciagnij, slot, srodek, zapisano } from './pomoc';
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
  const rozmiary = ust.getByRole('group', { name: 'Rozmiary kart na kartce' });
  const uklad = ust.getByRole('group', { name: 'Układ kart na kartce' });
  await expect(rozmiary.getByRole('button', { name: /jeden rozmiar/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(uklad.getByRole('button', { name: 'własny układ arkusza' })).toBeEnabled();

  await rozmiary.getByRole('button', { name: 'mieszane' }).click();
  await expect(rozmiary.getByRole('button', { name: 'mieszane' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Własny układ zablokowany, ostrzeżenie o ignorowanych przypięciach.
  await expect(uklad.getByRole('button', { name: 'własny układ arkusza' })).toBeDisabled();
  await expect(ust.getByRole('note')).toContainText('działa tylko z jednym rozmiarem');
  await expect(ust.getByRole('note')).toContainText('Przypięcia kart w slotach');
  await expect(ust.getByText('Arkana · 70×120 · 1 szt.')).toBeVisible();

  // Opcje: kolejność własna, obracanie, odstęp.
  await ust.getByRole('button', { name: 'własna (przeciąganie)' }).click();
  await expect(ust.getByRole('button', { name: 'własna (przeciąganie)' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
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
  await rozmiary.getByRole('button', { name: /jeden rozmiar/ }).click();
  await expect(uklad.getByRole('button', { name: 'własny układ arkusza' })).toBeEnabled();
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
