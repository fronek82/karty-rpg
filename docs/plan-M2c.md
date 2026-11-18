# Plan M2c – biblioteka globalna, wymiary arkusza i eksport obrazów

**Status.** Plan zaakceptowany zgodnie z dyspozycją właściciela z 18.11.2026. M2c-1 i M2c-2 ukończone 18.11.2026. Następny etap to M2c-3. Punktem wyjścia jest `main` po UI-9. Zakres pochodzi z [planu M2b, sekcji 6 i decyzji R2](plan-M2b.md) oraz [decyzji B31](plan-M2.md).

## 1. Cel i kryterium ukończenia

- Użytkownik zapisuje własny szablon lub ozdobnik z zasobami przenoszonymi przez dany format i korzysta z kopii w innym projekcie w tej samej przeglądarce. Może zapisać wpis do pliku i wczytać go w innej przeglądarce.
- Użytkownik widzi w edytorze układu, gdzie na papierze są marginesy, sloty i odstępy. Zmiana ustawienia od razu aktualizuje opis i strzałki.
- Firefox i Safari pobierają obrazy stron i kart w PNG i JPG. Automatyczne testy Firefox i WebKit sprawdzają rozmiar odpowiadający 300 dpi, poprawność pliku oraz obecność osadzonej ilustracji.

Każdy etap kończy się zielonymi kontrolami typów, lintem, formatowaniem, Vitest i Playwright. Wzorce PNG kart, arkuszy i przykładów mają pozostać identyczne. Końcowy przebieg sprawdza nowe ścieżki po polsku i angielsku, w jasnym i ciemnym motywie.

## 2. Stan dziś

| Potrzeba                            | Stan | Uwagi                                                                                                               |
| ----------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------- |
| Zapis projektu i zasobów            | ✓    | Dexie w IndexedDB. Schemat dokumentu projektu ma wersję 16.                                                         |
| Przenoszenie szablonu z zasobami    | ✓    | `.kartyrpg-szablon` zawiera użyte czcionki, obrazy i własne ozdobniki. Import rozwiązuje konflikty identyfikatorów. |
| Przenoszenie pojedynczego ozdobnika | ◐    | Ozdobnik można przenieść w pliku projektu lub za pomocą szablonu, który go używa.                                   |
| Biblioteka globalna                 | ✗    | Ozdobniki i szablony należą do projektu. Lokalnie wspólne są już presety „Moje układy”.                             |
| Podgląd wymiarów własnej siatki     | ◐    | Kartka odświeża się przy edycji, a formularz pokazuje pozostałe marginesy. Osobny diagram wymiarów przewiduje B31.  |
| Eksport obrazów                     | ◐    | Renderowanie SVG do canvas i pobranie obrazu lub ZIP istnieją. Obecny test UI uruchamia się w Chromium.             |

## 3. Projekt rozwiązania

### 3.1 Globalna biblioteka

- Osobna kolekcja IndexedDB. Lista wczytuje metadane, a plik z zasobami dopiero przy użyciu lub pobraniu. Zapis i usunięcie wpisu wraz z paczką wykonujemy w jednej transakcji. Aktualizacja bazy zachowuje istniejące tabele i rekordy.
- Zapis z projektu tworzy samodzielną kopię. Wczytanie do projektu używa zwykłych operacji importu i historii edycji, a kolizje identyfikatorów rozwiązujemy bez nadpisywania zasobów. Usunięcie wpisu z biblioteki nie usuwa kopii z projektów. Odwołania globalne nie są częścią zapisywanego projektu.
- Szablony korzystają z istniejącego formatu `.kartyrpg-szablon`, wraz z dotychczasowymi regułami przenoszenia czcionek i zasobów. Podkład roboczy pozostaje częścią pliku projektu zgodnie z B99 z M2b. Import zachowuje role czcionek projektu docelowego i może użyć jego czcionki przy kolizji rodziny i wariantu. Interfejs informuje o tych regułach. Globalny wpis da się utworzyć z pliku, pobrać i usunąć. Własny ozdobnik ma wersjonowaną, samodzielną paczkę. Import sprawdza pełność i poprawność danych przed zapisem, w tym obraz wymagany dla ramki 9-slice oraz istniejące limity i walidację konturów.
- Biblioteka szablonów jest dostępna z ekranu własnych kart i ustawień projektu. W projekcie opartym na pakiecie dodany szablon dostaje własną kartkę, także przy identycznych wymiarach slotu. Powiązanie kartki z własnym szablonem zachowuje się po ponownym otwarciu i w archiwum projektu. Taka kartka korzysta z własnego menu typów i edytora szablonu. Kartki pakietu zachowują menu pakietu i blokadę edycji jego oryginalnych szablonów. Biblioteka ozdobników projektu może zapisać i dodać kopię pojedynczego własnego ozdobnika.

### 3.2 Podgląd wymiarów

- Panel własnego układu pokazuje diagram papieru i siatki, gdy użytkownik rozwinie podgląd wymiarów. Strzałki opisują wymiary papieru, slotu, cztery marginesy i oba odstępy. Wartości w mm pobieramy z tych samych danych co `wymiaryUkladu`, z uwzględnieniem orientacji.
- Wartości są też dostępne jako tekst. Kliknięcie etykiety edytowalnego wymiaru lub jej aktywacja klawiszem Enter przenosi fokus do pola. Prawy i dolny margines są wartościami obliczanymi, puste wymiary odstępów pomijają akcję. Diagram reaguje na zmianę siatki i presetu. Po odrzuceniu zmiany przez ochronę przypiętych kart nadal pokazuje zatwierdzony układ, a formularz wyświetla dotychczasowy komunikat. Punktem odniesienia dla testu jest pionowy arkusz A4 210 × 297 mm, siatka 3 × 3, slot 63 × 88 mm, lewy i górny margines 5 i 10 mm oraz odstępy 3 i 4 mm. Wynik to siatka 195 × 272 mm, prawy margines 10 mm i dolny 15 mm. Odstępy nieobecne przy jednym wierszu lub kolumnie odróżniamy od wartości zerowych. Podgląd jest częścią interfejsu formularza i nie trafia do sceny, PDF, PNG ani JPG.

### 3.3 Eksport obrazów

- Najpierw odtworzyć pełną ścieżkę od „Pobierz” po odczyt pliku na Firefox i WebKit. Oddzielić brak bibliotek systemowych od błędów uruchomionej aplikacji. W każdej przeglądarce sprawdzić PNG i JPG dla stron i kart, bezpośrednie pobranie jednego pliku i ZIP przy wielu plikach. Odczytać wpisy z ZIP i sprawdzić nazwy, sygnatury i wymiary obliczone z mm oraz kolor osadzonego obrazu z tolerancją dla JPEG.
- Poprawka dotyczy wykazanego problemu w rasteryzacji, danych obrazu lub pobieraniu. Wejściem pozostaje istniejąca scena. CI instaluje Firefox i WebKit z wymaganymi zależnościami i uruchamia w obu wyłącznie scenariusze eksportu, a pełna regresja nadal działa w Chromium. Silnik WebKit w Playwright jest automatycznym sprawdzeniem zgodności. W natywnym Safari osobno sprawdzamy zapis pliku i jego otwarcie, jeśli środowisko na to pozwala. Przy braku dostępu wynik ręczny Safari pozostaje niezweryfikowany.

## 4. Etapy

Jeden etap to jedna gałąź od aktualnego `main` i jeden PR. Status ✓ z datą oznacza zakończony etap. Po pozytywnym przeglądzie i sprawdzeniach scal PR. Potwierdź wdrożenie na Pages i rozpocznij kolejny etap od nowego `main`.

| Etap  | Status       | Wielkość | Zakres z testami                                                                                                                                                                                                                                                                                                                                            | Agenci                                                |
| ----- | ------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| M2c-1 | ✓ 18.11.2026 | L        | Biblioteka szablonów i ozdobników, import i eksport, użycie w projektach własnych i pakietowych. Test migracji bazy, paczek i kolizji zasobów. E2e obejmuje dodawanie kart własnych obok kart pakietu o tych samych wymiarach, otwarcie ponowne i import projektu, cofanie i usuwanie oraz eksport obu rodzajów wpisów i ich import w czystej przeglądarce. | dane-import, biblioteka-ozdobnikow, edytor-ui, tester |
| M2c-2 | ✓ 18.11.2026 | M        | Diagram wymiarów w panelu ustawień. Test obu orientacji, zerowych odstępów, presetu, aktualizacji wymiaru i przeniesienia fokusu do formularza klawiaturą i myszą. Sprawdzenie, że oznaczenia nie trafiają do wydruku.                                                                                                                                      | druk-pdf, edytor-ui, tester                           |
| M2c-3 | ✗            | M        | Diagnoza i zgodność PNG/JPG w Firefox i WebKit. Testy właściwych plików i zawartości w obu przeglądarkach, pełna regresja Chromium.                                                                                                                                                                                                                         | druk-pdf, edytor-ui, tester                           |
| M2c-4 | ✗            | S        | Domknięcie. README i opis nowych czynności, zrzuty i sprawdzenia PL/EN w obu motywach, końcowa kontrola wzorców oraz statusów planu i `CLAUDE.md`.                                                                                                                                                                                                          | tester, edytor-ui, recenzent                          |

## 5. Zakres pierwszej wersji

- Biblioteka wspólna dla projektów w jednej przeglądarce, z zapisem kopii, użyciem, usunięciem i importem oraz eksportem pliku.
- Wymiary własnej siatki arkusza z czytelnymi strzałkami, etykietami i ostrzeżeniem o przekroczeniu papieru.
- PNG i JPG dla stron oraz kart po potwierdzeniu w Firefox i WebKit. Dotychczasowe opcje kompresji, rozmiary obrazu i komunikaty pozostają spójne z Chromium.

## 6. Później

M3 zgodnie z [planem M2b](plan-M2b.md), w tym zestawy stylów i dalsze rozszerzenia modelu kart. Synchronizacja biblioteki przez sieć, udostępnianie publiczne i wspólna edycja wpisów należą do osobnego zakresu.

## 7. Decyzje

| #   | Sprawa           | Decyzja                                                                                                                                                                |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Życie wpisów     | Kopia biblioteki i kopie w projektach są niezależne.                                                                                                                   |
| R2  | Format dokumentu | Model projektu, silnik i PDF zachowują zgodność. Ewentualna zmiana schematu projektu wymaga migracji i testu. Zmiana tabel IndexedDB ma osobny test aktualizacji bazy. |
| R3  | Wymiary          | Diagram korzysta z wartości w mm i kolorów motywu oraz zawiera tekstowe odpowiedniki strzałek. Etykiety wymiarów edytowalnych kierują do pól formularza.               |
| R4  | Przeglądarki     | Eksport jest testowany w Firefox i WebKit w CI. Zakres rzeczywistego sprawdzenia w Safari opisujemy jawnie.                                                            |
| R5  | Dane przykładowe | Nowe testy i zrzuty używają neutralnych nazw i danych. Interfejs ma komplet tekstów PL i EN.                                                                           |

## 8. Ryzyka

- **Utrata zasobu lub zmiana istniejącego projektu** przy konflikcie ID. Paczki są samodzielne, a test porównuje projekt przed importem i po nim.
- **Zapełnienie pamięci lokalnej** przy dużych obrazach. Metadane nie ładują bajtów paczek, import ma limity, a błędy zapisu są widoczne.
- **Ścisk etykiet wymiarów** na małym papierze lub przy zerowym odstępie. Zestawienie tekstowe jest dostępne w każdej orientacji i rozdzielczości.
- **Rozbieżność między WebKit i Safari** przy pobieraniu. Playwright sprawdza pliki, a ręczny scenariusz obejmuje natywne Safari. Zachowanie limitu rozmiaru canvas ogranicza zużycie pamięci.

## 9. Decyzje podjęte bez konsultacji

| #    | Etap  | Sprawa                              | Decyzja                                                                                                                                                                |
| ---- | ----- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B218 | Plan  | Dane globalne                       | Katalog i paczki są przechowywane w osobnych, transakcyjnie aktualizowanych tabelach IndexedDB.                                                                        |
| B219 | Plan  | Kartki projektów pakietowych        | Własny szablon trafia na osobną kartkę w tym samym projekcie. Arkusze pakietu zostają przypisane do dotychczasowych typów.                                             |
| B220 | Plan  | Zasięg testów między przeglądarkami | Pełne e2e zachowuje projekt Chromium. Firefox i WebKit uruchamiają scenariusze pobierania obrazów.                                                                     |
| B221 | M2c-1 | Powiązanie kartki z szablonem       | Schemat 17 dodaje opcjonalne `Arkusz.wlasnySzablonId`. Migracja zachowuje stare kartki i ich pakiety.                                                                  |
| B222 | M2c-1 | Plik ozdobnika                      | `.kartyrpg-ozdobnik` to ZIP z `ozdobnik.json` w wersji 1 i obrazem ramki 9-slice, jeśli jest wymagany.                                                                 |
| B223 | M2c-1 | Obrazy ramek i cofanie              | Zapis globalnej ramki sprawdza format, wymiary i dekodowanie obrazu. Import zachowuje identyfikatory i bajty zasobów używane przez historię zmian.                     |
| B224 | M2c-2 | Dostęp do wymiarów                  | Podgląd rozwija się w panelu układu. Rysunek i lista korzystają z tych samych wartości. Etykiety edytowalne prowadzą do pól, a odstępy bez sąsiedniego slotu pomijamy. |
| B225 | M2c-2 | Etykiety i precyzja                 | Rozmiar slotu i odstępy mają osobne położenia etykiet, wartości zachowują do dwóch miejsc po przecinku, a etykiety własnego papieru uwzględniają obrót osi.            |
