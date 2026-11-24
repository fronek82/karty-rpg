import type { Mm } from '../model/jednostki';
import type { Kolor } from '../model/szablon';

/**
 * Scena – wspólne źródło dla podglądu (SVG) i wydruku (PDF). Wszystkie współrzędne w mm,
 * oś Y w dół, początek w lewym górnym rogu. Serializatory tylko ją przepisują.
 */

/** Kontur glifu w jednostkach czcionki (oś Y w górę) – tylko M, L, C, Z. */
export type KomendaKonturu =
  | ['M', number, number]
  | ['L', number, number]
  | ['C', number, number, number, number, number, number]
  | ['Z'];
export type Kontur = KomendaKonturu[];

export interface Obrys {
  kolor: Kolor;
  grubosc: Mm;
  /** Wzór kreski (mm): długość kreski, przerwa, … */
  kreska?: Mm[];
  /** Przesunięcie wzoru kreski (mm) – początek wzoru przypada w −faza. */
  fazaKreski?: Mm;
}

export interface GlifNaScenie {
  /** Klucz w słowniku glifów sceny. */
  klucz: string;
  /** Położenie początku glifu na linii bazowej (mm). */
  x: Mm;
  y: Mm;
  /** mm na jednostkę czcionki (rozmiar / unitsPerEm). */
  skala: number;
  /** Obrót glifu wokół (x, y) w stopniach, zgodnie z ruchem wskazówek zegara (np. tekst po łuku). */
  obrot?: number;
}

/** Macierz afiniczna jak w SVG `matrix(a b c d e f)` i PDF `cm`: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Macierz = [number, number, number, number, number, number];

/** Kolor rysunku symbolu: stały albo `'kolor'` – podstawiany z miejsca wstawienia. */
export type KolorSymbolu = Kolor | 'kolor';

export interface KonturSymbolu {
  kontur: Kontur;
  wypelnienie?: KolorSymbolu;
  /** Grubość w jednostkach symbolu (skaluje się razem z nim). */
  obrys?: { grubosc: number; kolor: KolorSymbolu };
  /** Wypełnienie parzysto-nieparzyste (SVG `fill-rule="evenodd"`, PDF `f*`) – dziury we własnych SVG. */
  evenodd?: boolean;
}

/** Rysunek wstawiany wielokrotnie (`typ: 'symbol'`); współrzędne w jednostkach `szer` × `wys`, oś Y w dół. */
export interface DefinicjaSymbolu {
  kontury: KonturSymbolu[];
  szer: number;
  wys: number;
}

/** Metadane wiersza tekstu (mm) – używane wyłącznie przez opcjonalną niewidoczną warstwę tekstową PDF (`3 Tr`). */
export interface WierszTekstuSceny {
  tekst: string;
  /** Początek wiersza na linii bazowej (mm). */
  x: Mm;
  y: Mm;
  /** Szerokość ułożonego wiersza (mm) – do dopasowania skali poziomej zaznaczenia w PDF. */
  szer: Mm;
  /** Rozmiar pisma w mm. */
  rozmiar: Mm;
}

export type ElementSceny =
  | {
      typ: 'prostokat';
      x: Mm;
      y: Mm;
      szer: Mm;
      wys: Mm;
      promien?: Mm;
      wypelnienie?: Kolor;
      obrys?: Obrys;
    }
  | { typ: 'linia'; x1: Mm; y1: Mm; x2: Mm; y2: Mm; obrys: Obrys }
  | { typ: 'okrag'; cx: Mm; cy: Mm; r: Mm; wypelnienie?: Kolor; obrys?: Obrys }
  /** Ścieżka w mm (oś Y w dół). */
  | { typ: 'sciezka'; kontur: Kontur; wypelnienie?: Kolor; obrys?: Obrys; evenodd?: boolean }
  | {
      typ: 'tekst';
      kolor: Kolor;
      glify: GlifNaScenie[];
      /** Obwódka liter rysowana pod wypełnieniem (grubość całej linii, mm). */
      obwodka?: { kolor: Kolor; grubosc: Mm };
      /** Opcjonalne wiersze tekstu dla niewidocznej warstwy wyszukiwania w PDF (ignorowane przez SVG). */
      wierszeTekst?: WierszTekstuSceny[];
    }
  | {
      typ: 'obraz';
      zasob: string;
      x: Mm;
      y: Mm;
      szer: Mm;
      wys: Mm;
      /** Obszar przycięcia (mm, w układzie sceny – nie obraca się z obrazem). */
      przyciecie?: { x: Mm; y: Mm; szer: Mm; wys: Mm };
      /** Obrót wokół środka obrazu (stopnie, zgodnie z ruchem wskazówek zegara). */
      obrot?: number;
    }
  | {
      typ: 'symbol';
      /** Klucz w słowniku symboli sceny. */
      klucz: string;
      /** Przekształcenie symbolu w układzie, w którym stoi element (skala, odbicie, obrót, przesunięcie). */
      macierz: Macierz;
      /** Podstawiany za kolor `'kolor'` w rysunku; domyślnie czarny. */
      kolor?: Kolor;
    }
  | {
      typ: 'grupa';
      /**
       * Przekształcenie elementów: najpierw `macierz` (jeśli jest), potem obrót (stopnie, zgodnie
       * z ruchem wskazówek zegara), na końcu przesunięcie o (x, y) – bez `macierz` jak dotychczas.
       */
      x: Mm;
      y: Mm;
      obrot?: number;
      macierz?: Macierz;
      /** Przycięcie (mm) w układzie otaczającym grupę – nie podlega jej przekształceniu. */
      przyciecie?: { x: Mm; y: Mm; szer: Mm; wys: Mm };
      przyciecieKonturem?: Kontur;
      /** Krycie grupy 0–1 (domyślnie 1); izolowana grupa przezroczystości (SVG opacity, PDF Transparency Group). */
      krycie?: number;
      elementy: ElementSceny[];
    }
  | {
      /**
       * Wzór kafelkowy wypełniający prostokąt `obszar` (mm, układ sceny). Rysunek jednego okresu
       * (`elementy`, układ wzoru) powtarza się co `szer` × `wys`; `macierz` przenosi układ wzoru
       * do układu sceny (początek, obrót). Rysunek może wystawać poza kafelek o mniej niż okres –
       * każda kopia jest rysowana w całości. SVG: `<pattern patternUnits="userSpaceOnUse">`,
       * PDF: kopie wektorowe (`rozwinWzor`).
       */
      typ: 'wzor';
      obszar: { x: Mm; y: Mm; szer: Mm; wys: Mm };
      szer: Mm;
      wys: Mm;
      macierz: Macierz;
      elementy: ElementSceny[];
    };

export interface DefinicjaGlifu {
  kontur: Kontur;
}

export interface Scena {
  szer: Mm;
  wys: Mm;
  elementy: ElementSceny[];
  /** Kontury wszystkich glifów użytych w scenie – każdy zapisany raz. */
  glify: Record<string, DefinicjaGlifu>;
  /** Rysunki użyte w scenie przez `symbol` – każdy zapisany raz (SVG `<use>`, PDF XObject). */
  symbole?: Record<string, DefinicjaSymbolu>;
}

/** Łączy słowniki symboli (np. kart na arkuszu). Ten sam klucz = ten sam rysunek. */
export function polaczSymbole(
  ...slowniki: (Record<string, DefinicjaSymbolu> | undefined)[]
): Record<string, DefinicjaSymbolu> {
  const wynik: Record<string, DefinicjaSymbolu> = {};
  for (const s of slowniki) if (s) Object.assign(wynik, s);
  return wynik;
}

/** Kolor symbolu: stały zapis albo kolor wstawienia (domyślnie czarny). */
export function kolorSymbolu(k: KolorSymbolu, kolorWstawienia: Kolor | undefined): string {
  return k === 'kolor' ? kolorSceny(kolorWstawienia) : kolorSceny(k);
}

/** Łączy słowniki glifów (np. kart na arkuszu). Ten sam klucz = ten sam glif. */
export function polaczGlify(
  ...slowniki: Record<string, DefinicjaGlifu>[]
): Record<string, DefinicjaGlifu> {
  const wynik: Record<string, DefinicjaGlifu> = {};
  for (const s of slowniki) Object.assign(wynik, s);
  return wynik;
}

/**
 * Kolor w postaci `#rrggbb` (małe litery). Przyjmuje też `#rgb`. Każdy inny zapis daje czarny –
 * tak samo w SVG i PDF, żeby podgląd i wydruk się nie rozjechały (i żeby nic obcego nie trafiło do SVG).
 */
export function kolorSceny(k: string | undefined): string {
  if (!k) return '#000000';
  const s = k.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  const m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(s);
  return m ? `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}` : '#000000';
}

/** Obrys rysowany tylko przy dodatniej grubości (SVG i PDF zachowują się wtedy tak samo). */
export function czyObrys(o: Obrys | undefined): o is Obrys {
  return o !== undefined && o.grubosc > 0;
}

/** Fragment sceny ze słownikiem symboli – pusty, gdy żadnego nie użyto (scena bez ozdobników bez zmian). */
export function symboleSceny(...slowniki: (Record<string, DefinicjaSymbolu> | undefined)[]): {
  symbole?: Record<string, DefinicjaSymbolu>;
} {
  const symbole = polaczSymbole(...slowniki);
  return Object.keys(symbole).length > 0 ? { symbole } : {};
}

/** Najwięcej kopii kafelka po rozwinięciu wzoru (zabezpieczenie rozmiaru PDF). */
export const MAX_KOPII_WZORU = 60000;

/**
 * Wzór kafelkowy jako zwykła grupa kopii (przycięta do obszaru) – dla wyjść bez wzorów
 * (PDF). Kopie obejmują obszar także po obrocie i jeden kafelek zapasu (rysunek wystający).
 */
export function rozwinWzor(e: Extract<ElementSceny, { typ: 'wzor' }>): ElementSceny {
  const [a, b, c, d, tx, ty] = e.macierz;
  const wyz = a * d - b * c;
  const pusty: ElementSceny = { typ: 'grupa', x: 0, y: 0, elementy: [] };
  if (!(e.szer > 0 && e.wys > 0) || !wyz || !e.elementy.length) return pusty;
  // Odwrotność macierzy: narożniki obszaru w układzie wzoru.
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  const o = e.obszar;
  for (const [x, y] of [
    [o.x, o.y],
    [o.x + o.szer, o.y],
    [o.x, o.y + o.wys],
    [o.x + o.szer, o.y + o.wys],
  ] as const) {
    const dx = x - tx;
    const dy = y - ty;
    const u = (d * dx - c * dy) / wyz;
    const v = (-b * dx + a * dy) / wyz;
    u0 = Math.min(u0, u);
    u1 = Math.max(u1, u);
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
  }
  const i0 = Math.floor(u0 / e.szer) - 1;
  const i1 = Math.ceil(u1 / e.szer);
  const j0 = Math.floor(v0 / e.wys) - 1;
  const j1 = Math.ceil(v1 / e.wys);
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > MAX_KOPII_WZORU) return pusty;
  const kopie: ElementSceny[] = [];
  for (let j = j0; j <= j1; j++)
    for (let i = i0; i <= i1; i++)
      kopie.push({ typ: 'grupa', x: i * e.szer, y: j * e.wys, elementy: e.elementy });
  return {
    typ: 'grupa',
    x: 0,
    y: 0,
    przyciecie: { ...o },
    elementy: [{ typ: 'grupa', x: 0, y: 0, macierz: e.macierz, elementy: kopie }],
  };
}
