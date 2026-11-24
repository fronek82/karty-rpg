import { expect, test } from '@playwright/test';
import { przeciagnij, srodek, zapisano } from './pomoc';
import {
  PODKLAD,
  cofnij,
  obszar,
  oczekuj,
  podglad,
  polozenie,
  prostokatMm,
  przesun,
  pxNaMm,
  swobodny,
  uchwyt,
  wTolerancji,
} from './swobodnyUI';
import { dodaj, drzewo, karta, panel, sekcja, zaznacz } from './szablonUI';

/**
 * M2b-9: tryb swobodny – praca myszą (przeciąganie, uchwyty, przyciąganie, prowadnice), klawiaturą
 * (strzałki), wyrównanie, jeden krok „Cofnij” na gest i podkład ze wzoru. Przykład F –
 * w `przyklady.spec.ts`.
 */

test.use({ viewport: { width: 1440, height: 1000 } });

test('przeciąganie: prowadnice i podpowiedź tylko w edytorze, siatka, Alt, jeden krok Cofnij na gest', async ({
  page,
}) => {
  await swobodny(page, 'Gesty');
  await dodaj(page, 'Tekst', 'A');
  await dodaj(page, 'Tekst', 'B');
  const p = await polozenie(page);
  await p.getByLabel('X (mm)').fill('40');
  await p.getByLabel('Y (mm)').fill('50');
  await zaznacz(page, 'A');
  const start = await prostokatMm(page, 'A');
  wTolerancji(start.x, 3);
  wTolerancji(start.y, 3);

  // W trakcie przeciągania: prawa krawędź A (33 + 7,3) przyciąga się do lewej krawędzi B (40).
  const k = await pxNaMm(page);
  const s = await srodek(page, obszar(page, 'A'));
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move(s.x + 7.3 * k, s.y, { steps: 8 });
  await expect(page.getByTestId('prowadnica')).toHaveCount(1);
  await expect(page.getByTestId('podpowiedz-przeciagania')).toHaveText('X 10,0 · Y 3,0 mm');
  await expect(page.getByTestId('siatka')).toBeVisible();
  // Prowadnice i siatka są tylko nakładką: nie ma ich w SVG sceny (jak w PDF).
  await expect(podglad(page).locator('svg [data-testid="prowadnica"]')).toHaveCount(0);
  // Stan tymczasowy: nic nie zapisane – po zwolnieniu jeden krok.
  await page.mouse.up();
  await expect(page.getByTestId('prowadnica')).toHaveCount(0);
  await expect(page.getByTestId('podpowiedz-przeciagania')).toHaveCount(0);
  await oczekuj(page, 'A', [10, 3, 30, (await prostokatMm(page, 'A')).wys]);

  // Klik bez ruchu nie dodaje kroku „Cofnij”.
  const c = await srodek(page, obszar(page, 'A'));
  await page.mouse.click(c.x, c.y);
  await przesun(page, 'A', 0, 20);
  const po = await prostokatMm(page, 'A');
  wTolerancji(po.y, 23);
  // Jeden Cofnij cofa cały gest (nie klik, nie pojedynczy ruch), nazwa elementu zostaje.
  await cofnij(page);
  await expect(drzewo(page).getByRole('treeitem', { name: /^A – / })).toContainText('10 · 3');
  wTolerancji((await prostokatMm(page, 'A')).y, 3);
  await page.getByRole('button', { name: 'Ponów', exact: true }).click();
  wTolerancji((await prostokatMm(page, 'A')).y, 23);
  await cofnij(page);

  // Siatka 0,5 mm daje dokładne liczby; Alt wyłącza przyciąganie (14,3 zamiast 14,5).
  await przesun(page, 'A', 4.3, 0.2);
  await expect(drzewo(page).getByRole('treeitem', { name: /^A – / })).toContainText('14,5 · 3');
  await cofnij(page);
  await page.keyboard.down('Alt');
  await przesun(page, 'A', 4.3, 0.2);
  await page.keyboard.up('Alt');
  const alt = await prostokatMm(page, 'A');
  wTolerancji(alt.x, 14.3, 0.1);
  wTolerancji(alt.y, 3.2, 0.1);
});

test('strzałki w podglądzie i na uchwytach, jeden krok Cofnij na serię', async ({ page }) => {
  await swobodny(page, 'Strzałki');
  await dodaj(page, 'Tekst', 'A');
  const s = await srodek(page, obszar(page, 'A'));
  await page.mouse.click(s.x, s.y);
  await expect(page.locator('.karta-podgladu:focus-within')).toHaveCount(1);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('ArrowRight');
  let r = await prostokatMm(page, 'A');
  wTolerancji(r.x, 4);
  wTolerancji(r.y, 8);
  await cofnij(page);
  r = await prostokatMm(page, 'A');
  wTolerancji(r.x, 3);
  wTolerancji(r.y, 3);

  // Uchwyt z klawiatury: prawa krawędź o 0,5 mm, Shift – o 5 mm; etykieta i opis uchwytu.
  const e = podglad(page).getByRole('button', { name: 'Uchwyt rozmiaru: prawa krawędź' });
  await e.focus();
  await page.keyboard.press('ArrowRight');
  wTolerancji((await prostokatMm(page, 'A')).szer, 30.5);
  await page.keyboard.press('Shift+ArrowLeft');
  wTolerancji((await prostokatMm(page, 'A')).szer, 25.5);
  await expect(podglad(page).getByRole('button', { name: /^Uchwyt rozmiaru: / })).toHaveCount(8);
});

test('wyrównaj i rozłóż równo z panelu (jeden krok Cofnij), wiele zaznaczonych przesuwa się razem', async ({
  page,
}) => {
  await swobodny(page, 'Wyrównanie');
  const pozycje = { A: [5, 5], B: [20, 30], C: [40, 50] } as const;
  for (const [nazwa, [x, y]] of Object.entries(pozycje)) {
    await dodaj(page, 'Tekst', nazwa);
    const p = await polozenie(page);
    await p.getByLabel('X (mm)').fill(String(x));
    await p.getByLabel('Y (mm)').fill(String(y));
  }
  // Shift+klik w podglądzie dokłada do zaznaczenia.
  const klik = async (nazwa: string, shift: boolean) => {
    const s = await srodek(page, obszar(page, nazwa));
    if (shift) await page.keyboard.down('Shift');
    await page.mouse.click(s.x, s.y);
    if (shift) await page.keyboard.up('Shift');
  };
  await klik('A', false);
  await klik('B', true);
  await klik('C', true);
  await expect(panel(page).getByRole('heading', { name: 'Zaznaczone elementy: 3' })).toBeVisible();

  await przesun(page, 'B', 2, 1);
  for (const [n, x, y] of [
    ['A', 7, 6],
    ['B', 22, 31],
    ['C', 42, 51],
  ] as const) {
    const r = await prostokatMm(page, n);
    wTolerancji(r.x, x);
    wTolerancji(r.y, y);
  }
  await cofnij(page);
  wTolerancji((await prostokatMm(page, 'C')).y, 50);

  const w = panel(page).getByRole('group', { name: 'Wyrównaj' });
  await w.getByRole('button', { name: 'Do lewej' }).click();
  for (const n of ['A', 'B', 'C']) wTolerancji((await prostokatMm(page, n)).x, 5);
  await w.getByRole('button', { name: 'Rozłóż równo w pionie' }).click();
  const ya = (await prostokatMm(page, 'A')).y;
  const yb = (await prostokatMm(page, 'B')).y;
  const yc = (await prostokatMm(page, 'C')).y;
  wTolerancji(ya, 5);
  wTolerancji(yc, 50);
  wTolerancji(yb, (ya + yc) / 2);
  await cofnij(page);
  wTolerancji((await prostokatMm(page, 'B')).y, 30);
  await w.getByRole('button', { name: 'Do środka w poziomie' }).click();
  const xs = await Promise.all(['A', 'B', 'C'].map((n) => prostokatMm(page, n)));
  const srodki = xs.map((r) => r.x + r.szer / 2);
  wTolerancji(srodki[0]!, srodki[1]!);
  wTolerancji(srodki[1]!, srodki[2]!);
});

test('podkład: pokaż / ukryj, przezroczystość, nie łapie kliknięć i nie trafia na kartkę', async ({
  page,
}) => {
  await swobodny(page, 'Podkład');
  await dodaj(page, 'Tekst', 'Napis');
  await page.getByTestId('plik-podkladu').setInputFiles(PODKLAD);
  const img = page.getByTestId('podklad-podgladu');
  await expect(img).toBeVisible();

  // Klik w element pod podkładem zaznacza go (podkład nie łapie kliknięć).
  await karta(page);
  const s = await srodek(page, obszar(page, 'Napis'));
  await page.mouse.click(s.x, s.y);
  await expect(drzewo(page).getByRole('treeitem', { name: /^Napis – / })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  const suwak = page.getByLabel('Przezroczystość podkładu (%)');
  await suwak.fill('80');
  await expect(img).toHaveCSS('opacity', '0.2');
  await page.getByLabel('Pokaż podkład').uncheck();
  await expect(img).toHaveCount(0);
  await page.getByLabel('Pokaż podkład').check();
  await expect(img).toBeVisible();

  // Podkład to nakładka edytora: SVG karty go nie zawiera.
  expect(await podglad(page).locator('svg').first().innerHTML()).not.toContain('podklad');
  await expect(podglad(page).locator('svg image')).toHaveCount(0);

  // Wraca po przeładowaniu (zasób projektu); usunięcie zdejmuje podkład.
  await zapisano(page);
  await page.reload();
  await expect(page.getByTestId('podklad-podgladu')).toBeVisible();
  await expect(page.getByTestId('podklad-podgladu')).toHaveCSS('opacity', '0.2');

  // Na kartce (jak w PDF) podkładu nie ma.
  await page.getByRole('button', { name: 'Edytor kart ►' }).click();
  await expect(page.getByTestId('podklad-podgladu')).toHaveCount(0);
  await expect(page.locator('svg image')).toHaveCount(0);
});

test('zrzut: przeciąganie z prowadnicami i podpowiedzią', async ({ page }) => {
  test.skip(!process.env.ZRZUTY, 'tylko przy ZRZUTY=1');
  await swobodny(page, 'Stwór');
  await page.getByTestId('plik-podkladu').setInputFiles(PODKLAD);
  await dodaj(page, 'Obraz', 'Ilustracja');
  await przesun(page, 'Ilustracja', -3, -3);
  await uchwyt(page, 'se', 33, 16);
  await dodaj(page, 'Wartość w kształcie', 'Koszt');
  await panel(page).getByLabel('Kształt').selectOption('kolo');
  await uchwyt(page, 'se', -18, 2);
  await dodaj(page, 'Wartość w kształcie', 'Atak');
  await panel(page).getByLabel('Kształt').selectOption('tarcza');
  const p = await polozenie(page);
  await p.getByLabel('X (mm)').fill('3');
  await p.getByLabel('Y (mm)').fill('75');
  await zaznacz(page, 'Koszt');
  const k = await pxNaMm(page);
  const s = await srodek(page, obszar(page, 'Koszt'));
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move(s.x + 0.2 * k, s.y + 62 * k, { steps: 10 });
  await page.screenshot({ path: 'docs/obrazy/m2b-9-tryb-swobodny-mysz.png' });
  await page.mouse.up();
});

test('Escape, Ctrl+Z i ruch poniżej 3 px w trakcie gestu nie dodają kroków Cofnij', async ({
  page,
}) => {
  await swobodny(page, 'Przerwanie');
  await dodaj(page, 'Tekst', 'A');
  const k = await pxNaMm(page);
  const s = await srodek(page, obszar(page, 'A'));
  const podpowiedz = page.getByTestId('podpowiedz-przeciagania');

  // Escape w trakcie przeciągania: karta wraca, po zwolnieniu przycisku nic się nie zapisuje.
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move(s.x + 10 * k, s.y, { steps: 6 });
  await expect(podpowiedz).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(podpowiedz).toHaveCount(0);
  await page.mouse.move(s.x + 12 * k, s.y, { steps: 3 });
  await page.mouse.up();
  wTolerancji((await prostokatMm(page, 'A')).x, 3);

  // Ruch o 2 px to jeszcze klik.
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move(s.x + 2, s.y);
  await page.mouse.up();
  wTolerancji((await prostokatMm(page, 'A')).x, 3);

  // Ctrl+Z w trakcie gestu jest ignorowany (gest trwa, nazwa zostaje).
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move(s.x + 10 * k, s.y, { steps: 6 });
  await page.keyboard.press('Control+z');
  await expect(podpowiedz).toBeVisible();
  await page.mouse.up();
  wTolerancji((await prostokatMm(page, 'A')).x, 13);
  await expect(drzewo(page).getByRole('treeitem', { name: /^A – / })).toBeVisible();

  // Pierwszy Cofnij cofa gest, drugi – dopiero nazwanie elementu (żadnych kroków po drodze).
  await cofnij(page);
  wTolerancji((await prostokatMm(page, 'A')).x, 3);
  await expect(drzewo(page).getByRole('treeitem', { name: /^A – / })).toBeVisible();
  await cofnij(page);
  await expect(drzewo(page).getByRole('treeitem', { name: /^A – / })).toHaveCount(0);
});

test('zaznaczone pole przeciąga się za potomka, klik bez ruchu zaznacza potomka', async ({
  page,
}) => {
  await swobodny(page, 'Potomek');
  await dodaj(page, 'Kolumna', 'Panel');
  await dodaj(page, 'Tekst', 'Wnętrze');
  await zaznacz(page, 'Panel');
  const k = await pxNaMm(page);
  const s = await srodek(page, obszar(page, 'Wnętrze'));
  await przeciagnij(page, s, { x: s.x + 10 * k, y: s.y });
  const p = await prostokatMm(page, 'Panel');
  wTolerancji(p.x, 13);
  wTolerancji(p.y, 3);
  await expect(drzewo(page).getByRole('treeitem', { name: /^Panel – / })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  // Klik bez ruchu zawęża zaznaczenie do klikniętego potomka.
  const c = await srodek(page, obszar(page, 'Wnętrze'));
  await page.mouse.click(c.x, c.y);
  await expect(drzewo(page).getByRole('treeitem', { name: /^Wnętrze – / })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('upuszczenie w kolumnie pokazuje cel, Escape anuluje, Cofnij przywraca rodzica', async ({
  page,
}) => {
  await swobodny(page, 'Zmiana kontenera');
  await dodaj(page, 'Kolumna', 'Cel');
  await (await polozenie(page)).getByLabel('Y (mm)').fill('40');
  await karta(page);
  await dodaj(page, 'Tekst', 'Pole');
  const z = await srodek(page, obszar(page, 'Pole'));
  const doCelu = await srodek(page, obszar(page, 'Cel'));
  const pole = drzewo(page)
    .getByRole('treeitem', { name: /^Cel – / })
    .getByRole('treeitem', { name: /^Pole – / });
  await page.mouse.move(z.x, z.y);
  await page.mouse.down();
  await page.mouse.move(doCelu.x, doCelu.y, { steps: 8 });
  await expect(page.getByTestId('cel-upuszczenia')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(pole).toHaveCount(0);
  await przeciagnij(page, z, doCelu);
  await expect(pole).toBeVisible();
  await cofnij(page);
  await expect(pole).toHaveCount(0);
});

test('uchwyt i pole szerokości skalują obwiednię zaznaczonych elementów', async ({ page }) => {
  await swobodny(page, 'Skalowanie');
  await dodaj(page, 'Tekst', 'A');
  await dodaj(page, 'Tekst', 'B');
  const p = await polozenie(page);
  await p.getByLabel('X (mm)').fill('23');
  await p.getByLabel('Y (mm)').fill('32');
  const a = await srodek(page, obszar(page, 'A'));
  await page.keyboard.down('Shift');
  await page.mouse.click(a.x, a.y);
  await page.keyboard.up('Shift');
  await sekcja(page, 'Rozmiar zaznaczenia');
  const szer = panel(page).getByLabel('Szerokość zaznaczenia (mm)');
  await expect(szer).toHaveValue('50');
  await page.keyboard.down('Alt');
  await uchwyt(page, 'e', -10, 0);
  await page.keyboard.up('Alt');
  wTolerancji((await prostokatMm(page, 'A')).szer, 24, 0.15);
  wTolerancji((await prostokatMm(page, 'B')).x, 19, 0.15);
  await cofnij(page);
  await expect(szer).toHaveValue('50');
  await szer.fill('25');
  wTolerancji((await prostokatMm(page, 'A')).szer, 15);
  wTolerancji((await prostokatMm(page, 'B')).x, 13);
});

test('gładzik Maca: pointercancel / utrata przechwytu w trakcie przeciągania nie cofają elementu', async ({
  page,
}) => {
  await swobodny(page, 'Gładzik');
  await dodaj(page, 'Tekst', 'A');
  await zaznacz(page, 'A');
  const k = await pxNaMm(page);
  // Przerwanie gestu przez przeglądarkę (Force Click, gest systemowy) zamiast pointerup.
  for (const przerwanie of ['pointercancel', 'lostpointercapture']) {
    const przed = await prostokatMm(page, 'A');
    const s = await srodek(page, obszar(page, 'A'));
    await page.mouse.move(s.x, s.y);
    await page.mouse.down();
    await page.mouse.move(s.x + 10 * k, s.y, { steps: 6 });
    await expect(page.getByTestId('podpowiedz-przeciagania')).toBeVisible();
    await page.locator('.karta-podgladu').evaluate((el, typ) => {
      el.dispatchEvent(
        new PointerEvent(typ, {
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          bubbles: true,
        }),
      );
    }, przerwanie);
    await page.mouse.up();
    await expect(page.getByTestId('podpowiedz-przeciagania')).toHaveCount(0);
    wTolerancji((await prostokatMm(page, 'A')).x, przed.x + 10, 0.6);
  }
});
