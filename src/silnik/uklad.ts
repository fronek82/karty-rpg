import type { Mm } from '../model/jednostki';
import {
  czyKontener,
  rozwinOdstepy,
  type Kontener,
  type Pole,
  type Rozmiar,
  type Wezel,
  type WyrownanieOsi,
} from '../model/szablon';

/**
 * Silnik układu: drzewo wierszy / kolumn / warstw → prostokąty w mm.
 * Dwa przebiegi: `zmierz` (rozmiar wg treści) i `rozmiesc` (pozycje w zadanej ramce).
 */

export interface Wymiary {
  szer: Mm;
  wys: Mm;
}

export interface Ograniczenie {
  szer?: Mm;
  wys?: Mm;
}

export interface KontekstUkladu {
  /** Rozmiar treści pola (bez paddingu) przy danych ograniczeniach. */
  zmierzPole(pole: Pole, ograniczenie: Ograniczenie): Wymiary;
  /** Czy węzeł jest ukryty (np. puste pole z `gdyPuste: 'ukryj'`). */
  czyUkryty(wezel: Wezel): boolean;
}

export interface UlozonyWezel {
  wezel: Wezel;
  x: Mm;
  y: Mm;
  szer: Mm;
  wys: Mm;
  dzieci: UlozonyWezel[];
}

type Os = 'szer' | 'wys';

function rozmiarWezla(w: Wezel, os: Os): Rozmiar | undefined {
  return os === 'szer' ? w.szerokosc : w.wysokosc;
}

/** Stały rozmiar (mm lub % znanego miejsca) albo undefined, gdy zależy od treści/wolnego miejsca. */
function staly(r: Rozmiar | undefined, dostepne: Mm | undefined): Mm | undefined {
  if (r === undefined || r === 'auto') return undefined;
  if ('mm' in r) return r.mm;
  if ('procent' in r) return dostepne === undefined ? undefined : (r.procent / 100) * dostepne;
  return undefined;
}

function wagaWypelnienia(r: Rozmiar | undefined): number | undefined {
  return r !== undefined && r !== 'auto' && 'wypelnij' in r ? r.wypelnij : undefined;
}

function marginesy(w: Wezel, os: Os): Mm {
  const m = rozwinOdstepy(w.margines);
  return os === 'szer' ? m.lewo + m.prawo : m.gora + m.dol;
}

function paddingi(w: Wezel, os: Os): Mm {
  const p = rozwinOdstepy(w.padding);
  return os === 'szer' ? p.lewo + p.prawo : p.gora + p.dol;
}

const druga = (os: Os): Os => (os === 'szer' ? 'wys' : 'szer');
const wyrownanieOsi = (w: Wezel, os: Os): WyrownanieOsi | undefined =>
  os === 'szer' ? w.wyrownanie?.poziomo : w.wyrownanie?.pionowo;

const odejmij = (a: Mm | undefined, b: Mm) => (a === undefined ? undefined : Math.max(0, a - b));

function widoczneDzieci(k: Kontener, ctx: KontekstUkladu): Wezel[] {
  return k.dzieci.filter((d) => !ctx.czyUkryty(d));
}

/** Rozmiar węzła (bez marginesów) przy danych ograniczeniach. */
export function zmierz(w: Wezel, ogr: Ograniczenie, ctx: KontekstUkladu): Wymiary {
  const stalaSzer = staly(w.szerokosc, ogr.szer);
  const stalaWys = staly(w.wysokosc, ogr.wys);
  const wnetrze: Ograniczenie = {
    szer: odejmij(stalaSzer ?? ogr.szer, paddingi(w, 'szer')),
    wys: odejmij(stalaWys ?? ogr.wys, paddingi(w, 'wys')),
  };
  let tresc: Wymiary;
  if (!czyKontener(w)) {
    tresc = ctx.zmierzPole(w, wnetrze);
  } else {
    tresc = zmierzKontener(w, wnetrze, ctx);
  }
  return {
    szer: stalaSzer ?? tresc.szer + paddingi(w, 'szer'),
    wys: stalaWys ?? tresc.wys + paddingi(w, 'wys'),
  };
}

function zmierzKontener(k: Kontener, wnetrze: Ograniczenie, ctx: KontekstUkladu): Wymiary {
  const dzieci = widoczneDzieci(k, ctx);
  if (k.typ === 'warstwy') {
    let szer = 0;
    let wys = 0;
    for (const d of dzieci) {
      const r = zmierz(
        d,
        {
          szer: odejmij(wnetrze.szer, marginesy(d, 'szer')),
          wys: odejmij(wnetrze.wys, marginesy(d, 'wys')),
        },
        ctx,
      );
      szer = Math.max(szer, r.szer + marginesy(d, 'szer'));
      wys = Math.max(wys, r.wys + marginesy(d, 'wys'));
    }
    return { szer, wys };
  }
  const glowna: Os = k.typ === 'wiersz' ? 'szer' : 'wys';
  const poprzeczna = druga(glowna);
  let suma = (k.odstep ?? 0) * Math.max(0, dzieci.length - 1);
  let maks = 0;
  for (const d of dzieci) {
    const ogr: Ograniczenie = {};
    ogr[poprzeczna] = odejmij(wnetrze[poprzeczna], marginesy(d, poprzeczna));
    const r = zmierz(d, ogr, ctx);
    suma += (staly(rozmiarWezla(d, glowna), wnetrze[glowna]) ?? r[glowna]) + marginesy(d, glowna);
    maks = Math.max(maks, r[poprzeczna] + marginesy(d, poprzeczna));
  }
  return glowna === 'szer' ? { szer: suma, wys: maks } : { szer: maks, wys: suma };
}

/** Rozmieszcza węzeł w ramce (x, y, szer, wys) – ramka to jego obrys bez marginesów. */
export function rozmiesc(
  w: Wezel,
  x: Mm,
  y: Mm,
  szer: Mm,
  wys: Mm,
  ctx: KontekstUkladu,
): UlozonyWezel {
  const wynik: UlozonyWezel = { wezel: w, x, y, szer, wys, dzieci: [] };
  if (!czyKontener(w)) return wynik;
  const p = rozwinOdstepy(w.padding);
  const ramka = {
    x: x + p.lewo,
    y: y + p.gora,
    szer: Math.max(0, szer - p.lewo - p.prawo),
    wys: Math.max(0, wys - p.gora - p.dol),
  };
  const dzieci = widoczneDzieci(w, ctx);
  if (w.typ === 'warstwy') {
    wynik.dzieci = dzieci.map((d) => {
      const m = rozwinOdstepy(d.margines);
      const dostSzer = Math.max(0, ramka.szer - m.lewo - m.prawo);
      const dostWys = Math.max(0, ramka.wys - m.gora - m.dol);
      const sz = rozmiarWPoprzek(d, 'szer', dostSzer, { wys: dostWys }, ctx);
      const wy = rozmiarWPoprzek(d, 'wys', dostWys, { szer: sz }, ctx);
      const dx = przesuniecie(wyrownanieOsi(d, 'szer'), dostSzer - sz);
      const dy = przesuniecie(wyrownanieOsi(d, 'wys'), dostWys - wy);
      return rozmiesc(d, ramka.x + m.lewo + dx, ramka.y + m.gora + dy, sz, wy, ctx);
    });
    return wynik;
  }

  const glowna: Os = w.typ === 'wiersz' ? 'szer' : 'wys';
  const poprzeczna = druga(glowna);
  const dostepneGlowna = ramka[glowna];
  const dostepnePoprzeczna = ramka[poprzeczna];
  const odstep = w.odstep ?? 0;

  // 1. Rozmiary w osi głównej: stałe i wg treści; wypełniające dostają resztę wg wag.
  const rozmiary: (Mm | undefined)[] = [];
  let zajete = odstep * Math.max(0, dzieci.length - 1);
  let sumaWag = 0;
  for (const d of dzieci) {
    zajete += marginesy(d, glowna);
    const r = rozmiarWezla(d, glowna);
    const waga = wagaWypelnienia(r);
    if (waga !== undefined) {
      sumaWag += waga;
      rozmiary.push(undefined);
      continue;
    }
    let v = staly(r, dostepneGlowna);
    if (v === undefined) {
      const ogr: Ograniczenie = {};
      ogr[poprzeczna] = Math.max(0, dostepnePoprzeczna - marginesy(d, poprzeczna));
      v = zmierz(d, ogr, ctx)[glowna];
    }
    rozmiary.push(v);
    zajete += v;
  }
  const wolne = Math.max(0, dostepneGlowna - zajete);
  dzieci.forEach((d, i) => {
    if (rozmiary[i] === undefined) {
      rozmiary[i] =
        sumaWag > 0 ? (wolne * (wagaWypelnienia(rozmiarWezla(d, glowna)) ?? 0)) / sumaWag : 0;
    }
  });

  // 2. Rozłożenie w osi głównej, gdy zostaje miejsce (bez dzieci wypełniających).
  const zostalo = sumaWag > 0 ? 0 : wolne;
  let poz = 0;
  let dodatkowyOdstep = 0;
  if (w.rozklad === 'srodek') poz = zostalo / 2;
  else if (w.rozklad === 'koniec') poz = zostalo;
  else if (w.rozklad === 'miedzy' && dzieci.length > 1)
    dodatkowyOdstep = zostalo / (dzieci.length - 1);

  // 3. Oś poprzeczna i pozycje.
  wynik.dzieci = dzieci.map((d, i) => {
    const m = rozwinOdstepy(d.margines);
    const mPrzed = glowna === 'szer' ? m.lewo : m.gora;
    const mPo = glowna === 'szer' ? m.prawo : m.dol;
    const mPopPrzed = glowna === 'szer' ? m.gora : m.lewo;
    const rozmiarGl = rozmiary[i] ?? 0;
    const dostPop = Math.max(0, dostepnePoprzeczna - marginesy(d, poprzeczna));
    const ogr: Ograniczenie = {};
    ogr[glowna] = rozmiarGl;
    const rozmiarPop = rozmiarWPoprzek(d, poprzeczna, dostPop, ogr, ctx);
    const pozPop = mPopPrzed + przesuniecie(wyrownanieOsi(d, poprzeczna), dostPop - rozmiarPop);
    const start = poz + mPrzed;
    poz = start + rozmiarGl + mPo + odstep + dodatkowyOdstep;
    return glowna === 'szer'
      ? rozmiesc(d, ramka.x + start, ramka.y + pozPop, rozmiarGl, rozmiarPop, ctx)
      : rozmiesc(d, ramka.x + pozPop, ramka.y + start, rozmiarPop, rozmiarGl, ctx);
  });
  return wynik;
}

/** Rozmiar w osi poprzecznej: stały, wg treści (gdy jest wyrównanie) albo rozciągnięty. */
function rozmiarWPoprzek(
  d: Wezel,
  os: Os,
  dostepne: Mm,
  ogr: Ograniczenie,
  ctx: KontekstUkladu,
): Mm {
  const r = rozmiarWezla(d, os);
  const v = staly(r, dostepne);
  if (v !== undefined) return v;
  // Jawne 'auto' = wg treści; brak rozmiaru i brak wyrównania = rozciągnij.
  if (wagaWypelnienia(r) !== undefined) return dostepne;
  if (r !== 'auto' && wyrownanieOsi(d, os) === undefined) return dostepne;
  const pelne: Ograniczenie = { ...ogr };
  pelne[os] = dostepne;
  return Math.min(dostepne, zmierz(d, pelne, ctx)[os]);
}

function przesuniecie(wyr: WyrownanieOsi | undefined, wolne: Mm): Mm {
  if (wyr === 'srodek') return wolne / 2;
  if (wyr === 'koniec') return wolne;
  return 0;
}
