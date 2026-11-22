import { expect, test, type Locator, type Page } from '@playwright/test';
import { kontrastObrysu, kontrastTekstu } from './kontrastUI';
import { dodaj, kreator, nazwij, panel, sekcja, zaznacz } from './szablonUI';
import { otworzDruk, otworzUstawieniaAplikacji, slot, zapisano } from './pomoc';

/**
 * M4-2: Edycja warstwowego rewersu (4 tryby tła, czcionki, ramki, grafika SVG, przyciąganie,
 * kolejność warstw, cofanie/ponawianie), przypisania na 3 poziomach (talia -> szablon -> karta),
 * duplikowanie/usuwanie z potwierdzeniem oraz kontrast w obu językach (PL/EN) i motywach (light/dark).
 */

test.use({ viewport: { width: 1440, height: 1050 } });

async function tekstKontrast(el: Locator, opis: string, min = 4.5) {
  await expect(el, opis).toBeVisible();
  const p = await kontrastTekstu(el);
  expect(p.kontrast, `${opis}: ${p.tekst} na ${p.tlo}`).toBeGreaterThanOrEqual(min);
}

async function obrysKontrast(el: Locator, opis: string, min = 3) {
  await expect(el, opis).toBeVisible();
  const p = await kontrastObrysu(el);
  expect(p.kontrast, `${opis}: ${p.tekst} na ${p.tlo}`).toBeGreaterThanOrEqual(min);
}

async function przelaczJezyk(page: Page, jezyk: 'PL' | 'EN') {
  const menuUst = await otworzUstawieniaAplikacji(page);
  await menuUst
    .getByRole('group', { name: /^(Język|Language)$/ })
    .getByRole('button', { name: jezyk, exact: true })
    .click();
  await page.keyboard.press('Escape');
}

test('edytor rewersu: 4 tryby tła, czcionki, ramka, grafika SVG, przyciąganie, kolejność i cofanie', async ({
  page,
}) => {
  await kreator(page, {
    nazwa: 'Karta próby',
    format: 'Poker',
    uklad: 'Swobodny',
  });
  await page.getByRole('button', { name: /Edytor kart/ }).click();
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });

  const ust = await otworzDruk(page);
  await ust.getByRole('button', { name: 'Nowy rewers' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Edytor rewersu' })).toBeVisible();
  await page.getByLabel('Nazwa rewersu').fill('Rewers zaklęcia');
  await expect(page.locator('.karta-podgladu')).toBeVisible();

  // Kolor tła, tekstura i 4 tryby dopasowania obrazu tła.
  await page.locator('#rewers-tlo-kolor').fill('#1e293b');
  await page.getByTestId('plik-tekstury-rewersu').setInputFiles('testy/zasoby/litera-f.png');
  const wyborTrybu = page.getByLabel('Dopasowanie obrazu tła');
  await expect(wyborTrybu).toBeVisible();

  const obrazy = page.locator('.karta-podgladu .svg-opakowanie svg image');
  await expect(obrazy).toHaveCount(1);
  const wymiarWypelnij = await obrazy.first().evaluate((el) => ({
    w: Number(el.getAttribute('width')),
    h: Number(el.getAttribute('height')),
  }));
  expect(wymiarWypelnij.w).toBeCloseTo((88 * 4) / 3, 1);
  expect(wymiarWypelnij.h).toBeCloseTo(88, 1);

  await wyborTrybu.selectOption('dopasuj');
  const wymiarDopasuj = await obrazy.first().evaluate((el) => ({
    w: Number(el.getAttribute('width')),
    h: Number(el.getAttribute('height')),
  }));
  expect(wymiarDopasuj.w).toBeCloseTo(63, 1);
  expect(wymiarDopasuj.h).toBeCloseTo((63 * 3) / 4, 1);

  await wyborTrybu.selectOption('rozciagnij');
  const wymiarRozciagnij = await obrazy.first().evaluate((el) => ({
    w: Number(el.getAttribute('width')),
    h: Number(el.getAttribute('height')),
  }));
  expect(wymiarRozciagnij.w).toBeCloseTo(63, 1);
  expect(wymiarRozciagnij.h).toBeCloseTo(88, 1);

  await wyborTrybu.selectOption('kafelki');
  await expect.poll(() => obrazy.count()).toBeGreaterThanOrEqual(6);

  // Ramka karty na rewersie.
  const ramka = await sekcja(page, 'Ramka karty');
  await ramka.getByLabel('Ramka karty', { exact: true }).selectOption('linia');
  await expect(page.locator('#rewers-ramka-ods')).toBeVisible();
  await page.locator('#rewers-ramka-ods').fill('3');

  // Warstwa tekstu bez klucza danych + czcionka i rozmiar.
  await dodaj(page, 'Tekst', 'Tytuł rewersu');
  await expect(panel(page).getByText(/Klucz danych/)).toHaveCount(0);
  await panel(page).getByLabel('Stały tekst').fill('ARKANA');
  await panel(page).getByLabel('Czcionka').selectOption('tytul');
  await panel(page).getByLabel('Rozmiar (pt)').fill('16');
  const uzyciaSvg = page.locator('.karta-podgladu .svg-opakowanie svg use');
  await expect(uzyciaSvg.first()).toBeVisible();
  const liczbaPrzedIkona = await uzyciaSvg.count();

  // Warstwa grafiki SVG z katalogu (kolorowalna).
  await dodaj(page, 'Ikona', 'Znak SVG');
  await panel(page).getByLabel('Rodzaj grafiki').selectOption('ozdobnik');
  await page.getByTestId('wybor-ikony-svg').getByRole('button', { name: 'kątownik' }).click();
  await panel(page).getByLabel('Kolor tekstu', { exact: true }).fill('#facc15');
  await expect(uzyciaSvg).toHaveCount(liczbaPrzedIkona + 1);

  // Kolejność warstw i cofanie/ponawianie (przyciski oraz Ctrl+Z).
  const elementyPrzed = await page.locator('.panel-drzewa [role="treeitem"]').allTextContents();
  const pol = await sekcja(page, 'Położenie i rozmiar');
  await pol.getByRole('button', { name: 'Na spód', exact: true }).click();
  const elementyPo = await page.locator('.panel-drzewa [role="treeitem"]').allTextContents();
  expect(elementyPo).not.toEqual(elementyPrzed);
  expect(elementyPo[1]).toContain('Znak SVG');

  // Przyciąganie i przesunięcie na siatce + cofanie.
  await page.getByLabel('Siatka (mm, 0 = wyłączona)').fill('2');
  const xPole = panel(page).getByLabel('X (mm)');
  const xStart = await xPole.inputValue();
  await zaznacz(page, 'Znak SVG');
  await page.locator('.karta-podgladu').focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(xPole).not.toHaveValue(xStart);

  // Cofnij przesunięcie i zmianę kolejności.
  await page.getByRole('button', { name: 'Cofnij', exact: true }).click();
  await expect(xPole).toHaveValue(xStart);
  await page.getByRole('button', { name: 'Cofnij', exact: true }).click();
  await expect
    .poll(() => page.locator('.panel-drzewa [role="treeitem"]').allTextContents())
    .toEqual(elementyPrzed);
  await page.getByRole('button', { name: 'Ponów', exact: true }).click();
  await expect
    .poll(() => page.locator('.panel-drzewa [role="treeitem"]').allTextContents())
    .toEqual(elementyPo);

  await zapisano(page);
});

test('przypisania rewersu na 3 poziomach (talia -> szablon -> karta), duplikowanie, usuwanie i i18n EN', async ({
  page,
}) => {
  await kreator(page, {
    nazwa: 'Szablon talii',
    format: 'Poker',
    uklad: 'Swobodny',
  });
  await page.getByRole('button', { name: /Edytor kart/ }).click();
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });

  // Dodaj dwie karty na arkusz.
  await slot(page, 1, 1, 1).click();
  await page.getByRole('menuitem', { name: /Szablon talii/ }).click();
  await expect(page.locator('[data-karta]')).toHaveCount(1);

  await slot(page, 1, 2, 1).click();
  await page.getByRole('menuitem', { name: /Szablon talii/ }).click();
  await expect(page.locator('[data-karta]')).toHaveCount(2);

  // Utwórz dwa rewersy o różnych kolorach tła.
  const ust = await otworzDruk(page);
  await ust.getByRole('button', { name: 'Nowy rewers' }).click();
  await page.getByLabel('Nazwa rewersu').fill('Rewers A');
  await page.locator('#rewers-tlo-kolor').fill('#112233');
  await zapisano(page);
  await page.getByRole('link', { name: '← Powrót' }).click();

  await ust.getByRole('button', { name: 'Nowy rewers' }).click();
  await page.getByLabel('Nazwa rewersu').fill('Rewers B');
  await page.locator('#rewers-tlo-kolor').fill('#445566');
  await zapisano(page);
  await page.getByRole('link', { name: '← Powrót' }).click();

  // 1. Poziom talii: przypisz Rewers A jako domyślny talii.
  await ust.getByLabel('Domyślny rewers talii').selectOption({ label: 'Rewers A' });
  await expect(ust.locator('.podglad-rewersu-mini svg rect[fill="#112233"]')).toHaveCount(1);

  // Powrót do Edytora kart: Karta 1 dziedziczy Rewers A.
  await page.getByRole('link', { name: '← Powrót' }).click();
  await page.locator('[data-karta]').nth(0).click();
  const panelKart = page.getByRole('complementary', { name: 'Zaznaczone karty' });
  const selectRewers = panelKart.getByLabel('Rewers', { exact: true });
  await expect(selectRewers).toContainText('Dziedzicz (z talii: Rewers A)');
  await expect(panelKart.locator('.podglad-rewersu-mini svg rect[fill="#112233"]')).toHaveCount(1);

  // 2. W Edytorze kart (bez zaznaczonej karty): zmiana rewersu dla wszystkich kart na Rewers B.
  await page.keyboard.press('Escape');
  const panelPomoc = page.getByRole('complementary', { name: 'Pomoc' });
  await panelPomoc.getByLabel('Rewers dla wszystkich kart', { exact: true }).selectOption({
    label: 'Rewers B',
  });
  await expect(panelPomoc.locator('.podglad-rewersu-mini svg rect[fill="#445566"]')).toHaveCount(1);

  // Karta 1 dziedziczy teraz Rewers B z talii.
  await page.locator('[data-karta]').nth(0).click();
  await expect(selectRewers).toContainText('Dziedzicz (z talii: Rewers B)');
  await expect(panelKart.locator('.podglad-rewersu-mini svg rect[fill="#445566"]')).toHaveCount(1);

  // 3. Poziom karty: Karta 1 dostaje Rewers A, Karta 2 jawny brak rewersu.
  await selectRewers.selectOption({ label: 'Rewers A' });
  await expect(panelKart.locator('.podglad-rewersu-mini svg rect[fill="#112233"]')).toHaveCount(1);

  await page.locator('[data-karta]').nth(1).click();
  await selectRewers.selectOption('__brak__');
  await expect(panelKart.getByText('Wyłączono jawnie (bez rewersu).')).toBeVisible();

  // Zaznaczenie obu kart naraz -> różne przypisania.
  await page
    .locator('[data-karta]')
    .nth(0)
    .click({ modifiers: ['Shift'] });
  await expect(selectRewers).toHaveValue('__rozne__');
  await zapisano(page);

  // Trwałość po przeładowaniu i weryfikacja w języku angielskim (EN).
  await page.reload();
  await expect(page.locator('[data-karta]')).toHaveCount(2);
  await przelaczJezyk(page, 'EN');
  await page.locator('[data-karta]').nth(0).click();
  const panelKartEn = page.getByRole('complementary', { name: 'Selected cards' });
  await expect(panelKartEn.getByLabel('Card back', { exact: true })).toContainText('Rewers A');

  // Duplikowanie i usuwanie rewersu z potwierdzeniem pokazującym liczbę przypisań.
  const ustEn = await otworzDruk(page, true);
  await expect(ustEn.getByText('Card backs')).toBeVisible();
  await ustEn.getByRole('button', { name: 'Duplicate card back Rewers A' }).click();
  await expect(ustEn.locator('strong', { hasText: 'Rewers A (copy)' })).toBeVisible();

  await ustEn.getByRole('button', { name: 'Delete card back Rewers A', exact: true }).click();
  const dialog = ustEn.getByRole('alertdialog', { name: 'Rewers A' });
  await expect(dialog).toContainText('(1)');
  await dialog.getByRole('button', { name: 'Delete card back' }).click();
  await expect(
    ustEn.getByRole('link', { name: 'Edit card back Rewers A', exact: true }),
  ).toHaveCount(0);

  // Karta 1 po usunięciu Rewers A przełączyła się na „No back”.
  await page.getByRole('link', { name: '← Back' }).click();
  await page.locator('[data-karta]').nth(0).click();
  await expect(panelKartEn.getByLabel('Card back', { exact: true })).toHaveValue('__brak__');
  await expect(panelKartEn.getByText('Explicitly disabled (no back).')).toBeVisible();
});

for (const motyw of ['light', 'dark'] as const) {
  test(`kontrast AA i motyw ${motyw} w edytorze rewersu oraz panelach (PL/EN)`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: motyw });
    await kreator(page, {
      nazwa: `Karta ${motyw}`,
      format: 'Poker',
      uklad: 'Swobodny',
    });
    await page.getByRole('button', { name: /Edytor kart/ }).click();
    await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });

    const ust = await otworzDruk(page);
    await ust.getByRole('button', { name: 'Nowy rewers' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Edytor rewersu' })).toBeVisible();
    await dodaj(page, 'Tekst', 'Nagłówek');
    await nazwij(page, 'Nagłówek');

    const panelEd = panel(page);
    await tekstKontrast(panelEd.locator('h2'), `nagłówek panelu (${motyw})`);
    await tekstKontrast(
      panelEd.locator('.pole-panelu > label').first(),
      `etykieta pola (${motyw})`,
    );
    await obrysKontrast(panelEd.locator('.pole-panelu input').first(), `obrys pola (${motyw})`);
    await tekstKontrast(
      page.locator('.panel-drzewa .wezel-drzewa.wybrany > .wezel-etykieta'),
      `wybrana warstwa (${motyw})`,
    );

    // Przełącz język na EN wewnątrz edytora rewersu i sprawdź kontrast.
    await przelaczJezyk(page, 'EN');
    await expect(page.getByRole('heading', { level: 1, name: 'Card back editor' })).toBeVisible();
    await tekstKontrast(
      page.getByRole('complementary', { name: 'Layers' }).locator('h2'),
      `Layers heading EN (${motyw})`,
    );

    await page.getByRole('link', { name: /Card editor/ }).click();
    const ustEn = await otworzDruk(page, true);
    await ustEn
      .getByRole('button', { name: /Delete card back/ })
      .first()
      .click();
    const confirmBox = ustEn.getByRole('alertdialog');
    await tekstKontrast(confirmBox.locator('.podpis'), `tekst potwierdzenia usunięcia (${motyw})`);
    await tekstKontrast(
      confirmBox.getByRole('button', { name: 'Delete card back' }),
      `przycisk niebezpieczny potwierdzenia (${motyw})`,
    );
  });
}
