/**
 * Praca myszą i klawiaturą w kontenerze swobodnym (M2b-9): czyste funkcje bez Reacta i DOM.
 *
 * Wszystko liczymy w mm w układzie rodzica elementu („lokalnym”): dla elementów bez obróconych
 * przodków jest to układ karty, a przy obróconych przodkach przesunięcie z ekranu obracamy z powrotem
 * (`doLokalnych`). Prostokąty pochodzą z `WyrenderowanaKarta.wezly` – te same, z których układ rysuje
 * scenę (po obrocie węzła), więc trafienia i uchwyty zgadzają się z tym, co widać w podglądzie.
 * Wynik gestu to mapa zmian `pozycja` / rozmiaru, którą `zastosujZmiany` nakłada na szablon:
 * w trakcie gestu jako stan tymczasowy, na `pointerup` – jako jeden krok „Cofnij”.
 */
import { formatujLiczbeZUlamkiem } from '../../i18n';
import { rodzicWezla, zmienWezel } from '../../dane/szablon';
import {
  rozwinOdstepy,
  ulamkiKotwicy,
  type ObrotSwobodny,
  type Pozycja,
  type Szablon,
  type Wezel,
} from '../../model/szablon';
import type { Mm } from '../../model/jednostki';
import type { WyrenderowanaKarta } from '../../silnik/karta';
import { prostokatPoObrocie, type Prostokat } from '../../silnik/uklad';

export type WezlyKarty = WyrenderowanaKarta['wezly'];

/** Najmniejszy rozmiar elementu zmieniany uchwytem (mm). */
export const MIN_ROZMIAR = 1;
/** Krok strzałek (mm) bez Shift i z Shift. */
export const KROK_STRZALKI = 0.5;
export const KROK_STRZALKI_DUZY = 5;
/** Próg przyciągania do krawędzi i środków w pikselach ekranu. */
export const PROG_PRZYCIAGANIA_PX = 6;
/** Domyślny krok siatki (mm). */
export const SIATKA_DOMYSLNA = 0.5;

const zaokr = (v: number) => Math.round(v * 1000) / 1000;

/** Piksele ekranu → mm przy danej szerokości podglądu karty (px) i szerokości karty (mm). */
export const pxNaMm = (px: number, szerokoscPx: number, szerokoscMm: Mm): Mm =>
  (px * szerokoscMm) / szerokoscPx;
/** mm → piksele ekranu. */
export const mmNaPx = (mm: Mm, szerokoscPx: number, szerokoscMm: Mm): number =>
  (mm * szerokoscPx) / szerokoscMm;

/**
 * Węzeł trafiony punktem (mm od rogu karty): z prostokątów po obrocie wygrywa najmniejszy
 * (większy leży pod spodem, więc mały element na dużej ilustracji da się złapać); przy równych
 * polach – późniejszy w drzewie (rysowany wyżej). Zgodne z kolejnością obszarów w nakładce.
 */
export function trafionyWezel(wezly: WezlyKarty, x: Mm, y: Mm): string | undefined {
  let wynik: string | undefined;
  let pole = Infinity;
  for (const w of wezly) {
    if (x < w.x || x > w.x + w.szer || y < w.y || y > w.y + w.wys) continue;
    const p = w.szer * w.wys;
    if (p <= pole) {
      wynik = w.id;
      pole = p;
    }
  }
  return wynik;
}

/** Przesunięcie z układu karty w układ rodzica elementu, którego przodkowie są obróceni o `kat` (zgodnie z zegarem). */
export function doLokalnych(dx: Mm, dy: Mm, kat: ObrotSwobodny): [Mm, Mm] {
  switch (kat) {
    case 90:
      return [dy, -dx];
    case 180:
      return [-dx, -dy];
    case 270:
      return [-dy, dx];
    default:
      return [dx, dy];
  }
}

/** Element kontenera swobodnego przygotowany do gestu: prostokąt, ramka rodzica i rodzeństwo (układ lokalny). */
export interface Cel {
  id: string;
  /** Rodzic (kontener swobodny) – gest dotyczy elementów jednego rodzica. */
  rodzicId: string;
  /** Prostokąt zajęty na karcie po własnym obrocie, w układzie rodzica. */
  rect: Prostokat;
  /** Wnętrze rodzica (po paddingu) – od niego liczą się `pozycja` i kotwica. */
  ramka: Prostokat;
  /** Cały rodzic (krawędzie i środek do przyciągania). */
  kontener: Prostokat;
  pozycja: Pozycja | undefined;
  obrot: ObrotSwobodny;
  /** Suma obrotów przodków (rodzic i wyżej) – ekranowe przesunięcie trzeba o nią cofnąć. */
  obrotPrzodkow: ObrotSwobodny;
  rodzenstwo: { id: string; rect: Prostokat }[];
  /** Osie, w których wolno zmieniać rozmiar (w układzie widocznym): separator ma tylko długość. */
  osie: { szer: boolean; wys: boolean };
}

const katSumy = (k: number): ObrotSwobodny => (((k % 360) + 360) % 360) as ObrotSwobodny;

/** Cel gestu dla węzła; undefined, gdy rodzic nie jest swobodny albo węzła nie ma w układzie (ukryty). */
export function budujCel(szablon: Szablon, wezly: WezlyKarty, id: string): Cel | undefined {
  const r = rodzicWezla(szablon, id);
  if (!r || r.rodzic.typ !== 'swobodny') return undefined;
  const mapa = new Map(wezly.map((w) => [w.id, w] as const));
  const w = mapa.get(id);
  const rw = mapa.get(r.rodzic.id);
  if (!w || !rw) return undefined;
  const p = rozwinOdstepy(r.rodzic.padding);
  const rect = (x: (typeof wezly)[number]): Prostokat =>
    prostokatPoObrocie({ ...x.lokalne, ...(x.obrot ? { obrot: x.obrot } : {}) });
  let suma = 0;
  for (let id2: string | undefined = r.rodzic.id; id2; id2 = rodzicWezla(szablon, id2)?.rodzic.id)
    suma += mapa.get(id2)?.obrot ?? 0;
  const wezel = r.rodzic.dzieci[r.indeks]!;
  const separator = wezel.typ === 'separator' && !('dzieci' in wezel);
  const pionowy = separator && (wezel as { kierunek?: string }).kierunek === 'pionowy';
  const bok = w.obrot === 90 || w.obrot === 270;
  const poziomaDlugosc = separator ? !pionowy : true;
  const pionowaDlugosc = separator ? pionowy : true;
  return {
    id,
    rodzicId: r.rodzic.id,
    rect: rect(w),
    ramka: {
      x: rw.lokalne.x + p.lewo,
      y: rw.lokalne.y + p.gora,
      szer: Math.max(0, rw.lokalne.szer - p.lewo - p.prawo),
      wys: Math.max(0, rw.lokalne.wys - p.gora - p.dol),
    },
    kontener: { ...rw.lokalne },
    pozycja: wezel.pozycja,
    obrot: (w.obrot ?? 0) as ObrotSwobodny,
    obrotPrzodkow: katSumy(suma),
    rodzenstwo: r.rodzic.dzieci
      .filter((d) => d.id !== id)
      .flatMap((d) => {
        const x = mapa.get(d.id);
        return x ? [{ id: d.id, rect: rect(x) }] : [];
      }),
    osie: bok
      ? { szer: pionowaDlugosc, wys: poziomaDlugosc }
      : { szer: poziomaDlugosc, wys: pionowaDlugosc },
  };
}

/** Cele dla zaznaczenia – tylko elementy kontenerów swobodnych (pozostałe nie mają co przeciągać). */
export function budujCele(szablon: Szablon, wezly: WezlyKarty, ids: readonly string[]): Cel[] {
  return ids.flatMap((id) => {
    const c = budujCel(szablon, wezly, id);
    return c ? [c] : [];
  });
}

/**
 * Gest dotyczy elementów jednego kontenera (jak wyrównanie): zostają te z rodzicem pierwszego
 * celu albo – gdy podano `preferowany` – rodzicem tego elementu. Układy lokalne różnych rodziców
 * (padding, obroty) są niezależne, więc wspólne przesunięcie i przyciąganie nie mają sensu.
 */
export function ograniczDoRodzica(cele: readonly Cel[], preferowany?: string): Cel[] {
  const wzor = cele.find((c) => c.id === preferowany) ?? cele[0];
  return wzor ? cele.filter((c) => c.rodzicId === wzor.rodzicId) : [];
}

export interface Przyciaganie {
  /** Krok siatki w mm; 0 = bez siatki. */
  siatka: Mm;
  /** Przyciąganie do krawędzi i środków rodzeństwa i kontenera. */
  obiekty: boolean;
  /** Próg w mm (6 px ekranu przeliczone na mm). */
  prog: Mm;
  /** Alt: bez żadnego przyciągania. */
  wylacz?: boolean;
}

/** Linia pomocnicza rysowana tylko w edytorze: `os: 'x'` – pionowa na danym X, `'y'` – pozioma na danym Y (mm w układzie karty). */
export interface Prowadnica {
  os: 'x' | 'y';
  polozenie: Mm;
}

export interface ZmianaPola {
  pozycja: Pozycja;
  szerokosc?: { mm: Mm };
  wysokosc?: { mm: Mm };
}

export interface WynikGestu {
  zmiany: Map<string, ZmianaPola>;
  prowadnice: Prowadnica[];
  /** Położenie (i rozmiar przy zmianie rozmiaru) pierwszego elementu – do podpowiedzi „X · Y”. */
  podpowiedz?: { x: Mm; y: Mm; szer?: Mm; wys?: Mm };
}

/** Wartość najbliższa `v` leżąca na siatce o kroku `krok` zaczepionej w `poczatek`. */
export const naSiatke = (v: number, krok: number, poczatek = 0): number =>
  krok > 0 ? poczatek + Math.round((v - poczatek) / krok) * krok : v;

/** Najbliższy kandydat w progu dla którejś z linii: przesunięcie, które ją na niego nakłada. */
export function przyciagnijLinie(
  linie: readonly number[],
  kandydaci: readonly number[],
  prog: Mm,
): { przesuniecie: number; kandydat: number } | undefined {
  let wynik: { przesuniecie: number; kandydat: number } | undefined;
  for (const l of linie)
    for (const c of kandydaci) {
      const d = c - l;
      if (Math.abs(d) <= prog && (!wynik || Math.abs(d) < Math.abs(wynik.przesuniecie) - 1e-9))
        wynik = { przesuniecie: d, kandydat: c };
    }
  return wynik;
}

/** Krawędzie i środki rodzeństwa (poza `wyklucz`) oraz kontenera – kandydaci do przyciągania. */
export function kandydaciPrzyciagania(
  cel: Cel,
  wyklucz: ReadonlySet<string>,
): { x: number[]; y: number[] } {
  const x: number[] = [];
  const y: number[] = [];
  const dodaj = (r: Prostokat) => {
    x.push(r.x, r.x + r.szer / 2, r.x + r.szer);
    y.push(r.y, r.y + r.wys / 2, r.y + r.wys);
  };
  dodaj(cel.kontener);
  dodaj(cel.ramka);
  for (const s of cel.rodzenstwo) if (!wyklucz.has(s.id)) dodaj(s.rect);
  return { x, y };
}

function obwiednia(rects: readonly Prostokat[]): Prostokat {
  const x1 = Math.min(...rects.map((r) => r.x));
  const y1 = Math.min(...rects.map((r) => r.y));
  const x2 = Math.max(...rects.map((r) => r.x + r.szer));
  const y2 = Math.max(...rects.map((r) => r.y + r.wys));
  return { x: x1, y: y1, szer: x2 - x1, wys: y2 - y1 };
}

const pozycjaBazowa = (c: Cel): Pozycja => c.pozycja ?? { x: 0, y: 0 };

/**
 * Przesunięcie zaznaczonych elementów o (dx, dy) mm w układzie karty (od położenia sprzed gestu).
 * Grupa jest przyciągana jako całość: jej lewa / środkowa / prawa krawędź (i górna / środkowa / dolna)
 * do krawędzi i środków rodzeństwa i kontenera; gdy żadna nie jest w progu – lewy górny róg do siatki.
 */
export function przesunCele(
  cele: readonly Cel[],
  dxKarta: Mm,
  dyKarta: Mm,
  p: Przyciaganie,
): WynikGestu {
  const pierwszy = cele[0];
  if (!pierwszy) return { zmiany: new Map(), prowadnice: [] };
  const [dx0, dy0] = doLokalnych(dxKarta, dyKarta, pierwszy.obrotPrzodkow);
  const d = { x: dx0, y: dy0 };
  const prowadnice: Prowadnica[] = [];
  if (!p.wylacz) {
    const grupa = obwiednia(cele.map((c) => c.rect));
    const kand = kandydaciPrzyciagania(pierwszy, new Set(cele.map((c) => c.id)));
    for (const os of ['x', 'y'] as const) {
      const start = os === 'x' ? grupa.x : grupa.y;
      const dl = os === 'x' ? grupa.szer : grupa.wys;
      const wartosc = start + d[os];
      const s =
        p.obiekty && pierwszy.obrotPrzodkow === 0
          ? przyciagnijLinie([wartosc, wartosc + dl / 2, wartosc + dl], kand[os], p.prog)
          : undefined;
      if (s) {
        d[os] += s.przesuniecie;
        prowadnice.push({ os, polozenie: s.kandydat });
      } else if (p.siatka > 0) {
        d[os] =
          naSiatke(wartosc, p.siatka, os === 'x' ? pierwszy.ramka.x : pierwszy.ramka.y) - start;
      }
    }
  }
  const zmiany = new Map<string, ZmianaPola>();
  for (const c of cele) {
    const b = pozycjaBazowa(c);
    zmiany.set(c.id, { pozycja: { ...b, x: zaokr(b.x + d.x), y: zaokr(b.y + d.y) } });
  }
  const pz = zmiany.get(pierwszy.id)!.pozycja;
  return { zmiany, prowadnice, podpowiedz: { x: pz.x, y: pz.y } };
}

export type Uchwyt = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export const UCHWYTY: readonly Uchwyt[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** Środek uchwytu na prostokącie (mm). */
export function punktUchwytu(r: Prostokat, u: Uchwyt): { x: Mm; y: Mm } {
  return {
    x: u.includes('w') ? r.x : u.includes('e') ? r.x + r.szer : r.x + r.szer / 2,
    y: u.includes('n') ? r.y : u.includes('s') ? r.y + r.wys : r.y + r.wys / 2,
  };
}

/**
 * Zmiana rozmiaru uchwytem (dx, dy – ruch myszy w układzie karty od początku gestu). Przeciwna
 * krawędź (róg) stoi w miejscu; ruchome krawędzie przyciągają się do kandydatów albo siatki.
 * `proporcje` (Shift) zachowuje stosunek boków: róg wg większej zmiany, krawędź – drugi bok wokół środka.
 */
export function zmienRozmiar(
  cel: Cel,
  uchwyt: Uchwyt,
  dxKarta: Mm,
  dyKarta: Mm,
  p: Przyciaganie,
  proporcje = false,
): WynikGestu {
  const R = cel.rect;
  const [dx0, dy0] = doLokalnych(dxKarta, dyKarta, cel.obrotPrzodkow);
  const lewo = uchwyt.includes('w') && cel.osie.szer;
  const prawo = uchwyt.includes('e') && cel.osie.szer;
  const gora = uchwyt.includes('n') && cel.osie.wys;
  const dol = uchwyt.includes('s') && cel.osie.wys;
  let l = R.x + (lewo ? dx0 : 0);
  let r = R.x + R.szer + (prawo ? dx0 : 0);
  let t = R.y + (gora ? dy0 : 0);
  let b = R.y + R.wys + (dol ? dy0 : 0);
  const prowadnice: Prowadnica[] = [];
  const kand =
    p.wylacz || !p.obiekty || cel.obrotPrzodkow !== 0
      ? undefined
      : kandydaciPrzyciagania(cel, new Set([cel.id]));
  const przyciagnij = (v: number, os: 'x' | 'y') => {
    if (p.wylacz) return v;
    const s = kand ? przyciagnijLinie([v], kand[os], p.prog) : undefined;
    if (s) {
      prowadnice.push({ os, polozenie: s.kandydat });
      return s.kandydat;
    }
    return p.siatka > 0 ? naSiatke(v, p.siatka, os === 'x' ? cel.ramka.x : cel.ramka.y) : v;
  };
  const dwaBoki = (lewo || prawo) && (gora || dol);
  const naProporcjach =
    proporcje &&
    cel.osie.szer &&
    cel.osie.wys &&
    (lewo || prawo || gora || dol) &&
    R.szer > 0 &&
    R.wys > 0;
  if (naProporcjach) {
    const wsp = R.szer / R.wys;
    let w = r - l;
    let h = b - t;
    // Dominuje oś o większej względnej zmianie (przy krawędzi – oś uchwytu).
    const szerDominuje = dwaBoki
      ? Math.abs(w / R.szer - 1) >= Math.abs(h / R.wys - 1)
      : lewo || prawo;
    if (szerDominuje) {
      w = Math.max(MIN_ROZMIAR, p.wylacz || p.siatka <= 0 ? w : naSiatke(w, p.siatka));
      h = w / wsp;
    } else {
      h = Math.max(MIN_ROZMIAR, p.wylacz || p.siatka <= 0 ? h : naSiatke(h, p.siatka));
      w = h * wsp;
    }
    // Najmniejszy rozmiar dotyczy obu osi (przy zachowaniu proporcji).
    const mnoznik = Math.max(1, MIN_ROZMIAR / w, MIN_ROZMIAR / h);
    w *= mnoznik;
    h *= mnoznik;
    if (lewo) l = R.x + R.szer - w;
    else if (prawo) r = l + w;
    else {
      l = R.x + R.szer / 2 - w / 2;
      r = l + w;
    }
    if (gora) t = R.y + R.wys - h;
    else if (dol) b = t + h;
    else {
      t = R.y + R.wys / 2 - h / 2;
      b = t + h;
    }
    if (lewo) r = R.x + R.szer;
    if (gora) b = R.y + R.wys;
  } else {
    if (lewo) l = przyciagnij(l, 'x');
    if (prawo) r = przyciagnij(r, 'x');
    if (gora) t = przyciagnij(t, 'y');
    if (dol) b = przyciagnij(b, 'y');
    if (r - l < MIN_ROZMIAR) {
      if (lewo) l = r - MIN_ROZMIAR;
      else r = l + MIN_ROZMIAR;
    }
    if (b - t < MIN_ROZMIAR) {
      if (gora) t = b - MIN_ROZMIAR;
      else b = t + MIN_ROZMIAR;
    }
  }
  const nowy: Prostokat = { x: l, y: t, szer: r - l, wys: b - t };
  return {
    zmiany: new Map([[cel.id, zmianaZProstokata(cel, nowy)]]),
    prowadnice,
    podpowiedz: {
      x: zmianaZProstokata(cel, nowy).pozycja.x,
      y: zmianaZProstokata(cel, nowy).pozycja.y,
      szer: zaokr(nowy.szer),
      wys: zaokr(nowy.wys),
    },
  };
}

/** `pozycja` i rozmiary w mm dla zadanego widocznego prostokąta elementu (kotwica wiąże ten prostokąt). */
export function zmianaZProstokata(cel: Cel, nowy: Prostokat): ZmianaPola {
  const b = pozycjaBazowa(cel);
  const { fx, fy } = ulamkiKotwicy(b.kotwica);
  const zamienione = cel.obrot === 90 || cel.obrot === 270;
  const zmieniaSzer = cel.osie.szer && Math.abs(nowy.szer - cel.rect.szer) > 1e-9;
  const zmieniaWys = cel.osie.wys && Math.abs(nowy.wys - cel.rect.wys) > 1e-9;
  const wynik: ZmianaPola = {
    pozycja: {
      ...b,
      x: zaokr(nowy.x - cel.ramka.x - (cel.ramka.szer - nowy.szer) * fx),
      y: zaokr(nowy.y - cel.ramka.y - (cel.ramka.wys - nowy.wys) * fy),
    },
  };
  // Widoczna szerokość to `wysokosc` elementu, gdy ten jest obrócony o 90° / 270°.
  if (zmieniaSzer) wynik[zamienione ? 'wysokosc' : 'szerokosc'] = { mm: zaokr(nowy.szer) };
  if (zmieniaWys) wynik[zamienione ? 'szerokosc' : 'wysokosc'] = { mm: zaokr(nowy.wys) };
  return wynik;
}

export type Wyrownanie = 'lewo' | 'srodek-poziomo' | 'prawo' | 'gora' | 'srodek-pionowo' | 'dol';
export const WYROWNANIA: readonly Wyrownanie[] = [
  'lewo',
  'srodek-poziomo',
  'prawo',
  'gora',
  'srodek-pionowo',
  'dol',
];

function przesunieteZmiany(cele: readonly Cel[], d: (c: Cel) => [Mm, Mm]): Map<string, ZmianaPola> {
  const zmiany = new Map<string, ZmianaPola>();
  for (const c of cele) {
    const [dx, dy] = d(c);
    const b = pozycjaBazowa(c);
    zmiany.set(c.id, { pozycja: { ...b, x: zaokr(b.x + dx), y: zaokr(b.y + dy) } });
  }
  return zmiany;
}

/**
 * Wyrównanie: kilka elementów – do obwiedni zaznaczenia, jeden – do wnętrza kontenera
 * (karty, gdy kontenerem jest korzeń bez paddingu).
 */
export function wyrownaj(cele: readonly Cel[], jak: Wyrownanie): Map<string, ZmianaPola> {
  if (cele.length === 0) return new Map();
  const ref = cele.length > 1 ? obwiednia(cele.map((c) => c.rect)) : cele[0]!.ramka;
  return przesunieteZmiany(cele, ({ rect: r }) => {
    switch (jak) {
      case 'lewo':
        return [ref.x - r.x, 0];
      case 'prawo':
        return [ref.x + ref.szer - (r.x + r.szer), 0];
      case 'srodek-poziomo':
        return [ref.x + ref.szer / 2 - (r.x + r.szer / 2), 0];
      case 'gora':
        return [0, ref.y - r.y];
      case 'dol':
        return [0, ref.y + ref.wys - (r.y + r.wys)];
      default:
        return [0, ref.y + ref.wys / 2 - (r.y + r.wys / 2)];
    }
  });
}

/** Rozłożenie równo: równe odstępy między kolejnymi elementami (wg początku), obwiednia zaznaczenia zostaje. Co najmniej 3 elementy. */
export function rozlozRowno(
  cele: readonly Cel[],
  os: 'poziomo' | 'pionowo',
): Map<string, ZmianaPola> {
  if (cele.length < 3) return new Map();
  const x = os === 'poziomo';
  const start = (c: Cel) => (x ? c.rect.x : c.rect.y);
  const dl = (c: Cel) => (x ? c.rect.szer : c.rect.wys);
  const posortowane = [...cele].sort((a, b) => start(a) - start(b));
  const pierwszy = posortowane[0]!;
  // Obwiednia zaznaczenia zostaje: od najmniejszego początku do największego końca.
  const rozpietosc = Math.max(...cele.map((c) => start(c) + dl(c))) - start(pierwszy);
  const odstep = (rozpietosc - posortowane.reduce((s, c) => s + dl(c), 0)) / (cele.length - 1);
  const cel = new Map<string, number>();
  let poz = start(pierwszy);
  for (const c of posortowane) {
    cel.set(c.id, poz);
    poz += dl(c) + odstep;
  }
  return przesunieteZmiany(cele, (c) => {
    const d = cel.get(c.id)! - start(c);
    return x ? [d, 0] : [0, d];
  });
}

/** Nakłada zmiany gestu (położenie, rozmiary w mm) na szablon. */
export function zastosujZmiany(s: Szablon, zmiany: ReadonlyMap<string, ZmianaPola>): Szablon {
  let wynik = s;
  for (const [id, z] of zmiany)
    wynik = zmienWezel(
      wynik,
      id,
      (w) =>
        ({
          ...w,
          pozycja: z.pozycja,
          ...(z.szerokosc ? { szerokosc: z.szerokosc } : {}),
          ...(z.wysokosc ? { wysokosc: z.wysokosc } : {}),
        }) as Wezel,
    );
  return wynik;
}

/** Tekst podpowiedzi X·Y w mm (przecinek dziesiętny, co najmniej jedna cyfra po przecinku). */
export function liczbaMm(v: number): string {
  return formatujLiczbeZUlamkiem(v, 2);
}
