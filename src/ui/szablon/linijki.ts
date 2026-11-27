import type { LiniaPomocnicza } from '../../model/szablon';

/** Wystawanie linijki poza krawędź karty z każdej strony (mm). */
export const WYSTAWANIE_MM = 10;

/** Krok położenia linii pomocniczej przy przeciąganiu (mm). */
export const KROK_LINII_MM = 0.5;

export interface KreskaLinijki {
  mm: number;
  rodzaj: 'mm' | 'polcm' | 'cm';
  /** Numer centymetra dla kresek co 10 mm (np. "0", "1", "-1"). */
  etykieta?: string;
}

/** Zaokrągla pozycję linii pomocniczej do kroku 0,5 mm. */
export function zaokraglijLinie(mm: number): number {
  return Math.round(mm / KROK_LINII_MM) * KROK_LINII_MM;
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
