import { mkdir, readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { kliknijPobierzPdf } from './pomoc';
import { eksportujProjekt } from '../src/dane/archiwum';
import { projektZPakietu } from '../src/dane/pakiet';
import { PAKIET_WLASNY, pakietWlasny, ustawieniaKartkiDla } from '../src/dane/wlasneKarty';
import { PT_NA_MM, pt } from '../src/model/jednostki';
import type { OpisCzcionki } from '../src/model/projekt';
import type { Karta, Rewers, Szablon } from '../src/model/szablon';

/**
 * M4-7: neutralny projekt odbiorowy „Atlas kartograficzny” / „Cartographic Atlas”
 * w PL i EN oraz w motywie jasnym i ciemnym:
 * - dwa rewersy warstwowe (tekstura z kryciem i zabarwieniem, tekst po łuku, ikony z obrotem i kryciem),
 * - dziedziczenie przypisań (talia → karta z nadpisaniem → jawny brak `null`),
 * - druk dwustronny (para przód/tył, długa krawędź, nakład 2×),
 * - tryb drukarni (spad 3 mm, znaczniki cięcia, siatka na arkuszu),
 * - lokalnie zapisany krój z katalogu Google Fonts (`zrodlo: 'google'`) z polskimi znakami bez sieci.
 */

function neutralneRewersy(en: boolean): Rewers[] {
  const rozmiar = { tryb: 'mm', szerokosc: 63, wysokosc: 88 } as const;
  return [
    {
      id: 'rev-kompas',
      nazwa: en ? 'Compass back' : 'Rewers kompasu',
      rozmiar,
      tlo: '#1e3a5f',
      teksturaTla: 'faktura-tla',
      teksturaTryb: 'wypelnij',
      teksturaKrycie: 0.22,
      teksturaZabarwienie: { kolor: '#0f172a', krycie: 0.35 },
      ramka: { styl: 'podwojna', grubosc: 0.45, przerwa: 0.7, kolor: '#e2c275', odsuniecie: 2.5 },
      korzen: {
        id: 'rk-kompas',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'luk-gora',
            typ: 'tekst',
            tekst: en ? 'NORTHERN TRAIL' : 'SZLAK PÓŁNOCNY',
            pozycja: { x: 6, y: 12 },
            szerokosc: { mm: 51 },
            wysokosc: { mm: 16 },
            styl: {
              czcionka: 'Almendra',
              wariant: 'pogrubiony',
              rozmiar: pt(10),
              kolor: '#f8e7b5',
              wyrownanie: 'srodek',
            },
            luk: { promien: 34, kierunek: 'gora' },
          },
          {
            id: 'znak-kompasu',
            typ: 'ikona',
            ikona: 'gwiazdka',
            element: 'wb:gwiazda',
            rozmiar: 20,
            kolor: '#e2c275',
            krycie: 0.85,
            pozycja: { x: 21.5, y: 34, obrot: 15 },
          },
          {
            id: 'luk-dol',
            typ: 'tekst',
            tekst: en ? 'FIELD ATLAS' : 'ATLAS TERENOWY',
            pozycja: { x: 6, y: 62 },
            szerokosc: { mm: 51 },
            wysokosc: { mm: 16 },
            styl: {
              czcionka: 'Almendra',
              rozmiar: pt(9),
              kolor: '#e2e8f0',
              wyrownanie: 'srodek',
            },
            luk: { promien: 34, kierunek: 'dol' },
          },
        ],
      },
    },
    {
      id: 'rev-pieczec',
      nazwa: en ? 'Seal back' : 'Rewers pieczęci',
      rozmiar,
      tlo: '#7c2d12',
      ramka: { styl: 'ciagla', grubosc: 0.5, kolor: '#fde68a', odsuniecie: 2.5 },
      korzen: {
        id: 'rk-pieczec',
        typ: 'swobodny',
        dzieci: [
          {
            id: 'luk-pieczec',
            typ: 'tekst',
            tekst: en ? 'FIELD SEAL' : 'PIECZĘĆ POLOWA',
            pozycja: { x: 6, y: 15 },
            szerokosc: { mm: 51 },
            wysokosc: { mm: 16 },
            styl: {
              czcionka: 'Almendra',
              wariant: 'pogrubiony',
              rozmiar: pt(10),
              kolor: '#fef3c7',
              wyrownanie: 'srodek',
            },
            luk: { promien: 32, kierunek: 'gora' },
          },
          {
            id: 'znak-lisc',
            typ: 'ikona',
            ikona: 'gwiazdka',
            element: 'wb:lisc',
            rozmiar: 18,
            kolor: '#fde68a',
            krycie: 0.9,
            pozycja: { x: 22.5, y: 36, obrot: 20 },
          },
        ],
      },
    },
  ];
}

function neutralnySzablon(en: boolean): Szablon {
  return {
    id: 'karta-atlasu',
    nazwa: en ? 'Atlas entry' : 'Karta atlasu',
    rozmiar: { tryb: 'mm', szerokosc: 63, wysokosc: 88 },
    tlo: '#fbf6ea',
    ramka: { styl: 'ciagla', grubosc: 0.45, kolor: '#1e3a5f', odsuniecie: 2.5 },
    korzen: {
      id: 'korzen',
      typ: 'kolumna',
      padding: 5,
      odstep: 3,
      dzieci: [
        {
          id: 'tytul',
          typ: 'tekst',
          klucz: 'tytul',
          styl: {
            czcionka: 'Almendra',
            wariant: 'pogrubiony',
            rozmiar: pt(12),
            kolor: '#1e3a5f',
            wyrownanie: 'srodek',
          },
        },
        {
          id: 'podtytul',
          typ: 'tekst',
          klucz: 'region',
          styl: {
            czcionka: 'Almendra',
            wariant: 'kursywa',
            rozmiar: pt(9),
            kolor: '#7c2d12',
            wyrownanie: 'srodek',
          },
        },
        {
          id: 'opis',
          typ: 'tekst',
          klucz: 'opis',
          styl: { czcionka: 'Almendra', rozmiar: pt(8.5), kolor: '#1f2937' },
          wysokosc: { wypelnij: 1 },
        },
        {
          id: 'stopka',
          typ: 'tekst',
          klucz: 'oznaczenie',
          styl: {
            czcionka: 'Almendra',
            rozmiar: pt(7.5),
            kolor: '#475569',
            wyrownanie: 'srodek',
          },
        },
      ],
    },
  };
}

for (const en of [false, true]) {
  for (const motyw of ['light', 'dark'] as const) {
    const jezyk = en ? 'en' : 'pl';
    const nazwa = en ? 'Cartographic Atlas' : 'Atlas kartograficzny';

    test(`M4: neutralny projekt odbiorowy w ${jezyk.toUpperCase()} i motywie ${motyw}`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width: 1440, height: 1120 });
      await page.emulateMedia({ colorScheme: motyw });
      await page.addInitScript((lang) => localStorage.setItem('karty.jezyk', lang), jezyk);
      // Krój `zrodlo: 'google'` ma działać całkowicie bez sieci – blokujemy domeny zewnętrzne.
      await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
      await page.goto('./#/');

      const szablon = neutralnySzablon(en);
      const rewersy = neutralneRewersy(en);
      const karty: Karta[] = [
        {
          id: 'szlak-1',
          szablonId: szablon.id,
          ilosc: 2,
          dane: {
            tytul: en ? 'Spring Pass' : 'Przełęcz Źródlana',
            region: en ? 'Northern Ridge · 2× copies' : 'Pasmo Północne · nakład 2×',
            opis: en
              ? 'Stone marker above the stream. Inherits the deck compass back and uses a local Google Fonts typeface.'
              : 'Kamienny kopiec nad potokiem. Dziedziczy rewers kompasu z talii i korzysta z lokalnie zapisanego kroju Google Fonts (zażółć gęślą jaźń).',
            oznaczenie: en ? 'Back: inherited (Compass)' : 'Rewers: dziedziczony (kompas)',
          },
        },
        {
          id: 'szlak-2',
          szablonId: szablon.id,
          ilosc: 1,
          rewersId: 'rev-pieczec',
          dane: {
            tytul: en ? 'Watchtower Hill' : 'Wzgórze Strażnicze',
            region: en ? 'Eastern Clearing' : 'Polana Wschodnia',
            opis: en
              ? 'Overrides the deck back directly on the card with the terracotta seal back.'
              : 'Nadpisuje rewers bezpośrednio na karcie – na tyle arkusza drukuje się rewers pieczęci.',
            oznaczenie: en ? 'Back: card override (Seal)' : 'Rewers: własny karty (pieczęć)',
          },
        },
        {
          id: 'szlak-bez-rewersu',
          szablonId: szablon.id,
          ilosc: 1,
          rewersId: null,
          dane: {
            tytul: en ? 'Blank Field Note' : 'Karta robocza',
            region: en ? 'No card back' : 'Bez rewersu',
            opis: en
              ? 'Explicitly disables the back on this card – its mirrored slot on the back page stays empty.'
              : 'Jawne ustawienie „bez rewersu” zatrzymuje dziedziczenie – lustrzane pole na tyle zostaje puste.',
            oznaczenie: en ? 'Back: none (explicit)' : 'Rewers: brak (jawny)',
          },
        },
      ];

      const pakiet = {
        ...pakietWlasny([szablon]),
        nazwa,
        szablony: [szablon],
        zasoby: [
          {
            id: 'faktura-tla',
            plik: 'testy/zasoby/ramka-testowa.png',
            format: 'png' as const,
            szerokosc: 120,
            wysokosc: 120,
          },
        ],
        talie: [
          {
            id: 'atlas',
            nazwa,
            karty: karty.map(({ rewersId: _r, ...reszta }) => {
              void _r;
              return reszta;
            }),
          },
        ],
        arkusze: [
          {
            id: 'atlas-druk',
            nazwa,
            taliaId: 'atlas',
            ustawienia: {
              ...ustawieniaKartkiDla(szablon),
              dwustronny: { wlaczony: true as const, krawedz: 'dluga' as const },
              drukarnia: {
                wlaczony: true as const,
                spad: 3,
                znacznikiCiecia: true as const,
                uklad: 'siatka' as const,
              },
            },
          },
        ],
      };

      const { projekt: bazowy, zasoby } = await projektZPakietu(
        pakiet,
        async (f) => new Uint8Array(await readFile(`public/czcionki/${f}`)),
        async (f) => new Uint8Array(await readFile(f)),
        `atlas-m4-${jezyk}-${motyw}`,
      );

      // Dodaj lokalne warianty kroju Google Fonts (`zrodlo: 'google'`) – działa w 100% offline.
      const wariantyGoogle: { id: string; wariant: OpisCzcionki['wariant']; plik: string }[] = [
        { id: 'almendra-normalny', wariant: 'normalny', plik: 'EBGaramond-Regular.ttf' },
        { id: 'almendra-pogrubiony', wariant: 'pogrubiony', plik: 'EBGaramond-Bold.ttf' },
        { id: 'almendra-kursywa', wariant: 'kursywa', plik: 'EBGaramond-Italic.ttf' },
      ];
      const zasobyGoogle: OpisCzcionki[] = [];
      for (const w of wariantyGoogle) {
        const bajty = new Uint8Array(await readFile(`public/czcionki/${w.plik}`));
        zasoby.set(w.id, bajty);
        zasobyGoogle.push({
          id: w.id,
          rodzaj: 'czcionka',
          nazwa: w.plik,
          format: 'ttf',
          rodzina: 'Almendra',
          wariant: w.wariant,
          zrodlo: 'google',
        });
      }

      const projekt = {
        ...bazowy,
        pakiet: PAKIET_WLASNY,
        rewersy,
        talie: [{ id: 'atlas', nazwa, karty, rewersId: 'rev-kompas' }],
        zasoby: [...bazowy.zasoby, ...zasobyGoogle],
        role: { ...bazowy.role, tytul: 'Almendra', tresc: 'Almendra' },
      };

      await page.getByTestId('plik-importu').setInputFiles({
        name: 'atlas-m4.kartyrpg',
        mimeType: 'application/zip',
        buffer: Buffer.from(eksportujProjekt(projekt, zasoby)),
      });
      await page.getByRole('link', { name: nazwa, exact: true }).first().click();

      await expect(page.locator('html')).toHaveAttribute('lang', jezyk);
      await expect(page.locator('html')).toHaveAttribute('data-theme', motyw);
      await expect(
        page.getByRole('button', { name: en ? /^Spring Pass/ : /^Przełęcz Źródlana/ }),
      ).toHaveCount(2);
      await expect(
        page.getByRole('button', { name: en ? /^Watchtower Hill/ : /^Wzgórze Strażnicze/ }),
      ).toHaveCount(1);
      await expect(
        page.getByRole('button', { name: en ? /^Blank Field Note/ : /^Karta robocza/ }),
      ).toHaveCount(1);

      // Widok par przód + tył z trybem drukarni (2 strony SVG na ekranie: przód i lustrzany tył).
      const stronySvg = page.locator('.strona-kartki .svg-strony');
      await expect(stronySvg).toHaveCount(2);
      const tylSvg = stronySvg.nth(1);
      // Na tyle widoczne są dwa rewersy kompasu (#1e3a5f) i jeden pieczęci (#7c2d12); karta bez rewersu jest pusta.
      await expect(tylSvg.locator('[fill="#1e3a5f"]')).toHaveCount(2);
      const pieczecTlo = tylSvg.locator('[fill="#7c2d12"]');
      await expect(pieczecTlo).toHaveCount(1);
      // Karta z pieczęcią leży w lewej kolumnie przodu → po odbiciu długiej krawędzi trafia do prawej połowy tyłu.
      const [boxStronyTylu, boxPieczeci] = await Promise.all([
        tylSvg.boundingBox(),
        pieczecTlo.boundingBox(),
      ]);
      expect(boxStronyTylu).not.toBeNull();
      expect(boxPieczeci).not.toBeNull();
      expect(boxPieczeci!.x + boxPieczeci!.width / 2).toBeGreaterThan(
        boxStronyTylu!.x + boxStronyTylu!.width / 2,
      );
      // Znaczniki cięcia obecne na obu stronach oraz świadome ostrzeżenie < 300 dpi dla testowej tekstury 120×120 px.
      expect(await stronySvg.nth(0).locator('line').count()).toBeGreaterThan(8);
      expect(await tylSvg.locator('line').count()).toBeGreaterThan(8);
      await expect(page.locator('details.ostrzezenia-projektu')).toBeVisible();

      if (process.env.ZRZUTY_M4_7) {
        await mkdir('docs/obrazy/m4-7', { recursive: true });
        await page.screenshot({ path: `docs/obrazy/m4-7/${jezyk}-${motyw}.png` });
      }

      // Pobierz dwustronny PDF w trybie drukarni i zweryfikuj obie strony A4 (przód + lustrzany tył).
      const [plik] = await Promise.all([
        page.waitForEvent('download'),
        kliknijPobierzPdf(page, en),
      ]);
      const bajtyPdf = await readFile((await plik.path())!);
      expect(bajtyPdf.subarray(0, 5).toString()).toBe('%PDF-');
      const pdf = await PDFDocument.load(bajtyPdf);
      expect(pdf.getPageCount()).toBe(2);
      for (const idx of [0, 1]) {
        const { width, height } = pdf.getPage(idx).getSize();
        expect(width / PT_NA_MM).toBeCloseTo(210, 1);
        expect(height / PT_NA_MM).toBeCloseTo(297, 1);
      }
    });
  }
}
