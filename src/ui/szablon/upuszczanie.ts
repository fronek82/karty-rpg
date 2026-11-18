import { przeniesWezel, zmienWezel } from '../../dane/szablon';
import {
  czyKontener,
  rozwinOdstepy,
  type Szablon,
  type Kontener,
  type Wezel,
} from '../../model/szablon';
import type { Prostokat } from '../../silnik/uklad';
import type { Prowadnica, WezlyKarty } from './swobodnyMysz';

type Punkt = { x: number; y: number };

export interface CelUpuszczenia {
  id: string;
  rodzicId: string;
  indeks: number;
  ramka: Prostokat;
  wskaznik?: Prowadnica;
  pozycja?: Punkt;
}

export function przygotujUpuszczenie(
  szablon: Szablon,
  wezly: WezlyKarty,
  id: string,
  start: Punkt,
): ((kursor: Punkt) => CelUpuszczenia | undefined) | undefined {
  const ramki = new Map(wezly.map((w) => [w.id, w]));
  const zrodlo = ramki.get(id);
  let rodzicId: string | undefined;
  const kontenery = new Map<string, Kontener>();
  const odwiedz = (w: Wezel, przeszkoda: boolean, rodzic?: string) => {
    if (w.id === id) rodzicId = rodzic;
    if (!czyKontener(w)) return;
    const wykluczony = przeszkoda || w.id === id || !!ramki.get(w.id)?.obrot;
    if (!wykluczony) kontenery.set(w.id, w);
    for (const dziecko of w.dzieci) odwiedz(dziecko, wykluczony, w.id);
  };
  odwiedz(szablon.korzen, false);
  if (!rodzicId || !zrodlo) return;
  const cele = wezly
    .filter((r) => kontenery.has(r.id))
    .reverse()
    .sort((a, b) => a.szer * a.wys - b.szer * b.wys);
  return (kursor) => {
    const ramka = cele.find(
      (r) =>
        kursor.x >= r.x && kursor.x <= r.x + r.szer && kursor.y >= r.y && kursor.y <= r.y + r.wys,
    );
    if (!ramka || ramka.id === rodzicId) return;
    const cel = kontenery.get(ramka.id)!;
    const wynik: CelUpuszczenia = { id, rodzicId: cel.id, indeks: cel.dzieci.length, ramka };
    const padding = rozwinOdstepy(cel.padding);
    if (cel.typ === 'swobodny') {
      wynik.pozycja = {
        x: kursor.x - (start.x - zrodlo.x) - ramka.x - padding.lewo,
        y: kursor.y - (start.y - zrodlo.y) - ramka.y - padding.gora,
      };
    } else if (cel.typ !== 'warstwy') {
      const os = cel.typ === 'wiersz' ? 'x' : 'y';
      const wymiar = os === 'x' ? 'szer' : 'wys';
      let polozenie = ramka[os] + (os === 'x' ? padding.lewo : padding.gora);
      for (const [indeks, dziecko] of cel.dzieci.entries()) {
        const r = ramki.get(dziecko.id);
        if (!r) continue;
        if (kursor[os] < r[os] + r[wymiar] / 2) {
          wynik.indeks = indeks;
          polozenie = r[os];
          break;
        }
        polozenie = r[os] + r[wymiar];
      }
      wynik.wskaznik = { os, polozenie };
    }
    return wynik;
  };
}

export function upuscWezel(s: Szablon, cel: CelUpuszczenia): Szablon {
  const nowy = przeniesWezel(s, cel.id, cel.rodzicId, cel.indeks);
  const pozycja = cel.pozycja;
  if (nowy === s || !pozycja) return nowy;
  const zaokr = (v: number) => Math.round(v * 1000) / 1000;
  return zmienWezel(nowy, cel.id, (w) => ({
    ...w,
    pozycja: {
      x: zaokr(pozycja.x),
      y: zaokr(pozycja.y),
      ...(w.pozycja?.obrot ? { obrot: w.pozycja.obrot } : {}),
    },
  }));
}
