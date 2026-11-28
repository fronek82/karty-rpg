import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { otworzUstawieniaAplikacji } from './pomoc';
import {
  JEZYKI_ZRZUTOW,
  MAKS_BAJTOW_ZRZUTU,
  NAZWY_ZRZUTOW,
  ROZMIAR_ZRZUTU,
  sciezkaZrzutu,
} from './zrzutyInstrukcji';

/** Strona instrukcji (UI-6): druga strona wejściowa, działa pod ścieżką bazową jak aplikacja. */

const html = (page: Page) => page.locator('html');
const jezyk = (page: Page) => html(page).getAttribute('lang');
const motyw = (page: Page) => html(page).getAttribute('data-theme');
const zapis = (page: Page, klucz: string) => page.evaluate((k) => localStorage.getItem(k), klucz);
const przyciskJezyka = (page: Page, j: 'PL' | 'EN') =>
  page
    .getByRole('group', { name: /^(Język|Language)$/ })
    .getByRole('button', { name: j, exact: true });

test.use({ reducedMotion: 'reduce' });

test('strona instrukcji ładuje się pod ścieżką aplikacji (PL domyślnie z przeglądarki)', async ({
  page,
}) => {
  const odpowiedz = await page.goto('./instrukcja/');
  expect(odpowiedz!.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe('/karty-rpg/instrukcja/');
  expect(await jezyk(page)).toBe('pl');
  await expect(page).toHaveTitle('Instrukcja – Karty');
  await expect(page.getByRole('heading', { level: 1, name: 'Instrukcja' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Karty do Mausrittera' })).toBeVisible();
  // Blok drugiego języka jest ukryty (nie ma go w drzewie dostępności).
  await expect(page.getByRole('heading', { level: 2, name: 'Cards for Mausritter' })).toHaveCount(
    0,
  );
  // Strona bez Reacta i silnika: brak #root.
  await expect(page.locator('#root')).toHaveCount(0);
  expect(await page.locator('script[type="module"]').count()).toBe(1);
});

test('pasek ma link powrotu do aplikacji', async ({ page }) => {
  await page.goto('./instrukcja/');
  await page.getByRole('link', { name: 'Wróć do aplikacji' }).click();
  await expect(page).toHaveURL(/\/karty-rpg\/$/);
  await expect(page.locator('.riso-tytul')).toHaveText('KARTY RPG');
});

test('?lang=en: angielska treść, lang i tytuł; ?lang ma pierwszeństwo przed zapisem', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('karty.jezyk', 'pl'));
  await page.goto('./instrukcja/?lang=en');
  expect(await jezyk(page)).toBe('en');
  await expect(page).toHaveTitle('Guide – Cards');
  await expect(page.getByRole('heading', { level: 1, name: 'Guide' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Cards for Mausritter' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Karty do Mausrittera' })).toHaveCount(
    0,
  );
  await expect(page.getByRole('navigation', { name: 'Contents' })).toBeVisible();
  await expect(przyciskJezyka(page, 'EN')).toHaveAttribute('aria-pressed', 'true');
  // ?lang nie nadpisuje zapisanego wyboru (to tylko link).
  expect(await zapis(page, 'karty.jezyk')).toBe('pl');
});

test.describe('język przeglądarki', () => {
  test.use({ locale: 'en-GB' });
  test('bez ?lang i bez zapisu: angielski dla języka innego niż polski', async ({ page }) => {
    await page.goto('./instrukcja/');
    expect(await jezyk(page)).toBe('en');
    await expect(page).toHaveTitle('Guide – Cards');
  });
});

test('przełączanie języka bez przeładowania, z pamięcią i wspólnym kluczem z aplikacją', async ({
  page,
}) => {
  await page.goto('./instrukcja/');
  await page.evaluate(() => ((window as unknown as { __bez: boolean }).__bez = true));
  await przyciskJezyka(page, 'EN').click();
  expect(await jezyk(page)).toBe('en');
  await expect(page).toHaveTitle('Guide – Cards');
  await expect(
    page.getByRole('heading', { level: 2, name: 'Printing at 100% scale and sheet settings' }),
  ).toBeVisible();
  expect(await zapis(page, 'karty.jezyk')).toBe('en');
  expect(await page.evaluate(() => (window as unknown as { __bez?: boolean }).__bez)).toBe(true);
  // Etykiety kontrolek też zmieniają język.
  await expect(page.getByRole('button', { name: 'Dark theme' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to the app' }).first()).toBeVisible();

  await page.reload();
  expect(await jezyk(page)).toBe('en');
  await expect(przyciskJezyka(page, 'EN')).toHaveAttribute('aria-pressed', 'true');

  // Ten sam wybór w aplikacji.
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'My projects' })).toBeVisible();

  await page.goto('./instrukcja/');
  await przyciskJezyka(page, 'PL').click();
  await expect(page.getByRole('heading', { level: 1, name: 'Instrukcja' })).toBeVisible();
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Moje projekty' })).toBeVisible();
});

test('przełączanie języka aktualizuje ?lang= w adresie, a hasz zmienia przedrostek', async ({
  page,
}) => {
  await page.goto('./instrukcja/?lang=pl#pl-druk');
  await przyciskJezyka(page, 'EN').click();
  await expect(page).toHaveURL(/\?lang=en#en-druk$/);
  await expect(
    page.getByRole('heading', { level: 2, name: 'Printing at 100% scale and sheet settings' }),
  ).toBeInViewport();
});

test('przełączanie motywu z pamięcią, wspólny klucz z aplikacją', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./instrukcja/');
  expect(await motyw(page)).toBe('light');
  const jasne = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.getByRole('button', { name: 'Motyw ciemny' }).click();
  expect(await motyw(page)).toBe('dark');
  await expect(page.getByRole('button', { name: 'Motyw ciemny' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(
    jasne,
  );
  expect(await zapis(page, 'karty.motyw')).toBe('dark');
  await page.reload();
  expect(await motyw(page)).toBe('dark');
  // Jawny wybór wygrywa z ustawieniem systemu i obowiązuje w aplikacji.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('./');
  expect(await motyw(page)).toBe('dark');
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  await page.getByRole('button', { name: 'Motyw jasny' }).click();
  await page.goto('./instrukcja/');
  expect(await motyw(page)).toBe('light');
});

test('motyw według systemu, gdy nic nie zapisano, także na żywo', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('./instrukcja/');
  expect(await motyw(page)).toBe('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => motyw(page)).toBe('light');
});

test('motyw i język ustawione przed pierwszym malowaniem', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('karty.motyw', 'dark');
    localStorage.setItem('karty.jezyk', 'en');
  });
  // Opóźniony skrypt strony: atrybuty musi ustawić skrypt w <head>.
  await page.route('**/assets/*.js', async (route) => {
    await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });
  await page.goto('./instrukcja/', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  expect(await jezyk(page)).toBe('en');
  await expect(page).toHaveTitle('Guide – Cards');
});

test('link „Instrukcja” z aplikacji otwiera stronę w nowym oknie w języku aplikacji', async ({
  page,
}) => {
  await page.goto('./');
  const menuPl = await otworzUstawieniaAplikacji(page);
  const link = menuPl.getByRole('link', { name: /^Instrukcja/ });
  await expect(link).toHaveAttribute('href', 'instrukcja/?lang=pl');
  const [okno] = await Promise.all([page.waitForEvent('popup'), link.click()]);
  await okno.waitForLoadState();
  expect(new URL(okno.url()).pathname).toBe('/karty-rpg/instrukcja/');
  expect(new URL(okno.url()).searchParams.get('lang')).toBe('pl');
  await expect(okno.getByRole('heading', { level: 1, name: 'Instrukcja' })).toBeVisible();
  await okno.close();

  // Po zmianie języka w aplikacji link prowadzi do angielskiej wersji.
  const menuEn = await otworzUstawieniaAplikacji(page);
  await przyciskJezyka(page, 'EN').click();
  const linkEn = menuEn.getByRole('link', { name: /^Guide/ });
  await expect(linkEn).toHaveAttribute('href', 'instrukcja/?lang=en');
  const [oknoEn] = await Promise.all([page.waitForEvent('popup'), linkEn.click()]);
  await oknoEn.waitForLoadState();
  expect(await oknoEn.locator('html').getAttribute('lang')).toBe('en');
  await expect(oknoEn.getByRole('heading', { level: 1, name: 'Guide' })).toBeVisible();
});

test('link działa także z edytora kartki i z edytora szablonu', async ({ page }) => {
  await page.goto('./#/wlasne/nowy/awers');
  const menu = await otworzUstawieniaAplikacji(page);
  const link = menu.getByRole('link', { name: /^Instrukcja/ });
  await expect(link).toHaveAttribute('href', 'instrukcja/?lang=pl');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
});

test('pasek: Instrukcja podświetlona, przełączniki PL | EN i motywu, link powrotu', async ({
  page,
}) => {
  await page.goto('./instrukcja/');
  await expect(page.locator('.przycisk-kontur')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('group', { name: 'Język' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Motyw' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Karty', exact: true })).toHaveAttribute(
    'href',
    '../',
  );
});

test('spis treści działa z klawiatury, a nagłówek dostaje fokus', async ({ page }) => {
  await page.goto('./instrukcja/');
  const spis = page.getByRole('navigation', { name: 'Spis treści' });
  // Pierwszy Tab: link „Przejdź do treści”, widoczny dopiero z fokusem.
  await page.keyboard.press('Tab');
  const pomin = page.getByRole('link', { name: 'Przejdź do treści' });
  await expect(pomin).toBeFocused();
  await expect(pomin).toBeInViewport();
  await page.keyboard.press('Enter');
  await expect(page.locator('#tresc')).toBeFocused();

  const link = spis.getByRole('link', { name: 'Tworzenie projektu i edycja kart' });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#pl-edycja-kart$/);
  const naglowek = page.getByRole('heading', {
    level: 2,
    name: 'Tworzenie projektu i edycja kart',
  });
  await expect(naglowek).toBeFocused();
  await expect(naglowek).toBeInViewport();
  await expect(link).toHaveAttribute('aria-current', 'location');
  await expect(spis.locator('[aria-current="location"]')).toHaveCount(1);
  // Kolejny Tab idzie od nagłówka w głąb treści (pierwszy link w sekcji), nie od początku strony.
  await spis.getByRole('link', { name: 'Karty do Mausrittera' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 2, name: 'Karty do Mausrittera' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('main a:focus')).toHaveAttribute('href', '#pl-druk');
});

test('spis treści: wszystkie pozycje prowadzą do nagłówków w obu językach', async ({ page }) => {
  for (const j of ['pl', 'en']) {
    await page.goto(`./instrukcja/?lang=${j}`);
    const linki = page.locator(`nav ol[lang="${j}"] a`);
    const n = await linki.count();
    expect(n).toBe(10);
    for (let i = 0; i < n; i++) {
      const href = (await linki.nth(i).getAttribute('href'))!;
      await linki.nth(i).click();
      const cel = page.locator(href);
      await expect(cel).toBeInViewport();
      await expect(cel).toBeFocused();
    }
  }
});

test('spis treści przykleja się od 900 px, a na wąskim ekranie leży nad treścią', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./instrukcja/');
  const pozycja = (sel: string) =>
    page.locator(sel).evaluate((el) => getComputedStyle(el).position);
  expect(await pozycja('.spis-wew')).toBe('sticky');
  const szerokosc = await page
    .locator('article[lang="pl"]')
    .evaluate((el) => el.getBoundingClientRect().width);
  const em = await page
    .locator('article[lang="pl"]')
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(szerokosc).toBeLessThanOrEqual(42 * em + 1);
  // Po przewinięciu spis zostaje na ekranie.
  await page.evaluate(() => window.scrollTo(0, 2000));
  await expect(page.locator('.spis-wew')).toBeInViewport({ ratio: 0.9 });

  await page.setViewportSize({ width: 600, height: 800 });
  expect(await pozycja('.spis-wew')).toBe('static');
  const [spisY, trescY] = await Promise.all([
    page.locator('nav.spis').evaluate((el) => el.getBoundingClientRect().top),
    page.locator('main').evaluate((el) => el.getBoundingClientRect().top + window.scrollY),
  ]);
  expect(spisY).toBeLessThan(trescY);
});

test('wąski ekran bez poziomego przewijania', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  for (const j of ['pl', 'en']) {
    await page.goto(`./instrukcja/?lang=${j}`);
    const [sz, okno] = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.clientWidth,
    ]);
    expect(sz).toBeLessThanOrEqual(okno! + 1);
  }
});

/** Kontrast WCAG dwóch kolorów „rgb(r, g, b)” (i „rgba”, bez półprzezroczystości). */
function kontrast(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = (c.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map((x) => {
      const v = Number(x) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}

for (const kolor of ['light', 'dark'] as const) {
  test(`kontrast i fokus (${kolor}): tekst, linki, spis, pasek`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: kolor });
    await page.goto('./instrukcja/');
    const stan = await page.evaluate(() => {
      const kol = (sel: string) => {
        const el = document.querySelector(sel)!;
        const cs = getComputedStyle(el);
        return { kolor: cs.color, tlo: cs.backgroundColor };
      };
      const tlo = getComputedStyle(document.body).backgroundColor;
      return {
        tekst: {
          kolor: getComputedStyle(document.querySelector('article[lang="pl"] p')!).color,
          tlo,
        },
        link: {
          kolor: getComputedStyle(document.querySelector('article[lang="pl"] li a')!).color,
          tlo,
        },
        spisLink: {
          kolor: getComputedStyle(
            document.querySelector('nav ol[lang="pl"] a:not([aria-current])')!,
          ).color,
          tlo: getComputedStyle(document.querySelector('nav.spis')!).backgroundColor,
        },
        aktywny: kol('nav ol[lang="pl"] a[aria-current="location"]'),
        pasek: {
          kolor: getComputedStyle(document.querySelector('.naglowek a.logo')!).color,
          tlo: getComputedStyle(document.querySelector('.naglowek')!).backgroundColor,
        },
        podpis: {
          kolor: getComputedStyle(document.querySelector('figcaption')!).color,
          tlo,
        },
      };
    });
    for (const [nazwa, p] of Object.entries(stan))
      expect(kontrast(p.kolor, p.tlo), nazwa).toBeGreaterThanOrEqual(4.5);

    // Widoczny fokus: obrys co najmniej 2 px, kontrastowy względem tła.
    await page.getByRole('navigation', { name: 'Spis treści' }).getByRole('link').nth(3).focus();
    const obrys = await page.evaluate(() => {
      const cs = getComputedStyle(document.activeElement!);
      return {
        styl: cs.outlineStyle,
        szer: parseFloat(cs.outlineWidth),
        kolor: cs.outlineColor,
        tlo: getComputedStyle(document.querySelector('nav.spis')!).backgroundColor,
      };
    });
    expect(obrys.styl).toBe('solid');
    expect(obrys.szer).toBeGreaterThanOrEqual(2);
    expect(kontrast(obrys.kolor, obrys.tlo)).toBeGreaterThanOrEqual(3);
  });
}

test.describe('zrzuty ekranu w instrukcji', () => {
  test('wszystkie pliki istnieją, mają 1440×900 px i są lekkie', () => {
    for (const j of JEZYKI_ZRZUTOW)
      for (const nazwa of NAZWY_ZRZUTOW) {
        const sciezka = sciezkaZrzutu(j, nazwa);
        expect(existsSync(sciezka), sciezka).toBe(true);
        expect(statSync(sciezka).size, sciezka).toBeLessThan(MAKS_BAJTOW_ZRZUTU);
        const bajty = readFileSync(sciezka);
        // Nagłówek PNG: sygnatura, potem IHDR z szerokością i wysokością.
        expect(bajty.subarray(1, 4).toString('latin1'), sciezka).toBe('PNG');
        expect([bajty.readUInt32BE(16), bajty.readUInt32BE(20)], sciezka).toEqual([
          ROZMIAR_ZRZUTU.width,
          ROZMIAR_ZRZUTU.height,
        ]);
      }
  });

  test('instrukcja wskazuje każdy zrzut i żaden odnośnik nie jest martwy', async ({ page }) => {
    const zrodlo = readFileSync('instrukcja/index.html', 'utf8');
    const wskazane = [...zrodlo.matchAll(/<img[^>]*\ssrc="([^"]+)"/g)].map((m) => m[1]!);
    expect(wskazane.sort()).toEqual(
      JEZYKI_ZRZUTOW.flatMap((j) =>
        NAZWY_ZRZUTOW.map((n) => `/instrukcja-zrzuty/${j}/${n}.png`),
      ).sort(),
    );
    for (const j of JEZYKI_ZRZUTOW) {
      await page.goto(`./instrukcja/?lang=${j}`);
      // Ładowanie leniwe: wymuszamy wczytanie wszystkich obrazów danego języka.
      const wynik = await page.evaluate(async (jj) => {
        const obrazy = [
          ...document.querySelectorAll<HTMLImageElement>(`article[lang="${jj}"] img`),
        ];
        obrazy.forEach((i) => (i.loading = 'eager'));
        await Promise.all(obrazy.map((i) => i.decode().catch(() => undefined)));
        return obrazy.map((i) => ({
          src: i.currentSrc,
          szer: i.naturalWidth,
          wys: i.naturalHeight,
        }));
      }, j);
      expect(wynik).toHaveLength(NAZWY_ZRZUTOW.length);
      for (const o of wynik) {
        // Adres z bazą Pages i prawdziwy obraz (nie 404).
        expect(new URL(o.src).pathname, o.src).toMatch(
          /^\/karty-rpg\/instrukcja-zrzuty\/(pl|en)\//,
        );
        expect([o.szer, o.wys], o.src).toEqual([ROZMIAR_ZRZUTU.width, ROZMIAR_ZRZUTU.height]);
      }
    }
  });

  test('rysunki mają zarezerwowane miejsce (bez skoków układu)', async ({ page }) => {
    await page.goto('./instrukcja/');
    const wymiary = await page.locator('article[lang="pl"] img').evaluateAll((l) =>
      (l as HTMLImageElement[]).map((i) => ({
        a: i.getAttribute('width') + 'x' + i.getAttribute('height'),
        b: i.getBoundingClientRect().width / i.getBoundingClientRect().height,
      })),
    );
    for (const w of wymiary) {
      expect(w.a).toBe('1440x900');
      expect(w.b).toBeCloseTo(1.6, 1);
    }
  });
});

test.describe('zrzuty UI-6', () => {
  test.skip(!process.env.ZRZUTY, 'tylko przy ZRZUTY=1');
  test.use({ viewport: { width: 1440, height: 900 } });

  test('instrukcja jasny, ciemny, EN jasny', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('./instrukcja/');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: 'docs/obrazy/ui-6-instrukcja-jasny.png' });
    await page.getByRole('button', { name: 'Motyw ciemny' }).click();
    await page.screenshot({ path: 'docs/obrazy/ui-6-instrukcja-ciemny.png' });
    await page.getByRole('button', { name: 'Motyw jasny' }).click();
    await przyciskJezyka(page, 'EN').click();
    await page.screenshot({ path: 'docs/obrazy/ui-6-instrukcja-en-jasny.png' });
  });
});
