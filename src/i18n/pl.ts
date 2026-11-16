/**
 * Teksty interfejsu w języku polskim. To jest słownik wzorcowy – inne języki
 * muszą mieć dokładnie te same klucze (sprawdza to typ `Slownik`).
 * Parametry w tekstach zapisujemy jako `{nazwa}`.
 */
export const pl = {
  'aplikacja.nazwa': 'Karty RPG',
  'aplikacja.opis':
    'Projektuj i drukuj karty do gier RPG i planszowych. Wszystko działa w przeglądarce, a dane zostają na Twoim komputerze.',
  'start.wersja': 'Wersja {wersja}',
  'start.wkrotce': 'Aplikacja jest w budowie – trwa kamień milowy M1 (Mausritter na A4).',
  'nawigacja.start': 'Start',
  'nawigacja.nieZnaleziono': 'Nie ma takiej strony.',
  'nawigacja.wrocNaStart': 'Wróć na stronę startową',
} as const;

export type KluczTekstu = keyof typeof pl;
export type Slownik = Record<KluczTekstu, string>;
