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
  type PoleTekst,
  type StylLinii,
  type Szablon,
  type UstawieniaObrazu,
  type Wezel,
} from '../model/szablon';
import type { RejestrCzcionek } from './czcionki';
import { konturIkony } from './ikony';
import type { DefinicjaGlifu, ElementSceny, Kontur, Obrys, Scena } from './scena';
import { tekstNaScene, ulozDopasowany, ulozTekst, type Fragment } from './tekst';
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
  komunikat: 'tekst-nie-miesci-sie' | 'brak-obrazu' | 'brak-znakow';
  szczegoly?: string;
}

export interface WyrenderowanaKarta {
  scena: Scena;
  ostrzezenia: Ostrzezenie[];
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
  const fr: Fragment[] = [];
  const etykieta = pole.etykieta ? napis(pole.etykieta.tekst, dane) : '';
  if (pole.etykieta && etykieta !== '') {
    const styl = { ...pole.styl, ...pole.etykieta.styl };
    const odstep = pole.etykieta.pozycja === 'nad' ? '\n' : ' ';
    fr.push({ tekst: etykieta + (wartosc === '' ? '' : odstep), styl });
  }
  if (wartosc !== '') fr.push({ tekst: wartosc, styl: pole.styl });
  return fr;
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

  const rysuj = (u: UlozonyWezel) => {
    const w = u.wezel;
    const promien = promienWezla(w, u);
    const sciety = !czyKontener(w) && w.typ === 'wartosc' && w.ksztalt === 'sciety';
    if (w.tlo) {
      elementy.push(
        sciety
          ? { typ: 'sciezka', kontur: konturScietego(u, promien ?? 0), wypelnienie: w.tlo }
          : {
              typ: 'prostokat',
              x: u.x,
              y: u.y,
              szer: u.szer,
              wys: u.wys,
              promien,
              wypelnienie: w.tlo,
            },
      );
    }
    if (!czyKontener(w) && !czyPuste(w, dane)) {
      const p = rozwinOdstepy(w.padding);
      const ramka = {
        x: u.x + p.lewo,
        y: u.y + p.gora,
        szer: Math.max(0, u.szer - p.lewo - p.prawo),
        wys: Math.max(0, u.wys - p.gora - p.dol),
      };
      if (w.typ === 'obraz') {
        const przeszkody = (w.omijaj ?? [])
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
    if (w.obramowanie) elementy.push(...rysujObramowanie(w.obramowanie, u, promien, sciety));
  };
  rysuj(korzen);

  return { scena: { szer, wys, elementy, glify }, ostrzezenia };
}

function promienWezla(w: Wezel, u: { szer: Mm; wys: Mm }): Mm | undefined {
  if (!czyKontener(w) && w.typ === 'wartosc' && w.ksztalt === 'kolo')
    return Math.min(u.szer, u.wys) / 2;
  return w.promien;
}

function rysujObramowanie(
  o: Obramowanie,
  u: UlozonyWezel,
  promien: Mm | undefined,
  sciety = false,
): ElementSceny[] {
  const g = o.grubosc;
  const s = obrys(o);
  if (!s) return [];
  const k = o.krawedzie;
  if (!k && sciety) {
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
      if (pole.ksztalt === 'kolo') {
        const bok = Math.max(u.szerokosc, u.wysokosc);
        return { szer: bok, wys: bok };
      }
      return { szer: u.szerokosc, wys: u.wysokosc };
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
  ramka: Ramka,
  dane: Record<string, string>,
  ctx: KontekstRenderowania,
  glify: Record<string, DefinicjaGlifu>,
  ostrzezenia: Ostrzezenie[],
): ElementSceny[] {
  const wartosc = wartoscPola(pole, dane);
  switch (pole.typ) {
    case 'tekst':
      return rysujTekst(pole, wartosc, dane, ramka, ctx, glify, ostrzezenia);
    case 'wartosc': {
      const fr = [{ tekst: wartosc, styl: pole.styl }];
      const minSkala = minimalnaSkala(pole.styl);
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
  const dopasowanie = ustawienia?.dopasowanie ?? pole.dopasowanie;
  const obszar = wolnyObszar(ramka, przeszkody, pole.odstepOdOmijanych ?? 0.5, info, dopasowanie);
  const kadr = pole.kadr ?? { x: 0.5, y: 0.5 };
  return [rysujObraz(zasob, info, obszar, ramka, dopasowanie, kadr, ustawienia)];
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
    kandydaci = nowi.filter((c) => c.szer > EPS && c.wys > EPS);
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
    const k =
      ustawienia.skala !== undefined && Number.isFinite(ustawienia.skala) && ustawienia.skala > 0
        ? ustawienia.skala
        : 1;
    const cx = x + szer / 2 + (ustawienia.przesuniecie?.x ?? 0);
    const cy = y + wys / 2 + (ustawienia.przesuniecie?.y ?? 0);
    szer *= k;
    wys *= k;
    x = cx - szer / 2;
    y = cy - wys / 2;
  }
  const obrot = ustawienia?.obrot ? ustawienia.obrot % 360 : 0;
  const T = 1e-6;
  const wychodzi =
    x < ramkaPola.x - T ||
    y < ramkaPola.y - T ||
    x + szer > ramkaPola.x + ramkaPola.szer + T ||
    y + wys > ramkaPola.y + ramkaPola.wys + T;
  return {
    typ: 'obraz',
    zasob,
    x,
    y,
    szer,
    wys,
    ...(obrot !== 0 ? { obrot } : {}),
    ...(przeksztalcony || wychodzi ? { przyciecie: { ...ramkaPola } } : {}),
  };
}
