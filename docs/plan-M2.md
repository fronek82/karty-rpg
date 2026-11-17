# Plan M2 – edytor kart od zera

Kamień milowy M2 ze `SPEC.md` (sekcje 3–6 i 12), zawężony do tego, co jest potrzebne, żeby użytkownik sam zbudował od zera szablon karty i robił z niego karty na kartce A4 – tak jak dziś w Mausritterze.

**Status:** plan, decyzje P1–P9 i uzupełnienia U1–U6 zaakceptowane (P4 zmieniona – sekcja 5, U2 z marginesem bezpieczeństwa). Realizacja: od M2-1.

## 1. Cel i kryterium ukończenia

Kafelek „Stwórz własne karty” prowadzi do edytora, w którym:

1. ustawiam **rozmiar karty**: gotowy format albo własny w mm, orientacja, zaokrąglenie rogów, kolor karty;
2. układam **pola w wierszach i kolumnach** (zagnieżdżanie, odstępy);
3. dla każdego pola ustawiam **typ, nazwę, czy pokazać etykietę, szerokość i wysokość** (oraz styl);
4. z gotowego szablonu robię **karty na kartce A4**: klik w slot → nowa karta, panel pól, duplikowanie, przeciąganie, PDF – ten sam edytor kartki co w Mausritterze.

**Kryterium ukończenia:** w samej aplikacji, bez edycji plików, da się zbudować od zera trzy przykłady. To **przypadki testowe edytora, a nie gotowe pakiety** – nie trafiają do aplikacji jako szablony do wyboru. Każdy przykład ma test e2e, który buduje go wyłącznie klikaniem i wpisywaniem w UI, robi z niego 2–3 karty na kartce i porównuje wynik ze wzorcem SVG.

| Przykład                              | Co musi się dać zbudować                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. Karta czaru (styl D&D)**         | Karta 63×88 w kolorze (np. czerwona), zaokrąglone rogi. Tytuł na tle karty. Biały panel z siatką 2×2 komórek „etykieta nad wartością” (czas rzucania, zasięg, komponenty, czas trwania). Duży biały panel z opisem (akapity, **pogrubienia**, auto-dopasowanie rozmiaru). Stopka na tle karty: dwa pola – klasa z lewej, szkoła z prawej. |
| **B. Blok statystyk (Warhammer)**     | Karta np. 88×63 poziomo albo własny rozmiar. Tytuł kapitalikami. Tabela cech: wiersz nagłówków (Sz, WW, Us, S, Wt, I, Zw, Zr, Int, SW, Ogd, Żyw) i wiersz wartości z danych karty, linie siatki. Separator. Akapity z pogrubionymi etykietami w linii („**Umiejętności:** …”) i _**pogrubioną kursywą**_, wyjustowane.                    |
| **C. Karta wroga (Jedyny Pierścień)** | Zagnieżdżony nagłówek: wiersz [kolumna (nazwa, cechy kursywą) + wartość w rombie]. Rząd 4–5 wartości w rombach z etykietą nad (np. POZIOM, WYTRZYMAŁOŚĆ, …) o wspólnym stylu. Niżej pola z pogrubioną etykietą w linii; puste pola zwijają się bez dziur.                                                                                 |

Poza kryterium (świadomie): styl szkicowy rombów, pergamin z postrzępioną krawędzią, kolory zależne od klasy czaru, kontynuacja długiego czaru na kolejnej karcie – patrz sekcja 6 „Później”. Przykłady mają mieć właściwą **strukturę i typografię**; ozdobniki dojdą w kolejnych etapach.

## 2. Przepływ

```
Start ─► „Stwórz własne karty”
          │
          ▼
 1. Nowy szablon: nazwa + rozmiar karty
    [Poker 63×88] [Bridge 57×89] [Mini Euro 44×68] [Mini American 41×63] [Tarot 70×120] [Kwadrat 70×70] [Własny…]
    orientacja ▢ pionowa ▭ pozioma · rogi 3 mm · kolor karty ■
    (opcjonalnie „Zacznij od układu”: pusty / tytuł + opis / tytuł + 2×2 + opis + stopka)
          │
          ▼
 2. Edytor szablonu (pełny ekran)
    ┌───────────────┬──────────────────────────┬────────────────────┐
    │ Struktura     │      Podgląd karty       │ Właściwości        │
    │ ▾ Karta       │   ┌──────────────────┐   │ Pole: „Zasięg”     │
    │  ▾ Kolumna    │   │ KULA OGNIA       │   │ Typ  [Tekst ▾]     │
    │    Tytuł      │   │ ┌──────┬───────┐ │   │ Nazwa [zasieg]     │
    │   ▾ Panel 2×2 │   │ │CZAS  │ZASIĘG │ │   │ ☑ Etykieta  nad ▾  │
    │     ▾ Wiersz  │   │ │1 akc.│[45 m] │ │   │ Szer. [wypełnij ▾] │
    │       Czas    │   │ ├──────┼───────┤ │   │ Wys.  [auto ▾]     │
    │       Zasięg◄ │   │ │…     │…      │ │   │ Czcionka, rozmiar, │
    │   Opis        │   │ └──────┴───────┘ │   │ wyrównanie, kolor… │
    │   ▾ Stopka    │   │ opis …           │   │ Tło, ramka, rogi,  │
    │  [+ Pole ▾]   │   └──────────────────┘   │ marginesy…         │
    └───────────────┴──────────────────────────┴────────────────────┘
    Pasek: nazwa szablonu · Cofnij/Ponów · Dane przykładowe · „Rób karty ►”
          │
          ▼
 3. Kartka A4 (istniejący edytor kartki): siatka = rozmiar karty,
    klik w slot → menu z szablonami projektu, panel pól karty, Duplikuj ×N, PDF.
    Z kartki: „Edytuj szablon” wraca do kroku 2; zmiany od razu na wszystkich kartach.
```

Szczegóły:

- **Struktura** (lewa kolumna): drzewo wierszy, kolumn, warstw i pól. Klik zaznacza, przeciąganie i przyciski ↑/↓/„do kontenera” zmieniają kolejność i rodzica, Delete usuwa, Ctrl+D duplikuje, Ctrl+Z cofa. „+ Pole” dodaje w zaznaczonym kontenerze (albo obok zaznaczonego pola).
- **Podgląd** (środek): karta w dużej skali z danymi przykładowymi; klik w element zaznacza go w drzewie, obrys zaznaczenia i (opcjonalnie) przerywane obrysy wszystkich kontenerów. Shift+klik – wiele elementów naraz (wspólna edycja, jak na kartce).
- **Właściwości** (prawa kolumna): najpierw to, o co prosi kryterium – **typ, nazwa, etykieta (pokaż/ukryj, pozycja), szerokość, wysokość** – potem sekcje zwijane: tekst (czcionka, rozmiar w pt, wariant, kolor, wyrównanie, wielkie litery / kapitaliki, auto-dopasowanie), wygląd (tło, ramka, rogi), odstępy (margines, padding, odstęp między dziećmi), „gdy puste”.
- **Szerokość/wysokość** jako jeden przełącznik: `auto` (wg treści) · `wypełnij` (z wagą) · `mm` · `%` – to już jest `Rozmiar` w modelu.
- **Nazwa pola** to podpis dla użytkownika (np. „Czas rzucania”); klucz danych (`czas_rzucania`) tworzy się sam i nie zmienia przy zmianie nazwy, żeby nie gubić danych kart. Domyślnie etykieta = nazwa.
- **Dane przykładowe**: podgląd pokazuje wartości przykładowe szablonu (edytowalne w pasku), żeby od razu widzieć układ z treścią.
- **Typy kart na kartce** dla projektu bez pakietu biorą się z szablonów projektu (jeden szablon = jedna pozycja menu, rozmiar = rozmiar szablonu).

Makiety: `docs/obrazy/makieta-m2-1-rozmiar.png`, `makieta-m2-2-edytor.png`, `makieta-m2-3-kartka.png`.

## 3. Czego brakuje w obecnym silniku

Stan na dziś (`src/model/szablon.ts`, `src/silnik/*`, `src/druk/arkusz.ts`). ✓ jest, ◐ częściowo, ✗ brak.

### Model i silnik karty

| Potrzeba                                      | Stan | Uwagi / zmiana                                                                                                                                                                         |
| --------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rozmiar w mm, rogi, kolor karty               | ✓    | `RozmiarKarty { tryb: 'mm' }`, `promienRogow`, `tlo`. Brak listy gotowych formatów (dane w UI) i orientacji (= zamiana szer./wys.).                                                    |
| Wiersz / kolumna / warstwy, zagnieżdżanie     | ✓    | `Kontener`, rozmiary mm/%/auto/wypełnij, margines, padding, odstęp, rozkład.                                                                                                           |
| Panel (tło, rogi, margines)                   | ✓    | Każdy kontener ma `tlo`, `promien`, `margines`, `obramowanie` – białe panele na kolorowej karcie da się złożyć już dziś.                                                               |
| **Ramka całej karty**                         | ✗    | `Szablon` ma `tlo` i `promienRogow`, ale nie ma ramki. Dodać `Szablon.ramka { grubosc, kolor, styl, promien, odsuniecie }` – linia w zadanej odległości od krawędzi (0 = po krawędzi). |
| **Ramka pola / panelu**                       | ✓    | `obramowanie` (grubość mm, kolor, styl ciągła/przerywana/kropkowana, wybrane krawędzie) i `promien` są na każdym węźle – brakuje tylko UI (M2-4).                                      |
| Pole tekst z etykietą nad / przed             | ✓    | `PoleTekst.etykieta` z osobnym stylem. Komórka „etykieta + wartość” = tekst z etykietą `nad` (gotowy wzór w menu „+ Pole”, bez nowego typu).                                           |
| Auto-dopasowanie, zwijanie pustych            | ✓    | `minRozmiar`, `gdyPuste: 'ukryj'`.                                                                                                                                                     |
| Etykieta pod / z lewej / w środku             | ✗    | SPEC wymienia też `pod`, `lewo`, `srodek` – do V1 dochodzi `pod`; reszta później.                                                                                                      |
| **Wartość w rombie**                          | ✗    | `PoleWartosc.ksztalt` ma `prostokat`, `kolo`, `sciety`. Dodać `romb` (V1), potem `tarcza`, `szesciokat`, własny SVG.                                                                   |
| **Etykieta przy wartości w kształcie**        | ✗    | `PoleWartosc` nie ma etykiety; dodać `etykieta { tekst, pozycja: 'nad' \| 'pod', styl }` – „WYTRZYMAŁOŚĆ” nad rombem.                                                                  |
| **Formatowany tekst**                         | ✗    | Dziś tylko `\n` = akapit. Dodać parser znaczników: `**pogr.**`, `*kursywa*`, `***pogr. kursywa***` → fragmenty z wariantem czcionki (silnik tekstu już łamie wiele stylów w akapicie). |
| Wyjustowanie                                  | ✗    | `StylTekstu.wyrownanie` bez `justuj`; dodać rozciąganie odstępów między słowami (bez ostatniego wiersza akapitu).                                                                      |
| Wcięcie pierwszej linii, odstęp akapitów      | ✗    | Dodać `wciecie` i `odstepAkapitow` do stylu tekstu.                                                                                                                                    |
| Kapitaliki                                    | ✗    | Dodać `kapitaliki`: cecha OpenType `smcp`, gdy czcionka ją ma (fontkit), inaczej synteza (wielkie litery w ~75% rozmiaru).                                                             |
| **Tabela**                                    | ✗    | Nowy typ pola `tabela`: kolumny z szablonu (nagłówek, klucz danych, szerokość auto/mm), wiersz nagłówków + wiersz wartości, linie siatki, pogrubione nagłówki, wyrównanie.             |
| **Separator** (linia)                         | ◐    | Dziś tylko obramowanie z wybranymi krawędziami. Dodać pole `separator` (poziomy/pionowy, styl linii, grubość, kolor) – ozdobne motywy później.                                         |
| Wspólny styl kilku pól                        | ✗    | V1: wielozaznaczenie w edytorze i wspólna edycja + „Kopiuj styl / Wklej styl”. Nazwane grupy stylów (SPEC 4) później.                                                                  |
| Listy numerowane                              | ✗    | Później (z wcięciem wiszącym).                                                                                                                                                         |
| Styl szkicowy, postrzępiona krawędź, tekstura | ✗    | Później (biblioteka ozdobników).                                                                                                                                                       |
| Kolory zależne od danych                      | ✗    | Później.                                                                                                                                                                               |
| Kontynuacja tekstu na kolejnej karcie         | ✗    | Później (dziś: ostrzeżenie „tekst się nie mieści”).                                                                                                                                    |
| Tryb swobodny (położenie absolutne)           | ◐    | Kontener `warstwy` + wyrównanie/margines pozwala nałożyć element; prawdziwy tryb swobodny później.                                                                                     |

### Kartka, druk, dane

| Potrzeba                               | Stan | Uwagi / zmiana                                                                                                                                                                                                                  |
| -------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Karty w mm na kartce A4                | ✗    | `zbudujArkusz` przyjmuje tylko szablony w trybie slotów (karta mm = ostrzeżenie `karta-poza-siatka-slotow`). V1: kartka dla kart w mm używa **slotu = wymiar karty** (siatka np. 3×3 dla 63×88 na A4 pionowo), każda karta 1×1. |
| Orientacja strony na kartce            | ◐    | W modelu jest `orientacja`; dodać przełącznik w ustawieniach kartki i automatyczny wybór lepszej orientacji przy tworzeniu (więcej kart na stronie).                                                                            |
| Kilka rozmiarów kart na jednej kartce  | ✗    | V1: jedna kartka = jeden rozmiar karty (szablony o innym rozmiarze są w menu wyłączone z podpowiedzią „inny rozmiar – nowa kartka”). Mieszanie później.                                                                         |
| Odstęp między kartami                  | ✗    | Domyślnie 0 (wspólne linie cięcia jak w Mausritterze); opcja odstępu później (razem z trybem „drukarnia”).                                                                                                                      |
| Typy kart z szablonów projektu         | ✗    | Dziś menu typów pochodzi z pakietu gry. Dla projektu bez pakietu – z `projekt.szablony`.                                                                                                                                        |
| Panel pól karty                        | ✓    | `PanelKart` buduje pola z `kolumnySzablonu` – zadziała dla dowolnego szablonu (trzeba obsłużyć wartości tabeli: jedna kolumna danych na komórkę).                                                                               |
| Czcionki w projekcie bez pakietu       | ✗    | Domyślne role `tytul`/`tresc` = EB Garamond (4 warianty, OFL, już w `public/czcionki`); własne czcionki jak dziś w ustawieniach.                                                                                                |
| Schemat i migracja                     | ◐    | Nowe typy pól i właściwości są dodatkowe → `WERSJA_SCHEMATU` 3 z migracją tożsamościową; walidacja nowych pól w `dane/schemat.ts`.                                                                                              |
| Edytor szablonu (UI)                   | ✗    | Cały: kreator rozmiaru, drzewo, podgląd z zaznaczaniem, panel właściwości, operacje na drzewie z historią.                                                                                                                      |
| Eksport / import pojedynczego szablonu | ◐    | Logika jest (`eksportujSzablon`, `importujSzablon`, `dodajSzablon` w `src/dane/archiwum.ts`, z testami) – brakuje UI.                                                                                                           |
| Formaty papieru                        | ◐    | `PAPIERY` ma A4 i Letter. Dodać A5, zdjęcia 10×15 / 13×18 / 15×21 cm i własny rozmiar w mm.                                                                                                                                     |
| Odstępy między kartami, stała siatka   | ✗    | Siatka zawsze ciągła (wspólne linie cięcia), liczba kolumn/rzędów wynika z miejsca. Dodać odstęp X/Y i opcjonalnie stałą liczbę kolumn i rzędów (układ arkusza).                                                                |
| Kalibracja drukarki, wydruk testowy    | ✗    | Brak. Przesunięcie X/Y dokładane tylko w PDF.                                                                                                                                                                                   |
| Eksport do JPG/PNG                     | ✗    | Dziś tylko PDF. SVG kart ma tekst jako krzywe, więc rasteryzacja w przeglądarce (canvas) nie potrzebuje czcionek.                                                                                                               |

## 4. Etapy (każdy z testami, commit + push, na koniec przegląd, PR, scalenie)

| Etap     | Zakres                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M2-1** | **Silnik: brakujące klocki.** Ramka całej karty (`Szablon.ramka`); kształt `romb`; etykieta przy wartości (`nad`/`pod`); etykieta tekstu `pod`; parser formatowania (`**`, `*`, `***`); `justuj`; wcięcie i odstęp akapitów; kapitaliki (`smcp` lub synteza); pole `separator`; pole `tabela`. Schemat w wersji 3. Testy jednostkowe i wzorce SVG dla każdego klocka; PDF bez zmian w architekturze (wszystko to kontury i glify).                                                                                                                                                                                                                         |
| **M2-2** | **Projekt „własne karty” i kartka dla kart w mm.** Nowy rodzaj projektu bez pakietu (role czcionek EB Garamond), kartka ze slotem = wymiar karty i lepszą orientacją, przełącznik orientacji, menu typów z szablonów projektu, blokada innych rozmiarów na kartce. **Formaty papieru** (A4, Letter, A5, 10×15, 13×18, 15×21 cm, własny w mm; pion/poziom) w ustawieniach kartki. **Eksport i import pojedynczego szablonu** (UI do istniejących funkcji): w menu kartki „Szablony projektu” i na stronie „Stwórz własne karty” („Importuj szablon…”). Test: szablon zbudowany w kodzie testu → karty na kartce → PDF; eksport → import do nowego projektu. |
| **M2-3** | **Edytor szablonu – struktura.** Kreator (nazwa, format/własny, orientacja, rogi, kolor, układ startowy), ekran edytora z drzewem i podglądem, zaznaczanie w obu miejscach (także wiele), dodawanie pól i kontenerów, przenoszenie, duplikowanie, usuwanie, cofnij/ponów, dane przykładowe, „Rób karty ►” i „Edytuj szablon” z kartki.                                                                                                                                                                                                                                                                                                                     |
| **M2-4** | **Edytor szablonu – właściwości.** Typ (zmiana typu z zachowaniem nazwy i stylu, gdzie się da), nazwa i klucz, etykieta, szerokość/wysokość, styl tekstu, wygląd panelu, odstępy, „gdy puste”, ustawienia tabeli (kolumny), wartości w kształcie, separator; **ramki z linii** dla całej karty (w ustawieniach rozmiaru karty) i dla pola/panelu: grubość w mm, kolor, styl, zaokrąglenie; wspólna edycja wielu zaznaczonych; Kopiuj/Wklej styl. Dostępność z klawiatury jak na kartce.                                                                                                                                                                    |
| **M2-5** | **Trzy przykłady jako testy e2e + dopracowanie.** Testy A, B, C budujące szablony wyłącznie przez UI (pomocnicze funkcje w `testy/pomoc.ts`), karty na kartce, wzorce SVG, PDF. Poprawki UX wynikłe z budowania przykładów, README („Własne karty”), zrzuty, przegląd recenzenta, PR, scalenie, sprawdzenie wdrożenia.                                                                                                                                                                                                                                                                                                                                     |

| **M2-6** | **Druk poza A4: układy arkuszy, kalibracja, zdjęcia.** Edytor układu arkusza (sekcja 4a) z własnymi presetami, odstępy między kartami i stała siatka w silniku arkusza, kalibracja przesunięcia drukarki, wydruk testowy z obrysami, eksport kart do JPG/PNG 300 dpi (każda karta osobno w ZIP albo cała strona/odbitka). Działa też dla kartek Mausrittera. |

**Sposób pracy:** każdy etap M2-1…M2-6 to **osobny PR** od aktualnego `main`: testy (typecheck, lint, format, Vitest, e2e), przegląd recenzenta, poprawki, scalenie, sprawdzenie wdrożenia na Pages i krótka notka dla użytkownika „co sprawdzić na stronie”. Decyzje podjęte w trakcie bez konsultacji – sekcja 9.

Kolejność ma sens: M2-1 i M2-2 dają silnik i druk, które można przetestować bez UI; M2-3/M2-4 to UI na gotowym silniku; M2-5 domyka kryterium. M2-6 jest niezależny od edytora szablonu (działa na każdej kartce), więc idzie na końcu i nie opóźnia kryterium M2.

## 4a. Druk poza A4 – gdzie i jak

Cel: elastyczność na przyszłość, **bez presetów pod konkretne produkty** – gotowe są tylko standardowe formaty papieru; resztę użytkownik ustawia i zapisuje sam.

| Część                            | Gdzie               | Co                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| a) Format papieru                | **M2-2**            | A4, Letter, A5 (148×210), zdjęcia 10×15 (102×152), 13×18 (127×178), 15×21 (152×210) albo własny w mm; pion/poziom. W ustawieniach kartki, obok orientacji. Zwykła kartka liczy siatkę sama (ile kart się zmieści). **Formaty zdjęciowe: margines bezpieczeństwa 3 mm** (punkty foto przycinają brzegi o 1–3 mm) – domyślnie, do zmiany w ustawieniach kartki; strefa zaznaczona na podglądzie, ostrzeżenie, gdy karta w nią wchodzi. |
| e) Bez odstępów                  | **M2-2** (domyślne) | Zwykły papier: karty stykają się, wspólne linie cięcia – jak dziś.                                                                                                                                                                                                                                                                                                                                                                   |
| b) Edytor układu arkusza         | **M2-6**            | Dla gotowych arkuszy z perforowanymi kartami: papier, margines górny i lewy, liczba kolumn i rzędów, rozmiar karty, odstęp poziomy i pionowy; zapis jako własny preset.                                                                                                                                                                                                                                                              |
| c) Kalibracja + wydruk testowy   | **M2-6**            | Przesunięcie drukarki X/Y w mm (zapamiętane w tej przeglądarce) i PDF testowy z samymi obrysami kart.                                                                                                                                                                                                                                                                                                                                |
| d) Druk w punkcie fotograficznym | **M2-6**            | Eksport do JPG/PNG 300 dpi: każda karta osobno (ZIP) albo cała strona kartki – przy formacie 10×15 / 13×18 strona = gotowa odbitka z rozmieszczonymi kartami.                                                                                                                                                                                                                                                                        |

### Edytor układu arkusza (M2-6)

Makieta: `docs/obrazy/makieta-m2-4-uklad-arkusza.png`.

- **Wejście:** w ustawieniach kartki przełącznik „Układ: **automatyczny** (zwykły papier) / **własny układ arkusza**”. Wybór własnego otwiera edytor układu (pełny panel nad kartką) albo listę zapisanych układów.
- **Lewa strona – formularz:** papier (format lub własny) i orientacja; margines górny i lewy (mm, od krawędzi kartki do pierwszej karty); kolumny × rzędy; rozmiar karty (domyślnie z szablonu kartki); odstęp poziomy i pionowy między kartami. Pod spodem wynik: „9 kart na stronie · prawy margines 5,5 mm · dolny 17,0 mm” – albo czerwone ostrzeżenie, gdy siatka wychodzi poza papier.
- **Prawa strona – podgląd na żywo:** strona w skali z prostokątami kart i wymiarami (strzałki z liczbami przy marginesach i odstępach), kliknięcie wymiaru przenosi fokus do pola.
- **Presety:** „Zapisz jako mój układ…” (nazwa), lista „Moje układy” z Użyj / Zmień nazwę / Usuń. Presety są zapisane w tej przeglądarce (IndexedDB), a kartka, która go używa, ma kopię ustawień w projekcie – eksport projektu przenosi układ na inny komputer.
- **Kalibracja** (sekcja w tym samym panelu): przesunięcie X i Y w mm (+ w prawo / w dół), zapamiętane lokalnie dla przeglądarki (to cecha drukarki, nie projektu). Dotyczy tylko PDF, nie podglądu. Przycisk **„Wydruk testowy”**: PDF z samymi obrysami kart, numerami i krzyżykami na środkach, z uwzględnieniem kalibracji – drukuje się go na arkuszu z perforacją i sprawdza trafienie.
- **Na kartce** z własnym układem: siatka ma stałą liczbę kolumn i rzędów i odstępy; linie cięcia są wtedy osobne dla każdej karty (zwykle się ich nie drukuje – przełącznik „linie cięcia”); nożyczki i tytuł kartki domyślnie wyłączone (arkusz jest już pocięty).

### Eksport do obrazów (M2-6)

- Menu „Pobierz” obok „Pobierz PDF”: **PDF**, **Obrazy stron (JPG/PNG, 300 dpi)**, **Karty osobno (ZIP z JPG/PNG, 300 dpi)**.
- Rasteryzacja w przeglądarce z tego samego SVG co podgląd (tekst to krzywe, obrazy podmieniane na dane); JPG jakość 92%, PNG bezstratnie; nazwy plików z nazwy kartki i numeru.
- Formaty zdjęciowe mają domyślny margines bezpieczeństwa 3 mm (sekcja 4a, a); karta wchodząca w strefę przycięcia daje ostrzeżenie na kartce i przy eksporcie.

## 5. Pierwsza wersja (M2) – zakres

- Rozmiar: 6 formatów ze SPEC + własny w mm, orientacja, rogi, kolor karty.
- Kontenery: wiersz, kolumna, warstwy; jako panel (tło, rogi, margines, ramka linią).
- Pola: tekst (z etykietą nad/przed/pod), „etykieta + wartość” (wzór), wartość w kształcie (prostokąt, koło, ścięty, **romb**, z etykietą), obraz, znaczniki, pole do wpisania, ikona, **separator**, **tabela**.
- Tekst: czcionka (role i wgrane), rozmiar w pt, wariant, kolor, wyrównanie z **wyjustowaniem**, wielkie litery, **kapitaliki**, odstęp liter, interlinia, **wcięcie i odstęp akapitów**, auto-dopasowanie, **formatowanie `**`/`*`/`***`** w danych.
- Edycja: drzewo + podgląd z zaznaczaniem, wiele zaznaczonych, cofnij/ponów, Kopiuj/Wklej styl, dane przykładowe.
- Ramki z linii: dla całej karty i dla pola/panelu (grubość, kolor, styl, zaokrąglenie).
- Eksport/import pojedynczego szablonu.
- Druk: formaty papieru (A4, Letter, A5, 10×15, 13×18, 15×21, własny), edytor układu arkusza z presetami, kalibracja i wydruk testowy, eksport do JPG/PNG 300 dpi.
- Kartka: karty w mm (slot = karta), orientacja, menu z szablonów projektu, wszystko z obecnego edytora kartki (duplikuj ×N, przeciąganie, strony, PDF, eksport projektu).

## 6. Później

| Kiedy                 | Co                                                                                                                                                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2b (zaraz po M2)     | Podkład ze wzoru w tle (zdjęcie karty pod podglądem, niedrukowane – SPEC 6.2); tryb swobodny (przeciąganie pola na dowolną pozycję); mieszane rozmiary kart na jednej kartce; globalna biblioteka szablonów (między projektami). |
| Biblioteka ozdobników | Linie podwójne, motywy powtarzalne wzdłuż krawędzi, narożniki, ramki 9-slice, separatory ozdobne, zestawy stylów (SPEC 5); kształty tarcza, sześciokąt, własny SVG.                                                              |
| M3                    | Styl szkicowy, postrzępiona krawędź i tekstury (pergamin), kolory zależne od danych, kontynuacja długiego tekstu na kolejnej karcie, listy numerowane, nazwane grupy stylów, ikony `:kod:` w tekście, import CSV/XLSX.           |
| M4                    | Rewers, Google Fonts, tryb „drukarnia” (spad, znaczniki cięcia), druk dwustronny.                                                                                                                                                |

## 7. Decyzje (P1–P9 i U1–U6 zatwierdzone)

| #   | Sprawa                          | Propozycja                                                                                                                                                                                                                                                          |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Zakres kryterium                | Przykłady A–C w strukturze i typografii; **bez** stylu szkicowego, pergaminu, kolorów wg klasy i kontynuacji tekstu (M3). Część rzeczy ze SPEC-owego M3 (romb, formatowanie, tabela, justowanie, kapitaliki) przechodzi do M2, bo bez nich przykłady się nie złożą. |
| P2  | Sposób układania                | Drzewo + podgląd z klikaniem (wiersze/kolumny jak w SPEC 4). Tryb swobodny (przeciąganie w dowolne miejsce) w M2b.                                                                                                                                                  |
| P3  | Formatowanie tekstu             | Znaczniki w treści (`**`, `*`, `***`) + przyciski **B** / _I_ w polu, które je wstawiają. Bez edytora WYSIWYG.                                                                                                                                                      |
| P4  | Rozmiary kart i papier          | ~~Tylko A4~~ – zmienione: jedna kartka = jeden rozmiar karty; papier do wyboru (sekcja 4a), domyślnie A4 bez odstępów (wspólne linie cięcia), orientacja wybierana automatycznie. Gotowe arkusze z perforacją – własny układ arkusza (M2-6).                        |
| P5  | Gdzie żyją szablony             | W projekcie (jak dziś). Projekt „własne karty” może mieć wiele szablonów; pojedynczy szablon eksportuje się i importuje plikiem (M2-2); globalna biblioteka szablonów – M2b.                                                                                        |
| P6  | Nazwa vs klucz pola             | Użytkownik widzi tylko nazwę; klucz tworzony automatycznie przy dodaniu pola i stały.                                                                                                                                                                               |
| P7  | Wspólny styl                    | Wielozaznaczenie + Kopiuj/Wklej styl w M2; nazwane grupy stylów w M3.                                                                                                                                                                                               |
| P8  | Domyślna czcionka własnych kart | EB Garamond (już w aplikacji, OFL) w rolach `tytul` i `tresc`; własne czcionki przez ustawienia.                                                                                                                                                                    |
| P9  | Układ startowy w kreatorze      | Trzy neutralne układy (pusty; tytuł + opis; tytuł + siatka 2×2 + opis + stopka) – to ogólne punkty startu, nie szablony konkretnych gier.                                                                                                                           |

Uzupełnienia (zatwierdzone):

| #   | Sprawa                             | Propozycja                                                                                                                                                                                                          |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1  | Gdzie druk poza A4                 | Formaty papieru w M2-2; edytor układu arkusza, kalibracja, wydruk testowy i eksport do obrazów jako osobny etap **M2-6** na końcu.                                                                                  |
| U2  | Wymiary formatów zdjęciowych       | 10×15 = 102×152 mm, 13×18 = 127×178 mm, 15×21 = 152×210 mm (rozmiary odbitek w punktach foto). Domyślny margines bezpieczeństwa 3 mm (do zmiany w ustawieniach kartki), ostrzeżenie, gdy karta wchodzi w tę strefę. |
| U3  | Presety układów                    | Zapisane w przeglądarce (jak projekty), kopia ustawień w projekcie; bez gotowych presetów pod konkretne produkty.                                                                                                   |
| U4  | Kalibracja                         | Jedna na przeglądarkę (cecha drukarki), tylko w PDF i wydruku testowym, nie w podglądzie ani w obrazach.                                                                                                            |
| U5  | Rozmiar karty ≠ rozmiar w układzie | Karty nie są skalowane: kartka pokazuje ostrzeżenie „karta X ma inny rozmiar niż w układzie arkusza” (różnica > 0,5 mm), a druk idzie według szablonu, wyśrodkowany w polu układu.                                  |
| U6  | Ramka karty                        | Linia z odsunięciem od krawędzi (0 = po krawędzi), style ciągła / przerywana / kropkowana; podwójna i ozdobne – etap ozdobników.                                                                                    |

## 8. Ryzyka

- **Złożoność edytora drzewa** – największa część pracy. Ograniczenie: najpierw drzewo i panel (pewne, dostępne z klawiatury), przeciąganie w podglądzie tylko jako dodatek.
- **Justowanie i kapitaliki w PDF** – tekst jest konturami, więc oba to tylko inne położenie i wybór glifów; ryzyko w czcionkach bez `smcp` (synteza).
- **Tabela a auto-dopasowanie** – szerokości kolumn „auto” liczone z najszerszej komórki; przy braku miejsca zmniejszanie czcionki całej tabeli do `minRozmiar` i ostrzeżenie.
- **Zmiana szablonu przy istniejących kartach** – usunięcie pola nie kasuje danych kart (zostają w `dane`), więc cofnięcie przywraca treść; zmiana rozmiaru karty przelicza kartkę i karty, które się nie mieszczą, są odkładane jak w normalizacji (ostrzeżenie).
- **Dokładność druku na perforację** – drukarki domowe mają tolerancję ~1 mm i często skalują PDF („dopasuj do strony”). Wydruk testowy i komunikat „drukuj w skali 100%” przy pobieraniu PDF z własnym układem.

## 9. Decyzje podjęte bez konsultacji

Rozstrzygnięcia przyjęte w trakcie M2, których plan nie przesądzał. Każde da się łatwo zmienić.

| #   | Etap | Sprawa                                                               | Decyzja                                                                                                                                                                                                                                                                                                                                |
| --- | ---- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | M2-1 | Formatowanie `**`/`*`/`***`                                          | Domyślnie włączone w polach tekstowych (dane i tekst stały); `formatowanie: false` wyłącza. Znacznik otwierający musi stać tuż przed tekstem, a zamykający tuż po nim (jak w Markdown – `5 * 3 * 2` zostaje zwykłym tekstem); znacznik bez pary i `\*` też. Wariant łączy się ze stylem (pogrubienie w kursywie = pogrubiona kursywa). |
| B2  | M2-1 | Kapitaliki                                                           | Cecha `smcp`, gdy czcionka ją ma; dołączone EB Garamond jej nie ma, więc synteza: małe litery jako wersaliki w 75% rozmiaru.                                                                                                                                                                                                           |
| B3  | M2-1 | Wcięcie i odstęp akapitów                                            | Wcięcie dla każdego akapitu (także pierwszego); akapit z samą etykietą (np. „nad”) bez wcięcia i odstępu. Odstęp tylko między akapitami. Justowanie pomija ostatni wiersz akapitu.                                                                                                                                                     |
| B4  | M2-1 | Romb                                                                 | Treść w prostokącie o połowie przekątnych rombu; rozmiar „wg treści” = 2× tekst, więc zwykle ustawia się stałą szerokość. Etykieta nad/pod: tło i ramka tylko na kształcie, odstęp 0,5 mm.                                                                                                                                             |
| B5  | M2-1 | Tabela                                                               | Jeden wiersz wartości; każda komórka to osobne pole danych (nazwa = nagłówek). Nagłówki domyślnie pogrubione, tekst wyśrodkowany. Tabela wypełnia szerokość pola: wolne miejsce dostają kolumny „wypełnij”, a bez nich – kolumny „auto” po równo. Za szeroka – cała tabela zmniejszana do `minRozmiar`, potem ostrzeżenie.             |
| B6  | M2-1 | Ramka karty                                                          | Prostokąt z obrysem w odległości `odsuniecie` od krawędzi; rogi = promień karty − odsunięcie (chyba że podano własny); rysowana na wierzchu.                                                                                                                                                                                           |
| B7  | M2-1 | Separator                                                            | Linia przez środek pola na całą dostępną długość (poziomy: szerokość, pionowy: wysokość); styl linii jak obramowania.                                                                                                                                                                                                                  |
| B8  | M2-1 | Brakujący wariant czcionki (np. `**…**`, a czcionka bez pogrubienia) | Używany najbliższy wariant jak dotąd, ale teraz z ostrzeżeniem w edytorze kartki („Czcionka … nie ma wariantu …”).                                                                                                                                                                                                                     |
| B9  | M2-1 | Pusta tabela, etykieta przy kształcie                                | Tabela z pustymi wartościami i „pokaż ramkę” rysuje nagłówki i siatkę do wypełnienia. Etykieta nad/pod kształtem zmniejsza się do `minRozmiar`, potem ostrzeżenie; treść rombu odsunięta od obrysu o jego grubość.                                                                                                                     |
| B10 | M2-2 | Jak powstaje projekt własnych kart przed edytorem szablonu           | Strona „Stwórz własne karty” ma „Importuj szablon…” – powstaje projekt z tym szablonem i pustą kartką dopasowaną do rozmiaru karty. Pusty projekt bez szablonu nie ma sensu, dopóki nie ma edytora (M2-3).                                                                                                                             |
| B11 | M2-2 | Nowa kartka własnych kart                                            | Bez tytułu i nożyczek, linie cięcia, marginesy 10 mm (zdjęcia: 3 mm), orientacja z większą liczbą kart. Import szablonu innego rozmiaru sam dokłada dla niego kartkę; „＋ Kartka” przy szablonie w ustawieniach robi to ręcznie. Domyślne czcionki: EB Garamond (tytuł i treść).                                                       |
| B12 | M2-2 | Karta w mm na kartce                                                 | Zawsze jeden slot (slot kartki = wymiar karty). Karta innego rozmiaru (> 0,5 mm różnicy) daje ostrzeżenie zbiorcze nad kartką; w menu typów taki szablon jest wyłączony z podpowiedzią.                                                                                                                                                |
| B13 | M2-2 | Papier zdjęciowy                                                     | Wybór formatu zdjęciowego ustawia strefę bezpieczeństwa 3 mm i marginesy 3 mm (mały papier); powrót na zwykły papier wyłącza strefę. Strefa zacieniona na kartce (nie w druku), karta w strefie – ostrzeżenie zbiorcze.                                                                                                                |
| B14 | M2-2 | Papier w ustawieniach                                                | Lista wyboru (A4, Letter, A5, zdjęcia 10×15 / 13×18 / 15×21, własny) z wymiarami, osobny przełącznik orientacji (dotąd zawsze poziomo), pola mm dla własnego. Zmiana, po której karty się nie mieszczą, jest odrzucana jak dotąd. Schemat w wersji 4.                                                                                  |
| B15 | M2-2 | Eksport / import szablonu                                            | Sekcja „Szablony projektu” w ustawieniach kartki projektów bez gry (eksport, import, nowa kartka dla szablonu). W projektach Mausrittera sekcji nie ma – tam szablony są z pakietu.                                                                                                                                                    |
