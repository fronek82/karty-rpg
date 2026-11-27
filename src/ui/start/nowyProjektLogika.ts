/**
 * Czysta logika okna „Nowy projekt” (UI2 R3): formaty, orientacja Pionowo/Poziomo (D4),
 * niezależny wybór stron z walidacją „co najmniej jedna strona” (D5) oraz podpowiedzi dolne (D6).
 */

export type TrybStartu = 'pusta' | 'szablon' | 'import';
export type OrientacjaKarty = 'pion' | 'poziom';
export type IdFormatuKarty = 'poker' | 'mini-euro' | 'mini-us' | 'tarot' | 'kwadrat' | 'wlasny';

export interface FormatKartyDef {
  id: IdFormatuKarty;
  szer: number;
  wys: number;
  /** Wymiary ikonki zarysu w px (dla pionu). */
  ikonaSzer: number;
  ikonaWys: number;
}

export const FORMATY_NOWEGO_PROJEKTU: readonly FormatKartyDef[] = [
  { id: 'poker', szer: 63, wys: 88, ikonaSzer: 24, ikonaWys: 34 },
  { id: 'mini-euro', szer: 44, wys: 67, ikonaSzer: 17, ikonaWys: 26 },
  { id: 'mini-us', szer: 41, wys: 63, ikonaSzer: 16, ikonaWys: 25 },
  { id: 'tarot', szer: 70, wys: 120, ikonaSzer: 20, ikonaWys: 34 },
  { id: 'kwadrat', szer: 70, wys: 70, ikonaSzer: 26, ikonaWys: 26 },
  { id: 'wlasny', szer: 63, wys: 88, ikonaSzer: 22, ikonaWys: 30 },
];

export const MIN_WYMIAR_MM = 15;
export const MAKS_WYMIAR_MM = 300;

/** Zwraca wymiary po zastosowaniu orientacji Pionowo/Poziomo (D4). */
export function wymiaryDlaOrientacji(
  szer: number,
  wys: number,
  orientacja: OrientacjaKarty,
): { szer: number; wys: number } {
  const mniejszy = Math.min(szer, wys);
  const wiekszy = Math.max(szer, wys);
  return orientacja === 'poziom'
    ? { szer: wiekszy, wys: mniejszy }
    : { szer: mniejszy, wys: wiekszy };
}

/** Wymiary ikonki zarysu formatu po obróceniu do wybranej orientacji. */
export function ikonaDlaOrientacji(
  f: FormatKartyDef,
  orientacja: OrientacjaKarty,
): { szer: number; wys: number } {
  return orientacja === 'poziom'
    ? { szer: f.ikonaWys, wys: f.ikonaSzer }
    : { szer: f.ikonaSzer, wys: f.ikonaWys };
}

export interface WyborStron {
  przod: boolean;
  tyl: boolean;
}

/**
 * Przełącza wybraną stronę (przód lub tył), pilnując zasady D5:
 * co najmniej jedna strona musi pozostać zaznaczona (można zrobić sam tył).
 */
export function przelaczStrone(stan: WyborStron, strona: 'przod' | 'tyl'): WyborStron {
  if (strona === 'przod') {
    if (stan.przod && !stan.tyl) return stan;
    return { ...stan, przod: !stan.przod };
  }
  if (stan.tyl && !stan.przod) return stan;
  return { ...stan, tyl: !stan.tyl };
}

/** Sprawdza, czy podane wymiary (mm) są poprawne. */
export function czyPoprawneWymiary(szer: number, wys: number): boolean {
  return (
    Number.isFinite(szer) &&
    Number.isFinite(wys) &&
    szer >= MIN_WYMIAR_MM &&
    szer <= MAKS_WYMIAR_MM &&
    wys >= MIN_WYMIAR_MM &&
    wys <= MAKS_WYMIAR_MM
  );
}

/** Sprawdza, czy przycisk „Utwórz projekt” może być aktywny. */
export function czyMoznaUtworzyc(stan: {
  tryb: TrybStartu;
  strony: WyborStron;
  szer: number;
  wys: number;
  wybranySzablon?: string;
  maPlik: boolean;
}): boolean {
  if (stan.tryb === 'pusta') {
    return (stan.strony.przod || stan.strony.tyl) && czyPoprawneWymiary(stan.szer, stan.wys);
  }
  if (stan.tryb === 'szablon') return Boolean(stan.wybranySzablon);
  return stan.maPlik;
}

/** Zwraca klucz i18n podpowiedzi na dole okna „Nowy projekt” (co się otworzy). */
export function kluczPodpowiedziDolnej(
  tryb: TrybStartu,
  strony: WyborStron,
):
  | 'nowyProjekt.podpowiedz.przod'
  | 'nowyProjekt.podpowiedz.tyl'
  | 'nowyProjekt.podpowiedz.obie'
  | 'nowyProjekt.podpowiedz.szablon'
  | 'nowyProjekt.podpowiedz.import' {
  if (tryb === 'szablon') return 'nowyProjekt.podpowiedz.szablon';
  if (tryb === 'import') return 'nowyProjekt.podpowiedz.import';
  if (strony.przod && strony.tyl) return 'nowyProjekt.podpowiedz.obie';
  return strony.przod ? 'nowyProjekt.podpowiedz.przod' : 'nowyProjekt.podpowiedz.tyl';
}
