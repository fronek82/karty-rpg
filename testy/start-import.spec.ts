import { expect, test, type Page } from '@playwright/test';
import { plikSzablonu } from './kartkaUI';
import { plikProjektu } from './mieszaneUI';

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
  test('Cinzel Decorative Bold jest załadowana, a preload jest tylko na starcie', async ({
    page,
  }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('head link[rel="preload"][as="font"]')).toHaveCount(1);
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
    await page.goto('./#/wlasne');
    await expect(page.locator('head link[rel="preload"][as="font"]')).toHaveCount(0);
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
  test('„Importuj pliki…” otwiera wybór wielu plików (także z klawiatury)', async ({ page }) => {
    await page.goto('./');
    const przycisk = page.getByRole('button', { name: 'Importuj pliki…' });
    await przycisk.focus();
    const [wybor] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.keyboard.press('Enter'),
    ]);
    expect(wybor.isMultiple()).toBe(true);
    const strefa = page.getByTestId('strefa-importu');
    await strefa.focus();
    const [wybor2] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.keyboard.press('Enter'),
    ]);
    expect(wybor2.isMultiple()).toBe(true);
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
    const wyniki = page.getByRole('list', { name: 'Wyniki importu' });
    await expect(wyniki.getByRole('status')).toHaveCount(2);
    await expect(wyniki.getByRole('alert')).toHaveCount(2);
    await expect(wyniki.getByRole('status').nth(0)).toContainText(
      'Zaimportowano projekt „Mieszane”',
    );
    await expect(wyniki.getByRole('status').nth(1)).toContainText(
      'Utworzono projekt z szablonu „czar.kartyrpg-szablon”',
    );
    await expect(wyniki.getByRole('alert').nth(0)).toContainText('„zepsuty.kartyrpg”');
    await expect(wyniki.getByRole('alert').nth(1)).toContainText('„notatki.txt”');
    await expect(wyniki.getByRole('alert').nth(1)).toContainText('Nie rozpoznano rodzaju pliku');
    await expect(page.getByText('Wczytano 2 z 4 plików.')).toBeVisible();
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
    await page.getByRole('button', { name: 'Anuluj' }).click();
    await expect(page.getByText('Pominięto plik „mieszane.kartyrpg”')).toBeVisible();
    await expect(page.getByText('Wczytano 1 z 2 plików.')).toBeVisible();
    await expect(kafelki(page)).toHaveCount(2);
  });
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
    await page.getByRole('button', { name: 'Motyw ciemny' }).click();
    await page.screenshot({ path: 'docs/obrazy/ui-3-start-ciemny.png' });
    await page.getByRole('button', { name: 'Motyw jasny' }).click();
    await page.getByRole('button', { name: 'EN' }).click();
    await expect(page.getByRole('button', { name: 'Import files…' })).toBeVisible();
    await page.screenshot({ path: 'docs/obrazy/ui-3-start-en-jasny.png' });
    await page.getByRole('button', { name: 'PL' }).click();
    await page.setViewportSize({ width: 800, height: 1500 });
    await page.screenshot({ path: 'docs/obrazy/ui-3-start-waski.png', fullPage: true });
  });
});
