import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { eksportujSzablon } from '../src/dane/archiwum';
import { projektZPakietu } from '../src/dane/pakiet';
import { pakietWlasny } from '../src/dane/wlasneKarty';
import { plikSzablonu } from './kartkaUI';
import { plikProjektu, SZABLONY } from './mieszaneUI';

/** Ekran startowy (UI-3): układ kolumn, czcionka tytułu, „Importuj pliki…” i strefa upuszczania. */

type Plik = { name: string; mimeType: string; buffer: Buffer };

const zepsuty: Plik = {
  name: 'zepsuty.kartyrpg',
  mimeType: 'application/zip',
  buffer: Buffer.from('to nie jest archiwum'),
};
const tekstowy: Plik = {
  name: 'notatki.txt',
  mimeType: 'text/plain',
  buffer: Buffer.from('zwykły tekst'),
};

/** Upuszczenie plików na strefę (zdarzenie `drop` z prawdziwym DataTransfer). */
async function upusc(page: Page, pliki: Plik[]) {
  const dt = await page.evaluateHandle(
    (lista) => {
      const d = new DataTransfer();
      for (const p of lista) {
        const bajty = Uint8Array.from(atob(p.b64), (c) => c.charCodeAt(0));
        d.items.add(new File([bajty], p.name, { type: p.mimeType }));
      }
      return d;
    },
    pliki.map((p) => ({ name: p.name, mimeType: p.mimeType, b64: p.buffer.toString('base64') })),
  );
  const strefa = page.getByTestId('strefa-importu');
  await strefa.dispatchEvent('dragover', { dataTransfer: dt });
  await expect(strefa).toHaveClass(/nad/);
  await strefa.dispatchEvent('drop', { dataTransfer: dt });
  await expect(strefa).not.toHaveClass(/nad/);
}

/** Plik szablonu z wbudowanymi zasobami (czcionki z projektu) – jak z eksportu z edytora. */
async function plikSzablonuZZasobami(): Promise<Plik> {
  const { projekt, zasoby } = await projektZPakietu(
    { ...pakietWlasny(SZABLONY), nazwa: 'Źródło', szablony: SZABLONY, talie: [], arkusze: [] },
    async (f) => new Uint8Array(readFileSync(`public/czcionki/${f}`)),
    () => Promise.reject(new Error('brak obrazów')),
    'zrodlo',
  );
  const bajty = eksportujSzablon(projekt, zasoby, SZABLONY[0]!.id).bajty;
  // Kontrola testu: plik naprawdę niesie zasoby.
  expect(Object.keys(unzipSync(bajty)).some((n) => n.startsWith('zasoby/'))).toBe(true);
  return {
    name: 'ze-szablon-zasobami.kartyrpg-szablon',
    mimeType: 'application/zip',
    buffer: Buffer.from(bajty),
  };
}

const kafelki = (page: Page) => page.locator('.kafelek-projektu');

test.describe('układ', () => {
  test('1440 px: trzy kolumny (menu 260, projekty, import 240), tytuł wyśrodkowany', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('./');
    const menu = (await page.locator('.start-menu').boundingBox())!;
    const lista = (await page.locator('.lista-projektow').boundingBox())!;
    const import_ = (await page.locator('.panel-importu').boundingBox())!;
    expect(menu.x).toBeLessThan(lista.x);
    expect(lista.x).toBeLessThan(import_.x);
    expect(Math.abs(menu.y - lista.y)).toBeLessThan(2);
    expect(Math.abs(lista.y - import_.y)).toBeLessThan(2);
    expect(Math.round(menu.width)).toBe(260);
    expect(Math.round(import_.width)).toBe(240);
    const tytul = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    expect(Math.abs(tytul.x + tytul.width / 2 - 720)).toBeLessThan(2);
    expect(tytul.y).toBeLessThan(menu.y);
    await expect(page.getByText('Wszystko działa w przeglądarce')).toBeVisible();
  });

  test('800 px: kolumny jedna pod drugą – menu, projekty, import', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await page.goto('./');
    const menu = (await page.locator('.start-menu').boundingBox())!;
    const lista = (await page.locator('.lista-projektow').boundingBox())!;
    const import_ = (await page.locator('.panel-importu').boundingBox())!;
    expect(menu.y + menu.height).toBeLessThanOrEqual(lista.y + 1);
    expect(lista.y + lista.height).toBeLessThanOrEqual(import_.y + 1);
    expect(Math.abs(menu.x - lista.x)).toBeLessThan(2);
    expect(Math.abs(lista.x - import_.x)).toBeLessThan(2);
    // Brak poziomego przewijania strony.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      800,
    );
  });

  test('menu: dwa paski prowadzą do ekranów własnych kart i Mausrittera', async ({ page }) => {
    await page.goto('./');
    const paski = page.locator('.start-menu a.pasek-menu');
    await expect(paski).toHaveCount(2);
    await expect(paski.nth(0)).toContainText('Stwórz własne karty');
    await expect(paski.nth(1)).toContainText('Stwórz karty do Mausrittera');
    await expect(paski.nth(1)).toHaveAttribute('href', '#/gra/mausritter');
    await paski.nth(1).click();
    await expect(page).toHaveURL(/#\/gra\/mausritter$/);
  });

  test('stopka: wersja i linki do licencji oraz kodu', async ({ page }) => {
    await page.goto('./');
    const stopka = page.locator('footer.stopka');
    await expect(stopka).toContainText('Karty RPG · Wersja');
    await expect(stopka.getByRole('link', { name: 'Licencje' })).toHaveAttribute(
      'href',
      /github\.com\/.+\/karty-rpg\/blob\/main\/LICENCJE\.md$/,
    );
    await expect(stopka.getByRole('link', { name: 'Kod źródłowy' })).toHaveAttribute(
      'href',
      /github\.com\/.+\/karty-rpg$/,
    );
  });
});

test.describe('czcionka tytułu', () => {
  test('Cinzel Decorative Bold jest załadowana (bez preloadu – B141)', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('head link[rel="preload"]')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() => page.evaluate(() => document.fonts.check('700 40px "Cinzel Decorative"')))
      .toBe(true);
    const stan = await page.evaluate(
      () => [...document.fonts].find((f) => f.family.includes('Cinzel'))?.status,
    );
    expect(stan).toBe('loaded');
    const rodzina = await page.evaluate(
      () => getComputedStyle(document.querySelector('h1')!).fontFamily,
    );
    expect(rodzina).toContain('Cinzel Decorative');
  });

  test('bez pliku czcionki tytuł pokazuje się czcionką awaryjną (Georgia, serif)', async ({
    page,
  }) => {
    await page.route('**/CinzelDecorative-Bold.ttf', (r) => r.abort());
    await page.goto('./');
    const naglowek = page.getByRole('heading', { level: 1 });
    await expect(naglowek).toBeVisible();
    await expect(naglowek).toHaveText('Karty do gier – zaprojektuj i wydrukuj');
    const rodzina = await naglowek.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(rodzina).toMatch(/Georgia,\s*serif$/);
    await expect
      .poll(() =>
        page.evaluate(() => [...document.fonts].find((f) => f.family.includes('Cinzel'))?.status),
      )
      .toBe('error');
  });
});

test.describe('tytuł po angielsku', () => {
  test.use({ locale: 'en-US' });

  test('tytuł i przyciski importu', async ({ page }) => {
    await page.goto('./');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Game Cards – Design and Print' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import files…' })).toBeVisible();
    await expect(page.getByText('Everything runs in the browser')).toBeVisible();
  });
});

test.describe('import plików', () => {
  test('„Importuj pliki…” otwiera wybór wielu plików z klawiatury', async ({ page }) => {
    const wybor = page.waitForEvent('filechooser');
    await page.goto('./');
    const przycisk = page.getByRole('button', { name: 'Importuj pliki…' });
    await przycisk.focus();
    await expect(przycisk).toBeFocused();
    await page.keyboard.press('Enter');
    expect((await wybor).isMultiple()).toBe(true);
  });

  test('strefa upuszczania otwiera wybór wielu plików z klawiatury', async ({ page }) => {
    const wybor = page.waitForEvent('filechooser');
    await page.goto('./');
    const strefa = page.getByTestId('strefa-importu');
    await strefa.focus();
    await expect(strefa).toBeFocused();
    await page.keyboard.press('Enter');
    expect((await wybor).isMultiple()).toBe(true);
  });

  test('plik .kartyrpg: komunikat, projekt na liście', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('plik-importu').setInputFiles(await plikProjektu());
    await expect(
      page.getByRole('status').filter({ hasText: 'Zaimportowano projekt' }),
    ).toContainText('Mieszane');
    await expect(kafelki(page)).toHaveCount(1);
    await expect(page).toHaveURL(/#\/$|karty-rpg\/$/);
  });

  test('plik .kartyrpg w archiwum .zip jest rozpoznany po zawartości', async ({ page }) => {
    await page.goto('./');
    await page
      .getByTestId('plik-importu')
      .setInputFiles({ ...(await plikProjektu()), name: 'kopia-zapasowa.zip' });
    await expect(
      page.getByRole('status').filter({ hasText: 'Zaimportowano projekt' }),
    ).toBeVisible();
    await expect(kafelki(page)).toHaveCount(1);
  });

  test('pojedynczy plik .kartyrpg-szablon: nowy projekt i edytor kartki', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('plik-importu').setInputFiles(plikSzablonu());
    await expect(page).toHaveURL(/#\/projekt\//);
    await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
  });

  test('wiele plików naraz: projekt, szablon i błędny – osobne komunikaty i podsumowanie', async ({
    page,
  }) => {
    await page.goto('./');
    await page
      .getByTestId('plik-importu')
      .setInputFiles([await plikProjektu(), plikSzablonu(), zepsuty, tekstowy]);
    // Podsumowanie w stałym regionie status, szczegóły sukcesów w liście bez ról, błędy w jednym alercie.
    await expect(
      page.getByRole('status').filter({ hasText: 'Wczytano 2 z 4 plików.' }),
    ).toBeVisible();
    const wyniki = page.getByRole('list', { name: 'Wyniki importu' });
    await expect(wyniki.getByRole('listitem')).toHaveCount(2);
    await expect(wyniki.getByRole('listitem').nth(0)).toContainText(
      'Zaimportowano projekt „Mieszane”',
    );
    await expect(wyniki.getByRole('listitem').nth(1)).toContainText(
      'Utworzono projekt z szablonu „czar.kartyrpg-szablon”',
    );
    const alert = page.locator('.panel-importu').getByRole('alert');
    await expect(alert.locator('p')).toHaveCount(2);
    await expect(alert).toContainText('„zepsuty.kartyrpg”');
    await expect(alert).toContainText('„notatki.txt”: Nie rozpoznano rodzaju pliku');
    // Nie przechodzi do edytora; lista odświeżona o oba projekty.
    await expect(page).not.toHaveURL(/#\/projekt\//);
    await expect(kafelki(page)).toHaveCount(2);
  });

  test('błędny plik: komunikat o błędzie, lista bez zmian', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('plik-importu').setInputFiles(zepsuty);
    await expect(page.getByRole('alert')).toContainText('„zepsuty.kartyrpg”');
    await expect(kafelki(page)).toHaveCount(0);
  });

  test('przeciągnięcie plików na strefę: projekt i szablon naraz', async ({ page }) => {
    await page.goto('./');
    await upusc(page, [await plikProjektu(), plikSzablonu(), tekstowy]);
    await expect(page.getByText('Wczytano 2 z 3 plików.')).toBeVisible();
    await expect(kafelki(page)).toHaveCount(2);
    await expect(page.getByRole('alert')).toContainText('„notatki.txt”');
  });

  test('przeciągnięcie jednego szablonu otwiera edytor kartki', async ({ page }) => {
    await page.goto('./');
    await upusc(page, [plikSzablonu()]);
    await expect(page).toHaveURL(/#\/projekt\//);
    await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
  });

  test('kolizja przy wielu plikach: pytanie o każdy projekt, decyzja „Anuluj” pomija plik', async ({
    page,
  }) => {
    await page.goto('./');
    await page.getByTestId('plik-importu').setInputFiles(await plikProjektu());
    await expect(kafelki(page)).toHaveCount(1);
    await page.getByTestId('plik-importu').setInputFiles([await plikProjektu(), plikSzablonu()]);
    await expect(page.getByRole('alertdialog')).toContainText('jest już w tej przeglądarce');
    // Fokus na bezpiecznej decyzji, nie na „Zastąp”.
    await expect(page.getByRole('button', { name: 'Anuluj' })).toBeFocused();
    await page.getByRole('button', { name: 'Anuluj' }).click();
    await expect(page.getByText('Pominięto plik „mieszane.kartyrpg”')).toBeVisible();
    await expect(page.getByText('Wczytano 1 z 2 plików.')).toBeVisible();
    await expect(kafelki(page)).toHaveCount(2);
  });

  test('fokus wraca na „Importuj pliki…” po zakończeniu importu', async ({ page }) => {
    await page.goto('./');
    await page.getByTestId('plik-importu').setInputFiles(zepsuty);
    await expect(page.getByRole('alert')).toContainText('„zepsuty.kartyrpg”');
    await expect(page.getByRole('button', { name: 'Importuj pliki…' })).toBeFocused();
  });

  test('przyciski nie są wyłączane w trakcie importu (fokus zostaje)', async ({ page }) => {
    await page.goto('./');
    const przycisk = page.getByRole('button', { name: 'Importuj pliki…' });
    await expect(przycisk).toBeEnabled();
    await expect(page.getByTestId('strefa-importu')).toBeEnabled();
    await expect(page.getByTestId('strefa-importu')).toHaveAccessibleName(
      'Wybierz pliki do zaimportowania (można też upuścić je tutaj)',
    );
  });

  test('upuszczenie pliku poza strefą: domyślna akcja zablokowana, nic się nie dzieje', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const adres = page.url();
    const wynik = await page.evaluate(() => {
      const d = new DataTransfer();
      d.items.add(new File(['x'], 'x.kartyrpg'));
      const zdarzenie = (typ: string) =>
        new DragEvent(typ, { dataTransfer: d, bubbles: true, cancelable: true });
      const nad = zdarzenie('dragover');
      document.querySelector('h1')!.dispatchEvent(nad);
      const upusc = zdarzenie('drop');
      document.querySelector('h1')!.dispatchEvent(upusc);
      return { nad: nad.defaultPrevented, efekt: d.dropEffect, upusc: upusc.defaultPrevented };
    });
    expect(wynik).toEqual({ nad: true, efekt: 'none', upusc: true });
    expect(page.url()).toBe(adres);
    await expect(page.getByRole('alert')).toHaveText('');
    await expect(
      page.getByRole('status').filter({ hasText: /Zaimportowano|Wczytano/ }),
    ).toHaveCount(0);
    await expect(kafelki(page)).toHaveCount(0);
  });

  test('nieznane rozszerzenie bez ZIP-a: błąd, a ZIP bez rozszerzenia jest rozpoznany po zawartości', async ({
    page,
  }) => {
    await page.goto('./');
    const projekt = await plikProjektu();
    await page.getByTestId('plik-importu').setInputFiles({ ...projekt, name: 'bez-rozszerzenia' });
    await expect(
      page.getByRole('status').filter({ hasText: 'Zaimportowano projekt' }),
    ).toBeVisible();
    await expect(kafelki(page)).toHaveCount(1);
    await page.getByTestId('plik-importu').setInputFiles(tekstowy);
    await expect(page.getByRole('alert')).toContainText('Nie rozpoznano rodzaju pliku');
  });

  test('szablon zapisany pod nazwą .kartyrpg jest rozpoznany po zawartości', async ({ page }) => {
    await page.goto('./');
    await page
      .getByTestId('plik-importu')
      .setInputFiles({ ...plikSzablonu(), name: 'to-szablon.kartyrpg' });
    await expect(page).toHaveURL(/#\/projekt\//);
  });

  test('plik za duży i „katalog” (błąd odczytu): osobne komunikaty', async ({ page }) => {
    await page.addInitScript(() => {
      const rozmiar = Object.getOwnPropertyDescriptor(Blob.prototype, 'size')!;
      Object.defineProperty(Blob.prototype, 'size', {
        get() {
          return (this as File).name === 'ogromny.kartyrpg'
            ? 600 * 1024 * 1024
            : rozmiar.get!.call(this);
        },
      });
      const odczyt = Blob.prototype.arrayBuffer;
      Blob.prototype.arrayBuffer = function () {
        if ((this as File).name === 'folder.kartyrpg')
          return Promise.reject(new DOMException('katalog', 'NotFoundError'));
        return odczyt.call(this);
      };
    });
    await page.goto('./');
    const maly = { mimeType: 'application/zip', buffer: Buffer.from('x') };
    await page.getByTestId('plik-importu').setInputFiles([
      { name: 'ogromny.kartyrpg', ...maly },
      { name: 'folder.kartyrpg', ...maly },
    ]);
    const alert = page.getByRole('alert');
    await expect(alert).toContainText(
      '„ogromny.kartyrpg”: Plik jest za duży (600 MB, limit 500 MB).',
    );
    await expect(alert).toContainText('„folder.kartyrpg”: Nie można odczytać pliku');
    await expect(page.getByText('Wczytano 0 z 2 plików.')).toBeVisible();
  });

  test('szablon z wbudowanymi zasobami (czcionkami) importuje się i otwiera w edytorze', async ({
    page,
  }) => {
    await page.goto('./');
    await page.getByTestId('plik-importu').setInputFiles(await plikSzablonuZZasobami());
    await expect(page).toHaveURL(/#\/projekt\//);
    await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});

test.describe('przełącznik w pasku', () => {
  for (const motyw of ['light', 'dark'] as const) {
    test(`aktywny przycisk pod kursorem zachowuje tło i czytelną ikonę (${motyw})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: motyw });
      await page.goto('./');
      await page.getByRole('button', { name: /Ustawienia/ }).click();
      const aktywny = page
        .locator('.menu-ustawien-panel')
        .getByRole('button', { name: 'PL', exact: true });
      await expect(aktywny).toHaveAttribute('aria-pressed', 'true');
      await aktywny.hover();
      const kolory = await page.evaluate(() => {
        const korzen = getComputedStyle(document.documentElement);
        const przycisk = document.querySelector<HTMLElement>(
          ".menu-ustawien-seg button[aria-pressed='true']",
        )!;
        const stan = getComputedStyle(przycisk);
        return {
          tlo: stan.backgroundColor,
          tekst: stan.color,
          oczekiwaneTlo: korzen.getPropertyValue('--akcent').trim(),
          oczekiwanyTekst: korzen.getPropertyValue('--akcent-tekst').trim(),
        };
      });
      const rgb = (hex: string) => {
        const pelny =
          hex.length === 4 ? hex.replace(/[0-9a-f]/gi, (c) => c + c).slice(1) : hex.slice(1);
        const n = parseInt(pelny, 16);
        return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
      };
      expect(kolory.tlo).toBe(rgb(kolory.oczekiwaneTlo));
      expect(kolory.tekst).toBe(rgb(kolory.oczekiwanyTekst));
    });
  }
});

test.describe('zrzuty UI-3', () => {
  test.skip(!process.env.ZRZUTY, 'tylko przy ZRZUTY=1');

  test('start: jasny, ciemny, angielski, wąski', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('./');
    await page.getByTestId('plik-importu').setInputFiles(await plikProjektu());
    await expect(kafelki(page)).toHaveCount(1);
    // Otwarcie projektu zapisuje miniaturę – lista pokazuje wtedy prawdziwy podgląd.
    await page.getByRole('link', { name: 'Mieszane' }).first().click();
    await expect(page.locator('[data-karta]')).toHaveCount(10, { timeout: 15000 });
    await page.waitForTimeout(1800);
    await page.getByRole('link', { name: 'Karty RPG' }).click();
    await expect(page.locator('.kafelek-projektu .miniatura img')).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: 'docs/obrazy/ui-3-start-jasny.png' });
    await page.getByRole('button', { name: /Ustawienia/ }).click();
    await page.getByRole('button', { name: 'Motyw ciemny' }).click();
    await page.keyboard.press('Escape');
    await page.screenshot({ path: 'docs/obrazy/ui-3-start-ciemny.png' });
    await page.getByRole('button', { name: /Ustawienia/ }).click();
    await page.getByRole('button', { name: 'Motyw jasny' }).click();
    await page.getByRole('button', { name: 'EN' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Import files…' })).toBeVisible();
    await page.screenshot({ path: 'docs/obrazy/ui-3-start-en-jasny.png' });
    await page.getByRole('button', { name: /Settings/ }).click();
    await page.getByRole('button', { name: 'PL' }).click();
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 800, height: 1500 });
    await page.screenshot({ path: 'docs/obrazy/ui-3-start-waski.png', fullPage: true });
  });
});
