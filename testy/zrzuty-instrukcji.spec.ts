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

/** Tekst bez ozdobnych znaków z początku i końca (＋, ⤒, ✎, ►, ▾, …). */
const goly = (tekst: string) =>
  tekst
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N})%]+$/u, '')
    .trim();

const dokladnie = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
      // W edytorze kart zapis jest ręczny – utrwal zmiany, żeby pasek zawsze pokazywał „Zapisano”.
      const przyciskZapisu = page.locator('.pasek-gorny .przycisk-zapisz');
      if (await przyciskZapisu.isVisible().catch(() => false)) {
        if (await przyciskZapisu.isEnabled().catch(() => false)) await przyciskZapisu.click();
      }
      const status = page.locator('.status-zapisu');
      if (await status.count()) await expect(status).toHaveText(t('projekt.zapisano'));
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: galeria
          ? `docs/obrazy/ui-9/${jezyk}/${motyw}/${nazwa}.png`
          : sciezkaZrzutu(jezyk, nazwa),
      });
    };

    const nowaKartka = async (page: Page) => {
      await page.goto('./#/');
      await page
        .getByRole('link', {
          name: new RegExp(dokladnie(t('start.stworzDo', { gra: t('gra.mausritter.nazwaDo') }))),
        })
        .click();
      await page
        .getByRole('button', { name: new RegExp(dokladnie(t('start.pustaKartkaA4'))) })
        .click();
      await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
    };

    const slot = (page: Page, kolumna: number) =>
      page.getByRole('button', {
        name: t('kartka.pustySlot', { strona: 1, kolumna, rzad: 1 }),
        exact: true,
      });

    test('start', async ({ page }) => {
      await page.goto('./');
      await expect(page.getByRole('heading', { name: t('start.mojeProjekty') })).toBeVisible();
      // Bez numeru wersji w stopce (zrzut ma być taki sam po każdej zmianie wersji).
      await page
        .locator('.stopka span')
        .first()
        .evaluate((el, nazwa) => (el.textContent = nazwa), t('aplikacja.nazwa'));
      await zapisz(page, 'start');
    });

    test('mausritter', async ({ page }) => {
      await page.goto('./#/gra/mausritter');
      await expect(
        page.getByRole('button', { name: new RegExp(dokladnie(t('start.pustaKartkaA4'))) }),
      ).toBeEnabled({ timeout: 15000 });
      await expect(page.locator('.szkielet')).toHaveCount(0, { timeout: 15000 });
      await zapisz(page, 'mausritter');
    });

    test('edytor kartki z menu typów', async ({ page }) => {
      await nowaKartka(page);
      await slot(page, 1).click();
      await page
        .getByRole('menuitem', { name: new RegExp(`^${dokladnie(t('pakiet.typ.bron'))}`) })
        .click();
      await expect(page.getByRole('complementary', { name: t('kartka.panelKart') })).toBeVisible();
      if (galeria) await zapisz(page, 'karta-zaznaczona');
      await slot(page, 4).click();
      await expect(page.getByRole('menu')).toBeVisible();
      await zapisz(page, 'edytor-kartki');
    });

    test('edytor szablonu z panelem właściwości', async ({ page }) => {
      await page.goto('./#/wlasne/nowy/awers');
      if (galeria) {
        await expect(page.getByRole('heading', { name: t('kreator.tytul') })).toBeVisible();
        await zapisz(page, 'kreator');
      }
      await page.locator('label.format', { hasText: t('kreator.format.mini-euro') }).click();
      await page
        .locator('label.uklad', { hasText: t('kreator.uklad.tytul-siatka-opis-stopka') })
        .click();
      await page
        .getByRole('button', { name: new RegExp(dokladnie(goly(t('kreator.dalej')))) })
        .click();
      const drzewo = page.getByRole('tree', { name: t('szablon.struktura') });
      await expect(drzewo).toBeVisible({ timeout: 15000 });
      const tytul = drzewo.getByRole('treeitem', {
        name: new RegExp(`^${dokladnie(t('start.uklad.tytul'))} – `),
      });
      await tytul.locator(':scope > .wezel-etykieta').click();
      await expect(tytul).toHaveAttribute('aria-selected', 'true');
      await expect(
        page.getByRole('complementary', { name: t('szablon.wlasciwosci') }),
      ).toBeVisible();
      await expect(page.locator('.karta-podgladu')).toBeVisible();
      await zapisz(page, 'edytor-szablonu');
      if (galeria) {
        await page.getByRole('link', { name: t('biblioteka.tytul'), exact: true }).click();
        const zapiszIWyjdz = page.getByRole('button', { name: t('projekt.zapiszIWyjdz') });
        if (await zapiszIWyjdz.isVisible().catch(() => false)) await zapiszIWyjdz.click();
        await expect(
          page.getByRole('heading', { level: 1, name: t('biblioteki.tytul') }),
        ).toBeVisible();
        await zapisz(page, 'biblioteka');
      }
    });

    test('ustawienia kartki: kalibracja drukarki', async ({ page }) => {
      await nowaKartka(page);
      await page
        .getByRole('link', { name: new RegExp(dokladnie(goly(t('kartka.drukujKarty')))) })
        .click();
      const panel = page.getByRole('complementary', { name: t('kartka.opcjeDruku') });
      await expect(panel).toBeVisible();
      await panel
        .locator('legend', { hasText: t('uklad.kalibracja') })
        .evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await zapisz(page, 'ustawienia');
    });
    if (galeria) {
      test('własne karty', async ({ page }) => {
        await page.goto('./#/wlasne');
        await expect(page.locator('[data-podglad] .papier-svg svg')).toHaveCount(6, {
          timeout: 15000,
        });
        await zapisz(page, 'wlasne');
      });

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
