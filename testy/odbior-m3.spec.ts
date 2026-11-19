import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { eksportujProjekt } from '../src/dane/archiwum';
import { projektZPakietu } from '../src/dane/pakiet';
import { PAKIET_WLASNY, pakietWlasny, ustawieniaKartkiDla } from '../src/dane/wlasneKarty';
import { MIESZANE_DOMYSLNE } from '../src/model/arkusz';
import type {
  Karta,
  Kontener,
  PoleTekst,
  PoleWartosc,
  StylTekstu,
  Szablon,
} from '../src/model/szablon';

const STYL: StylTekstu = { czcionka: 'tresc', rozmiar: 3 };
const kolorPanelu = {
  klucz: 'trasa',
  domyslny: '#f3ebcd',
  mapa: [{ wartosc: 'północ', kolor: '#a7ccd9' }],
};
const romb = (id: string, tekst: string, etykieta: string): PoleWartosc => ({
  id,
  tekst,
  etykieta: { tekst: etykieta, pozycja: 'nad' },
  typ: 'wartosc',
  ksztalt: 'romb',
  grupaStyluId: 'wyniki',
  styl: STYL,
  padding: 3,
  tlo: '#f4e1ba',
  obramowanie: { grubosc: 0.4, kolor: '#493336', szkic: { sila: 0.25, ziarno: 29 } },
});
const opisPanelu = (id: string, tekst: string): PoleTekst => ({
  id,
  typ: 'tekst',
  tekst,
  styl: { ...STYL, rozmiar: 2.3 },
  padding: 1.5,
  szerokosc: { wypelnij: 1 },
  wysokosc: { wypelnij: 1 },
  tlo: '#dce7c4',
});
const panel = (id: string, dzieci: Kontener['dzieci']): Kontener => ({
  id,
  typ: 'wiersz',
  wysokosc: { mm: 13 },
  odstep: 1,
  dzieci,
});

function neutralneSzablony(en: boolean): Szablon[] {
  const nazwy = en
    ? ['Measurements', 'Route log', 'Supply table']
    : ['Pomiary', 'Dziennik trasy', 'Zapasy'];
  const rozmiar = { tryb: 'mm', szerokosc: 63, wysokosc: 88 } as const;
  return [
    {
      id: 'pomiary',
      nazwa: nazwy[0]!,
      rozmiar,
      tlo: '#fffaf0',
      grupyStylow: [
        {
          id: 'wyniki',
          nazwa: en ? 'Results' : 'Wyniki',
          styl: { ...STYL, rozmiar: 5, kolor: '#623f56', wyrownanie: 'srodek' },
        },
      ],
      korzen: {
        id: 'korzen',
        typ: 'kolumna',
        padding: 4,
        odstep: 4,
        dzieci: [
          {
            id: 'tytul',
            typ: 'tekst',
            tekst: nazwy[0]!,
            styl: { ...STYL, wariant: 'pogrubiony', rozmiar: 5 },
            wysokosc: { mm: 8 },
          },
          romb('temperatura', '+8', en ? 'Temperature' : 'Temperatura'),
          romb('wiatr', '12', en ? 'Wind' : 'Wiatr'),
        ],
      },
    },
    {
      id: 'trasa',
      nazwa: nazwy[1]!,
      rozmiar,
      tlo: '#f7f3e5',
      parametry: [{ klucz: 'trasa', nazwa: en ? 'Route' : 'Trasa', domyslnie: 'północ' }],
      korzen: {
        id: 'korzen',
        typ: 'kolumna',
        padding: 3,
        odstep: 1.5,
        dzieci: [
          {
            id: 'tytul',
            typ: 'tekst',
            klucz: 'tytul',
            styl: { ...STYL, wariant: 'pogrubiony', rozmiar: 4 },
          },
          panel('gora', [
            {
              id: 'panel-start',
              typ: 'kolumna',
              dzieci: [
                { ...opisPanelu('start', en ? 'Start: hill' : 'Start: wzgórze'), tlo: undefined },
              ],
              tloZDanych: kolorPanelu,
              szerokosc: { wypelnij: 1 },
            },
            opisPanelu('koniec', en ? 'Finish: bridge' : 'Meta: most'),
          ]),
          panel('dol', [
            opisPanelu('czas', en ? 'Time: 45 min' : 'Czas: 45 min'),
            opisPanelu('dystans', en ? 'Distance: 3 km' : 'Dystans: 3 km'),
          ]),
          {
            id: 'wskazowki',
            typ: 'tekst',
            klucz: 'opis',
            styl: { ...STYL, rozmiar: 2.5 },
            listyNumerowane: true,
            ikonyWTekscie: true,
            kontynuuj: true,
            wysokosc: { wypelnij: 1 },
          },
          {
            id: 'stopka',
            typ: 'tekst',
            tekst: en ? 'Field notes' : 'Notatki terenowe',
            styl: { ...STYL, rozmiar: 2.1 },
          },
        ],
      },
    },
    {
      id: 'zapasy',
      nazwa: nazwy[2]!,
      rozmiar,
      promienRogow: 5,
      tlo: '#f6dbd8',
      teksturaTla: 'faktura',
      postrzepienie: { sila: 0.7, ziarnistosc: 2.2, ziarno: 23 },
      korzen: {
        id: 'korzen',
        typ: 'kolumna',
        padding: 4,
        odstep: 3,
        dzieci: [
          {
            id: 'tytul',
            typ: 'tekst',
            tekst: nazwy[2]!,
            styl: { ...STYL, kapitaliki: true, rozmiar: 5 },
          },
          {
            id: 'tabela',
            typ: 'tabela',
            tlo: '#fff4de',
            tloNaglowka: '#f7dba4',
            styl: STYL,
            wiersze: 2,
            kolumny: [
              { klucz: 'rzecz', naglowek: en ? 'Item' : 'Rzecz' },
              { klucz: 'liczba', naglowek: en ? 'Count' : 'Liczba' },
            ],
            linie: { kolor: '#4e3f38', grubosc: 0.2 },
          },
        ],
      },
    },
  ];
}

for (const en of [false, true]) {
  for (const motyw of ['light', 'dark'] as const) {
    const jezyk = en ? 'en' : 'pl';
    const nazwa = en ? 'Field expedition' : 'Wyprawa terenowa';
    test(`M3: trzy neutralne przykłady w ${jezyk.toUpperCase()} i motywie ${motyw}`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width: 1440, height: 1170 });
      await page.emulateMedia({ colorScheme: motyw });
      await page.addInitScript((lang) => localStorage.setItem('karty.jezyk', lang), jezyk);
      await page.goto('./#/');
      const szablony = neutralneSzablony(en);
      const pozycja = en
        ? 'Record the trail marker, follow the path along the water and record the next turn.'
        : 'Zapisz znak na szlaku, idź ścieżką wzdłuż potoku i zanotuj następne rozwidlenie.';
      const daneTalii: Karta[] = [
        { id: 'pomiary', szablonId: 'pomiary', ilosc: 1, dane: {} },
        {
          id: 'trasa',
          szablonId: 'trasa',
          ilosc: 1,
          dane: {
            tytul: szablony[1]!.nazwa,
            trasa: 'północ',
            opis: Array.from({ length: 9 }, (_, i) => `${i + 1}. :star: ${pozycja}`).join('\n'),
          },
        },
        {
          id: 'zapasy',
          szablonId: 'zapasy',
          ilosc: 1,
          dane: {
            rzecz: en ? 'Rope' : 'Linka',
            liczba: '1',
            'rzecz.2': en ? 'Map' : 'Mapa',
            'liczba.2': '2',
          },
        },
      ];
      const pakiet = {
        ...pakietWlasny(szablony),
        nazwa,
        szablony,
        zasoby: [
          {
            id: 'faktura',
            plik: 'testy/zasoby/ramka-testowa.png',
            format: 'png' as const,
            szerokosc: 120,
            wysokosc: 120,
          },
        ],
        talie: [{ id: 'wyprawa', nazwa, karty: daneTalii }],
        arkusze: [
          {
            id: 'wyprawa',
            nazwa,
            taliaId: 'wyprawa',
            ustawienia: {
              ...ustawieniaKartkiDla(szablony[0]!),
              rozmiary: 'mieszane' as const,
              mieszane: { ...MIESZANE_DOMYSLNE, kolejnosc: 'wlasna' as const, odstep: 2 },
            },
          },
        ],
      };
      const { projekt, zasoby } = await projektZPakietu(
        pakiet,
        async (f) => new Uint8Array(await readFile(`public/czcionki/${f}`)),
        async (f) => new Uint8Array(await readFile(f)),
        'wyprawa-test-m3',
      );
      await page.getByTestId('plik-importu').setInputFiles({
        name: 'wyprawa.kartyrpg',
        mimeType: 'application/zip',
        buffer: Buffer.from(eksportujProjekt({ ...projekt, pakiet: PAKIET_WLASNY }, zasoby)),
      });
      await page.getByRole('link', { name: nazwa, exact: true }).first().click();
      await expect(page.locator('html')).toHaveAttribute('lang', jezyk);
      await expect(page.locator('html')).toHaveAttribute('data-theme', motyw);
      await expect(page.locator('[data-karta="pomiary"]')).toBeVisible();
      await expect(page.locator('[data-karta="trasa"]').first()).toBeVisible();
      await expect(page.locator('[data-karta="trasa"]').nth(1)).toHaveAccessibleName(
        en ? /Continued 2/i : /Ciąg dalszy 2/i,
      );
      await expect(page.locator('[data-karta="zapasy"]')).toBeVisible();
      const arkusz = page.locator('.strona-kartki .svg-strony');
      await expect(arkusz.locator('[fill="#623f56"]').first()).toBeAttached();
      await expect(arkusz.locator('path[stroke="#493336"]').first()).toBeAttached();
      await expect(arkusz.locator('[fill="#a7ccd9"]').first()).toBeAttached();
      await expect(arkusz.locator('clipPath path')).toHaveCount(1);
      await expect(arkusz.locator('image')).toHaveCount(1);
      await expect(arkusz.locator('[fill="#f7dba4"]').first()).toBeAttached();

      if (process.env.ZRZUTY_M3_8)
        await page.screenshot({ path: `docs/obrazy/m3-8/${jezyk}-${motyw}.png` });
      const [plik] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: en ? /Download PDF/ : /Pobierz PDF/ }).click(),
      ]);
      expect((await readFile(await plik.path())).subarray(0, 5).toString()).toBe('%PDF-');
    });
  }
}
