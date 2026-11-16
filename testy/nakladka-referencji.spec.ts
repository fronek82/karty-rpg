import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { zbudujArkusz } from '../src/druk/arkusz';
import { scenyDoPdf } from '../src/druk/pdf';
import type { Arkusz } from '../src/model/arkusz';
import type { Szablon, WariantCzcionki } from '../src/model/szablon';
import { arkuszeMausrittera } from '../src/pakiety/mausritter/arkusze';
import { szablonyMausrittera } from '../src/pakiety/mausritter/szablony';
import { OBRAZ_ZASTEPCZY, talieMausrittera } from '../src/pakiety/mausritter/talie';
import { type RejestrCzcionek, wczytajCzcionke } from '../src/silnik/czcionki';
import { rejestrTestowy } from '../src/silnik/__testy__/pomoc';
import { dopasujLinie, linieCiecia, type Dopasowanie } from './nakladka/analiza';

/**
 * E8: nakładka arkuszy na referencję.
 *
 * - Test lokalny: oryginalne arkusze Mausrittera z `zasoby-prywatne/referencje/` (poza
 *   repozytorium) – pomijany, gdy pliku nie ma. Opcjonalnie oryginalne czcionki (nakladka.json).
 * - Autotest (CI): ta sama analiza na referencji syntetycznej – nasz arkusz osadzony w stronie
 *   ze spadem, przeskalowany do 99,89% i przesunięty o znaną wartość.
 *
 * Wynik: dopasowanie linii cięcia (skala i przesunięcie w każdej osi, reszty) oraz obraz nakładki
 * (nasze – niebieskie, referencja – czerwone, wspólne – czarne) w załącznikach raportu.
 */

const PX_NA_MM = 10;
const MM = 72 / 25.4;
/** Najwyżej tyle może odstawać linia po dopasowaniu skali i przesunięcia (jak test geometrii). */
const TOLERANCJA_MM = 0.3;
/** Dopuszczalne odchylenie skali od skali druku oryginału (0,15% ≈ 0,45 mm na 297 mm). */
const TOLERANCJA_SKALI = 0.0015;
/** Po przycięciu do TrimBox obie strony są w tym samym układzie – przesunięcie siatki małe. */
const TOLERANCJA_PRZESUNIECIA_MM = 0.5;
const KATALOG = 'zasoby-prywatne/referencje';

interface Konfiguracja {
  plik: string;
  /** Numer strony (od 1) w pliku referencji dla każdego arkusza. */
  strony: Record<string, number>;
  /** Skala druku oryginału (arkusz w PDF przeskalowany do 99,89% – plan, decyzja 7). */
  skalaDruku: number;
  /** Oryginalne czcionki (ścieżki względem katalogu referencji) i role – nadpisują testowe. */
  czcionki?: { rodzina: string; wariant: WariantCzcionki; plik: string }[];
  role?: Record<string, string>;
}

const DOMYSLNA: Konfiguracja = {
  plik: 'Mausritter_kartyekwipunku.pdf',
  strony: {
    'mausritter-arkusz-bron': 1,
    'mausritter-arkusz-wyposazenie': 2,
    'mausritter-arkusz-stany': 3,
  },
  skalaDruku: 0.9989,
};

/** Konfiguracja z `nakladka.json` (scalana z domyślną; błąd JSON – w testach oryginału). */
function konfiguracja(): Konfiguracja | { blad: string } {
  const plik = join(KATALOG, 'nakladka.json');
  if (!existsSync(plik)) return DOMYSLNA;
  try {
    const k = JSON.parse(readFileSync(plik, 'utf8')) as Partial<Konfiguracja>;
    return { ...DOMYSLNA, ...k, strony: { ...DOMYSLNA.strony, ...k.strony } };
  } catch (e) {
    return { blad: `${plik}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Czcionki testowe (OFL) nadpisane oryginalnymi z konfiguracji; brakujące – zapasowa. */
function rejestr(k: Konfiguracja): RejestrCzcionek {
  const r = rejestrTestowy().ustawZapasowa('EB Garamond');
  for (const c of k.czcionki ?? []) {
    r.dodaj(c.rodzina, c.wariant, wczytajCzcionke(c.plik, readFileSync(join(KATALOG, c.plik))));
  }
  for (const [rola, rodzina] of Object.entries(k.role ?? {})) r.przypiszRole(rola, rodzina);
  return r;
}

async function naszArkusz(arkusz: Arkusz, czcionki: RejestrCzcionek) {
  const talia = talieMausrittera.find((t) => t.id === arkusz.taliaId)!;
  const wynik = zbudujArkusz(arkusz, talia, {
    czcionki,
    szablony: new Map<string, Szablon>(szablonyMausrittera.map((s) => [s.id, s])),
    obraz: (z) => (z === OBRAZ_ZASTEPCZY ? { szerokosc: 512, wysokosc: 512 } : undefined),
  });
  const scena = wynik.strony[0]!;
  const png = readFileSync('src/pakiety/mausritter/obrazy/zastepczy.png');
  const { bajty } = await scenyDoPdf([scena], {
    obraz: (z) => (z === OBRAZ_ZASTEPCZY ? { dane: png, format: 'png' } : undefined),
  });
  return { scena, pdf: bajty };
}

const ADRES = 'http://nakladka.test/';
/** Pliki PDF podawane stronie przez trasę (bez przesyłania megabajtów jako JSON). */
const pliki = new Map<string, Uint8Array>();
async function przygotujStrone(page: Page) {
  const pdfjs = readFileSync('node_modules/pdfjs-dist/build/pdf.min.mjs');
  const worker = readFileSync('node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
  await page.route(`${ADRES}**`, (route) => {
    const sciezka = new URL(route.request().url()).pathname;
    if (sciezka === '/pdf.mjs')
      return route.fulfill({ body: pdfjs, contentType: 'text/javascript' });
    if (sciezka === '/pdf.worker.mjs')
      return route.fulfill({ body: worker, contentType: 'text/javascript' });
    const pdf = pliki.get(sciezka);
    if (pdf) return route.fulfill({ body: Buffer.from(pdf), contentType: 'application/pdf' });
    return route.fulfill({ body: '<!doctype html><body></body>', contentType: 'text/html' });
  });
  await page.goto(ADRES);
  await page.addScriptTag({ url: '/pdf.mjs', type: 'module' });
  await page.waitForFunction(() => 'pdfjsLib' in globalThis);
}

interface Profil {
  szer: number;
  wys: number;
  kolumny: number[];
  wiersze: number[];
}

/**
 * Rasteryzuje stronę PDF (pdf.js) i – gdy podano – przycina do TrimBox (pt, początek w lewym
 * dolnym rogu). Kanwa zostaje w przeglądarce pod nazwą `klucz`; zwraca profile ciemnych pikseli.
 */
async function rasteryzuj(
  page: Page,
  klucz: string,
  pdf: Uint8Array,
  nrStrony: number,
  trim?: { x: number; y: number; width: number; height: number },
): Promise<Profil> {
  const adres = `/${klucz}.pdf`;
  pliki.set(adres, pdf);
  return page.evaluate(
    async ({ klucz, adres, nrStrony, trim, pxNaMm }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = globalThis as any;
      g.pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
      const dok = await g.pdfjsLib.getDocument({ url: adres }).promise;
      const strona = await dok.getPage(nrStrony);
      if (strona.rotate % 360 !== 0) {
        throw new Error(`Strona ${nrStrony} jest obrócona (${strona.rotate}°) – nieobsługiwane.`);
      }
      const s = (pxNaMm * 25.4) / 72;
      const viewport = strona.getViewport({ scale: s });
      const cala = new OffscreenCanvas(Math.round(viewport.width), Math.round(viewport.height));
      const c = cala.getContext('2d')!;
      c.fillStyle = '#fff';
      c.fillRect(0, 0, cala.width, cala.height);
      await strona.render({ canvas: cala, canvasContext: c, viewport }).promise;
      const [vx0, , , vy1] = strona.view as number[];
      const obszar = trim
        ? {
            x: Math.round((trim.x - vx0!) * s),
            y: Math.round((vy1! - (trim.y + trim.height)) * s),
            w: Math.round(trim.width * s),
            h: Math.round(trim.height * s),
          }
        : { x: 0, y: 0, w: cala.width, h: cala.height };
      const kanwa = new OffscreenCanvas(obszar.w, obszar.h);
      const k = kanwa.getContext('2d')!;
      k.fillStyle = '#fff';
      k.fillRect(0, 0, obszar.w, obszar.h);
      k.drawImage(cala, obszar.x, obszar.y, obszar.w, obszar.h, 0, 0, obszar.w, obszar.h);
      (g.kanwy ??= {})[klucz] = kanwa;
      const d = k.getImageData(0, 0, obszar.w, obszar.h).data;
      // Profil ważony ciemnością (255 − jasność): cienkie, wygładzone i szare linie też się liczą.
      const kolumny = new Array<number>(obszar.w).fill(0);
      const wiersze = new Array<number>(obszar.h).fill(0);
      for (let y = 0; y < obszar.h; y++)
        for (let x = 0; x < obszar.w; x++) {
          const i = (y * obszar.w + x) * 4;
          const c = 255 - (d[i]! + d[i + 1]! + d[i + 2]!) / 3;
          kolumny[x]! += c;
          wiersze[y]! += c;
        }
      return { szer: obszar.w, wys: obszar.h, kolumny, wiersze };
    },
    { klucz, adres, nrStrony, trim, pxNaMm: PX_NA_MM },
  );
}

/** Obraz nakładki: referencja przeniesiona do naszych współrzędnych dopasowaniem z obu osi. */
async function obrazNakladki(page: Page, x: Dopasowanie, y: Dopasowanie) {
  return page.evaluate(
    async ({ ax, bx, ay, by, pxNaMm }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const kanwy = (globalThis as any).kanwy as Record<string, OffscreenCanvas>;
      const nasza = kanwy.nasza!;
      const ref = kanwy.referencja!;
      const w = nasza.width;
      const h = nasza.height;
      const przeniesiona = new OffscreenCanvas(w, h);
      const p = przeniesiona.getContext('2d')!;
      p.fillStyle = '#fff';
      p.fillRect(0, 0, w, h);
      p.setTransform(1 / ax, 0, 0, 1 / ay, (-bx * pxNaMm) / ax, (-by * pxNaMm) / ay);
      p.drawImage(ref, 0, 0);
      const a = nasza.getContext('2d')!.getImageData(0, 0, w, h).data;
      const b = p.getImageData(0, 0, w, h).data;
      const wynik = new OffscreenCanvas(w, h);
      const wc = wynik.getContext('2d')!;
      const obraz = wc.createImageData(w, h);
      let nasze = 0;
      let wspolne = 0;
      for (let i = 0; i < a.length; i += 4) {
        const ca = (a[i]! + a[i + 1]! + a[i + 2]!) / 3 < 160;
        const cb = (b[i]! + b[i + 1]! + b[i + 2]!) / 3 < 160;
        const [r, g, bl] =
          ca && cb ? [0, 0, 0] : ca ? [0, 90, 255] : cb ? [230, 0, 0] : [255, 255, 255];
        obraz.data.set([r!, g!, bl!, 255], i);
        if (ca) nasze++;
        if (ca && cb) wspolne++;
      }
      wc.putImageData(obraz, 0, 0);
      const blob = await wynik.convertToBlob({ type: 'image/png' });
      const bajty = new Uint8Array(await blob.arrayBuffer());
      let tekst = '';
      for (let i = 0; i < bajty.length; i += 0x8000)
        tekst += String.fromCharCode(...bajty.subarray(i, i + 0x8000));
      return { png: btoa(tekst), pokrycie: nasze ? wspolne / nasze : 0 };
    },
    { ax: x.a, bx: x.b, ay: y.a, by: y.b, pxNaMm: PX_NA_MM },
  );
}

/** Analiza jednego arkusza: dopasowanie linii i raport w załącznikach testu. */
async function analizuj(
  page: Page,
  info: TestInfo,
  arkusz: Arkusz,
  czcionki: RejestrCzcionek,
  referencja: Uint8Array,
  nrStrony: number,
) {
  const { scena, pdf } = await naszArkusz(arkusz, czcionki);
  const linie = linieCiecia(scena);
  const dok = await PDFDocument.load(referencja);
  // Prostokąt może być zapisany „odwrotnie” (ujemne wymiary) – normalizacja.
  const t = dok.getPage(nrStrony - 1).getTrimBox();
  const trim = {
    x: Math.min(t.x, t.x + t.width),
    y: Math.min(t.y, t.y + t.height),
    width: Math.abs(t.width),
    height: Math.abs(t.height),
  };
  await rasteryzuj(page, 'nasza', pdf, 1);
  const ref = await rasteryzuj(page, 'referencja', referencja, nrStrony, trim);

  const zakres = (v: number[]) => (v.length ? Math.max(...v) - Math.min(...v) : 0);
  // Linia przerywana (kreska 2,3 / przerwa 1,55 mm) pokrywa ~60% długości – próg z zapasem
  // (12% pełnej ciemności na długości siatki).
  const minimum = (dlugosc: number) => 0.12 * dlugosc * PX_NA_MM * 255;
  const x = dopasujLinie(ref.kolumny, PX_NA_MM, linie.pionowe, minimum(zakres(linie.poziome)));
  const y = dopasujLinie(ref.wiersze, PX_NA_MM, linie.poziome, minimum(zakres(linie.pionowe)));
  const nakladka = await obrazNakladki(page, x, y);
  const raport = {
    arkusz: arkusz.id,
    stronaReferencji: nrStrony,
    trimBoxPt: trim,
    // Krok siatki referencji w mm (nasz slot × skala) – do porównania z kartą postaci.
    krokSiatkiMm: { pionowo: 25.75 * x.a, poziomo: 25.75 * y.a },
    brakujaceCzcionki: [...czcionki.brakujace],
    pionowe: x,
    poziome: y,
    pokrycieNaszychPikseli: Math.round(nakladka.pokrycie * 1000) / 1000,
  };
  await info.attach(`${arkusz.id}-nakladka.png`, {
    body: Buffer.from(nakladka.png, 'base64'),
    contentType: 'image/png',
  });
  await info.attach(`${arkusz.id}-raport.json`, {
    body: JSON.stringify(raport, null, 2),
    contentType: 'application/json',
  });
  return { x, y, linie };
}

function sprawdzDopasowanie(
  x: Dopasowanie,
  y: Dopasowanie,
  linie: { pionowe: number[]; poziome: number[] },
  skalaDruku: number,
) {
  // Prawie wszystkie linie znalezione, reszty w tolerancji, skala blisko 1 (druk ~99,89%).
  expect(x.brakujace.length, `brak pionowych: ${x.brakujace.join(', ')}`).toBeLessThanOrEqual(
    Math.floor(linie.pionowe.length * 0.1),
  );
  expect(y.brakujace.length, `brak poziomych: ${y.brakujace.join(', ')}`).toBeLessThanOrEqual(
    Math.floor(linie.poziome.length * 0.1),
  );
  expect(x.maksReszta).toBeLessThan(TOLERANCJA_MM);
  expect(y.maksReszta).toBeLessThan(TOLERANCJA_MM);
  // Krok siatki i marginesy: skala zgodna ze skalą druku oryginału, przesunięcie małe.
  expect(Math.abs(x.a - skalaDruku), `skala pozioma ${x.a}`).toBeLessThan(TOLERANCJA_SKALI);
  expect(Math.abs(y.a - skalaDruku), `skala pionowa ${y.a}`).toBeLessThan(TOLERANCJA_SKALI);
  expect(Math.abs(x.b), `przesunięcie poziome ${x.b} mm`).toBeLessThan(TOLERANCJA_PRZESUNIECIA_MM);
  expect(Math.abs(y.b), `przesunięcie pionowe ${y.b} mm`).toBeLessThan(TOLERANCJA_PRZESUNIECIA_MM);
}

test.describe('nakładka na referencję', () => {
  test.beforeEach(async ({ page }) => przygotujStrone(page));

  for (const arkusz of arkuszeMausrittera) {
    test(`autotest (referencja syntetyczna): ${arkusz.nazwa}`, async ({ page }, info) => {
      const { pdf } = await naszArkusz(arkusz, rejestrTestowy());
      // Strona 306 × 228 mm, TrimBox = A4 poziomo 4,5 mm od lewej i 9 mm od dołu (jak oryginał),
      // treść przeskalowana do 99,89% i przesunięta o znaną wartość.
      const SKALA = 0.9989;
      const PRZES = { x: 0.4, y: 0.3 };
      const ref = await PDFDocument.create();
      const [osadzona] = await ref.embedPdf(pdf, [0]);
      const strona = ref.addPage([306 * MM, 228 * MM]);
      const trim = { x: 4.5 * MM, y: 9 * MM, w: 297 * MM, h: 210 * MM };
      strona.setTrimBox(trim.x, trim.y, trim.w, trim.h);
      strona.drawPage(osadzona!, {
        x: trim.x + PRZES.x * MM,
        y: trim.y + trim.h - osadzona!.height * SKALA - PRZES.y * MM,
        xScale: SKALA,
        yScale: SKALA,
      });
      const czcionki = rejestrTestowy();
      const { x, y, linie } = await analizuj(page, info, arkusz, czcionki, await ref.save(), 1);
      sprawdzDopasowanie(x, y, linie, SKALA);
      expect(x.b).toBeCloseTo(PRZES.x, 1);
      expect(y.b).toBeCloseTo(PRZES.y, 1);
      expect(x.maksReszta).toBeLessThan(0.08);
      expect(y.maksReszta).toBeLessThan(0.08);
    });
  }

  test('autotest: siatka o złym kroku (99,3%) jest wykrywana', async ({ page }, info) => {
    const arkusz = arkuszeMausrittera[0]!;
    const { pdf } = await naszArkusz(arkusz, rejestrTestowy());
    const ref = await PDFDocument.create();
    const [osadzona] = await ref.embedPdf(pdf, [0]);
    const strona = ref.addPage([297 * MM, 210 * MM]);
    strona.drawPage(osadzona!, { x: 0, y: 210 * MM * (1 - 0.993), xScale: 0.993, yScale: 0.993 });
    const { x } = await analizuj(page, info, arkusz, rejestrTestowy(), await ref.save(), 1);
    // Reszty są małe (siatka regularna), ale skala odbiega od skali druku – test oryginału padnie.
    expect(x.maksReszta).toBeLessThan(TOLERANCJA_MM);
    expect(Math.abs(x.a - 0.9989)).toBeGreaterThan(TOLERANCJA_SKALI);
  });

  const k = konfiguracja();
  const plik = 'blad' in k ? '' : join(KATALOG, k.plik);
  for (const arkusz of arkuszeMausrittera) {
    test(`oryginał: ${arkusz.nazwa}`, async ({ page }, info) => {
      if ('blad' in k) throw new Error(`Niepoprawny nakladka.json – ${k.blad}`);
      test.skip(!existsSync(plik), `brak ${plik} – test tylko lokalny (pliki poza repozytorium)`);
      const nr = k.strony[arkusz.id];
      test.skip(nr === undefined, `brak numeru strony dla ${arkusz.id} w nakladka.json`);
      const { x, y, linie } = await analizuj(
        page,
        info,
        arkusz,
        rejestr(k),
        readFileSync(plik),
        nr!,
      );
      sprawdzDopasowanie(x, y, linie, k.skalaDruku);
    });
  }
});
