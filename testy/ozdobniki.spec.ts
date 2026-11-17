import { expect, test } from '@playwright/test';
import { karta, kreator, panel, sekcja, zaznacz } from './szablonUI';

/** M2b-3: panel „Ramka” – rodzaj, linia podwójna, narożniki z biblioteki (miniatury). */

test.use({ viewport: { width: 1440, height: 1000 } });

test('ramka karty: linia podwójna i narożnik z miniatur; zapis w modelu i w podglądzie', async ({
  page,
}) => {
  await kreator(page, {
    nazwa: 'Ozdobna',
    format: 'Standard / Poker',
    rogi: 3,
    uklad: 'Pusta karta',
  });
  await karta(page);
  const r = await sekcja(page, 'Ramka karty');
  const rodzaj = r.getByRole('group', { name: 'Ramka karty', exact: true });
  // Ramka z obrazu jest wyłączona do kolejnych etapów, motyw dostępny.
  await expect(rodzaj.getByRole('button', { name: 'motyw' })).toBeEnabled();
  await expect(rodzaj.getByRole('button', { name: /z obrazu/ })).toBeDisabled();
  await expect(r).toContainText('w kolejnych etapach');
  await rodzaj.getByRole('button', { name: 'linia', exact: true }).click();

  await r.getByLabel('Kolor linii').fill('#2f5d8a');
  await r.getByLabel('Odsunięcie od krawędzi (mm)').fill('1.5');
  const linie = page.locator('.karta-podgladu svg rect[stroke]');
  const przed = await linie.count();
  await r
    .getByRole('group', { name: 'Styl linii' })
    .getByRole('button', { name: 'podwójna' })
    .click();
  await expect(linie).toHaveCount(przed + 1);
  await expect(r.getByLabel('Przerwa między liniami (mm)')).toBeVisible();

  // Narożnik z miniaturami: sześć wbudowanych + „brak”.
  const naroz = r.getByRole('group', { name: 'Narożniki' });
  await expect(naroz.getByRole('button')).toHaveCount(7);
  await expect(page.locator('.karta-podgladu svg use[href^="#"][color]')).toHaveCount(0);
  await naroz.getByRole('button', { name: 'liść' }).click();
  await expect(naroz.getByRole('button', { name: 'liść' })).toHaveAttribute('aria-pressed', 'true');
  await r.getByLabel('Rozmiar narożnika (mm)').fill('8');
  const uzycia = page.locator('.karta-podgladu svg use[color]');
  await expect(uzycia).toHaveCount(4);
  await expect(page.locator('.karta-podgladu svg defs g[id]')).toHaveCount(1);

  // Zmiana narożnika podmienia rysunek; „brak” usuwa narożniki.
  await naroz.getByRole('button', { name: 'gwiazda' }).click();
  await expect(uzycia).toHaveCount(4);
  if (process.env.ZRZUTY) await page.screenshot({ path: 'docs/obrazy/m2b-3-ramka-narozniki.png' });
  await naroz.getByRole('button', { name: 'brak' }).click();
  await expect(uzycia).toHaveCount(0);
});

test('obramowanie węzła: linia podwójna i narożnik; rodzaj „brak” je czyści', async ({ page }) => {
  await kreator(page, { nazwa: 'Węzeł', format: 'Standard / Poker', uklad: 'Tytuł i opis' });
  await zaznacz(page, 'Opis');
  const w = await sekcja(page, 'Wygląd (tło, ramka, rogi)');
  const rodzaj = w.getByRole('group', { name: 'Ramka z linii', exact: true });
  await rodzaj.getByRole('button', { name: 'linia', exact: true }).click();
  await w
    .getByRole('group', { name: 'Styl linii' })
    .getByRole('button', { name: 'podwójna' })
    .click();
  await w.getByRole('group', { name: 'Narożniki' }).getByRole('button', { name: 'okucie' }).click();
  await expect(panel(page).getByLabel('Przerwa między liniami (mm)')).toBeVisible();
  await expect(page.locator('.karta-podgladu svg use[color]')).toHaveCount(4);
  await rodzaj.getByRole('button', { name: 'brak', exact: true }).click();
  await expect(page.locator('.karta-podgladu svg use[color]')).toHaveCount(0);
  await expect(w.getByRole('group', { name: 'Narożniki' })).toHaveCount(0);
});

test('motyw: wybór z listy miniatur na ramce karty i na węźle, kolor, pas, szyny, podpowiedź', async ({
  page,
}) => {
  await kreator(page, {
    nazwa: 'Motywy',
    format: 'Standard / Poker',
    rogi: 3,
    uklad: 'Tytuł i opis',
  });
  await karta(page);
  const r = await sekcja(page, 'Ramka karty');
  const rodzaj = r.getByRole('group', { name: 'Ramka karty', exact: true });
  await rodzaj.getByRole('button', { name: 'motyw' }).click();
  await expect(rodzaj.getByRole('button', { name: 'motyw' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );

  // Sześć motywów z miniaturami; linia znika z podglądu, pojawiają się kafelki.
  const lista = r.getByRole('group', { name: 'Motyw', exact: true });
  await expect(lista.getByRole('button')).toHaveCount(6);
  await expect(lista.locator('svg')).toHaveCount(6);
  for (const n of ['pnącze', 'przeplot', 'łuski', 'runy', 'łańcuch', 'gwiazdki'])
    await expect(lista.getByRole('button', { name: n })).toBeVisible();
  const uzycia = page.locator('.karta-podgladu svg use[color]');
  const defs = page.locator('.karta-podgladu svg defs g[id]');
  await expect(uzycia.first()).toBeVisible();
  await expect(defs).toHaveCount(2); // kafelek i kostka narożna
  await expect(page.locator('.karta-podgladu svg rect[stroke]')).toHaveCount(0);

  // Zmiana motywu podmienia rysunek; szerokość pasa zmienia liczbę kafelków.
  await lista.getByRole('button', { name: 'runy' }).click();
  await expect(lista.getByRole('button', { name: 'runy' })).toHaveAttribute('aria-pressed', 'true');
  await r.getByLabel('Szerokość pasa (mm)').fill('4');
  const przed = await uzycia.count();
  await r.getByLabel('Szerokość pasa (mm)').fill('8');
  await expect.poll(() => uzycia.count()).toBeLessThan(przed);
  await r.getByLabel('Kolor motywu').fill('#2f5d8a');
  await expect(uzycia.first()).toHaveAttribute('color', '#2f5d8a');

  // Szyny to dwa dodatkowe prostokąty z obrysem.
  await r.getByLabel('Szyny (mm, 0 = brak)').fill('0.3');
  await expect(page.locator('.karta-podgladu svg rect[stroke]')).toHaveCount(2);

  // Narożnik z biblioteki zastępuje kostki narożne motywu.
  const naroz = r.getByRole('group', { name: 'Narożniki' });
  const naPrzed = await uzycia.count();
  await naroz.getByRole('button', { name: 'liść' }).click();
  await expect(defs).toHaveCount(2); // kafelek i narożnik
  await expect(uzycia).toHaveCount(naPrzed);
  await naroz.getByRole('button', { name: 'brak' }).click();

  // Podpowiedź R3: zaokrąglenie rogów dotyczy tylko linii.
  await expect(r.getByRole('note')).toContainText('prostych bokach');
  if (process.env.ZRZUTY) await page.screenshot({ path: 'docs/obrazy/m2b-4-motywy.png' });

  // Powrót do linii przywraca ramkę z linii i usuwa motyw.
  await rodzaj.getByRole('button', { name: 'linia', exact: true }).click();
  await expect(uzycia).toHaveCount(0);
  await expect(page.locator('.karta-podgladu svg rect[stroke]')).not.toHaveCount(0);

  // Węzeł: motyw na polu „Opis”, kształt inny niż prostokąt go nie obsługuje.
  await zaznacz(page, 'Opis');
  const w = await sekcja(page, 'Wygląd (tło, ramka, rogi)');
  const rodzajW = w.getByRole('group', { name: 'Ramka z linii', exact: true });
  await rodzajW.getByRole('button', { name: 'motyw' }).click();
  await w
    .getByRole('group', { name: 'Motyw', exact: true })
    .getByRole('button', { name: 'łuski' })
    .click();
  await w.getByLabel('Odsunięcie pasa (mm)').fill('1');
  await expect(uzycia.first()).toBeVisible();
  await rodzajW.getByRole('button', { name: 'brak', exact: true }).click();
  await expect(uzycia).toHaveCount(0);
});
