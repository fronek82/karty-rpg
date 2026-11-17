# Plan M2 – edytor kart od zera

Kamień milowy M2 ze `SPEC.md` (sekcje 3–6 i 12), zawężony do tego, co jest potrzebne, żeby użytkownik sam zbudował od zera szablon karty i robił z niego karty na kartce A4 – tak jak dziś w Mausritterze.

**Status: projekt planu – czeka na akceptację. Kodu jeszcze nie ma.**

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

| Potrzeba                              | Stan | Uwagi / zmiana                                                                                                                                                                                                                  |
| ------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Karty w mm na kartce A4               | ✗    | `zbudujArkusz` przyjmuje tylko szablony w trybie slotów (karta mm = ostrzeżenie `karta-poza-siatka-slotow`). V1: kartka dla kart w mm używa **slotu = wymiar karty** (siatka np. 3×3 dla 63×88 na A4 pionowo), każda karta 1×1. |
| Orientacja strony na kartce           | ◐    | W modelu jest `orientacja`; dodać przełącznik w ustawieniach kartki i automatyczny wybór lepszej orientacji przy tworzeniu (więcej kart na stronie).                                                                            |
| Kilka rozmiarów kart na jednej kartce | ✗    | V1: jedna kartka = jeden rozmiar karty (szablony o innym rozmiarze są w menu wyłączone z podpowiedzią „inny rozmiar – nowa kartka”). Mieszanie później.                                                                         |
| Odstęp między kartami                 | ✗    | Domyślnie 0 (wspólne linie cięcia jak w Mausritterze); opcja odstępu później (razem z trybem „drukarnia”).                                                                                                                      |
| Typy kart z szablonów projektu        | ✗    | Dziś menu typów pochodzi z pakietu gry. Dla projektu bez pakietu – z `projekt.szablony`.                                                                                                                                        |
| Panel pól karty                       | ✓    | `PanelKart` buduje pola z `kolumnySzablonu` – zadziała dla dowolnego szablonu (trzeba obsłużyć wartości tabeli: jedna kolumna danych na komórkę).                                                                               |
| Czcionki w projekcie bez pakietu      | ✗    | Domyślne role `tytul`/`tresc` = EB Garamond (4 warianty, OFL, już w `public/czcionki`); własne czcionki jak dziś w ustawieniach.                                                                                                |
| Schemat i migracja                    | ◐    | Nowe typy pól i właściwości są dodatkowe → `WERSJA_SCHEMATU` 3 z migracją tożsamościową; walidacja nowych pól w `dane/schemat.ts`.                                                                                              |
| Edytor szablonu (UI)                  | ✗    | Cały: kreator rozmiaru, drzewo, podgląd z zaznaczaniem, panel właściwości, operacje na drzewie z historią.                                                                                                                      |
| Eksport pojedynczego szablonu         | ✗    | Później (SPEC 2) – projekt eksportuje się jak dziś.                                                                                                                                                                             |

## 4. Etapy (każdy z testami, commit + push, na koniec przegląd, PR, scalenie)

| Etap     | Zakres                                                                                                                                                                                                                                                                                                                                                                                        |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **M2-1** | **Silnik: brakujące klocki.** Kształt `romb`; etykieta przy wartości (`nad`/`pod`); etykieta tekstu `pod`; parser formatowania (`**`, `*`, `***`); `justuj`; wcięcie i odstęp akapitów; kapitaliki (`smcp` lub synteza); pole `separator`; pole `tabela`. Schemat w wersji 3. Testy jednostkowe i wzorce SVG dla każdego klocka; PDF bez zmian w architekturze (wszystko to kontury i glify). |
| **M2-2** | **Projekt „własne karty” i kartka dla kart w mm.** Nowy rodzaj projektu bez pakietu (role czcionek EB Garamond), kartka ze slotem = wymiar karty i lepszą orientacją, przełącznik orientacji, menu typów z szablonów projektu, blokada innych rozmiarów na kartce. Test: szablon zbudowany w kodzie testu → karty na kartce → PDF.                                                            |
| **M2-3** | **Edytor szablonu – struktura.** Kreator (nazwa, format/własny, orientacja, rogi, kolor, układ startowy), ekran edytora z drzewem i podglądem, zaznaczanie w obu miejscach (także wiele), dodawanie pól i kontenerów, przenoszenie, duplikowanie, usuwanie, cofnij/ponów, dane przykładowe, „Rób karty ►” i „Edytuj szablon” z kartki.                                                        |
| **M2-4** | **Edytor szablonu – właściwości.** Typ (zmiana typu z zachowaniem nazwy i stylu, gdzie się da), nazwa i klucz, etykieta, szerokość/wysokość, styl tekstu, wygląd panelu, odstępy, „gdy puste”, ustawienia tabeli (kolumny), wartości w kształcie, separator; wspólna edycja wielu zaznaczonych; Kopiuj/Wklej styl. Dostępność z klawiatury jak na kartce.                                     |
| **M2-5** | **Trzy przykłady jako testy e2e + dopracowanie.** Testy A, B, C budujące szablony wyłącznie przez UI (pomocnicze funkcje w `testy/pomoc.ts`), karty na kartce, wzorce SVG, PDF. Poprawki UX wynikłe z budowania przykładów, README („Własne karty”), zrzuty, przegląd recenzenta, PR, scalenie, sprawdzenie wdrożenia.                                                                        |

Kolejność ma sens: M2-1 i M2-2 dają silnik i druk, które można przetestować bez UI; M2-3/M2-4 to UI na gotowym silniku; M2-5 domyka kryterium.

## 5. Pierwsza wersja (M2) – zakres

- Rozmiar: 6 formatów ze SPEC + własny w mm, orientacja, rogi, kolor karty.
- Kontenery: wiersz, kolumna, warstwy; jako panel (tło, rogi, margines, ramka linią).
- Pola: tekst (z etykietą nad/przed/pod), „etykieta + wartość” (wzór), wartość w kształcie (prostokąt, koło, ścięty, **romb**, z etykietą), obraz, znaczniki, pole do wpisania, ikona, **separator**, **tabela**.
- Tekst: czcionka (role i wgrane), rozmiar w pt, wariant, kolor, wyrównanie z **wyjustowaniem**, wielkie litery, **kapitaliki**, odstęp liter, interlinia, **wcięcie i odstęp akapitów**, auto-dopasowanie, **formatowanie `**`/`*`/`***`** w danych.
- Edycja: drzewo + podgląd z zaznaczaniem, wiele zaznaczonych, cofnij/ponów, Kopiuj/Wklej styl, dane przykładowe.
- Kartka: karty w mm (slot = karta), orientacja, menu z szablonów projektu, wszystko z obecnego edytora kartki (duplikuj ×N, przeciąganie, strony, PDF, eksport projektu).

## 6. Później

| Kiedy                 | Co                                                                                                                                                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M2b (zaraz po M2)     | Podkład ze wzoru w tle (zdjęcie karty pod podglądem, niedrukowane – SPEC 6.2); tryb swobodny (przeciąganie pola na dowolną pozycję); eksport/import pojedynczego szablonu; mieszane rozmiary kart na jednej kartce.    |
| Biblioteka ozdobników | Linie podwójne, motywy powtarzalne wzdłuż krawędzi, narożniki, ramki 9-slice, separatory ozdobne, zestawy stylów (SPEC 5); kształty tarcza, sześciokąt, własny SVG.                                                    |
| M3                    | Styl szkicowy, postrzępiona krawędź i tekstury (pergamin), kolory zależne od danych, kontynuacja długiego tekstu na kolejnej karcie, listy numerowane, nazwane grupy stylów, ikony `:kod:` w tekście, import CSV/XLSX. |
| M4                    | Rewers, Google Fonts, tryb „drukarnia” (spad, znaczniki cięcia, odstępy między kartami), druk dwustronny.                                                                                                              |

## 7. Decyzje do zatwierdzenia

| #   | Sprawa                          | Propozycja                                                                                                                                                                                                                                                          |
| --- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Zakres kryterium                | Przykłady A–C w strukturze i typografii; **bez** stylu szkicowego, pergaminu, kolorów wg klasy i kontynuacji tekstu (M3). Część rzeczy ze SPEC-owego M3 (romb, formatowanie, tabela, justowanie, kapitaliki) przechodzi do M2, bo bez nich przykłady się nie złożą. |
| P2  | Sposób układania                | Drzewo + podgląd z klikaniem (wiersze/kolumny jak w SPEC 4). Tryb swobodny (przeciąganie w dowolne miejsce) w M2b.                                                                                                                                                  |
| P3  | Formatowanie tekstu             | Znaczniki w treści (`**`, `*`, `***`) + przyciski **B** / _I_ w polu, które je wstawiają. Bez edytora WYSIWYG.                                                                                                                                                      |
| P4  | Rozmiary kart na kartce         | Jedna kartka = jeden rozmiar karty, slot = wymiar karty, bez odstępów (wspólne linie cięcia). Orientacja wybierana automatycznie (więcej kart), do zmiany w ustawieniach.                                                                                           |
| P5  | Gdzie żyją szablony             | W projekcie (jak dziś). Projekt „własne karty” może mieć wiele szablonów; globalna biblioteka szablonów i ich eksport – M2b.                                                                                                                                        |
| P6  | Nazwa vs klucz pola             | Użytkownik widzi tylko nazwę; klucz tworzony automatycznie przy dodaniu pola i stały.                                                                                                                                                                               |
| P7  | Wspólny styl                    | Wielozaznaczenie + Kopiuj/Wklej styl w M2; nazwane grupy stylów w M3.                                                                                                                                                                                               |
| P8  | Domyślna czcionka własnych kart | EB Garamond (już w aplikacji, OFL) w rolach `tytul` i `tresc`; własne czcionki przez ustawienia.                                                                                                                                                                    |
| P9  | Układ startowy w kreatorze      | Trzy neutralne układy (pusty; tytuł + opis; tytuł + siatka 2×2 + opis + stopka) – to ogólne punkty startu, nie szablony konkretnych gier.                                                                                                                           |

## 8. Ryzyka

- **Złożoność edytora drzewa** – największa część pracy. Ograniczenie: najpierw drzewo i panel (pewne, dostępne z klawiatury), przeciąganie w podglądzie tylko jako dodatek.
- **Justowanie i kapitaliki w PDF** – tekst jest konturami, więc oba to tylko inne położenie i wybór glifów; ryzyko w czcionkach bez `smcp` (synteza).
- **Tabela a auto-dopasowanie** – szerokości kolumn „auto” liczone z najszerszej komórki; przy braku miejsca zmniejszanie czcionki całej tabeli do `minRozmiar` i ostrzeżenie.
- **Zmiana szablonu przy istniejących kartach** – usunięcie pola nie kasuje danych kart (zostają w `dane`), więc cofnięcie przywraca treść; zmiana rozmiaru karty przelicza kartkę i karty, które się nie mieszczą, są odkładane jak w normalizacji (ostrzeżenie).
