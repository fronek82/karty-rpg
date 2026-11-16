import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { zbudujArkusz } from '../src/druk/arkusz';
import type { Szablon } from '../src/model/szablon';
import { arkuszeMausrittera } from '../src/pakiety/mausritter/arkusze';
import { szablonyMausrittera } from '../src/pakiety/mausritter/szablony';
import { OBRAZ_ZASTEPCZY, talieMausrittera } from '../src/pakiety/mausritter/talie';
import { scenaDoSvg } from '../src/silnik/svg';
import { rejestrTestowy } from '../src/silnik/__testy__/pomoc';

/** Test wizualny arkuszy A4 pakietu Mausritter (cała strona, ta sama scena co w PDF). */

const ctx = {
  czcionki: rejestrTestowy(),
  szablony: new Map<string, Szablon>(szablonyMausrittera.map((s) => [s.id, s])),
  obraz: (z: string) => (z === OBRAZ_ZASTEPCZY ? { szerokosc: 512, wysokosc: 512 } : undefined),
};
const zastepczy =
  'data:image/png;base64,' +
  readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png').toString('base64');

for (const arkusz of arkuszeMausrittera) {
  test(`arkusz: ${arkusz.nazwa}`, async ({ page }) => {
    const talia = talieMausrittera.find((t) => t.id === arkusz.taliaId)!;
    const wynik = zbudujArkusz(arkusz, talia, ctx);
    expect(wynik.ostrzezenia).toEqual([]);
    expect(wynik.strony).toHaveLength(1);
    const [scena] = wynik.strony;
    const PX_NA_MM = 6;
    const svg = scenaDoSvg(scena!, { adresObrazu: () => zastepczy }).replace(
      /width="[\d.]+mm" height="[\d.]+mm"/,
      `width="${Math.round(scena!.szer * PX_NA_MM)}" height="${Math.round(scena!.wys * PX_NA_MM)}"`,
    );
    await page.setContent(`<body style="margin:0;background:#fff">${svg}</body>`);
    await expect(page.locator('svg')).toHaveScreenshot(`${arkusz.id}.png`, {
      maxDiffPixelRatio: 0.001,
    });
  });
}
