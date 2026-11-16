import type { WynikArkusza } from '../../druk/arkusz';
import type { Mm } from '../../model/jednostki';

/**
 * Geometria warstwy edytora nad stroną kartki: prostokąty slotów i kart w procentach strony
 * (działają w każdej skali podglądu) oraz slot pod wskazanym punktem strony (mm).
 */
export type Geometria = Pick<
  WynikArkusza,
  'poczatekSiatki' | 'slot' | 'siatka' | 'odstepKolumny'
> & { szer: Mm; wys: Mm };

export function geometria(w: WynikArkusza): Geometria | undefined {
  const s = w.strony[0];
  if (!s) return undefined;
  return {
    poczatekSiatki: w.poczatekSiatki,
    slot: w.slot,
    siatka: w.siatka,
    odstepKolumny: w.odstepKolumny,
    szer: s.szer,
    wys: s.wys,
  };
}

/** Lewy górny róg slotu (mm od rogu strony). */
export function rogSlotu(g: Geometria, strona: number, kolumna: number, rzad: number) {
  return {
    x: g.poczatekSiatki.x + g.odstepKolumny(strona, kolumna) + kolumna * g.slot.szerokosc,
    y: g.poczatekSiatki.y + rzad * g.slot.wysokosc,
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
    width: proc(((kolumny * g.slot.szerokosc) / g.szer) * 100),
    height: proc(((rzedy * g.slot.wysokosc) / g.wys) * 100),
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
 * `przytnij`, inaczej undefined. Uwzględnia odstępy grup (punkt w odstępie – undefined).
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
  let rzad: number | undefined = Math.floor((y - g.poczatekSiatki.y) / g.slot.wysokosc);
  if (rzad < 0 || rzad >= g.siatka.rzedy) rzad = undefined;
  if (przytnij) {
    if (kolumna === undefined) {
      const x0 = rogSlotu(g, strona, 0, 0).x;
      kolumna = x < x0 ? 0 : g.siatka.kolumny - 1;
      for (let k = 0; k < g.siatka.kolumny; k++) if (rogSlotu(g, strona, k, 0).x <= x) kolumna = k;
    }
    rzad = Math.max(
      0,
      Math.min(g.siatka.rzedy - 1, Math.floor((y - g.poczatekSiatki.y) / g.slot.wysokosc)),
    );
  }
  return kolumna === undefined || rzad === undefined ? undefined : { kolumna, rzad };
}
