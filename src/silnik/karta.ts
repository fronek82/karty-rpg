import type { Mm } from '../model/jednostki';
import {
  czyKontener,
  type DopasowanieObrazu,
  type Karta,
  kluczeTabeli,
  kluczKomorki,
  type Kolor,
  korzenKarty,
  type NapisSzablonu,
  type Narozniki,
  type Obramowanie,
  type Ozdoba,
  type OzdobaRamka9,
  polaDrzewa,
  type Pole,
  type PoleObraz,
  type PoleTabela,
  type PoleTekst,
  type PoleWartosc,
  type RamkaKarty,
  type Rewers,
  rozwinOdstepy,
  type StylLinii,
  type StylTekstu,
  type Szablon,
  type TrybTla,
  type UstawieniaObrazu,
  type Wezel,
  wymiaryKarty,
  type ZabarwienieTla,
} from '../model/szablon';
import type { RejestrCzcionek } from './czcionki';
import { kolorZDanych, styleZDanych } from './styleZDanych';
import { konturIkony } from './ikony';
import { znajdzElement } from '../ozdobniki/katalog';
import { konturWlasnegoKsztaltu, wnetrzeWlasnegoKsztaltu } from '../ozdobniki/ksztalt';
import {
  FIGURY,
  type Figura,
  konturFigury,
  proporcjeFigury,
  wnetrzeFigury,
  wpiszProporcje,
} from './ksztaltyWartosci';
import type { ElementOzdobny } from '../ozdobniki/typy';
import { ramkaZMotywu } from '../ozdobniki/motyw';
import { konturPostrzepiony, szkicujElementy } from '../ozdobniki/dekoracje';
import { konturProstokata } from './konturyFigur';
import { elementyWzoruTla } from './wzorTla';
import { MIN_DPI_RAMKI, ramka9ZElementu, type WynikRamki9 } from '../ozdobniki/ramka9';
import { rysujSeparatorOzdobny, wysokoscOzdobySeparatora } from '../ozdobniki/separator';
import {
  narozniki as rysujNarozniki,
  symbolZElementu,
  type WynikNarozniki,
} from '../ozdobniki/narozniki';
import {
  symboleSceny,
  type DefinicjaGlifu,
  type DefinicjaSymbolu,
  type ElementSceny,
  type Kontur,
  type Obrys,
  type Scena,
} from './scena';
import {
  parsujFormatowanie,
  dodajNotacjeTekstu,
  graniceTekstuPoLuku,
  tekstNaScene,
  tekstPoLukuNaScene,
  ulozDopasowany,
  ulozPoLukuDopasowany,
  ulozTekst,
  type Fragment,
  type UkladTekstu,
} from './tekst';
import {
  obrocProstokat,
  obrocWektor,
  prostokatPoObrocie,
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

export interface KontynuowanyTekst {
  poleId: string;
  fragmenty: Fragment[];
  dopisek?: string;
}

export interface KontekstRenderowania {
  kontynuacja?: KontynuowanyTekst;
  czcionki: RejestrCzcionek;
  /** Wymiary obrazu z biblioteki; undefined = brak zasobu. */
  obraz?: (zasob: string) => InformacjaOObrazie | undefined;
  /** Własne elementy biblioteki ozdobników projektu (`Projekt.biblioteka.ozdobniki`). */
  elementy?: readonly ElementOzdobny[];
}

/** Minimalna efektywna rozdzielczość obrazu rastrowego w trybie drukarni (SPEC 10). */
export const MIN_DPI_DRUKARNI = 300;

export interface OpcjeRenderowaniaKarty {
  teksturaTryb?: TrybTla;
  teksturaKrycie?: number;
  teksturaZabarwienie?: ZabarwienieTla;
  /** Spad z każdej strony karty (mm, tryb drukarni): tło i tekstura tła sięgają obszaru brutto. */
  spad?: Mm;
  /** Próg efektywnego DPI obrazów rastrowych (tryb drukarni: 300 dpi). */
  minDpi?: number;
}

export interface Ostrzezenie {
  pole: string;
  komunikat:
    | 'tekst-nie-miesci-sie'
    | 'brak-obrazu'
    | 'brak-znakow'
    | 'brak-miejsca-na-obraz'
    | 'nieznane-pole-do-omijania'
    | 'nieznany-element-ozdobny'
    | 'niska-rozdzielczosc-ramki'
    | 'niska-rozdzielczosc-obrazu';
  szczegoly?: string;
}

export interface WyrenderowanaKarta {
  scena: Scena;
  ostrzezenia: Ostrzezenie[];
  /** Położenia widocznych węzłów (mm od rogu karty) – do zaznaczania w edytorze szablonu. */
  wezly: {
    id: string;
    x: Mm;
    y: Mm;
    szer: Mm;
    wys: Mm;
    /**
     * Ramka węzła w układzie jego rodzica, przed obrotem węzła (u dzieci obróconych przodków
     * – w układzie przed obrotem przodków). Z niej liczą się położenia przy konwersji kontenerów.
     */
    lokalne: { x: Mm; y: Mm; szer: Mm; wys: Mm };
    /** Obrót własny węzła (tylko w kontenerze swobodnym). */
    obrot?: number;
    /** Obrócony środek i kąt w układzie karty, gdy obwiednia nie wystarcza do trafienia. */
    obrys?: { x: Mm; y: Mm; kat: number };
  }[];
}

const CZARNY = '#000000';
/** Kolor zastępczego rysunku brakującego zasobu (obraz, ikona usunięta z biblioteki). */
const SZARY_ZASTEPCZY = '#9e9e9e';
/** Wzór kreski zastępczych obrysów (mm). */
const KRESKA_ZASTEPCZA: Mm[] = [1.2, 0.8];

/**
 * Zastępczy rysunek brakującego obrazu lub ikony (np. usuniętej z biblioteki): szary prostokąt
 * z przerywanym obrysem i przekątnymi – karta rysuje się dalej, a brak widać na podglądzie i w PDF.
 */
export function zastepczyProstokat(r: Ramka): ElementSceny[] {
  if (!(r.szer > 0.3 && r.wys > 0.3)) return [];
  const obrys = { kolor: SZARY_ZASTEPCZY, grubosc: 0.25, kreska: KRESKA_ZASTEPCZA };
  const x0 = r.x + 0.15;
  const y0 = r.y + 0.15;
  const x1 = r.x + r.szer - 0.15;
  const y1 = r.y + r.wys - 0.15;
  return [
    { typ: 'prostokat', x: x0, y: y0, szer: x1 - x0, wys: y1 - y0, obrys },
    { typ: 'linia', x1: x0, y1: y0, x2: x1, y2: y1, obrys },
    { typ: 'linia', x1: x0, y1: y1, x2: x1, y2: y0, obrys },
  ];
}

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

export function trescPolaTekstowego(pole: PoleTekst, wartosc: string): Fragment[] {
  if (!wartosc) return [];
  const formatowane =
    pole.formatowanie === false
      ? [{ tekst: wartosc, styl: pole.styl }]
      : parsujFormatowanie(wartosc, pole.styl);
  return dodajNotacjeTekstu(formatowane, pole.listyNumerowane, pole.ikonyWTekscie);
}

function fragmentyTekstu(
  pole: PoleTekst,
  wartosc: string,
  dane: Record<string, string>,
  ctx: KontekstRenderowania,
): Fragment[] {
  const tresc =
    ctx.kontynuacja?.poleId === pole.id
      ? ctx.kontynuacja.fragmenty
      : trescPolaTekstowego(pole, wartosc);
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

/**
 * Podział ramki wartości na pasek etykiety (nad, pod albo obok) i obszar kształtu (tło, ramka,
 * treść). Kształt o stałych proporcjach jest potem wpisywany w ten obszar – etykieta zmienia tylko
 * jego wielkość, nie proporcje.
 */
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
  const pozycja = pole.etykieta!.pozycja;
  if (pozycja === 'lewo' || pozycja === 'prawo') {
    // Etykieta obok zajmuje najwyżej 60% szerokości (dłuższa – zmniejszana), kształt nie znika.
    const s = Math.min(r.szer * 0.6, e.uklad.szerokosc);
    const reszta = Math.max(0, r.szer - s - e.odstep);
    const lewo = pozycja === 'lewo';
    return {
      ksztalt: { x: lewo ? r.x + r.szer - reszta : r.x, y: r.y, szer: reszta, wys: r.wys },
      etykieta: {
        ramka: { x: lewo ? r.x : r.x + r.szer - s, y: r.y, szer: s, wys: r.wys },
        fragmenty: e.fragmenty,
        styl: e.styl,
      },
    };
  }
  const h = Math.min(r.wys, e.uklad.wysokosc);
  const reszta = Math.max(0, r.wys - h - e.odstep);
  const nad = pozycja === 'nad';
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

/**
 * Odsunięcia osi kolejnych linii od krawędzi (mm): jedna linia – pół grubości; `podwojna` – dwie
 * linie o grubości `grubosc` rozdzielone przerwą (domyślnie 2× grubość).
 */
export function osieLinii(o: { grubosc: Mm; styl?: StylLinii; przerwa?: Mm }): Mm[] {
  const g = o.grubosc;
  if (o.styl !== 'podwojna') return [g / 2];
  return [g / 2, g / 2 + g + (o.przerwa ?? 2 * g)];
}

/** Całkowita grubość obramowania: dla `podwojna` obie linie z przerwą. */
export function pelnaGrubosc(o: { grubosc: Mm; styl?: StylLinii; przerwa?: Mm }): Mm {
  return o.styl === 'podwojna' ? 2 * o.grubosc + (o.przerwa ?? 2 * o.grubosc) : o.grubosc;
}

/** Renderuje kartę na scenę (mm). Silnik nie zależy od DOM – działa w testach, workerze i UI. */
export function renderujKarte(
  szablon: Szablon,
  karta: Pick<Karta, 'dane' | 'rozmiar' | 'obrazy'>,
  ctx: KontekstRenderowania,
  opcje?: OpcjeRenderowaniaKarty,
): WyrenderowanaKarta {
  const { szer, wys } = wymiaryKarty(szablon, karta);
  const spad = opcje?.spad && opcje.spad > 0 ? opcje.spad : 0;
  const minDpi = opcje?.minDpi && opcje.minDpi > 0 ? opcje.minDpi : undefined;
  const dane = daneZParametrami(szablon, karta.dane);
  const glify: Record<string, DefinicjaGlifu> = {};
  const symbole: Record<string, DefinicjaSymbolu> = {};
  let elementy: ElementSceny[] = [];
  const ostrzezenia: Ostrzezenie[] = [];
  const ramkaKarty = { x: 0, y: 0, szer, wys };
  const ramkaBrutto =
    spad > 0 ? { x: -spad, y: -spad, szer: szer + 2 * spad, wys: wys + 2 * spad } : ramkaKarty;
  const poszarpanaKarta = szablon.postrzepienie?.sila
    ? konturPostrzepiony(ramkaKarty, szablon.postrzepienie)
    : undefined;
  const sprawdzDpi = (
    pole: string,
    info: InformacjaOObrazie,
    narysowany: { x: Mm; y: Mm; szer: Mm; wys: Mm; obrot?: number },
    przyciecie?: Ramka,
  ) => {
    if (!minDpi) return;
    const dpi = efektywneDpiObrazu(info, narysowany, przyciecie);
    if (dpi !== undefined && dpi < minDpi - 1e-6) {
      ostrzezenia.push({
        pole,
        komunikat: 'niska-rozdzielczosc-obrazu',
        szczegoly: String(Math.floor(dpi)),
      });
    }
  };
  const teksturaTla = (
    zasob: string,
    r: Ramka,
    promien: Mm | undefined,
    pole: string,
    tryb: TrybTla = 'wypelnij',
    krycie?: number,
    zabarwienie?: ZabarwienieTla,
  ) => {
    const info = ctx.obraz?.(zasob);
    if (!info || info.szerokosc <= 0 || info.wysokosc <= 0) {
      ostrzezenia.push({ pole, komunikat: 'brak-obrazu', szczegoly: zasob });
      elementy.push(...zastepczyProstokat(r));
      return;
    }
    if (!(r.szer > 0 && r.wys > 0)) return;
    const ukrytaTekstura = krycie !== undefined && krycie <= 0;
    const maKrycieTekstury = krycie !== undefined && krycie < 1;
    if (!ukrytaTekstura) {
      let tresc: ElementSceny[];
      if (tryb === 'kafelki') {
        const MM_NA_PX = 25.4 / 300;
        let tw = Math.max(4, info.szerokosc * MM_NA_PX);
        let th = info.wysokosc * (tw / info.szerokosc);
        const minTw = r.szer / 64;
        const minTh = r.wys / 64;
        if (tw < minTw) {
          th *= minTw / tw;
          tw = minTw;
        }
        if (th < minTh) {
          tw *= minTh / th;
          th = minTh;
        }
        sprawdzDpi(pole, info, { x: r.x, y: r.y, szer: tw, wys: th }, r);
        tresc = [];
        for (let y = r.y; y < r.y + r.wys - 1e-6; y += th) {
          for (let x = r.x; x < r.x + r.szer - 1e-6; x += tw) {
            tresc.push({ typ: 'obraz', zasob, x, y, szer: tw, wys: th });
          }
        }
      } else {
        const el = rysujObraz(zasob, info, r, r, tryb, { x: 0.5, y: 0.5 });
        if (el.typ === 'obraz') sprawdzDpi(pole, info, el, el.przyciecie);
        tresc = [el];
      }
      if (!promien && tryb !== 'kafelki' && !maKrycieTekstury) {
        elementy.push(...tresc);
      } else {
        elementy.push({
          typ: 'grupa',
          x: 0,
          y: 0,
          ...(promien
            ? { przyciecieKonturem: konturProstokata(r.x, r.y, r.szer, r.wys, promien) }
            : tryb === 'kafelki'
              ? { przyciecie: { ...r } }
              : {}),
          ...(maKrycieTekstury ? { krycie } : {}),
          elementy: tresc,
        });
      }
    }
    if (zabarwienie && zabarwienie.krycie > 0) {
      const nakladka: ElementSceny = {
        typ: 'prostokat',
        x: r.x,
        y: r.y,
        szer: r.szer,
        wys: r.wys,
        ...(promien ? { promien } : {}),
        wypelnienie: zabarwienie.kolor,
      };
      elementy.push(
        zabarwienie.krycie < 1
          ? { typ: 'grupa', x: 0, y: 0, krycie: zabarwienie.krycie, elementy: [nakladka] }
          : nakladka,
      );
    }
  };
  /** Narożniki z biblioteki: elementy na scenę, rysunek do słownika symboli, ostrzeżenie o nieznanym. */
  const wypiszNarozniki = (w: WynikNarozniki, id: string) => {
    elementy.push(...w.elementy);
    Object.assign(symbole, w.symbole);
    if (w.nieznany)
      ostrzezenia.push({ pole: id, komunikat: 'nieznany-element-ozdobny', szczegoly: w.nieznany });
  };
  const dodajNarozniki = (n: Narozniki, ramka: Ramka, kolor: Kolor, id: string) =>
    wypiszNarozniki(rysujNarozniki(n, ramka, kolor, ctx.elementy), id);

  /**
   * Ozdoba (motyw) na prostokącie. Nieznany motyw: ostrzeżenie i cienka linia przerywana w kolorze
   * ozdoby. Własne narożniki zastępują kostki narożne motywu tylko wtedy, gdy coś narysują
   * (nieznany element albo rozmiar 0 zostawia kostki – róg nie zostaje pusty).
   * Narożniki leżą na tym samym prostokącie co pas (po odsunięciu), kolor domyślny = kolor motywu.
   */
  const dodajOzdobe = (
    o: Ozdoba,
    obszar: Ramka,
    id: string,
    n: Narozniki | undefined,
    promien = 0,
  ) => {
    if (o.rodzaj === 'ramka9') {
      dodajRamke9(o, obszar, id, n);
      return;
    }
    const pas = Math.min(o.szerokosc, obszar.szer / 2, obszar.wys / 2);
    const rogi =
      n && !(o.poLuku && promien > pas / 2)
        ? rysujNarozniki(n, obszar, o.kolor, ctx.elementy)
        : undefined;
    const w = ramkaZMotywu(o, obszar, {
      bezKostek: !!rogi && rogi.elementy.length > 0,
      promien,
      ...(ctx.elementy ? { wlasne: ctx.elementy } : {}),
    });
    elementy.push(...w.elementy);
    Object.assign(symbole, w.symbole);
    if (w.nieznany) {
      ostrzezenia.push({ pole: id, komunikat: 'nieznany-element-ozdobny', szczegoly: w.nieznany });
      elementy.push({
        typ: 'prostokat',
        x: obszar.x + 0.15,
        y: obszar.y + 0.15,
        szer: Math.max(0, obszar.szer - 0.3),
        wys: Math.max(0, obszar.wys - 0.3),
        obrys: { kolor: o.kolor, grubosc: 0.3, kreska: KRESKA_ZASTEPCZA },
      });
    }
    if (rogi) wypiszNarozniki(rogi, id);
  };

  /**
   * Ramka 9-slice (PNG albo SVG). Brak elementu albo obrazu: ostrzeżenie i cienka linia przerywana.
   * PNG o rogach poniżej 300 dpi: ostrzeżenie `niska-rozdzielczosc-ramki` (rysujemy mimo to).
   * Własne narożniki rysujemy nad ramką.
   */
  const wczesne = new Map<string, WynikRamki9>();
  /** Środek ramki 9-slice rysujemy przed treścią (dzieci, pola) – reszta dochodzi później, na wierzchu. */
  const przygotujRamke9 = (o: OzdobaRamka9, obszar: Ramka, id: string) => {
    const w = ramka9ZElementu(o, obszar, {
      ...(ctx.elementy ? { wlasne: ctx.elementy } : {}),
      maObraz: (zasob) => ctx.obraz?.(zasob) !== undefined,
    });
    elementy.push(...w.srodek);
    wczesne.set(id, w);
  };
  const dodajRamke9 = (o: OzdobaRamka9, obszar: Ramka, id: string, n: Narozniki | undefined) => {
    const w = wczesne.get(id);
    if (!w) return;
    wczesne.delete(id);
    elementy.push(...w.elementy);
    Object.assign(symbole, w.symbole);
    if (w.nieznany || w.brakObrazu) {
      ostrzezenia.push(
        w.nieznany
          ? { pole: id, komunikat: 'nieznany-element-ozdobny', szczegoly: w.nieznany }
          : { pole: id, komunikat: 'brak-obrazu', szczegoly: w.brakObrazu! },
      );
      elementy.push({
        typ: 'prostokat',
        x: obszar.x + 0.15,
        y: obszar.y + 0.15,
        szer: Math.max(0, obszar.szer - 0.3),
        wys: Math.max(0, obszar.wys - 0.3),
        obrys: { kolor: o.kolor ?? CZARNY, grubosc: 0.3, kreska: KRESKA_ZASTEPCZA },
      });
    }
    if (w.dpi !== undefined && w.dpi < MIN_DPI_RAMKI)
      ostrzezenia.push({
        pole: id,
        komunikat: 'niska-rozdzielczosc-ramki',
        szczegoly: String(Math.round(w.dpi)),
      });
    if (n) wypiszNarozniki(rysujNarozniki(n, obszar, o.kolor ?? CZARNY, ctx.elementy), id);
  };

  const kontekst: KontekstUkladu = {
    czyUkryty: (w) =>
      !czyKontener(w) && (w.gdyPuste ?? 'pokaz-ramke') === 'ukryj' && czyPuste(w, dane),
    zmierzPole: (pole, ogr) => zmierzPole(pole, ogr, dane, ctx),
  };

  const tlo = szablon.tloZDanych ? kolorZDanych(szablon.tloZDanych, dane) : szablon.tlo;
  if (tlo) {
    elementy.push({
      typ: 'prostokat',
      x: ramkaBrutto.x,
      y: ramkaBrutto.y,
      szer: ramkaBrutto.szer,
      wys: ramkaBrutto.wys,
      promien: spad > 0 || poszarpanaKarta ? undefined : szablon.promienRogow,
      wypelnienie: tlo,
    });
  }
  const promienTla = spad > 0 || poszarpanaKarta ? 0 : szablon.promienRogow;
  const wzorTla = () => {
    const wzor = szablon.wzorTla;
    if (!wzor || (wzor.krycie !== undefined && wzor.krycie <= 0)) return;
    const tresc = elementyWzoruTla(wzor, ramkaBrutto);
    if (!tresc.length) return;
    elementy.push({
      typ: 'grupa',
      x: 0,
      y: 0,
      ...(promienTla
        ? {
            przyciecieKonturem: konturProstokata(
              ramkaBrutto.x,
              ramkaBrutto.y,
              ramkaBrutto.szer,
              ramkaBrutto.wys,
              promienTla,
            ),
          }
        : { przyciecie: { ...ramkaBrutto } }),
      ...(wzor.krycie !== undefined && wzor.krycie < 1 ? { krycie: wzor.krycie } : {}),
      elementy: tresc,
    });
  };
  if (szablon.wzorTla?.podTekstura) wzorTla();
  if (szablon.teksturaTla)
    teksturaTla(
      szablon.teksturaTla,
      ramkaBrutto,
      promienTla,
      'tlo-karty',
      opcje?.teksturaTryb,
      opcje?.teksturaKrycie,
      opcje?.teksturaZabarwienie,
    );
  if (!szablon.wzorTla?.podTekstura) wzorTla();
  if (szablon.ramka?.ozdoba?.rodzaj === 'ramka9') {
    const o = szablon.ramka.odsuniecie ?? 0;
    przygotujRamke9(
      szablon.ramka.ozdoba,
      { x: o, y: o, szer: szer - 2 * o, wys: wys - 2 * o },
      'ramka-karty',
    );
  }
  const stylDopisku: StylTekstu = { czcionka: 'tresc', rozmiar: 2.5 };
  const dopisek = ctx.kontynuacja?.dopisek
    ? ulozTekst(
        [{ tekst: ctx.kontynuacja.dopisek, styl: stylDopisku }],
        Math.max(0, szer - 4),
        ctx.czcionki,
      )
    : undefined;
  const pasDopisku = dopisek ? dopisek.wysokosc + 3 : 0;
  const korzen = rozmiesc(
    styleZDanych(szablon, korzenKarty(szablon, karta), dane),
    0,
    pasDopisku,
    szer,
    Math.max(0, wys - pasDopisku),
    kontekst,
  );
  // Położenia wszystkich widocznych węzłów – obraz może omijać pola rysowane nad nim.
  const ulozone = new Map<string, UlozonyWezel>();
  const wezly = new Map<string, WyrenderowanaKarta['wezly'][number]>();
  const przycieciaTekstu = new Map<string, Kontur>();
  /** `przodkowie` – obrócone ramki przodków (od najbliższego): prostokąt węzła na karcie obracamy kolejno. */
  const zbierz = (u: UlozonyWezel, przodkowie: UlozonyWezel[]) => {
    ulozone.set(u.wezel.id, u);
    let x = u.x + u.szer / 2;
    let y = u.y + u.wys / 2;
    let kat = u.obrot ?? 0;
    for (const p of przodkowie) {
      const cx = p.x + p.szer / 2;
      const cy = p.y + p.wys / 2;
      const [dx, dy] = obrocWektor(x - cx, y - cy, p.obrot ?? 0);
      x = cx + dx;
      y = cy + dy;
      kat += p.obrot ?? 0;
    }
    const r =
      !kat && !przodkowie.length
        ? u
        : obrocProstokat(
            { x: x - u.szer / 2, y: y - u.wys / 2, szer: u.szer, wys: u.wys },
            x,
            y,
            kat,
          );
    wezly.set(u.wezel.id, {
      id: u.wezel.id,
      x: r.x,
      y: r.y,
      szer: r.szer,
      wys: r.wys,
      lokalne: { x: u.x, y: u.y, szer: u.szer, wys: u.wys },
      ...(u.obrot ? { obrot: u.obrot } : {}),
      ...(kat % 90 ? { obrys: { x, y, kat } } : {}),
    });
    const dalej = u.obrot ? [u, ...przodkowie] : przodkowie;
    if (
      u.wezel.typ === 'tekst' &&
      dalej.length > 0 &&
      (r.x < -1e-6 || r.y < -1e-6 || r.x + r.szer > szer + 1e-6 || r.y + r.wys > wys + 1e-6)
    ) {
      // Kontur papieru we współrzędnych pola, przed obrotem węzła i przodków.
      const odwrotne = dalej.slice().reverse();
      const punkt = (px: Mm, py: Mm): [Mm, Mm] => {
        for (const p of odwrotne) {
          const cx = p.x + p.szer / 2;
          const cy = p.y + p.wys / 2;
          const [dx, dy] = obrocWektor(px - cx, py - cy, -(p.obrot ?? 0));
          px = cx + dx;
          py = cy + dy;
        }
        return [px, py];
      };
      przycieciaTekstu.set(u.wezel.id, [
        ['M', ...punkt(0, 0)],
        ['L', ...punkt(szer, 0)],
        ['L', ...punkt(szer, wys)],
        ['L', ...punkt(0, wys)],
        ['Z'],
      ]);
    }
    u.dzieci.forEach((d) => zbierz(d, dalej));
  };
  zbierz(korzen, []);
  // Wszystkie węzły szablonu (także ukryte) – do sprawdzenia identyfikatorów w `omijaj`.
  const wezlySzablonu = new Set<string>();
  const zbierzSzablon = (w: Wezel) => {
    wezlySzablonu.add(w.id);
    if (czyKontener(w)) w.dzieci.forEach(zbierzSzablon);
  };
  zbierzSzablon(korzen.wezel);

  /**
   * Węzeł obrócony (dziecko kontenera swobodnego): jego rysunek trafia do `grupy` z obrotem wokół
   * środka ramki; współrzędne wewnątrz zostają bezwzględne (macierz przesuwa środek do początku).
   */
  const rysuj = (u: UlozonyWezel, wObrocie = false) => {
    const krycie = u.wezel.krycie;
    if (krycie !== undefined && krycie <= 0) return;
    const maKrycie = krycie !== undefined && krycie < 1;
    const postrzepienie = czyKontener(u.wezel) ? u.wezel.postrzepienie : undefined;
    const obrocony = wObrocie || Boolean(u.obrot);
    if (!u.obrot && !postrzepienie?.sila && !maKrycie) return rysujWezel(u, obrocony);
    const zewnetrzne = elementy;
    elementy = [];
    rysujWezel(u, obrocony);
    const wewnetrzne: ElementSceny[] = postrzepienie?.sila
      ? [
          {
            typ: 'grupa',
            x: 0,
            y: 0,
            przyciecieKonturem: konturPostrzepiony(u, postrzepienie),
            elementy,
          },
        ]
      : elementy;
    elementy = zewnetrzne;
    if (!u.obrot) {
      if (maKrycie) elementy.push({ typ: 'grupa', x: 0, y: 0, krycie, elementy: wewnetrzne });
      else elementy.push(...wewnetrzne);
      return;
    }
    const cx = u.x + u.szer / 2;
    const cy = u.y + u.wys / 2;
    elementy.push({
      typ: 'grupa',
      x: cx,
      y: cy,
      obrot: u.obrot,
      macierz: [1, 0, 0, 1, -cx, -cy],
      ...(maKrycie ? { krycie } : {}),
      elementy: wewnetrzne,
    });
  };
  const rysujWezel = (u: UlozonyWezel, obrocony: boolean) => {
    const w = u.wezel;
    const tekstWPole = (pole: PoleTekst, tekst: string, ramka: Ramka) => {
      const kontur = przycieciaTekstu.get(pole.id);
      const rozmiar = obrocony
        ? ramka
        : {
            ...ramka,
            szer: Math.max(0, Math.min(ramka.szer, szer - ramka.x)),
            wys: Math.max(0, Math.min(ramka.wys, wys - ramka.y)),
          };
      const tresc = rysujTekst(pole, tekst, dane, rozmiar, ctx, glify, ostrzezenia);
      if (tresc.length === 0) return tresc;
      if (kontur)
        return [{ typ: 'grupa' as const, x: 0, y: 0, przyciecieKonturem: kontur, elementy: tresc }];
      // Zachowujemy punkt odniesienia tekstu ustawiony poza lewą lub górną krawędzią.
      if (!obrocony && (ramka.x < -1e-6 || ramka.y < -1e-6))
        return [{ typ: 'grupa' as const, x: 0, y: 0, przyciecie: ramkaKarty, elementy: tresc }];
      return tresc;
    };
    // Wartość z etykietą: tło, ramka i treść – tylko w obszarze kształtu, etykieta osobno.
    const podzial =
      !czyKontener(w) && w.typ === 'wartosc' ? podzialWartosci(w, u, dane, ctx) : undefined;
    let obszar: Ramka = podzial?.ksztalt ?? u;
    const pole = !czyKontener(w) && w.typ === 'wartosc' ? w : undefined;
    // Kształt o stałych proporcjach (kwadrat, koło, romb, gwiazda…; własny – wg rysunku) skaluje
    // się proporcjonalnie i jest wyśrodkowany w dostępnym miejscu.
    const proporcje = pole ? proporcjeWartosci(pole, ctx) : undefined;
    if (proporcje) obszar = wpiszProporcje(obszar, proporcje);
    const postrzepienie = czyKontener(w) ? w.postrzepienie : undefined;
    const promien = postrzepienie?.sila ? 0 : promienWezla(w, obszar);
    // Własny kształt z biblioteki: brak elementu (albo inny rodzaj) = ostrzeżenie i zwykły prostokąt.
    const wlasny = pole?.ksztalt === 'wlasny' ? ksztaltWlasny(pole, ctx) : undefined;
    if (pole?.ksztalt === 'wlasny' && !wlasny)
      ostrzezenia.push({
        pole: w.id,
        komunikat: 'nieznany-element-ozdobny',
        szczegoly: pole.ksztaltElement ?? '',
      });
    const ksztalt: KsztaltSciezki | undefined = wlasny
      ? 'wlasny'
      : pole && KSZTALTY_SCIEZKI.has(pole.ksztalt)
        ? (pole.ksztalt as KsztaltSciezki)
        : undefined;
    if (w.tlo) {
      elementy.push(
        ksztalt === 'wlasny'
          ? {
              typ: 'sciezka',
              kontur: konturWlasnegoKsztaltu(wlasny!, obszar),
              wypelnienie: w.tlo,
              // Dziury z pliku (fill-rule evenodd) zostają także w tle pola.
              ...(wlasny!.kontury.some((c) => c.evenodd) ? { evenodd: true } : {}),
            }
          : ksztalt === 'sciety'
            ? { typ: 'sciezka', kontur: konturScietego(obszar, promien ?? 0), wypelnienie: w.tlo }
            : ksztalt
              ? {
                  typ: 'sciezka',
                  kontur: konturSciezki(ksztalt, obszar, 0, pole?.ramiona),
                  wypelnienie: w.tlo,
                }
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
    if (czyKontener(w) && w.teksturaTla)
      teksturaTla(w.teksturaTla, obszar, w.postrzepienie?.sila ? 0 : promien, w.id);
    if (w.ozdoba?.rodzaj === 'ramka9' && !ksztalt) {
      const od = w.ozdoba.odsuniecie ?? 0;
      przygotujRamke9(
        w.ozdoba,
        {
          x: obszar.x + od,
          y: obszar.y + od,
          szer: obszar.szer - 2 * od,
          wys: obszar.wys - 2 * od,
        },
        w.id,
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
          .filter((x): x is UlozonyWezel => x !== undefined)
          // Przeszkoda obrócona (swobodny) zajmuje prostokąt po obrocie, w układzie swojego rodzica.
          .map(prostokatPoObrocie);
        elementy.push(
          ...rysujPoleObrazu(
            w,
            ramka,
            dane,
            ctx,
            ostrzezenia,
            przeszkody,
            karta.obrazy?.[w.id],
            minDpi,
          ),
        );
      } else if (w.typ === 'tekst') elementy.push(...tekstWPole(w, wartoscPola(w, dane), ramka));
      else elementy.push(...rysujPole(w, ramka, dane, ctx, glify, ostrzezenia, symbole));
    } else if (!czyKontener(w) && w.typ === 'tekst' && w.etykieta) {
      // Pusta wartość z „pokaż pustą ramkę”: etykieta (np. „Usunięcie:”) zostaje.
      const p = rozwinOdstepy(w.padding);
      const ramka = {
        x: u.x + p.lewo,
        y: u.y + p.gora,
        szer: Math.max(0, u.szer - p.lewo - p.prawo),
        wys: Math.max(0, u.wys - p.gora - p.dol),
      };
      elementy.push(...tekstWPole(w, '', ramka));
    }
    u.dzieci.forEach((d) => rysuj(d, obrocony));
    // Motyw rysuje się na prostokącie; kształty ścieżkowe (romb, tarcza…) go pomijają – zostaje
    // linia obramowania (jeśli jest).
    if (w.ozdoba && !ksztalt) {
      const od = w.ozdoba.odsuniecie ?? 0;
      dodajOzdobe(
        w.ozdoba,
        {
          x: obszar.x + od,
          y: obszar.y + od,
          szer: obszar.szer - 2 * od,
          wys: obszar.wys - 2 * od,
        },
        w.id,
        w.narozniki,
        Math.max(0, (promien ?? 0) - od),
      );
    } else {
      if (w.obramowanie) {
        const linia = obrys(w.obramowanie);
        if (
          linia &&
          postrzepienie?.sila &&
          !w.obramowanie.krawedzie &&
          w.obramowanie.styl !== 'podwojna'
        )
          elementy.push(
            ...szkicujElementy(
              [
                {
                  typ: 'sciezka',
                  kontur: konturPostrzepiony(obszar, postrzepienie),
                  obrys: linia,
                },
              ],
              w.obramowanie.szkic,
            ),
          );
        else
          elementy.push(
            ...rysujObramowanie(w.obramowanie, obszar, promien, ksztalt, wlasny, pole?.ramiona),
          );
      }
      if (w.narozniki) dodajNarozniki(w.narozniki, obszar, w.obramowanie?.kolor ?? CZARNY, w.id);
    }
  };
  rysuj(korzen);
  if (dopisek)
    elementy.push(
      ...tekstNaScene(
        dopisek,
        { x: 2, y: 1.5, szer: Math.max(0, szer - 4), wys: dopisek.wysokosc },
        'srodek',
        'poczatek',
        glify,
      ),
    );
  if (szablon.ramka) {
    const r = szablon.ramka;
    if (r.ozdoba) {
      const o = r.odsuniecie ?? 0;
      dodajOzdobe(
        r.ozdoba,
        { x: o, y: o, szer: szer - 2 * o, wys: wys - 2 * o },
        'ramka-karty',
        r.narozniki,
        r.promien ?? Math.max(0, (szablon.promienRogow ?? 0) - o),
      );
    } else {
      const linia = obrys(r);
      if (linia && poszarpanaKarta && !r.odsuniecie && r.styl !== 'podwojna')
        elementy.push(
          ...szkicujElementy([{ typ: 'sciezka', kontur: poszarpanaKarta, obrys: linia }], r.szkic),
        );
      else elementy.push(...rysujRamkeKarty(r, szer, wys, szablon.promienRogow));
    }
    if (r.narozniki && !r.ozdoba) {
      // Narożniki na zewnętrznej krawędzi ramki (po odsunięciu), nad linią.
      const o = r.odsuniecie ?? 0;
      dodajNarozniki(
        r.narozniki,
        { x: o, y: o, szer: szer - 2 * o, wys: wys - 2 * o },
        r.kolor,
        'ramka-karty',
      );
    }
  }

  return {
    scena: {
      szer,
      wys,
      elementy:
        spad > 0
          ? [{ typ: 'grupa', x: 0, y: 0, przyciecie: { ...ramkaBrutto }, elementy }]
          : poszarpanaKarta
            ? [{ typ: 'grupa', x: 0, y: 0, przyciecieKonturem: poszarpanaKarta, elementy }]
            : elementy,
      glify,
      ...symboleSceny(symbole),
    },
    ostrzezenia,
    wezly: [...wezly.values()],
  };
}

const normalizujNazwePola = (nazwa: string): string => nazwa.trim().toLowerCase();

const sygnaturaTabeli = (p: PoleTabela): string =>
  `${Math.max(1, Math.floor(p.wiersze ?? 1))}|${p.kolumny.map((k) => `${normalizujNazwePola(k.naglowek ?? '')}:${k.klucz}`).join(',')}`;

interface IndeksPolAwersu {
  /** `${typ}:${znormalizowanaNazwa}` → jednoznaczny klucz danych pola (lub null przy konflikcie). */
  pola: Map<string, string | null>;
  /** Znormalizowana nazwa tabeli → jednoznaczna tabela awersu (lub null przy konflikcie). */
  tabele: Map<string, PoleTabela | null>;
}

function indeksujPolaAwersu(szablon: Szablon): IndeksPolAwersu {
  const pola = new Map<string, string | null>();
  const tabele = new Map<string, PoleTabela | null>();
  for (const korzen of [szablon.korzen, ...(szablon.warianty ?? []).map((w) => w.korzen)]) {
    for (const pole of polaDrzewa(korzen)) {
      if (pole.typ === 'tabela') {
        const nazwa = pole.nazwa ? normalizujNazwePola(pole.nazwa) : '';
        if (!nazwa) continue;
        const istniejace = tabele.get(nazwa);
        if (istniejace === undefined) tabele.set(nazwa, pole);
        else if (istniejace !== null && sygnaturaTabeli(istniejace) !== sygnaturaTabeli(pole))
          tabele.set(nazwa, null);
        continue;
      }
      if (!pole.klucz) continue;
      const nazwa = normalizujNazwePola(pole.nazwa || pole.klucz);
      if (!nazwa) continue;
      const idPola = `${pole.typ}:${nazwa}`;
      const istniejacy = pola.get(idPola);
      if (istniejacy === undefined) pola.set(idPola, pole.klucz);
      else if (istniejacy !== null && istniejacy !== pole.klucz) pola.set(idPola, null);
    }
  }
  return { pola, tabele };
}

function dopasujKolumnyTabeli(rewersTabela: PoleTabela, awersTabela: PoleTabela) {
  const wiersze = Math.max(1, Math.floor(rewersTabela.wiersze ?? 1));
  const awersWiersze = Math.max(1, Math.floor(awersTabela.wiersze ?? 1));
  const dopasowaneKluczeKolumn: PoleTabela['kolumny'] = [];
  const kolumny = rewersTabela.kolumny.map((k, i) => {
    const nag = k.naglowek ? normalizujNazwePola(k.naglowek) : '';
    const zrodlo = nag
      ? awersTabela.kolumny.find(
          (ak) => ak.klucz && ak.naglowek && normalizujNazwePola(ak.naglowek) === nag,
        )
      : awersTabela.kolumny[i];
    if (!zrodlo?.klucz) return k;
    const dopasowana = { ...k, klucz: zrodlo.klucz };
    dopasowaneKluczeKolumn.push(dopasowana);
    return dopasowana;
  });
  const klucze: string[] = [];
  const limitWierszy = Math.min(wiersze, awersWiersze);
  for (let r = 0; r < limitWierszy; r++) {
    for (const k of dopasowaneKluczeKolumn) klucze.push(kluczKomorki(k, r));
  }
  return { kolumny, klucze };
}

/**
 * Zwraca klucze danych szablonu awersu, dla których na rewersie istnieje pole
 * tego samego typu i o tej samej nazwie (bez rozróżniania wielkości liter).
 */
export function wspolneKluczeRewersu(szablon: Szablon, rewers: Rewers): Set<string> {
  const indeks = indeksujPolaAwersu(szablon);
  const wynik = new Set<string>();
  for (const pole of polaDrzewa(rewers.korzen)) {
    const nazwa = pole.nazwa ? normalizujNazwePola(pole.nazwa) : '';
    if (!nazwa) continue;
    if (pole.typ === 'tabela') {
      const awersTabela = indeks.tabele.get(nazwa);
      if (!awersTabela) continue;
      for (const klucz of dopasujKolumnyTabeli(pole, awersTabela).klucze) wynik.add(klucz);
      continue;
    }
    const klucz = indeks.pola.get(`${pole.typ}:${nazwa}`);
    if (klucz) wynik.add(klucz);
  }
  return wynik;
}

/**
 * Podstawia klucze danych na pola rewersu pasujące typem i nazwą do pól awersu,
 * o ile karta ma dla nich niepustą wartość. Pola bez wartości zachowują domyślną treść rewersu.
 */
function podstawWspolnePolaRewersu(
  rewers: Rewers,
  szablon: Szablon,
  dane: Record<string, string>,
): { korzen: Rewers['korzen']; dane: Record<string, string> } {
  const indeks = indeksujPolaAwersu(szablon);
  const uzyteDane: Record<string, string> = {};
  let zmieniono = false;

  const podmienWezel = (w: Wezel): Wezel => {
    if (czyKontener(w)) {
      const dzieci = w.dzieci.map(podmienWezel);
      return dzieci.some((d, i) => d !== w.dzieci[i]) ? { ...w, dzieci } : w;
    }
    const nazwa = w.nazwa ? normalizujNazwePola(w.nazwa) : '';
    if (!nazwa) return w;
    if (w.typ === 'tabela') {
      const awersTabela = indeks.tabele.get(nazwa);
      if (!awersTabela) return w;
      const { kolumny, klucze } = dopasujKolumnyTabeli(w, awersTabela);
      let maWartosc = false;
      for (const k of klucze) {
        const val = dane[k];
        if (val !== undefined && val.trim() !== '') {
          uzyteDane[k] = val;
          maWartosc = true;
        }
      }
      if (!maWartosc) return w;
      zmieniono = true;
      return { ...w, kolumny };
    }
    const klucz = indeks.pola.get(`${w.typ}:${nazwa}`);
    if (!klucz) return w;
    const val = dane[klucz];
    if (val === undefined || val.trim() === '') return w;
    uzyteDane[klucz] = val;
    zmieniono = true;
    return { ...w, klucz };
  };

  const dzieci = rewers.korzen.dzieci.map(podmienWezel);
  if (!zmieniono) return { korzen: rewers.korzen, dane: {} };
  return {
    korzen: { ...rewers.korzen, dzieci },
    dane: uzyteDane,
  };
}

/**
 * Renderuje rewers karty na scenę (mm) w podanym rozmiarze docelowym (lub rozmiarze odniesienia rewersu).
 * Jeśli przekazano `docelowy.awers`, pola rewersu o tym samym typie i nazwie co pola awersu
 * przejmują niepuste wartości z danych tej karty.
 */
export function renderujRewers(
  rewers: Rewers,
  ctx: KontekstRenderowania,
  docelowy?: {
    szer?: Mm;
    wys?: Mm;
    promienRogow?: Mm;
    spad?: Mm;
    minDpi?: number;
    awers?: { szablon: Szablon; dane: Record<string, string> };
  },
): WyrenderowanaKarta {
  const podstawione = docelowy?.awers
    ? podstawWspolnePolaRewersu(rewers, docelowy.awers.szablon, docelowy.awers.dane)
    : undefined;
  const szablon: Szablon = {
    id: rewers.id,
    nazwa: rewers.nazwa,
    rozmiar:
      docelowy?.szer !== undefined && docelowy?.wys !== undefined
        ? { tryb: 'mm', szerokosc: docelowy.szer, wysokosc: docelowy.wys }
        : rewers.rozmiar,
    ...(docelowy?.promienRogow ? { promienRogow: docelowy.promienRogow } : {}),
    ...(rewers.tlo !== undefined ? { tlo: rewers.tlo } : {}),
    ...(rewers.teksturaTla !== undefined ? { teksturaTla: rewers.teksturaTla } : {}),
    ...(rewers.wzorTla !== undefined ? { wzorTla: rewers.wzorTla } : {}),
    ...(rewers.ramka !== undefined ? { ramka: rewers.ramka } : {}),
    korzen: podstawione ? podstawione.korzen : rewers.korzen,
  };
  return renderujKarte(szablon, { dane: podstawione ? podstawione.dane : {} }, ctx, {
    ...(rewers.teksturaTryb ? { teksturaTryb: rewers.teksturaTryb } : {}),
    ...(rewers.teksturaKrycie !== undefined ? { teksturaKrycie: rewers.teksturaKrycie } : {}),
    ...(rewers.teksturaZabarwienie !== undefined
      ? { teksturaZabarwienie: rewers.teksturaZabarwienie }
      : {}),
    ...(docelowy?.spad ? { spad: docelowy.spad } : {}),
    ...(docelowy?.minDpi ? { minDpi: docelowy.minDpi } : {}),
  });
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
  const wynik: ElementSceny[] = [];
  for (const os of osieLinii(r)) {
    const o = (r.odsuniecie ?? 0) + os;
    if (szer - 2 * o <= 0 || wys - 2 * o <= 0) continue;
    const promien =
      r.promien !== undefined
        ? Math.max(0, r.promien - (os - r.grubosc / 2))
        : Math.max(0, (promienRogow ?? 0) - o);
    wynik.push({
      typ: 'prostokat',
      x: o,
      y: o,
      szer: szer - 2 * o,
      wys: wys - 2 * o,
      ...(promien > 0 ? { promien } : {}),
      obrys: s,
    });
  }
  return szkicujElementy(wynik, r.szkic);
}

/**
 * Romb wpisany w prostokąt; `wciecie` przesuwa boki do środka (prostopadle) – np. o pół grubości
 * linii, żeby zewnętrzna krawędź obrysu pokrywała się z tłem.
 */
type KsztaltSciezki = 'sciety' | 'romb' | 'tarcza' | 'szesciokat' | 'wlasny' | Figura;
const KSZTALTY_SCIEZKI = new Set<string>(['sciety', 'romb', 'tarcza', 'szesciokat', ...FIGURY]);
const czyFigura = (k: string): k is Figura => (FIGURY as readonly string[]).includes(k);

/** Naturalne proporcje (szerokość / wysokość) kształtów sprzed schematu 28. */
const PROPORCJE: Partial<Record<PoleWartosc['ksztalt'], number>> = {
  romb: 1,
  tarcza: 0.85,
  // Sześciokąt foremny (płaska góra): szerokość 2R, wysokość √3·R.
  szesciokat: 2 / Math.sqrt(3),
};

/**
 * Proporcje kształtu wartości (szerokość / wysokość), gdy ma je zachować; `undefined` – kształt
 * wypełnia całe dostępne miejsce. Kwadrat i koło są zawsze równoboczne.
 */
function proporcjeWartosci(pole: PoleWartosc, ctx: KontekstRenderowania): number | undefined {
  if (pole.ksztalt === 'kwadrat' || pole.ksztalt === 'kolo') return 1;
  if (pole.zachowajProporcje === false) return undefined;
  if (czyFigura(pole.ksztalt)) return proporcjeFigury(pole.ksztalt, pole.ramiona);
  if (pole.ksztalt === 'wlasny') {
    const e = ksztaltWlasny(pole, ctx);
    return e && e.szer > 0 && e.wys > 0 ? e.szer / e.wys : undefined;
  }
  return PROPORCJE[pole.ksztalt];
}

/** Kontur kształtu ścieżkowego (bez ściętego) w ramce `r`, przesunięty do środka o `wciecie`. */
function konturSciezki(
  k: Exclude<KsztaltSciezki, 'sciety'>,
  r: Ramka,
  wciecie: Mm,
  ramiona?: number,
  wlasny?: ElementOzdobny,
): Kontur {
  if (k === 'wlasny') return wlasny ? konturWlasnegoKsztaltu(wlasny, r, wciecie) : [];
  if (czyFigura(k)) return konturFigury(k, r, wciecie, ramiona);
  return konturKsztaltu(k, r, wciecie);
}

/** Prostokąt treści wpisany w kształt – ułamki wymiarów kształtu (x, y, szerokość, wysokość). */
const WNETRZA: Partial<
  Record<PoleWartosc['ksztalt'], { x: number; y: number; szer: number; wys: number }>
> = {
  romb: { x: 0.25, y: 0.25, szer: 0.5, wys: 0.5 },
  // Kwadrat wpisany w okrąg: bok = średnica / √2.
  kolo: {
    x: (1 - Math.SQRT1_2) / 2,
    y: (1 - Math.SQRT1_2) / 2,
    szer: Math.SQRT1_2,
    wys: Math.SQRT1_2,
  },
  szesciokat: { x: 0.25, y: 0, szer: 0.5, wys: 1 },
  tarcza: { x: 0.15, y: 0.08, szer: 0.7, wys: 0.55 },
};

/** Własny kształt wartości z biblioteki (rodzaj „kształt”) albo `undefined`. */
function ksztaltWlasny(pole: PoleWartosc, ctx: KontekstRenderowania): ElementOzdobny | undefined {
  const e = pole.ksztaltElement ? znajdzElement(pole.ksztaltElement, ctx.elementy) : undefined;
  return e && e.rodzaj === 'ksztalt' ? e : undefined;
}

/** Prostokąt treści wpisany w kształt wartości (ułamki wymiarów) albo `undefined` (cała ramka). */
function wnetrzeKsztaltu(pole: PoleWartosc, ctx: KontekstRenderowania) {
  if (czyFigura(pole.ksztalt)) return wnetrzeFigury(pole.ksztalt, pole.ramiona);
  if (pole.ksztalt !== 'wlasny') return WNETRZA[pole.ksztalt];
  const e = ksztaltWlasny(pole, ctx);
  return e ? wnetrzeWlasnegoKsztaltu(e) : undefined;
}

/** Kontur kształtu wartości (romb, tarcza, sześciokąt) przesunięty do środka o `wciecie`. */
export function konturKsztaltu(
  k: 'romb' | 'tarcza' | 'szesciokat',
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
  wlasny?: ElementOzdobny,
  ramiona?: number,
): ElementSceny[] {
  const s = obrys(o);
  if (!s) return [];
  return szkicujElementy(
    osieLinii(o).flatMap((d) =>
      jednaLiniaObramowania(o, s, d, u, promien, ksztalt, wlasny, ramiona),
    ),
    o.szkic,
  );
}

/** Jedna linia obramowania, której oś leży `d` mm od krawędzi węzła. */
function jednaLiniaObramowania(
  o: Obramowanie,
  s: Obrys,
  d: Mm,
  u: Ramka,
  promien: Mm | undefined,
  ksztalt?: KsztaltSciezki,
  wlasny?: ElementOzdobny,
  ramiona?: number,
): ElementSceny[] {
  // Romb, tarcza, gwiazda, własny… – zawsze pełny obrys (wybór krawędzi dotyczy prostokątów).
  if (ksztalt && ksztalt !== 'sciety' && (ksztalt !== 'wlasny' || wlasny))
    return [{ typ: 'sciezka', kontur: konturSciezki(ksztalt, u, d, ramiona, wlasny), obrys: s }];
  const k = o.krawedzie;
  if (!k && ksztalt === 'sciety') {
    const wew = {
      x: u.x + d,
      y: u.y + d,
      szer: Math.max(0, u.szer - 2 * d),
      wys: Math.max(0, u.wys - 2 * d),
    };
    // Ścięcie mierzone na zewnętrznej krawędzi (jak tło). Ośmiokąt przesunięty do środka o d
    // ma ścięcie mniejsze o (2 − √2)·d – wtedy zewnętrzna krawędź linii pokrywa się z tłem.
    return [
      {
        typ: 'sciezka',
        kontur: konturScietego(wew, Math.max(0, (promien ?? 0) - (2 - Math.SQRT2) * d)),
        obrys: s,
      },
    ];
  }
  if (!k) {
    // Linia w całości wewnątrz węzła: przesunięta o `d` od krawędzi.
    return [
      {
        typ: 'prostokat',
        x: u.x + d,
        y: u.y + d,
        szer: Math.max(0, u.szer - 2 * d),
        wys: Math.max(0, u.wys - 2 * d),
        promien: promien === undefined ? undefined : Math.max(0, promien - d),
        obrys: s,
      },
    ];
  }
  const l = u.x;
  const p = u.x + u.szer;
  const gr = u.y;
  const dn = u.y + u.wys;
  const linie: ElementSceny[] = [];
  if (k.gora) linie.push({ typ: 'linia', x1: l, y1: gr + d, x2: p, y2: gr + d, obrys: s });
  if (k.dol) linie.push({ typ: 'linia', x1: l, y1: dn - d, x2: p, y2: dn - d, obrys: s });
  if (k.lewo) linie.push({ typ: 'linia', x1: l + d, y1: gr, x2: l + d, y2: dn, obrys: s });
  if (k.prawo) linie.push({ typ: 'linia', x1: p - d, y1: gr, x2: p - d, y2: dn, obrys: s });
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
      const fr = fragmentyTekstu(pole, wartosc, dane, ctx);
      if (fr.length === 0) return { szer: 0, wys: 0 };
      const naturalny = ulozTekst(fr, undefined, ctx.czcionki);
      if (pole.luk) {
        const g = graniceTekstuPoLuku(naturalny, pole.luk);
        return { szer: g.szer, wys: g.wys };
      }
      if (
        pole.wieleWierszy === false ||
        ogr.szer === undefined ||
        naturalny.szerokosc <= ogr.szer
      ) {
        return { szer: naturalny.szerokosc, wys: naturalny.wysokosc };
      }
      const zlamany = ulozTekst(fr, ogr.szer, ctx.czcionki, 1, true);
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
        const w = wnetrzeKsztaltu(pole, ctx);
        if (w) {
          const m = marginesRombu(pole);
          k = { szer: (u.szerokosc + 2 * m) / w.szer, wys: (u.wysokosc + 2 * m) / w.wys };
        }
        // Stałe proporcje: krótszy wymiar wydłużony do proporcji kształtu.
        const p = proporcjeWartosci(pole, ctx);
        if (p && k.wys > 0)
          k =
            k.szer / k.wys < p
              ? { szer: k.wys * p, wys: k.wys }
              : { szer: k.szer, wys: k.szer / p };
      }
      const e = etykietaWartosci(pole, dane, ctx);
      if (!e) return k;
      const obok = pole.etykieta!.pozycja === 'lewo' || pole.etykieta!.pozycja === 'prawo';
      return obok
        ? { szer: k.szer + e.uklad.szerokosc + e.odstep, wys: Math.max(k.wys, e.uklad.wysokosc) }
        : { szer: Math.max(k.szer, e.uklad.szerokosc), wys: k.wys + e.uklad.wysokosc + e.odstep };
    }
    case 'separator': {
      // Długość 0 – linię wydłuża rozciągnięcie w rodzicu; inaczej separator rozpychałby
      // kontenery mierzone wg treści. Ozdoby (zakończenia, środek, motyw) wyznaczają wysokość w poprzek linii.
      const w = Math.max(
        pelnaGrubosc({ ...pole, styl: pole.stylLinii }),
        wysokoscOzdobySeparatora(pole, ctx.elementy),
      );
      return pole.kierunek === 'poziomy' ? { szer: 0, wys: w } : { szer: w, wys: 0 };
    }
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
    case 'ikona': {
      if (pole.element) {
        const e = znajdzElement(pole.element, ctx.elementy);
        if (e && e.kontury.length > 0) {
          const skala = pole.rozmiar / Math.max(e.szer, e.wys);
          return { szer: e.szer * skala, wys: e.wys * skala };
        }
      }
      return { szer: pole.rozmiar, wys: pole.rozmiar };
    }
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
  const fr = fragmentyTekstu(pole, wartosc, dane, ctx);
  if (fr.length === 0) return [];
  const minSkala = minimalnaSkala(pole.styl);
  if (pole.luk) {
    const uklad = ulozPoLukuDopasowany(fr, pole.luk, ramka.szer, ramka.wys, ctx.czcionki, minSkala);
    if (uklad.przepelnienie) ostrzezenia.push({ pole: pole.id, komunikat: 'tekst-nie-miesci-sie' });
    dodajOstrzezenieZnakow(pole.id, fr, ctx, ostrzezenia);
    const elementy = tekstPoLukuNaScene(
      uklad,
      pole.luk,
      ramka,
      pole.styl.wyrownanie ?? 'srodek',
      pole.styl.wyrownaniePionowe ?? 'srodek',
      glify,
      pole.styl.obwodka,
    );
    return uklad.przepelnienie
      ? [{ typ: 'grupa', x: 0, y: 0, przyciecie: ramka, elementy }]
      : elementy;
  }
  const wieleWierszy = pole.wieleWierszy !== false;
  const uklad = ulozDopasowany(
    fr,
    ramka.szer,
    ramka.wys,
    ctx.czcionki,
    wieleWierszy,
    minSkala,
    true,
  );
  if (uklad.przepelnienie) ostrzezenia.push({ pole: pole.id, komunikat: 'tekst-nie-miesci-sie' });
  dodajOstrzezenieZnakow(pole.id, fr, ctx, ostrzezenia);
  const elementy = tekstNaScene(
    uklad,
    ramka,
    pole.styl.wyrownanie ?? 'lewo',
    pole.styl.wyrownaniePionowe ?? 'poczatek',
    glify,
    pole.styl.obwodka,
  );
  return uklad.przepelnienie
    ? [{ typ: 'grupa', x: 0, y: 0, przyciecie: ramka, elementy }]
    : elementy;
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
  pole: Exclude<Pole, PoleTekst>,
  ramkaPola: Ramka,
  dane: Record<string, string>,
  ctx: KontekstRenderowania,
  glify: Record<string, DefinicjaGlifu>,
  ostrzezenia: Ostrzezenie[],
  symbole: Record<string, DefinicjaSymbolu>,
): ElementSceny[] {
  const wartosc = wartoscPola(pole, dane);
  let ramka = ramkaPola;
  switch (pole.typ) {
    case 'wartosc': {
      const fr = [{ tekst: wartosc, styl: pole.styl }];
      const minSkala = minimalnaSkala(pole.styl);
      const w = wnetrzeKsztaltu(pole, ctx);
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
      const kolor = pole.kolor ?? CZARNY;
      const s = obrys({ grubosc: pole.grubosc, kolor, styl: pole.stylLinii });
      // Linia podwójna: dwie linie symetrycznie względem środka pola.
      const polowa = (pelnaGrubosc({ ...pole, styl: pole.stylLinii }) - pole.grubosc) / 2;
      const w = rysujSeparatorOzdobny(
        pole,
        ramka,
        { obrys: s, odsuniecia: pole.stylLinii === 'podwojna' ? [-polowa, polowa] : [0] },
        kolor,
        ctx.elementy,
      );
      Object.assign(symbole, w.symbole);
      for (const id of w.nieznane)
        ostrzezenia.push({ pole: pole.id, komunikat: 'nieznany-element-ozdobny', szczegoly: id });
      return szkicujElementy(w.elementy, pole.szkic);
    }
    case 'tabela':
      return rysujTabele(pole, ramka, dane, ctx, glify, ostrzezenia);
    case 'ikona': {
      if (pole.element) {
        const e = znajdzElement(pole.element, ctx.elementy);
        if (!e || e.kontury.length === 0) {
          ostrzezenia.push({
            pole: pole.id,
            komunikat: 'nieznany-element-ozdobny',
            szczegoly: pole.element,
          });
          const bok = Math.min(pole.rozmiar, ramka.szer, ramka.wys);
          return zastepczyProstokat({
            x: ramka.x + (ramka.szer - bok) / 2,
            y: ramka.y + (ramka.wys - bok) / 2,
            szer: bok,
            wys: bok,
          });
        }
        const wypelniaj = pole.szerokosc !== undefined && pole.wysokosc !== undefined;
        const maxSzer = wypelniaj ? ramka.szer : Math.min(pole.rozmiar, ramka.szer);
        const maxWys = wypelniaj ? ramka.wys : Math.min(pole.rozmiar, ramka.wys);
        const skala = Math.min(maxSzer / e.szer, maxWys / e.wys);
        if (!(skala > 0)) return [];
        const w = e.szer * skala;
        const h = e.wys * skala;
        const dx = ramka.x + (ramka.szer - w) / 2;
        const dy = ramka.y + (ramka.wys - h) / 2;
        symbole[e.id] = symbolZElementu(e);
        return [
          {
            typ: 'symbol',
            klucz: e.id,
            macierz: [skala, 0, 0, skala, dx, dy],
            kolor: pole.kolor ?? CZARNY,
          },
        ];
      }
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
const marginesRombu = (pole: PoleWartosc): Mm =>
  pole.obramowanie ? pelnaGrubosc(pole.obramowanie) : 0;

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
      for (const d of osieLinii(l))
        wynik.push({
          typ: 'prostokat',
          x: x + d,
          y: y + d,
          szer: Math.max(0, t.szer - 2 * d),
          wys: Math.max(0, t.wys - 2 * d),
          obrys: s,
        });
  }
  return wynik;
}

/**
 * Efektywna rozdzielczość obrazu rastrowego (DPI) po dopasowaniu, skalowaniu i kadrowaniu:
 * korzysta z pikseli źródłowych faktycznie użytych w widocznym kadrze i ich wymiaru w mm na wydruku.
 * Zwraca `undefined`, gdy obraz po przycięciu nie ma widocznego obszaru.
 */
export function efektywneDpiObrazu(
  info: InformacjaOObrazie,
  narysowany: { x: Mm; y: Mm; szer: Mm; wys: Mm; obrot?: number },
  przyciecie?: Ramka,
): number | undefined {
  const EPS = 1e-6;
  if (
    !(info.szerokosc > 0) ||
    !(info.wysokosc > 0) ||
    !(narysowany.szer > EPS) ||
    !(narysowany.wys > EPS)
  )
    return undefined;
  if (przyciecie) {
    const obwiednia =
      narysowany.obrot && narysowany.obrot % 360 !== 0
        ? obrocProstokat(
            narysowany,
            narysowany.x + narysowany.szer / 2,
            narysowany.y + narysowany.wys / 2,
            narysowany.obrot,
          )
        : narysowany;
    const visX =
      Math.min(obwiednia.x + obwiednia.szer, przyciecie.x + przyciecie.szer) -
      Math.max(obwiednia.x, przyciecie.x);
    const visY =
      Math.min(obwiednia.y + obwiednia.wys, przyciecie.y + przyciecie.wys) -
      Math.max(obwiednia.y, przyciecie.y);
    if (!(visX > EPS && visY > EPS)) return undefined;
  }
  const dpiX = (info.szerokosc * 25.4) / narysowany.szer;
  const dpiY = (info.wysokosc * 25.4) / narysowany.wys;
  return Math.min(dpiX, dpiY);
}

function rysujPoleObrazu(
  pole: PoleObraz,
  ramka: Ramka,
  dane: Record<string, string>,
  ctx: KontekstRenderowania,
  ostrzezenia: Ostrzezenie[],
  przeszkody: Ramka[],
  ustawienia: UstawieniaObrazu | undefined,
  minDpi?: number,
): ElementSceny[] {
  const zasob = wartoscPola(pole, dane);
  const info = ctx.obraz?.(zasob);
  if (!info || info.szerokosc <= 0 || info.wysokosc <= 0) {
    ostrzezenia.push({ pole: pole.id, komunikat: 'brak-obrazu', szczegoly: zasob });
    return zasob.trim() !== '' ? zastepczyProstokat(ramka) : [];
  }
  const u = normalizujUstawieniaObrazu(ustawienia);
  const dopasowanie = u.dopasowanie ?? pole.dopasowanie;
  const obszar = wolnyObszar(ramka, przeszkody, pole.odstepOdOmijanych ?? 0.5, info, dopasowanie);
  if (!(obszar.szer > 1e-6 && obszar.wys > 1e-6)) {
    ostrzezenia.push({ pole: pole.id, komunikat: 'brak-miejsca-na-obraz', szczegoly: zasob });
    return [];
  }
  const kadr = pole.kadr ?? { x: 0.5, y: 0.5 };
  const el = rysujObraz(zasob, info, obszar, ramka, dopasowanie, kadr, u);
  if (minDpi && el.typ === 'obraz') {
    const dpi = efektywneDpiObrazu(info, el, el.przyciecie);
    if (dpi !== undefined && dpi < minDpi - 1e-6) {
      ostrzezenia.push({
        pole: pole.id,
        komunikat: 'niska-rozdzielczosc-obrazu',
        szczegoly: String(Math.floor(dpi)),
      });
    }
  }
  return [el];
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
