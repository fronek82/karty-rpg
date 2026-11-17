import type { WynikArkusza } from '../../druk/arkusz';
import type { Mm } from '../../model/jednostki';

/**
 * Geometria warstwy edytora nad stroną kartki: prostokąty slotów i kart w procentach strony
 * (działają w każdej skali podglądu) oraz slot pod wskazanym punktem strony (mm).
 */
export type Geometria = Pick<
  WynikArkusza,
  'poczatekSiatki' | 'slot' | 'siatka' | 'odstepKolumny' | 'odstepRzedu' | 'odstep'
> & { szer: Mm; wys: Mm };

export function geometria(w: WynikArkusza): Geometria | undefined {
  const s = w.strony[0];
  if (!s) return undefined;
  return {
    poczatekSiatki: w.poczatekSiatki,
    slot: w.slot,
    siatka: w.siatka,
    odstepKolumny: w.odstepKolumny,
    odstepRzedu: w.odstepRzedu,
    odstep: w.odstep,
    szer: s.szer,
    wys: s.wys,
  };
}

/** Lewy górny róg slotu (mm od rogu strony). */
export function rogSlotu(g: Geometria, strona: number, kolumna: number, rzad: number) {
  return {
    x: g.poczatekSiatki.x + g.odstepKolumny(strona, kolumna) + kolumna * g.slot.szerokosc,
    y: g.poczatekSiatki.y + rzad * g.slot.wysokosc + g.odstepRzedu(rzad),
  };
}

const proc = (v: number) => `${Math.round(v * 10000) / 10000}%`;

/** Styl prostokąta (left/top/width/height w %) dla slotów od (kolumna, rząd), rozmiar w slotach. */
export function stylProstokata(
  g: Geometria,
  strona: number,
  kolumna: number,
  rzad: number,
  kolumny = 1,
  rzedy = 1,
) {
  const r = rogSlotu(g, strona, kolumna, rzad);
  return {
    left: proc((r.x / g.szer) * 100),
    top: proc((r.y / g.wys) * 100),
    width: proc(((kolumny * g.slot.szerokosc + (kolumny - 1) * g.odstep.x) / g.szer) * 100),
    height: proc(((rzedy * g.slot.wysokosc + (rzedy - 1) * g.odstep.y) / g.wys) * 100),
  };
}

/** Styl dowolnego prostokąta w mm (np. nagłówek grupy). */
export function stylMm(g: Geometria, x: Mm, y: Mm, szer: Mm, wys: Mm) {
  return {
    left: proc((x / g.szer) * 100),
    top: proc((y / g.wys) * 100),
    width: proc((szer / g.szer) * 100),
    height: proc((wys / g.wys) * 100),
  };
}

/**
 * Slot pod punktem (mm od rogu strony); poza siatką – najbliższy w jej granicach, gdy
 * `przytnij`, inaczej undefined. Uwzględnia odstępy grup i własnego układu (punkt w odstępie –
 * undefined).
 */
export function slotPodPunktem(
  g: Geometria,
  strona: number,
  x: Mm,
  y: Mm,
  przytnij = false,
): { kolumna: number; rzad: number } | undefined {
  let kolumna: number | undefined;
  for (let k = 0; k < g.siatka.kolumny; k++) {
    const x0 = rogSlotu(g, strona, k, 0).x;
    if (x >= x0 && x < x0 + g.slot.szerokosc) kolumna = k;
  }
  let rzad: number | undefined;
  for (let r = 0; r < g.siatka.rzedy; r++) {
    const y0 = rogSlotu(g, strona, 0, r).y;
    if (y >= y0 && y < y0 + g.slot.wysokosc) rzad = r;
  }
  if (przytnij) {
    if (g.siatka.kolumny < 1 || g.siatka.rzedy < 1) return undefined;
    if (kolumna === undefined) {
      kolumna = 0;
      for (let k = 0; k < g.siatka.kolumny; k++) if (rogSlotu(g, strona, k, 0).x <= x) kolumna = k;
    }
    if (rzad === undefined) {
      rzad = 0;
      for (let r = 0; r < g.siatka.rzedy; r++) if (rogSlotu(g, strona, 0, r).y <= y) rzad = r;
    }
  }
  return kolumna === undefined || rzad === undefined ? undefined : { kolumna, rzad };
}
