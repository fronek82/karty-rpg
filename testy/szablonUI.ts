import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Kroki budowania szablonu wyłącznie przez interfejs edytora (kreator, drzewo, panel
 * właściwości) – do testów przykładów M2-5. Każdy krok to to, co zrobiłby użytkownik.
 */

/** Tekst jako dosłowny fragment wyrażenia regularnego. */
export const dokladnie = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const drzewo = (page: Page) => page.getByRole('tree', { name: 'Struktura karty' });
export const panel = (page: Page) => page.getByRole('complementary', { name: 'Właściwości' });

/** Kreator: nazwa, format (tekst kafelka), orientacja, rogi, kolor, układ startowy. */
export async function kreator(
  page: Page,
  o: {
    nazwa: string;
    format: string;
    pozioma?: boolean;
    rogi?: number;
    kolor?: string;
    uklad: string;
    /** Adres kreatora (domyślnie nowy projekt własnych kart; `#/projekt/<id>/nowy-szablon` – szablon w projekcie). */
    adres?: string;
  },
) {
  await page.goto(o.adres ?? './#/wlasne/nowy');
  await page.getByLabel('Nazwa szablonu').fill(o.nazwa);
  await page.locator('label.format', { hasText: o.format }).click();
  if (o.pozioma) await page.getByRole('button', { name: 'poziomo', exact: true }).click();
  if (o.rogi !== undefined) await page.getByLabel('Zaokrąglenie rogów (mm)').fill(String(o.rogi));
  if (o.kolor) await page.getByLabel('Kolor karty').fill(o.kolor);
  await page.locator('label.uklad', { hasText: o.uklad }).click();
  await page.getByRole('button', { name: /Dalej: układ pól/ }).click();
  await expect(drzewo(page)).toBeVisible({ timeout: 15000 });
}

/** Zaznacza element w drzewie po nazwie (początek etykiety „Nazwa – Typ”). */
export async function zaznacz(page: Page, nazwa: string, nr = 0) {
  const el = drzewo(page)
    .getByRole('treeitem', {
      name: new RegExp(`^${dokladnie(nazwa)} – `),
    })
    .nth(nr);
  await el.locator(':scope > .wezel-etykieta').click();
  await expect(el).toHaveAttribute('aria-selected', 'true');
}

/** „+ Dodaj” – element do zaznaczonego kontenera (albo za zaznaczonym polem). */
export async function dodaj(page: Page, rodzaj: string, nazwa?: string) {
  await page.getByRole('button', { name: '＋ Dodaj ▾' }).click();
  await page.getByRole('menuitem', { name: rodzaj, exact: true }).click();
  if (nazwa) await nazwij(page, nazwa);
}

export async function nazwij(page: Page, nazwa: string) {
  await panel(page).getByLabel('Nazwa', { exact: true }).fill(nazwa);
}

/** Otwiera zwijaną sekcję panelu (np. „Styl tekstu”) i ją zwraca. */
export async function sekcja(page: Page, tytul: string, nr = 0): Promise<Locator> {
  const s = panel(page)
    // Nagłówek sekcji bezpośrednio w niej (sekcja zawiera też nagłówki sekcji zagnieżdżonych).
    .locator('details.sekcja-panelu', { has: page.locator(`:scope > summary:text-is("${tytul}")`) })
    .nth(nr);
  // Otwiera kliknięciem w nagłówek – najpierw sekcje nadrzędne (np. „Etykieta” dla „Styl
  // etykiety”), potem samą sekcję.
  const zamkniete = s.locator('xpath=ancestor-or-self::details[not(@open)]');
  while ((await zamkniete.count()) > 0) {
    await zamkniete.first().locator(':scope > summary').click();
  }
  await expect(s).toHaveAttribute('open', '');
  return s;
}

const przycisk = (s: Locator, nazwa: string) => s.getByRole('button', { name: nazwa, exact: true });
const wlacz = async (s: Locator, nazwa: string, wartosc: boolean) => {
  const b = przycisk(s, nazwa);
  if ((await b.getAttribute('aria-pressed')) !== String(wartosc)) await b.click();
  await expect(b).toHaveAttribute('aria-pressed', String(wartosc));
};

/** Styl tekstu w podanej sekcji (styl pola, etykiety, nagłówków). */
export async function styl(
  s: Locator,
  o: {
    rozmiar?: number;
    kolor?: string;
    pogrubienie?: boolean;
    kursywa?: boolean;
    wielkie?: boolean;
    kapitaliki?: boolean;
    wyrownanie?: 'do lewej' | 'do środka' | 'do prawej' | 'wyjustuj';
    wciecie?: number;
    odstepAkapitow?: number;
    minRozmiar?: number;
  },
) {
  if (o.rozmiar !== undefined) await s.getByLabel('Rozmiar (pt)').fill(String(o.rozmiar));
  if (o.kolor) await s.getByLabel('Kolor tekstu').fill(o.kolor);
  if (o.pogrubienie !== undefined) await wlacz(s, 'B', o.pogrubienie);
  if (o.kursywa !== undefined) await wlacz(s, 'I', o.kursywa);
  if (o.wielkie !== undefined) await wlacz(s, 'WIELKIE', o.wielkie);
  if (o.kapitaliki !== undefined) await wlacz(s, 'Kapitaliki', o.kapitaliki);
  if (o.wyrownanie)
    await s.getByLabel('Wyrównanie', { exact: true }).selectOption({ label: o.wyrownanie });
  if (o.wciecie !== undefined) await s.getByLabel('Wcięcie akapitu (mm)').fill(String(o.wciecie));
  if (o.odstepAkapitow !== undefined)
    await s.getByLabel('Odstęp po akapicie (mm)').fill(String(o.odstepAkapitow));
  if (o.minRozmiar !== undefined) {
    await s.getByLabel('Zmniejszaj tekst, gdy się nie mieści').check();
    await s.getByLabel('Najmniejszy rozmiar (pt)').fill(String(o.minRozmiar));
  }
}

/** Szerokość albo wysokość zaznaczonego elementu. */
export async function rozmiar(
  page: Page,
  os: 'Szerokość' | 'Wysokość',
  tryb: 'domyślnie' | 'wg treści' | 'wypełnij' | 'mm',
  liczba?: number,
) {
  const s = panel(page)
    .locator('details.sekcja-panelu', {
      has: page.locator(':scope > summary', { hasText: /^(Położenie i rozmiar|Rozmiar)$/ }),
    })
    .first();
  if ((await s.getAttribute('open')) === null) await s.locator(':scope > summary').click();
  const p = s.locator('.pole-rozmiaru', { has: page.locator(`label:text-is("${os}")`) });
  await p.locator('select').selectOption({ label: tryb });
  if (liczba !== undefined) await p.locator('input[type=number]').fill(String(liczba));
}

/** Wygląd: tło, ramka z linii, zaokrąglenie. */
export async function wyglad(
  page: Page,
  o: { tlo?: string | null; ramka?: { grubosc: number; kolor: string }; promien?: number },
) {
  const s = await sekcja(page, 'Wygląd (tło, ramka, rogi)');
  if (o.tlo === null) await s.getByLabel('Włącz: Tło').uncheck();
  else if (o.tlo) {
    await s.getByLabel('Włącz: Tło').check();
    await s.getByLabel('Tło', { exact: true }).fill(o.tlo);
  }
  if (o.ramka) {
    await s.getByLabel('Ramka z linii', { exact: true }).selectOption('linia');
    await s.getByLabel('Grubość linii (mm)').fill(String(o.ramka.grubosc));
    await s.getByLabel('Kolor linii').fill(o.ramka.kolor);
  }
  if (o.promien !== undefined)
    await s.getByLabel('Zaokrąglenie rogów (mm)').fill(String(o.promien));
}

/** Odstępy zaznaczonego elementu (padding / margines – wszystkie strony). */
export async function odstepy(page: Page, o: { padding?: number; margines?: number }) {
  const s = await sekcja(page, 'Odstępy');
  if (o.padding !== undefined)
    await s
      .locator('fieldset.odstepy', {
        has: page.locator('legend:text-is("Margines wewnętrzny (mm)")'),
      })
      .getByLabel('Wszystkie strony')
      .fill(String(o.padding));
  if (o.margines !== undefined)
    await s
      .locator('fieldset.odstepy', {
        has: page.locator('legend:text-is("Margines zewnętrzny (mm)")'),
      })
      .getByLabel('Wszystkie strony')
      .fill(String(o.margines));
}

/** Etykieta zaznaczonego pola: włączona, położenie, styl. */
export async function etykieta(
  page: Page,
  o: {
    tekst?: string;
    pozycja?: 'nad' | 'przed (w linii)' | 'pod';
    styl?: Parameters<typeof styl>[1];
  },
) {
  const s = await sekcja(page, 'Etykieta');
  await s.getByLabel('Pokaż etykietę').check();
  if (o.tekst !== undefined) await s.getByLabel('Tekst etykiety').fill(o.tekst);
  if (o.pozycja)
    await s.getByLabel('Położenie etykiety', { exact: true }).selectOption({ label: o.pozycja });
  if (o.styl) await styl(await sekcja(page, 'Styl etykiety'), o.styl);
}

/** Zaznacza korzeń „Karta”: panel ustawień karty, a „+ Dodaj” dokłada na koniec karty. */
export async function karta(page: Page) {
  await zaznacz(page, 'Karta');
  await expect(panel(page).getByRole('heading', { name: 'Karta', exact: true })).toBeVisible();
}

/** Kartka: karta z menu w slocie, pola z panelu karty. */
export async function kartaNaKartce(page: Page, szablon: string, dane: Record<string, string>) {
  await page.getByRole('button', { name: 'Rób karty ►' }).click();
  await page.getByRole('button', { name: /^Pusty slot – strona 1, kolumna 1, rząd 1/ }).click();
  await page.getByRole('menuitem', { name: new RegExp(dokladnie(szablon)) }).click();
  const p = page.getByRole('complementary', { name: 'Zaznaczone karty' });
  for (const [pole, wartosc] of Object.entries(dane))
    await p.getByLabel(pole, { exact: true }).fill(wartosc);
  return p;
}
