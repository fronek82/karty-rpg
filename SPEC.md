# Karty RPG – specyfikacja projektu

Aplikacja przeglądarkowa do projektowania i drukowania kart do gier RPG i planszowych: karty czarów, broni, ekwipunku, stanów, wrogów i dowolne inne. Użytkownik buduje własne szablony, wypełnia je danymi i drukuje gotowe arkusze PDF.

---

## 1. Założenia

- **Aplikacja webowa działająca w całości w przeglądarce.** Bez backendu, bez logowania. Docelowo hostowana na GitHub Pages.
- **Dane lokalnie u użytkownika** (IndexedDB) oraz eksport/import do pliku, żeby można było przenosić projekty między komputerami i udostępniać szablony.
- **Jedno źródło renderowania:** karta renderuje się jako SVG. Ten sam SVG służy do podglądu w edytorze i do generowania PDF, żeby to, co widać, było dokładnie tym, co się drukuje.
- **Wszystkie wymiary wewnętrznie w milimetrach.** Pozycje w szablonie mogą być w procentach, żeby szablon skalował się do innego rozmiaru karty.
- **Interfejs po polsku**, ale z teksty wydzielone tak, żeby dało się dodać inne języki.
- Musi działać na macOS i Windows (Chrome, Safari, Firefox, Edge).

### Stos (potwierdzony w fazie planowania M1)
- Vite + TypeScript + React
- Renderowanie kart: SVG generowany z modelu danych (przez wspólną „scenę” – listę elementów w mm)
- Tekst: **fontkit 2** – kształtowanie tekstu (ligatury, kerning, glify złożone) i kontury glifów; obsługa TTF, OTF/CFF, WOFF, WOFF2
- PDF: **pdf-lib** – rysowanie sceny, tekst jako krzywe (sekcja 8); bez jsPDF, svg2pdf.js i opentype.js (uzasadnienie: `docs/decyzja-pdf.md`)
- Przechowywanie: IndexedDB (np. Dexie)
- Import arkuszy: CSV oraz XLSX (SheetJS)
- Testy: Vitest (logika) + Playwright (testy wizualne – porównywanie wyrenderowanych arkuszy ze wzorcami)

---

## 2. Model danych

```
Projekt
 ├─ Biblioteka (czcionki, obrazy, ramki, motywy wzorów, zestawy stylów)
 ├─ Szablony kart (układ + style)
 ├─ Talie (zbiór kart opartych na szablonach + rewers)
 │    └─ Karty (dane wypełniające pola szablonu + liczba sztuk)
 └─ Arkusze do druku (rozmieszczenie kart na papierze)
```

Projekt eksportuje się do jednego pliku (np. `.kartyrpg` = ZIP z JSON-em i zasobami). Pojedynczy szablon również eksportuje się osobno (JSON + użyte zasoby).

---

## 3. Rozmiar karty

- **Gotowe formaty:** Standard/Poker 63×88 mm, Bridge 57×89 mm, Mini Euro 44×68 mm, Mini American 41×63 mm, Tarot 70×120 mm, kwadrat 70×70 mm.
- **Własny rozmiar** w mm.
- **Orientacja** pionowa/pozioma.
- **Zaokrąglenie rogów** (promień w mm).
- **Tryb siatki slotów:** definiuje się rozmiar jednego slotu (np. ok. 26×26 mm dla Mausrittera), a karta ma wymiar w slotach: 1×1, 2×1, 1×2, 2×2 itd. Potrzebne do kart ekwipunku Mausrittera.

---

## 4. Szablon karty – układ

Układ to **drzewo kontenerów**:
- **Wiersz** – dzieci obok siebie.
- **Kolumna** – dzieci jedno pod drugim.
- Kontenery można zagnieżdżać (np. wiersz: [kolumna(nazwa, cechy)] + [duża statystyka]).
- Rozmiar każdego elementu: mm, %, „auto” (dopasuj do treści) lub „wypełnij resztę” z wagą.
- Odstępy (padding, gap) w mm.
- Opcjonalnie: tryb swobodny – pole przeciągane myszą na dowolną pozycję (absolutne położenie).

### Typy pól
| Typ | Opis |
|---|---|
| **Tekst** | Tekst z formatowaniem (patrz niżej). Jedno- lub wielolinijkowy. |
| **Wartość w kształcie** | Liczba lub krótki tekst (np. `8`, `—`, `+2`, `k6/k8`) w kształcie: romb, koło, kwadrat, zaokrąglony prostokąt, tarcza, sześciokąt, własna grafika SVG. |
| **Obraz** | Ilustracja z pliku; dopasowanie: wypełnij/dopasuj/rozciągnij, pozycja kadru. |
| **Znaczniki użycia** | N kółek/kwadratów do zamalowania, w M rzędach, z rozmiarem i odstępem (Mausritter: 3 kółka; latarnia elektryczna: 2×3). |
| **Pole do wpisania** | Pusta ramka do pisania ołówkiem, z opcjonalnym stałym tekstem (np. `/ 250p`). |
| **Ikona/symbol** | Mała ikona lub znak (np. ★). |
| **Separator** | Ozdobna linia pozioma lub pionowa (patrz sekcja 5). |
| **Tabela** | Wiersz nagłówków + wiersz(e) wartości, kolumny zdefiniowane w szablonie, wartości z danych (np. statystyki Warhammera: Sz, WW, Us, S, Wt, I, Zw, Zr, Int, SW, Ogd, Żyw). Linie siatki, pogrubienie nagłówków, wyrównanie, szerokości kolumn auto/stałe. |
| **Komórka etykieta + wartość** | Etykieta nad wartością w jednej komórce (np. „CZAS RZUCANIA” / „1 akcja” na kartach czarów D&D); zwykle w siatce 2×2. |

### Panele i kolory karty
- Karta ma **kolor tła lub teksturę** (także na przodzie), wychodzące na spad.
- Każdy kontener może być **panelem**: własne tło (kolor/tekstura), zaokrąglenie rogów, margines zewnętrzny – tak, że między panelami prześwituje kolor karty (białe panele na czerwonej karcie czaru D&D).
- **Kolory zależne od danych:** kolor karty/paneli/etykiet może pochodzić z kolumny danych przez mapę (np. `klasa: Zaklinacz → czerwony`, `Kapłan → żółty`), żeby jeden szablon obsłużył całą talię czarów różnych klas.

### Właściwości pola
- Nazwa pola (klucz danych, np. `nazwa`, `obrazenia`).
- **Etykieta** (np. „WYTRZYMAŁOŚĆ”, „Usunięcie:”): pokaż/ukryj, pozycja: nad/pod/z lewej/w środku/przed tekstem w tej samej linii.
- Czcionka, rozmiar, kolor, grubość, kursywa, wielkie litery, odstęp liter.
- Wyrównanie: lewo/środek/prawo/wyjustowanie; wyrównanie pionowe.
- **Auto-dopasowanie tekstu:** zmniejszaj czcionkę do minimalnego rozmiaru, aż tekst się zmieści.
- **Przepełnienie:** gdy tekst nie mieści się nawet w minimalnym rozmiarze – opcja „kontynuuj na kolejnej karcie” (automatyczna karta dodatkowa z tym samym nagłówkiem i dopiskiem „ciąg dalszy”) albo ostrzeżenie w tabeli danych. Typowe dla długich czarów D&D.
- **Zachowanie gdy puste:** „ukryj i zwiń miejsce” (karty wrogów – brak dziur) albo „pokaż pustą ramkę” (puste karty Mausrittera do wypełniania ręcznie).
- Ramka pola (styl z biblioteki ramek, sekcja 5), tło, przezroczystość.

### Formatowany tekst
Prosty znacznik w danych:
- `**pogrubienie**`, `*kursywa*`
- pusty wiersz = nowy akapit; opcja wcięcia pierwszej linii akapitu
- `:star:` i inne kody → ikony z biblioteki
- `***pogrubiona kursywa***` (imiona postaci w opisach Warhammera)
- listy numerowane (`1.`, `2.` …) z wcięciem wiszącym
- kapitaliki (small caps) jako opcja stylu pola (tytuły bloków Warhammera)

### Grupy stylów
Kilka pól może dzielić jeden styl (np. 5 statystyk w rombach na karcie wroga). Zmiana stylu grupy zmienia wszystkie pola naraz.

---

## 5. Ramki, wzory i separatory

Wszystkie elementy ozdobne są wektorowe (SVG), kolorowalne i skalowalne.

### Rodzaje
1. **Linie:** ciągła, podwójna, przerywana, kropkowana; grubość w mm; kolor; zaokrąglenie rogów.
2. **Motywy powtarzalne:** mały kafelek SVG rozkładany automatycznie wzdłuż krawędzi, z równym rozłożeniem, tak żeby pasował do każdej długości. Startowa biblioteka: pnącze z liśćmi, celtycki przeplot, smocze łuski, pas run, łańcuch, gwiazdki. Motyw może mieć „szyny” (cienkie linie po obu stronach).
3. **Narożniki:** osobny element, odbijany lustrzanie na 4 rogi; można łączyć z dowolnym motywem lub linią.
4. **Ramki użytkownika:** wgrany SVG/PNG, skalowany metodą 9-slice (rogi bez zniekształceń, boki rozciągane lub powtarzane).
5. **Styl szkicowy:** opcja „chropowatości” dla linii i kształtów (efekt ręcznie rysowany, jak czerwone romby w kartach wrogów Jedynego Pierścienia).
6. **Postrzępiona krawędź:** nieregularny kształt krawędzi karty lub panelu (efekt podartego pergaminu, jak bloki statystyk Warhammera), z regulacją siły i ziarnistości; działa razem z teksturą tła.

### Zastosowanie
Ten sam element z biblioteki może być użyty jako:
- ramka całej karty,
- ramka pojedynczego pola/sekcji (zwykle w mniejszej skali),
- **separator** poziomy (między wierszami) lub pionowy (między polami w wierszu), z ozdobnymi zakończeniami.

Parametry: skala, kolor (jednolity), grubość, odstęp od krawędzi.

### Zestawy stylów
Gotowe komplety jednym kliknięciem, np. „Elficki” (pnącza + liście + gwiazdki), „Krasnoludzki” (runy + łańcuch + okucia).

---

## 6. Tworzenie szablonów

1. **Od zera** w edytorze (drzewo wierszy i kolumn + panel właściwości).
2. **Ze wzoru w tle:** użytkownik wgrywa zdjęcie/skan karty jako półprzezroczysty podkład i układa pola na nim. Podkład nie jest drukowany.
3. **Ze zdjęcia przez AI** (późniejszy etap): zdjęcie wysyłane do Claude API, model zwraca **wyłącznie układ** (pozycje i typy pól, proporcje, przybliżone rozmiary tekstu) – bez kopiowania grafiki. Klucz API podaje użytkownik i jest przechowywany tylko lokalnie.

Wszystkie trzy drogi dają ten sam format szablonu, który da się dalej edytować.

---

## 7. Rewers (tył karty)

Edytor warstw:
- **Tekstura z pliku** (JPG/PNG): wypełnij/dopasuj/rozciągnij/kafelki; przezroczystość; zabarwienie na kolor. Musi wychodzić na spad.
- **Napisy:** dowolna liczba, obrót o dowolny kąt, czcionka, kolor, obrys, opcjonalnie tekst po łuku.
- **Loga/grafiki:** PNG z przezroczystością lub SVG (SVG kolorowalne); pozycja, rozmiar, obrót, przezroczystość.
- **Ramki i wzory** z biblioteki (sekcja 5).
- Kolejność warstw, przyciąganie do środka i krawędzi.
- Rewers przypisywany do: talii, szablonu albo pojedynczej karty.

---

## 8. Czcionki

- Wgrywanie TTF, OTF, WOFF i WOFF2 (bez konwersji).
- Wybór z Google Fonts (np. Cinzel, MedievalSharp, Uncial Antiqua).
- **Tekst jako krzywe:** silnik kształtuje tekst (fontkit 2) i zamienia go na kontury glifów. Te same kontury trafiają do podglądu SVG i do PDF, więc podgląd = wydruk dla każdej czcionki. Pliki czcionek nie są osadzane w PDF.
  - Każdy użyty glif jest zapisany w PDF **raz** (XObject) i wstawiany wielokrotnie – PDF nie puchnie przy dużej ilości tekstu (pilnuje tego test rozmiaru pliku).
  - Tekstu w PDF nie da się zaznaczyć ani wyszukać. Później (M4) możliwa niewidoczna warstwa tekstu do wyszukiwania, bez wpływu na wygląd.
- Czcionki dostępne wszędzie: przód, rewers, tytuły arkuszy.
- Przy eksporcie szablonu do udostępnienia: ostrzeżenie o licencji czcionek spoza Google Fonts.

---

## 9. Dane kart

- Edycja kart w tabeli w aplikacji: wiersz = karta, kolumny = pola szablonu, plus kolumna **„Ilość”**.
- **Import CSV/XLSX** z mapowaniem kolumn na pola.
- Formatowanie tekstu w danych według znaczników z sekcji 4.
- Obrazy przypisywane do kart przez wybór pliku lub nazwę pliku w kolumnie.
- Możliwość dodania pustych kart (wszystkie pola puste – zachowanie wg ustawienia „gdy puste”).

---

## 10. Druk i eksport PDF

### Tryb „Druk w domu”
- Papier A4/Letter, pion/poziom, marginesy.
- **Automatyczne rozmieszczanie kart różnych rozmiarów** (1×1, 2×1, 1×2…) ciasno na arkuszu, z minimalnym marnowaniem papieru; możliwość ręcznej korekty.
- Uwzględnienie liczby sztuk każdej karty.
- **Linie cięcia** przerywane, wspólne dla sąsiednich kart; opcjonalna ikona nożyczek.
- **Tytuł arkusza**, również obrócony pionowo wzdłuż krawędzi (np. „Karty broni i pancerzy”).
- **Nagłówki grup** nad kolumnami kart, z opisem (jak na arkuszu stanów Mausrittera).
- Tryb czarno-biały / skala szarości.

### Tryb „Drukarnia”
- Spad (domyślnie 3 mm) i znaczniki cięcia.
- Siatka kart na arkuszu lub jedna karta na stronę.
- Ostrzeżenie o obrazach poniżej 300 DPI.

### Druk dwustronny
- Arkusz rewersów generowany w lustrzanej kolejności.
- Kalibracja przesunięcia (offset X/Y w mm) dla konkretnej drukarki.

### Podgląd
Podgląd arkusza przed pobraniem PDF, w skali.

---

## 11. Udostępnianie

- Eksport/import szablonów i całych projektów do pliku.
- Później: galeria gotowych szablonów w aplikacji.
- **Uwaga dot. repozytorium:** GitHub Pages dla prywatnego repozytorium wymaga płatnego planu GitHub. Przy darmowym publikowaniu repozytorium musi być publiczne.
- Wzory kart i grafiki użyte w gotowych pakietach pochodzą z materiałów udostępnionych dla społeczności RPG. Dla każdego pakietu prowadzić plik `LICENCJE.md` z informacją o źródle, autorze i licencji, a w aplikacji pokazywać atrybucję przy pakiecie, jeśli licencja jej wymaga.
- Folder `zasoby-prywatne/` (w `.gitignore`) na pliki robocze, które nie mają trafiać do repozytorium.

---

## 12. Kamienie milowe

### M1 – Mausritter na A4 (pierwszy cel)
Cel: aplikacja wiernie odtwarza trzy arkusze referencyjne: **„Karty broni i pancerzy”**, **„Karty niezbędnego wyposażenia”**, **„Karty stanów”** (pliki referencyjne leżą lokalnie w `zasoby-prywatne/referencje/` i nie trafiają do repozytorium; w repozytorium są tylko zmierzone wymiary – patrz `docs/plan-M1.md`).

Zakres:
- Silnik layoutu (wiersze/kolumny), renderowanie SVG.
- Tryb siatki slotów (rozmiar slotu zmierzyć z karty postaci Mausrittera, ok. 26 mm), karty 1×1, 2×1, 1×2.
- Typy pól: tekst, wartość w ramce, obraz, znaczniki użycia, pole do wpisania z sufiksem, ikona ★.
- Ustawienie „gdy puste: pokaż pustą ramkę”.
- Gotowe szablony Mausrittera: broń, zbroja (z „-1 obr”), przedmiot, sakiewka (`/ 250p`), zaklęcie (★), stan (tytuł, opis kursywą, „Usunięcie:” + wartość), pusta karta.
- Tabela danych z kolumną „Ilość”.
- Druk w domu: automatyczne rozmieszczanie mieszanych rozmiarów, przerywane linie cięcia, pionowy tytuł arkusza, nagłówki grup, PDF A4 poziomo.
- Wgrywanie własnej czcionki (do tytułów w stylu Mausrittera).
- Zapis projektu w IndexedDB + eksport/import pliku.
- Wdrożenie na GitHub Pages.

Kryterium ukończenia: wydrukowany PDF nakłada się na arkusze referencyjne (test wizualny w Playwright + sprawdzenie przez użytkownika na papierze).

### M2 – Pełny edytor szablonów i biblioteka ozdobników
- Edytor drzewa wierszy/kolumn z panelem właściwości, tryb swobodny.
- Gotowe rozmiary kart, zaokrąglenia.
- Biblioteka ramek, motywów, narożników i separatorów (sekcja 5), zestawy stylów.
- Podkład ze wzoru w tle.

### M3 – Karty wrogów (Jedyny Pierścień jako przypadek testowy)
- Wartości w kształtach (romby), grupy stylów, zagnieżdżony układ nagłówka.
- Formatowany tekst (pogrubione etykiety w linii, kursywa, akapity z wcięciem, wyjustowanie).
- Auto-dopasowanie tekstu, zwijanie pustych pól.
- Styl szkicowy linii i kształtów.
- Import CSV/XLSX.
- **Czary D&D:** kolorowa karta z białymi panelami, siatka 2×2 komórek etykieta/wartość, stopka z dwoma polami na tle karty (klasa z lewej, szkoła z prawej), listy numerowane, kolory zależne od klasy, kontynuacja długiego tekstu na kolejnej karcie.
- **Bloki statystyk Warhammera:** tytuł kapitalikami, pole tabeli ze statystykami, akapity z pogrubionymi etykietami i pogrubioną kursywą, tło z teksturą pergaminu i postrzępioną krawędzią.

### M4 – Rewers, czcionki, druk profesjonalny
- Edytor warstw rewersu (sekcja 7).
- Google Fonts.
- Tryb drukarnia: spad, znaczniki cięcia, ostrzeżenia DPI.
- Druk dwustronny z kalibracją.

### M5 – AI i udostępnianie
- Rozpoznawanie układu karty ze zdjęcia przez Claude API (klucz użytkownika).
- Galeria szablonów, eksport/import paczek.

---

## 13. Agenci (Claude Code)

Główny agent planuje i rozdziela pracę. Utworzyć w `.claude/agents/`:

| Agent | Zadanie |
|---|---|
| `silnik-layoutu` | Model danych szablonu, algorytm układu (wiersze/kolumny, rozmiary, auto-dopasowanie tekstu), renderowanie SVG. |
| `edytor-ui` | Interfejs: edytor szablonów, panel właściwości, tabela danych, edytor rewersu, podgląd. |
| `druk-pdf` | Rozmieszczanie kart na arkuszu, linie cięcia, spady, druk dwustronny, generowanie PDF (tekst jako krzywe, glify jako XObject wielokrotnego użytku). |
| `biblioteka-ozdobnikow` | Motywy SVG, narożniki, separatory, styl szkicowy, 9-slice, zestawy stylów. |
| `dane-import` | Przechowywanie (IndexedDB), import CSV/XLSX, eksport/import projektów i szablonów. |
| `tester` | Testy Vitest i Playwright, testy wizualne porównujące arkusze z referencjami. |
| `recenzent` | Przegląd kodu po każdym etapie (tylko odczyt): spójność, wydajność, czytelność. |

---

## 14. Zasady pracy

- Najpierw plan dla danego kamienia milowego, potem kod.
- Małe, częste commity z opisami po polsku; push na koniec każdej sesji.
- Każda nowa funkcja z testem; renderowanie kart z testem wizualnym.
- Wymiary zawsze w mm w modelu danych; konwersje tylko na granicy (ekran/PDF).
- Każdy dodany zasób zewnętrzny (grafika, czcionka, wzór karty) z wpisem w `LICENCJE.md` (patrz sekcja 11).
