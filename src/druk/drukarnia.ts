import type { Mm } from '../model/jednostki';
import type { ElementSceny, Scena } from '../silnik/scena';
import type { Odcinek } from './pasy';

/**
 * Geometria trybu drukarni (M4-5): rozróżnienie formatu netto karty, obszaru brutto ze spadem
 * oraz znaczników cięcia. Czyste funkcje w mm – wspólne dla podglądu SVG, PDF i eksportu obrazów.
 */

/** Odsunięcie początku znacznika cięcia od zewnętrznej krawędzi spadu (mm) – kreski nie wchodzą w spad. */
export const ZNACZNIK_ODSUNIECIE: Mm = 1;
/** Długość pojedynczej kreski znacznika cięcia (mm). */
export const ZNACZNIK_DLUGOSC: Mm = 4;
/** Grubość kreski znacznika cięcia (mm). */
export const ZNACZNIK_GRUBOSC: Mm = 0.2;
/** Kolor znaczników cięcia. */
export const ZNACZNIK_KOLOR = '#000000';
/** Dodatkowy zewnętrzny margines strony pojedynczej karty poza końcem znaczników (mm). */
export const MARGINES_POJEDYNCZEJ: Mm = 2;

const nieujemne = (v: Mm): Mm => (Number.isFinite(v) && v > 0 ? v : 0);

/**
 * Rezerwa z każdej strony formatu netto karty (mm) potrzebna, aby spad i ewentualne znaczniki
 * cięcia zmieściły się w całości na papierze.
 */
export function rezerwaZnacznika(spad: Mm, znacznikiCiecia: boolean): Mm {
  const s = nieujemne(spad);
  return znacznikiCiecia ? s + ZNACZNIK_ODSUNIECIE + ZNACZNIK_DLUGOSC : s;
}

/**
 * Minimalny odstęp między krawędziami netto sąsiednich kart w trybie drukarni (mm).
 * Bez znaczników: `2 × spad` (obszary brutto stykają się bez nakładania).
 * Ze znacznikami: `2 × spad + 2 × odsunięcie + długość` – znaczniki między sąsiednimi kartami
 * nakładają się w jedną wspólną kreskę z zachowaniem pełnego odsunięcia od obu spadów.
 */
export function odstepMiedzyKartamiDrukarni(spad: Mm, znacznikiCiecia: boolean): Mm {
  const s = nieujemne(spad);
  return znacznikiCiecia ? 2 * s + 2 * ZNACZNIK_ODSUNIECIE + ZNACZNIK_DLUGOSC : 2 * s;
}

/**
 * Odległość od krawędzi strony pojedynczej karty do formatu netto karty (mm).
 * Bez znaczników: równa spadowi (strona = czysty format brutto `netto + 2 × spad`).
 * Ze znacznikami: `spad + odsunięcie + długość + margines zewnętrzny`.
 */
export function marginesPojedynczejKarty(spad: Mm, znacznikiCiecia: boolean): Mm {
  const s = nieujemne(spad);
  return znacznikiCiecia ? s + ZNACZNIK_ODSUNIECIE + ZNACZNIK_DLUGOSC + MARGINES_POJEDYNCZEJ : s;
}

/** Wymiary strony pojedynczej karty oraz położenie lewego górnego rogu formatu netto (mm). */
export function rozmiarStronyPojedynczejKarty(
  karta: { szer: Mm; wys: Mm },
  spad: Mm,
  znacznikiCiecia: boolean,
): { szer: Mm; wys: Mm; x: Mm; y: Mm } {
  const m = marginesPojedynczejKarty(spad, znacznikiCiecia);
  return {
    szer: karta.szer + 2 * m,
    wys: karta.wys + 2 * m,
    x: m,
    y: m,
  };
}

/**
 * Odcinki znaczników cięcia (po 8 na kartę – 2 w każdym rogu formatu netto),
 * odsunięte poza obszar brutto (`spad + ZNACZNIK_ODSUNIECIE`). Pokrywające się odcinki
 * między sąsiednimi kartami są scalane w jeden odcinek; wynik jest deterministycznie posortowany.
 */
export function odcinkiZnacznikowCiecia(
  karty: readonly { x: Mm; y: Mm; szer: Mm; wys: Mm }[],
  spad: Mm,
): Odcinek[] {
  const od = nieujemne(spad) + ZNACZNIK_ODSUNIECIE;
  const dl = ZNACZNIK_DLUGOSC;
  const mapa = new Map<string, Odcinek>();
  const r = (v: number) => Math.round(v * 1000);
  const dodaj = (x1: Mm, y1: Mm, x2: Mm, y2: Mm) => {
    const a =
      x1 < x2 || (x1 === x2 && y1 <= y2) ? { x1, y1, x2, y2 } : { x1: x2, y1: y2, x2: x1, y2: y1 };
    const klucz = `${r(a.x1)},${r(a.y1)},${r(a.x2)},${r(a.y2)}`;
    if (!mapa.has(klucz)) mapa.set(klucz, a);
  };
  for (const k of karty) {
    const xL = k.x;
    const xP = k.x + k.szer;
    const yG = k.y;
    const yD = k.y + k.wys;
    // Poziome kreski na wysokości górnej i dolnej krawędzi netto.
    dodaj(xL - od - dl, yG, xL - od, yG);
    dodaj(xP + od, yG, xP + od + dl, yG);
    dodaj(xL - od - dl, yD, xL - od, yD);
    dodaj(xP + od, yD, xP + od + dl, yD);
    // Pionowe kreski na linii lewej i prawej krawędzi netto.
    dodaj(xL, yG - od - dl, xL, yG - od);
    dodaj(xL, yD + od, xL, yD + od + dl);
    dodaj(xP, yG - od - dl, xP, yG - od);
    dodaj(xP, yD + od, xP, yD + od + dl);
  }
  return [...mapa.values()].sort(
    (a, b) => a.y1 - b.y1 || a.x1 - b.x1 || a.y2 - b.y2 || a.x2 - b.x2,
  );
}

/** Elementy sceny (linie ciągłe) dla znaczników cięcia kart. */
export function elementyZnacznikowCiecia(
  karty: readonly { x: Mm; y: Mm; szer: Mm; wys: Mm }[],
  spad: Mm,
): ElementSceny[] {
  const obrys = { kolor: ZNACZNIK_KOLOR, grubosc: ZNACZNIK_GRUBOSC };
  return odcinkiZnacznikowCiecia(karty, spad).map((o) => ({ typ: 'linia', ...o, obrys }));
}

/**
 * Buduje kompletną scenę strony pojedynczej karty w trybie drukarni (ze spadem i opcjonalnymi
 * znacznikami cięcia). Wspólna dla arkusza w układzie „pojedyncza” oraz eksportu kart osobno.
 */
export function zbudujStronePojedynczejKarty(
  scenaKarty: Scena,
  opcje: { spad: Mm; znacznikiCiecia: boolean },
): Scena {
  const spad = nieujemne(opcje.spad);
  const strona = rozmiarStronyPojedynczejKarty(
    { szer: scenaKarty.szer, wys: scenaKarty.wys },
    spad,
    opcje.znacznikiCiecia,
  );
  const elementy: ElementSceny[] = [
    { typ: 'grupa', x: strona.x, y: strona.y, elementy: scenaKarty.elementy },
  ];
  if (opcje.znacznikiCiecia) {
    elementy.push(
      ...elementyZnacznikowCiecia(
        [{ x: strona.x, y: strona.y, szer: scenaKarty.szer, wys: scenaKarty.wys }],
        spad,
      ),
    );
  }
  return {
    szer: strona.szer,
    wys: strona.wys,
    elementy,
    glify: scenaKarty.glify,
    ...(scenaKarty.symbole ? { symbole: scenaKarty.symbole } : {}),
  };
}
