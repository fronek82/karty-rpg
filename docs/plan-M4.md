# Plan M4 – rewersy i przygotowanie do druku

**Status.** Plan przygotowany 19.11.2026. Najbliższy etap to M4-1. Punktem wyjścia jest ukończony [M3](plan-M3.md). [Ręczny odbiór M2c](plan-M2c.md#4-etapy) oczekuje. Zakres wynika ze [specyfikacji rewersu, czcionek i druku](../SPEC.md#7-rewers-tył-karty).

## 1. Cel i kryterium ukończenia

- Użytkownik może zbudować rewers z warstw i przypisać go talii, szablonowi lub konkretnej karcie. Podgląd i wydruk pokazują wynik po rozstrzygnięciu przypisań.
- Wydruk dwustronny zachowuje pozycje przodów, również przy mieszanych rozmiarach, nakładzie i kontynuacjach. Wybrana krawędź odwracania decyduje o lustrzanym układzie. Kalibrację można sprawdzić na wydruku próbnym.
- Tryb drukarni oferuje spad, znaczniki cięcia, ostrzeżenia o efektywnej rozdzielczości obrazów oraz układ siatki lub pojedynczej karty. Można dodać czcionki z katalogu Google Fonts i przenieść je z projektem.
- Stare projekty, paczki i dotychczasowy druk domowy przechodzą regresję. Nowe funkcje mają obsługę w PL i EN w obu motywach. Odbiór obejmuje neutralne przykłady i listę do fizycznego wydruku.

## 2. Stan przed M4

| Potrzeba                         | Stan | Uwagi                                                                                                                                               |
| -------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rewers i przypisania             | ✗    | Talia, szablon i karta nie zapisują rewersu.                                                                                                        |
| Edytor warstw                    | ◐    | Edytor swobodny ma pozycje, obrót, kolejność, ramki i przyciąganie. Brakuje edytora rewersu i części ustawień warstw.                               |
| Kroje pisma                      | ◐    | Rejestr składa tekst z lokalnych plików, a paczki przenoszą zasoby. Model rozpoznaje źródło Google, katalog nie jest dostępny w UI.                 |
| Spad i tryb drukarni             | ◐    | Jest tło do slotu, tekstura i ostrzeżenie DPI dla rastra 9-slice. Brakuje spadu, znaków drukarskich i ostrzeżeń według faktycznej geometrii obrazu. |
| Druk dwustronny                  | ◐    | PDF ma kalibrację X/Y, a geometria kartki opisuje położenia egzemplarzy. Jest tylko wydruk przodów.                                                 |
| Równoważność podglądu i eksportu | ✓    | Wspólna scena dla SVG, PNG/JPG i PDF oraz istniejące testy tych ścieżek.                                                                            |

## 3. Projekt rozwiązania

- **Model.** Rewers ma stabilny identyfikator lokalny dla projektu, nazwę i uporządkowane warstwy. Przypisanie przechowuje identyfikator. Karta ma pierwszeństwo przed szablonem, a szablon przed talią. Jawny wybór „bez rewersu” zatrzymuje dziedziczenie na danym poziomie. Usuwanie pokazuje liczbę przypisań, a zmiana rewersu i referencji jest jedną operacją historii. Migracja zachowuje dotychczasowe dane projektu i paczki. Eksport szablonu pakuje rewers przypisany szablonowi, zasoby warstw i ich zależności. Import rozwiązuje kolizje przed zapisem. Ostrzeżenie licencyjne obejmuje także własny krój użyty wyłącznie na rewersie.
- **Warstwy.** Wykorzystujemy geometrię i kontrolki edytora swobodnego oraz istniejące zasoby obrazów, czcionek i ozdobników. Tło może użyć PNG/JPG w czterech trybach: wypełnij z kadrowaniem, dopasuj z zachowaniem całego obrazu, rozciągnij lub ułóż w kafelki. Ma ustawienia krycia i zabarwienia. Napis może mieć własny styl, obrys i obrót, a osobny etap dodaje skład po łuku. Grafika ma pozycję, rozmiar, obrót i krycie. Dla SVG używamy walidowanych konturów z katalogu ozdobników i pozwalamy zmieniać ich kolor. Warstwy zapisują pozycje względem formatu karty i renderują się w jego wymiarze.
- **Dwustronność.** Każda strona rewersów powstaje z gotowych położeń przodów, włącznie z nakładem, pustymi miejscami i dodatkowymi częściami rekordu. Krawędź odwracania wskazuje oś odbicia na papierze w aktualnej orientacji. Przenosimy prostokąty i obracamy grafikę rewersu tak, żeby górne krawędzie obu stron tej samej karty pokryły się po fizycznym odwróceniu. Dla kąta przodu θ, liczonego od góry zgodnie z ruchem wskazówek zegara, rewers ma kąt −θ przy osi pionowej i 180° − θ przy osi poziomej. Grafika pozostaje czytelna. PDF dwustronny przeplata strony przodu i tyłu, zachowując pusty tył tam, gdzie potrzeba wyrównania par. Lokalna korekta rewersu ma osobne osie X/Y i wydruk próbny. Podgląd pokazuje obie strony tej samej pary.
- **Tryb drukarni.** Rozróżniamy format netto karty, obszar brutto ze spadem i kreski cięcia. Tło dochodzi do obszaru brutto, treść i ramy pozostają związane z formatem netto. Pakowanie rezerwuje spad i znaki, a strona pojedynczej karty zachowuje miejsce na znaczniki. Ostrzeżenie poniżej 300 DPI korzysta z pikseli źródłowych faktycznie użytych po kadrowaniu i wymiaru na wydruku. Wektory są niezależne od DPI. Podgląd i eksport używają tej samej geometrii.
- **Google Fonts.** Pierwsza wersja obejmuje wybrane rodziny z udokumentowanymi licencjami, wariantami i pokryciem polskich znaków. Pobranie następuje po wyborze użytkownika. Po zapisie istniejący rejestr i paczki używają lokalnych bajtów. Testy używają zapisanych odpowiedzi i sprawdzają błąd sieci oraz zgodność licencji przy przenoszeniu. Kontury glifów pozostają wspólne dla SVG i PDF.

## 4. Etapy

Każdy etap zaczyna się od aktualnego `main` i ma osobny PR. Zmiana schematu obejmuje migrację w `src/dane/schemat.ts`, test istniejących danych i zapis po ponownym otwarciu. Lokalnie uruchamiamy testy zakresu zmiany, a pełny zestaw wykonuje CI. Po scaleniu sprawdzamy wdrożenie.

| Etap | Status | Wielkość | Zakres z testami                                                                                                                                                                                     | Agenci                                                   |
| ---- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| M4-1 | ✗      | M        | Model rewersów, przypisania i paczki. Test migracji projektu i szablonu, priorytetów, pustego przypisania, kolizji zasobów, historii, ponownego otwarcia i licencji kroju użytego tylko na rewersie. | dane-import, silnik-layoutu, tester                      |
| M4-2 | ✗      | L        | Edycja i podgląd warstw, przypisania w UI. Testy czterech trybów tła, czcionek, ramek, wyboru szablonu lub talii, przyciągania, kolejności i cofania. E2E w obu językach i motywach.                 | edytor-ui, silnik-layoutu, biblioteka-ozdobnikow, tester |
| M4-3 | ✗      | M        | Tekst rewersu po łuku i uzupełnienie efektów warstw. Testy geometrii, złożonych glifów, krycia i zgodności PDF/SVG.                                                                                  | silnik-layoutu, druk-pdf, edytor-ui, tester              |
| M4-4 | ✗      | L        | Dwustronny podgląd, PDF i wydruk próbny. Test obu krawędzi i orientacji na niesymetrycznej obróconej karcie. Regresje siatki, MaxRects, nakładu, pustych tyłów, kontynuacji i kalibracji.            | druk-pdf, edytor-ui, tester                              |
| M4-5 | ✗      | L        | Tryb drukarni, spad, znaczniki i DPI. Testy pojedynczej karty i siatki, kroju netto i brutto, rastra po kadrowaniu, grafiki wektorowej oraz zgodności eksportu.                                      | druk-pdf, silnik-layoutu, edytor-ui, tester              |
| M4-6 | ✗      | M        | Katalog Google Fonts i zapis wariantów. Testy błędu pobrania, pracy bez sieci, polskich znaków, paczki i zgodności PDF/SVG.                                                                          | dane-import, edytor-ui, tester                           |
| M4-7 | ✗      | S        | Domknięcie, README, galeria neutralnych przykładów, kontrola regresji M2c i M3 oraz instrukcja fizycznego odbioru.                                                                                   | edytor-ui, tester, recenzent                             |

### Ręczne sprawdzenia M4

- [ ] Odbiór w PL i EN oraz w obu motywach. Utworzyć rewers, zmienić kolejność warstw, przypisać go na wszystkich trzech poziomach, zapisać i przenieść do drugiego projektu.
- [ ] Wydrukować w skali 100% w pionie i poziomie dla obu krawędzi odwracania. Użyć niesymetrycznego rewersu, mieszanych formatów, kilku kopii i karty bez rewersu. Sprawdzić strony, kolejność i korektę X/Y.
- [ ] Na próbce drukarskiej zmierzyć format netto i spad. Porównać tło, teksturę, znaczniki, ostrzeżenia o DPI oraz druk domowy z tego samego projektu.
- [ ] Pobrać krój z katalogu i ponownie otworzyć projekt bez sieci. Sprawdzić odmiany, polskie znaki oraz przeniesienie w paczce.

## 5. Zakres pierwszej wersji

Projekt zawiera rewersy warstwowe, przypisania i przenoszenie zasobów. Eksport obejmuje współdzielony podgląd, dwustronny PDF, osobny tryb drukarni i zestaw sprawdzonych krojów. Próbki odbiorowe używają neutralnych danych i własnych prostych grafik.

## 6. Później

Niewidoczna warstwa tekstowa do wyszukiwania w PDF jest opcjonalnym rozszerzeniem ze specyfikacji. Rozpoznawanie szablonów ze zdjęć i katalog udostępniany online należą do zakresu M5. Ustalenia dotyczące PDF/X, profili ICC i wymagań konkretnej drukarni zostają poza pierwszą wersją.

## 7. Decyzje

| #   | Sprawa         | Decyzja                                                                                              |
| --- | -------------- | ---------------------------------------------------------------------------------------------------- |
| R1  | Zgodność       | Druk domowy i stare paczki zachowują wartości domyślne. Migracja ma test dla każdej zmiany schematu. |
| R2  | Rewers         | Projekt przechowuje współdzielone rewersy. Przypisania i zasoby mają stabilne identyfikatory.        |
| R3  | Geometria      | Układ kart wynika z jednej sceny, również przy odbiciu położeń i eksporcie ze spadem.                |
| R4  | Język i odbiór | Nowy interfejs ma teksty PL i EN. Scenariusze odbioru używają neutralnych danych.                    |
| R5  | Dane lokalne   | Projekt działa bez sieci po zapisaniu zasobów. Eksport informuje o ograniczeniach licencji.          |

## 8. Ryzyka

- Niepoprawna oś odbicia lub obrócona karta w algorytmie pakującym może przesunąć tył mimo poprawnego podglądu. Testy używają niesymetrycznych kart, a odbiór obejmuje rzeczywisty wydruk.
- Karty ze spadem mogą wchodzić na sąsiednie znaczniki. Pakowanie uwzględnia obszar brutto, a zbyt mały papier daje ostrzeżenie.
- Archiwum rewersu może zawierać uszkodzone lub brakujące zasoby. Walidacja poprzedza zapis, a operacja importu jest atomowa.
- Pobieranie czcionek zależy od sieci i licencji. Katalog ogranicza się do sprawdzonych rodzin, a zakończony import zapisuje ich bajty lokalnie.

## 9. Decyzje podjęte bez konsultacji

| #    | Etap | Sprawa                 | Decyzja                                                                                                                                           |
| ---- | ---- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| B261 | Plan | Rewers i dziedziczenie | Zapis w projekcie, kolejność karta → szablon → talia. Jawny brak rewersu zatrzymuje dziedziczenie.                                                |
| B262 | Plan | Pary stron             | Rewers korzysta z prostokątów gotowego przodu. Odbijamy położenie i kierunek górnej krawędzi karty. Rewers uzyskuje właściwy kąt obrotem grafiki. |
| B263 | Plan | Spad i DPI             | Tryb drukarni włączany jawnie. Domyślny spad 3 mm i ostrzeżenia przy efektywnym DPI poniżej 300.                                                  |
| B264 | Plan | Katalog czcionek       | Wersjonowany wybór rodzin z udokumentowaną licencją. Warianty zapisane w projekcie działają bez sieci.                                            |
