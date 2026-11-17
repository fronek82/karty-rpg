import { expect, test, type Page } from '@playwright/test';
import type { Szablon } from '../src/model/szablon';
import { rejestrTestowy } from '../src/silnik/__testy__/pomoc';
import { renderujKarte } from '../src/silnik/karta';
import { przeciagnij, srodek } from './pomoc';
import { dodaj, drzewo, karta, kreator, panel, styl, sekcja, wyglad, zaznacz } from './szablonUI';

/**
 * M2b-9: tryb swobodny – praca myszą (przeciąganie, uchwyty, przyciąganie, prowadnice), klawiaturą
 * (strzałki), wyrównanie, jeden krok „Cofnij” na gest i podkład ze wzoru. Przykład F budowany
 * wyłącznie przez interfejs i porównany z szablonem wzorcowym liczonym silnikiem.
 */

test.use({ viewport: { width: 1440, height: 1000 } });

const SZER = 63;
const WYS = 88;
const PODKLAD = 'testy/zasoby/podklad-testowy.png';
const podglad = (page: Page) => page.locator('.karta-podgladu');
const polozenie = (page: Page) => panel(page).getByRole('group', { name: 'Położenie' });
const obszar = (page: Page, nazwa: string) =>
  podglad(page).getByRole('button', { name: nazwa, exact: true });
const wTolerancji = (v: number, oczekiwane: number, tol = 0.05) =>
  expect(Math.abs(v - oczekiwane), `${v} ≈ ${oczekiwane}`).toBeLessThanOrEqual(tol);

/** Prostokąt elementu w mm (z położenia nakładki nad podglądem karty). */
async function prostokatMm(page: Page, nazwa: string) {
  const k = (await podglad(page).boundingBox())!;
  const r = (await obszar(page, nazwa).boundingBox())!;
  const s = SZER / k.width;
  return { x: (r.x - k.x) * s, y: (r.y - k.y) * s, szer: r.width * s, wys: r.height * s };
}
async function oczekuj(
  page: Page,
  nazwa: string,
  [x, y, szer, wys]: [number, number, number, number],
) {
  const r = await prostokatMm(page, nazwa);
  wTolerancji(r.x, x);
  wTolerancji(r.y, y);
  wTolerancji(r.szer, szer);
  wTolerancji(r.wys, wys);
}
/** Piksele ekranu na mm w bieżącym podglądzie. */
const pxNaMm = async (page: Page) => (await podglad(page).boundingBox())!.width / SZER;

/** Przeciągnięcie elementu za jego środek o (dx, dy) mm. */
async function przesun(page: Page, nazwa: string, dx: number, dy: number) {
  const s = await srodek(page, obszar(page, nazwa));
  const k = await pxNaMm(page);
  await przeciagnij(page, s, { x: s.x + dx * k, y: s.y + dy * k });
}
/** Przeciągnięcie uchwytu rozmiaru zaznaczonego pola o (dx, dy) mm. */
async function uchwyt(page: Page, u: string, dx: number, dy: number) {
  const s = await srodek(page, podglad(page).locator(`[data-uchwyt="${u}"]`));
  const k = await pxNaMm(page);
  await przeciagnij(page, s, { x: s.x + dx * k, y: s.y + dy * k });
}
const cofnij = (page: Page) => page.getByRole('button', { name: 'Cofnij', exact: true }).click();

async function swobodny(page: Page, nazwa: string) {
  await kreator(page, {
    nazwa,
    format: 'Standard / Poker',
    rogi: 3,
    kolor: '#f4ecd8',
    uklad: 'Swobodny: pola w dowolnych miejscach',
  });
}

/** Szablon wzorcowy przykładu F: te same położenia i rozmiary, liczone silnikiem. */
const WZORZEC = {
  id: 'wzorzec',
  nazwa: 'Wzorzec F',
  rozmiar: { tryb: 'mm', szerokosc: SZER, wysokosc: WYS },
  korzen: {
    id: 'karta',
    typ: 'swobodny',
    dzieci: [
      {
        id: 'i',
        nazwa: 'Ilustracja',
        typ: 'obraz',
        pozycja: { x: 0, y: 0 },
        szerokosc: { mm: 63 },
        wysokosc: { mm: 46 },
      },
      {
        id: 't',
        nazwa: 'Tytuł',
        typ: 'tekst',
        pozycja: { x: 6, y: 34 },
        szerokosc: { mm: 51 },
        wysokosc: { mm: 12 },
      },
      {
        id: 'k',
        nazwa: 'Koszt',
        typ: 'wartosc',
        ksztalt: 'kolo',
        pozycja: { x: 3, y: 3 },
        szerokosc: { mm: 12 },
        wysokosc: { mm: 12 },
      },
      {
        id: 'n',
        nazwa: 'Typ',
        typ: 'tekst',
        pozycja: { x: 57, y: 8, obrot: 90 },
        szerokosc: { mm: 40 },
        wysokosc: { mm: 3 },
      },
      {
        id: 'o',
        nazwa: 'Opis',
        typ: 'kolumna',
        pozycja: { x: 4, y: 50 },
        szerokosc: { mm: 55 },
        wysokosc: { mm: 30 },
        dzieci: [],
      },
    ],
  },
} as unknown as Szablon;

test('przykład F: karta swobodna zbudowana myszą i klawiaturą, z podkładem ze wzoru', async ({
  page,
}) => {
  await swobodny(page, 'Karta swobodna F');
  // Podkład ze wzoru (obraz testowy generowany deterministycznie): pół na pół, nie łapie kliknięć.
  await page.getByTestId('plik-podkladu').setInputFiles(PODKLAD);
  const podklad = page.getByTestId('podklad-podgladu');
  await expect(podklad).toBeVisible();
  await expect(podklad).toHaveCSS('opacity', '0.5');
  await expect(podklad).toHaveCSS('pointer-events', 'none');

  // Ilustracja w tle: przeciągnięta do rogu karty (przyciąganie do krawędzi), uchwyt – na całą szerokość.
  await dodaj(page, 'Obraz', 'Ilustracja');
  await przesun(page, 'Ilustracja', -3, -3);
  await oczekuj(page, 'Ilustracja', [0, 0, 30, 30]);
  await uchwyt(page, 'se', 33, 16);
  await oczekuj(page, 'Ilustracja', [0, 0, 63, 46]);

  // Tytuł na pasku nałożonym na ilustrację: przeciągnięcie, strzałki w podglądzie, uchwyty.
  await dodaj(page, 'Tekst', 'Tytuł');
  await wyglad(page, { tlo: '#2c3e50' });
  await styl(await sekcja(page, 'Styl tekstu'), {
    rozmiar: 12,
    kolor: '#ffffff',
    pogrubienie: true,
  });
  await przesun(page, 'Tytuł', 3, 30);
  let t = await prostokatMm(page, 'Tytuł');
  wTolerancji(t.x, 6);
  wTolerancji(t.y, 33);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  t = await prostokatMm(page, 'Tytuł');
  wTolerancji(t.y, 34);
  await uchwyt(page, 'e', 21, 0);
  const h0 = (await prostokatMm(page, 'Tytuł')).wys;
  await uchwyt(page, 's', 0, 12 - h0);
  await oczekuj(page, 'Tytuł', [6, 34, 51, 12]);

  // Wartość w kole w rogu: uchwyt rogu zmniejsza pole do 12 × 12 mm.
  await dodaj(page, 'Wartość w kształcie', 'Koszt');
  await panel(page).getByLabel('Kształt').selectOption('kolo');
  await styl(await sekcja(page, 'Styl tekstu'), { rozmiar: 8 });
  // Wysokość nowej wartości jest wg treści (zależy od czcionki) – cel (15, 15) liczymy z pomiaru.
  const k0 = await prostokatMm(page, 'Koszt');
  await uchwyt(page, 'se', -18, 15 - (k0.y + k0.wys));
  await oczekuj(page, 'Koszt', [3, 3, 12, 12]);

  // Napis obrócony o 90° przy prawej krawędzi: obrót z panelu, położenie i rozmiar myszą.
  await dodaj(page, 'Tekst', 'Typ');
  await polozenie(page).getByRole('button', { name: '90°', exact: true }).click();
  await styl(await sekcja(page, 'Styl tekstu'), { rozmiar: 6 });
  await przesun(page, 'Typ', 54, 5);
  await uchwyt(page, 's', 0, 10);
  const w0 = await prostokatMm(page, 'Typ');
  await uchwyt(page, 'e', 3 - w0.szer, 0);
  await oczekuj(page, 'Typ', [57, 8, 3, 40]);
  await expect(page.locator('.karta-podgladu svg g[transform*="rotate(90)"]')).toHaveCount(1);

  // Kolumna z opisem w środku: przeciągnięcie i uchwyt, potem pole w kolumnie.
  // Przyciąganie do krawędzi wyłączone (prawy brzeg 59 leży blisko środka napisu) – zostaje siatka 0,5 mm.
  await page.getByLabel('Do krawędzi i środków innych pól i karty').uncheck();
  await karta(page);
  await dodaj(page, 'Kolumna', 'Opis');
  await przesun(page, 'Opis', 1, 47);
  await uchwyt(page, 'se', 25, 0);
  await oczekuj(page, 'Opis', [4, 50, 55, 30]);
  await dodaj(page, 'Tekst', 'Zdolność');

  // Porównanie ze wzorcem liczonym przez silnik (tolerancja 0,05 mm).
  const wzorzec = renderujKarte(WZORZEC, { dane: {} }, { czcionki: rejestrTestowy() }).wezly;
  for (const nazwa of ['Ilustracja', 'Tytuł', 'Koszt', 'Typ', 'Opis']) {
    const id = (WZORZEC.korzen.dzieci as { id: string; nazwa: string }[]).find(
      (d) => d.nazwa === nazwa,
    )!.id;
    const w = wzorzec.find((x) => x.id === id)!;
    await oczekuj(page, nazwa, [w.x, w.y, w.szer, w.wys]);
  }
  await expect(page.locator('.ostrzezenia-karty')).toHaveCount(0);

  if (process.env.ZRZUTY) {
    await zaznacz(page, 'Koszt');
    await page.screenshot({ path: 'docs/obrazy/m2b-9-podklad.png' });
  }
});

test('przeciąganie: prowadnice i podpowiedź tylko w edytorze, siatka, Alt, jeden krok Cofnij na gest', async ({
  page,
}) => {
  await swobodny(page, 'Gesty');
  await dodaj(page, 'Tekst', 'A');
  await dodaj(page, 'Tekst', 'B');
  const p = polozenie(page);
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
    await polozenie(page).getByLabel('X (mm)').fill(String(x));
    await polozenie(page).getByLabel('Y (mm)').fill(String(y));
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
  await page.waitForFunction(
    () => document.querySelector('.status-zapisu')?.textContent === 'Zapisano',
  );
  await page.reload();
  await expect(page.getByTestId('podklad-podgladu')).toBeVisible();
  await expect(page.getByTestId('podklad-podgladu')).toHaveCSS('opacity', '0.2');

  // Na kartce (jak w PDF) podkładu nie ma.
  await page.getByRole('button', { name: 'Rób karty ►' }).click();
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
  await polozenie(page).getByLabel('X (mm)').fill('3');
  await polozenie(page).getByLabel('Y (mm)').fill('75');
  await zaznacz(page, 'Koszt');
  const k = await pxNaMm(page);
  const s = await srodek(page, obszar(page, 'Koszt'));
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move(s.x + 0.2 * k, s.y + 62 * k, { steps: 10 });
  await page.screenshot({ path: 'docs/obrazy/m2b-9-tryb-swobodny-mysz.png' });
  await page.mouse.up();
});
