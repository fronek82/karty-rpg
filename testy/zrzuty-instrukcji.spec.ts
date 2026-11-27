import { expect, test, type Page } from '@playwright/test';
import { en } from '../src/i18n/en';
import { pl } from '../src/i18n/pl';
import type { Slownik } from '../src/i18n';
import {
  JEZYKI_ZRZUTOW,
  ROZMIAR_ZRZUTU,
  sciezkaZrzutu,
  type JezykZrzutu,
} from './zrzutyInstrukcji';

/**
 * Generator zrzutów ekranu do instrukcji (D9). Domyślnie pomijany; uruchom:
 *   ZRZUTY_INSTRUKCJI=1 npx playwright test testy/zrzuty-instrukcji.spec.ts
 *   python3 narzedzia/kwantyzuj-zrzuty.py
 * Zapisuje `public/instrukcja-zrzuty/<język>/<nazwa>.png` (1440×900, skala 1, jasny motyw, świeża
 * przeglądarka bez zapisanych projektów, więc dane są zawsze takie same). Napisy interfejsu bierze
 * ze słowników, więc test nie psuje się po zmianie brzmienia przycisku.
 */

const galeria = process.env.ZRZUTY_UI === '1';
const motywy = galeria ? (['light', 'dark'] as const) : (['light'] as const);

const SLOWNIKI: Record<JezykZrzutu, Slownik> = { pl, en };
const LOCALE: Record<JezykZrzutu, string> = { pl: 'pl-PL', en: 'en-US' };

const podstaw = (tekst: string, p: Record<string, string | number> = {}) =>
  tekst.replace(/\{(\w+)\}/g, (c, n: string) => (n in p ? String(p[n]) : c));

const dokladnie = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PLIK_SZABLONU = 'public/galeria/przedmiot-z-rewersem.kartyrpg-szablon';

for (const [jezyk, motyw] of JEZYKI_ZRZUTOW.flatMap((j) => motywy.map((m) => [j, m] as const))) {
  const S = SLOWNIKI[jezyk];
  const t = (k: keyof Slownik, p?: Record<string, string | number>) => podstaw(S[k], p);

  test.describe(`zrzuty ${galeria ? 'UI' : 'instrukcji'} (${jezyk}, ${motyw})`, () => {
    test.skip(!galeria && !process.env.ZRZUTY_INSTRUKCJI, 'tylko przy włączonym generatorze');
    test.use({
      viewport: ROZMIAR_ZRZUTU,
      deviceScaleFactor: 1,
      locale: LOCALE[jezyk],
      colorScheme: motyw,
      reducedMotion: 'reduce',
    });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(
        ({ jezyk, motyw }) => {
          localStorage.setItem('karty.jezyk', jezyk);
          localStorage.setItem('karty.motyw', motyw);
        },
        { jezyk, motyw },
      );
    });

    const zapisz = async (page: Page, nazwa: string) => {
      await page.evaluate(() => document.fonts.ready);
      // Utrwal niezapisane zmiany, żeby nagłówek zawsze pokazywał stan „✓ zapisano”.
      const zapiszUi2 = page.locator('.ui2-stan-przycisk');
      if (await zapiszUi2.isVisible().catch(() => false)) {
        await zapiszUi2.click();
      }
      const przyciskZapisu = page.locator('.przycisk-zapisz').first();
      if (await przyciskZapisu.isVisible().catch(() => false)) {
        if (await przyciskZapisu.isEnabled().catch(() => false)) await przyciskZapisu.click();
      }
      const status = page.locator('.status-zapisu');
      if (await status.count()) await expect(status).toHaveText(t('projekt.zapisano'));
      // Bez numeru wersji w podtytule i stopce (zrzut nie zmienia się przy zmianie wersji).
      const podtytul = page.locator('.riso-podtytul');
      if (await podtytul.count()) {
        await podtytul.evaluate((el) => {
          el.textContent = (el.textContent ?? '').replace(/\s*·\s*v\S+.*$/i, '');
        });
      }
      const stopka = page.locator('.stopka span').first();
      if (await stopka.count())
        await stopka.evaluate((el, nazwa) => (el.textContent = nazwa), t('aplikacja.nazwa'));
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: galeria
          ? `docs/obrazy/ui-9/${jezyk}/${motyw}/${nazwa}.png`
          : sciezkaZrzutu(jezyk, nazwa),
      });
    };

    /** Importuje przykładowy szablon z przodem i tyłem do „Moich szablonów” i otwiera jego edytor. */
    const importujSzablonDoBiblioteki = async (page: Page) => {
      await page.goto('./#/');
      await page.getByTestId('start-nowy-szablon').click();
      await expect(page.getByTestId('okno-nowy-szablon')).toBeVisible();
      await page.getByRole('button', { name: t('nowySzablon.sciezka.import') }).click();
      await page.getByTestId('ns-plik-szablonu').setInputFiles(PLIK_SZABLONU);
      await page.getByRole('button', { name: t('nowySzablon.utworz') }).click();
      await expect(page.locator('.karta-podgladu')).toBeVisible({ timeout: 15000 });
    };

    /** Tworzy projekt z zaimportowanego szablonu, dodaje dwie karty i otwiera krok „1 Karty”. */
    const utworzProjektZKartami = async (page: Page) => {
      await importujSzablonDoBiblioteki(page);
      await page.goto('./#/');
      await page.getByTestId('start-nowe-karty').click();
      const okno = page.getByTestId('okno-nowy-projekt');
      await expect(okno).toBeVisible();
      await okno
        .locator('#np-nazwa')
        .fill(jezyk === 'pl' ? 'Ekwipunek drużyny' : 'Party equipment');
      await okno.locator('.np-kafelek-szablonu').first().click();
      await okno.getByRole('button', { name: t('nowyProjekt.utworz') }).click();
      await expect(page.getByRole('heading', { level: 1, name: t('karty.tytul') })).toBeVisible({
        timeout: 15000,
      });
      // Dodaj drugą kartę z szablonu w lewym pasku, żeby na podglądzie było widać kilka kart.
      await page.locator('.ui2-pasek-boczny .ui2-pasek-pozycja').first().click();
      await page.locator('.ui2-pasek-boczny .ui2-pasek-pozycja').first().click();
      await expect(page.locator('.karty-ui2-kafelek').first()).toBeVisible({ timeout: 15000 });
      await page.locator('.karty-ui2-kafelek').first().click();
    };

    test('start', async ({ page }) => {
      await page.goto('./');
      await expect(page.getByTestId('start-nowe-karty')).toBeVisible();
      await zapisz(page, 'start');
    });

    test('nowy szablon', async ({ page }) => {
      await page.goto('./');
      await page.getByTestId('start-nowy-szablon').click();
      const okno = page.getByTestId('okno-nowy-szablon');
      await expect(okno).toBeVisible();
      await okno.locator('#ns-nazwa').fill(jezyk === 'pl' ? 'Przedmiot' : 'Item');
      await okno.getByRole('button', { name: new RegExp(dokladnie(t('nowyProjekt.tyl'))) }).click();
      await zapisz(page, 'nowy-szablon');
    });

    test('edytor szablonu z panelem właściwości', async ({ page }) => {
      await importujSzablonDoBiblioteki(page);
      const drzewo = page.getByRole('tree', { name: t('szablon.struktura') });
      await expect(drzewo).toBeVisible({ timeout: 15000 });
      // Zaznacz pierwszy element wewnątrz karty, żeby prawy panel pokazał jego właściwości.
      await drzewo.getByRole('treeitem').nth(1).locator(':scope > .wezel-etykieta').click();
      await expect(
        page.getByRole('complementary', { name: t('szablon.wlasciwosci') }),
      ).toBeVisible();
      await expect(page.locator('.karta-podgladu')).toBeVisible();
      await zapisz(page, 'edytor-szablonu');
    });

    test('ekran kart (krok 1 Karty)', async ({ page }) => {
      await utworzProjektZKartami(page);
      await zapisz(page, 'ekran-kart');
    });

    test('ustawienia druku (krok 2 Druk)', async ({ page }) => {
      await utworzProjektZKartami(page);
      await page
        .getByRole('link', { name: new RegExp(dokladnie(t('ui2.krok.druk'))) })
        .first()
        .click();
      const panel = page.getByRole('complementary', { name: t('kartka.opcjeDruku') });
      await expect(panel).toBeVisible({ timeout: 15000 });
      await expect(page.locator('.strona-kartki svg').first()).toBeVisible({ timeout: 15000 });
      await zapisz(page, 'ustawienia');
    });

    test('mausritter', async ({ page }) => {
      await page.goto('./#/');
      await page.getByTestId('start-mausritter').click();
      await expect(page.getByTestId('okno-startu-mausritter')).toBeVisible({ timeout: 15000 });
      await zapisz(page, 'mausritter');
    });

    test('edytor kartki Mausrittera', async ({ page }) => {
      await page.goto('./#/');
      await page.getByTestId('start-mausritter').click();
      const okno = page.getByTestId('okno-startu-mausritter');
      await expect(okno).toBeVisible({ timeout: 15000 });
      await okno.locator('[data-uklad="bron"]').click();
      await expect(okno).toBeHidden({ timeout: 15000 });
      await expect(page.locator('.strona-kartki .karta-na-kartce').first()).toBeVisible({
        timeout: 15000,
      });
      await page.locator('.strona-kartki .karta-na-kartce').first().click();
      await expect(page.getByRole('complementary', { name: t('kartka.panelKart') })).toBeVisible();
      await zapisz(page, 'edytor-kartki');
    });

    test('biblioteki z zaimportowanym ozdobnikiem', async ({ page }) => {
      const nazwa = jezyk === 'pl' ? 'Gwiazdka' : 'Star';
      await page.goto('./#/biblioteki/ozdobniki');
      await page.getByTestId('plik-svg').setInputFiles('testy/zasoby/gwiazdka.svg');
      await page.getByLabel(t('biblioteka.nazwa'), { exact: true }).fill(nazwa);
      await page.getByRole('button', { name: t('biblioteka.import.dodaj') }).click();
      await expect(
        page.getByTestId('siatka-biblioteki').getByRole('button', {
          name: nazwa,
          exact: true,
        }),
      ).toBeVisible();
      await zapisz(page, 'biblioteki');
    });

    if (galeria) {
      test('instrukcja', async ({ page }) => {
        await page.goto(`./instrukcja/?lang=${jezyk}`);
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(
          jezyk === 'pl' ? 'Instrukcja' : 'Guide',
        );
        await zapisz(page, 'instrukcja');
      });
    }
  });
}
