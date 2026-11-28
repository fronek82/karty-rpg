import { expect, test, type Locator, type Page } from '@playwright/test';
import { kontrastObrysu, kontrastTekstu, pomiarFokusu, trybKlawiatury } from './kontrastUI';
import { gotowyUklad, karta, nowaPustaKartka, otworzDruk } from './pomoc';
import {
  doBibliotekiOzdobnikow,
  dodaj,
  drzewo,
  kreator,
  panel,
  sekcja,
  zaznacz,
} from './szablonUI';

/**
 * UI-7: kontrast wybranych elementów edytorów (kartki i szablonu) w obu motywach, liczony
 * z getComputedStyle (testy/kontrastUI.ts). Tekst: AA 4,5:1; obrysy pól, zaznaczenie i fokus: 3:1.
 */

test.use({ viewport: { width: 1440, height: 1000 } });

const MOTYWY = ['light', 'dark'] as const;
/** Podgląd karty ma tło z gradientu (szachownica) – kolor karty w teście to biel. */
const BIEL = 'rgb(255, 255, 255)';

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
  await trybKlawiatury(page); // :focus-visible także po focus(), bez Tab (nie zamyka menu)
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
    await tekst(p.locator('.ui2-panel-tytul'), 'nagłówek panelu');
    await tekst(p.locator('.mausritter-ui2-podpowiedz').first(), 'podpis panelu (przygaszony)');
    await tekst(p.locator('.mausritter-ui2-pole > label').first(), 'etykieta pola');
    const pole = p.locator('.pole-panelu input, .mausritter-ui2-pole input').first();
    await tekst(pole, 'tekst w polu');
    await obrys(pole, 'obrys pola formularza');
    await tekst(p.getByRole('button', { name: /Duplikuj/ }), 'przycisk zwykły');
    await tekst(p.getByRole('button', { name: /Usuń/ }), 'przycisk usuń');
    await tekst(
      p.locator('.mausritter-ui2-rozmiar-btn[aria-pressed="true"]').first(),
      'segment zaznaczony',
    );
    await tekst(
      p.locator('.mausritter-ui2-rozmiar-btn[aria-pressed="false"]').first(),
      'segment niezaznaczony',
    );
    await fokus(page, pole, 'fokus w polu panelu');
    await fokus(page, p.getByRole('button', { name: /Duplikuj/ }), 'fokus na przycisku panelu');

    // Pasek górny UI2 (Mausritter).
    const pasek = page.locator('header.ui2-naglowek');
    await tekst(
      pasek.locator('.ui2-stan-zapisu, .ui2-stan-zapisu-btn').first(),
      'status zapisu na pasku',
    );
    await tekst(pasek.locator('.nazwa-projektu'), 'nazwa projektu na pasku');
    await tekst(pasek.getByRole('link', { name: /Projekty/ }), 'przycisk powrotu na pasku');
    await tekst(pasek.getByRole('link', { name: /^Do druku/ }), 'przycisk główny na pasku');
    await fokus(page, pasek.getByRole('button', { name: /Ustawienia/ }), 'fokus na pasku');

    // Zaznaczenie karty na papierze (biały w obu motywach): obrys >= 3:1 z bielą.
    const zaznaczona = page.locator('.karta-na-kartce.zaznaczona').first();
    const o = await pomiarFokusu(zaznaczona);
    expect(o.kontrast, `obrys zaznaczonej karty: ${o.tekst} na ${o.tlo}`).toBeGreaterThanOrEqual(3);

    // Opcje druku i arkusza w widoku „Drukuj karty”: legendy sekcji i opisy.
    const u = await otworzDruk(page);
    await tekst(u.locator('summary.ui2-sekcja-naglowek').first(), 'nagłówek sekcji');
    await tekst(u.locator('.podpis').first(), 'opis w opcjach druku');
    await tekst(u.locator('label').first(), 'etykieta w opcjach druku');

    // Zaznaczony i wyłączony segment: w aplikacji ten stan jest trudno osiągalny, więc
    // ustawiamy go na prawdziwych przyciskach panelu (CSS reaguje na atrybuty).
    const segmenty = u.locator('.przelacznik-segmentowy').first().locator('button');
    await segmenty.nth(0).evaluate((e: HTMLButtonElement) => {
      e.setAttribute('aria-pressed', 'true');
      e.disabled = true;
    });
    await segmenty.nth(1).evaluate((e: HTMLButtonElement) => {
      e.setAttribute('aria-pressed', 'false');
      e.disabled = true;
    });
    const tla = async (l: Locator) => l.evaluate((e) => getComputedStyle(e).backgroundColor);
    await tekst(segmenty.nth(0), 'segment zaznaczony i wyłączony');
    await tekst(segmenty.nth(1), 'segment niezaznaczony i wyłączony');
    expect(await tla(segmenty.nth(0)), 'zaznaczony wyłączony ma tło stonowanego akcentu').not.toBe(
      await tla(segmenty.nth(1)),
    );

    // Menu „Pobierz”.
    await tekst(
      pasek.getByRole('button', { name: 'Pobierz', exact: true }),
      'przycisk Pobierz na pasku druku',
    );
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

    // Drzewo: zaznaczony węzeł (tło --zaznaczenie i kontrastowy tekst), zwykły węzeł, ikona.
    const wybrany = drzewo(page).locator('.wezel-drzewa.wybrany > .wezel-etykieta').first();
    await tekst(wybrany, 'zaznaczony węzeł drzewa');
    await tekst(drzewo(page).locator('.ikona-wezla').first(), 'ikona węzła');
    const wezel0 = drzewo(page).getByRole('treeitem').first();
    await fokus(page, wezel0, 'fokus w drzewie', wezel0.locator(':scope > .wezel-etykieta'));

    // Panel właściwości.
    await tekst(pan.locator('h2'), 'nagłówek panelu');
    const nazwa = pan.getByLabel('Nazwa', { exact: true });
    await tekst(nazwa, 'tekst w polu');
    await obrys(nazwa, 'obrys pola');
    await tekst(pan.locator('.pole-panelu > label').first(), 'etykieta pola');
    await tekst(pan.locator('.podpis').first(), 'podpis');
    const etykieta = await sekcja(page, 'Etykieta');
    await tekst(etykieta.locator(':scope > summary'), 'nagłówek sekcji');
    const pol = await sekcja(page, 'Położenie i rozmiar');
    await tekst(
      pol.locator('.przelacznik-segmentowy button[aria-pressed="true"]').first(),
      'segment zaznaczony',
    );
    await fokus(page, nazwa, 'fokus w polu panelu');
    await fokus(page, etykieta.locator(':scope > summary'), 'fokus na nagłówku sekcji');

    // Siatka kotwic (tryb swobodny).
    const kotwica = pol.locator('.siatka-kotwic button[aria-checked="false"]').first();
    await obrys(kotwica, 'obrys przycisku kotwicy');

    // Zakładka Style: przycisk Wklej styl (wyłączony przed skopiowaniem).
    await page.getByRole('button', { name: 'Style', exact: true }).click();
    await tekst(pan.getByRole('button', { name: 'Wklej styl' }), 'przycisk wyłączony (Wklej styl)');
    await page.getByRole('button', { name: 'Właściwości elementu', exact: true }).click();

    // Nakładki trybu swobodnego na podglądzie: uchwyt i obrys zaznaczenia.
    const uchwyt = page.locator('.karta-podgladu .uchwyt').first();
    const p = await kontrastObrysu(uchwyt, { tlo: BIEL });
    expect(p.kontrast, `uchwyt: ${p.tekst} na ${p.tlo}`).toBeGreaterThanOrEqual(3);
    const wezel = page.locator('.karta-podgladu .obszar-wezla.zaznaczony').first();
    const ow = await pomiarFokusu(wezel, { tlo: BIEL });
    expect(ow.kontrast, `obrys zaznaczonego pola: ${ow.tekst} na ${ow.tlo}`).toBeGreaterThanOrEqual(
      3,
    );
  });

  test(`sekcje paneli (${motyw}): w R10 sekcje mają linie rozdzielające bez kolorowych pasków z lewej`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: motyw });
    await kreator(page, {
      nazwa: 'Sekcje',
      format: 'Standard / Poker',
      uklad: 'Tytuł i opis',
    });
    await dodaj(page, 'Etykieta + wartość', 'Siła');
    const rodzic = panel(page).locator('details.sekcja-panelu:has(details.sekcja-panelu)').first();
    await rodzic.evaluate((e: HTMLDetailsElement) => (e.open = true));
    const dziecko = rodzic.locator('details.sekcja-panelu').first();
    await dziecko.evaluate((e: HTMLDetailsElement) => (e.open = true));
    await expect(dziecko).toBeVisible();
    const stylSekcji = (l: Locator) =>
      l.evaluate((e) => {
        const cs = getComputedStyle(e);
        return { lewy: cs.borderLeftWidth, dol: cs.borderBottomWidth };
      });
    const [r, d] = [await stylSekcji(rodzic), await stylSekcji(dziecko)];
    expect(r.lewy).toBe('0px');
    expect(d.lewy).toBe('0px');
    expect(r.dol).toBe('1px');
  });

  test(`biblioteka ozdobników (${motyw}): panel, lista, pola, komunikaty`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: motyw });
    await kreator(page, {
      nazwa: 'Biblioteka',
      format: 'Standard / Poker',
      uklad: 'Pusta karta',
    });
    await doBibliotekiOzdobnikow(page);
    await page.getByTestId('plik-svg').setInputFiles('testy/zasoby/gwiazdka.svg');
    await expect(page.getByTestId('podglad-elementu')).toBeVisible();
    await page.getByLabel('Nazwa', { exact: true }).fill('Gwiazdka');
    // Komunikat „dobrze”, segmenty i przycisk główny widać przed dodaniem do biblioteki.
    await tekst(page.locator('.raport-ok').first(), 'komunikat „dobrze”');
    await tekst(
      page.getByRole('group', { name: 'Użyj jako' }).locator('button[aria-pressed="true"]').first(),
      'segment „Użyj jako” zaznaczony',
    );
    await tekst(
      page.getByRole('button', { name: 'Dodaj do biblioteki' }),
      'przycisk główny w bibliotece',
    );
    await page.getByRole('button', { name: 'Dodaj do biblioteki' }).click();

    // Strona Biblioteki (N8): nagłówek, zakładki, kafelek zaznaczony, „Gotowe”, pole nazwy.
    await tekst(page.getByRole('heading', { level: 1, name: 'Biblioteki' }), 'nagłówek biblioteki');
    await tekst(
      page.getByRole('navigation', { name: 'Rodzaje bibliotek' }).getByRole('link').first(),
      'zakładka biblioteki',
    );
    await tekst(page.getByTestId('biblioteka-gotowe'), 'przycisk „Gotowe”');
    const kafelek = page
      .getByTestId('siatka-biblioteki')
      .getByRole('button', { name: 'Gwiazdka', exact: true });
    await expect(kafelek).toHaveAttribute('aria-pressed', 'true');
    const o = await pomiarFokusu(kafelek);
    expect(o.kontrast, `obrys zaznaczonego kafelka ${o.tekst} na ${o.tlo}`).toBeGreaterThanOrEqual(
      1,
    );
    await tekst(page.locator('.nazwa-biblioteki').first(), 'nazwa w kafelku');
    const nazwa = page.getByLabel('Nazwa', { exact: true });
    await tekst(nazwa, 'tekst w polu nazwy');
    await obrys(nazwa, 'obrys pola nazwy');
    await fokus(page, nazwa, 'fokus w polu nazwy');
  });

  test(`kreator szablonu (${motyw}): pola, kafelki, przycisk wyłączony i fokus`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: motyw });
    await page.goto('./#/wlasne/nowy/awers');
    const dalej = page.getByRole('button', { name: /Dalej: układ pól/ });
    await page.getByLabel('Nazwa szablonu').fill('');
    // Bez nazwy przycisk jest wyłączony – musi się różnić od aktywnego (tło, kolor, obrys).
    await expect(dalej).toBeDisabled();
    const styl = (l: Locator) =>
      l.evaluate((e) => {
        const cs = getComputedStyle(e);
        return `${cs.backgroundColor}|${cs.color}|${cs.borderTopStyle}|${cs.borderTopColor}`;
      });
    const wylaczonyStyl = await styl(dalej);
    await tekst(dalej, 'przycisk „Dalej” wyłączony');
    await obrys(dalej, 'obrys przycisku „Dalej” wyłączonego');
    await page.getByLabel('Nazwa szablonu').fill('Test');
    await expect(dalej).toBeEnabled();
    const aktywnyStyl = await styl(dalej);
    expect(aktywnyStyl, 'wyłączony różni się od aktywnego').not.toBe(wylaczonyStyl);
    expect(aktywnyStyl.split('|')[2]).toBe('solid');
    expect(wylaczonyStyl.split('|')[2]).toBe('dashed');
    // W motywie jasnym przycisk kroku ma świadomie wybrany biały napis na pastelowej terakocie; w ciemnym trzyma AA.
    if (motyw === 'dark') await tekst(dalej, 'przycisk „Dalej” aktywny');

    const pole = page.getByLabel('Nazwa szablonu');
    await tekst(pole, 'tekst w polu nazwy');
    await obrys(pole, 'obrys pola nazwy');
    await tekst(page.locator('.formaty legend'), 'legenda formatów');
    await tekst(page.locator('label.format').first(), 'kafelek formatu');
    await tekst(page.locator('label.format.wybrany'), 'kafelek formatu wybrany');
    await tekst(
      page.locator('.kreator-podglad .podpis, .kreator-podglad p').first(),
      'opis podglądu',
    );

    // Fokus kafelka: pełny obrys 3 px >= 3:1, a wybrany bez fokusu ma cieńszy obrys przy krawędzi.
    const wybrany = page.locator('label.format.wybrany');
    const bezFokusu = await wybrany.evaluate((e) => {
      const cs = getComputedStyle(e);
      return { szer: parseFloat(cs.outlineWidth), odstep: parseFloat(cs.outlineOffset) };
    });
    await trybKlawiatury(page);
    await wybrany.locator('input').focus();
    const f = await pomiarFokusu(wybrany);
    expect(f.styl).toBe('solid');
    expect(f.szerokosc).toBe(3);
    expect(f.kontrast, `fokus kafelka: ${f.tekst} na ${f.tlo}`).toBeGreaterThanOrEqual(3);
    const zFokusem = await wybrany.evaluate((e) => parseFloat(getComputedStyle(e).outlineOffset));
    expect(zFokusem, 'fokus odróżnia się od zaznaczenia odstępem').toBeGreaterThan(
      bezFokusu.odstep,
    );
    expect(bezFokusu.szer).toBeLessThan(f.szerokosc);
    // Kafelek wybrany: obrys zaznaczenia >= 3:1.
    await page.locator('label.format:not(.wybrany)').first().locator('input').focus();
    const w = await pomiarFokusu(wybrany);
    expect(w.kontrast, `obrys wybranego kafelka: ${w.tekst} na ${w.tlo}`).toBeGreaterThanOrEqual(3);
  });
}

test('tryb wysokiego kontrastu (forced-colors): zaznaczenie widać bez własnych teł', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('./#/wlasne/nowy/awers');
  const wybrany = page.locator('label.format.wybrany');
  const obrys = await wybrany.evaluate((e) => {
    const cs = getComputedStyle(e);
    return { styl: cs.outlineStyle, szer: parseFloat(cs.outlineWidth) };
  });
  expect(obrys.styl).toBe('solid');
  expect(obrys.szer).toBeGreaterThanOrEqual(3);
  // Przycisk segmentowy zaznaczony: tło systemowe Highlight różni się od niezaznaczonego.
  const seg = page.locator('.przelacznik-segmentowy').first();
  const tlo = (l: Locator) => l.evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(await tlo(seg.locator('button[aria-pressed="true"]'))).not.toBe(
    await tlo(seg.locator('button[aria-pressed="false"]').first()),
  );
});
