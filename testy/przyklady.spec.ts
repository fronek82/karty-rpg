import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { zapisano } from './pomoc';
import { kartkaCzaru } from './kartkaUI';
import { SZABLONY, TALIA, arkuszMieszany, bliskie, otworzProjekt, polozenia } from './mieszaneUI';
import {
  PODKLAD,
  WZORZEC,
  oczekuj,
  polozenie,
  prostokatMm,
  przesun,
  swobodny,
  uchwyt,
  wTolerancji,
} from './swobodnyUI';
import { zbudujArkusz, stronaTestowa } from '../src/druk/arkusz';
import { importujProjekt } from '../src/dane/archiwum';
import { renderujKarte } from '../src/silnik/karta';
import type { Scena } from '../src/silnik/scena';
import { rejestrTestowy } from '../src/silnik/__testy__/pomoc';
import {
  daneCzaru,
  daneStatystyk,
  daneWroga,
  szablonCzaru,
  szablonOzdobny,
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
 * Kryteria M2 i M2b: sześć przykładów zbudowanych od zera WYŁĄCZNIE przez interfejs, z ogólnych
 * klocków edytora (A – karta czaru, B – blok statystyk, C – karta wroga; D – ozdobna karta,
 * E – kartka z mieszanymi rozmiarami i własny układ z luzem w slocie, F – karta swobodna myszą).
 * Dla każdego: karta (strona) na kartce, wzorzec wizualny PNG i porównanie z wynikiem silnika
 * w Node (`src/silnik/__testy__/przyklady.ts`, `testy/swobodnyUI.ts`, algorytm pasów i arkusza):
 * bez ostrzeżeń, ten sam rozmiar, tekst (glify, czcionki, rozmiary, kolory) i położenia –
 * z tolerancją 0,2 mm, a dla F (siatka 0,5 mm) 0,05 mm.
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

/** Eksport projektu z interfejsu → projekt odczytany w Node. */
async function eksportZInterfejsu(page: Page) {
  const [plik] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /^⤓ Eksportuj$/ }).click(),
  ]);
  return importujProjekt(new Uint8Array(readFileSync(await plik.path())));
}

/** Eksport projektu z interfejsu → karta i szablon odczytane w Node → render silnikiem. */
async function porownajZWzorcem(
  page: Page,
  wzorzec: Szablon,
  daneWzorca: Record<string, string>,
  /** Pola zwijane (nazwa w edytorze → klucz we wzorcu): puste znikają razem z etykietą. */
  zwijane: Record<string, string> = {},
) {
  const { projekt } = await eksportZInterfejsu(page);
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

/**
 * D: karta z interfejsu kontra szablon wzorcowy silnika (`szablonOzdobny`): bez ostrzeżeń, ten
 * sam rozmiar i te same rysunki ozdobne – ten sam zestaw symboli (ramka z pnącza, narożniki,
 * zakończenia i środek separatora, kształt z własnego SVG) w tych samych miejscach (0,2 mm).
 */
async function porownajOzdobna(page: Page) {
  const { projekt } = await eksportZInterfejsu(page);
  const k = projekt.talie.flatMap((t) => t.karty)[0]!;
  const s = projekt.szablony.find((x) => x.id === k.szablonId)!;
  const ctx = {
    czcionki: rejestrTestowy().przypiszRole('tytul', 'EB Garamond'),
    elementy: projekt.biblioteka?.ozdobniki,
  };
  const zUI = renderujKarte(s, k, ctx);
  const wzor = renderujKarte(
    szablonOzdobny,
    {
      dane: { tytul: k.dane.tytul!, opis: k.dane.opis!, sila: k.dane.wartosc_w_ksztalcie! },
    },
    ctx,
  );
  expect(zUI.ostrzezenia).toEqual([]);
  expect(wzor.ostrzezenia).toEqual([]);
  expect([zUI.scena.szer, zUI.scena.wys]).toEqual([wzor.scena.szer, wzor.scena.wys]);
  expect(tekstSceny(zUI.scena)).toEqual(tekstSceny(wzor.scena));
  const symbole = (sc: Scena) =>
    sc.elementy
      .flatMap((e) =>
        e.typ === 'symbol' ? [{ klucz: e.klucz, e: e.macierz[4], f: e.macierz[5] }] : [],
      )
      .sort((a, b) => a.klucz.localeCompare(b.klucz) || a.e - b.e || a.f - b.f);
  const a = symbole(zUI.scena);
  const b = symbole(wzor.scena);
  expect(a.map((x) => x.klucz)).toEqual(b.map((x) => x.klucz));
  // Pnącze, liść (narożniki), grot i romb (separator) – jak w XObjectach PDF poniżej.
  expect(new Set(a.map((x) => x.klucz)).size).toBe(4);
  const odchylenie = Math.max(
    ...a.map((x, i) => Math.max(Math.abs(x.e - b[i]!.e), Math.abs(x.f - b[i]!.f))),
  );
  expect(odchylenie).toBeLessThan(0.2);
}

test('D. ozdobna karta: motyw z narożnikami, separator ozdobny, podwójna linia, własny kształt, ramka 9-slice z PNG, PDF', async ({
  page,
}) => {
  // Karta 63×88 w kolorze pergaminu, tytuł i opis.
  await kreator(page, {
    nazwa: 'Ozdobna',
    format: 'Standard / Poker',
    rogi: 3,
    kolor: '#f3e6c8',
    uklad: 'Tytuł i opis',
  });
  const podglad = page.locator('.karta-podgladu svg');

  // Ramka karty z motywu (pnącze) z narożnikami.
  await karta(page);
  const r = await sekcja(page, 'Ramka karty');
  const rodzaj = r.getByRole('group', { name: 'Ramka karty', exact: true });
  await rodzaj.getByRole('button', { name: 'motyw' }).click();
  await r
    .getByRole('group', { name: 'Motyw', exact: true })
    .getByRole('button', { name: 'pnącze' })
    .click();
  await r.getByLabel('Szerokość pasa (mm)').fill('5');
  await r.getByLabel('Kolor motywu').fill('#5b3a1e');
  await r.getByRole('group', { name: 'Narożniki' }).getByRole('button', { name: 'liść' }).click();
  await expect(podglad.locator('use[color="#5b3a1e"]').first()).toBeVisible();

  // Separator z zakończeniami i środkiem pod tytułem.
  await karta(page);
  await dodaj(page, 'Separator z zakończeniami', 'Dekor');
  await drzewo(page)
    .getByRole('treeitem', { name: /^Dekor – / })
    .click();
  await page
    .getByRole('complementary', { name: 'Struktura karty' })
    .getByRole('button', { name: '↑ Wyżej' })
    .click();
  const kolejnosc = drzewo(page).locator('[role=treeitem]');
  await expect(kolejnosc.nth(1)).toHaveAccessibleName(/^Tytuł – /);
  await expect(kolejnosc.nth(2)).toHaveAccessibleName(/^Dekor – /);
  await panel(page).getByLabel('Kolor linii').fill('#5b3a1e');

  // Panel z podwójną linią (pole opisu).
  await zaznacz(page, 'Opis');
  const w = await sekcja(page, 'Wygląd (tło, ramka, rogi)');
  await w
    .getByRole('group', { name: 'Ramka z linii', exact: true })
    .getByRole('button', { name: 'linia', exact: true })
    .click();
  await w
    .getByRole('group', { name: 'Styl linii' })
    .getByRole('button', { name: 'podwójna' })
    .click();
  await w.getByLabel('Kolor linii').fill('#5b3a1e');

  // Biblioteka: własny SVG (kształt wartości) i ramka 9-slice z PNG – wgrane przez interfejs.
  await page.getByRole('link', { name: 'Biblioteka ozdobników', exact: true }).click();
  await page.getByTestId('plik-svg').setInputFiles('testy/zasoby/gwiazdka.svg');
  await page
    .getByRole('group', { name: 'Użyj jako' })
    .getByRole('button', { name: 'kształt wartości' })
    .click();
  await page.getByLabel('Nazwa', { exact: true }).fill('Gwiazdka');
  await page.getByRole('button', { name: 'Dodaj do biblioteki' }).click();
  await page.getByTestId('plik-png').setInputFiles('testy/zasoby/ramka-testowa.png');
  const edytor = page.getByTestId('edytor-ramki9');
  await expect(edytor).toContainText('120×120 px');
  for (const s of ['Góra', 'Prawo', 'Dół', 'Lewo'])
    await edytor.getByLabel(s, { exact: true }).fill('30');
  await expect(edytor.getByTestId('dpi-ramki')).toContainText('305 dpi');
  await page.goBack();
  await expect(drzewo(page)).toBeVisible({ timeout: 15000 });

  // Wartość w kształcie z własnego SVG.
  await karta(page);
  await dodaj(page, 'Wartość w kształcie', 'Siła');
  await panel(page).getByLabel('Kształt').selectOption('wlasny');
  await expect(
    panel(page).getByTestId('wybor-ksztaltu').getByRole('button', { name: 'Gwiazdka' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await rozmiar(page, 'Szerokość', 'mm', 16);
  await styl(await sekcja(page, 'Styl tekstu'), { rozmiar: 9, pogrubienie: true });
  await wyglad(page, { tlo: '#fff8e6' });
  await expect(podglad.locator('path[fill="#fff8e6"]')).toHaveCount(1);

  // Karta 1 na kartce.
  await kartaNaKartce(page, 'Ozdobna', { Tytuł: 'Smocza łuska', Opis: 'Ozdobna karta', Siła: '7' });
  await zapisano(page);

  await wzorzecKarty(page, 'przyklad-ozdobna.png');
  await porownajOzdobna(page);

  // Druga karta: szablon w tym samym projekcie z ramką 9-slice z PNG.
  const idProjektu = /#\/projekt\/([^/]+)/.exec(page.url())![1]!;
  await kreator(page, {
    nazwa: 'Ozdobna PNG',
    format: 'Standard / Poker',
    rogi: 0,
    kolor: '#f3e6c8',
    uklad: 'Tytuł i opis',
    adres: `./#/projekt/${idProjektu}/nowy-szablon`,
  });
  await karta(page);
  const r2 = await sekcja(page, 'Ramka karty');
  const rodzaj2 = r2.getByRole('group', { name: 'Ramka karty', exact: true });
  await rodzaj2.getByRole('button', { name: /z obrazu/ }).click();
  await r2.getByLabel('Grubość ramki (mm)').fill('2.5');
  const ramkaPng = page.locator('.karta-podgladu svg image');
  await expect(ramkaPng.first()).toBeVisible();
  await expect(r2.getByRole('group', { name: 'Ramka 9-slice z biblioteki' })).toBeVisible();
  await page.getByRole('button', { name: 'Rób karty ►' }).click();
  await page.getByRole('button', { name: /^Pusty slot – strona 1, kolumna 2, rząd 1/ }).click();
  await page.getByRole('menuitem', { name: /Ozdobna PNG/ }).click();
  const dane = page.getByRole('complementary', { name: 'Zaznaczone karty' });
  await dane.getByLabel('Tytuł', { exact: true }).fill('Ramka z obrazu');
  await zapisano(page);
  await expect(page.locator('[data-karta]')).toHaveCount(2);
  // Treść drugiej karty nie jest zakryta środkiem ramki: w obrysie karty są glify tytułu (pola) i
  // obrazy ramki, a pierwszy obraz (środek) leży w kolejności rysowania PRZED pierwszym glifem.
  const uklad = await page.evaluate(() => {
    const r = document.querySelectorAll('[data-karta]')[1]!.getBoundingClientRect();
    const w = (e: Element) => {
      const b = e.getBoundingClientRect();
      const x = b.x + b.width / 2;
      const y = b.y + b.height / 2;
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    const wszystkie = [...document.querySelectorAll('.strona-kartki svg *')];
    const glify = wszystkie.filter((e) => e.matches('use:not([color])') && w(e));
    const obrazy = wszystkie.filter((e) => e.matches('image') && w(e));
    const przed = (a: Element, b: Element) =>
      !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    return {
      glify: glify.length,
      obrazy: obrazy.length,
      srodekPrzedTekstem: glify[0] && obrazy[0] ? przed(obrazy[0], glify[0]) : false,
    };
  });
  expect(uklad.glify).toBeGreaterThan(5);
  expect(uklad.obrazy).toBeGreaterThan(8);
  expect(uklad.srodekPrzedTekstem).toBe(true);
  await page.locator(':focus').blur();
  await page.keyboard.press('Escape');
  await expect(page.locator('.ostrzezenia-projektu')).toHaveCount(0);
  await expect(page.locator('.ostrzezenia-karty')).toHaveCount(0);
  if (process.env.ZRZUTY) {
    await page.mouse.move(5, 5);
    await page.screenshot({ path: 'docs/obrazy/m2b-7-przyklad-d.png' });
  }

  // PDF bez ostrzeżeń: symbole motywu zapisane raz (XObject), PNG ramki raz.
  const [pobranie] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Pobierz PDF/ }).click(),
  ]);
  const pdf = await PDFDocument.load(readFileSync(await pobranie.path()));
  expect(pdf.getPageCount()).toBe(1);
  const symbole = new Set<string>();
  const obrazy = new Set<string>();
  for (const strona of pdf.getPages()) {
    const xo = strona.node.Resources()?.lookup(PDFName.of('XObject'), PDFDict);
    for (const [nazwa, ref] of xo?.entries() ?? []) {
      if (nazwa.toString().startsWith('/S')) symbole.add(String(ref));
      if (nazwa.toString().startsWith('/Im')) obrazy.add(String(ref));
    }
  }
  // Pnącze (kafelek), liść (narożnik), grot i romb (separator): po jednym XObjectcie.
  expect(symbole.size).toBe(4);
  expect(obrazy.size).toBe(1);
  await expect(page.locator('.ostrzezenia-projektu')).toHaveCount(0);
});

test('E(1): A4 z 2× 70×120, 3× 63×88, 5× 44×68 na jednej stronie – pasy, wzorzec strony i PDF', async ({
  page,
}) => {
  // Cała strona w widoku (bez przewijania pod pasek górny) – stabilny wzorzec.
  await page.setViewportSize({ width: 1440, height: 1800 });
  await otworzProjekt(page);
  await expect(page.locator('.strona-kartki')).toHaveCount(1);
  await expect(page.locator('.ostrzezenia-projektu')).toHaveCount(0);
  await expect(page.locator('.etykieta-strony')).toContainText('Strona 1 z 1 · 10 kart');

  // Położenia zgodne z algorytmem pasów (marginesy 10 mm, pasy 120 / 88 / 68 mm).
  const p = await polozenia(page);
  bliskie(p['arkana-1']!, [10, 10, 70, 120]);
  bliskie(p['arkana-2']!, [80, 10, 70, 120]);
  bliskie(p['przedmiot-1']!, [150, 10, 44, 68]);
  bliskie(p['czar-1']!, [10, 130, 63, 88]);
  bliskie(p['czar-3']!, [136, 130, 63, 88]);
  bliskie(p['przedmiot-2']!, [10, 218, 44, 68]);
  bliskie(p['przedmiot-5']!, [142, 218, 44, 68]);

  // Zgodność z silnikiem: te same położenia i rozmiary, które liczy algorytm pasów w Node.
  const wynik = zbudujArkusz(arkuszMieszany(), TALIA, {
    czcionki: rejestrTestowy(),
    szablony: new Map(SZABLONY.map((x) => [x.id, x])),
  });
  expect(wynik.ostrzezenia).toEqual([]);
  expect(wynik.mieszane!.karty).toHaveLength(10);
  for (const u of wynik.mieszane!.karty) bliskie(p[u.kartaId]!, [u.x, u.y, u.szer, u.wys]);

  // Wzorzec wizualny strony (z wolnymi miejscami jak w edytorze).
  await page.mouse.move(5, 5);
  await expect(page.locator('.strona-kartki').first()).toHaveScreenshot(
    'przyklad-e1-mieszane-strona.png',
    {
      maxDiffPixelRatio: 0.002,
    },
  );
  await zapisano(page);

  // PDF: jedna strona A4.
  const [pobranie] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Pobierz PDF/ }).click(),
  ]);
  const pdf = await PDFDocument.load(readFileSync(await pobranie.path()));
  expect(pdf.getPageCount()).toBe(1);
  const { width, height } = pdf.getPage(0).getSize();
  expect(width).toBeCloseTo(595.28, 0);
  expect(height).toBeCloseTo(841.89, 0);
});

test('E(2). własny układ 3×3: slot 63,5×89, karty 63×88, luz 1,5 mm, tło do slotu, wydruk testowy', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1800 });
  await kartkaCzaru(page);
  // Cała siatka 3×3: karta i osiem kopii.
  await page.locator('[data-karta]').first().click();
  const dane = page.getByRole('complementary', { name: 'Zaznaczone karty' });
  await dane.getByLabel('Liczba kopii').fill('8');
  await dane
    .getByRole('button', { name: /^Duplikuj/ })
    .last()
    .click();
  await expect(page.locator('[data-karta]')).toHaveCount(9);
  await page.getByRole('button', { name: /Ustawienia/ }).click();
  const ust = page.getByRole('complementary', { name: 'Ustawienia' });

  await ust
    .getByRole('group', { name: 'Układ kart na kartce' })
    .getByRole('button', { name: 'własny układ arkusza' })
    .click();
  await ust.getByLabel('Szerokość karty (mm)').fill('63.5');
  await ust.getByLabel('Wysokość karty (mm)').fill('89');
  const luz = ust.getByRole('group', { name: 'Karta w slocie' });
  await luz.getByLabel('Luz (mm)').fill('1.5');
  await luz.getByLabel('Tło do krawędzi slotu').check();
  await expect(page.locator('.ostrzezenia-projektu')).toHaveCount(0);
  await expect(page.locator('.strona-kartki')).toHaveCount(1);
  await expect(page.locator('[data-karta]')).toHaveCount(9);
  await page.locator(':focus').blur();
  await page.mouse.move(5, 5);
  await expect(page.locator('.strona-kartki').first()).toHaveScreenshot(
    'przyklad-e2-luz-strona.png',
    { maxDiffPixelRatio: 0.002 },
  );

  // Zgodność z silnikiem: sloty 63,5×89, karty na środku (+0,25 / +0,5 mm), tło do krawędzi slotu.
  const { projekt } = await eksportZInterfejsu(page);
  const arkusz = projekt.arkusze[0]!;
  const talia = projekt.talie[0]!;
  const w = zbudujArkusz(arkusz, talia, {
    czcionki: rejestrTestowy().przypiszRole('tytul', 'EB Garamond'),
    szablony: new Map(projekt.szablony.map((x) => [x.id, x])),
  });
  expect(w.ostrzezenia).toEqual([]);
  expect(w.slot).toEqual({ szerokosc: 63.5, wysokosc: 89 });
  expect(w.strony).toHaveLength(1);
  expect(arkusz.ustawienia.dopasowanie).toMatchObject({ luz: 1.5, tloDoSlotu: true });
  const tla = w.strony[0]!.elementy.filter(
    (e) => e.typ === 'prostokat' && e.szer === 63.5 && e.wys === 89,
  );
  expect(tla).toHaveLength(9);

  // Wydruk testowy: PDF z jedną stroną z obrysami slotów 63,5×89 – to samo wylicza silnik.
  const test = stronaTestowa(arkusz, talia, {
    czcionki: rejestrTestowy(),
    szablony: new Map(projekt.szablony.map((x) => [x.id, x])),
  });
  const obrysy = test.elementy.filter(
    (e) => e.typ === 'prostokat' && e.szer === 63.5 && e.wys === 89,
  );
  expect(obrysy).toHaveLength(9);
  const [pobranie] = await Promise.all([
    page.waitForEvent('download'),
    ust.getByRole('button', { name: 'Wydruk testowy (PDF)' }).click(),
  ]);
  expect(pobranie.suggestedFilename()).toMatch(/wydruk-testowy.*\.pdf$/);
  const pdf = await PDFDocument.load(readFileSync(await pobranie.path()));
  expect(pdf.getPageCount()).toBe(1);
});

test('F. karta swobodna: ilustracja, tytuł na pasku, koło w rogu, napis obrócony, kolumna – myszą, klawiaturą i z podkładem', async ({
  page,
}) => {
  await swobodny(page, 'Karta swobodna F');
  // Podkład ze wzoru (obraz testowy generowany deterministycznie): pół na pół, nie łapie kliknięć.
  await page.getByTestId('plik-podkladu').setInputFiles(PODKLAD);
  const podklad = page.getByTestId('podklad-podgladu');
  await expect(podklad).toBeVisible();
  await expect(podklad).toHaveCSS('opacity', '0.5');
  await expect(podklad).toHaveCSS('pointer-events', 'none');

  // Ilustracja w tle: przeciągnięta do rogu karty (przyciąganie do krawędzi), uchwyt – na całą szerokość.
  await dodaj(page, 'Obraz', 'Ilustracja');
  await przesun(page, 'Ilustracja', -3, -3);
  await oczekuj(page, 'Ilustracja', [0, 0, 30, 30]);
  await uchwyt(page, 'se', 33, 16);
  await oczekuj(page, 'Ilustracja', [0, 0, 63, 46]);

  // Tytuł na pasku nałożonym na ilustrację: przeciągnięcie, strzałki w podglądzie, uchwyty.
  await dodaj(page, 'Tekst', 'Tytuł');
  await wyglad(page, { tlo: '#2c3e50' });
  await styl(await sekcja(page, 'Styl tekstu'), {
    rozmiar: 12,
    kolor: '#ffffff',
    pogrubienie: true,
  });
  await przesun(page, 'Tytuł', 3, 30);
  let t = await prostokatMm(page, 'Tytuł');
  wTolerancji(t.x, 6);
  wTolerancji(t.y, 33);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  t = await prostokatMm(page, 'Tytuł');
  wTolerancji(t.y, 34);
  await uchwyt(page, 'e', 21, 0);
  const h0 = (await prostokatMm(page, 'Tytuł')).wys;
  await uchwyt(page, 's', 0, 12 - h0);
  await oczekuj(page, 'Tytuł', [6, 34, 51, 12]);

  // Wartość w kole w rogu: uchwyt rogu zmniejsza pole do 12 × 12 mm.
  await dodaj(page, 'Wartość w kształcie', 'Koszt');
  await panel(page).getByLabel('Kształt').selectOption('kolo');
  await styl(await sekcja(page, 'Styl tekstu'), { rozmiar: 8 });
  // Wysokość nowej wartości jest wg treści (zależy od czcionki) – cel (15, 15) liczymy z pomiaru.
  const k0 = await prostokatMm(page, 'Koszt');
  await uchwyt(page, 'se', -18, 15 - (k0.y + k0.wys));
  await oczekuj(page, 'Koszt', [3, 3, 12, 12]);

  // Napis obrócony o 90° przy prawej krawędzi: obrót z panelu, położenie i rozmiar myszą.
  await dodaj(page, 'Tekst', 'Typ');
  await polozenie(page).getByRole('button', { name: '90°', exact: true }).click();
  await styl(await sekcja(page, 'Styl tekstu'), { rozmiar: 6 });
  await przesun(page, 'Typ', 54, 5);
  await uchwyt(page, 's', 0, 10);
  const w0 = await prostokatMm(page, 'Typ');
  await uchwyt(page, 'e', 3 - w0.szer, 0);
  await oczekuj(page, 'Typ', [57, 8, 3, 40]);
  await expect(page.locator('.karta-podgladu svg g[transform*="rotate(90)"]')).toHaveCount(1);

  // Kolumna z opisem w środku: przeciągnięcie i uchwyt, potem pole w kolumnie.
  // Przyciąganie do krawędzi wyłączone (prawy brzeg 59 leży blisko środka napisu) – zostaje siatka 0,5 mm.
  await page.getByLabel('Do krawędzi i środków innych pól i karty').uncheck();
  await karta(page);
  await dodaj(page, 'Kolumna', 'Opis');
  await przesun(page, 'Opis', 1, 47);
  await uchwyt(page, 'se', 25, 0);
  await oczekuj(page, 'Opis', [4, 50, 55, 30]);
  await dodaj(page, 'Tekst', 'Zdolność');

  // Porównanie ze wzorcem liczonym przez silnik (tolerancja 0,05 mm).
  const wzorzec = renderujKarte(WZORZEC, { dane: {} }, { czcionki: rejestrTestowy() }).wezly;
  for (const nazwa of ['Ilustracja', 'Tytuł', 'Koszt', 'Typ', 'Opis']) {
    const id = (WZORZEC.korzen.dzieci as { id: string; nazwa: string }[]).find(
      (d) => d.nazwa === nazwa,
    )!.id;
    const w = wzorzec.find((x) => x.id === id)!;
    await oczekuj(page, nazwa, [w.x, w.y, w.szer, w.wys]);
  }
  await expect(page.locator('.ostrzezenia-karty')).toHaveCount(0);

  if (process.env.ZRZUTY) {
    await zaznacz(page, 'Koszt');
    await page.screenshot({ path: 'docs/obrazy/m2b-9-podklad.png' });
  }

  // Karta na kartce (bez podkładu i uchwytów) – wzorzec wizualny.
  await kartaNaKartce(page, 'Karta swobodna F', {
    Tytuł: 'Ognisty smok',
    Koszt: '3',
    Typ: 'Stwór',
    Zdolność: 'Zionie ogniem na wszystko przed sobą.',
  });
  await wzorzecKarty(page, 'przyklad-swobodna.png');
});
