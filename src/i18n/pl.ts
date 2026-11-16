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
  'nawigacja.arkusze': 'Arkusze do druku',
  'start.arkusze': 'Zobacz arkusze Mausrittera i pobierz PDF do druku',
  'arkusze.tytul': 'Arkusze do druku',
  'arkusze.opis':
    'Arkusze z pakietu „{pakiet}”. Drukuj w skali 100% (bez „dopasuj do strony”) – wtedy karty pasują do slotów na karcie postaci.',
  'arkusze.wybor': 'Arkusz:',
  'arkusze.podglad': 'Podgląd',
  'arkusze.skalaDopasuj': 'dopasuj do szerokości',
  'arkusze.skalaRzeczywista': 'rozmiar rzeczywisty (1:1)',
  'arkusze.uwagaSkali':
    'Rozmiar rzeczywisty zależy od ustawień ekranu – do sprawdzenia wymiarów użyj wydruku.',
  'arkusze.pobierzPdf': 'Pobierz PDF',
  'arkusze.pobierzWszystkie': 'Pobierz wszystkie arkusze (PDF)',
  'arkusze.generowanie': 'Tworzę PDF…',
  'arkusze.wczytywanie': 'Wczytuję czcionki i obrazy…',
  'arkusze.bladWczytywania': 'Nie udało się wczytać czcionek lub obrazów pakietu.',
  'arkusze.bladUkladu': 'Nie udało się ułożyć arkusza.',
  'arkusze.bladPdf': 'Nie udało się utworzyć pliku PDF.',
  'arkusze.szczegoly': 'Szczegóły',
  'arkusze.ponow': 'Spróbuj ponownie',
  'arkusze.pdfGotowy': 'PDF gotowy – sprawdź pobrane pliki.',
  'arkusze.brakArkuszy': 'Ten pakiet nie ma arkuszy do druku.',
  'aplikacja.wczytywanieStrony': 'Wczytuję stronę…',
  'aplikacja.blad': 'Nie udało się wyświetlić tej strony.',
  'aplikacja.przeladuj': 'Przeładuj aplikację',
  'arkusze.ostrzezenia': 'Ostrzeżenia ({liczba})',
  'arkusze.liczbaStron': 'Stron: {liczba}.',
  'arkusze.strona': 'Strona {numer}',
} as const;

export type KluczTekstu = keyof typeof pl;
export type Slownik = Record<KluczTekstu, string>;
