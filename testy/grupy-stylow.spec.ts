import { expect, test } from '@playwright/test';
import { karta, kreator, sekcja, zaznacz } from './szablonUI';
import { zapisano } from './pomoc';

test.use({ viewport: { width: 1440, height: 960 } });

test('grupa zmienia dwa pola, tło zależy od przykładu, a odłączenie zachowuje styl', async ({
  page,
}) => {
  await kreator(page, {
    nazwa: 'Wspólne style',
    format: 'Standard / Poker',
    uklad: 'Tytuł i opis',
  });
  await zaznacz(page, 'Tytuł');
  const grupyTytulu = await sekcja(page, 'Grupy stylów');
  await grupyTytulu.getByRole('button', { name: 'Nowa grupa z tego pola' }).click();
  await grupyTytulu.getByLabel('Nazwa grupy').fill('Wspólny');
  await grupyTytulu.getByLabel('Nazwa grupy').press('Tab');

  await zaznacz(page, 'Opis');
  const grupyOpisu = await sekcja(page, 'Grupy stylów');
  await grupyOpisu.getByLabel('Grupa stylu').selectOption({ label: 'Wspólny' });
  await grupyOpisu
    .getByLabel(/Kolor tekstu$/)
    .last()
    .fill('#176b44');
  const podglad = page.locator('.karta-podgladu svg');
  const zielone = podglad.locator('[fill="#176b44"]');
  await expect.poll(() => zielone.count()).toBeGreaterThan(1);

  if (process.env.ZRZUTY_M3_2) await page.screenshot({ path: 'docs/obrazy/m3-2-grupa-stylu.png' });

  await grupyOpisu.getByLabel('Grupa stylu').selectOption('');
  await zaznacz(page, 'Tytuł');
  const grupa = await sekcja(page, 'Grupy stylów');
  await grupa
    .getByLabel(/Kolor tekstu$/)
    .last()
    .fill('#7122a5');
  await expect(podglad.locator('[fill="#7122a5"]').first()).toBeAttached();
  await expect(zielone.first()).toBeAttached();

  await page.getByLabel('Wartość przykładowa', { exact: true }).fill('Noc');
  await karta(page);
  const kolor = await sekcja(page, 'Kolor z danych');
  await kolor.getByLabel('Pole źródłowe koloru').selectOption({ label: 'Tytuł' });
  await kolor.getByLabel('Domyślny kolor reguły').fill('#e5dbc9');
  await kolor.getByRole('button', { name: 'Dodaj wartość' }).click();
  await kolor.getByLabel('Wartość danych', { exact: true }).fill('Noc');
  await kolor.getByLabel('Kolor wartości', { exact: true }).fill('#c9e1ee');
  await expect(podglad.locator('rect[fill="#c9e1ee"]').first()).toBeAttached();
  await zapisano(page);

  if (process.env.ZRZUTY_M3_2)
    await page.screenshot({ path: 'docs/obrazy/m3-2-kolor-z-danych.png' });

  await sekcja(page, 'Układ karty (odstępy, rozłożenie, wygląd)');
  const kolorPanelu = await sekcja(page, 'Kolor z danych', 1);
  await kolorPanelu.getByLabel('Pole źródłowe koloru').selectOption({ label: 'Tytuł' });
  await kolorPanelu.getByLabel('Domyślny kolor reguły').fill('#bdebd4');
  await expect(podglad.locator('[fill="#bdebd4"]').first()).toBeAttached();

  await zaznacz(page, 'Opis');
  const etykieta = await sekcja(page, 'Etykieta');
  await etykieta.getByRole('checkbox', { name: /Pokaż etykietę/ }).check();
  const kolorEtykiety = await sekcja(page, 'Kolor z danych');
  await kolorEtykiety.getByLabel('Pole źródłowe koloru').selectOption({ label: 'Tytuł' });
  await kolorEtykiety.getByLabel('Domyślny kolor reguły').fill('#973232');
  await expect(podglad.locator('[fill="#973232"]').first()).toBeAttached();
  await zapisano(page);

  await page.reload();
  await expect(podglad.locator('rect[fill="#c9e1ee"]').first()).toBeAttached();
  await expect(podglad.locator('[fill="#bdebd4"]').first()).toBeAttached();
  await expect(podglad.locator('[fill="#973232"]').first()).toBeAttached();
  await zaznacz(page, 'Tytuł');
  await page.getByLabel('Wartość przykładowa', { exact: true }).fill('Inna wartość');
  await expect(podglad.locator('rect[fill="#e5dbc9"]').first()).toBeAttached();
});
