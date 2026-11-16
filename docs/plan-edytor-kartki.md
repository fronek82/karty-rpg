# Plan: edytor kartki (wizualne układanie kart)

Zastępuje obecny interfejs (tabele talii + osobna strona arkuszy) jednym widokiem: **kartka A4 z siatką slotów, na której klika się, układa i edytuje karty**. Silnik układu, PDF, zapis w IndexedDB i eksport/import zostają; zmienia się interfejs i – w niewielkim zakresie – model arkusza (sekcja 3).

Makiety (zrzuty z HTML, strony kart wyrenderowane prawdziwym silnikiem – to, co na nich widać, trafi do PDF):

| Ekran                                 | Plik                                            |
| ------------------------------------- | ----------------------------------------------- |
| 1. Start                              | `docs/obrazy/makieta-1-start.png`               |
| 2. Pusta kartka + menu typu karty     | `docs/obrazy/makieta-2-pusta-kartka.png`        |
| 3. Zaznaczona karta + panel pól       | `docs/obrazy/makieta-3-edycja-karty.png`        |
| 4. Przeciąganie, „Cofnij”, 2 strony   | `docs/obrazy/makieta-4-przeciaganie-cofnij.png` |
| 5. Stany: nagłówki grup nad kolumnami | `docs/obrazy/makieta-5-stany-naglowki.png`      |
| 6. Ustawienia (tytuł, cz-b, czcionki) | `docs/obrazy/makieta-6-ustawienia.png`          |

## 1. Przepływ

1. **Start** (`#/`): wybór gry (patrz „Uzupełnienia”), niżej **„Moje projekty”** – kafelki z miniaturą pierwszej strony, nazwą, liczbą stron i kart, datą oraz „Otwórz / Eksportuj / Usuń”. „Importuj plik .kartyrpg” w nagłówku.
2. **Kartka** (`#/projekt/<id>`): strony A4 poziomo jedna pod drugą, w skali, z siatką 10 × 7 slotów (przerywane kratki tylko na ekranie). Bez wyboru talii i arkuszy.
3. **Klik w pusty slot** → menu: Broń, Zbroja, Ekwipunek (przedmiot / sakiewka), Zaklęcie, Stan, Pusta karta. Karta pojawia się w slocie w domyślnym rozmiarze typu (tabela w sekcji 4). Gdy domyślny rozmiar się nie mieści (np. zbroja 1×2 w ostatnim rzędzie), wybierany jest pierwszy, który się mieści; gdy żaden – pozycja menu jest wyszarzona z podpowiedzią.
4. **Klik w kartę** → zaznaczenie (niebieska ramka) + **panel boczny** z polami typu: nazwa, wartość/obrażenia, klasa, znaczniki (− / +), rozmiar (przyciski; niemieszczące się wyszarzone), ilustracja (wgraj / z biblioteki, skala, obrót, reset; na kartce: kółko myszy = skala, przeciąganie z Alt = przesunięcie ilustracji). Zmiany widać na kartce od razu (ta sama scena co w PDF).
5. **Pasek nad zaznaczoną kartą**: Duplikuj, Rozmiar, Usuń. Po usunięciu – komunikat „Usunięto kartę „…” · **Cofnij**”. Ogólne Ctrl+Z / Ctrl+Shift+Z dla wszystkich zmian układu i pól.
6. **Przeciąganie** kart myszą (i palcem na tablecie): pod kursorem podgląd karty, docelowe miejsce zielone, zajęte czerwone – puszczenie na czerwonym przywraca kartę na miejsce. Strzałki przesuwają zaznaczoną kartę o slot (klawiatura).
7. **„Dodaj stronę”** pod ostatnią stroną; pusta strona ma „Usuń stronę”. Przeciąganie także między stronami. Duplikat trafia w pierwsze wolne miejsce za oryginałem; gdy go nie ma – na nową stronę.
8. **Pasek górny zawsze widoczny**: nazwa projektu (edycja w miejscu), status zapisu, **Ustawienia**, **Eksportuj**, **Pobierz PDF**.
9. **Stany**: ten sam mechanizm + **nagłówek grupy nad kolumnami** („+ Nagłówek grupy” nad wolnymi kolumnami; klik w nagłówek → panel: tekst, opis, szerokość w kolumnach, odstęp przed grupą). Nagłówek należy do kolumn, nie do kart.
10. **Gotowe układy** z pakietu ładują się jako zwykłe karty na kartce (każda karta osobno, przypięta w swoim slocie) – do dowolnej edycji.

**Ustawienia** (panel boczny zamiast pól karty): tytuł kartki i jego położenie (z lewej pionowo / u góry / bez), kolor / czarno-biały, czcionki ról Tytuły i Treść + „Wgraj własną czcionkę…”, papier A4 / Letter (zawsze poziomo).

### Uzupełnienia po akceptacji

- **Start = wybór gry.** Duże kafelki „Stwórz karty do Mausrittera” i „Stwórz karty do innej gry”, niżej „Moje projekty” z miniaturami. Mausritter → drugi ekran: „Pusta kartka” albo „Zacznij od gotowego układu” (Broń i pancerze / Wyposażenie / Stany / Wszystkie trzy) → kartka. „Inna gra” → strona „w budowie” (D&D, Warhammer, Jedyny Pierścień, własne karty – M2/M3). Gry są w rejestrze (`src/pakiety/gry.ts`): kolejna gra = kolejny wpis z pakietem (szablony, typy kart, gotowe układy) i kafelek pojawia się sam.
- **Wiele kart naraz.** Shift+klik i zaznaczanie prostokątem (przeciągnięcie po pustym miejscu). Przy wielu kartach tego samego typu panel edytuje wspólne pola wszystkich naraz (różne wartości – pole puste z podpowiedzią „różne”; wpisanie ustawia wszystkim). Usuń, Duplikuj i przeciąganie działają na całym zaznaczeniu (zaznaczenie przesuwa się jako blok).
- **„Duplikuj ×N”** – N kopii w kolejne wolne sloty za oryginałem (gdy brak miejsca – nowe strony).
- **Skróty:** Delete – usuń, Ctrl+D – duplikuj, Ctrl+Z – cofnij (Ctrl+Shift+Z – ponów), strzałki – przesuń, Escape – odznacz.
- Pusta strona ma tytuł, ale bez nożyczek (nożyczki wskazują linię cięcia, a tej bez kart nie ma).

## 2. Co znika, co zostaje

- **Znika** (z menu i z kodu): tabela talii (`src/ui/talia/TabelaTalii.tsx`), osobna strona arkuszy z korektą (`src/ui/Arkusze.tsx`, `src/ui/arkusz/Korekta.tsx`), osobna strona czcionek (przenosi się do Ustawień), trasa `#/arkusze` (pakiet bez projektu), lista projektów jako osobna strona (jest na starcie). Testy e2e tych widoków zastępują nowe.
- **Zostaje bez zmian**: silnik karty i SVG, budowa arkusza (rozmieszczanie z przypięciami, linie cięcia, tytuł, nożyczki), PDF w workerze, szare obrazy, IndexedDB i `useProjekt` (zapis z opóźnieniem, ponawianie), eksport/import `.kartyrpg` i szablonów, wgrywanie obrazów (EXIF) i czcionek, testy geometrii, PDF↔SVG i nakładki.
- **Panel karty** powstaje z obecnego `PanelKarty` (podgląd znika – kartka jest podglądem; zostają pola i ustawienia ilustracji).

## 3. Model danych (zmiany)

Mapowanie: **projekt → kartki**; kartka = `Arkusz` + jego własna `Talia` (1:1). Karta na kartce = `Karta` z `ilosc: 1` + przypięcie (`strona`, `kolumna`, `rzad`). Przypięcia już istnieją i silnik je obsługuje.

Zmiany (schemat w wersji 2, migracja z wersji 1):

1. **`Arkusz.liczbaStron`** – strony mogą być puste (silnik dziś nie tworzy strony bez kart). Pusta strona: tytuł, bez linii cięcia.
2. **`Projekt.pakiet`** – id pakietu gry (typy kart w menu, gotowe układy); stare projekty Mausrittera rozpoznawane po szablonach.
3. **`Arkusz.naglowki`** – ręczne nagłówki grup: `{ id, strona, kolumna, kolumny, naglowek, opis?, odstepPrzed? }`. Silnik rysuje je nad wskazanymi kolumnami (ten sam styl co dziś), a `odstepPrzed` (mm) przesuwa kolumny od tej w prawo – jak odstępy 2,9 mm między grupami w oryginalnych stanach. Automatyczne grupy talii (`Talia.grupy`) przestają być używane przez interfejs.
4. **Ilość = 1**: każda karta na kartce to osobny egzemplarz. Normalizacja (przy tworzeniu z pakietu i przy otwieraniu starego projektu – potrzebuje czcionek, bo rozmieszczenie zależy od wysokości tytułu i nagłówków): karta z `ilosc: n` → n kart; karty rozmieszczane automatycznie dostają przypięcia w miejscach, gdzie leżą teraz („zamrożenie układu”); grupy talii → nagłówki nad ich kolumnami. Wynik wygląda tak samo jak przed migracją (test: identyczny PDF).
5. Nic nie zmienia się w szablonach, karcie (`dane`, `obrazy`, `rozmiar`) ani w bibliotece zasobów.

## 4. Typy kart

| Typ w menu  | Szablon                                        | Rozmiar domyślny | Inne rozmiary |
| ----------- | ---------------------------------------------- | ---------------- | ------------- |
| Broń        | `mausritter-bron`                              | 1×1              | 1×2 (ciężka)  |
| Zbroja      | `mausritter-zbroja`                            | 1×2 (ciężka)     | 2×1 (lekka)   |
| Ekwipunek   | `mausritter-przedmiot` / `mausritter-sakiewka` | 1×1              | 2×1, 1×2      |
| Zaklęcie    | `mausritter-zaklecie`                          | 1×1              | –             |
| Stan        | `mausritter-stan`                              | 1×1              | –             |
| Pusta karta | `mausritter-pusta`                             | 1×1              | 2×1, 1×2, 2×2 |

Panel pokazuje pola z szablonu (klucze i parametry – jak dziś kolumny tabeli), z polskimi etykietami i właściwymi kontrolkami: wartość/klasa jako pole z podpowiedziami (k6, k6/k8, k8, k10; Lekka, Średnia, Ciężka, …), znaczniki jako − / +, obraz jako wybór z biblioteki.

## 5. Realizacja (etapy, każdy z testami, commit + push)

| Etap | Zakres                                                                                                                                                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| K1   | Model v2 + migracja; silnik: puste strony, ręczne nagłówki z odstępem; czyste operacje kartki (`src/dane/kartka.ts`): dodaj w slocie, przesuń, zmień rozmiar, duplikuj, usuń, dodaj/usuń stronę, nagłówki, sprawdzanie kolizji; historia zmian (cofnij/ponów). Testy jednostkowe + test „migracja nie zmienia PDF”. |
| K2   | Widok kartki: strony w skali (SVG z silnika) + warstwa interakcji (sloty, karty, zaznaczenie), menu typu karty, panel pól, pasek górny.                                                                                                                                                                             |
| K3   | Przeciąganie (mysz, dotyk, między stronami), klawiatura, pasek nad kartą, Cofnij (komunikat + Ctrl+Z).                                                                                                                                                                                                              |
| K4   | Stany: nagłówki grup w interfejsie; gotowe układy z pakietu; ustawienia (tytuł, cz-b, czcionki, papier).                                                                                                                                                                                                            |
| K5   | Strona startowa z miniaturami, usunięcie starych widoków i tras, nowe testy e2e, dostępność (fokus, etykiety, Escape).                                                                                                                                                                                              |
| K6   | Przegląd kodu, poprawki, zrzuty ekranu, PR, scalenie, sprawdzenie wdrożenia.                                                                                                                                                                                                                                        |

### Stan realizacji

| Etap  | Stan | Uwagi                                                                                                                               |
| ----- | ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| K1    | ✅   | `f9b7bc9` – model, silnik (puste strony, nagłówki, slot), normalizacja (wydruk identyczny – test), operacje, historia, rejestr gier |
| K2–K4 | ✅   | `2e30013` – edytor kartki, gesty, panele kart / nagłówka / ustawień, gotowe układy                                                  |
| K5    | ✅   | start z wyborem gry i miniaturami, usunięte stare widoki, teksty i style; nowe e2e                                                  |
| K6    | 🟡   | przegląd, zrzuty, PR, scalenie                                                                                                      |

## 6. Decyzje (zatwierdzone)

| #   | Pytanie                                          | Rekomendacja                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Odstępy między grupami stanów (oryginał: 2,9 mm) | **Nagłówek z opcją „odstęp przed grupą”** – gotowy układ stanów wygląda jak oryginał. Alternatywa: zwykła siatka bez odstępów (prostsze, ale arkusz stanów nie nałoży się na oryginał).                                                                 |
| D2  | „Wszystkie trzy” gotowe układy                   | **Jeden projekt z trzema kartkami** (każda z własnym tytułem, strony jedna pod drugą; Ustawienia dotyczą kartki, na której jest zaznaczenie). „Dodaj stronę” dokłada stronę do ostatniej kartki; nowa kartka z innym tytułem – przycisk w Ustawieniach. |
| D3  | Zmiana rozmiaru karty                            | **Przyciski rozmiaru** (panel i pasek nad kartą). Uchwyty w rogach na makiecie tylko oznaczają zaznaczenie; ciągnięcie za uchwyt – można dodać później.                                                                                                 |
| D4  | Ilość sztuk                                      | **Każda karta osobno** (duplikat = nowa karta). Kolumna „Ilość” znika; stare projekty migrowane bez zmiany wydruku.                                                                                                                                     |
| D5  | Telefony                                         | **Komputer i tablet** (od ~1000 px szerokości). Na wąskim ekranie strona skaluje się, panel zjeżdża pod kartkę; pełna obsługa telefonów poza zakresem.                                                                                                  |
| D6  | Ekwipunek: przedmiot i sakiewka                  | **Jedna pozycja menu z podwyborem** (jak na makiecie). Alternatywa: dwie osobne pozycje.                                                                                                                                                                |
| D7  | Puste sloty na wydruku                           | **Nie drukujemy** – linie cięcia tylko wokół kart (jak dziś i w oryginale).                                                                                                                                                                             |

## 7. Ryzyka

- **Wydajność** przy pełnych stronach (60 kart stanów): przebudowa strony przy każdej zmianie. Mitygacja: przeliczanie tylko zmienionej strony, `useDeferredValue`, a podczas przeciągania – lekki podgląd karty bez przebudowy strony.
- **Migracja** istniejących projektów – test porównujący PDF przed i po.
- **Dotyk**: przeciąganie na tablecie wymaga `touch-action: none` na kartce i rozróżnienia przewijania od przeciągania (przytrzymanie przed przeciągnięciem).
