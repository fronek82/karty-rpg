import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { pt } from '../src/model/jednostki';
import type { Karta, Szablon } from '../src/model/szablon';
import { szablonyMausrittera } from '../src/pakiety/mausritter/szablony';
import {
  OBRAZ_ZASTEPCZY,
  taliaBroni,
  taliaStanow,
  taliaWyposazenia,
} from '../src/pakiety/mausritter/talie';
import { renderujKarte } from '../src/silnik/karta';
import {
  polaczGlify,
  type DefinicjaGlifu,
  type ElementSceny,
  type Scena,
} from '../src/silnik/scena';
import { scenaDoSvg } from '../src/silnik/svg';
import { rejestrTestowy } from '../src/silnik/__testy__/pomoc';

/**
 * Galeria wszystkich typów kart pakietu Mausritter – test wizualny szablonów.
 * Cała galeria to jedna scena (także podpisy), więc obraz nie zależy od czcionek systemu.
 */

const czcionki = rejestrTestowy();
const szablony = new Map<string, Szablon>(szablonyMausrittera.map((s) => [s.id, s]));
const ctx = {
  czcionki,
  obraz: (z: string) => (z === OBRAZ_ZASTEPCZY ? { szerokosc: 512, wysokosc: 512 } : undefined),
};
const zastepczy =
  'data:image/png;base64,' +
  readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png').toString('base64');

const podpis: Szablon = {
  id: 'podpis',
  nazwa: 'Podpis',
  rozmiar: { tryb: 'mm', szerokosc: 200, wysokosc: 7 },
  korzen: {
    id: 'k',
    typ: 'kolumna',
    dzieci: [
      {
        id: 't',
        typ: 'tekst',
        klucz: 't',
        styl: { czcionka: 'tresc', wariant: 'pogrubiony', rozmiar: pt(11), kolor: '#555555' },
      },
    ],
  },
};

const znajdz = (karty: Karta[], warunek: (k: Karta) => boolean) => karty.find(warunek)!;
const nazwa = (karty: Karta[], n: string) => znajdz(karty, (k) => k.dane.nazwa === n);
const b = taliaBroni.karty;
const w = taliaWyposazenia.karty;
const s = taliaStanow.karty;

const RZEDY: { tytul: string; karty: Karta[] }[] = [
  {
    tytul: 'Broń i pancerze',
    karty: [
      nazwa(b, 'Igła'),
      nazwa(b, 'Kiścień'),
      znajdz(b, (k) => k.dane.klasa === 'Improwizowana'),
      znajdz(b, (k) => !k.dane.nazwa && k.dane.klasa === 'Lekka dystansowa'),
      nazwa(b, 'Strzały'),
      nazwa(b, 'Młot bojowy'),
      nazwa(b, 'Łuk'),
      nazwa(b, 'Ciężka zbroja'),
      nazwa(b, 'Lekka zbroja'),
    ],
  },
  {
    tytul: 'Niezbędne wyposażenie',
    karty: [
      nazwa(w, 'Pochodnie'),
      nazwa(w, 'Latarnia elektr.'),
      nazwa(w, 'Sakiewka'),
      znajdz(w, (k) => k.szablonId === 'mausritter-zaklecie'),
      znajdz(w, (k) => k.szablonId === 'mausritter-pusta' && !k.rozmiar),
      znajdz(w, (k) => k.szablonId === 'mausritter-pusta' && !!k.rozmiar),
    ],
  },
  { tytul: 'Stany', karty: s },
];

function galeria(): Scena {
  const ODSTEP = 4;
  const elementy: ElementSceny[] = [];
  const glify: Record<string, DefinicjaGlifu>[] = [];
  let y = 4;
  let szerokosc = 0;
  for (const rzad of RZEDY) {
    const p = renderujKarte(podpis, { dane: { t: rzad.tytul } }, { czcionki }).scena;
    glify.push(p.glify);
    elementy.push({ typ: 'grupa', x: 4, y, elementy: p.elementy });
    y += 8;
    let x = 4;
    let wys = 0;
    for (const k of rzad.karty) {
      const { scena, ostrzezenia } = renderujKarte(szablony.get(k.szablonId)!, k, ctx);
      expect(ostrzezenia).toEqual([]);
      glify.push(scena.glify);
      elementy.push({
        typ: 'grupa',
        x,
        y,
        elementy: [
          ...scena.elementy,
          {
            typ: 'prostokat',
            x: 0,
            y: 0,
            szer: scena.szer,
            wys: scena.wys,
            obrys: { kolor: '#9a9a9a', grubosc: 0.2, kreska: [1, 0.7] },
          },
        ],
      });
      x += scena.szer + ODSTEP;
      wys = Math.max(wys, scena.wys);
    }
    szerokosc = Math.max(szerokosc, x);
    y += wys + ODSTEP + 2;
  }
  return {
    szer: szerokosc,
    wys: y,
    elementy: [
      { typ: 'prostokat', x: 0, y: 0, szer: szerokosc, wys: y, wypelnienie: '#ffffff' },
      ...elementy,
    ],
    glify: polaczGlify(...glify),
  };
}

test('galeria kart Mausrittera', async ({ page }) => {
  const scena = galeria();
  const PX_NA_MM = 8;
  const svg = scenaDoSvg(scena, { adresObrazu: () => zastepczy }).replace(
    /width="[\d.]+mm" height="[\d.]+mm"/,
    `width="${Math.round(scena.szer * PX_NA_MM)}" height="${Math.round(scena.wys * PX_NA_MM)}"`,
  );
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  const obraz = page.locator('svg');
  if (process.env.ZAPISZ_GALERIE) await obraz.screenshot({ path: process.env.ZAPISZ_GALERIE });
  await expect(obraz).toHaveScreenshot('galeria-mausritter.png', { maxDiffPixelRatio: 0.001 });
});
