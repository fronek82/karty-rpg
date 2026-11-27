import type { LiniaPomocnicza } from '../../model/szablon';

/** Wystawanie linijki poza krawędź karty z każdej strony (mm). */
export const WYSTAWANIE_MM = 10;

/** Krok położenia linii pomocniczej przy przeciąganiu (mm). */
export const KROK_LINII_MM = 0.5;

/** Minimalny odstęp między sąsiednimi cyframi cm na linijce (px). */
export const MIN_ODSTEP_CYFR_PX = 18;

export interface KreskaLinijki {
  mm: number;
  rodzaj: 'mm' | 'polcm' | 'cm';
  /** Numer centymetra dla kresek co 10 mm (np. "0", "1", "-1"). */
  etykieta?: string;
}

export interface KreskaPikselowa extends KreskaLinijki {
  /** Pozycja w pikselach od początku widocznej linijki. */
  px: number;
}

/** Zaokrągla pozycję linii pomocniczej do kroku 0,5 mm. */
export function zaokraglijLinie(mm: number): number {
  return Math.round(mm / KROK_LINII_MM) * KROK_LINII_MM;
}

/** Jedna funkcja skali: przelicza pozycję w mm (względem rogu karty) na px w układzie linijki. */
export function mmNaPxLinijki(mm: number, poczatekPx: number, pxNaMmSkala: number): number {
  return poczatekPx + mm * pxNaMmSkala;
}

/** Odwrotność `mmNaPxLinijki`: przelicza px w układzie linijki na mm względem rogu karty. */
export function pxLinijkiNaMm(px: number, poczatekPx: number, pxNaMmSkala: number): number {
  if (pxNaMmSkala <= 0) return 0;
  return (px - poczatekPx) / pxNaMmSkala;
}

/** Krok etykiet w cm: gdy 1 cm < 18 px, pokazujemy co drugą (lub co 5.) cyfrę, żeby nigdy na siebie nie nachodziły. */
export function krokEtykietCm(pxNaMmSkala: number): number {
  const cmPx = pxNaMmSkala * 10;
  if (cmPx <= 0) return 1;
  if (cmPx < MIN_ODSTEP_CYFR_PX / 2) return 5;
  if (cmPx < MIN_ODSTEP_CYFR_PX) return 2;
  return 1;
}

/**
 * Wylicza widoczne kreski przypiętej linijki (od 0 do `dlugoscLinijkiPx`) w oparciu o `poczatekPx`
 * (pozycja zera karty w układzie linijki) i skalę `pxNaMmSkala`.
 */
export function kreskiPrzypietejLinijki(
  dlugoscLinijkiPx: number,
  poczatekPx: number,
  pxNaMmSkala: number,
): KreskaPikselowa[] {
  if (dlugoscLinijkiPx <= 0 || pxNaMmSkala <= 0) return [];
  const startMm = Math.floor(pxLinijkiNaMm(0, poczatekPx, pxNaMmSkala));
  const koniecMm = Math.ceil(pxLinijkiNaMm(dlugoscLinijkiPx, poczatekPx, pxNaMmSkala));
  const krokCm = krokEtykietCm(pxNaMmSkala);
  const rysujMm = pxNaMmSkala >= 2.2;
  const wynik: KreskaPikselowa[] = [];
  for (let mm = startMm; mm <= koniecMm; mm++) {
    const px = mmNaPxLinijki(mm, poczatekPx, pxNaMmSkala);
    if (px < -1 || px > dlugoscLinijkiPx + 1) continue;
    const abs = Math.abs(mm);
    if (abs % 10 === 0) {
      const cm = mm / 10;
      const pokazCyfre = Math.abs(cm) % krokCm === 0;
      wynik.push({
        mm,
        px,
        rodzaj: 'cm',
        ...(pokazCyfre ? { etykieta: String(cm) } : {}),
      });
    } else if (abs % 5 === 0) {
      wynik.push({ mm, px, rodzaj: 'polcm' });
    } else if (rysujMm) {
      wynik.push({ mm, px, rodzaj: 'mm' });
    }
  }
  return wynik;
}

/**
 * Wylicza podziałkę linijki od `-wystawanieMm` do `dlugoscMm + wystawanieMm` co 1 mm.
 * Zero leży na lewej/górnej krawędzi karty; co 10 mm dodawany jest numer cm.
 */
export function kreskiLinijki(
  dlugoscMm: number,
  wystawanieMm: number = WYSTAWANIE_MM,
): KreskaLinijki[] {
  const start = Math.floor(-wystawanieMm);
  const koniec = Math.ceil(dlugoscMm + wystawanieMm);
  const wynik: KreskaLinijki[] = [];
  for (let mm = start; mm <= koniec; mm++) {
    const abs = Math.abs(mm);
    if (abs % 10 === 0) {
      wynik.push({ mm, rodzaj: 'cm', etykieta: String(mm / 10) });
    } else if (abs % 5 === 0) {
      wynik.push({ mm, rodzaj: 'polcm' });
    } else {
      wynik.push({ mm, rodzaj: 'mm' });
    }
  }
  return wynik;
}

/** Przelicza współrzędną w pikselach (względem lewego/górnego brzegu karty) na mm. */
export function pxNaMm(px: number, dlugoscPx: number, dlugoscMm: number): number {
  if (dlugoscPx <= 0) return 0;
  return (px / dlugoscPx) * dlugoscMm;
}

/** Przelicza pozycję w mm na procent długości pełnego zakresu linijki `[-wystawanie, dlugosc + wystawanie]`. */
export function mmNaProcentLinijki(
  mm: number,
  dlugoscMm: number,
  wystawanieMm: number = WYSTAWANIE_MM,
): number {
  const calosc = dlugoscMm + 2 * wystawanieMm;
  if (calosc <= 0) return 0;
  return ((mm + wystawanieMm) / calosc) * 100;
}

/** Tworzy nową linię pomocniczą z unikalnym identyfikatorem i pozycją zaokrągloną do 0,5 mm. */
export function nowaLiniaPomocnicza(
  istniejace: readonly LiniaPomocnicza[],
  os: 'h' | 'v',
  mm: number,
): LiniaPomocnicza {
  const uzyte = new Set(istniejace.map((l) => l.id));
  let n = istniejace.length + 1;
  while (uzyte.has(`lp-${n}`)) n++;
  return { id: `lp-${n}`, os, mm: zaokraglijLinie(mm) };
}

/**
 * Zwraca listę pozycji (w mm) linii pomocniczych danej osi – do przyciągania krawędzi
 * i środków przeciąganych pól swobodnych.
 */
export function pozycjeLiniiOsi(
  linie: readonly LiniaPomocnicza[] | undefined,
  os: 'h' | 'v',
): number[] {
  if (!linie?.length) return [];
  return linie.filter((l) => l.os === os).map((l) => l.mm);
}

/** Formatuje pozycję linii pomocniczej w mm (np. "12,5 mm" lub "12 mm"). */
export function formatujMmLinii(mm: number): string {
  const z = zaokraglijLinie(mm);
  const s = Number.isInteger(z) ? String(z) : z.toFixed(1).replace('.', ',');
  return `${s} mm`;
}
