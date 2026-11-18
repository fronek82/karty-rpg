import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { eksportujProjekt } from '../src/dane/archiwum';
import { projektZPakietu } from '../src/dane/pakiet';
import { PAKIET_WLASNY, pakietWlasny, ustawieniaKartkiDla } from '../src/dane/wlasneKarty';
import type { Arkusz } from '../src/model/arkusz';
import type { Szablon, Talia } from '../src/model/szablon';

/** Wspólne dane i kroki testów kartki z mieszanymi rozmiarami (M2b-2): E(1) i test mieszanych. */

/** Prosty szablon karty w mm: kolorowe tło, tytuł i biały panel z wymiarem. */
export const szablonProstokata = (
  id: string,
  nazwa: string,
  szer: number,
  wys: number,
  kolor: string,
) =>
  ({
    id,
    nazwa,
    rozmiar: { tryb: 'mm', szerokosc: szer, wysokosc: wys },
    promienRogow: 2,
    tlo: kolor,
    korzen: {
      id: 'korzen',
      typ: 'kolumna',
      padding: 3,
      odstep: 2,
      dzieci: [
        {
          id: 'tytul',
          typ: 'tekst',
          tekst: nazwa,
          wieleWierszy: false,
          styl: {
            czcionka: 'tresc',
            wariant: 'pogrubiony',
            rozmiar: 5,
            kolor: '#ffffff',
            wyrownanie: 'srodek',
          },
        },
        {
          id: 'panel',
          typ: 'tekst',
          tekst: `${szer}×${wys}`,
          wysokosc: { wypelnij: 1 },
          tlo: '#ffffff',
          promien: 1.5,
          padding: 2,
          styl: { czcionka: 'tresc', rozmiar: 3, kolor: '#888888', wyrownanie: 'srodek' },
        },
      ],
    },
  }) satisfies Szablon;

export const SZABLONY: Szablon[] = [
  szablonProstokata('arkana', 'Arkana', 70, 120, '#6b3d8f'),
  szablonProstokata('czar', 'Czar', 63, 88, '#b0302a'),
  szablonProstokata('przedmiot', 'Przedmiot', 44, 68, '#2a7b72'),
  szablonProstokata('zeton', 'Żeton', 40, 40, '#c9a227'),
];

const ILOSCI = { arkana: 2, czar: 3, przedmiot: 5 };
export const TALIA: Talia = {
  id: 'talia',
  nazwa: 'Mieszane',
  karty: Object.entries(ILOSCI).flatMap(([szablonId, n]) =>
    Array.from({ length: n }, (_, i) => ({
      id: `${szablonId}-${i + 1}`,
      szablonId,
      dane: {},
      ilosc: 1,
    })),
  ),
};
export const arkuszMieszany = (zmiana: Partial<Arkusz['ustawienia']> = {}): Arkusz => ({
  id: 'kartka-1',
  nazwa: 'Kartka 1',
  taliaId: 'talia',
  ustawienia: {
    ...ustawieniaKartkiDla(SZABLONY[0]!),
    rozmiary: 'mieszane',
    ...zmiana,
  },
});

/** Plik projektu (.kartyrpg) z kartkami w trybie mieszanym, z wbudowanymi czcionkami. */
export async function plikProjektu() {
  const pakiet = {
    ...pakietWlasny(SZABLONY),
    nazwa: 'Mieszane',
    szablony: SZABLONY,
    talie: [TALIA],
    arkusze: [arkuszMieszany()],
  };
  const { projekt, zasoby } = await projektZPakietu(
    pakiet,
    async (f) => new Uint8Array(readFileSync(`public/czcionki/${f}`)),
    () => Promise.reject(new Error('brak obrazów')),
    'mieszane',
  );
  return {
    name: 'mieszane.kartyrpg',
    mimeType: 'application/zip',
    buffer: Buffer.from(eksportujProjekt({ ...projekt, pakiet: PAKIET_WLASNY }, zasoby)),
  };
}

export async function otworzProjekt(page: Page) {
  await page.goto('./#/');
  await page.getByTestId('plik-importu').setInputFiles(await plikProjektu());
  await page.getByRole('link', { name: 'Mieszane' }).first().click();
  await expect(page.locator('[data-karta]')).toHaveCount(10, { timeout: 15000 });
}

/** Lewy górny róg i wymiar każdej karty na pierwszej stronie w mm od rogu strony. */
export async function polozenia(page: Page) {
  const strona = (await page.locator('.strona-kartki').first().boundingBox())!;
  const mm = (v: number, os: 'x' | 'y') =>
    (v / (os === 'x' ? strona.width : strona.height)) * (os === 'x' ? 210 : 297);
  const wynik: Record<string, number[]> = {};
  for (const el of await page.locator('.strona-kartki').first().locator('[data-karta]').all()) {
    const b = (await el.boundingBox())!;
    wynik[(await el.getAttribute('data-karta'))!] = [
      mm(b.x - strona.x, 'x'),
      mm(b.y - strona.y, 'y'),
      mm(b.width, 'x'),
      mm(b.height, 'y'),
    ];
  }
  return wynik;
}
export const bliskie = (a: number[], b: number[]) =>
  a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 0));
