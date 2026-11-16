/**
 * Teksty interfejsu w języku polskim. To jest słownik wzorcowy – inne języki
 * muszą mieć dokładnie te same klucze (sprawdza to typ `Slownik`).
 * Parametry w tekstach zapisujemy jako `{nazwa}`.
 */
export const pl = {
  'aplikacja.nazwa': 'Karty RPG',
  'dane.nieArchiwum': 'To nie jest poprawny plik .kartyrpg (nie da się go rozpakować).',
  'dane.brakProjektu': 'W pliku brakuje pliku „{plik}”.',
  'dane.zlyJson': 'Plik „{plik}” jest uszkodzony (niepoprawny JSON).',
  'dane.nowszaWersja':
    'Plik został zapisany w nowszej wersji aplikacji (schemat {wersja}). Zaktualizuj aplikację.',
  'dane.brakWersji': 'Plik nie ma numeru wersji schematu.',
  'dane.brakMigracji': 'Brak migracji danych ze schematu {wersja} – plik jest nieobsługiwany.',
  'dane.zod.typ': 'zły typ wartości (oczekiwano: {oczekiwano})',
  'dane.zod.zaMalo': 'wartość za mała (najmniej {min})',
  'dane.zod.zaDuzo': 'wartość za duża (najwięcej {max})',
  'dane.zod.wartosc': 'niedozwolona wartość (dozwolone: {dozwolone})',
  'dane.zod.format': 'niepoprawny format',
  'dane.zod.wariant': 'wartość nie pasuje do żadnego z dozwolonych rodzajów',
  'dane.zod.inne': 'niepoprawna wartość',
  'dane.gdzie.zasoby': 'zasoby',
  'dane.gdzie.szablony': 'szablony',
  'dane.gdzie.talie': 'talie',
  'dane.gdzie.arkusze': 'arkusze',
  'dane.gdzie.szablon': 'szablon {id}',
  'dane.gdzie.talia': 'talia {id}',
  'dane.gdzie.karta': 'karta {id}',
  'dane.nieznanaKartaPrzypieta': 'arkusz „{arkusz}” przypina nieznaną kartę „{karta}”',
  'dane.powtorzonaCzcionka':
    'W bibliotece są dwie czcionki „{rodzina}” ({wariant}) – używana będzie ostatnia.',
  'dane.konfliktRoli':
    'Rola „{rola}” w projekcie używa „{projekt}”, a szablon był zaprojektowany z „{szablon}”.',
  'dane.zbytWieleWpisow': 'Plik zawiera zbyt wiele wpisów ({liczba}).',
  'dane.zaDuzeArchiwum': 'Rozpakowana zawartość pliku jest zbyt duża ({mb} MB).',
  'dane.zlyZasobCzcionki': 'Czcionka „{id}” w pliku jest uszkodzona: {powod}',
  'dane.zlyZasobObrazu': 'Obraz „{id}” w pliku nie jest obrazem PNG ani JPG.',
  'dane.uszkodzonaCzcionka':
    'Nie udało się wczytać czcionki „{id}” – użyta będzie czcionka zapasowa.',
  'dane.niepoprawnaStruktura': 'Niepoprawne dane w pliku – {sciezka}: {komunikat}',
  'dane.brakZasobu': 'W pliku brakuje zasobu „{id}”.',
  'dane.nadmiarowyPlik': 'Plik zawiera nieoczekiwany wpis „{plik}”.',
  'dane.zaDuzy': 'Plik „{plik}” jest zbyt duży ({mb} MB).',
  'dane.zlaSpojnosc': 'Niespójne dane: {opis}',
  'dane.powtorzonyId': 'powtórzony identyfikator „{id}” ({gdzie})',
  'dane.nieznanySzablon': 'karta „{karta}” używa nieznanego szablonu „{szablon}”',
  'dane.nieznanaTalia': 'arkusz „{arkusz}” używa nieznanej talii „{talia}”',
  'dane.nieznanaKartaWGrupie': 'grupa „{grupa}” wskazuje nieznaną kartę „{karta}”',
  'dane.nieznanyZasob': '„{gdzie}” wskazuje nieznany zasób „{id}”',
  'dane.nieznanaRodzina': 'rola „{rola}” wskazuje rodzinę „{rodzina}”, której nie ma w bibliotece',
  'dane.zlyFormatCzcionki':
    'Nieobsługiwany format czcionki „{plik}” (dozwolone: TTF, OTF, WOFF, WOFF2).',
  'dane.nieczytelnaCzcionka':
    'Nie udało się wczytać czcionki „{plik}” – plik jest uszkodzony albo to nie czcionka.',
  'dane.czcionkaKolekcja': 'Plik „{plik}” jest kolekcją czcionek – wybierz pojedynczą czcionkę.',
  'dane.brakProjektuWBazie': 'Nie ma projektu „{id}” w pamięci przeglądarki.',
  'dane.kolizjaZasobu':
    'Zasób „{id}” już istnieje w projekcie i ma inną zawartość – zmień jego nazwę przed importem.',
  'dane.brakSzablonu': 'W projekcie nie ma szablonu „{id}”.',
  'dane.licencjaCzcionki':
    'Czcionka „{rodzina}” pochodzi z własnego pliku – sprawdź, czy jej licencja pozwala na udostępnianie.',
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
