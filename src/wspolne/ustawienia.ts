/**
 * Ustawienia wspólne dla aplikacji i strony instrukcji (bez Reacta i bez słowników):
 * klucze localStorage oraz wybór języka domyślnego. Instrukcja importuje tylko ten plik,
 * dzięki czemu jej pakiet zostaje maleńki, a obie strony zawsze czytają te same klucze.
 */

/** Klucz wyboru motywu w localStorage: `light`, `dark` albo `system`. */
export const KLUCZ_MOTYWU = 'karty.motyw';

/** Klucz wyboru języka w localStorage: `pl` albo `en`. */
export const KLUCZ_JEZYKA = 'karty.jezyk';

/** Język domyślny z ustawień przeglądarki: polski dla „pl”, „pl-PL”…, w pozostałych przypadkach angielski. */
export function jezykDomyslny(jezykPrzegladarki: string | undefined): 'pl' | 'en' {
  return /^pl(?:[-_]|$)/i.test(jezykPrzegladarki ?? '') ? 'pl' : 'en';
}

/** Klucz sposobu dopasowania zawartości karty przy zmianie rozmiaru: `skaluj` albo `zostaw`. */
export const KLUCZ_DOPASOWANIA_ZAWARTOSCI = 'karty.dopasowanieZawartosci';

/** Klucz opcji importu CSV/XLSX „Wyczyść tekst skopiowany z PDF”: `1` (włączona) albo brak. */
export const KLUCZ_IMPORTU_Z_PDF = 'karty.importTekstZPdf';

/** Klucz powiększenia kartek w Edytorze kart (liczba, 1 = szerokość kolumny). */
export const KLUCZ_POWIEKSZENIA_KARTKI = 'karty.powiekszenieKartki';
