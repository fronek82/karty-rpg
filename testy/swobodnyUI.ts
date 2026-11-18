import { expect, type Page } from '@playwright/test';
import type { Szablon } from '../src/model/szablon';
import { przeciagnij, srodek } from './pomoc';
import { kreator, panel } from './szablonUI';

/** Wspólne kroki trybu swobodnego (M2b-9): testy myszą i przykład F. */

export const SZER = 63;
export const WYS = 88;
export const PODKLAD = 'testy/zasoby/podklad-testowy.png';
export const podglad = (page: Page) => page.locator('.karta-podgladu');
export const polozenie = (page: Page) => panel(page).getByRole('group', { name: 'Położenie' });
export const obszar = (page: Page, nazwa: string) =>
  podglad(page).getByRole('button', { name: nazwa, exact: true });
export const wTolerancji = (v: number, oczekiwane: number, tol = 0.05) =>
  expect(Math.abs(v - oczekiwane), `${v} ≈ ${oczekiwane}`).toBeLessThanOrEqual(tol);

/** Prostokąt elementu w mm (z położenia nakładki nad podglądem karty). */
export async function prostokatMm(page: Page, nazwa: string) {
  const k = (await podglad(page).boundingBox())!;
  const r = (await obszar(page, nazwa).boundingBox())!;
  const s = SZER / k.width;
  return { x: (r.x - k.x) * s, y: (r.y - k.y) * s, szer: r.width * s, wys: r.height * s };
}
export async function oczekuj(
  page: Page,
  nazwa: string,
  [x, y, szer, wys]: [number, number, number, number],
) {
  const r = await prostokatMm(page, nazwa);
  wTolerancji(r.x, x);
  wTolerancji(r.y, y);
  wTolerancji(r.szer, szer);
  wTolerancji(r.wys, wys);
}
/** Piksele ekranu na mm w bieżącym podglądzie. */
export const pxNaMm = async (page: Page) => (await podglad(page).boundingBox())!.width / SZER;

/** Przeciągnięcie elementu za jego środek o (dx, dy) mm. */
export async function przesun(page: Page, nazwa: string, dx: number, dy: number) {
  const s = await srodek(page, obszar(page, nazwa));
  const k = await pxNaMm(page);
  await przeciagnij(page, s, { x: s.x + dx * k, y: s.y + dy * k });
}
/** Przeciągnięcie uchwytu rozmiaru zaznaczonego pola o (dx, dy) mm. */
export async function uchwyt(page: Page, u: string, dx: number, dy: number) {
  const s = await srodek(page, podglad(page).locator(`[data-uchwyt="${u}"]`));
  const k = await pxNaMm(page);
  await przeciagnij(page, s, { x: s.x + dx * k, y: s.y + dy * k });
}
export const cofnij = (page: Page) =>
  page.getByRole('button', { name: 'Cofnij', exact: true }).click();

export async function swobodny(page: Page, nazwa: string) {
  await kreator(page, {
    nazwa,
    format: 'Standard / Poker',
    rogi: 3,
    kolor: '#f4ecd8',
    uklad: 'Swobodny: pola w dowolnych miejscach',
  });
}

/** Szablon wzorcowy przykładu F: te same położenia i rozmiary, liczone silnikiem. */
export const WZORZEC = {
  id: 'wzorzec',
  nazwa: 'Wzorzec F',
  rozmiar: { tryb: 'mm', szerokosc: SZER, wysokosc: WYS },
  korzen: {
    id: 'karta',
    typ: 'swobodny',
    dzieci: [
      {
        id: 'i',
        nazwa: 'Ilustracja',
        typ: 'obraz',
        pozycja: { x: 0, y: 0 },
        szerokosc: { mm: 63 },
        wysokosc: { mm: 46 },
      },
      {
        id: 't',
        nazwa: 'Tytuł',
        typ: 'tekst',
        pozycja: { x: 6, y: 34 },
        szerokosc: { mm: 51 },
        wysokosc: { mm: 12 },
      },
      {
        id: 'k',
        nazwa: 'Koszt',
        typ: 'wartosc',
        ksztalt: 'kolo',
        pozycja: { x: 3, y: 3 },
        szerokosc: { mm: 12 },
        wysokosc: { mm: 12 },
      },
      {
        id: 'n',
        nazwa: 'Typ',
        typ: 'tekst',
        pozycja: { x: 57, y: 8, obrot: 90 },
        szerokosc: { mm: 40 },
        wysokosc: { mm: 3 },
      },
      {
        id: 'o',
        nazwa: 'Opis',
        typ: 'kolumna',
        pozycja: { x: 4, y: 50 },
        szerokosc: { mm: 55 },
        wysokosc: { mm: 30 },
        dzieci: [],
      },
    ],
  },
} as unknown as Szablon;
