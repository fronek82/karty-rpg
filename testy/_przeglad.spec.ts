import { test } from '@playwright/test';
import { gotowyUklad, karta } from './pomoc';
import { dodaj, kreator } from './szablonUI';

const S = '/tmp/claude-0/-home-user-karty-rpg/a0b5c765-ceb5-561d-b1e3-74dc3e15397b/scratchpad';
test.use({ viewport: { width: 1440, height: 1000 } });
for (const motyw of ['light', 'dark'] as const) {
  test('kartka ' + motyw, async ({ page }) => {
    await page.emulateMedia({ colorScheme: motyw });
    await gotowyUklad(page, 'Broń i pancerze');
    await karta(page, 'Miecz').first().click().catch(() => {});
    await page.waitForTimeout(300);
    await page.screenshot({ path: S + '/kartka-' + motyw + '.png' });
    await page.getByRole('button', { name: /Ustawienia/ }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: S + '/ustawienia-' + motyw + '.png' });
  });
  test('szablon ' + motyw, async ({ page }) => {
    await page.emulateMedia({ colorScheme: motyw });
    await kreator(page, { nazwa: 'Test', format: 'Standard / Poker', rogi: 3, uklad: 'Tytuł i opis' });
    await dodaj(page, 'Tekst', 'Opis2');
    await page.getByRole('button', { name: '＋ Dodaj ▾' }).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: S + '/szablon-menu-' + motyw + '.png' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    await page.screenshot({ path: S + '/szablon-' + motyw + '.png' });
  });
}
