import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { KATALOG_GOOGLE_FONTS, pobierzRodzineGoogle } from '../src/dane/googleFonts';
import { zbudujArkusz } from '../src/druk/arkusz';
import { scenyDoPdf } from '../src/druk/pdf';
import type { Arkusz } from '../src/model/arkusz';
import { pt } from '../src/model/jednostki';
import type { Karta, Szablon, Talia } from '../src/model/szablon';
import { RejestrCzcionek, wczytajCzcionke } from '../src/silnik/czcionki';
import { scenaDoSvg } from '../src/silnik/svg';
import { porownaj, przygotujStrone } from './pdfSvg';
import { zapisano } from './pomoc';
import { dodaj, kreator } from './szablonUI';

/**
 * M4-6: Kuratorowany katalog Google Fonts – zapis lokalny wariantów,
 * obsługa błędu pobierania, praca bez sieci po przeładowaniu, polskie znaki,
 * interfejs PL/EN i ciemny motyw oraz zgodność pikseli PDF↔SVG.
 */

const ttf = (nazwa: string) => readFileSync(resolve('public/czcionki', nazwa));

const GARAMOND = {
  normalny: ttf('EBGaramond-Regular.ttf'),
  pogrubiony: ttf('EBGaramond-Bold.ttf'),
  kursywa: ttf('EBGaramond-Italic.ttf'),
  'pogrubiona-kursywa': ttf('EBGaramond-BoldItalic.ttf'),
};

function bajtyDlaAdresu(url: string): Buffer {
  if (/BoldItalic/i.test(url)) return GARAMOND['pogrubiona-kursywa'];
  if (/Bold/i.test(url)) return GARAMOND.pogrubiony;
  if (/Italic/i.test(url)) return GARAMOND.kursywa;
  return GARAMOND.normalny;
}

test('PDF wygląda jak SVG: karta z krojem z katalogu Google Fonts i polskimi znakami', async ({
  page,
}) => {
  await przygotujStrone(page);

  const almendra = KATALOG_GOOGLE_FONTS.find((p) => p.id === 'almendra')!;
  const wgrane = await pobierzRodzineGoogle(almendra, {
    pobierz: async (url) => {
      const buf = bajtyDlaAdresu(url);
      const kopia = new Uint8Array(buf).slice();
      return { ok: true, status: 200, arrayBuffer: async () => kopia.buffer };
    },
  });

  const czcionki = new RejestrCzcionek();
  for (const w of wgrane) {
    czcionki.dodaj(w.opis.rodzina, w.opis.wariant, wczytajCzcionke(w.opis.id, w.dane));
  }
  czcionki.ustawRole({ tytul: 'Almendra', tresc: 'Almendra' });

  const szablon: Szablon = {
    id: 's-google',
    nazwa: 'Karta Google Fonts',
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    tlo: '#ffffff',
    ramka: { styl: 'ciagla', grubosc: 0.4, kolor: '#1f2937', odsuniecie: 2 },
    korzen: {
      id: 'k',
      typ: 'kolumna',
      padding: 5,
      odstep: 3,
      dzieci: [
        {
          id: 'tytul',
          typ: 'tekst',
          klucz: 'nazwa',
          styl: {
            czcionka: 'tytul',
            wariant: 'pogrubiony',
            rozmiar: pt(14),
            kolor: '#111827',
            wyrownanie: 'srodek',
          },
        },
        {
          id: 'opis',
          typ: 'tekst',
          klucz: 'opis',
          styl: {
            czcionka: 'tresc',
            wariant: 'kursywa',
            rozmiar: pt(10),
            kolor: '#1f2937',
          },
        },
        {
          id: 'stopka',
          typ: 'tekst',
          klucz: 'stopka',
          styl: {
            czcionka: 'Almendra',
            wariant: 'pogrubiona-kursywa',
            rozmiar: pt(9),
            kolor: '#374151',
          },
        },
      ],
    },
  };

  const karty: Karta[] = [
    {
      id: 'k1',
      szablonId: szablon.id,
      ilosc: 1,
      dane: {
        nazwa: 'Zażółć gęślą jaźń',
        opis: 'ĄĆĘŁŃÓŚŹŻ · ąćęłńóśźż – sprawdzian odmian i polskich znaków diakrytycznych.',
        stopka: 'Źdźbło łąki, ćma w płomieniu świecy.',
      },
    },
  ];
  const talia: Talia = { id: 't1', nazwa: 'Talia', karty };
  const arkusz: Arkusz = {
    id: 'a1',
    nazwa: 'Arkusz',
    taliaId: talia.id,
    ustawienia: {
      papier: 'A4',
      orientacja: 'pionowa',
      marginesy: { gora: 10, prawo: 10, dol: 10, lewo: 10 },
      linie: { grubosc: 0.2, kolor: '#888888', kreska: 2, przerwa: 2 },
    },
  };

  const wynik = zbudujArkusz(arkusz, talia, {
    czcionki,
    szablony: new Map([[szablon.id, szablon]]),
  });
  expect(wynik.ostrzezenia).toEqual([]);
  const scena = wynik.strony[0]!;
  const { bajty } = await scenyDoPdf([scena]);
  const svg = scenaDoSvg(scena);
  const w = await porownaj(page, svg, bajty);
  expect(w.ciemneSvg).toBeGreaterThan(w.wszystkie * 0.002);
  expect(Math.abs(w.ciemnePdf - w.ciemneSvg) / w.ciemneSvg).toBeLessThan(0.05);
  expect(w.rozne / w.wszystkie).toBeLessThan(0.005);
});

test('katalog Google Fonts E2E: błąd sieci, zapis lokalny, polskie znaki, praca offline i PL/EN + ciemny motyw', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1050 });
  await kreator(page, {
    nazwa: 'Karta czcionek',
    format: 'Poker',
    uklad: 'Swobodny',
  });
  await dodaj(page, 'Tekst', 'Tytuł');
  await page.getByRole('button', { name: 'Rób karty' }).click();
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });

  // Dodaj kartę z polskimi znakami.
  await page.locator('.strona-kartki .slot').first().click();
  await page.getByRole('menu').getByRole('menuitem').first().click();
  const panelKarty = page.getByRole('complementary', { name: 'Zaznaczone karty' });
  await expect(panelKarty).toBeVisible();
  await panelKarty
    .locator('textarea, input[type="text"]')
    .first()
    .fill('Zażółć gęślą jaźń ĄĆĘŁŃÓŚŹŻ');
  await zapisano(page);

  const bledyStrony: Error[] = [];
  page.on('pageerror', (err) => bledyStrony.push(err));
  let trybSieci: 'blad' | 'ok' | 'offline' = 'blad';
  let wywolaniaZewnetrzne = 0;

  await page.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, async (route) => {
    if (trybSieci === 'offline') {
      await route.abort('internetdisconnected');
      return;
    }
    await route.fulfill({ status: 200, contentType: 'text/css; charset=utf-8', body: '' });
  });

  // Otwórz Ustawienia i rozwiń katalog Google Fonts.
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  const ust = page.getByRole('complementary', { name: 'Ustawienia' });
  const katalog = ust.locator('details.katalog-google-fonts');
  await katalog.locator('summary').click();

  // Filtr kategorii (lista rozwijana), podgląd kroju i wyszukiwanie.
  const kategoria = katalog.getByLabel('Kategoria krojów');
  await expect(katalog.locator('.podglad-google-font').first()).toBeVisible();
  await kategoria.selectOption('bezszeryfowa');
  await expect(katalog.getByText('Fira Sans', { exact: true })).toBeVisible();
  await expect(katalog.getByText('Almendra', { exact: true })).toBeHidden();
  await kategoria.selectOption('wszystkie');
  await katalog.getByLabel('Szukaj kroju').fill('MedievalSharp');
  await expect(katalog.locator('.pozycja-google-font')).toHaveCount(1);
  await katalog.getByLabel('Szukaj kroju').fill('Almendra');
  await expect(katalog.locator('.pozycja-google-font')).toHaveCount(2);

  // 1) Błąd sieci: oba źródła zwracają HTTP 503 → czytelny komunikat błędu, krój NIE zostaje dodany.
  await page.route(
    /^https:\/\/(cdn\.jsdelivr\.net|raw\.githubusercontent\.com)\//,
    async (route) => {
      wywolaniaZewnetrzne++;
      if (trybSieci === 'offline') {
        await route.abort('internetdisconnected');
        return;
      }
      if (trybSieci === 'blad') {
        await route.fulfill({ status: 503, body: 'Service Unavailable' });
        return;
      }
      const bajty = bajtyDlaAdresu(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: 'font/ttf',
        body: bajty,
      });
    },
  );

  const sekcjaCzcionek = ust.locator('fieldset.sekcja-czcionek');
  await katalog.getByRole('button', { name: 'Pobierz krój Almendra z Google Fonts' }).click();
  await expect(sekcjaCzcionek.getByRole('alert')).toContainText(/Almendra.*503/);
  await expect(
    katalog.getByRole('button', { name: 'Pobierz krój Almendra z Google Fonts' }),
  ).toBeEnabled();

  // 2) Poprawne pobranie z zapisanych bajtów TTF → zapis lokalny i pojawienie się w rolach.
  trybSieci = 'ok';
  await katalog.getByRole('button', { name: 'Pobierz krój Almendra z Google Fonts' }).click();
  await expect(sekcjaCzcionek.getByRole('status')).toContainText(
    'Pobrano krój „Almendra” (4 warianty) i zapisano lokalnie w projekcie.',
  );
  await expect(katalog.getByRole('button', { name: 'Almendra – dodano' })).toBeDisabled();

  // Przypisz Almendrę do pierwszej roli czcionki projektu.
  const selectRoli = ust.locator('fieldset.sekcja-czcionek select').first();
  await selectRoli.selectOption('Almendra');
  await zapisano(page);

  // 3) Praca bez sieci po przeładowaniu: blokada zapytań zewnętrznych i zero nowych żądań sieciowych.
  trybSieci = 'offline';
  const przedPrzeladowaniem = wywolaniaZewnetrzne;
  await page.reload();
  await expect(page.locator('.strona-kartki .karta-na-kartce').first()).toBeVisible({
    timeout: 15000,
  });
  expect(wywolaniaZewnetrzne).toBe(przedPrzeladowaniem);
  expect(await page.locator('.strona-kartki svg path').count()).toBeGreaterThan(20);

  await page.getByRole('button', { name: /Ustawienia/ }).click();
  const ustPo = page.getByRole('complementary', { name: 'Ustawienia' });
  await expect(ustPo.locator('fieldset.sekcja-czcionek select').first()).toHaveValue('Almendra');
  const katalogPo = ustPo.locator('details.katalog-google-fonts');
  await katalogPo.locator('summary').click();
  await expect(katalogPo.locator('.podglad-google-font').first()).toBeVisible();
  await expect(katalogPo.getByRole('button', { name: 'Almendra – dodano' })).toBeDisabled();
  expect(bledyStrony).toEqual([]);

  // 4) EN + ciemny motyw.
  await page
    .getByRole('group', { name: /^(Język|Language)$/ })
    .getByRole('button', { name: 'EN', exact: true })
    .click();
  await page.getByRole('button', { name: /Dark theme|Ciemny motyw/ }).click();
  const ustEn = page.getByRole('complementary', { name: 'Settings' });
  const katalogEn = ustEn.locator('details.katalog-google-fonts');
  await expect(katalogEn.locator('summary')).toHaveText('Google Fonts catalog');
  await expect(katalogEn.getByLabel('Search typeface')).toBeVisible();
  await expect(katalogEn.getByLabel('Typeface category')).toHaveValue('wszystkie');
  await expect(katalogEn.getByRole('button', { name: 'Almendra – added' })).toBeDisabled();
});
