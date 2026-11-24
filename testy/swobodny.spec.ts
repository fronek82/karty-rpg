import { expect, test, type Locator, type Page } from '@playwright/test';
import { zapisano } from './pomoc';
import { dodaj, drzewo, karta, kreator, nazwij, panel, sekcja, zaznacz } from './szablonUI';

/**
 * M2b-8: kontener swobodny – utworzenie z kreatora, sekcja „Położenie” w panelu (X, Y, kotwica,
 * obrót, kolejność) i konwersje; bez przeciągania myszą (to M2b-9).
 */

test.use({ viewport: { width: 1440, height: 1000 } });

const SZER = 63;
const WYS = 88;
const sekcjaPolozenia = (page: Page) =>
  panel(page)
    .locator('details.sekcja-panelu', {
      has: page.locator(':scope > summary:text-is("Położenie i rozmiar")'),
    })
    .first();
const polozenie = (page: Page) => sekcja(page, 'Położenie i rozmiar');
const obszar = (page: Page, nazwa: string) =>
  page.locator('.karta-podgladu').getByRole('button', { name: nazwa, exact: true });

/** Prostokąt elementu w mm (z położenia nakładki nad podglądem karty). */
async function prostokatMm(page: Page, nazwa: string) {
  const karta = (await page.locator('.karta-podgladu').boundingBox())!;
  const r = (await obszar(page, nazwa).boundingBox())!;
  const k = SZER / karta.width;
  return {
    x: (r.x - karta.x) * k,
    y: (r.y - karta.y) * k,
    szer: r.width * k,
    wys: r.height * k,
  };
}
const blisko = (v: number, oczekiwane: number) =>
  expect(Math.abs(v - oczekiwane)).toBeLessThan(0.3);

async function ustawXY(p: Locator, x: number, y: number) {
  await p.getByLabel('X (mm)').fill(String(x));
  await p.getByLabel('Y (mm)').fill(String(y));
}

test('kreator „swobodny”: elementy dostają położenie z panelu (X, Y, kotwica, obrót, kolejność)', async ({
  page,
}) => {
  await kreator(page, {
    nazwa: 'Swobodna',
    format: 'Standard / Poker',
    rogi: 3,
    kolor: '#f4ecd8',
    uklad: 'Swobodny: pola w dowolnych miejscach',
  });
  await expect(drzewo(page).getByRole('treeitem', { name: /^Karta – Swobodny/ })).toBeVisible();

  // Nowy element w kontenerze swobodnym ma położenie 3 · 3 mm i rozmiar w mm.
  await dodaj(page, 'Tekst', 'Tytuł');
  const p = await polozenie(page);
  await expect(p).toBeVisible();
  await expect(p.getByLabel('X (mm)')).toHaveValue('3');
  await expect(p.getByLabel('Y (mm)')).toHaveValue('3');
  await expect(drzewo(page).getByRole('treeitem', { name: /^Tytuł – / })).toContainText('3 · 3');
  const start = await prostokatMm(page, 'Tytuł');
  blisko(start.x, 3);
  blisko(start.y, 3);
  blisko(start.szer, 30);

  // X i Y z panelu przesuwają element.
  await ustawXY(p, 10, 20);
  const po = await prostokatMm(page, 'Tytuł');
  blisko(po.x, 10);
  blisko(po.y, 20);
  await expect(drzewo(page).getByRole('treeitem', { name: /^Tytuł – / })).toContainText('10 · 20');

  // Kotwica prawy dolny róg: zmiana nie przesuwa elementu, a X·Y liczą się od rogu kontenera.
  await p.getByRole('radio', { name: 'prawy dolny róg' }).click();
  const zKotwica = await prostokatMm(page, 'Tytuł');
  blisko(zKotwica.x, po.x);
  blisko(zKotwica.y, po.y);
  await ustawXY(p, -3, -3);
  const rog = await prostokatMm(page, 'Tytuł');
  blisko(rog.x + rog.szer, SZER - 3);
  blisko(rog.y + rog.wys, WYS - 3);
  await expect(drzewo(page).getByRole('treeitem', { name: /^Tytuł – / })).toContainText('-3 · -3');

  // Zmiana rozmiaru karty bez skalowania zawartości: element zostaje przy rogu.
  await karta(page);
  await panel(page).getByLabel('Zostaw elementy w tych samych miejscach').check();
  await page.locator('#karta-szer').fill('70');
  await page.locator('#karta-wys').fill('100');
  await zaznacz(page, 'Tytuł');
  const duza = await (async () => {
    const k = (await page.locator('.karta-podgladu').boundingBox())!;
    const r = (await obszar(page, 'Tytuł').boundingBox())!;
    const mm = 70 / k.width;
    return { prawy: 70 - (r.x + r.width - k.x) * mm, dolny: 100 - (r.y + r.height - k.y) * mm };
  })();
  blisko(duza.prawy, 3);
  blisko(duza.dolny, 3);
  await karta(page);
  await page.locator('#karta-szer').fill('63');
  await page.locator('#karta-wys').fill('88');

  // Obrót o 90°: zajmowany prostokąt ma zamienione boki, środek bez zmian.
  await dodaj(page, 'Tekst', 'Typ');
  const polTyp = await polozenie(page);
  await ustawXY(polTyp, 20, 30);
  const przed = await prostokatMm(page, 'Typ');
  await polTyp.getByRole('button', { name: '90°', exact: true }).click();
  const obrocony = await prostokatMm(page, 'Typ');
  blisko(obrocony.szer, przed.wys);
  blisko(obrocony.wys, przed.szer);
  blisko(obrocony.x, 20);
  blisko(obrocony.y, 30);
  await expect(drzewo(page).getByRole('treeitem', { name: /^Typ – / })).toContainText('↻90°');
  // Tekst obróconego elementu leży w grupie z obrotem (jedna scena dla podglądu i PDF).
  await expect(page.locator('.karta-podgladu svg g[transform*="rotate(90)"]')).toHaveCount(1);

  // Kolejność: „Na spód” przenosi element na początek drzewa (rysowany pod innymi).
  const elementy = drzewo(page).getByRole('treeitem');
  await expect(elementy.nth(1)).toHaveAttribute('aria-label', /^Tytuł – /);
  await polTyp.getByRole('button', { name: 'Na spód' }).click();
  await expect(elementy.nth(1)).toHaveAttribute('aria-label', /^Typ – /);
  await polTyp.getByRole('button', { name: 'Na wierzch' }).click();
  await expect(elementy.nth(2)).toHaveAttribute('aria-label', /^Typ – /);

  // Wartość w kole w rogu – wyrównanie kontrolek i brak ostrzeżeń.
  await dodaj(page, 'Wartość w kształcie', 'Koszt');
  await expect(page.locator('.ostrzezenia-karty')).toHaveCount(0);

  if (process.env.ZRZUTY) {
    await zaznacz(page, 'Typ');
    await page.screenshot({ path: 'docs/obrazy/m2b-8-tryb-swobodny-panel.png' });
  }
});

test('konwersja kolumna → swobodny → kolumna: nic się nie przesuwa, kolejność wg położenia', async ({
  page,
}) => {
  await kreator(page, {
    nazwa: 'Konwersja',
    format: 'Standard / Poker',
    uklad: 'Tytuł i opis',
  });
  const przed = {
    tytul: await prostokatMm(page, 'Tytuł'),
    opis: await prostokatMm(page, 'Opis'),
  };

  await karta(page);
  await (
    await sekcja(page, 'Układ karty (odstępy, rozłożenie, wygląd)')
  )
    .getByRole('button', { name: 'Zamień na swobodny' })
    .click();
  await expect(drzewo(page).getByRole('treeitem', { name: /^Karta – Swobodny/ })).toBeVisible();
  for (const nazwa of ['Tytuł', 'Opis'] as const) {
    const po = await prostokatMm(page, nazwa);
    blisko(po.x, przed[nazwa === 'Tytuł' ? 'tytul' : 'opis'].x);
    blisko(po.y, przed[nazwa === 'Tytuł' ? 'tytul' : 'opis'].y);
    blisko(po.szer, przed[nazwa === 'Tytuł' ? 'tytul' : 'opis'].szer);
    blisko(po.wys, przed[nazwa === 'Tytuł' ? 'tytul' : 'opis'].wys);
  }
  // Położenie liczy się od wnętrza kontenera (po jego paddingu 3 mm): 0 · 0 = bez przesunięcia.
  await expect(drzewo(page).getByRole('treeitem', { name: /^Tytuł – / })).toContainText('0 · 0');

  // Opis przesunięty nad tytuł; powrót na kolumnę ustawia kolejność wg położenia.
  await zaznacz(page, 'Opis');
  await ustawXY(await polozenie(page), 3, 0);
  await zaznacz(page, 'Tytuł');
  await ustawXY(await polozenie(page), 3, 60);
  await karta(page);
  await (
    await sekcja(page, 'Układ karty (odstępy, rozłożenie, wygląd)')
  )
    .getByRole('button', { name: 'Zamień na kolumnę' })
    .click();
  const elementy = drzewo(page).getByRole('treeitem');
  await expect(elementy.nth(1)).toHaveAttribute('aria-label', /^Opis – /);
  await expect(elementy.nth(2)).toHaveAttribute('aria-label', /^Tytuł – /);
  await expect(drzewo(page).getByText('↻')).toHaveCount(0);
  await expect(drzewo(page).locator('.znacznik-polozenia')).toHaveCount(0);

  // Dodanie elementu do panelu-kolumny w swobodnym: zwykła kolumna wewnątrz układa się normalnie.
  await karta(page);
  await (
    await sekcja(page, 'Układ karty (odstępy, rozłożenie, wygląd)')
  )
    .getByRole('button', { name: 'Zamień na swobodny' })
    .click();
  await dodaj(page, 'Kolumna', 'Panel');
  await expect(sekcjaPolozenia(page)).toBeVisible();
  await dodaj(page, 'Tekst', 'W panelu');
  // Element w zwykłej kolumnie nie ma sekcji „Położenie i rozmiar” (ma samo „Rozmiar”).
  await expect(sekcjaPolozenia(page)).toHaveCount(0);
  await nazwij(page, 'W panelu');
});

test('swobodny korzeń przeżywa przeładowanie; kotwicę zmienia się strzałkami (radiogroup)', async ({
  page,
}) => {
  await kreator(page, {
    nazwa: 'Zapis swobodnego',
    format: 'Standard / Poker',
    uklad: 'Swobodny: pola w dowolnych miejscach',
  });
  await dodaj(page, 'Tekst', 'Napis');
  const p = await polozenie(page);
  await ustawXY(p, 12, 34);
  await p.getByRole('button', { name: '270°', exact: true }).click();

  // Kotwica: jeden przystanek Tab, strzałka w prawo przenosi zaznaczenie i fokus.
  const siatka = p.getByRole('radiogroup', { name: 'Liczone od' });
  await expect(siatka.getByRole('radio', { name: 'lewy górny róg' })).toBeChecked();
  await siatka.getByRole('radio', { name: 'lewy górny róg' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(siatka.getByRole('radio', { name: 'środek góry' })).toBeChecked();
  await expect(siatka.getByRole('radio', { name: 'środek góry' })).toBeFocused();
  await expect(siatka.locator('[role=radio][tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press('ArrowLeft');
  await expect(siatka.getByRole('radio', { name: 'lewy górny róg' })).toBeChecked();
  await zapisano(page);

  await page.reload();
  await expect(drzewo(page)).toBeVisible({ timeout: 15000 });
  await expect(drzewo(page).getByRole('treeitem', { name: /^Karta – Swobodny/ })).toBeVisible();
  const napis = drzewo(page).getByRole('treeitem', { name: /^Napis – / });
  await expect(napis).toContainText('12 · 34');
  await expect(napis).toContainText('↻270°');
  await zaznacz(page, 'Napis');
  const polPo = await polozenie(page);
  await expect(polPo.getByLabel('X (mm)')).toHaveValue('12');
  await expect(polPo.getByRole('button', { name: '270°', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('kąt dziesiętny obraca scenę, obszar wyboru i uchwyty oraz przetrwa ponowne otwarcie', async ({
  page,
}) => {
  await kreator(page, {
    nazwa: 'Karta z obrotem',
    format: 'Standard / Poker',
    rogi: 3,
    kolor: '#f4ecd8',
    uklad: 'Swobodny: pola w dowolnych miejscach',
  });
  await dodaj(page, 'Tekst', 'Kierunek');
  const pol = await polozenie(page);
  await ustawXY(pol, 12, 18);
  const kat = pol.getByLabel('Kąt obrotu (°)');
  await kat.fill('37.5');
  await kat.press('Tab');
  await expect(obszar(page, 'Kierunek')).toHaveCSS('transform', /^matrix\(0\.793/);
  await expect(page.locator('.karta-podgladu svg g[transform*="rotate(37.5)"]')).toHaveCount(1);
  const uchwyt = page.locator('[data-uchwyt="e"]');
  await expect(uchwyt).toBeVisible();
  const przed = await prostokatMm(page, 'Kierunek');
  await uchwyt.press('ArrowRight');
  await expect
    .poll(async () => (await prostokatMm(page, 'Kierunek')).szer)
    .toBeGreaterThan(przed.szer);
  if (process.env.ZRZUTY_M3_6) await page.screenshot({ path: 'docs/obrazy/m3-6-obrot.png' });
  await zapisano(page);
  await page.reload();
  await zaznacz(page, 'Kierunek');
  await expect(kat).toHaveValue('37.5');
});
