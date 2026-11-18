import { expect, test, type Locator, type Page } from '@playwright/test';
import { kontrastObrysu, kontrastTekstu, pomiarFokusu } from './kontrastUI';
import { gotowyUklad, karta, nowaPustaKartka } from './pomoc';
import { dodaj, drzewo, kreator, panel, sekcja, zaznacz } from './szablonUI';

/**
 * UI-7: kontrast wybranych elementów edytorów (kartki i szablonu) w obu motywach, liczony
 * z getComputedStyle (testy/kontrastUI.ts). Tekst: AA 4,5:1; obrysy pól, zaznaczenie i fokus: 3:1.
 */

test.use({ viewport: { width: 1440, height: 1000 } });

const MOTYWY = ['light', 'dark'] as const;

/** Tekst elementu ma kontrast >= min (domyślnie AA, 4,5). */
async function tekst(el: Locator, opis: string, min = 4.5) {
  await expect(el, opis).toBeVisible();
  const p = await kontrastTekstu(el);
  expect(p.kontrast, `${opis}: ${p.tekst} na ${p.tlo}`).toBeGreaterThanOrEqual(min);
}

async function obrys(el: Locator, opis: string, min = 3) {
  await expect(el, opis).toBeVisible();
  const p = await kontrastObrysu(el);
  expect(p.kontrast, `${opis}: ${p.tekst} na ${p.tlo}`).toBeGreaterThanOrEqual(min);
}

/**
 * Fokus klawiaturą: obrys ciągły, >= 2 px, kontrast >= 3 z tłem. `obrysowany` – element, który
 * rysuje obrys, jeśli to nie sam element z fokusem (np. etykieta węzła drzewa).
 */
async function fokus(page: Page, el: Locator, opis: string, obrysowany: Locator = el) {
  await page.keyboard.press('Tab'); // tryb klawiatury: :focus-visible także po focus()
  await el.focus();
  const p = await pomiarFokusu(obrysowany);
  expect(p.styl, `${opis}: styl obrysu`).toBe('solid');
  expect(p.szerokosc, `${opis}: grubość obrysu`).toBeGreaterThanOrEqual(2);
  expect(p.kontrast, `${opis}: ${p.tekst} na ${p.tlo}`).toBeGreaterThanOrEqual(3);
}

for (const motyw of MOTYWY) {
  test(`edytor kartki (${motyw}): panel karty, pasek, menu, nakładki na papierze`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: motyw });
    await gotowyUklad(page, 'Broń i pancerze');
    await karta(page, 'Miecz').first().click();
    const p = page.getByRole('complementary', { name: 'Zaznaczone karty' });
    await expect(p).toBeVisible();

    // Panel: nagłówek, podpisy, etykiety, pola, przyciski.
    await tekst(p.locator('h2'), 'nagłówek panelu');
    await tekst(p.locator('.podpis').first(), 'podpis panelu (przygaszony)');
    await tekst(p.locator('.pole-panelu > label').first(), 'etykieta pola');
    const pole = p.locator('.pole-panelu input').first();
    await tekst(pole, 'tekst w polu');
    await obrys(pole, 'obrys pola formularza');
    await tekst(p.getByRole('button', { name: 'Duplikuj', exact: true }), 'przycisk zwykły');
    await tekst(p.locator('button.niebezpieczny'), 'przycisk niebezpieczny');
    await tekst(
      p.locator('.przelacznik-segmentowy button[aria-pressed="true"]').first(),
      'segment zaznaczony',
    );
    await tekst(
      p.locator('.przelacznik-segmentowy button[aria-pressed="false"]').first(),
      'segment niezaznaczony',
    );
    await fokus(page, pole, 'fokus w polu panelu');
    await fokus(
      page,
      p.getByRole('button', { name: 'Duplikuj', exact: true }),
      'fokus na przycisku panelu',
    );

    // Pasek akcji nad zaznaczoną kartą (ciemna etykietka): zwykły i niebezpieczny przycisk.
    const pasekKarty = page.locator('.pasek-karty');
    await tekst(pasekKarty.locator('button:not(.niebezpieczny)').first(), 'pasek karty: zwykły');
    await tekst(pasekKarty.locator('button.niebezpieczny'), 'pasek karty: niebezpieczny');

    // Pasek górny.
    const pasek = page.locator('.pasek-gorny');
    await tekst(pasek.locator('.status-zapisu'), 'status zapisu na pasku');
    await tekst(pasek.locator('.nazwa-projektu'), 'nazwa projektu na pasku');
    await tekst(pasek.getByRole('button', { name: /Ustawienia/ }), 'przycisk na pasku');
    await tekst(pasek.getByRole('button', { name: /Pobierz PDF/ }), 'przycisk główny na pasku');
    const wylaczony = pasek.locator('button:disabled').first();
    if (await wylaczony.count()) await tekst(wylaczony, 'przycisk wyłączony na pasku');
    await fokus(page, pasek.getByRole('button', { name: /Ustawienia/ }), 'fokus na pasku');

    // Zaznaczenie karty na papierze (biały w obu motywach): obrys >= 3:1 z bielą.
    const zaznaczona = page.locator('.karta-na-kartce.zaznaczona').first();
    const o = await pomiarFokusu(zaznaczona);
    expect(o.kontrast, `obrys zaznaczonej karty: ${o.tekst} na ${o.tlo}`).toBeGreaterThanOrEqual(3);

    // Ustawienia: legendy sekcji i opisy.
    await page.getByRole('button', { name: /Ustawienia/ }).click();
    const u = page.getByRole('complementary', { name: 'Ustawienia' });
    await tekst(u.locator('legend').first(), 'legenda sekcji');
    await tekst(u.locator('.podpis').first(), 'opis w ustawieniach');
    await tekst(u.locator('label').first(), 'etykieta w ustawieniach');

    // Menu „Pobierz”.
    await page.getByRole('button', { name: /^Pobierz$/ }).click();
    await tekst(
      page.getByRole('menu').first().getByRole('menuitem').first(),
      'pozycja menu Pobierz',
    );
  });

  test(`menu typów kart na pustej kartce (${motyw})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: motyw });
    await nowaPustaKartka(page);
    await page
      .getByRole('button', { name: /Pusty slot/ })
      .first()
      .click();
    const menu = page.getByRole('menu').first();
    await expect(menu).toBeVisible();
    await tekst(menu.locator('.menu-tytul'), 'tytuł menu');
    await tekst(menu.getByRole('menuitem').first(), 'pozycja menu');
    await expect(menu.locator('.ikona')).toHaveCount(0);
    // Fokus w menu: strzałka przenosi go na pozycję (Tab zamknąłby menu).
    await page.keyboard.press('ArrowDown');
    const zfokusem = menu.locator(':focus');
    await expect(zfokusem).toHaveCount(1);
    const p = await pomiarFokusu(zfokusem);
    expect(p.styl).toBe('solid');
    expect(p.szerokosc).toBeGreaterThanOrEqual(2);
    expect(p.kontrast, `fokus w menu: ${p.tekst} na ${p.tlo}`).toBeGreaterThanOrEqual(3);
  });

  test(`edytor szablonu (${motyw}): drzewo, panel, menu Dodaj, tryb swobodny`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: motyw });
    await kreator(page, {
      nazwa: 'Kontrast',
      format: 'Standard / Poker',
      rogi: 3,
      kolor: '#f4ecd8',
      uklad: 'Swobodny: pola w dowolnych miejscach',
    });
    await dodaj(page, 'Tekst', 'Tytuł');
    await zaznacz(page, 'Tytuł');
    const pan = panel(page);

    // Drzewo: zaznaczony węzeł, zwykły węzeł, ikona.
    const wybrany = drzewo(page).locator('.wezel-drzewa.wybrany > .wezel-etykieta').first();
    await tekst(wybrany, 'zaznaczony węzeł drzewa');
    await tekst(drzewo(page).locator('.ikona-wezla').first(), 'ikona węzła');
    const wezel0 = drzewo(page).getByRole('treeitem').first();
    await fokus(page, wezel0, 'fokus w drzewie', wezel0.locator(':scope > .wezel-etykieta'));
    const ob = await pomiarFokusu(wybrany);
    expect(
      ob.kontrast,
      `obrys zaznaczenia w drzewie: ${ob.tekst} na ${ob.tlo}`,
    ).toBeGreaterThanOrEqual(3);

    // Panel właściwości.
    await tekst(pan.locator('h2'), 'nagłówek panelu');
    const nazwa = pan.getByLabel('Nazwa', { exact: true });
    await tekst(nazwa, 'tekst w polu');
    await obrys(nazwa, 'obrys pola');
    await tekst(pan.locator('.pole-panelu > label').first(), 'etykieta pola');
    await tekst(pan.locator('.podpis').first(), 'podpis');
    const etykieta = await sekcja(page, 'Etykieta');
    await tekst(etykieta.locator(':scope > summary'), 'nagłówek sekcji');
    await tekst(
      pan.locator('.przelacznik-segmentowy button[aria-pressed="true"]').first(),
      'segment zaznaczony',
    );
    await tekst(pan.getByRole('button', { name: 'Wklej styl' }), 'przycisk wyłączony (Wklej styl)');
    await fokus(page, nazwa, 'fokus w polu panelu');
    await fokus(page, etykieta.locator(':scope > summary'), 'fokus na nagłówku sekcji');

    // Siatka kotwic (tryb swobodny).
    const kotwica = pan.locator('.siatka-kotwic button').first();
    await obrys(kotwica, 'obrys przycisku kotwicy');

    // Menu „+ Dodaj”: tylko napisy.
    await page.getByRole('button', { name: '＋ Dodaj ▾' }).click();
    const poz = page.getByRole('menuitem', { name: 'Tekst', exact: true });
    await tekst(poz, 'pozycja menu Dodaj');
    await expect(page.locator('.menu-dodaj .menu-pozycja .ikona')).toHaveCount(0);
    await page.keyboard.press('Escape');

    // Nakładki trybu swobodnego na podglądzie: uchwyt i obrys zaznaczenia.
    const uchwyt = page.locator('.karta-podgladu .uchwyt').first();
    await obrys(uchwyt, 'uchwyt zmiany rozmiaru', 3);
    const wezel = page.locator('.karta-podgladu .obszar-wezla.zaznaczony').first();
    const ow = await pomiarFokusu(wezel);
    expect(ow.kontrast, `obrys zaznaczonego pola: ${ow.tekst} na ${ow.tlo}`).toBeGreaterThanOrEqual(
      3,
    );
  });
}
