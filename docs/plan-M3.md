# Plan M3 – style i skład kart z danych

**Status.** M3 rozpoczęty 19.11.2026. Następny jest M3-1. Punktem wyjścia jest ukończenie wdrożenia M2c. [Ręczny odbiór M2c](plan-M2c.md#4-etapy) jest otwarty. Zakres wynika ze [SPEC, sekcje 4, 5, 9 i 12](../SPEC.md), [planu M2](plan-M2.md#6-później) i [planu M2b](plan-M2b.md#6-później).

## 1. Cel i kryterium ukończenia

- Tworzenie neutralnych kart z danymi, współdzielonymi stylami, ilustracjami i tekstem o różnej długości. Próbki sprawdzają wymagania dla kart statystyk i kart opisowych bez gotowców pod konkretne gry.
- Zestaw ozdobników da się zastosować jedną operacją i następnie edytować. Wygląd wynika z jednego modelu i jednej sceny dla podglądu, PDF i eksportu obrazów.
- Dane z CSV i XLSX można przypisać do pól istniejącego szablonu przed zatwierdzeniem importu. Kontynuacja opisu i rozmieszczenie arkusza dają powtarzalny wynik.
- Dotychczasowe projekty zachowują wygląd i działanie. Testy obejmują migrację każdego zmienionego schematu, pliki projektu i szablonu, zgodność dotychczasowych wzorców oraz obsługę po polsku i angielsku w obu motywach.

## 2. Stan przed M3

| Potrzeba                                                             | Stan | Uwagi                                                                                                            |
| -------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------- |
| Romb, zagnieżdżony nagłówek i tabela                                 | ✓    | Dostępne w modelu i edytorze po M2.                                                                              |
| Pogrubienie, kursywa, kapitaliki, wcięcie akapitu i justowanie       | ✓    | Dostępne w polach tekstowych.                                                                                    |
| Auto-dopasowanie, zwijanie pustych pól i ostrzeżenia o przepełnieniu | ✓    | Dostępne w składzie kart.                                                                                        |
| Ozdobniki i kopiowanie stylu                                         | ◐    | Są osobne rodzaje ozdób, biblioteki i schowek stylu. Brakuje zestawów oraz nazwanych grup współdzielonych.       |
| Tekstura i styl szkicowy                                             | ◐    | Można użyć obrazu i jednolitego tła. Brakuje ustawień tekstury tła, chropowatej kreski i postrzępionej krawędzi. |
| Położenie i pakowanie arkusza                                        | ◐    | Obrót swobodny obsługuje wielokrotności 90°. Jest dotychczasowe pakowanie mieszanych rozmiarów.                  |
| Skład na podstawie danych                                            | ◐    | Istnieją tabela danych i podgląd, brakuje map kolorów, kontynuacji, list numerowanych i ikon w tekście.          |
| Import CSV i XLSX                                                    | ✗    | Import projektu i szablonu nie zastępuje mapowania danych tabelarycznych.                                        |

## 3. Projekt rozwiązania

- **Zestawy ozdobników.** Zestaw przypisuje ramkę, narożnik i separator z wbudowanego katalogu. W edytorze szablonu użytkownik wybiera zestaw na karcie i stosuje go do ramki oraz istniejących pól separatora we wszystkich wariantach układu. Operacja zastępuje rodzaj i motyw ramki, narożnik oraz rysunek, kolor, linię, zakończenia i środek separatora. Zachowuje odsunięcie i promień ramki, drzewa, pozycje, wiązania danych oraz kierunek i długość separatorów. Brak separatora nie dodaje węzła. Użycie starego projektu odczytuje dotychczasowe pola. Wybór i cofnięcie są widoczne w podglądzie i przechodzą przez zwykłą historię edytora.
- **Grupy i kolory z danych.** Nazwane grupy należą do szablonu i korzystają ze stabilnych identyfikatorów. Zmiana grupy aktualizuje wszystkie powiązane pola. Usunięcie lub odłączenie grupy zachowuje efektywny styl pola. Reguły koloru karty, panelu i etykiety jawnie wskazują pole danych, mapę i domyślną wartość. Rozwiązanie grup i reguł następuje przed pomiarem sceny.
- **Skład i przepełnienie.** Lista zachowuje wcięcia po zawinięciu, ikony biorą kształt z katalogu aplikacji, a nieznane kody pozostają tekstem. Kontynuacja jest włączana w szablonie i następuje po wyczerpaniu auto-dopasowania. Kolejna karta powtarza nagłówek z lokalizowanym dopiskiem „ciąg dalszy”. Wydruk i eksport otrzymują tę samą kolejność wynikowych kart. Jeśli treść nie daje się podzielić lub nie ma miejsca na kolejny fragment, zachowujemy ostrzeżenie w tabeli danych.
- **Ozdoby i geometria.** Styl szkicowy i postrzępienie mają jawne, deterministyczne ziarno. Postrzępienie karty i panelu ma ustawienia siły i ziarnistości. Tekstury karty i panelu używają istniejących zasobów projektu, a tekstura karty obejmuje również spad w trybie druku, który go obsługuje. Łuk motywu i obrót swobodny korzystają ze wspólnej geometrii sceny i kontrolek. MaxRects jest drugą strategią mieszanego arkusza. Domyślne pozostaje pakowanie w pasy.
- **Dane tabelaryczne.** Przegląd nagłówków, mapowanie pól i kolumny „Ilość”, walidacja i podgląd przed zapisem. Obrazy przypisujemy po jednoznacznej nazwie istniejącego lokalnego zasobu. Puste wartości pól są dozwolone, w całości puste wiersze pomijamy. Błędy w mapowanych danych blokują cały import. Import dodaje karty jako jedną operację możliwą do cofnięcia. CSV oraz XLSX mają testy cudzysłowów, pustych komórek i błędnych ilości. W XLSX odczytujemy wartości, bez wykonywania formuł ani pobierania zewnętrznych danych.

## 4. Etapy

Jeden etap oznacza osobną gałąź z aktualnego `main` i osobny PR. Każdy PR przechodzi niezależny przegląd, pełne testy oraz zielone CI. Po scaleniu sprawdzamy wdrożenie na Pages.

| Etap | Status | Wielkość | Zakres z testami                                                                                                                                                                                                                     | Agenci                                                  |
| ---- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| M3-1 | ✗      | M        | Zestawy stylów. Vitest sprawdza zakres zmian i poprawność katalogu. Testy obejmują kartę bez separatora, warianty, zastąpienie 9-slice, eksport i import szablonu. E2e sprawdza zastosowanie, cofnięcie, ponowne otwarcie i podgląd. | biblioteka-ozdobnikow, edytor-ui, tester                |
| M3-2 | ✗      | L        | Nazwane grupy stylów i kolory z danych. Test migracji, importu szablonu, konfliktów, odłączania grupy, aktualizacji pól i koloru domyślnego.                                                                                         | silnik-layoutu, dane-import, edytor-ui, tester          |
| M3-3 | ✗      | M        | Listy numerowane i ikony w tekście. Testy łamania linii, indeksów, nieznanych kodów oraz PNG i PDF.                                                                                                                                  | silnik-layoutu, biblioteka-ozdobnikow, druk-pdf, tester |
| M3-4 | ✗      | L        | Kontynuacja długiego tekstu na kolejnej karcie. Test podziału, nagłówka, ilości, kolejności, braku postępu i wspólnego wyniku dla podglądu, obrazów i druku.                                                                         | silnik-layoutu, druk-pdf, edytor-ui, tester             |
| M3-5 | ✗      | L        | Styl szkicowy, postrzępione krawędzie, tekstura karty i panelu, motyw po łuku. Testy determinizmu, spadu, wycinków i zgodności SVG z PDF.                                                                                            | biblioteka-ozdobnikow, silnik-layoutu, druk-pdf, tester |
| M3-6 | ✗      | L        | Dowolny obrót swobodny i opcjonalne pakowanie MaxRects. Testy trafiania, przyciągania, wydruku, kolejności i wczytania obrotów ze starszych projektów.                                                                               | silnik-layoutu, druk-pdf, edytor-ui, tester             |
| M3-7 | ✗      | L        | Import CSV/XLSX z mapowaniem. Testy poprawnych i błędnych plików, mapowania i cofnięcia.                                                                                                                                             | dane-import, edytor-ui, tester                          |
| M3-8 | ✗      | S        | Domknięcie. README, zrzuty, kontrola regresji M2c oraz odbiór neutralnych scenariuszy w obu językach i motywach.                                                                                                                     | edytor-ui, tester, recenzent                            |

## 5. Zakres pierwszej wersji

- Zestawy wbudowane z istniejących ozdobników, nazwane grupy w obrębie szablonu i wybór kolorów według wartości danych.
- Skład zwykłych list i ikon oraz kontynuacja długiego pola z powtórzonym nagłówkiem. Edytowalne style kreski i krawędzi, tekstury, geometria i pakowanie określone w §4.
- Lokalny import plików tabelarycznych z kontrolą zawartości przed dodaniem kart. Dotychczasowe formaty plików i mechanizmy M2c zachowują działanie.

Scenariusze odbioru tworzymy w edytorze na neutralnych danych: grupa wartości w rombach ze szkicową kreską; panele w układzie 2×2 ze stopką, regułą koloru, listą i kontynuacją; tabelaryczna karta z kapitalikami, teksturą i postrzępioną krawędzią.

## 6. Później

M4 obejmuje między innymi rewersy i druk dwustronny zgodnie ze specyfikacją. Udostępnianie przez sieć oraz publiczna galeria pozostają w osobnym zakresie. Własne zapisywalne zestawy ozdobników wymagają osobnego rozszerzenia.

## 7. Decyzje

| #   | Sprawa         | Decyzja                                                                                                                         |
| --- | -------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Zgodność       | Nowe zachowanie uruchamia jawny wybór. Zmiany schematu mają migrację i test otwierania istniejących danych.                     |
| R2  | Zestawy stylów | Wbudowany zestaw stosujemy jedną akcją i zapisujemy jako zwykłe edytowalne style.                                               |
| R3  | Spójność sceny | Podgląd, PDF i eksport obrazów korzystają z tego samego składu i geometrii.                                                     |
| R4  | Testy i język  | Funkcje mają teksty PL i EN. Testy wyglądu i przykłady używają neutralnych danych.                                              |
| R5  | M2c            | Biblioteki, paczki, wymiary i eksport M2c mają zachować zachowanie. Wymaganą zmianę trzeba opisać w PR i objąć testem regresji. |

## 8. Ryzyka

- Zmiana pomiaru i geometrii może wpłynąć na istniejące PNG. Domyślne ścieżki pozostają identyczne, a nowe scenariusze mają własne porównania.
- Podział tekstu może zapętlić się na polu mieszczącym zbyt mało tekstu. Każda kolejna karta zużywa część wejścia, a brak postępu kończy się ostrzeżeniem.
- Import może dostać duże lub częściowo niepoprawne pliki. Parsowanie ma limity, a zapis następuje dopiero po podglądzie i potwierdzeniu.
- Nowy sposób pakowania może zmienić położenie kart lub naruszyć przypięcia. Dotychczasowa strategia pozostaje domyślna. Tryb slotów nadal zachowuje przypięcia, a pakowanie mieszane korzysta z ręcznej kolejności zapisanej dla arkusza.

## 9. Decyzje podjęte bez konsultacji

| #    | Etap | Sprawa        | Decyzja                                                                                                                                               |
| ---- | ---- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| B230 | Plan | Kolejność     | M3 zaczynamy od zestawów stylów przewidzianych w planie M2b. Grupowanie, skład i zmiany geometrii są osobnymi etapami.                                |
| B231 | Plan | Zapis zestawu | Użycie zestawu kopiuje ustawienia z wbudowanego katalogu bez referencji do zestawu w schemacie projektu. Brak separatora pozostawia drzewo bez zmian. |
| B232 | Plan | Import danych | Mapowanie i walidację pokazujemy przed zapisem. Błąd mapowanego wiersza blokuje zapis całej partii.                                                   |
