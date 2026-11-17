import type { Mm } from '../model/jednostki';
import type { OzdobaRamka9 } from '../model/szablon';
import type { DefinicjaSymbolu, ElementSceny } from '../silnik/scena';
import { znajdzElement } from './katalog';
import { symbolZElementu } from './narozniki';
import type { ElementOzdobny, UstawieniaRamki9 } from './typy';

/**
 * Ramka 9-slice (SPEC 5 pkt 4): dziewięć kawałków źródła (PNG albo rysunek SVG) – cztery rogi
 * skalowane jednakowo, cztery boki rozciągnięte albo powtórzone równo, środek wypełniony albo
 * pominięty. Geometria to czyste funkcje w mm, wspólne dla podglądu SVG i PDF (jedna scena).
 */

/** O ile sąsiednie kawałki zachodzą na siebie (mm) – likwiduje szwy od antyaliasingu. */
export const NAKLADKA_KAWALKOW: Mm = 0.05;
/** Najmniejsza rozdzielczość rogów PNG bez ostrzeżenia (SPEC 10). */
export const MIN_DPI_RAMKI = 300;

interface Prostokat {
  x: number;
  y: number;
  szer: number;
  wys: number;
}

export type RolaKawalka = 'srodek' | 'gora' | 'prawy' | 'dol' | 'lewy' | 'naroznik';

export interface Kawalek {
  rola: RolaKawalka;
  /** Prostokąt źródła w jednostkach źródła (piksele PNG albo jednostki rysunku SVG). */
  zrodlo: Prostokat;
  /** Prostokąt docelowy w mm (bez zakładki). */
  cel: Prostokat;
  /** Obszar przycięcia w mm: `cel` poszerzony o połowę zakładki z każdej strony, na której leży sąsiad. */
  przyciecie: Prostokat;
}

export interface GeometriaRamki9 {
  /** mm na jednostkę źródła przy rogach (0, gdy wszystkie wcięcia są zerowe). */
  skala: number;
  /** Kolejność rysowania: środek, boki, rogi (rogi na wierzchu). */
  kawalki: Kawalek[];
}

const EPS = 1e-6;
const klamra = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

/** Wcięcia sprowadzone do źródła: nieujemne, a lewe + prawe i górne + dolne nie większe od wymiaru. */
export function przytnijWciecia(
  w: UstawieniaRamki9['wciecia'],
  szer: number,
  wys: number,
): UstawieniaRamki9['wciecia'] {
  const lewo = klamra(w.lewo, 0, szer);
  const prawo = klamra(w.prawo, 0, szer - lewo);
  const gora = klamra(w.gora, 0, wys);
  const dol = klamra(w.dol, 0, wys - gora);
  return { gora, prawo, dol, lewo };
}

/**
 * Liczba kawałków boku i krok: `rozciagnij` – jeden; `powtarzaj` – `max(1, round(rozpiętość / naturalna))`
 * kawałków równej długości (jak kafelki motywu).
 */
export function podzialBoku(
  rozpietosc: Mm,
  naturalna: Mm,
  tryb: UstawieniaRamki9['boki'],
): { n: number; krok: Mm } {
  if (!(rozpietosc > EPS)) return { n: 0, krok: 0 };
  if (tryb === 'rozciagnij' || !(naturalna > EPS)) return { n: 1, krok: rozpietosc };
  const n = Math.max(1, Math.round(rozpietosc / naturalna));
  return { n, krok: rozpietosc / n };
}

/**
 * Kawałki ramki 9-slice dla `obszar` (mm). `szer` × `wys` to wymiary źródła. Skala rogów:
 * najgrubszy bok ma `grubosc` mm (wszystkie rogi i boki skalowane tak samo); gdy rogi nie mieszczą
 * się w obszarze, skala jest zmniejszona, aż się zmieszczą.
 */
export function kawalkiRamki9(
  ust: Pick<UstawieniaRamki9, 'wciecia' | 'boki' | 'srodek'>,
  szer: number,
  wys: number,
  obszar: Prostokat,
  grubosc: Mm,
): GeometriaRamki9 {
  if (!(szer > 0) || !(wys > 0) || !(obszar.szer > 0) || !(obszar.wys > 0) || !(grubosc > 0))
    return { skala: 0, kawalki: [] };
  const w = przytnijWciecia(ust.wciecia, szer, wys);
  const najgrubsze = Math.max(w.gora, w.prawo, w.dol, w.lewo);
  let s = najgrubsze > 0 ? grubosc / najgrubsze : 0;
  if (w.lewo + w.prawo > 0) s = Math.min(s, obszar.szer / (w.lewo + w.prawo));
  if (w.gora + w.dol > 0) s = Math.min(s, obszar.wys / (w.gora + w.dol));

  const dl = w.lewo * s;
  const dp = w.prawo * s;
  const dg = w.gora * s;
  const dd = w.dol * s;
  const x0 = obszar.x + dl;
  const y0 = obszar.y + dg;
  const rozpW = obszar.szer - dl - dp;
  const rozpH = obszar.wys - dg - dd;
  const zrodloSrodkaW = szer - w.lewo - w.prawo;
  const zrodloSrodkaH = wys - w.gora - w.dol;

  const kawalki: Omit<Kawalek, 'przyciecie'>[] = [];
  if (
    ust.srodek === 'wypelnij' &&
    zrodloSrodkaW > 0 &&
    zrodloSrodkaH > 0 &&
    rozpW > EPS &&
    rozpH > EPS
  )
    kawalki.push({
      rola: 'srodek',
      zrodlo: { x: w.lewo, y: w.gora, szer: zrodloSrodkaW, wys: zrodloSrodkaH },
      cel: { x: x0, y: y0, szer: rozpW, wys: rozpH },
    });

  // Boki poziome (góra, dół).
  if (zrodloSrodkaW > 0) {
    const { n, krok } = podzialBoku(rozpW, zrodloSrodkaW * s, ust.boki);
    for (let i = 0; i < n; i++) {
      if (dg > EPS)
        kawalki.push({
          rola: 'gora',
          zrodlo: { x: w.lewo, y: 0, szer: zrodloSrodkaW, wys: w.gora },
          cel: { x: x0 + i * krok, y: obszar.y, szer: krok, wys: dg },
        });
      if (dd > EPS)
        kawalki.push({
          rola: 'dol',
          zrodlo: { x: w.lewo, y: wys - w.dol, szer: zrodloSrodkaW, wys: w.dol },
          cel: { x: x0 + i * krok, y: obszar.y + obszar.wys - dd, szer: krok, wys: dd },
        });
    }
  }
  // Boki pionowe (lewy, prawy).
  if (zrodloSrodkaH > 0) {
    const { n, krok } = podzialBoku(rozpH, zrodloSrodkaH * s, ust.boki);
    for (let i = 0; i < n; i++) {
      if (dl > EPS)
        kawalki.push({
          rola: 'lewy',
          zrodlo: { x: 0, y: w.gora, szer: w.lewo, wys: zrodloSrodkaH },
          cel: { x: obszar.x, y: y0 + i * krok, szer: dl, wys: krok },
        });
      if (dp > EPS)
        kawalki.push({
          rola: 'prawy',
          zrodlo: { x: szer - w.prawo, y: w.gora, szer: w.prawo, wys: zrodloSrodkaH },
          cel: { x: obszar.x + obszar.szer - dp, y: y0 + i * krok, szer: dp, wys: krok },
        });
    }
  }
  // Rogi.
  const rog = (
    zx: number,
    zy: number,
    zs: number,
    zw: number,
    cx: number,
    cy: number,
    cs: number,
    cw: number,
  ) => {
    if (zs > 0 && zw > 0 && cs > EPS && cw > EPS)
      kawalki.push({
        rola: 'naroznik',
        zrodlo: { x: zx, y: zy, szer: zs, wys: zw },
        cel: { x: cx, y: cy, szer: cs, wys: cw },
      });
  };
  const xp = obszar.x + obszar.szer - dp;
  const yd = obszar.y + obszar.wys - dd;
  rog(0, 0, w.lewo, w.gora, obszar.x, obszar.y, dl, dg);
  rog(szer - w.prawo, 0, w.prawo, w.gora, xp, obszar.y, dp, dg);
  rog(0, wys - w.dol, w.lewo, w.dol, obszar.x, yd, dl, dd);
  rog(szer - w.prawo, wys - w.dol, w.prawo, w.dol, xp, yd, dp, dd);

  // Przycięcie: zakładka tylko po stronach, na których coś sąsiaduje.
  const p = NAKLADKA_KAWALKOW / 2;
  const nakladaSie = (a0: number, a1: number, b0: number, b1: number) =>
    Math.min(a1, b1) - Math.max(a0, b0) > EPS;
  const sasiad = (k: Omit<Kawalek, 'przyciecie'>, strona: 'l' | 'p' | 'g' | 'd') =>
    kawalki.some((m) => {
      if (m === k) return false;
      const a = k.cel;
      const b = m.cel;
      switch (strona) {
        case 'l':
          return (
            Math.abs(b.x + b.szer - a.x) < EPS && nakladaSie(a.y, a.y + a.wys, b.y, b.y + b.wys)
          );
        case 'p':
          return (
            Math.abs(b.x - (a.x + a.szer)) < EPS && nakladaSie(a.y, a.y + a.wys, b.y, b.y + b.wys)
          );
        case 'g':
          return (
            Math.abs(b.y + b.wys - a.y) < EPS && nakladaSie(a.x, a.x + a.szer, b.x, b.x + b.szer)
          );
        default:
          return (
            Math.abs(b.y - (a.y + a.wys)) < EPS && nakladaSie(a.x, a.x + a.szer, b.x, b.x + b.szer)
          );
      }
    });
  const wynik: Kawalek[] = kawalki.map((k) => {
    const l = sasiad(k, 'l') ? p : 0;
    const pr = sasiad(k, 'p') ? p : 0;
    const g = sasiad(k, 'g') ? p : 0;
    const d = sasiad(k, 'd') ? p : 0;
    return {
      ...k,
      przyciecie: {
        x: k.cel.x - l,
        y: k.cel.y - g,
        szer: k.cel.szer + l + pr,
        wys: k.cel.wys + g + d,
      },
    };
  });
  // Kolejność rysowania: środek, boki, rogi.
  const waga = (k: Kawalek) => (k.rola === 'srodek' ? 0 : k.rola === 'naroznik' ? 2 : 1);
  wynik.sort((a, b) => waga(a) - waga(b));
  return { skala: s, kawalki: wynik };
}

/** Rozdzielczość rogów PNG (dpi) przy skali `mmNaPiksel`; 0 – brak rogów (nie dotyczy). */
export const dpiRogow = (mmNaPiksel: number): number =>
  mmNaPiksel > 0 ? 25.4 / mmNaPiksel : Infinity;

export interface WynikRamki9 {
  elementy: ElementSceny[];
  symbole: Record<string, DefinicjaSymbolu>;
  /** Identyfikator nieznanego elementu (albo elementu o złym rodzaju / bez ustawień). */
  nieznany?: string;
  /** Zasób PNG, którego brakuje w bibliotece obrazów. */
  brakObrazu?: string;
  /** Rozdzielczość rogów (dpi), gdy źródło to PNG i rogi istnieją. */
  dpi?: number;
}

/** Przekształcenie mapujące źródło `zr` na prostokąt `cel` (źródło o początku w (0, 0)). */
function mapowanie(zr: Prostokat, cel: Prostokat) {
  const kx = cel.szer / zr.szer;
  const ky = cel.wys / zr.wys;
  return { kx, ky, ex: cel.x - zr.x * kx, ey: cel.y - zr.y * ky };
}

/**
 * Ramka 9-slice na `obszar`. PNG: każdy kawałek to element `obraz` (całe źródło ustawione tak, by
 * odpowiedni fragment trafił w `cel`) z przycięciem – w PDF jeden obraz używany wielokrotnie.
 * SVG: `grupa` z macierzą i przycięciem wokół symbolu elementu (jeden XObject).
 */
export function ramka9ZElementu(
  o: OzdobaRamka9,
  obszar: Prostokat,
  opcje: {
    wlasne?: readonly ElementOzdobny[];
    /** Czy zasób obrazu istnieje w bibliotece projektu. */
    maObraz?: (zasob: string) => boolean;
  } = {},
): WynikRamki9 {
  const e = znajdzElement(o.element, opcje.wlasne);
  const u = e?.rodzaj === 'ramka9' ? e.ramka9 : undefined;
  if (!e || !u) return { elementy: [], symbole: {}, nieznany: o.element };
  const obrazZrodlo = u.zrodlo.typ === 'obraz' ? u.zrodlo.zasob : undefined;
  if (obrazZrodlo !== undefined && !opcje.maObraz?.(obrazZrodlo))
    return { elementy: [], symbole: {}, brakObrazu: obrazZrodlo };
  const g = kawalkiRamki9(u, e.szer, e.wys, obszar, o.grubosc);
  const elementy: ElementSceny[] = [];
  for (const k of g.kawalki) {
    const m = mapowanie(k.zrodlo, k.cel);
    if (obrazZrodlo !== undefined) {
      elementy.push({
        typ: 'obraz',
        zasob: obrazZrodlo,
        x: m.ex,
        y: m.ey,
        szer: e.szer * m.kx,
        wys: e.wys * m.ky,
        przyciecie: k.przyciecie,
      });
    } else {
      elementy.push({
        typ: 'grupa',
        x: 0,
        y: 0,
        macierz: [m.kx, 0, 0, m.ky, m.ex, m.ey],
        przyciecie: k.przyciecie,
        elementy: [
          {
            typ: 'symbol',
            klucz: e.id,
            macierz: [1, 0, 0, 1, 0, 0],
            ...(o.kolor !== undefined ? { kolor: o.kolor } : {}),
          },
        ],
      });
    }
  }
  return {
    elementy,
    symbole: obrazZrodlo === undefined && elementy.length > 0 ? { [e.id]: symbolZElementu(e) } : {},
    ...(obrazZrodlo !== undefined && g.skala > 0 ? { dpi: dpiRogow(g.skala) } : {}),
  };
}
