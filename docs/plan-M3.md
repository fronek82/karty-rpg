# Plan M3 – style i skład kart z danych

**Status.** M3 rozpoczęty 19.11.2026. M3-1 ukończono 19.11.2026. M3-2 ukończono 19.11.2026. M3-3 ukończono 19.11.2026. M3-4 ukończono 19.11.2026. M3-5 ukończono 19.11.2026. M3-6 ukończono 19.11.2026. M3-7 ukończono 19.11.2026. Następny jest M3-8. Punktem wyjścia jest ukończenie wdrożenia M2c. [Ręczny odbiór M2c](plan-M2c.md#4-etapy) jest otwarty. Zakres wynika ze [SPEC, sekcje 4, 5, 9 i 12](../SPEC.md), [planu M2](plan-M2.md#6-później) i [planu M2b](plan-M2b.md#6-później).

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

| Etap | Status       | Wielkość | Zakres z testami                                                                                                                                                                                                                     | Agenci                                                  |
| ---- | ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| M3-1 | ✓ 19.11.2026 | M        | Zestawy stylów. Vitest sprawdza zakres zmian i poprawność katalogu. Testy obejmują kartę bez separatora, warianty, zastąpienie 9-slice, eksport i import szablonu. E2e sprawdza zastosowanie, cofnięcie, ponowne otwarcie i podgląd. | biblioteka-ozdobnikow, edytor-ui, tester                |
| M3-2 | ✓ 19.11.2026 | L        | Nazwane grupy stylów i kolory z danych. Test migracji, importu szablonu, konfliktów, odłączania grupy, aktualizacji pól i koloru domyślnego.                                                                                         | silnik-layoutu, dane-import, edytor-ui, tester          |
| M3-3 | ✓ 19.11.2026 | M        | Listy numerowane i ikony w tekście. Testy łamania linii, indeksów, nieznanych kodów oraz PNG i PDF.                                                                                                                                  | silnik-layoutu, biblioteka-ozdobnikow, druk-pdf, tester |
| M3-4 | ✓ 19.11.2026 | L        | Kontynuacja długiego tekstu na kolejnej karcie. Test podziału, nagłówka, ilości, kolejności, braku postępu i wspólnego wyniku dla podglądu, obrazów i druku.                                                                         | silnik-layoutu, druk-pdf, edytor-ui, tester             |
| M3-5 | ✓ 19.11.2026 | L        | Styl szkicowy, postrzępione krawędzie, tekstura karty i panelu, motyw po łuku. Testy determinizmu, spadu, wycinków i zgodności SVG z PDF.                                                                                            | biblioteka-ozdobnikow, silnik-layoutu, druk-pdf, tester |
| M3-6 | ✓ 19.11.2026 | L        | Dowolny obrót swobodny i opcjonalne pakowanie MaxRects. Testy trafiania, przyciągania, wydruku, kolejności i wczytania obrotów ze starszych projektów.                                                                               | silnik-layoutu, druk-pdf, edytor-ui, tester             |
| M3-7 | ✓ 19.11.2026 | L        | Import CSV/XLSX z mapowaniem. Testy poprawnych i błędnych plików, mapowania i cofnięcia.                                                                                                                                             | dane-import, edytor-ui, tester                          |
| M3-8 | ✗            | S        | Domknięcie. README, zrzuty, kontrola regresji M2c oraz odbiór neutralnych scenariuszy w obu językach i motywach.                                                                                                                     | edytor-ui, tester, recenzent                            |

[Zrzuty M3-1](obrazy/m3-1/README.md) pokazują zestawy Leśny i Runiczny w PL i EN, w obu motywach.

Zrzuty M3-2 pokazują [grupę stylów](obrazy/m3-2-grupa-stylu.png) i [regułę koloru karty](obrazy/m3-2-kolor-z-danych.png).

[Zrzut M3-3](obrazy/m3-3-listy-i-ikony.png) pokazuje oba rodzaje notacji.

[Zrzut M3-4](obrazy/m3-4-ciag-dalszy.png) pokazuje kontynuację na arkuszu.

[Zrzut M3-5](obrazy/m3-5-dekoracje.png) pokazuje ustawienia tekstury i postrzępienia karty.

Zrzuty M3-6 pokazują [obrót elementu](obrazy/m3-6-obrot.png) i [pakowanie MaxRects](obrazy/m3-6-maxrects.png).

[Zrzut M3-7](obrazy/m3-7-import.png) pokazuje mapowanie, podgląd danych i nakład z pliku.

### Ręczne sprawdzenia M3

- [ ] M3-1. W PL i EN oraz w obu motywach przełączyć zestawy na karcie z separatorem, cofnąć zmianę i ponownie otworzyć szablon. Na pustej karcie sprawdzić wygląd ramki i puste drzewo pól.
- [ ] M3-2. W PL i EN oraz w obu motywach przypisać dwa pola do jednej grupy, zmienić jej czcionkę i kolor, odłączyć jedno pole, a następnie usunąć grupę. Oba pola powinny zachować ostatni widoczny styl po odłączeniu lub usunięciu. Wyeksportować i zaimportować szablon z grupą, porównać niezależność obu kopii.
- [ ] M3-2. Ustawić osobne reguły tła całej karty, panelu i koloru etykiety. Porównać dopasowanie wartości i kolor domyślny dla pustej lub innej wartości w podglądzie oraz w PDF/PNG.

- [ ] M3-3. W PL i EN oraz w obu motywach włączyć listę i ikony w polu Opis. Wpisać dwie długie pozycje, użyć `:star:`, `:scissors:` i nieznanego kodu. Sprawdzić wcięcie zawinięcia przy wyrównaniu do lewej i do prawej. Porównać ikony w podglądzie, PDF i PNG.

- [ ] M3-4. W PL i EN oraz w obu motywach włączyć kontynuację, wpisać za długi opis i porównać kolejność oraz nagłówek w siatce, pasach, PDF i ZIP. Przypiąć oryginał na późniejszej stronie i sprawdzić pozycje dalszych części. Wpisać zbyt długie, niepodzielne słowo i sprawdzić ostrzeżenie przy karcie.

- [ ] M3-5. W PL i EN oraz w obu motywach wybrać teksturę karty i panelu, zmienić ziarno przy włączonym postrzępieniu i włączyć szkic dla ramki oraz separatora. Włączyć motyw po łuku na zaokrąglonej karcie. Porównać przycięcie w podglądzie, PNG i PDF. Wyeksportować paczkę i sprawdzić teksturę po imporcie do innego projektu.

- [ ] Kartka Mausrittera. Ustawić obok siebie karty 1×1, 1×2 i 2×1. Sprawdzić nożyczki na wolnych krawędziach w podglądzie, PNG, JPG i PDF. Odsunąć oraz usunąć sąsiada i ponownie przejść cykl rozmiarów.

- [ ] Stały obraz. W PL i EN, w obu motywach wgrać PNG i JPG do stałego pola obrazu w edytorze. Sprawdzić wybrany obraz, podgląd, eksport PNG oraz cofnięcie jednym krokiem.

- [ ] Znacznik arkusza Mausrittera. W PL i EN, w obu motywach ustawić kartę 1×2 przecinającą drugą poziomą linię i Patyk obok. Powtórzyć pionowo z kartą 2×1. Sprawdzić położenie nożyczek i przerywanej kreski oraz zgodność podglądu z PNG, JPG i PDF.

- [ ] M3-6. W PL i EN oraz w obu motywach obrócić pole o 37,5°, kliknąć jego środek i pusty róg obwiedni, sprawdzić uchwyty, przyciąganie oraz zgodność podglądu z PDF. Włączyć MaxRects dla mieszanych rozmiarów, zmienić kolejność przeciąganiem i sprawdzić wydruk. Po powrocie do siatki sprawdzić przypięcia.

- [ ] M3-7. W PL i EN oraz w obu motywach otworzyć import pod kartką. Wczytać CSV z przecinkiem albo średnikiem i XLSX z dwiema kartami skoroszytu. Przypisać tytuł, ilość i lokalny obraz. Sprawdzić podgląd, blokadę przy błędzie, dodanie na kartce mieszanej i w siatce oraz cofnięcie całej partii.

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

| #    | Etap    | Sprawa                   | Decyzja                                                                                                                                                                                                                                                                       |
| ---- | ------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B230 | Plan    | Kolejność                | M3 zaczynamy od zestawów stylów przewidzianych w planie M2b. Grupowanie, skład i zmiany geometrii są osobnymi etapami.                                                                                                                                                        |
| B231 | Plan    | Zapis zestawu            | Użycie zestawu kopiuje ustawienia z wbudowanego katalogu bez referencji do zestawu w schemacie projektu. Brak separatora pozostawia drzewo bez zmian.                                                                                                                         |
| B232 | Plan    | Import danych            | Mapowanie i walidację pokazujemy przed zapisem. Błąd mapowanego wiersza blokuje zapis całej partii.                                                                                                                                                                           |
| B233 | M3-1    | Wbudowane zestawy        | Leśny łączy pnącze, liść i gwiazdę, a Runiczny runy, okucie, łańcuch i romb. Obydwa używają istniejących elementów katalogu.                                                                                                                                                  |
| B234 | M3-1    | Zakres i historia        | Jedna operacja zmienia ramkę karty i istniejące separatory we wszystkich wariantach. Zachowujemy długość i kierunek separatorów, geometrię ramki i jej ustawienia linii. Ponowne użycie identycznego zestawu nie dodaje kroku historii.                                       |
| B235 | M3-2    | Wspólny styl             | Grupa współdzieli główny styl typograficzny pola w obrębie szablonu. Etykieta, wygląd i geometria pozostają indywidualne. Odłączenie, usunięcie grupy i wklejenie stylu zapisują styl lokalny.                                                                                |
| B236 | M3-2    | Reguły kolorów           | Klucz pochodzi z tekstowych danych lub parametru. Wartości porównujemy z rozróżnieniem wielkości liter po obcięciu białych znaków. Pierwszy pasujący wiersz wygrywa, a pustą albo nieznaną wartość obsługuje jawny kolor domyślny.                                            |
| B237 | M3-2    | Schemat 18               | Migracje projektu i paczki v17 zachowują ich pola. Grupy mają lokalne ID i przenoszą użyte czcionki. Brakująca grupa używa stylu pola i rezerwuje swój identyfikator, żeby późniejsza edycja nie dołączyła pola przez przypadek.                                              |
| B238 | M3-3    | Włączanie notacji        | Schemat 19 dodaje dwa niezależne przełączniki pola tekstowego. Starsze pola zachowują dotychczasową interpretację tekstu.                                                                                                                                                     |
| B239 | M3-3    | Indeksy listy            | Zachowujemy podane liczby. Znacznik zaczyna akapit, a pierwszy i zawinięte wiersze danej pozycji mają wspólne wyrównanie. Etykieta w tej samej linii zajmuje początek akapitu.                                                                                                |
| B240 | M3-3    | Ikony w tekście          | Kody `:star:` i `:scissors:` używają istniejących konturów. Nieznane są dosłowne, a lewy ukośnik pozwala zacytować znany kod. Pomiar uwzględnia pełny kwadrat ikony.                                                                                                          |
| B241 | M3-4    | Pole kontynuacji         | W aktywnym układzie wybieramy pierwsze włączone pole w kolejności drzewa. Podział odbywa się po słowach, zachowuje style i ikony, a niepodzielny fragment lub limit 64 części pozostawia oryginalne ostrzeżenie.                                                              |
| B242 | M3-4    | Karty pochodne           | Kontynuacje są scenami tego samego rekordu. Zachowują tytuł i dodają lokalizowany, numerowany dopisek. Przypięcia i normalizacja dotyczą oryginałów. Każda sztuka na wydruku zawiera komplet części.                                                                          |
| B243 | M3-4    | Schemat 20 i pliki       | Ustawienie kontynuacji jest opcjonalne. Karty eksportowane osobno mają plik na każdą część unikalnego rekordu, zgodnie z dotychczasowym pominięciem powtórzeń nakładu.                                                                                                        |
| B244 | M3-5    | Szkic i krawędź          | Siła, ziarnistość i ziarno dają powtarzalny kontur. Parametry ramki i separatora dotyczą kreski, a postrzępienie karty i panelu przycina ich tło oraz teksturę. Kontur cięcia arkusza pozostaje prostokątny.                                                                  |
| B245 | M3-5    | Tekstury i schemat 21    | Pole tekstury wskazuje lokalny obraz kadrowany do obszaru tła. Paczka zabiera użyte obrazy, weryfikuje odniesienia i przepisuje identyfikatory przy kolizji. Spad pozostaje częścią planowanego trybu drukarni w M4.                                                          |
| B246 | M3-5    | Motyw po łuku            | Kafelki podążają stycznie do zaokrąglonego obrysu w granicach ramki. Ustawienie narożników pozostaje w szablonie i działa ponownie po przełączeniu na prosty motyw.                                                                                                           |
| B247 | Kreator | Domyślny układ           | „Swobodny” jest pierwszym i domyślnym wyborem w kreatorze. Dalej są „Tytuł i opis”, „Tytuł + siatka + opis + stopka” oraz „Pusta karta”. Zapisane projekty i przykładowe szablony zachowują swoje układy.                                                                     |
| B248 | Kartka  | Nożyczki przy kartach    | Na automatycznej i mieszanej kartce znacznik odnosi się do własnej krawędzi karty. Kolizja z kartą, napisem lub innym znacznikiem kieruje znacznik na inną krawędź lub go pomija. Gotowy arkusz z jawną siatką zachowuje dotychczasowy znacznik, o ile nie koliduje z kartą.  |
| B249 | Kartka  | Cykl rozmiaru            | Dostępność wynika z bieżących przypięć i geometrii. Gdy bieżący rozmiar z zapisu jest spoza listy typu, przeglądamy wszystkie dostępne opcje w ich zwykłej kolejności.                                                                                                        |
| B250 | Szablon | Wgrywanie stałego obrazu | PNG i JPG używają tego samego limitu i przygotowania co podkład. Zapis pliku w bibliotece i wybór w polu to jeden krok historii. Zastąpiony obraz jest dalej dostępny w bibliotece. Opuszczenie pola podczas odczytu anuluje dodanie obrazu.                                  |
| B251 | Arkusz  | Znacznik wspólnej siatki | Rysujemy najwyżej jeden znacznik na istniejącym odcinku cięcia. Po kolizji sprawdzamy kolejne odcinki bieżącej i następnych linii oraz drugi koniec. Gdy brakuje miejsca na kreskę, dopuszczamy samą ikonę. Brak bezpiecznego miejsca dla ikony oznacza pominięcie znacznika. |
| B252 | M3-6    | Kąt i kotwica            | Schemat 22 zachowuje stare kąty, przyjmuje wartości od 0 do mniej niż 360° i nadal ma skróty do wielokrotności 90°. Kotwice i przyciąganie przy przesuwaniu używają obwiedni. Trafienia i uchwyty uwzględniają dokładny obrys.                                                |
| B253 | M3-6    | Zmiana rozmiaru          | Uchwyty ukośnego pola działają w jego osiach i korzystają z siatki. Skalowanie wielokrotnego zaznaczenia używa wspólnych osi wyłącznie dla wielokrotności 90°. Auto ogranicza pomiar obwiednią rodzica, respektując rozmiary stałe i minima.                                  |
| B254 | M3-6    | MaxRects                 | Pakowanie opcjonalne. Domyślnie pasy. Własna kolejność używa punktów od góry i od lewej w granicach grupy. Nagłówki rezerwują pełną szerokość, a części tego samego rekordu na wydruku zachowują kolejność odczytu.                                                           |
| B255 | M3-7    | Pliki tabeli             | UTF-8 z przecinkiem lub średnikiem w CSV. W XLSX można wskazać kartę skoroszytu, a do ilości używamy zapisanej liczby przed formatowaniem. Biblioteka SheetJS CE działa lokalnie i korzysta z ograniczonego archiwum.                                                         |
| B256 | M3-7    | Walidacja                | Maksymalnie 8 MB pliku, 500 wierszy danych, 128 kolumn i 2000 sztuk na operację. Pusta ilość oznacza 1, a jawna ilość ma zakres 1–100. Nazwy obrazów porównujemy z uwzględnieniem liter po obcięciu białych znaków. Błąd mapowania wstrzymuje zapis.                          |
| B257 | M3-7    | Talia i cofnięcie        | Import korzysta z typów dostępnych na wybranej kartce. W siatce dodaje przypięte egzemplarze i w razie potrzeby strony, a w trybie mieszanym dodaje jeden rekord na wiersz z nakładem. Cała partia to jedna zmiana w historii.                                                |
