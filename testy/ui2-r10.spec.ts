import { expect, test, type Page } from '@playwright/test';

interface Prostokat {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

function przecinajaSie(a: Prostokat, b: Prostokat, margines = 0.5): boolean {
  return (
    a.left < b.right - margines &&
    a.right > b.left + margines &&
    a.top < b.bottom - margines &&
    a.bottom > b.top + margines
  );
}

async function otworzNowyEdytor(page: Page) {
  await page.goto('./');
  await page.getByTestId('start-nowy-szablon').click();
  await page
    .getByTestId('okno-nowy-szablon')
    .getByRole('button', { name: 'Utwórz szablon' })
    .click();
  await expect(page).toHaveURL(/#\/szablon\/[^/]+$/, { timeout: 15000 });
  await expect(page.locator('.karta-podgladu')).toBeVisible();
}

test('R10: nagłówek bez usuniętych przycisków, menu Szablon ▾ ma 6 pozycji (z Usuń)', async ({
  page,
}) => {
  await otworzNowyEdytor(page);

  const naglowek = page.locator('header.ui2-naglowek');
  await expect(naglowek).toBeVisible();
  for (const zakazany of ['Powrót', 'Edytor kart', 'Biblioteka', 'Biblioteki', 'Nowy projekt']) {
    await expect(naglowek.getByRole('button', { name: zakazany })).toHaveCount(0);
    await expect(naglowek.getByRole('link', { name: zakazany })).toHaveCount(0);
  }
  await expect(naglowek.getByRole('link', { name: '← Szablony' })).toBeVisible();
  await expect(naglowek.locator('.ui2-kroki')).toHaveCount(0);

  await page.getByTestId('menu-szablon-przycisk').click();
  const menu = page.getByTestId('menu-szablon');
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('menuitem')).toHaveCount(6);

  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
});

test('R10: brak ramek pod kartą, dymek Przyciąganie w pasku stanu i zamykanie Esc', async ({
  page,
}) => {
  await otworzNowyEdytor(page);

  // Obszar roboczy nie ma już ramek przyciągania ani podkładu.
  await expect(page.locator('.narzedzia-podgladu')).toHaveCount(0);

  // Kliknięcie „Przyciąganie” w pasku stanu otwiera dymek, Esc go zamyka.
  await page.getByTestId('stan-przyciaganie').click();
  const dymek = page.getByTestId('dymek-stanu');
  await expect(dymek).toBeVisible();
  await expect(dymek.locator('#przyciaganie-siatka')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dymek).toHaveCount(0);

  // Klawisz ? otwiera dymek skrótów, Esc go zamyka.
  await page.locator('.karta-podgladu').focus();
  await page.keyboard.press('?');
  await expect(dymek).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dymek).toHaveCount(0);
});

test('R10: przypięte linijki nie nachodzą na panele ani na siebie, cyfry nie przecinają się przy 100%, Dopasuj i 200%', async ({
  page,
}) => {
  await otworzNowyEdytor(page);

  async function sprawdzGeometrieLinijek() {
    const wyniki = await page.evaluate(() => {
      const rect = (el: Element | null) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
        };
      };
      return {
        linijkaX: rect(document.querySelector('[data-testid="linijka-pozioma"]')),
        linijkaY: rect(document.querySelector('[data-testid="linijka-pionowa"]')),
        pasekStanu: rect(document.querySelector('[data-testid="pasek-stanu-edytora"]')),
        lewyPasek: rect(document.querySelector('.ui2-pasek-boczny')),
        prawyPanel: rect(document.querySelector('.edytor-ui2-prawa-kolumna')),
        cyfryX: [...document.querySelectorAll('[data-testid="cyfra-linijki-x"]')].map((el) =>
          rect(el)!,
        ),
        cyfryY: [...document.querySelectorAll('[data-testid="cyfra-linijki-y"]')].map((el) =>
          rect(el)!,
        ),
      };
    });

    expect(wyniki.linijkaX).not.toBeNull();
    expect(wyniki.linijkaY).not.toBeNull();
    expect(wyniki.pasekStanu).not.toBeNull();
    expect(wyniki.lewyPasek).not.toBeNull();
    expect(wyniki.prawyPanel).not.toBeNull();

    for (const linijka of [wyniki.linijkaX!, wyniki.linijkaY!]) {
      expect(przecinajaSie(linijka, wyniki.pasekStanu!)).toBe(false);
      expect(przecinajaSie(linijka, wyniki.lewyPasek!)).toBe(false);
      expect(przecinajaSie(linijka, wyniki.prawyPanel!)).toBe(false);
    }

    expect(wyniki.cyfryX.length).toBeGreaterThan(2);
    expect(wyniki.cyfryY.length).toBeGreaterThan(2);

    for (let i = 0; i < wyniki.cyfryX.length; i++) {
      for (let j = i + 1; j < wyniki.cyfryX.length; j++) {
        expect(przecinajaSie(wyniki.cyfryX[i]!, wyniki.cyfryX[j]!, 0)).toBe(false);
      }
    }
    for (let i = 0; i < wyniki.cyfryY.length; i++) {
      for (let j = i + 1; j < wyniki.cyfryY.length; j++) {
        expect(przecinajaSie(wyniki.cyfryY[i]!, wyniki.cyfryY[j]!, 0)).toBe(false);
      }
    }
  }

  // 1. Dopasuj (domyślny stan – między − i + aktualne powiększenie w procentach)
  const zoomEl = page.getByTestId('zoom-wartosc');
  await expect(zoomEl).toHaveText(/^\d+%$/);
  await sprawdzGeometrieLinijek();

  // 2. 100 %
  const pomniejsz = page.getByRole('button', { name: 'Pomniejsz' });
  const powieksz = page.getByRole('button', { name: 'Powiększ' });
  for (let k = 0; k < 10 && (await zoomEl.textContent())?.trim() !== '100%'; k++) {
    const val = Number.parseInt((await zoomEl.textContent()) ?? '100', 10);
    if (val > 100) await pomniejsz.click();
    else await powieksz.click();
  }
  await expect(zoomEl).toHaveText('100%');
  await sprawdzGeometrieLinijek();

  // 3. Największe powiększenie (200 %)
  for (let k = 0; k < 4; k++) {
    await powieksz.click();
  }
  await expect(zoomEl).toHaveText('200%');
  await sprawdzGeometrieLinijek();
});

test('R10: Struktura ma 5 przycisków ikon w nagłówku i nie ma przycisku „+ Dodaj”', async ({
  page,
}) => {
  await otworzNowyEdytor(page);

  const struktura = page.locator('aside.edytor-ui2-struktura');
  await expect(struktura).toBeVisible();
  const akcje = struktura.getByTestId('struktura-akcje');
  await expect(
    akcje.locator(':scope > button, :scope > .edytor-ui2-menu-opakowanie > button'),
  ).toHaveCount(5);
  await expect(struktura.getByRole('button', { name: /\+\s*Dodaj|＋\s*Dodaj/i })).toHaveCount(0);

  // Menu „Więcej” ma 5 pozycji (w tym „Opakuj w warstwy”).
  await akcje.getByRole('button', { name: 'Więcej' }).click();
  const menuWiecej = page.getByTestId('menu-struktura-wiecej');
  await expect(menuWiecej).toBeVisible();
  await expect(menuWiecej.getByRole('menuitem')).toHaveCount(5);
  await expect(menuWiecej.getByRole('menuitem', { name: 'Opakuj w warstwy' })).toBeVisible();
});
