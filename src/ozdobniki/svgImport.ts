import svgpath from 'svgpath';
import type { KomendaKonturu, Kontur, KonturSymbolu, Macierz } from '../silnik/scena';
import { kolorSceny } from '../silnik/scena';
import { BladXml, parsujXml, type WezelXml } from './svgXml';
import type { ElementOzdobny, RodzajElementu } from './typy';

/**
 * Import własnego pliku SVG do biblioteki ozdobników (SPEC 5, plan M2b sekcja 3.4).
 *
 * Bezpieczeństwo: surowego SVG nigdy nie wstawiamy do strony. Plik jest parsowany własnym
 * parserem XML (`svgXml.ts`), a z elementów z białej listy (path, rect, circle, ellipse, line,
 * polyline, polygon, g, a, switch, use do wewnętrznych `#id`, symbol przez `use`) powstają własne
 * kontury M/L/C/Z w jednostkach pola (wysokość 10, oś Y w dół). Skrypty, zdarzenia (`on…`),
 * odwołania zewnętrzne, `foreignObject`, obrazy, tekst, filtry, maski, przycięcia i wzory są
 * pomijane – z raportem „co pominięto”. Bomby: limity rozmiaru pliku, liczby elementów, głębokości,
 * kształtów, rozwinięć `use` i komend po spłaszczeniu.
 */

export const LIMITY_SVG = {
  /** Rozmiar pliku (bajty). */
  bajty: 512 * 1024,
  /** Liczba komend ścieżek po spłaszczeniu. */
  komendy: 20000,
  /** Liczba rysowanych kształtów (z rozwinięciem `use`). */
  ksztalty: 5000,
  /** Liczba rozwinięć `use`. */
  uzycia: 2000,
};

/** Wysokość rysunku po imporcie (jednostki pola) – jak w elementach wbudowanych. */
export const WYSOKOSC_IMPORTU = 10;

export type KodPominiecia =
  | 'skrypt'
  | 'zdarzenie'
  | 'odwolanie-zewnetrzne'
  | 'foreignObject'
  | 'obraz'
  | 'tekst'
  | 'styl-css'
  | 'gradient'
  | 'filtr'
  | 'maska'
  | 'przyciecie'
  | 'wzor'
  | 'znacznik'
  | 'animacja'
  | 'przezroczystosc'
  | 'kreskowanie'
  | 'nieznany-element'
  | 'nieznany-kolor'
  | 'bledna-sciezka';

export interface Pominiecie {
  kod: KodPominiecia;
  ile: number;
  /** Np. nazwa nieznanego elementu. */
  szczegoly?: string;
}

export type KodBleduSvg =
  | 'za-duzy'
  | 'xml'
  | 'nie-svg'
  | 'za-duzo-elementow'
  | 'za-gleboko'
  | 'za-duzo-ksztaltow'
  | 'za-duzo-komend'
  | 'pusty'
  | 'wymiary';

export class BladImportuSvg extends Error {
  constructor(
    readonly kod: KodBleduSvg,
    komunikat: string,
  ) {
    super(komunikat);
    this.name = 'BladImportuSvg';
  }
}

export interface WynikImportuSvg {
  /** Element bez identyfikatora i nazwy – nadaje je biblioteka projektu. */
  element: Omit<ElementOzdobny, 'id' | 'nazwa'>;
  raport: Pominiecie[];
  liczbaSciezek: number;
  /** Liczba różnych kolorów w pliku (`currentColor` liczy się jako kolor). */
  liczbaKolorow: number;
  liczbaKomend: number;
}

export interface OpcjeImportuSvg {
  rodzaj?: RodzajElementu;
  /** Domyślnie: `jednolity`, gdy plik ma najwyżej jeden kolor, inaczej `oryginal`. */
  kolorowanie?: 'jednolity' | 'oryginal';
}

// ---------------------------------------------------------------------------------------------
// Macierze

const TOZSAMOSC: Macierz = [1, 0, 0, 1, 0, 0];

/** Złożenie: najpierw `b`, potem `a` (punkt p → a(b(p))). */
export function zlozMacierze(a: Macierz, b: Macierz): Macierz {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

/** Atrybut `transform` SVG → macierz (matrix, translate, scale, rotate, skewX, skewY); błąd = tożsamość. */
export function parsujTransformacje(tekst: string | undefined): Macierz {
  if (!tekst) return TOZSAMOSC;
  let m: Macierz = TOZSAMOSC;
  const re = /\s*(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)\s*,?/gy;
  let kon = 0;
  for (let w = re.exec(tekst); w; w = re.exec(tekst)) {
    kon = re.lastIndex;
    const a = (w[2] ?? '')
      .split(/[\s,]+/)
      .filter((x) => x !== '')
      .map(Number);
    if (a.some((x) => !Number.isFinite(x))) return TOZSAMOSC;
    const rad = (st: number) => (st * Math.PI) / 180;
    let n: Macierz | undefined;
    switch (w[1]) {
      case 'matrix':
        if (a.length === 6) n = a as Macierz;
        break;
      case 'translate':
        if (a.length === 1 || a.length === 2) n = [1, 0, 0, 1, a[0]!, a[1] ?? 0];
        break;
      case 'scale':
        if (a.length === 1 || a.length === 2) n = [a[0]!, 0, 0, a[1] ?? a[0]!, 0, 0];
        break;
      case 'rotate': {
        if (a.length !== 1 && a.length !== 3) break;
        const c = Math.cos(rad(a[0]!));
        const s = Math.sin(rad(a[0]!));
        const r: Macierz = [c, s, -s, c, 0, 0];
        n =
          a.length === 3
            ? zlozMacierze(zlozMacierze([1, 0, 0, 1, a[1]!, a[2]!], r), [
                1,
                0,
                0,
                1,
                -a[1]!,
                -a[2]!,
              ])
            : r;
        break;
      }
      case 'skewX':
        if (a.length === 1) n = [1, 0, Math.tan(rad(a[0]!)), 1, 0, 0];
        break;
      case 'skewY':
        if (a.length === 1) n = [1, Math.tan(rad(a[0]!)), 0, 1, 0, 0];
        break;
    }
    if (!n) return TOZSAMOSC;
    m = zlozMacierze(m, n);
  }
  // Niedopasowana reszta tekstu (nieznana transformacja) – całość ignorowana.
  return tekst.slice(kon).trim() === '' ? m : TOZSAMOSC;
}

// ---------------------------------------------------------------------------------------------
// Ścieżki

/**
 * Ścieżka SVG (`d`) → kontur M/L/C/Z po przekształceniu macierzą. Skróty (H, V, S, T), polecenia
 * względne i łuki (A) rozwija biblioteka `svgpath` (MIT); Q → C własnym kodem.
 */
export function splaszczSciezke(d: string, m: Macierz = TOZSAMOSC): Kontur {
  const sp = svgpath(d).matrix(m).abs().unarc().unshort();
  const wynik: Kontur = [];
  let x = 0;
  let y = 0;
  let px = 0;
  let py = 0;
  let otwarty = false;
  sp.iterate((s: (string | number)[]) => {
    const k = s[0] as string;
    const n = (i: number) => s[i] as number;
    // Rysowanie po `Z` bez nowego `M` zaczyna się w początku podścieżki.
    if (k !== 'M' && k !== 'Z' && !otwarty) wynik.push(['M', px, py]);
    if (k !== 'M' && k !== 'Z') otwarty = true;
    switch (k) {
      case 'M':
        wynik.push(['M', n(1), n(2)]);
        x = px = n(1);
        y = py = n(2);
        otwarty = true;
        break;
      case 'L':
        wynik.push(['L', n(1), n(2)]);
        x = n(1);
        y = n(2);
        break;
      case 'H':
        wynik.push(['L', n(1), y]);
        x = n(1);
        break;
      case 'V':
        wynik.push(['L', x, n(1)]);
        y = n(1);
        break;
      case 'C':
        wynik.push(['C', n(1), n(2), n(3), n(4), n(5), n(6)]);
        x = n(5);
        y = n(6);
        break;
      case 'Q': {
        const [qx, qy, ex, ey] = [n(1), n(2), n(3), n(4)];
        wynik.push([
          'C',
          x + (2 / 3) * (qx - x),
          y + (2 / 3) * (qy - y),
          ex + (2 / 3) * (qx - ex),
          ey + (2 / 3) * (qy - ey),
          ex,
          ey,
        ]);
        x = ex;
        y = ey;
        break;
      }
      case 'Z':
        if (otwarty) wynik.push(['Z']);
        otwarty = false;
        x = px;
        y = py;
        break;
    }
  });
  return wynik;
}

const f = (v: number) => (Number.isFinite(v) ? String(v) : '0');

function sciezkaProstokata(x: number, y: number, w: number, h: number, rx: number, ry: number) {
  if (rx > 0 && ry > 0) {
    return (
      `M${f(x + rx)} ${f(y)}H${f(x + w - rx)}A${f(rx)} ${f(ry)} 0 0 1 ${f(x + w)} ${f(y + ry)}` +
      `V${f(y + h - ry)}A${f(rx)} ${f(ry)} 0 0 1 ${f(x + w - rx)} ${f(y + h)}` +
      `H${f(x + rx)}A${f(rx)} ${f(ry)} 0 0 1 ${f(x)} ${f(y + h - ry)}` +
      `V${f(y + ry)}A${f(rx)} ${f(ry)} 0 0 1 ${f(x + rx)} ${f(y)}Z`
    );
  }
  return `M${f(x)} ${f(y)}H${f(x + w)}V${f(y + h)}H${f(x)}Z`;
}

function sciezkaElipsy(cx: number, cy: number, rx: number, ry: number) {
  return (
    `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)}` +
    `A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}Z`
  );
}

// ---------------------------------------------------------------------------------------------
// Kolory

const NAZWANE: Record<string, string> = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  lime: '#00ff00',
  blue: '#0000ff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  aqua: '#00ffff',
  magenta: '#ff00ff',
  fuchsia: '#ff00ff',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  maroon: '#800000',
  olive: '#808000',
  navy: '#000080',
  purple: '#800080',
  teal: '#008080',
  orange: '#ffa500',
  brown: '#a52a2a',
  pink: '#ffc0cb',
  gold: '#ffd700',
  darkred: '#8b0000',
  darkgreen: '#006400',
  darkblue: '#00008b',
  darkgray: '#a9a9a9',
  darkgrey: '#a9a9a9',
  lightgray: '#d3d3d3',
  lightgrey: '#d3d3d3',
  dimgray: '#696969',
  dimgrey: '#696969',
  beige: '#f5f5dc',
  ivory: '#fffff0',
  khaki: '#f0e68c',
  tan: '#d2b48c',
  crimson: '#dc143c',
  indigo: '#4b0082',
  violet: '#ee82ee',
  coral: '#ff7f50',
  salmon: '#fa8072',
  chocolate: '#d2691e',
  sienna: '#a0522d',
  firebrick: '#b22222',
  forestgreen: '#228b22',
  royalblue: '#4169e1',
  skyblue: '#87ceeb',
  steelblue: '#4682b4',
  goldenrod: '#daa520',
  wheat: '#f5deb3',
  linen: '#faf0e6',
};

/** Kolor SVG: `#rrggbb`, `'kolor'` (currentColor), `undefined` (brak) albo `null` (nieznany). */
export function kolorSvg(v: string): string | undefined | null {
  const s = v.trim().toLowerCase();
  if (s === 'none' || s === 'transparent' || s === '') return undefined;
  if (s === 'currentcolor') return 'kolor';
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(s)) {
    // #rrggbbaa – alfa pomijana (raport o przezroczystości nie dotyczy zapisu szesnastkowego).
    return s.length === 9 ? kolorSceny(s.slice(0, 7)) : kolorSceny(s);
  }
  const rgb = /^rgba?\(\s*([\d.]+)(%?)\s*[, ]\s*([\d.]+)(%?)\s*[, ]\s*([\d.]+)(%?)/.exec(s);
  if (rgb) {
    const kanal = (liczba: string, procent: string) => {
      const x = parseFloat(liczba) * (procent ? 2.55 : 1);
      return Math.max(0, Math.min(255, Math.round(x)));
    };
    const h = [kanal(rgb[1]!, rgb[2]!), kanal(rgb[3]!, rgb[4]!), kanal(rgb[5]!, rgb[6]!)];
    return '#' + h.map((c) => c.toString(16).padStart(2, '0')).join('');
  }
  return NAZWANE[s] ?? null;
}

// ---------------------------------------------------------------------------------------------
// Import

interface Styl {
  fill: string;
  stroke: string;
  szerObrysu: number;
  evenodd: boolean;
  niewidoczny: boolean;
}

const STYL_DOMYSLNY: Styl = {
  fill: '#000000',
  stroke: 'none',
  szerObrysu: 1,
  evenodd: false,
  niewidoczny: false,
};

interface Surowy {
  kontur: Kontur;
  wypelnienie?: string;
  obrys?: { grubosc: number; kolor: string };
  evenodd: boolean;
}

const GRUPY = new Set(['g', 'a', 'switch', 'svg']);
const KSZTALTY = new Set(['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
/** Elementy pomijane po cichu (opis, definicje używane tylko przez odwołania, metadane edytorów). */
const CICHE = new Set([
  'title',
  'desc',
  'metadata',
  'defs',
  'symbol',
  'linearGradient',
  'radialGradient',
  'stop',
  'view',
  'namedview',
]);
const ANIMACJE = new Set(['animate', 'animateTransform', 'animateMotion', 'set', 'animateColor']);

/** Właściwości z atrybutu `style="a:b;c:d"`. */
function wlasciwosciStylu(s: string | undefined): Record<string, string> {
  const w: Record<string, string> = {};
  if (!s) return w;
  for (const czesc of s.split(';')) {
    const i = czesc.indexOf(':');
    if (i > 0) w[czesc.slice(0, i).trim().toLowerCase()] = czesc.slice(i + 1).trim();
  }
  return w;
}

const liczba = (v: string | undefined, domyslna = 0): number => {
  if (v === undefined) return domyslna;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : domyslna;
};

function bajtyNaTekst(zrodlo: string | Uint8Array): string {
  if (typeof zrodlo === 'string') return zrodlo;
  return new TextDecoder('utf-8').decode(zrodlo);
}

/**
 * Importuje SVG: sanityzacja, spłaszczenie do konturów, normalizacja do wysokości 10.
 * Rzuca `BladImportuSvg` przy pliku nieczytelnym, zbyt dużym albo bez rysunku.
 */
export function importujSvg(
  zrodlo: string | Uint8Array,
  opcje: OpcjeImportuSvg = {},
): WynikImportuSvg {
  const rozmiar =
    typeof zrodlo === 'string' ? new TextEncoder().encode(zrodlo).length : zrodlo.length;
  if (rozmiar > LIMITY_SVG.bajty)
    throw new BladImportuSvg('za-duzy', `Plik większy niż ${LIMITY_SVG.bajty / 1024} KB.`);
  let korzen: WezelXml;
  try {
    korzen = parsujXml(bajtyNaTekst(zrodlo));
  } catch (e) {
    if (e instanceof BladXml) throw new BladImportuSvg(e.kod, e.message);
    throw e;
  }
  if (korzen.nazwa !== 'svg' || (korzen.przestrzen !== '' && korzen.przestrzen !== 'svg'))
    throw new BladImportuSvg('nie-svg', 'Główny element nie jest <svg>.');

  const raport = new Map<KodPominiecia, Pominiecie>();
  const zglos = (kod: KodPominiecia, szczegoly?: string, ile = 1) => {
    const r = raport.get(kod);
    if (r) r.ile += ile;
    else raport.set(kod, { kod, ile, ...(szczegoly !== undefined ? { szczegoly } : {}) });
  };

  // Identyfikatory (do `use` i gradientów) oraz audyt całego drzewa: co usuwamy z raportem.
  const poId = new Map<string, WezelXml>();
  const definicje = { filtr: 0, maska: 0, przyciecie: 0 };
  const uzycia = { filtr: 0, maska: 0, przyciecie: 0 };
  const stos: WezelXml[] = [korzen];
  while (stos.length > 0) {
    const w = stos.pop()!;
    if (w.atr.id !== undefined && !poId.has(w.atr.id)) poId.set(w.atr.id, w);
    const swoj = w.przestrzen === '' || w.przestrzen === 'svg';
    if (swoj) {
      switch (w.nazwa) {
        case 'script':
          zglos('skrypt');
          break;
        case 'foreignObject':
          zglos('foreignObject');
          break;
        case 'image':
          zglos('obraz');
          break;
        case 'text':
          zglos('tekst');
          break;
        case 'style':
          if ((w.tekst ?? '').trim() !== '') zglos('styl-css');
          break;
        case 'filter':
          definicje.filtr++;
          break;
        case 'mask':
          definicje.maska++;
          break;
        case 'clipPath':
          definicje.przyciecie++;
          break;
        case 'pattern':
          zglos('wzor');
          break;
        case 'marker':
          zglos('znacznik');
          break;
        default:
          if (ANIMACJE.has(w.nazwa)) zglos('animacja');
      }
    }
    for (const [nazwa, wartosc] of Object.entries(w.atr)) {
      const n = nazwa.toLowerCase();
      if (n.startsWith('on')) zglos('zdarzenie', nazwa);
      if (n === 'href' || n === 'xlink:href') {
        if (!wartosc.trim().startsWith('#')) zglos('odwolanie-zewnetrzne');
      }
      if (/javascript:/i.test(wartosc)) zglos('skrypt', 'javascript:');
      if (n === 'filter') uzycia.filtr++;
      if (n === 'mask') uzycia.maska++;
      if (n === 'clip-path') uzycia.przyciecie++;
    }
    const st = wlasciwosciStylu(w.atr.style);
    for (const [n, v] of Object.entries(st)) {
      if (/url\(\s*['"]?\s*(?!#)/i.test(v) && /url\(/i.test(v)) zglos('odwolanie-zewnetrzne');
      if (n === 'filter') uzycia.filtr++;
      if (n === 'mask') uzycia.maska++;
      if (n === 'clip-path') uzycia.przyciecie++;
    }
    for (const d of w.dzieci) stos.push(d);
  }
  for (const [pole, kod] of [
    ['filtr', 'filtr'],
    ['maska', 'maska'],
    ['przyciecie', 'przyciecie'],
  ] as const) {
    const ile = Math.max(definicje[pole], uzycia[pole]);
    if (ile > 0) zglos(kod, undefined, ile);
  }

  // Obszar rysunku: viewBox, a bez niego width/height; inaczej obwiednia geometrii.
  let widok: { x: number; y: number; szer: number; wys: number } | undefined;
  const vb = (korzen.atr.viewBox ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (vb.length === 4 && vb.every(Number.isFinite) && vb[2]! > 0 && vb[3]! > 0)
    widok = { x: vb[0]!, y: vb[1]!, szer: vb[2]!, wys: vb[3]! };
  else {
    const w = liczba(korzen.atr.width);
    const h = liczba(korzen.atr.height);
    if (w > 0 && h > 0 && !korzen.atr.width?.includes('%') && !korzen.atr.height?.includes('%'))
      widok = { x: 0, y: 0, szer: w, wys: h };
  }

  const surowe: Surowy[] = [];
  let ksztalty = 0;
  let uzyciaUse = 0;

  const kolorWypelnienia = (v: string): string | undefined => {
    const g = /^url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/i.exec(v.trim());
    if (g) {
      zglos('gradient');
      let wezel = poId.get(g[1]!);
      for (let i = 0; wezel && i < 5; i++) {
        const stop = wezel.dzieci.find((c) => c.nazwa === 'stop');
        if (stop) {
          const sc = wlasciwosciStylu(stop.atr.style)['stop-color'] ?? stop.atr['stop-color'];
          const k = sc ? kolorSvg(sc) : '#000000';
          return k === null ? '#000000' : k;
        }
        const ref = (wezel.atr.href ?? wezel.atr['xlink:href'] ?? '').trim();
        wezel = ref.startsWith('#') ? poId.get(ref.slice(1)) : undefined;
      }
      return undefined;
    }
    const k = kolorSvg(v);
    if (k === null) {
      zglos('nieznany-kolor', v);
      return '#000000';
    }
    return k;
  };

  const styl = (w: WezelXml, rodzic: Styl): Styl => {
    const wl = { ...w.atr, ...wlasciwosciStylu(w.atr.style) };
    const dziedzicz = (v: string | undefined, r: string) =>
      v === undefined || v.trim() === 'inherit' ? r : v;
    const wynik: Styl = {
      fill: dziedzicz(wl.fill, rodzic.fill),
      stroke: dziedzicz(wl.stroke, rodzic.stroke),
      szerObrysu:
        wl['stroke-width'] !== undefined ? liczba(wl['stroke-width'], 1) : rodzic.szerObrysu,
      evenodd:
        wl['fill-rule'] !== undefined ? wl['fill-rule'].trim() === 'evenodd' : rodzic.evenodd,
      niewidoczny:
        rodzic.niewidoczny ||
        wl.display?.trim() === 'none' ||
        wl.visibility?.trim() === 'hidden' ||
        wl.visibility?.trim() === 'collapse' ||
        liczba(wl.opacity, 1) <= 0,
    };
    for (const n of ['opacity', 'fill-opacity', 'stroke-opacity'])
      if (wl[n] !== undefined && liczba(wl[n], 1) < 1 && liczba(wl[n], 1) > 0)
        zglos('przezroczystosc');
    if (wl['stroke-dasharray'] !== undefined && wl['stroke-dasharray'].trim() !== 'none')
      zglos('kreskowanie');
    return wynik;
  };

  const dodaj = (d: string, m: Macierz, s: Styl) => {
    if (++ksztalty > LIMITY_SVG.ksztalty)
      throw new BladImportuSvg('za-duzo-ksztaltow', `Więcej niż ${LIMITY_SVG.ksztalty} kształtów.`);
    let kontur: Kontur;
    try {
      kontur = splaszczSciezke(d, m);
    } catch {
      zglos('bledna-sciezka');
      return;
    }
    const ok = kontur.every((k) => k.slice(1).every((v) => Number.isFinite(v)));
    if (kontur.length === 0 || !ok) {
      if (d.trim() !== '') zglos('bledna-sciezka');
      return;
    }
    const wyp = kolorWypelnienia(s.fill);
    const obr = kolorWypelnienia(s.stroke);
    const skala = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
    const grubosc = s.szerObrysu * skala;
    const maObrys = obr !== undefined && grubosc > 0;
    if (wyp === undefined && !maObrys) return;
    const podsciezki = kontur.filter((k) => k[0] === 'M').length;
    surowe.push({
      kontur,
      ...(wyp !== undefined ? { wypelnienie: wyp } : {}),
      ...(maObrys ? { obrys: { grubosc, kolor: obr } } : {}),
      evenodd: s.evenodd && podsciezki > 1,
    });
  };

  const przejdz = (w: WezelXml, m: Macierz, rodzic: Styl, uzywane: string[]) => {
    if (w.przestrzen !== '' && w.przestrzen !== 'svg') return;
    const n = w.nazwa;
    if (n === 'foreignObject' || n === 'script' || n === 'image' || n === 'text') return;
    const s = styl(w, rodzic);
    if (s.niewidoczny) return;
    const mw = zlozMacierze(m, parsujTransformacje(w.atr.transform));
    if (GRUPY.has(n) || n === 'symbol') {
      for (const d of w.dzieci) przejdz(d, mw, s, uzywane);
      return;
    }
    if (n === 'use') {
      const ref = (w.atr.href ?? w.atr['xlink:href'] ?? '').trim();
      if (!ref.startsWith('#')) return; // zewnętrzne – zgłoszone w audycie
      if (++uzyciaUse > LIMITY_SVG.uzycia)
        throw new BladImportuSvg(
          'za-duzo-ksztaltow',
          `Więcej niż ${LIMITY_SVG.uzycia} użyć <use>.`,
        );
      const id = ref.slice(1);
      const cel = poId.get(id);
      if (!cel || uzywane.includes(id)) return; // brak celu albo pętla
      const mu = zlozMacierze(mw, [1, 0, 0, 1, liczba(w.atr.x), liczba(w.atr.y)]);
      przejdz(cel, mu, s, [...uzywane, id]);
      return;
    }
    if (KSZTALTY.has(n)) {
      const a = w.atr;
      switch (n) {
        case 'path':
          dodaj(a.d ?? '', mw, s);
          break;
        case 'rect': {
          const sz = liczba(a.width);
          const wy = liczba(a.height);
          if (!(sz > 0 && wy > 0)) break;
          let rx = liczba(a.rx, -1);
          let ry = liczba(a.ry, -1);
          if (rx < 0 && ry < 0) rx = ry = 0;
          else if (rx < 0) rx = ry;
          else if (ry < 0) ry = rx;
          rx = Math.min(rx, sz / 2);
          ry = Math.min(ry, wy / 2);
          dodaj(sciezkaProstokata(liczba(a.x), liczba(a.y), sz, wy, rx, ry), mw, s);
          break;
        }
        case 'circle': {
          const r = liczba(a.r);
          if (r > 0) dodaj(sciezkaElipsy(liczba(a.cx), liczba(a.cy), r, r), mw, s);
          break;
        }
        case 'ellipse': {
          const rx = liczba(a.rx);
          const ry = liczba(a.ry);
          if (rx > 0 && ry > 0) dodaj(sciezkaElipsy(liczba(a.cx), liczba(a.cy), rx, ry), mw, s);
          break;
        }
        case 'line':
          dodaj(
            `M${f(liczba(a.x1))} ${f(liczba(a.y1))}L${f(liczba(a.x2))} ${f(liczba(a.y2))}`,
            mw,
            { ...s, fill: 'none' },
          );
          break;
        default: {
          const p = (a.points ?? '')
            .trim()
            .split(/[\s,]+/)
            .map(Number)
            .filter((v) => Number.isFinite(v));
          if (p.length < 4) break;
          let d = `M${f(p[0]!)} ${f(p[1]!)}`;
          for (let i = 2; i + 1 < p.length; i += 2) d += `L${f(p[i]!)} ${f(p[i + 1]!)}`;
          dodaj(n === 'polygon' ? d + 'Z' : d, mw, s);
        }
      }
      return;
    }
    if (CICHE.has(n) || ANIMACJE.has(n)) return;
    if (
      [
        'filter',
        'mask',
        'clipPath',
        'pattern',
        'marker',
        'style',
        'font',
        'cursor',
        'tspan',
        'textPath',
      ].includes(n) ||
      n.startsWith('fe')
    )
      return; // zgłoszone w audycie albo bez wpływu na rysunek
    zglos('nieznany-element', n);
  };

  przejdz(korzen, TOZSAMOSC, STYL_DOMYSLNY, []);

  if (surowe.length === 0)
    throw new BladImportuSvg('pusty', 'W pliku nie ma kształtów, które da się zaimportować.');

  // Obwiednia geometrii (punkty kontrolne) – gdy plik nie podaje wymiarów.
  if (!widok) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const s of surowe)
      for (const k of s.kontur)
        for (let i = 1; i + 1 < k.length; i += 2) {
          x0 = Math.min(x0, k[i] as number);
          x1 = Math.max(x1, k[i] as number);
          y0 = Math.min(y0, k[i + 1] as number);
          y1 = Math.max(y1, k[i + 1] as number);
        }
    widok = { x: x0, y: y0, szer: x1 - x0, wys: y1 - y0 };
  }
  if (!(widok.szer > 0 && widok.wys > 0 && Number.isFinite(widok.szer + widok.wys)))
    throw new BladImportuSvg('wymiary', 'Rysunek ma zerowy lub nieskończony rozmiar.');

  const sk = WYSOKOSC_IMPORTU / widok.wys;
  const zaokr = (v: number) => Math.round(v * 1e4) / 1e4;
  const kolory = new Set<string>();
  let komendy = 0;
  const kontury: KonturSymbolu[] = surowe.map((s) => {
    const kontur = s.kontur.map((k): KomendaKonturu => {
      komendy++;
      if (k[0] === 'Z') return ['Z'];
      const w = k.slice(1) as number[];
      const nowe = w.map((v, i) => zaokr(i % 2 === 0 ? (v - widok.x) * sk : (v - widok.y) * sk));
      return [k[0], ...nowe] as unknown as KomendaKonturu;
    });
    if (s.wypelnienie) kolory.add(s.wypelnienie);
    if (s.obrys) kolory.add(s.obrys.kolor);
    return {
      kontur,
      ...(s.wypelnienie ? { wypelnienie: s.wypelnienie } : {}),
      ...(s.obrys ? { obrys: { grubosc: zaokr(s.obrys.grubosc * sk), kolor: s.obrys.kolor } } : {}),
      ...(s.evenodd ? { evenodd: true } : {}),
    };
  });
  if (komendy > LIMITY_SVG.komendy)
    throw new BladImportuSvg('za-duzo-komend', `Więcej niż ${LIMITY_SVG.komendy} komend.`);

  return {
    element: {
      rodzaj: opcje.rodzaj ?? 'naroznik',
      szer: zaokr(widok.szer * sk),
      wys: WYSOKOSC_IMPORTU,
      kontury,
      kolorowanie: opcje.kolorowanie ?? (kolory.size <= 1 ? 'jednolity' : 'oryginal'),
    },
    raport: [...raport.values()],
    liczbaSciezek: surowe.length,
    liczbaKolorow: kolory.size,
    liczbaKomend: komendy,
  };
}
