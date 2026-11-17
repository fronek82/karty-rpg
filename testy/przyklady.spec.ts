import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { importujProjekt } from '../src/dane/archiwum';
import { renderujKarte } from '../src/silnik/karta';
import type { Scena } from '../src/silnik/scena';
import { rejestrTestowy } from '../src/silnik/__testy__/pomoc';
import {
  daneCzaru,
  daneStatystyk,
  daneWroga,
  szablonCzaru,
  szablonStatystyk,
  szablonWroga,
} from '../src/silnik/__testy__/przyklady';
import type { Szablon, Wezel } from '../src/model/szablon';
import {
  dodaj,
  drzewo,
  etykieta,
  karta,
  kartaNaKartce,
  kreator,
  nazwij,
  odstepy,
  panel,
  rozmiar,
  sekcja,
  styl,
  wyglad,
  zaznacz,
} from './szablonUI';

/**
 * Kryterium M2: trzy przykłady (karta czaru, blok statystyk, karta wroga) zbudowane od zera
 * WYŁĄCZNIE przez interfejs, z ogólnych klocków edytora. Dla każdego: karta na kartce, wzorzec
 * wizualny karty i porównanie z szablonem wzorcowym (`src/silnik/__testy__/przyklady.ts`) –
 * ten sam tekst (glify, czcionki, rozmiary, kolory i położenie) i żadnych ostrzeżeń.
 */

test.use({ viewport: { width: 1440, height: 1100 } });
test.setTimeout(180_000);

/**
 * Tekst sceny w kolejności rysowania: kolor, a dla każdego glifu klucz (czcionka, wariant,
 * glif – więc też kapitaliki i wersaliki) i skala (rozmiar). Położenia glifów w poziomie
 * porównuje `poziomo` z tolerancją 0,2 mm; odstępy w pionie mogą się różnić od wzorca
 * o ułamki mm (domyślne odstępy klocków) – układ pionowy sprawdza wzorzec wizualny.
 */
const tekstSceny = (s: Scena) =>
  s.elementy.flatMap((e) =>
    e.typ === 'tekst'
      ? [`${e.kolor}|${e.glify.map((g) => `${g.klucz}@${g.skala.toPrecision(4)}`).join(' ')}`]
      : [],
  );
const poziomo = (s: Scena) =>
  s.elementy.flatMap((e) => (e.typ === 'tekst' ? e.glify.map((g) => g.x) : []));

/** Eksport projektu z interfejsu → karta i szablon odczytane w Node → render silnikiem. */
async function porownajZWzorcem(
  page: Page,
  wzorzec: Szablon,
  daneWzorca: Record<string, string>,
  /** Pola zwijane (nazwa w edytorze → klucz we wzorcu): puste znikają razem z etykietą. */
  zwijane: Record<string, string> = {},
) {
  const [plik] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Eksportuj/ }).click(),
  ]);
  const { projekt } = importujProjekt(new Uint8Array(readFileSync(await plik.path())));
  const k = projekt.talie.flatMap((t) => t.karty)[0]!;
  const s = projekt.szablony.find((x) => x.id === k.szablonId)!;
  const czcionki = rejestrTestowy().przypiszRole('tytul', 'EB Garamond');
  const zUI = renderujKarte(s, k, { czcionki });
  const wzor = renderujKarte(wzorzec, { dane: daneWzorca }, { czcionki });
  expect(zUI.ostrzezenia).toEqual([]);
  expect(wzor.ostrzezenia).toEqual([]);
  expect(tekstSceny(zUI.scena)).toEqual(tekstSceny(wzor.scena));
  const x0 = poziomo(wzor.scena);
  const odchylenie = Math.max(...poziomo(zUI.scena).map((x, i) => Math.abs(x - x0[i]!)));
  expect(odchylenie).toBeLessThan(0.2);
  expect(zUI.scena.szer).toBe(wzor.scena.szer);
  expect(zUI.scena.wys).toBe(wzor.scena.wys);
  if (Object.keys(zwijane).length) {
    // Klucz pola nadany w edytorze (zostaje z chwili utworzenia) – szukany po nazwie.
    const kluczUI = (nazwa: string, w: Wezel = s.korzen): string | undefined =>
      w.nazwa === nazwa && 'klucz' in w
        ? (w.klucz as string)
        : 'dzieci' in w
          ? w.dzieci.map((d) => kluczUI(nazwa, d)).find(Boolean)
          : undefined;
    const bez = (d: Record<string, string>, klucze: (string | undefined)[]) => ({
      ...d,
      ...Object.fromEntries(klucze.map((z) => [z!, ''])),
    });
    const kluczeUI = Object.keys(zwijane).map((n) => kluczUI(n));
    expect(kluczeUI.every((z) => z && k.dane[z])).toBe(true);
    const pustUI = renderujKarte(s, { ...k, dane: bez(k.dane, kluczeUI) }, { czcionki });
    const pustWzor = renderujKarte(
      wzorzec,
      { dane: bez(daneWzorca, Object.values(zwijane)) },
      { czcionki },
    );
    // Etykiety pustych pól znikają: mniej tekstów niż z danymi, tak samo jak we wzorcu.
    expect(tekstSceny(pustUI.scena).length).toBeLessThan(tekstSceny(zUI.scena).length);
    expect(tekstSceny(pustUI.scena)).toEqual(tekstSceny(pustWzor.scena));
  }
}

async function wzorzecKarty(page: Page, nazwa: string) {
  // Fokus z pola panelu (skróty kartki pomijają zdarzenia z pól), potem odznaczenie karty.
  await page.locator(':focus').blur();
  await page.keyboard.press('Escape');
  await expect(page.locator('.karta-na-kartce.zaznaczona')).toHaveCount(0);
  await expect(page.locator('.ostrzezenia-projektu')).toHaveCount(0);
  await expect(page.locator('[data-karta]')).toHaveScreenshot(nazwa, { maxDiffPixelRatio: 0.002 });
}

test('A. karta czaru: kolorowa karta, białe panele, siatka 2×2 etykieta/wartość, stopka', async ({
  page,
}) => {
  await kreator(page, {
    nazwa: 'Czar',
    format: 'Standard / Poker',
    rogi: 3,
    kolor: '#b8322a',
    uklad: 'Tytuł, siatka 2×2, opis i stopka',
  });
  await zaznacz(page, 'Tytuł');
  await nazwij(page, 'Nazwa');
  await styl(await sekcja(page, 'Styl tekstu'), { rozmiar: 13, kolor: '#ffffff' });

  // Cztery komórki naraz: styl wartości i etykiety (wiele zaznaczonych).
  await zaznacz(page, 'Pole 1');
  for (const n of [2, 3, 4])
    await drzewo(page)
      .getByRole('treeitem', { name: new RegExp(`^Pole ${n} – `) })
      .locator(':scope > .wezel-etykieta')
      .click({ modifiers: ['Shift'] });
  await expect(panel(page)).toContainText('Zmiany dotyczą wszystkich zaznaczonych');
  await expect(drzewo(page).locator('[aria-selected="true"]')).toHaveCount(4);
  await styl(await sekcja(page, 'Styl tekstu'), { rozmiar: 8, wyrownanie: 'do środka' });
  await styl(await sekcja(page, 'Styl etykiety'), {
    rozmiar: 5.5,
    pogrubienie: true,
    wielkie: true,
    kolor: '#b8322a',
  });
  for (const [stara, nowa] of [
    ['Pole 1', 'Czas rzucania'],
    ['Pole 2', 'Zasięg'],
    ['Pole 3', 'Komponenty'],
    ['Pole 4', 'Czas trwania'],
  ]) {
    await zaznacz(page, stara!);
    await nazwij(page, nowa!);
  }

  await zaznacz(page, 'Opis');
  await styl(await sekcja(page, 'Styl tekstu'), {
    rozmiar: 7.5,
    wyrownanie: 'wyjustuj',
    minRozmiar: 5,
    odstepAkapitow: 1,
  });
  await wyglad(page, { promien: 1.5 });
  await odstepy(page, { padding: 2 });

  await zaznacz(page, 'Stopka – lewa');
  await nazwij(page, 'Klasa');
  await zaznacz(page, 'Stopka – prawa');
  await nazwij(page, 'Szkoła');
  await drzewo(page)
    .getByRole('treeitem', { name: /^Klasa – / })
    .locator(':scope > .wezel-etykieta')
    .click({ modifiers: ['Shift'] });
  await expect(drzewo(page).locator('[aria-selected="true"]')).toHaveCount(2);
  await styl(await sekcja(page, 'Styl tekstu'), { rozmiar: 7, kursywa: true, kolor: '#ffffff' });

  // Ramka całej karty i odstępy karty.
  await karta(page);
  const r = await sekcja(page, 'Ramka karty');
  await r
    .getByRole('group', { name: 'Ramka karty', exact: true })
    .getByRole('button', { name: 'linia', exact: true })
    .click();
  await r.getByLabel('Grubość linii (mm)').fill('0.3');
  await r.getByLabel('Kolor linii').fill('#ffffff');
  await r.getByLabel('Odsunięcie od krawędzi (mm)').fill('1');
  await sekcja(page, 'Układ karty (odstępy, rozłożenie, wygląd)');
  await odstepy(page, { padding: 2.5 });

  await kartaNaKartce(page, 'Czar', {
    Nazwa: daneCzaru.nazwa,
    'Czas rzucania': daneCzaru.czas,
    Zasięg: daneCzaru.zasieg,
    Komponenty: daneCzaru.komponenty,
    'Czas trwania': daneCzaru.trwanie,
    Opis: daneCzaru.opis,
    Klasa: daneCzaru.klasa,
    Szkoła: daneCzaru.szkola,
  });
  await wzorzecKarty(page, 'przyklad-czar.png');
  await porownajZWzorcem(page, szablonCzaru, daneCzaru);
});

const CECHY = ['Sz', 'WW', 'US', 'S', 'Wt', 'I', 'Zw', 'Zr', 'Int', 'SW', 'Ogd', 'Żyw'];

test('B. blok statystyk: tytuł kapitalikami, tabela cech, separator, akapity wyjustowane', async ({
  page,
}) => {
  await kreator(page, {
    nazwa: 'Blok statystyk',
    format: 'Standard / Poker',
    pozioma: true,
    rogi: 0,
    kolor: '#f3ead2',
    uklad: 'Tytuł i opis',
  });
  await zaznacz(page, 'Tytuł');
  await nazwij(page, 'Nazwa');
  await styl(await sekcja(page, 'Styl tekstu'), { kapitaliki: true });

  // Tabela za tytułem: 12 kolumn z nagłówkami.
  await dodaj(page, 'Tabela', 'Cechy');
  await sekcja(
    page,
    `Kolumny (${await panel(page)
      .getByLabel(/^Nagłówek kolumny/)
      .count()})`,
  );
  for (let i = 3; i < CECHY.length; i++)
    await panel(page).getByRole('button', { name: '＋ Dodaj kolumnę' }).click();
  for (const [i, c] of CECHY.entries())
    await panel(page)
      .getByLabel(`Nagłówek kolumny ${i + 1}`, { exact: true })
      .fill(c);
  await styl(await sekcja(page, 'Styl tekstu'), { rozmiar: 7 });
  const w = await sekcja(page, 'Wiersze');
  await w.getByLabel('Włącz: Tło nagłówków').check();
  await w.getByLabel('Tło nagłówków', { exact: true }).fill('#e2d3ae');
  await w.getByLabel('Odstęp w komórce (mm)').fill('0.5');
  const linie = await sekcja(page, 'Linie siatki');
  await linie.getByLabel('Kolor linii').fill('#5a4630');

  await dodaj(page, 'Separator', 'Kreska');
  const sep = await sekcja(page, 'Separator');
  await sep.getByLabel('Kolor linii').fill('#5a4630');

  await zaznacz(page, 'Opis');
  await styl(await sekcja(page, 'Styl tekstu'), {
    rozmiar: 7,
    wyrownanie: 'wyjustuj',
    wciecie: 2,
    minRozmiar: 5,
  });
  // Bez białego panelu (układ startowy dodaje go na kolorowej karcie).
  await wyglad(page, { tlo: null });
  await odstepy(page, { padding: 0 });

  await karta(page);
  const r = await sekcja(page, 'Ramka karty');
  await r
    .getByRole('group', { name: 'Ramka karty', exact: true })
    .getByRole('button', { name: 'linia', exact: true })
    .click();
  await r.getByLabel('Grubość linii (mm)').fill('0.4');
  await r.getByLabel('Kolor linii').fill('#5a4630');
  await sekcja(page, 'Układ karty (odstępy, rozłożenie, wygląd)');
  await panel(page).getByLabel('Odstęp między elementami (mm)').fill('1');

  const dane: Record<string, string> = { Nazwa: daneStatystyk.nazwa!, Opis: daneStatystyk.opis! };
  for (const c of CECHY) dane[`Cechy – ${c}`] = daneStatystyk[`cecha_${c.toLowerCase()}`]!;
  await kartaNaKartce(page, 'Blok statystyk', dane);
  await wzorzecKarty(page, 'przyklad-blok-statystyk.png');
  await porownajZWzorcem(page, szablonStatystyk, daneStatystyk);
});

test('C. karta wroga: zagnieżdżony nagłówek, wartości w rombach z etykietą, pola zwijane', async ({
  page,
}) => {
  await kreator(page, {
    nazwa: 'Wróg',
    format: 'Standard / Poker',
    rogi: 0,
    kolor: '#fbf7ee',
    uklad: 'Pusta karta',
  });
  // Nagłówek: wiersz [kolumna (nazwa, cechy) + romb].
  await dodaj(page, 'Wiersz', 'Nagłówek');
  await dodaj(page, 'Kolumna', 'Tytuł');
  await rozmiar(page, 'Szerokość', 'wypełnij');
  await dodaj(page, 'Tekst', 'Nazwa');
  await styl(await sekcja(page, 'Styl tekstu'), { rozmiar: 11, pogrubienie: true, wielkie: true });
  await dodaj(page, 'Tekst', 'Cechy');
  await styl(await sekcja(page, 'Styl tekstu'), { rozmiar: 7, kursywa: true });

  // Statystyki: wiersz rombów z etykietą (pierwszy ustawiony, reszta – duplikaty).
  await karta(page);
  await dodaj(page, 'Wiersz', 'Statystyki');
  await panel(page)
    .getByRole('group', { name: 'Rozłożenie elementów' })
    .getByRole('button', { name: 'równo między' })
    .click();
  await dodaj(page, 'Wartość w kształcie', 'Wytrzymałość');
  await panel(page).getByLabel('Kształt').selectOption('romb');
  await rozmiar(page, 'Szerokość', 'mm', 11);
  await styl(await sekcja(page, 'Styl tekstu'), { rozmiar: 9, pogrubienie: true });
  await etykieta(page, {
    pozycja: 'nad',
    styl: { rozmiar: 4.5, pogrubienie: true, wielkie: true, kolor: '#9b1c1c', minRozmiar: 3.5 },
  });
  await wyglad(page, { ramka: { grubosc: 0.35, kolor: '#9b1c1c' } });
  const struktura = page.getByRole('complementary', { name: 'Struktura karty' });
  for (const nazwa of ['Siła', 'Zbroja', 'Nienawiść', 'Poziom']) {
    await struktura.getByRole('button', { name: 'Duplikuj', exact: true }).click();
    await nazwij(page, nazwa);
  }
  // Poziom do nagłówka: wyjmij z wiersza, wyżej, do kontenera powyżej (Nagłówek).
  await struktura.getByRole('button', { name: '← Wyjmij z kontenera' }).click();
  await struktura.getByRole('button', { name: '↑ Wyżej' }).click();
  await struktura.getByRole('button', { name: '→ Do kontenera powyżej' }).click();
  // Poziom jest ostatnim dzieckiem Nagłówka, za kolumną Tytuł.
  const wNaglowku = drzewo(page)
    .getByRole('treeitem', { name: /^Nagłówek – / })
    .locator(':scope > [role=group] > [role=treeitem]');
  await expect(wNaglowku).toHaveCount(2);
  await expect(wNaglowku.nth(0)).toHaveAccessibleName(/^Tytuł – /);
  await expect(wNaglowku.nth(1)).toHaveAccessibleName(/^Poziom – /);

  await karta(page);
  await dodaj(page, 'Separator', 'Kreska');
  const sep = await sekcja(page, 'Separator');
  await sep.getByLabel('Kolor linii').fill('#9b1c1c');
  for (const [nazwa, tekst] of [
    ['Broń', 'Broń:'],
    ['Zdolności', 'Zdolności:'],
  ]) {
    await karta(page);
    await dodaj(page, 'Tekst', nazwa);
    await styl(await sekcja(page, 'Styl tekstu'), { rozmiar: 7 });
    await etykieta(page, { tekst, pozycja: 'przed (w linii)', styl: { pogrubienie: true } });
    await panel(page)
      .getByRole('group', { name: 'Gdy puste' })
      .getByRole('button', { name: 'ukryj i zwiń' })
      .click();
  }
  await karta(page);
  await dodaj(page, 'Tekst', 'Opis');
  await styl(await sekcja(page, 'Styl tekstu'), { rozmiar: 7, kursywa: true });
  await panel(page)
    .getByRole('group', { name: 'Gdy puste' })
    .getByRole('button', { name: 'ukryj i zwiń' })
    .click();

  await kartaNaKartce(page, 'Wróg', {
    Nazwa: daneWroga.nazwa,
    Cechy: daneWroga.cechy,
    Poziom: daneWroga.poziom,
    Wytrzymałość: daneWroga.wytrzymalosc,
    Siła: daneWroga.sila,
    Zbroja: daneWroga.zbroja,
    Nienawiść: daneWroga.nienawisc,
    Broń: daneWroga.bron,
    Zdolności: daneWroga.zdolnosci,
  });
  await wzorzecKarty(page, 'przyklad-wrog.png');
  await porownajZWzorcem(page, szablonWroga, daneWroga, {
    Broń: 'bron',
    Zdolności: 'zdolnosci',
  });
});
