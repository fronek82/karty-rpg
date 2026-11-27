import { expect, test, type Page } from '@playwright/test';
import { otworzDruk, zapisano } from './pomoc';
import { dodaj, drzewo, kartaNaKartce, nazwij, panel, sekcja, zaznacz } from './szablonUI';

/*
 * Przód i tył karty: wspólny edytor, kreator tyłu, „Rozmiar jak w szablonie”, kontrola zgodności
 * rozmiarów (przypisanie, zmiana rozmiaru powiązanego szablonu, druk dwustronny).
 */

/** Nowy tył z kreatora (`#/wlasne/nowy/rewers` albo kreator w projekcie); zwraca id projektu. */
async function nowyTyl(page: Page, nazwa: string, format: string, uklad = 'Pusta karta') {
  await page.goto('./#/wlasne/nowy/rewers');
  await page.getByLabel('Nazwa tyłu').fill(nazwa);
  await page.locator('label.format', { hasText: format }).click();
  await page.locator('label.uklad', { hasText: uklad }).click();
  await page.getByRole('button', { name: /Dalej: edytor tyłu/ }).click();
  await expect(page).toHaveURL(/#\/projekt\/[^/]+\/rewers\//, { timeout: 15000 });
  await expect(drzewo(page)).toBeVisible({ timeout: 15000 });
  return /#\/projekt\/([^/]+)\//.exec(page.url())![1]!;
}

const listaRozmiaru = (page: Page) => page.getByLabel('Rozmiar jak w szablonie');

/** Wybiera w „Rozmiar jak w szablonie” pozycję zaczynającą się od nazwy. */
async function jakWSzablonie(page: Page, nazwa: string) {
  const opcje = await listaRozmiaru(page).locator('option').allTextContents();
  const etykieta = opcje.find((o) => o.startsWith(`${nazwa} – `));
  expect(etykieta, `pozycja ${nazwa} na liście`).toBeTruthy();
  await listaRozmiaru(page).selectOption({ label: etykieta! });
}

/** Projekt z tyłem 63×88 i przodem „Talia A” (przypisany tył) – zwraca adres edytora tyłu. */
async function powiazanyTyl(page: Page) {
  const id = await nowyTyl(page, 'Tył wspólny', 'Standard / Poker');
  const adresTylu = page.url();
  await page.goto(`./#/projekt/${id}/nowy-szablon`);
  await jakWSzablonie(page, 'Tył wspólny');
  await expect(page.getByLabel('Przypisz ten tył do szablonu')).toBeChecked();
  await page.getByLabel('Nazwa szablonu').fill('Talia A');
  await page.getByRole('button', { name: /Dalej: układ pól/ }).click();
  await expect(page).toHaveURL(/\/szablon\//, { timeout: 15000 });
  await zapisano(page);
  await page.goto(adresTylu);
  await expect(drzewo(page)).toBeVisible({ timeout: 15000 });
  return adresTylu;
}

async function zmienSzerokosc(page: Page, szer: string) {
  await page.keyboard.press('Escape');
  await page.locator('#karta-szer').fill(szer);
  await page.locator('#karta-szer').press('Enter');
}

test('nowy tył przez kreator → nowy przód z rozmiarem tego tyłu (pola zablokowane, tył przypisany)', async ({
  page,
}) => {
  await nowyTyl(page, 'Tył talii A', 'Mini Euro', 'Ramka z ornamentem');
  // Tył ma rogi i ramkę z ornamentem z kreatora; panel karty jak na przodzie.
  await expect(panel(page).getByRole('heading', { name: 'Tło i ramka tyłu' })).toBeVisible();
  await expect(page.locator('#karta-promien')).toHaveValue('3');
  await expect(panel(page).locator('summary', { hasText: 'Postrzępiona krawędź' })).toBeVisible();
  await zapisano(page);

  await page.goto('./#/wlasne/nowy/awers');
  await expect(listaRozmiaru(page)).toHaveValue('');
  await expect(listaRozmiaru(page).locator('optgroup[label="Tyły"] option')).toContainText([
    'Tył talii A – 44×68 mm',
  ]);
  await jakWSzablonie(page, 'Tył talii A');
  await expect(page.getByText('Skopiowane z: Tył talii A')).toBeVisible();
  await expect(page.getByLabel('Szerokość (mm)')).toBeDisabled();
  await expect(page.getByLabel('Szerokość (mm)')).toHaveValue('44');
  await expect(page.getByLabel('Wysokość (mm)')).toHaveValue('68');
  await expect(page.getByLabel('Zaokrąglenie rogów (mm)')).toBeDisabled();
  await expect(page.getByLabel('Przypisz ten tył do szablonu')).toBeChecked();
  await page.getByLabel('Nazwa szablonu').fill('Przód talii A');
  await page.getByRole('button', { name: /Dalej: układ pól/ }).click();
  await expect(drzewo(page)).toBeVisible({ timeout: 15000 });
  await zapisano(page);

  // Przypisany tył widać w Edytorze kart (karta dziedziczy tył szablonu).
  await page.getByRole('button', { name: 'Przejdź do kart →', exact: true }).click();
  const druk = await otworzDruk(page);
  await expect(druk.getByLabel('Drukuj tyły (przód i tył w parach stron)')).toBeVisible();
  await expect(
    druk.getByLabel('Domyślny tył talii').locator('option', { hasText: 'Tył talii A' }),
  ).toHaveCount(1);
});

test('najpierw przód, potem tył z rozmiarem z przodu; „Odblokuj” pozwala zmienić pola', async ({
  page,
}) => {
  await page.goto('./#/wlasne/nowy/awers');
  await page.getByLabel('Nazwa szablonu').fill('Potwory');
  await page.locator('label.format', { hasText: 'Tarot' }).click();
  await page.getByRole('button', { name: 'poziomo', exact: true }).click();
  await page.locator('label.uklad', { hasText: 'Tytuł i opis' }).click();
  await page.getByRole('button', { name: /Dalej: układ pól/ }).click();
  await expect(drzewo(page)).toBeVisible({ timeout: 15000 });
  await zapisano(page);

  await page.goto('./#/wlasne/nowy/rewers');
  await expect(
    listaRozmiaru(page).locator('optgroup[label="Przody"] option', { hasText: 'Potwory' }),
  ).toHaveText('Potwory – 120×70 mm');
  await jakWSzablonie(page, 'Potwory');
  // W kreatorze tyłu nie ma przypisywania (tył przypisuje się do przodów osobno).
  await expect(page.getByLabel('Przypisz ten tył do szablonu')).toHaveCount(0);
  await expect(page.getByLabel('Szerokość (mm)')).toHaveValue('120');
  await expect(page.getByLabel('Wysokość (mm)')).toBeDisabled();
  await page.getByRole('button', { name: 'Odblokuj' }).click();
  await expect(page.getByText(/Skopiowane z:/)).toHaveCount(0);
  await page.getByLabel('Wysokość (mm)').fill('75');
  await expect(page.locator('.kreator-podglad')).toContainText('120×75 mm');
  await page.locator('label.uklad', { hasText: 'Wzór na całą kartę' }).click();
  await page.getByRole('button', { name: /Dalej: edytor tyłu/ }).click();
  await expect(drzewo(page)).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#karta-szer')).toHaveValue('120');
  await expect(page.locator('#karta-wys')).toHaveValue('75');
  // Wzór na całą kartę z kreatora (romby w kolorze kontrastowym do tła).
  await expect(page.locator('.karta-podgladu svg path[stroke="#000000"]').first()).toBeAttached();
});

test('tył: pusty stan na podglądzie i w drzewie, wzór SVG z biblioteki jak na przodzie', async ({
  page,
}) => {
  await nowyTyl(page, 'Tył pusty', 'Standard / Poker');
  await expect(page.getByTestId('pusty-stan-karty')).toContainText('Pusta karta');
  await expect(page.getByTestId('pusty-stan-drzewa')).toContainText('Brak elementów');
  const tlo = await sekcja(page, 'Tło karty');
  await tlo
    .getByRole('group', { name: 'Rodzaj tła' })
    .getByRole('button', { name: 'Wzór' })
    .click();
  await tlo.getByTestId('plik-wzoru-svg').setInputFiles({
    name: 'Kropla.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="M5 0L10 10H0Z" fill="#224466"/></svg>',
    ),
  });
  await expect(tlo.getByRole('button', { name: 'Kropla', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(
    page.locator('.karta-podgladu svg pattern[patternUnits="userSpaceOnUse"]'),
  ).toHaveCount(1);
  await dodaj(page, 'Tekst', 'Napis');
  await expect(page.getByTestId('pusty-stan-karty')).toHaveCount(0);
});

test('przypisanie tyłu o innym rozmiarze: ostrzeżenie z różnicą, „Anuluj” i „Przypisz mimo to”', async ({
  page,
}) => {
  await nowyTyl(page, 'Tył mały', 'Bridge');
  await zapisano(page);
  await page.goto('./#/wlasne/nowy/awers');
  await page.getByLabel('Nazwa szablonu').fill('Duży przód');
  await page.getByRole('button', { name: /Dalej: układ pól/ }).click();
  await expect(drzewo(page)).toBeVisible({ timeout: 15000 });
  await kartaNaKartce(page, 'Duży przód', {});
  const druk = await otworzDruk(page);
  const wybor = druk.getByLabel('Domyślny tył talii');
  const wybierz = async () => {
    const opcja = wybor.locator('optgroup[label="Zapisane tyły"] option', { hasText: 'Tył mały' });
    await wybor.selectOption({ value: (await opcja.getAttribute('value'))! });
  };
  await wybierz();
  const okno = page.getByRole('dialog', { name: 'Rozmiary przodu i tyłu się różnią' });
  await expect(okno).toContainText('Duży przód: przód 63×88, tył 57×89');
  await okno.getByRole('button', { name: 'Anuluj' }).click();
  await expect(okno).toHaveCount(0);
  await expect(wybor).toHaveValue('');
  await wybierz();
  await okno.getByRole('button', { name: 'Przypisz mimo to' }).click();
  await expect(wybor.locator('option:checked')).toHaveText('Tył mały');

  // Druk dwustronny z niezgodnymi rozmiarami – wyraźny komunikat w opcjach i przed PDF.
  await expect(druk.getByTestId('niezgodne-rozmiary-druku')).toContainText(
    'Duży przód: przód 63×88, tył 57×89',
  );
  await page.getByRole('button', { name: 'Pobierz', exact: true }).click();
  await page.getByRole('menuitem', { name: /PDF/ }).first().click();
  const oknoDruku = page.getByRole('dialog', { name: 'Rozmiary przodu i tyłu się różnią' });
  await expect(oknoDruku).toContainText('tyły zostaną rozciągnięte');
  await oknoDruku.getByRole('button', { name: 'Anuluj' }).click();
  await expect(oknoDruku).toHaveCount(0);
});

test('zmiana rozmiaru podpiętego tyłu → „Utwórz kopię w nowym rozmiarze”', async ({ page }) => {
  const adresTylu = await powiazanyTyl(page);
  await zmienSzerokosc(page, '57');
  const okno = page.getByRole('dialog', { name: 'Zmiana rozmiaru powiązanego szablonu' });
  await expect(okno).toContainText('Ten tył jest używany przez 1 przód (63×88 mm): Talia A.');
  await expect(okno).toContainText('Po zmianie na 57×88 mm przestaną do siebie pasować.');
  await expect(okno.getByRole('button', { name: 'Utwórz kopię w nowym rozmiarze' })).toBeFocused();
  await okno.getByRole('button', { name: 'Utwórz kopię w nowym rozmiarze' }).click();
  // Kopia otwiera się w edytorze, z nazwą z rozmiarem i nowym rozmiarem.
  await expect(page).not.toHaveURL(adresTylu);
  await expect(page.locator('input.nazwa-projektu')).toHaveValue('Tył wspólny (57×88)');
  await expect(page.locator('#karta-szer')).toHaveValue('57');
  // Kopia nie jest przypisana: zmiana rozmiaru bez pytania.
  await zmienSzerokosc(page, '60');
  await expect(okno).toHaveCount(0);
  await expect(page.locator('#karta-szer')).toHaveValue('60');
  await zapisano(page);
  // Oryginał bez zmian i dalej przypisany (znów pyta).
  await page.goto(adresTylu);
  await expect(page.locator('#karta-szer')).toHaveValue('63');
  await zmienSzerokosc(page, '50');
  await expect(okno).toBeVisible();
});

test('zmiana rozmiaru podpiętego tyłu → „Anuluj” i „Zmień mimo to”; skalowanie albo elementy poza kartą', async ({
  page,
}) => {
  await powiazanyTyl(page);
  await dodaj(page, 'Tekst', 'Napis');
  await (await sekcja(page, 'Położenie i rozmiar')).getByLabel('X (mm)').fill('25');
  await zapisano(page);

  const okno = page.getByRole('dialog', { name: 'Zmiana rozmiaru powiązanego szablonu' });
  await zmienSzerokosc(page, '40');
  await okno.getByRole('button', { name: 'Anuluj' }).click();
  await expect(okno).toHaveCount(0);
  await expect(page.locator('#karta-szer')).toHaveValue('63');

  // „Zostaw elementy w tych samych miejscach” – element za prawą krawędzią ma ostrzeżenie.
  await zmienSzerokosc(page, '40');
  await okno.getByLabel('Zostaw elementy w tych samych miejscach').check();
  await okno.getByRole('button', { name: 'Zmień mimo to' }).click();
  await expect(page.locator('#karta-szer')).toHaveValue('40');
  const element = drzewo(page).getByRole('treeitem', { name: /^Napis – / });
  await expect(element).toContainText('25 · 3');
  await expect(element.getByTestId('poza-karta')).toBeVisible();

  // Cofnij i „Przeskaluj zawartość proporcjonalnie” – położenie skalowane, bez ostrzeżenia.
  await page.getByRole('button', { name: 'Cofnij' }).click();
  await expect(page.locator('#karta-szer')).toHaveValue('63');
  await zmienSzerokosc(page, '31.5');
  await okno.getByLabel('Przeskaluj zawartość proporcjonalnie').check();
  await okno.getByRole('button', { name: 'Zmień mimo to' }).click();
  await expect(page.locator('#karta-szer')).toHaveValue('31.5');
  await expect(element).toContainText('12,5 · 3');
  await expect(element.getByTestId('poza-karta')).toHaveCount(0);
});

test('tył: pole o nazwie pola przodu pokazuje i zmienia wartość przykładową przodu', async ({
  page,
}) => {
  const id = await nowyTyl(page, 'Tył z danymi', 'Standard / Poker');
  const adresTylu = page.url();
  await dodaj(page, 'Tekst', 'Napis');
  await expect(panel(page).getByText(/Gdy ten tył zostanie przypisany do przodu/)).toBeVisible();
  // Własna wartość przykładowa tyłu: tylko podgląd, stały tekst bez zmian.
  const podgladTylu = page.locator('.karta-podgladu svg');
  const bezPrzykladu = await podgladTylu.innerHTML();
  await panel(page).getByLabel('Wartość przykładowa', { exact: true }).fill('Bez przodu');
  await expect.poll(() => podgladTylu.innerHTML()).not.toBe(bezPrzykladu);
  await expect(panel(page).getByLabel('Stały tekst')).toHaveValue('Tekst');
  await zapisano(page);

  await page.goto(`./#/projekt/${id}/nowy-szablon`);
  await jakWSzablonie(page, 'Tył z danymi');
  await page.getByLabel('Nazwa szablonu').fill('Czary');
  await page.getByRole('button', { name: /Dalej: układ pól/ }).click();
  await expect(drzewo(page)).toBeVisible({ timeout: 15000 });
  const adresPrzodu = page.url();
  await dodaj(page, 'Tekst', 'Rodzaj');
  await panel(page).getByLabel('Wartość przykładowa', { exact: true }).fill('Kula ognia');
  await zapisano(page);

  await page.goto(adresTylu);
  await expect(drzewo(page)).toBeVisible({ timeout: 15000 });
  const podglad = page.locator('.karta-podgladu svg');
  // Pole bez odpowiednika na przodzie: podpowiedź z nazwami pól przodu.
  await zaznacz(page, 'Napis');
  await expect(panel(page).getByText(/nazwę pola z przodu: „Rodzaj”/)).toBeVisible();
  // Tekst na podglądzie to krzywe – zmianę treści widać po zmianie rysunku.
  const rysunek = () => podglad.innerHTML();
  const przed = await rysunek();
  await nazwij(page, 'Rodzaj');
  const przyklad = panel(page).getByLabel('Wartość przykładowa (z przodu „Czary”)');
  await expect(przyklad).toHaveValue('Kula ognia');
  await expect.poll(rysunek).not.toBe(przed);
  const zPrzykladem = await rysunek();
  await przyklad.fill('Tarcza');
  await expect.poll(rysunek).not.toBe(zPrzykladem);
  await zapisano(page);

  // Wartość przykładowa jest wspólna z przodem.
  await page.goto(adresPrzodu);
  await expect(drzewo(page)).toBeVisible({ timeout: 15000 });
  await zaznacz(page, 'Rodzaj');
  await expect(panel(page).getByLabel('Wartość przykładowa', { exact: true })).toHaveValue(
    'Tarcza',
  );
});
