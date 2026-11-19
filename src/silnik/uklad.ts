import type { Mm } from '../model/jednostki';
import {
  czyKontener,
  rozwinOdstepy,
  ulamkiKotwicy,
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
  /**
   * Ramka węzła w układzie rodzica. Przy `obrot` to ramka PRZED obrotem (w niej układają się dzieci
   * i rysuje treść); prostokąt zajęty na karcie daje `prostokatPoObrocie`.
   */
  x: Mm;
  y: Mm;
  szer: Mm;
  wys: Mm;
  /** Obrót (stopnie, zgodnie z zegarem) wokół środka ramki – tylko dzieci kontenera swobodnego (R9). */
  obrot?: number;
  dzieci: UlozonyWezel[];
}

export interface Prostokat {
  x: Mm;
  y: Mm;
  szer: Mm;
  wys: Mm;
}

/** Obrót zgodnie z zegarem w układzie z osią Y skierowaną w dół. */
export function obrocWektor(x: Mm, y: Mm, kat: number): [Mm, Mm] {
  const stopnie = ((kat % 360) + 360) % 360;
  switch (stopnie) {
    case 0:
      return [x, y];
    case 90:
      return [-y, x];
    case 180:
      return [-x, -y];
    case 270:
      return [y, -x];
    default: {
      const rad = (stopnie * Math.PI) / 180;
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      return [c * x - s * y, s * x + c * y];
    }
  }
}

/** Obwiednia prostokąta po obrocie wokół punktu (cx, cy). */
export function obrocProstokat(r: Prostokat, cx: Mm, cy: Mm, kat: number): Prostokat {
  if (!kat) return r;
  const [x, y] = obrocWektor(r.x + r.szer / 2 - cx, r.y + r.wys / 2 - cy, kat);
  const [c, s] = obrocWektor(1, 0, kat);
  const szer = Math.abs(c) * r.szer + Math.abs(s) * r.wys;
  const wys = Math.abs(s) * r.szer + Math.abs(c) * r.wys;
  return { x: cx + x - szer / 2, y: cy + y - wys / 2, szer, wys };
}

/** Prostokąt zajęty przez węzeł (w układzie rodzica) po jego własnym obrocie. */
export function prostokatPoObrocie(u: Prostokat & { obrot?: number }): Prostokat {
  return obrocProstokat(
    { x: u.x, y: u.y, szer: u.szer, wys: u.wys },
    u.x + u.szer / 2,
    u.y + u.wys / 2,
    u.obrot ?? 0,
  );
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

/**
 * Rozmiar węzła (bez marginesów). `ogr` – miejsce dostępne (od niego liczą się procenty);
 * `ustalone` – rozmiar już wyznaczony przez rodzica (np. udział w wypełnieniu), używany wprost.
 */
export function zmierz(
  w: Wezel,
  ogr: Ograniczenie,
  ctx: KontekstUkladu,
  ustalone: Ograniczenie = {},
): Wymiary {
  const stalaSzer = ustalone.szer ?? staly(w.szerokosc, ogr.szer);
  const stalaWys = ustalone.wys ?? staly(w.wysokosc, ogr.wys);
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
    szer: stalaSzer ?? Math.max(minimum(w, 'szer'), tresc.szer + paddingi(w, 'szer')),
    wys: stalaWys ?? Math.max(minimum(w, 'wys'), tresc.wys + paddingi(w, 'wys')),
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
  if (k.typ === 'swobodny') {
    // Rozmiar wg treści = obwiednia dzieci; dziecko zakotwiczone przy prawej / dolnej krawędzi
    // (albo na środku) nie ma stałego punktu odniesienia, więc liczy się jego rozmiar plus odległość.
    let szer = 0;
    let wys = 0;
    for (const d of dzieci) {
      const r = rozmiarSwobodny(d, wnetrze, ctx);
      const poz = d.pozycja;
      const { fx, fy } = ulamkiKotwicy(poz?.kotwica);
      const x = poz?.x ?? 0;
      const y = poz?.y ?? 0;
      szer = Math.max(szer, obwiednia(fx, x, r.prostokatSzer));
      wys = Math.max(wys, obwiednia(fy, y, r.prostokatWys));
    }
    return { szer, wys };
  }
  const glowna: Os = k.typ === 'wiersz' ? 'szer' : 'wys';
  const poprzeczna = druga(glowna);
  // Najpierw oś główna (jak przy rozmieszczaniu), potem poprzeczna przy znanym rozmiarze
  // w osi głównej – inaczej tekst w wypełniającym dziecku wiersza mierzy się niezłamany.
  const { rozmiary } = rozmiaryWOsiGlownej(
    k,
    dzieci,
    glowna,
    wnetrze[glowna],
    wnetrze[poprzeczna],
    ctx,
  );
  let suma = (k.odstep ?? 0) * Math.max(0, dzieci.length - 1);
  let maks = 0;
  dzieci.forEach((d, i) => {
    const rozmiarGl = rozmiary[i] ?? 0;
    const ogr: Ograniczenie = {};
    ogr[poprzeczna] = odejmij(wnetrze[poprzeczna], marginesy(d, poprzeczna));
    const ustalone: Ograniczenie = {};
    ustalone[glowna] = rozmiarGl;
    const r = zmierz(d, ogr, ctx, ustalone);
    suma += rozmiarGl + marginesy(d, glowna);
    maks = Math.max(maks, r[poprzeczna] + marginesy(d, poprzeczna));
  });
  return glowna === 'szer' ? { szer: suma, wys: maks } : { szer: maks, wys: suma };
}

/**
 * Rozmiary dzieci w osi głównej: stałe, wg treści, a wypełniające dzielą wolne miejsce wg wag.
 * Gdy miejsce w osi głównej jest nieznane (pomiar), wypełniające dostają rozmiar wg treści.
 */
function rozmiaryWOsiGlownej(
  k: Kontener,
  dzieci: Wezel[],
  glowna: Os,
  dostepneGlowna: Mm | undefined,
  dostepnePoprzeczna: Mm | undefined,
  ctx: KontekstUkladu,
): { rozmiary: Mm[]; wolne: Mm; sumaWag: number } {
  const poprzeczna = druga(glowna);
  const wgTresci = (d: Wezel) => {
    const ogr: Ograniczenie = {};
    ogr[poprzeczna] = odejmij(dostepnePoprzeczna, marginesy(d, poprzeczna));
    return zmierz(d, ogr, ctx)[glowna];
  };
  const rozmiary: (Mm | undefined)[] = [];
  let zajete = (k.odstep ?? 0) * Math.max(0, dzieci.length - 1);
  let sumaWag = 0;
  for (const d of dzieci) {
    zajete += marginesy(d, glowna);
    const r = rozmiarWezla(d, glowna);
    const waga = wagaWypelnienia(r);
    if (waga !== undefined && dostepneGlowna !== undefined) {
      sumaWag += waga;
      rozmiary.push(undefined);
      continue;
    }
    const v = (waga === undefined ? staly(r, dostepneGlowna) : undefined) ?? wgTresci(d);
    rozmiary.push(v);
    zajete += v;
  }
  const wolne = dostepneGlowna === undefined ? 0 : Math.max(0, dostepneGlowna - zajete);
  return {
    rozmiary: dzieci.map(
      (d, i) =>
        rozmiary[i] ??
        Math.max(
          minimum(d, glowna),
          sumaWag > 0 ? (wolne * (wagaWypelnienia(rozmiarWezla(d, glowna)) ?? 0)) / sumaWag : 0,
        ),
    ),
    wolne,
    sumaWag,
  };
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
      const sz = rozmiarWPoprzek(d, 'szer', dostSzer, { wys: dostWys }, {}, ctx);
      const wy = rozmiarWPoprzek(d, 'wys', dostWys, { szer: dostSzer }, { szer: sz }, ctx);
      const dx = przesuniecie(wyrownanieOsi(d, 'szer'), dostSzer - sz);
      const dy = przesuniecie(wyrownanieOsi(d, 'wys'), dostWys - wy);
      return rozmiesc(d, ramka.x + m.lewo + dx, ramka.y + m.gora + dy, sz, wy, ctx);
    });
    return wynik;
  }

  if (w.typ === 'swobodny') {
    wynik.dzieci = dzieci.map((d) => {
      const r = rozmiarSwobodny(d, ramka, ctx);
      const poz = d.pozycja;
      const { fx, fy } = ulamkiKotwicy(poz?.kotwica);
      // Prostokąt na karcie (po obrocie) wiąże kotwica; ramka przed obrotem ma ten sam środek.
      const lewo = ramka.x + ramka.szer * fx + (poz?.x ?? 0) - r.prostokatSzer * fx;
      const gora = ramka.y + ramka.wys * fy + (poz?.y ?? 0) - r.prostokatWys * fy;
      const cx = lewo + r.prostokatSzer / 2;
      const cy = gora + r.prostokatWys / 2;
      const u = rozmiesc(d, cx - r.szer / 2, cy - r.wys / 2, r.szer, r.wys, ctx);
      if (r.obrot) u.obrot = r.obrot;
      return u;
    });
    return wynik;
  }

  const glowna: Os = w.typ === 'wiersz' ? 'szer' : 'wys';
  const poprzeczna = druga(glowna);
  const dostepneGlowna = ramka[glowna];
  const dostepnePoprzeczna = ramka[poprzeczna];
  const odstep = w.odstep ?? 0;

  // 1. Rozmiary w osi głównej: stałe i wg treści; wypełniające dostają resztę wg wag.
  const { rozmiary, wolne, sumaWag } = rozmiaryWOsiGlownej(
    w,
    dzieci,
    glowna,
    dostepneGlowna,
    dostepnePoprzeczna,
    ctx,
  );

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
    const ustalone: Ograniczenie = {};
    ustalone[glowna] = rozmiarGl;
    const rozmiarPop = rozmiarWPoprzek(d, poprzeczna, dostPop, {}, ustalone, ctx);
    const pozPop = mPopPrzed + przesuniecie(wyrownanieOsi(d, poprzeczna), dostPop - rozmiarPop);
    const start = poz + mPrzed;
    poz = start + rozmiarGl + mPo + odstep + dodatkowyOdstep;
    return glowna === 'szer'
      ? rozmiesc(d, ramka.x + start, ramka.y + pozPop, rozmiarGl, rozmiarPop, ctx)
      : rozmiesc(d, ramka.x + pozPop, ramka.y + start, rozmiarPop, rozmiarGl, ctx);
  });
  return wynik;
}

/**
 * Wkład dziecka w rozmiar kontenera „wg treści” w jednej osi (`f` – ułamek kotwicy, `x` – przesunięcie,
 * `d` – rozmiar elementu): przy kotwicy na początku element sięga `x + d`; przy środkowej kontener
 * musi być symetryczny wokół punktu, więc `d + 2|x|`; przy końcowej (f = 1) liczy się `d + |x|`
 * (dodatnie `x` wyprowadza element poza kontener, więc nie powiększa go bardziej niż ujemne).
 */
function obwiednia(f: number, x: Mm, d: Mm): Mm {
  if (f === 0) return x + d;
  return f === 0.5 ? d + 2 * Math.abs(x) : d + Math.abs(x);
}

/**
 * Rozmiar dziecka kontenera swobodnego: `szer` × `wys` to jego własne wymiary (przed obrotem),
 * `prostokatSzer` × `prostokatWys` – prostokąt zajęty na karcie (obwiednia po obrocie).
 * mm i % (miejsca wnętrza kontenera w tej samej osi) są stałe; reszta (auto, wypełnij) – wg treści,
 * z ograniczeniem do wnętrza kontenera wzdłuż osi, w którą po obrocie trafia dany bok.
 */
function rozmiarSwobodny(
  d: Wezel,
  ramka: Ograniczenie,
  ctx: KontekstUkladu,
): { szer: Mm; wys: Mm; prostokatSzer: Mm; prostokatWys: Mm; obrot?: number } {
  const kat = d.pozycja?.obrot ?? 0;
  const bokiZamienione = kat === 90 || kat === 270;
  const sz = staly(d.szerokosc, ramka.szer);
  const wy = staly(d.wysokosc, ramka.wys);
  let szer = sz;
  let wys = wy;
  if (sz === undefined || wy === undefined) {
    const ogr: Ograniczenie = {
      szer: sz ?? (bokiZamienione ? ramka.wys : ramka.szer),
      wys: wy ?? (bokiZamienione ? ramka.szer : ramka.wys),
    };
    const ustalone: Ograniczenie = {};
    if (sz !== undefined) ustalone.szer = sz;
    if (wy !== undefined) ustalone.wys = wy;
    const m = zmierz(d, ogr, ctx, ustalone);
    szer = sz ?? m.szer;
    wys = wy ?? m.wys;
    if (kat % 90) {
      const [cos, sin] = obrocWektor(1, 0, kat).map(Math.abs) as [number, number];
      const luzSzer = (ramka.szer ?? Infinity) - cos * (sz ?? 0) - sin * (wy ?? 0);
      const luzWys = (ramka.wys ?? Infinity) - sin * (sz ?? 0) - cos * (wy ?? 0);
      const obwSzer = cos * (sz === undefined ? szer : 0) + sin * (wy === undefined ? wys : 0);
      const obwWys = sin * (sz === undefined ? szer : 0) + cos * (wy === undefined ? wys : 0);
      const skala = Math.max(
        0,
        Math.min(1, obwSzer ? luzSzer / obwSzer : 1, obwWys ? luzWys / obwWys : 1),
      );
      if (skala < 1 && (obwSzer || obwWys)) {
        const maxSzer = sz ?? Math.max(minimum(d, 'szer'), szer * skala);
        const maxWys = wy ?? Math.max(minimum(d, 'wys'), wys * skala);
        const dopasowany = zmierz(d, { szer: maxSzer, wys: maxWys }, ctx, ustalone);
        szer = sz ?? Math.min(maxSzer, dopasowany.szer);
        wys = wy ?? Math.min(maxWys, dopasowany.wys);
      }
    }
  }
  const s0 = szer ?? 0;
  const w0 = wys ?? 0;
  const obwiednia = obrocProstokat({ x: 0, y: 0, szer: s0, wys: w0 }, s0 / 2, w0 / 2, kat);
  return {
    szer: s0,
    wys: w0,
    prostokatSzer: obwiednia.szer,
    prostokatWys: obwiednia.wys,
    ...(kat ? { obrot: kat } : {}),
  };
}

/** Rozmiar w osi poprzecznej: stały, wg treści (gdy jest wyrównanie) albo rozciągnięty. */
function rozmiarWPoprzek(
  d: Wezel,
  os: Os,
  dostepne: Mm,
  ogr: Ograniczenie,
  ustalone: Ograniczenie,
  ctx: KontekstUkladu,
): Mm {
  const r = rozmiarWezla(d, os);
  const v = staly(r, dostepne);
  if (v !== undefined) return v;
  // Jawne 'auto' = wg treści; brak rozmiaru i brak wyrównania = rozciągnij.
  const min = minimum(d, os);
  if (wagaWypelnienia(r) !== undefined) return Math.max(min, dostepne);
  if (r !== 'auto' && wyrownanieOsi(d, os) === undefined) return Math.max(min, dostepne);
  const pelne: Ograniczenie = { ...ogr };
  pelne[os] = dostepne;
  // Treść przycinamy do dostępnego miejsca, ale minimum ma pierwszeństwo.
  return Math.max(min, Math.min(dostepne, zmierz(d, pelne, ctx, ustalone)[os]));
}

/** Minimalny rozmiar węzła w osi (0, gdy brak). */
function minimum(w: Wezel, os: Os): Mm {
  return (os === 'szer' ? w.minSzerokosc : w.minWysokosc) ?? 0;
}

function przesuniecie(wyr: WyrownanieOsi | undefined, wolne: Mm): Mm {
  if (wyr === 'srodek') return wolne / 2;
  if (wyr === 'koniec') return wolne;
  return 0;
}
