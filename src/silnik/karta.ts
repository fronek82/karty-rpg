import type { Mm } from '../model/jednostki';
import {
  czyKontener,
  korzenKarty,
  type NapisSzablonu,
  rozwinOdstepy,
  wymiaryKarty,
  type Karta,
  type DopasowanieObrazu,
  type Obramowanie,
  type Pole,
  type PoleObraz,
  kluczeTabeli,
  kluczKomorki,
  type PoleTabela,
  type PoleTekst,
  type PoleWartosc,
  type RamkaKarty,
  type StylLinii,
  type StylTekstu,
  type Szablon,
  type UstawieniaObrazu,
  type Wezel,
} from '../model/szablon';
import type { RejestrCzcionek } from './czcionki';
import { konturIkony } from './ikony';
import type { DefinicjaGlifu, ElementSceny, Kontur, Obrys, Scena } from './scena';
import {
  parsujFormatowanie,
  tekstNaScene,
  ulozDopasowany,
  ulozTekst,
  type Fragment,
  type UkladTekstu,
} from './tekst';
import {
  rozmiesc,
  type KontekstUkladu,
  type Ograniczenie,
  type UlozonyWezel,
  type Wymiary,
} from './uklad';

export interface InformacjaOObrazie {
  /** Proporcje obrazu (szerokość / wysokość w dowolnych jednostkach). */
  szerokosc: number;
  wysokosc: number;
}

export interface KontekstRenderowania {
  czcionki: RejestrCzcionek;
  /** Wymiary obrazu z biblioteki; undefined = brak zasobu. */
  obraz?: (zasob: string) => InformacjaOObrazie | undefined;
}

export interface Ostrzezenie {
  pole: string;
  komunikat:
    | 'tekst-nie-miesci-sie'
    | 'brak-obrazu'
    | 'brak-znakow'
    | 'brak-miejsca-na-obraz'
    | 'nieznane-pole-do-omijania';
  szczegoly?: string;
}

export interface WyrenderowanaKarta {
  scena: Scena;
  ostrzezenia: Ostrzezenie[];
  /** Położenia widocznych węzłów (mm od rogu karty) – do zaznaczania w edytorze szablonu. */
  wezly: { id: string; x: Mm; y: Mm; szer: Mm; wys: Mm }[];
}

const CZARNY = '#000000';

/**
 * Dane karty uzupełnione o wartości domyślne parametrów szablonu.
 * Niepusta wartość w danych karty ma pierwszeństwo.
 */
export function daneZParametrami(
  szablon: Szablon,
  dane: Record<string, string>,
): Record<string, string> {
  const wynik: Record<string, string> = {};
  for (const p of szablon.parametry ?? []) wynik[p.klucz] = p.domyslnie;
  for (const [k, v] of Object.entries(dane)) if (v.trim() !== '' || !(k in wynik)) wynik[k] = v;
  return wynik;
}

/** Napis z szablonu: stały albo wartość parametru (z danych karty lub domyślna). */
export function napis(n: NapisSzablonu | undefined, dane: Record<string, string>): string {
  if (n === undefined) return '';
  return typeof n === 'string' ? n : (dane[n.parametr] ?? '');
}

/** Wartość pola z danych karty albo wartość stała/domyślna z szablonu. */
export function wartoscPola(pole: Pole, dane: Record<string, string>): string {
  const zDanych = pole.klucz !== undefined ? dane[pole.klucz] : undefined;
  if (zDanych !== undefined && zDanych.trim() !== '') return zDanych;
  switch (pole.typ) {
    case 'tekst':
    case 'wartosc':
      return napis(pole.tekst, dane);
    case 'obraz':
      return pole.zasob ?? '';
    case 'znaczniki':
      return String(pole.kolumny * pole.rzedy);
    case 'wpis':
      return '';
    case 'ikona':
      // Ikona bez klucza jest zawsze widoczna; z kluczem – gdy w danych coś jest.
      return pole.klucz !== undefined ? '' : '1';
    case 'separator':
      return '1';
    case 'tabela':
      // Tabela jest „pusta”, gdy wszystkie komórki wartości są puste.
      return kluczeTabeli(pole)
        .map((k) => dane[k] ?? '')
        .join('');
  }
}

export function czyPuste(pole: Pole, dane: Record<string, string>): boolean {
  // Pole do wpisania to sama ramka (i sufiks) – nigdy nie jest „puste”.
  if (pole.typ === 'wpis') return false;
  const v = wartoscPola(pole, dane).trim();
  if (pole.typ === 'znaczniki') return liczbaZnacznikow(v) === 0;
  return v === '';
}

function fragmentyTekstu(
  pole: PoleTekst,
  wartosc: string,
  dane: Record<string, string>,
): Fragment[] {
  const tresc: Fragment[] =
    wartosc === ''
      ? []
      : pole.formatowanie === false
        ? [{ tekst: wartosc, styl: pole.styl }]
        : parsujFormatowanie(wartosc, pole.styl);
  const etykieta = pole.etykieta ? napis(pole.etykieta.tekst, dane) : '';
  if (!pole.etykieta || etykieta === '') return tresc;
  const styl = { ...pole.styl, ...pole.etykieta.styl };
  if (pole.etykieta.pozycja === 'pod') {
    return [...tresc, { tekst: (tresc.length > 0 ? '\n' : '') + etykieta, styl, etykieta: true }];
  }
  const odstep = pole.etykieta.pozycja === 'nad' ? '\n' : ' ';
  return [{ tekst: etykieta + (tresc.length > 0 ? odstep : ''), styl, etykieta: true }, ...tresc];
}

/** Etykieta wartości w kształcie (nad / pod), ułożona w jeden wiersz. */
function etykietaWartosci(
  pole: PoleWartosc,
  dane: Record<string, string>,
  ctx: KontekstRenderowania,
): { uklad: UkladTekstu; fragmenty: Fragment[]; styl: StylTekstu; odstep: Mm } | undefined {
  const tekst = pole.etykieta ? napis(pole.etykieta.tekst, dane) : '';
  if (!pole.etykieta || tekst === '') return undefined;
  const styl = { ...pole.styl, ...pole.etykieta.styl };
  const fragmenty = [{ tekst, styl, etykieta: true }];
  return {
    uklad: ulozTekst(fragmenty, undefined, ctx.czcionki),
    fragmenty,
    styl,
    odstep: pole.etykieta.odstep ?? 0.5,
  };
}

/** Podział ramki wartości na pasek etykiety i obszar kształtu (tło, ramka, treść). */
function podzialWartosci(
  pole: PoleWartosc,
  r: Ramka,
  dane: Record<string, string>,
  ctx: KontekstRenderowania,
): {
  ksztalt: Ramka;
  etykieta?: { ramka: Ramka; fragmenty: Fragment[]; styl: StylTekstu };
} {
  const e = etykietaWartosci(pole, dane, ctx);
  if (!e) return { ksztalt: r };
  const h = Math.min(r.wys, e.uklad.wysokosc);
  const reszta = Math.max(0, r.wys - h - e.odstep);
  const nad = pole.etykieta!.pozycja === 'nad';
  return {
    ksztalt: { x: r.x, y: nad ? r.y + r.wys - reszta : r.y, szer: r.szer, wys: reszta },
    etykieta: {
      ramka: { x: r.x, y: nad ? r.y : r.y + r.wys - h, szer: r.szer, wys: h },
      fragmenty: e.fragmenty,
      styl: e.styl,
    },
  };
}

/** Górny limit znaczników na jednej karcie (ochrona przed błędem w danych). */
export const MAKS_ZNACZNIKOW = 60;

/** Liczba znaczników z wartości: całkowita, od 0 do MAKS_ZNACZNIKOW. */
export function liczbaZnacznikow(v: string): number {
  const n = Math.floor(Number(v.replace(',', '.')));
  return Number.isFinite(n) ? Math.min(MAKS_ZNACZNIKOW, Math.max(0, n)) : 0;
}

/** Liczba kolumn i rzędów znaczników dla danej liczby. */
function siatkaZnacznikow(kolumnyWzoru: number, rzedy: number, liczba: number) {
  const kolumny = Math.max(1, Math.floor(kolumnyWzoru));
  if (liczba === kolumny * rzedy) return { kolumny, rzedy };
  return { kolumny: Math.min(kolumny, liczba), rzedy: Math.ceil(liczba / kolumny) };
}

function wzorKreski(styl: StylLinii | undefined, grubosc: Mm): Mm[] | undefined {
  if (styl === 'przerywana') return [Math.max(1, grubosc * 4), Math.max(0.6, grubosc * 2.5)];
  if (styl === 'kropkowana') return [grubosc, grubosc * 1.5];
  return undefined;
}

function obrys(o: Obramowanie): Obrys | undefined {
  if (!(o.grubosc > 0)) return undefined;
  const kreska = wzorKreski(o.styl, o.grubosc);
  return kreska
    ? { kolor: o.kolor, grubosc: o.grubosc, kreska }
    : { kolor: o.kolor, grubosc: o.grubosc };
}

/** Renderuje kartę na scenę (mm). Silnik nie zależy od DOM – działa w testach, workerze i UI. */
export function renderujKarte(
  szablon: Szablon,
  karta: Pick<Karta, 'dane' | 'rozmiar' | 'obrazy'>,
  ctx: KontekstRenderowania,
): WyrenderowanaKarta {
  const { szer, wys } = wymiaryKarty(szablon, karta);
  const dane = daneZParametrami(szablon, karta.dane);
  const glify: Record<string, DefinicjaGlifu> = {};
  const elementy: ElementSceny[] = [];
  const ostrzezenia: Ostrzezenie[] = [];

  const kontekst: KontekstUkladu = {
    czyUkryty: (w) =>
      !czyKontener(w) && (w.gdyPuste ?? 'pokaz-ramke') === 'ukryj' && czyPuste(w, dane),
    zmierzPole: (pole, ogr) => zmierzPole(pole, ogr, dane, ctx),
  };

  if (szablon.tlo) {
    elementy.push({
      typ: 'prostokat',
      x: 0,
      y: 0,
      szer,
      wys,
      promien: szablon.promienRogow,
      wypelnienie: szablon.tlo,
    });
  }
  const korzen = rozmiesc(korzenKarty(szablon, karta), 0, 0, szer, wys, kontekst);
  // Położenia wszystkich widocznych węzłów – obraz może omijać pola rysowane nad nim.
  const ulozone = new Map<string, UlozonyWezel>();
  const zbierz = (u: UlozonyWezel) => {
    ulozone.set(u.wezel.id, u);
    u.dzieci.forEach(zbierz);
  };
  zbierz(korzen);
  // Wszystkie węzły szablonu (także ukryte) – do sprawdzenia identyfikatorów w `omijaj`.
  const wezlySzablonu = new Set<string>();
  const zbierzSzablon = (w: Wezel) => {
    wezlySzablonu.add(w.id);
    if (czyKontener(w)) w.dzieci.forEach(zbierzSzablon);
  };
  zbierzSzablon(korzen.wezel);

  const rysuj = (u: UlozonyWezel) => {
    const w = u.wezel;
    // Wartość z etykietą: tło, ramka i treść – tylko w obszarze kształtu, etykieta osobno.
    const podzial =
      !czyKontener(w) && w.typ === 'wartosc' ? podzialWartosci(w, u, dane, ctx) : undefined;
    const obszar: Ramka = podzial?.ksztalt ?? u;
    const promien = promienWezla(w, obszar);
    const ksztalt =
      !czyKontener(w) && w.typ === 'wartosc' && KSZTALTY_SCIEZKI.has(w.ksztalt)
        ? (w.ksztalt as KsztaltSciezki)
        : undefined;
    if (w.tlo) {
      elementy.push(
        ksztalt === 'sciety'
          ? { typ: 'sciezka', kontur: konturScietego(obszar, promien ?? 0), wypelnienie: w.tlo }
          : ksztalt
            ? { typ: 'sciezka', kontur: konturKsztaltu(ksztalt, obszar), wypelnienie: w.tlo }
            : {
                typ: 'prostokat',
                x: obszar.x,
                y: obszar.y,
                szer: obszar.szer,
                wys: obszar.wys,
                promien,
                wypelnienie: w.tlo,
              },
      );
    }
    if (podzial?.etykieta) {
      // Etykieta w jednym wierszu, zmniejszana do `minRozmiar`, gdy jest szersza niż pole.
      const e = podzial.etykieta;
      const uklad = ulozDopasowany(
        e.fragmenty,
        e.ramka.szer,
        e.ramka.wys,
        ctx.czcionki,
        false,
        minimalnaSkala(e.styl),
      );
      if (uklad.przepelnienie) ostrzezenia.push({ pole: w.id, komunikat: 'tekst-nie-miesci-sie' });
      dodajOstrzezenieZnakow(w.id, e.fragmenty, ctx, ostrzezenia);
      elementy.push(
        ...tekstNaScene(
          uklad,
          e.ramka,
          e.styl.wyrownanie ?? 'srodek',
          'srodek',
          glify,
          e.styl.obwodka,
        ),
      );
    }
    // Tabela z pustymi wartościami (i „pokaż ramkę”) rysuje nagłówki i siatkę – do wypełnienia.
    if (!czyKontener(w) && (!czyPuste(w, dane) || w.typ === 'tabela')) {
      const p = rozwinOdstepy(w.padding);
      const ramka = {
        x: obszar.x + p.lewo,
        y: obszar.y + p.gora,
        szer: Math.max(0, obszar.szer - p.lewo - p.prawo),
        wys: Math.max(0, obszar.wys - p.gora - p.dol),
      };
      if (w.typ === 'obraz') {
        for (const id of w.omijaj ?? [])
          if (!wezlySzablonu.has(id) || id === w.id)
            ostrzezenia.push({ pole: w.id, komunikat: 'nieznane-pole-do-omijania', szczegoly: id });
        // Pole ukryte (np. pusta wartość) nie zajmuje miejsca – obraz może wejść na jego miejsce.
        const przeszkody = (w.omijaj ?? [])
          .filter((id) => id !== w.id)
          .map((id) => ulozone.get(id))
          .filter((x): x is UlozonyWezel => x !== undefined);
        elementy.push(
          ...rysujPoleObrazu(w, ramka, dane, ctx, ostrzezenia, przeszkody, karta.obrazy?.[w.id]),
        );
      } else elementy.push(...rysujPole(w, ramka, dane, ctx, glify, ostrzezenia));
    } else if (!czyKontener(w) && w.typ === 'tekst' && w.etykieta) {
      // Pusta wartość z „pokaż pustą ramkę”: etykieta (np. „Usunięcie:”) zostaje.
      const p = rozwinOdstepy(w.padding);
      const ramka = {
        x: u.x + p.lewo,
        y: u.y + p.gora,
        szer: Math.max(0, u.szer - p.lewo - p.prawo),
        wys: Math.max(0, u.wys - p.gora - p.dol),
      };
      elementy.push(...rysujTekst(w, '', dane, ramka, ctx, glify, ostrzezenia));
    }
    u.dzieci.forEach(rysuj);
    if (w.obramowanie) elementy.push(...rysujObramowanie(w.obramowanie, obszar, promien, ksztalt));
  };
  rysuj(korzen);
  if (szablon.ramka)
    elementy.push(...rysujRamkeKarty(szablon.ramka, szer, wys, szablon.promienRogow));

  return {
    scena: { szer, wys, elementy, glify },
    ostrzezenia,
    wezly: [...ulozone.values()].map((u) => ({
      id: u.wezel.id,
      x: u.x,
      y: u.y,
      szer: u.szer,
      wys: u.wys,
    })),
  };
}

/** Ramka całej karty: linia w odległości `odsuniecie` od krawędzi, rogi zgodne z kartą. */
function rysujRamkeKarty(
  r: RamkaKarty,
  szer: Mm,
  wys: Mm,
  promienRogow: Mm | undefined,
): ElementSceny[] {
  const s = obrys({ grubosc: r.grubosc, kolor: r.kolor, styl: r.styl });
  if (!s) return [];
  const o = (r.odsuniecie ?? 0) + r.grubosc / 2;
  if (szer - 2 * o <= 0 || wys - 2 * o <= 0) return [];
  const promien = r.promien ?? Math.max(0, (promienRogow ?? 0) - o);
  return [
    {
      typ: 'prostokat',
      x: o,
      y: o,
      szer: szer - 2 * o,
      wys: wys - 2 * o,
      ...(promien > 0 ? { promien } : {}),
      obrys: s,
    },
  ];
}

/**
 * Romb wpisany w prostokąt; `wciecie` przesuwa boki do środka (prostopadle) – np. o pół grubości
 * linii, żeby zewnętrzna krawędź obrysu pokrywała się z tłem.
 */
type KsztaltSciezki = 'sciety' | 'romb' | 'tarcza' | 'szesciokat';
const KSZTALTY_SCIEZKI = new Set<string>(['sciety', 'romb', 'tarcza', 'szesciokat']);

/** Prostokąt treści wpisany w kształt – ułamki wymiarów kształtu (x, y, szerokość, wysokość). */
const WNETRZA: Partial<
  Record<PoleWartosc['ksztalt'], { x: number; y: number; szer: number; wys: number }>
> = {
  romb: { x: 0.25, y: 0.25, szer: 0.5, wys: 0.5 },
  szesciokat: { x: 0.25, y: 0, szer: 0.5, wys: 1 },
  tarcza: { x: 0.15, y: 0.08, szer: 0.7, wys: 0.55 },
};

/** Kontur kształtu wartości (romb, tarcza, sześciokąt) przesunięty do środka o `wciecie`. */
export function konturKsztaltu(
  k: Exclude<KsztaltSciezki, 'sciety'>,
  r: Ramka,
  wciecie: Mm = 0,
): Kontur {
  if (k === 'romb') return konturRombu(r, wciecie);
  const x = r.x + wciecie;
  const y = r.y + wciecie;
  const w = Math.max(0, r.szer - 2 * wciecie);
  const h = Math.max(0, r.wys - 2 * wciecie);
  if (k === 'szesciokat') {
    // Płaska góra i dół, ścięte boki (ścięcie = ćwierć szerokości).
    const c = w / 4;
    return [
      ['M', x + c, y],
      ['L', x + w - c, y],
      ['L', x + w, y + h / 2],
      ['L', x + w - c, y + h],
      ['L', x + c, y + h],
      ['L', x, y + h / 2],
      ['Z'],
    ];
  }
  // Tarcza: prosta góra, boki do 55% wysokości, łuki do szpica na dole.
  const bok = y + h * 0.55;
  return [
    ['M', x, y],
    ['L', x + w, y],
    ['L', x + w, bok],
    ['C', x + w, y + h * 0.8, x + w * 0.75, y + h * 0.92, x + w / 2, y + h],
    ['C', x + w * 0.25, y + h * 0.92, x, y + h * 0.8, x, bok],
    ['Z'],
  ];
}

export function konturRombu(r: Ramka, wciecie: Mm = 0): Kontur {
  const a = r.szer / 2;
  const b = r.wys / 2;
  const cx = r.x + a;
  const cy = r.y + b;
  const przek = Math.hypot(a, b);
  const a2 = b > 0 ? Math.max(0, a - (wciecie * przek) / b) : 0;
  const b2 = a > 0 ? Math.max(0, b - (wciecie * przek) / a) : 0;
  return [['M', cx, cy - b2], ['L', cx + a2, cy], ['L', cx, cy + b2], ['L', cx - a2, cy], ['Z']];
}

function promienWezla(w: Wezel, u: { szer: Mm; wys: Mm }): Mm | undefined {
  if (!czyKontener(w) && w.typ === 'wartosc' && w.ksztalt === 'kolo')
    return Math.min(u.szer, u.wys) / 2;
  return w.promien;
}

function rysujObramowanie(
  o: Obramowanie,
  u: Ramka,
  promien: Mm | undefined,
  ksztalt?: KsztaltSciezki,
): ElementSceny[] {
  const g = o.grubosc;
  const s = obrys(o);
  if (!s) return [];
  // Romb, tarcza, sześciokąt – zawsze pełny obrys (wybór krawędzi dotyczy prostokątów).
  if (ksztalt && ksztalt !== 'sciety')
    return [{ typ: 'sciezka', kontur: konturKsztaltu(ksztalt, u, g / 2), obrys: s }];
  const k = o.krawedzie;
  if (!k && ksztalt === 'sciety') {
    const wew = {
      x: u.x + g / 2,
      y: u.y + g / 2,
      szer: Math.max(0, u.szer - g),
      wys: Math.max(0, u.wys - g),
    };
    // Ścięcie mierzone na zewnętrznej krawędzi (jak tło). Ośmiokąt przesunięty do środka o g/2
    // ma ścięcie mniejsze o (2 − √2)·g/2 – wtedy zewnętrzna krawędź linii pokrywa się z tłem.
    return [
      {
        typ: 'sciezka',
        kontur: konturScietego(wew, Math.max(0, (promien ?? 0) - ((2 - Math.SQRT2) * g) / 2)),
        obrys: s,
      },
    ];
  }
  if (!k) {
    // Linia w całości wewnątrz węzła: przesunięta o pół grubości.
    return [
      {
        typ: 'prostokat',
        x: u.x + g / 2,
        y: u.y + g / 2,
        szer: Math.max(0, u.szer - g),
        wys: Math.max(0, u.wys - g),
        promien: promien === undefined ? undefined : Math.max(0, promien - g / 2),
        obrys: s,
      },
    ];
  }
  const l = u.x;
  const p = u.x + u.szer;
  const gr = u.y;
  const d = u.y + u.wys;
  const linie: ElementSceny[] = [];
  if (k.gora) linie.push({ typ: 'linia', x1: l, y1: gr + g / 2, x2: p, y2: gr + g / 2, obrys: s });
  if (k.dol) linie.push({ typ: 'linia', x1: l, y1: d - g / 2, x2: p, y2: d - g / 2, obrys: s });
  if (k.lewo) linie.push({ typ: 'linia', x1: l + g / 2, y1: gr, x2: l + g / 2, y2: d, obrys: s });
  if (k.prawo) linie.push({ typ: 'linia', x1: p - g / 2, y1: gr, x2: p - g / 2, y2: d, obrys: s });
  return linie;
}

/** Prostokąt ze ściętymi rogami (ośmiokąt) – ramka wartości, np. „-1 obr” na zbroi. */
export function konturScietego(r: { x: Mm; y: Mm; szer: Mm; wys: Mm }, sciecie: Mm): Kontur {
  const c = Math.max(0, Math.min(sciecie, r.szer / 2, r.wys / 2));
  const { x, y, szer: w, wys: h } = r;
  return [
    ['M', x + c, y],
    ['L', x + w - c, y],
    ['L', x + w, y + c],
    ['L', x + w, y + h - c],
    ['L', x + w - c, y + h],
    ['L', x + c, y + h],
    ['L', x, y + h - c],
    ['L', x, y + c],
    ['Z'],
  ];
}

function zmierzPole(
  pole: Pole,
  ogr: Ograniczenie,
  dane: Record<string, string>,
  ctx: KontekstRenderowania,
): Wymiary {
  const wartosc = wartoscPola(pole, dane);
  switch (pole.typ) {
    case 'tekst': {
      const fr = fragmentyTekstu(pole, wartosc, dane);
      if (fr.length === 0) return { szer: 0, wys: 0 };
      const naturalny = ulozTekst(fr, undefined, ctx.czcionki);
      if (
        pole.wieleWierszy === false ||
        ogr.szer === undefined ||
        naturalny.szerokosc <= ogr.szer
      ) {
        return { szer: naturalny.szerokosc, wys: naturalny.wysokosc };
      }
      const zlamany = ulozTekst(fr, ogr.szer, ctx.czcionki);
      return { szer: Math.min(ogr.szer, zlamany.szerokosc), wys: zlamany.wysokosc };
    }
    case 'wartosc': {
      const u = ulozTekst([{ tekst: wartosc, styl: pole.styl }], undefined, ctx.czcionki);
      let k: Wymiary = { szer: u.szerokosc, wys: u.wysokosc };
      if (pole.ksztalt === 'kolo' || pole.ksztalt === 'kwadrat') {
        const bok = Math.max(u.szerokosc, u.wysokosc);
        k = { szer: bok, wys: bok };
      } else {
        // Kształt z wnętrzem mniejszym niż obrys: rozmiar taki, żeby tekst (z odsunięciem od
        // obrysu) zmieścił się we wnętrzu – odwrotność `wnetrzeKsztaltu`.
        const w = WNETRZA[pole.ksztalt];
        if (w) {
          const m = marginesRombu(pole);
          k = { szer: (u.szerokosc + 2 * m) / w.szer, wys: (u.wysokosc + 2 * m) / w.wys };
        }
      }
      const e = etykietaWartosci(pole, dane, ctx);
      return e
        ? { szer: Math.max(k.szer, e.uklad.szerokosc), wys: k.wys + e.uklad.wysokosc + e.odstep }
        : k;
    }
    case 'separator':
      // Długość 0 – linię wydłuża rozciągnięcie w rodzicu; inaczej separator rozpychałby
      // kontenery mierzone wg treści.
      return pole.kierunek === 'poziomy'
        ? { szer: 0, wys: pole.grubosc }
        : { szer: pole.grubosc, wys: 0 };
    case 'tabela': {
      if (pole.kolumny.length === 0) return { szer: 0, wys: 0 };
      const t = ukladTabeli(pole, dane, ctx, skalaTabeli(pole, dane, ctx, ogr.szer));
      return { szer: Math.min(t.szer, ogr.szer ?? t.szer), wys: t.wys };
    }
    case 'obraz':
      return { szer: ogr.szer ?? 0, wys: ogr.wys ?? 0 };
    case 'znaczniki': {
      const s = siatkaZnacznikow(pole.kolumny, pole.rzedy, liczbaZnacznikow(wartosc));
      return {
        szer: s.kolumny * pole.srednica + Math.max(0, s.kolumny - 1) * pole.odstep,
        wys: s.rzedy * pole.srednica + Math.max(0, s.rzedy - 1) * pole.odstep,
      };
    }
    case 'wpis': {
      const u = ulozTekst(
        [{ tekst: napis(pole.sufiks, dane) || ' ', styl: pole.styl }],
        undefined,
        ctx.czcionki,
      );
      return { szer: ogr.szer ?? u.szerokosc, wys: u.wysokosc };
    }
    case 'ikona':
      return { szer: pole.rozmiar, wys: pole.rozmiar };
  }
}

type Ramka = { x: Mm; y: Mm; szer: Mm; wys: Mm };

function rysujTekst(
  pole: PoleTekst,
  wartosc: string,
  dane: Record<string, string>,
  ramka: Ramka,
  ctx: KontekstRenderowania,
  glify: Record<string, DefinicjaGlifu>,
  ostrzezenia: Ostrzezenie[],
): ElementSceny[] {
  const fr = fragmentyTekstu(pole, wartosc, dane);
  if (fr.length === 0) return [];
  const wieleWierszy = pole.wieleWierszy !== false;
  const minSkala = minimalnaSkala(pole.styl);
  const uklad = ulozDopasowany(fr, ramka.szer, ramka.wys, ctx.czcionki, wieleWierszy, minSkala);
  if (uklad.przepelnienie) ostrzezenia.push({ pole: pole.id, komunikat: 'tekst-nie-miesci-sie' });
  dodajOstrzezenieZnakow(pole.id, fr, ctx, ostrzezenia);
  return tekstNaScene(
    uklad,
    ramka,
    pole.styl.wyrownanie ?? 'lewo',
    pole.styl.wyrownaniePionowe ?? 'poczatek',
    glify,
    pole.styl.obwodka,
  );
}

/** Najmniejsza skala auto-dopasowania – nigdy poniżej 25% (tekst nieczytelny = przepełnienie). */
function minimalnaSkala(styl: { rozmiar: Mm; minRozmiar?: Mm }): number {
  if (styl.minRozmiar === undefined || !(styl.rozmiar > 0)) return 1;
  return Math.min(1, Math.max(0.25, styl.minRozmiar / styl.rozmiar));
}

function dodajOstrzezenieZnakow(
  id: string,
  fr: Fragment[],
  ctx: KontekstRenderowania,
  ostrzezenia: Ostrzezenie[],
) {
  const braki = new Set<string>();
  for (const f of fr) {
    const tekst = f.styl.wielkieLitery ? f.tekst.toLocaleUpperCase('pl') : f.tekst;
    for (const z of ctx.czcionki.pobierz(f.styl.czcionka, f.styl.wariant).brakujaceZnaki(tekst))
      braki.add(z);
  }
  if (braki.size > 0)
    ostrzezenia.push({ pole: id, komunikat: 'brak-znakow', szczegoly: [...braki].join('') });
}

function rysujPole(
  pole: Pole,
  ramkaPola: Ramka,
  dane: Record<string, string>,
  ctx: KontekstRenderowania,
  glify: Record<string, DefinicjaGlifu>,
  ostrzezenia: Ostrzezenie[],
): ElementSceny[] {
  const wartosc = wartoscPola(pole, dane);
  let ramka = ramkaPola;
  switch (pole.typ) {
    case 'tekst':
      return rysujTekst(pole, wartosc, dane, ramka, ctx, glify, ostrzezenia);
    case 'wartosc': {
      const fr = [{ tekst: wartosc, styl: pole.styl }];
      const minSkala = minimalnaSkala(pole.styl);
      const w = WNETRZA[pole.ksztalt];
      if (w) {
        // Treść w prostokącie wpisanym w kształt, odsunięta od obrysu.
        const m = marginesRombu(pole);
        ramka = {
          x: ramka.x + ramka.szer * w.x + m,
          y: ramka.y + ramka.wys * w.y + m,
          szer: Math.max(0, ramka.szer * w.szer - 2 * m),
          wys: Math.max(0, ramka.wys * w.wys - 2 * m),
        };
      }
      const uklad = ulozDopasowany(fr, ramka.szer, ramka.wys, ctx.czcionki, false, minSkala);
      if (uklad.przepelnienie)
        ostrzezenia.push({ pole: pole.id, komunikat: 'tekst-nie-miesci-sie' });
      dodajOstrzezenieZnakow(pole.id, fr, ctx, ostrzezenia);
      return tekstNaScene(
        uklad,
        ramka,
        pole.styl.wyrownanie ?? 'srodek',
        pole.styl.wyrownaniePionowe ?? 'srodek',
        glify,
        pole.styl.obwodka,
      );
    }
    case 'obraz':
      return rysujPoleObrazu(pole, ramka, dane, ctx, ostrzezenia, [], undefined);
    case 'znaczniki': {
      const s = siatkaZnacznikow(pole.kolumny, pole.rzedy, liczbaZnacznikow(wartosc));
      const liczba = liczbaZnacznikow(wartosc);
      const kolor = pole.kolor ?? CZARNY;
      const wynik: ElementSceny[] = [];
      for (let i = 0; i < liczba; i++) {
        const kol = i % s.kolumny;
        const rz = Math.floor(i / s.kolumny);
        const x = ramka.x + kol * (pole.srednica + pole.odstep);
        const y = ramka.y + rz * (pole.srednica + pole.odstep);
        const o = { kolor, grubosc: pole.grubosc };
        if (pole.ksztalt === 'kolo') {
          const r = pole.srednica / 2;
          wynik.push({ typ: 'okrag', cx: x + r, cy: y + r, r: r - pole.grubosc / 2, obrys: o });
        } else {
          const g = pole.grubosc;
          wynik.push({
            typ: 'prostokat',
            x: x + g / 2,
            y: y + g / 2,
            szer: pole.srednica - g,
            wys: pole.srednica - g,
            obrys: o,
          });
        }
      }
      return wynik;
    }
    case 'wpis': {
      const wynik: ElementSceny[] = [];
      const sufiks = napis(pole.sufiks, dane);
      if (sufiks) {
        const u = ulozTekst([{ tekst: sufiks, styl: pole.styl }], undefined, ctx.czcionki);
        wynik.push(
          ...tekstNaScene(
            u,
            ramka,
            'prawo',
            pole.styl.wyrownaniePionowe ?? 'srodek',
            glify,
            pole.styl.obwodka,
          ),
        );
      }
      // Tekst wpisany w danych (np. stan sakiewki); bez klucza ramka zostaje pusta.
      const wpisany = pole.klucz !== undefined ? (dane[pole.klucz] ?? '').trim() : '';
      if (wpisany !== '') {
        const u = ulozTekst([{ tekst: wpisany, styl: pole.styl }], undefined, ctx.czcionki);
        wynik.push(
          ...tekstNaScene(
            u,
            ramka,
            'lewo',
            pole.styl.wyrownaniePionowe ?? 'srodek',
            glify,
            pole.styl.obwodka,
          ),
        );
      }
      return wynik;
    }
    case 'separator': {
      const s = obrys({ grubosc: pole.grubosc, kolor: pole.kolor ?? CZARNY, styl: pole.stylLinii });
      if (!s) return [];
      const cx = ramka.x + ramka.szer / 2;
      const cy = ramka.y + ramka.wys / 2;
      return [
        pole.kierunek === 'poziomy'
          ? { typ: 'linia', x1: ramka.x, y1: cy, x2: ramka.x + ramka.szer, y2: cy, obrys: s }
          : { typ: 'linia', x1: cx, y1: ramka.y, x2: cx, y2: ramka.y + ramka.wys, obrys: s },
      ];
    }
    case 'tabela':
      return rysujTabele(pole, ramka, dane, ctx, glify, ostrzezenia);
    case 'ikona': {
      const bok = Math.min(pole.rozmiar, ramka.szer, ramka.wys);
      const x = ramka.x + (ramka.szer - bok) / 2;
      const y = ramka.y + (ramka.wys - bok) / 2;
      return [
        {
          typ: 'sciezka',
          kontur: konturIkony(pole.ikona, x, y, bok),
          wypelnienie: pole.kolor ?? CZARNY,
        },
      ];
    }
  }
}

const PADDING_KOMORKI = 0.8;

/** Odsunięcie treści rombu od narożników prostokąta wpisanego – grubość obrysu. */
const marginesRombu = (pole: PoleWartosc): Mm => pole.obramowanie?.grubosc ?? 0;

interface UkladTabeli {
  szer: Mm;
  wys: Mm;
  /** Szerokości kolumn (mm) – naturalne albo rozciągnięte do zadanej szerokości. */
  kolumny: Mm[];
  /** Wysokość wiersza nagłówków (0 – bez nagłówków). */
  wysNaglowka: Mm;
  /** Wysokości wierszy wartości. */
  wysWierszy: Mm[];
  naglowki: UkladTekstu[];
  /** Komórki wartości: [wiersz][kolumna]. */
  wartosci: UkladTekstu[][];
  styl: StylTekstu;
  stylNaglowka: StylTekstu;
}

/** Liczba wierszy wartości tabeli (co najmniej 1). */
const wierszeTabeli = (pole: PoleTabela) => Math.max(1, Math.floor(pole.wiersze ?? 1));

/**
 * Układ tabeli w skali `skala`. Z `szerokosc` – kolumny rozciągnięte: wolne miejsce dostają kolumny
 * „wypełnij” (wg wag), a gdy ich nie ma – kolumny „auto” po równo.
 */
function ukladTabeli(
  pole: PoleTabela,
  dane: Record<string, string>,
  ctx: KontekstRenderowania,
  skala: number,
  szerokosc?: Mm,
): UkladTabeli {
  const pad = pole.paddingKomorki ?? PADDING_KOMORKI;
  const styl = pole.styl;
  const stylNaglowka: StylTekstu = { ...pole.styl, wariant: 'pogrubiony', ...pole.stylNaglowka };
  const zNaglowkami = pole.naglowki !== false;
  const naglowki = pole.kolumny.map((k) =>
    ulozTekst(
      [{ tekst: zNaglowkami ? k.naglowek : '', styl: stylNaglowka }],
      undefined,
      ctx.czcionki,
      skala,
    ),
  );
  const wartosci = Array.from({ length: wierszeTabeli(pole) }, (_, r) =>
    pole.kolumny.map((k) =>
      ulozTekst([{ tekst: dane[kluczKomorki(k, r)] ?? '', styl }], undefined, ctx.czcionki, skala),
    ),
  );
  const kolumny = pole.kolumny.map((k, i) => {
    const sz = k.szerokosc;
    if (sz && sz !== 'auto' && 'mm' in sz) return sz.mm;
    return (
      Math.max(zNaglowkami ? naglowki[i]!.szerokosc : 0, ...wartosci.map((w) => w[i]!.szerokosc)) +
      2 * pad
    );
  });
  const naturalna = kolumny.reduce((a, b) => a + b, 0);
  if (szerokosc !== undefined && szerokosc > naturalna + 1e-6) {
    const wolne = szerokosc - naturalna;
    const wagi = pole.kolumny.map((k) =>
      k.szerokosc && k.szerokosc !== 'auto' && 'wypelnij' in k.szerokosc ? k.szerokosc.wypelnij : 0,
    );
    const sumaWag = wagi.reduce((a, b) => a + b, 0);
    const auto = pole.kolumny.map((k) => (!k.szerokosc || k.szerokosc === 'auto' ? 1 : 0));
    const ileAuto = auto.reduce<number>((a, b) => a + b, 0);
    kolumny.forEach((_, i) => {
      if (sumaWag > 0) kolumny[i]! += (wolne * wagi[i]!) / sumaWag;
      else if (ileAuto > 0) kolumny[i]! += (wolne * auto[i]!) / ileAuto;
    });
  }
  const wysNaglowka = zNaglowkami ? Math.max(0, ...naglowki.map((u) => u.wysokosc)) + 2 * pad : 0;
  const wysWierszy = wartosci.map((w) => Math.max(0, ...w.map((u) => u.wysokosc)) + 2 * pad);
  return {
    szer: kolumny.reduce((a, b) => a + b, 0),
    wys: wysNaglowka + wysWierszy.reduce((a, b) => a + b, 0),
    kolumny,
    wysNaglowka,
    wysWierszy,
    naglowki,
    wartosci,
    styl,
    stylNaglowka,
  };
}

/**
 * Skala tabeli mieszczącej się w szerokości: szerokość rośnie prawie liniowo ze skalą (stałe są
 * kolumny w mm i odstępy komórek), więc skala liczona wprost, zaokrąglona w dół do kroku 2%,
 * z korektą; nie mniej niż `minRozmiar`. Wspólna dla pomiaru i rysowania.
 */
function skalaTabeli(
  pole: PoleTabela,
  dane: Record<string, string>,
  ctx: KontekstRenderowania,
  szerokosc: Mm | undefined,
): number {
  if (szerokosc === undefined || pole.kolumny.length === 0) return 1;
  const pelna = ukladTabeli(pole, dane, ctx, 1);
  if (pelna.szer <= szerokosc + 1e-6) return 1;
  const pad = pole.paddingKomorki ?? PADDING_KOMORKI;
  const stale = pole.kolumny.reduce(
    (a, k) =>
      a + (k.szerokosc && k.szerokosc !== 'auto' && 'mm' in k.szerokosc ? k.szerokosc.mm : 2 * pad),
    0,
  );
  const minSkala = minimalnaSkala(pole.styl);
  const zmienna = pelna.szer - stale;
  let skala = zmienna > 0 ? Math.floor(((szerokosc - stale) / zmienna) * 50 + 1e-9) / 50 : minSkala;
  skala = Math.min(1, Math.max(minSkala, skala));
  while (
    skala - 0.02 >= minSkala - 1e-9 &&
    ukladTabeli(pole, dane, ctx, skala).szer > szerokosc + 1e-6
  )
    skala -= 0.02;
  return skala;
}

function rysujTabele(
  pole: PoleTabela,
  ramka: Ramka,
  dane: Record<string, string>,
  ctx: KontekstRenderowania,
  glify: Record<string, DefinicjaGlifu>,
  ostrzezenia: Ostrzezenie[],
): ElementSceny[] {
  if (pole.kolumny.length === 0) return [];
  const skala = skalaTabeli(pole, dane, ctx, ramka.szer);
  const t = ukladTabeli(pole, dane, ctx, skala, ramka.szer);
  const pad = pole.paddingKomorki ?? PADDING_KOMORKI;
  const zNaglowkami = t.wysNaglowka > 0;
  // Za szeroka mimo zmniejszenia, za niska albo komórka (np. kolumna o stałej szerokości)
  // węższa niż jej treść – tekst wyszedłby poza siatkę.
  const zaWaskaKomorka = t.kolumny.some(
    (sz, i) =>
      Math.max(
        zNaglowkami ? t.naglowki[i]!.szerokosc : 0,
        ...t.wartosci.map((w) => w[i]!.szerokosc),
      ) >
      sz - 2 * pad + 1e-6,
  );
  if (t.szer > ramka.szer + 1e-6 || t.wys > ramka.wys + 1e-6 || zaWaskaKomorka)
    ostrzezenia.push({ pole: pole.id, komunikat: 'tekst-nie-miesci-sie' });
  const wynik: ElementSceny[] = [];
  const { x, y } = ramka;
  if (pole.tloNaglowka && zNaglowkami)
    wynik.push({
      typ: 'prostokat',
      x,
      y,
      szer: t.szer,
      wys: t.wysNaglowka,
      wypelnienie: pole.tloNaglowka,
    });
  const wyrownanie = t.styl.wyrownanie ?? 'srodek';
  let kx = x;
  t.kolumny.forEach((sz, i) => {
    const kom = (yy: Mm, h: Mm) => ({
      x: kx + pad,
      y: yy + pad,
      szer: Math.max(0, sz - 2 * pad),
      wys: Math.max(0, h - 2 * pad),
    });
    const wyrKolumny = pole.kolumny[i]!.wyrownanie ?? wyrownanie;
    if (zNaglowkami)
      wynik.push(
        ...tekstNaScene(
          t.naglowki[i]!,
          kom(y, t.wysNaglowka),
          pole.kolumny[i]!.wyrownanie ?? t.stylNaglowka.wyrownanie ?? wyrownanie,
          'srodek',
          glify,
          t.stylNaglowka.obwodka,
        ),
      );
    let ry = y + t.wysNaglowka;
    t.wartosci.forEach((w, r) => {
      wynik.push(
        ...tekstNaScene(
          w[i]!,
          kom(ry, t.wysWierszy[r]!),
          wyrKolumny,
          'srodek',
          glify,
          t.styl.obwodka,
        ),
      );
      ry += t.wysWierszy[r]!;
    });
    kx += sz;
  });
  dodajOstrzezenieZnakow(
    pole.id,
    pole.kolumny.flatMap((k) => [
      ...(zNaglowkami ? [{ tekst: k.naglowek, styl: t.stylNaglowka }] : []),
      ...t.wartosci.map((_, r) => ({ tekst: dane[kluczKomorki(k, r)] ?? '', styl: t.styl })),
    ]),
    ctx,
    ostrzezenia,
  );
  // Linie siatki: między kolumnami, między wierszami (także pod nagłówkiem) i (domyślnie) obwódka.
  const l = pole.linie;
  const s = l ? obrys({ grubosc: l.grubosc, kolor: l.kolor, styl: l.styl }) : undefined;
  if (l && s) {
    const g = l.grubosc;
    let lx = x;
    for (const sz of t.kolumny.slice(0, -1)) {
      lx += sz;
      wynik.push({ typ: 'linia', x1: lx, y1: y, x2: lx, y2: y + t.wys, obrys: s });
    }
    let ly = y;
    for (const h of [...(zNaglowkami ? [t.wysNaglowka] : []), ...t.wysWierszy].slice(0, -1)) {
      ly += h;
      wynik.push({ typ: 'linia', x1: x, y1: ly, x2: x + t.szer, y2: ly, obrys: s });
    }
    if (l.zewnetrzne !== false)
      wynik.push({
        typ: 'prostokat',
        x: x + g / 2,
        y: y + g / 2,
        szer: Math.max(0, t.szer - g),
        wys: Math.max(0, t.wys - g),
        obrys: s,
      });
  }
  return wynik;
}

function rysujPoleObrazu(
  pole: PoleObraz,
  ramka: Ramka,
  dane: Record<string, string>,
  ctx: KontekstRenderowania,
  ostrzezenia: Ostrzezenie[],
  przeszkody: Ramka[],
  ustawienia: UstawieniaObrazu | undefined,
): ElementSceny[] {
  const zasob = wartoscPola(pole, dane);
  const info = ctx.obraz?.(zasob);
  if (!info || info.szerokosc <= 0 || info.wysokosc <= 0) {
    ostrzezenia.push({ pole: pole.id, komunikat: 'brak-obrazu', szczegoly: zasob });
    return [];
  }
  const u = normalizujUstawieniaObrazu(ustawienia);
  const dopasowanie = u.dopasowanie ?? pole.dopasowanie;
  const obszar = wolnyObszar(ramka, przeszkody, pole.odstepOdOmijanych ?? 0.5, info, dopasowanie);
  if (!(obszar.szer > 1e-6 && obszar.wys > 1e-6)) {
    ostrzezenia.push({ pole: pole.id, komunikat: 'brak-miejsca-na-obraz', szczegoly: zasob });
    return [];
  }
  const kadr = pole.kadr ?? { x: 0.5, y: 0.5 };
  return [rysujObraz(zasob, info, obszar, ramka, dopasowanie, kadr, u)];
}

/**
 * Ustawienia obrazu z danych karty (import, edycja) bez wartości niepoprawnych:
 * skala skończona i dodatnia (inaczej 1), przesunięcie i obrót skończone (inaczej 0),
 * obrót sprowadzony do (−360, 360).
 */
export function normalizujUstawieniaObrazu(u: UstawieniaObrazu | undefined): UstawieniaObrazu {
  if (!u) return {};
  const liczba = (v: number | undefined, domyslna: number) =>
    v !== undefined && Number.isFinite(v) ? v : domyslna;
  const skala = liczba(u.skala, 1);
  const obrot = liczba(u.obrot, 0) % 360;
  const DOPASOWANIA: DopasowanieObrazu[] = ['dopasuj', 'wypelnij', 'rozciagnij'];
  return {
    skala: skala > 0 ? skala : 1,
    przesuniecie: { x: liczba(u.przesuniecie?.x, 0), y: liczba(u.przesuniecie?.y, 0) },
    obrot: obrot === 0 ? 0 : obrot,
    ...(u.dopasowanie && DOPASOWANIA.includes(u.dopasowanie) ? { dopasowanie: u.dopasowanie } : {}),
  };
}

/**
 * Największy prostokąt ramki wolny od przeszkód (powiększonych o odstęp). Dla „dopasuj”
 * liczy się powierzchnia obrazu po dopasowaniu (proporcje), dla innych trybów – prostokąta.
 */
export function wolnyObszar(
  ramka: Ramka,
  przeszkody: Ramka[],
  odstep: Mm,
  info: InformacjaOObrazie,
  dopasowanie: DopasowanieObrazu,
): Ramka {
  const EPS = 1e-6;
  let kandydaci: Ramka[] = [ramka];
  for (const q of przeszkody) {
    const l = q.x - odstep;
    const g = q.y - odstep;
    const p = q.x + q.szer + odstep;
    const d = q.y + q.wys + odstep;
    const nowi: Ramka[] = [];
    for (const c of kandydaci) {
      const cp = c.x + c.szer;
      const cd = c.y + c.wys;
      if (l >= cp - EPS || p <= c.x + EPS || g >= cd - EPS || d <= c.y + EPS) {
        nowi.push(c);
        continue;
      }
      nowi.push(
        { x: c.x, y: c.y, szer: l - c.x, wys: c.wys },
        { x: p, y: c.y, szer: cp - p, wys: c.wys },
        { x: c.x, y: c.y, szer: c.szer, wys: g - c.y },
        { x: c.x, y: d, szer: c.szer, wys: cd - d },
      );
    }
    // Bez prostokątów pustych i zawartych w innych (jak w MaxRects) – lista nie rośnie 4^k.
    const niepuste = nowi.filter((c) => c.szer > EPS && c.wys > EPS);
    const zawiera = (a: Ramka, b: Ramka) =>
      a.x <= b.x + EPS &&
      a.y <= b.y + EPS &&
      a.x + a.szer >= b.x + b.szer - EPS &&
      a.y + a.wys >= b.y + b.wys - EPS;
    kandydaci = niepuste.filter(
      (c, i) => !niepuste.some((d, j) => j !== i && zawiera(d, c) && (!zawiera(c, d) || j < i)),
    );
  }
  const ocena = (c: Ramka) => {
    if (dopasowanie !== 'dopasuj') return c.szer * c.wys;
    const s = Math.min(c.szer / info.szerokosc, c.wys / info.wysokosc);
    return s * s * info.szerokosc * info.wysokosc;
  };
  let najlepszy: Ramka | undefined;
  for (const c of kandydaci) if (!najlepszy || ocena(c) > ocena(najlepszy) + EPS) najlepszy = c;
  return najlepszy ?? { ...ramka, szer: 0, wys: 0 };
}

/** Czy ustawienia karty zmieniają położenie obrazu względem dopasowania. */
function czyPrzeksztalcony(u: UstawieniaObrazu | undefined): boolean {
  if (!u) return false;
  return (
    (u.skala !== undefined && u.skala !== 1) ||
    (u.obrot !== undefined && u.obrot % 360 !== 0) ||
    (u.przesuniecie !== undefined && (u.przesuniecie.x !== 0 || u.przesuniecie.y !== 0))
  );
}

/**
 * Obraz dopasowany do obszaru, potem przekształcony ustawieniami karty: skala wokół środka,
 * przesunięcie, obrót. Przycięcie do ramki pola – po przekształceniu albo gdy obraz z niej wychodzi.
 */
function rysujObraz(
  zasob: string,
  info: InformacjaOObrazie,
  obszar: Ramka,
  ramkaPola: Ramka,
  dopasowanie: DopasowanieObrazu,
  kadr: { x: number; y: number },
  ustawienia?: UstawieniaObrazu,
): ElementSceny {
  let { x, y, szer, wys } = obszar;
  if (dopasowanie !== 'rozciagnij') {
    const skalaX = obszar.szer / info.szerokosc;
    const skalaY = obszar.wys / info.wysokosc;
    const skala = dopasowanie === 'dopasuj' ? Math.min(skalaX, skalaY) : Math.max(skalaX, skalaY);
    szer = info.szerokosc * skala;
    wys = info.wysokosc * skala;
    x = obszar.x + (obszar.szer - szer) * kadr.x;
    y = obszar.y + (obszar.wys - wys) * kadr.y;
  }
  const przeksztalcony = czyPrzeksztalcony(ustawienia);
  if (przeksztalcony && ustawienia) {
    const k = ustawienia.skala ?? 1;
    const cx = x + szer / 2 + (ustawienia.przesuniecie?.x ?? 0);
    const cy = y + wys / 2 + (ustawienia.przesuniecie?.y ?? 0);
    szer *= k;
    wys *= k;
    x = cx - szer / 2;
    y = cy - wys / 2;
  }
  const obrot = ustawienia?.obrot ? ustawienia.obrot % 360 : 0;
  // Przycięcie: po przekształceniu z karty – do ramki pola (użytkownik kadruje świadomie);
  // bez przekształcenia – do wolnego obszaru, gdy obraz z niego wychodzi (np. „wypełnij”).
  const przyciecie = przeksztalcony ? ramkaPola : obszar;
  const T = 1e-6;
  const wychodzi =
    x < przyciecie.x - T ||
    y < przyciecie.y - T ||
    x + szer > przyciecie.x + przyciecie.szer + T ||
    y + wys > przyciecie.y + przyciecie.wys + T;
  return {
    typ: 'obraz',
    zasob,
    x,
    y,
    szer,
    wys,
    ...(obrot !== 0 ? { obrot } : {}),
    ...(przeksztalcony || wychodzi ? { przyciecie: { ...przyciecie } } : {}),
  };
}
