import { expect, test } from '@playwright/test';
import { zapisano } from './pomoc';
import { dodaj, kreator } from './szablonUI';

/**
 * M5-1: automatyczne czyszczenie tekstu wklejanego z PDF w polach tekstowych
 * (łączenie złamanych wierszy i przeniesień dywizem / U+00AD / U+2010, zachowanie akapitów i list,
 * cofnięcie skrótem Ctrl+Z w polu i przyciskiem Cofnij, tekst stały i przykładowy, PL i EN).
 */

const TEKST_Z_PDF = [
  'Ten czar powoduje, że',
  'przeciwnik upada na zie-',
  'mię i traci następną turę.',
  '',
  '1. Rzuć kością i sprawdź',
  'wynik w tabeli.',
  '2. Zastosuj efekt natych\u00AD',
  'miast po teście.',
].join('\n');

const OCZEKIWANY_TEKST = [
  'Ten czar powoduje, że przeciwnik upada na ziemię i traci następną turę.',
  '',
  '1. Rzuć kością i sprawdź wynik w tabeli.',
  '2. Zastosuj efekt natychmiast po teście.',
].join('\n');

async function wklejTekst(
  locator: import('@playwright/test').Locator,
  tekst: string,
  zachowajZaznaczenie = false,
) {
  if (!zachowajZaznaczenie) await locator.click();
  else await locator.focus();
  await locator.evaluate((el, dane) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', dane);
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }),
    );
  }, tekst);
}

test('wklejanie tekstu z PDF czyści złamania w edytorze szablonu i na karcie, działa Ctrl+Z w polu oraz EN', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await kreator(page, {
    nazwa: 'Karta opisu',
    format: 'Poker',
    uklad: 'Swobodny',
  });
  await dodaj(page, 'Tekst', 'Opis');

  // 1) Wartość przykładowa w edytorze szablonu + osobny krok historii Cofnij.
  const panelWlasciwosci = page.getByRole('complementary', { name: 'Właściwości' });
  const polePrzyklad = panelWlasciwosci.getByLabel('Wartość przykładowa');
  await polePrzyklad.fill('Start: ');
  await wklejTekst(polePrzyklad, TEKST_Z_PDF);
  await expect(polePrzyklad).toHaveValue(`Start: ${OCZEKIWANY_TEKST}`);
  await page.getByRole('button', { name: 'Cofnij' }).click();
  await expect(polePrzyklad).toHaveValue('Start: ');

  // 2) Stały tekst w edytorze szablonu.
  await panelWlasciwosci
    .getByRole('button', { name: 'stała (na każdej karcie)', exact: true })
    .click();
  const poleStaly = panelWlasciwosci.getByLabel('Stały tekst');
  await poleStaly.fill('');
  await wklejTekst(poleStaly, 'Pierwsza\nlinia z\u2010\nłamaniem');
  await expect(poleStaly).toHaveValue('Pierwsza linia złamaniem');
  await panelWlasciwosci.getByRole('button', { name: 'z danych karty', exact: true }).click();

  // 3) Pole opisu na karcie: wklejanie z PDF + Ctrl+Z z fokusem w polu + przycisk Cofnij.
  await page.getByRole('button', { name: 'Rób karty' }).click();
  await expect(page.locator('.strona-kartki .warstwa').first()).toBeVisible({ timeout: 15000 });
  await page.locator('.strona-kartki .slot').first().click();
  await page.getByRole('menu').getByRole('menuitem').first().click();

  const panelKarty = page.getByRole('complementary', { name: 'Zaznaczone karty' });
  const poleOpisu = panelKarty.getByLabel('Opis');
  await poleOpisu.fill('Wstęp: ');
  await wklejTekst(poleOpisu, TEKST_Z_PDF);
  await expect(poleOpisu).toHaveValue(`Wstęp: ${OCZEKIWANY_TEKST}`);

  // Ctrl+Z z fokusem bezpośrednio w <textarea> cofa wklejony blok.
  await poleOpisu.press('ControlOrMeta+z');
  await expect(poleOpisu).toHaveValue('Wstęp: ');

  // Ponowne wklejenie i weryfikacja zapisu oraz interfejsu EN.
  await wklejTekst(poleOpisu, TEKST_Z_PDF);
  await expect(poleOpisu).toHaveValue(`Wstęp: ${OCZEKIWANY_TEKST}`);
  await zapisano(page);

  await page
    .getByRole('group', { name: /^(Język|Language)$/ })
    .getByRole('button', { name: 'EN', exact: true })
    .click();
  const panelEn = page.getByRole('complementary', { name: 'Selected cards' });
  const poleEn = panelEn.getByLabel('Opis');
  await poleEn.fill('A [X] B');
  await poleEn.focus();
  await poleEn.evaluate((el) => (el as HTMLTextAreaElement).setSelectionRange(2, 5));
  await wklejTekst(poleEn, 'clean-\ned\ntext', true);
  await expect(poleEn).toHaveValue('A cleaned text B');
});
