# Plan M1 – Mausritter na A4

Kamień milowy M1 ze `SPEC.md` (sekcja 12). Dokument opisuje ustalenia, pomiary referencji, architekturę i etapy pracy.

## 1. Decyzje

| #   | Temat          | Decyzja                                                                                                                                                                                                                                                                                              |
| --- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Źródła         | Arkusze referencyjne to komercyjny PDF (sklep Stinger-Prest). **Nie używamy jego grafik ani tekstów.** Odtwarzamy tylko układ (szablony), żeby użytkownik tworzył własne karty. Przykładowe dane w pakiecie są nasze i ogólne, bez ilustracji z PDF.                                                 |
| 2   | Czcionki       | Domyślnie **EB Garamond** (zamiast Minion Pro) i **Grenze Gotisch** (zamiast Herb), obie na licencji OFL. Oryginały użytkownik wgrywa do `zasoby-prywatne/` i używa ich tylko w lokalnym teście nakładania.                                                                                          |
| 3   | Repozytorium   | Publiczne, wdrożenie na GitHub Pages.                                                                                                                                                                                                                                                                |
| 4   | Test zgodności | Porównanie z referencją na **zapisanym układzie ręcznym** (odtworzonym co do slotu). Rozmieszczanie automatyczne testujemy osobno (poprawność, brak nakładania, oszczędność papieru) i nie musi dać identycznego układu.                                                                             |
| 5   | PDF            | Po prototypie E1: **tekst jako krzywe** – fontkit 2 (kształtowanie, kontury) + pdf-lib (rysowanie). Każdy glif w PDF zapisany raz (XObject), test rozmiaru PDF. Szczegóły: `docs/decyzja-pdf.md`.                                                                                                    |
| 6   | Edycja w M1    | Tabela danych, wybór szablonu i rozmiaru karty, przypisanie czcionek do ról (tytuł, treść). Edycja stylu i układu dopiero w M2.                                                                                                                                                                      |
| 7   | Slot           | Domyślnie **25,75 mm** (73 pt). Referencja drukuje slot 25,725 mm (arkusz przeskalowany do 99,89%) – test nakładania skaluje ją o 0,11%. Użytkownik sprawdzi wydrukiem na karcie postaci.                                                                                                            |
| 8   | Arkusz         | Tytuł poziomy i pionowy (obrócony o 90°), nagłówki grup z opisem nad kolumnami.                                                                                                                                                                                                                      |
| 9   | Treść pakietu  | Wolno: nazwy przedmiotów, kości, klasy broni, ilości, nazwy stanów, ich skutki i warunki usunięcia (mechanika gry). Opisy grup stanów – własnymi słowami (PDF nie zawiera informacji o wolnej licencji). Zamiast ilustracji – neutralny obrazek zastępczy; ilustracje użytkownik wgrywa w aplikacji. |
| 10  | Napisy stałe   | „Usunięcie:”, „/ 250p”, „-1 obr” to **parametry szablonu** z wartością domyślną, nadpisywalne w danych karty.                                                                                                                                                                                        |
| 11  | Klasa broni    | Biała obwódka liter (czytelność na tle ilustracji).                                                                                                                                                                                                                                                  |
| 12  | Ilustracje     | Obraz nie nachodzi na znaczniki (poza zaklęciem) ani na ramkę wartości. Broń 1×1: obraz od wiersza znaczników do dolnej krawędzi, w największym wolnym prostokącie obok ramki (pole obrazu `omijaj`); klasa leży na obrazie. Lekka zbroja 2×1: obraz na całą wysokość pod paskiem tytułu.            |
| 13  | Kadr obrazu    | Ustawienia obrazu zapisane w karcie (`Karta.obrazy[idPola]`): skala, przesunięcie X/Y (mm), obrót (°), tryb dopasowania. Przekształcony obraz przycinany do ramki pola. Edycja myszą i polami liczbowymi w E7.                                                                                       |
| 14  | Nożyczki       | Na końcu przerywanej linii prowadzącej do krawędzi siatki (wzór jak linie cięcia), jak w oryginale.                                                                                                                                                                                                  |
| 15  | Tytuł arkusza  | Pionowy 36 pt; dłuższy tytuł automatycznie zmniejszany do długości boku siatki z miejscem na nożyczki – sięga prawie całej wysokości siatki jak w referencji.                                                                                                                                        |
| 16  | Opisy grup     | Co najmniej 2 mm od dołu liter opisu grupy do górnej linii cięcia kart (odstęp 2,5 mm od dołu wiersza).                                                                                                                                                                                              |

## 2. Pomiary referencji (`Mausritter_kartyekwipunku.pdf`)

Pliki referencyjne (PDF i zrzuty ekranu) **nie są w repozytorium** – leżą lokalnie w `zasoby-prywatne/referencje/`. W repozytorium trzymamy tylko zmierzone liczby.

- Strona 306 × 228 mm ze spadem, TrimBox = **A4 poziomo** (297 × 210 mm) przesunięte 9 mm od góry strony. Wszystkie pozycje niżej podano w układzie A4 (od lewego górnego rogu obszaru po przycięciu).
- Slot 25,75 × 25,75 mm, linie cięcia przerywane, wspólne dla sąsiednich kart.
- Pasek tytułu karty: ok. 6,7 mm, pod nim ciągła linia.
- **Arkusz 1 (broń i pancerze):** siatka 10 × 7 slotów, x 26,6–284,1 mm, y 12,8–193,1 mm; pionowy tytuł z lewej (czytany od dołu), nożyczki na linii cięcia.
- **Arkusz 2 (wyposażenie):** ta sama siatka; pionowy tytuł zakończony nożyczkami.
- **Arkusz 3 (stany):** 6 rzędów, grupy po 1–3 kolumny z odstępem ok. 2,9 mm; nad grupą nagłówek i opis; tytuł poziomy u góry; nożyczki pod siatką.
- Rozmiary kart: 1×1, 1×2 (ciężka broń, ciężka zbroja, broń dystansowa ciężka), 2×1 (lekka zbroja, puste karty).
- Pozycje linii cięcia wszystkich trzech arkuszy zapisane w `testy/geometria-referencji.json` (same liczby).

### Pomiary wektorowe (E3)

Z PDF zamienionego na SVG (`pdftocairo -svg`), w mm:

- Arkusz w PDF jest przeskalowany do 99,89% – slot zaprojektowany jako 73 pt (25,75 mm) drukuje się jako 25,725 mm (odstęp linii cięcia, np. 26,67 → 283,92 mm na 10 slotów).
- Odstępy między grupami stanów: 2,81–2,96 mm (przyjęto średnią 2,89 mm).
- Pasek tytułu 6,71 mm, linie 0,176 mm (0,5 pt) w kolorze `#231f20`.
- Znaczniki: średnica zewnętrzna 2,87 mm, odstęp 0,51 mm, 1,3 mm od lewej krawędzi, 1,1 mm pod linią tytułu.
- Ramka wartości: min. 6,87 × 6,87 mm, 1,0 mm pod linią, ~1,45 mm od prawej krawędzi; na zbroi ośmiokąt ze ściętymi rogami (3 pt).
- Sakiewka: pole 22,2 × 6,36 mm, 1,4 mm od dołu.
- Czcionki: tytuł 10 pt (stan 12 pt), wartość 10 pt (zbroja 8,5 pt), klasa 8 pt, skutek stanu 8 pt kursywą, nagłówek grupy 13 pt, opis grupy 9 pt, tytuł arkusza 32 pt.
- Linie cięcia: 0,264 mm (0,75 pt), kreska 2,3 mm / przerwa 1,55 mm, wzór wyśrodkowany na każdej krawędzi karty.

### Budowa szablonów (tylko układ, stan po E3)

| Szablon     | Elementy                                                                                                                                                                                                                                            |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Broń        | pasek tytułu + linia; 3 znaczniki (lewy górny róg); wartość w kwadratowej ramce (prawy górny róg); obraz pod znacznikami, obok ramki; klasa w lewym dolnym rogu z białą obwódką. Wariant 1×2: obraz na całą szerokość pod rzędem znaczników i ramki |
| Zbroja      | jak broń, bez klasy; ramka ośmiokątna ze ściętymi rogami, wartość z parametru `obrona` („-1 obr”); 1×2 i 2×1                                                                                                                                        |
| Przedmiot   | pasek tytułu; znaczniki N × M (np. 6 = 3 × 2); obraz obok znaczników, po prawej                                                                                                                                                                     |
| Sakiewka    | pasek tytułu; obraz; pole do wpisania z sufiksem z parametru `pojemnosc` („/ 250p”)                                                                                                                                                                 |
| Zaklęcie    | ★ w pasku tytułu; znaczniki; obraz może nachodzić na znaczniki                                                                                                                                                                                      |
| Stan        | tytuł (12 pt, bez linii); skutek kursywą; na dole etykieta z parametru `etykietaUsuniecia` („Usunięcie:”) + warunek, zawsze dwie linijki                                                                                                            |
| Pusta karta | pasek tytułu + znaczniki („gdy puste: pokaż pustą ramkę”)                                                                                                                                                                                           |

## 3. Architektura

```
src/
  model/      typy: szablon, talia, karta, arkusz, projekt; wymiary w mm (walidacja przy imporcie – E6)
  silnik/     układ (wiersze/kolumny), kształtowanie tekstu i kontury glifów (fontkit 2), pola M1 → scena → SVG
  druk/       model arkusza, rozmieszczanie, linie cięcia, tytuły i grupy → SVG arkusza → PDF
  dane/       Dexie (IndexedDB), biblioteka zasobów, eksport/import .kartyrpg (ZIP, fflate)
  ui/         React: projekty, talie, tabela danych, podgląd karty i arkusza, ustawienia druku
  i18n/       klucze tekstów + pl.json
public/czcionki/      EB Garamond, Grenze Gotisch (OFL) + licencje
src/pakiety/mausritter/  szablony, talie i arkusze (TS), obrazek zastępczy, LICENCJE.md
narzedzia/            skrypty pomocnicze (obrazek zastępczy)
testy/                testy e2e i wizualne Playwright
docs/                 plany i notatki
```

Zasady:

- Silnik i druk to czysty TypeScript bez DOM i React – deterministyczny wynik, testowalny w Vitest.
- **Scena** (lista elementów: prostokąt, linia, ścieżka, okrąg, tekst z pozycjami glifów, obraz) to wspólne źródło; serializator SVG i serializator PDF ją tylko przepisują.
- Wymiary w mm; konwersja na px/pt wyłącznie w serializatorach i UI.

## 4. Etapy

| Etap                       | Agent              | Zakres                                                                                                                                                                                   | Gotowe, gdy                                                                       |
| -------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **E0** Szkielet            | główny             | Vite + TS + React, ESLint, Prettier, Vitest, Playwright, i18n, `LICENCJE.md`, GitHub Actions (testy + Pages), routing hash                                                               | `npm run build`, `lint`, `test`, `e2e` przechodzą; strona startowa po polsku      |
| **E1** Prototyp PDF        | druk-pdf           | pdf-lib + fontkit: jedna karta ze sceny, czcionki OTF/TTF z podzbiorem; porównanie z jsPDF + svg2pdf                                                                                     | notatka z decyzją w `docs/`, test porównania PDF↔SVG                              |
| **E2** Model i silnik      | silnik-layoutu     | typy, układ (mm/%/auto/wypełnij, padding, gap, wyrównania, warstwy), tryb slotów, pomiar i łamanie tekstu, pola M1, „gdy puste: pokaż pustą ramkę”, serializator SVG                     | testy jednostkowe + snapshoty SVG                                                 |
| **E3** Pakiet Mausritter   | silnik-layoutu     | 7 szablonów (warianty rozmiarów), przykładowe talie z własnymi danymi, `LICENCJE.md`                                                                                                     | każdy szablon renderuje się; snapshoty                                            |
| **E4** Arkusz              | druk-pdf           | papier, marginesy, tytuł poziomy/pionowy, grupy z nagłówkiem i opisem, rozmieszczanie automatyczne + przypięte pozycje, wspólne linie cięcia, nożyczki, tryb cz-b                        | testy rozmieszczania i linii cięcia                                               |
| **E4a** Poprawki szablonów | silnik-layoutu     | duże ilustracje w broni 1×1 i zbroi 2×1 (klasa na obrazie z białą obwódką); ustawienia obrazu dla każdej karty w danych (skala, przesunięcie, obrót, dopasowanie) – szczegóły w sekcji 6 | wzorce SVG i galeria zaktualizowane; testy ustawień obrazu (SVG, PDF, przycięcie) |
| **E5** PDF                 | druk-pdf           | scena arkusza → PDF A4, tekst jako krzywe                                                                                                                                                | PDF otwiera się, test zgodności z SVG, test rozmiaru PDF (glify jako XObject)     |
| **E6** Dane                | dane-import        | Dexie, schemat z wersją, zasoby jako Blob, wgrywanie czcionek, eksport/import `.kartyrpg`                                                                                                | test „round-trip”                                                                 |
| **E7** UI                  | edytor-ui          | projekty, talie, tabela z „Ilość”, wybór szablonu/rozmiaru, czcionki do ról, podgląd karty i arkusza, ręczna korekta, „Pobierz PDF”                                                      | testy e2e przepływu                                                               |
| **E8** Testy wizualne      | tester             | test geometryczny względem `geometria-referencji.json` (CI); lokalny test nakładania z oryginalnymi czcionkami i referencją z `zasoby-prywatne/` (pomijany, gdy brak plików)             | raport z nakładką różnic                                                          |
| **E9** Wdrożenie           | główny + recenzent | GitHub Pages, przegląd, wydruk testowy                                                                                                                                                   | strona działa, użytkownik potwierdza wydruk                                       |

Kolejność: E0 → E1 → (E2 ∥ E6) → E3 → E4 → E4a → E5 → E6 → E7 → E8 → E9. Recenzent przegląda kod po E2–E7. Po każdym etapie commit i krótkie podsumowanie.

## 5. Stan realizacji

| Etap | Stan | Commity                         | Uwagi                                                                                                                                                                                                                                                                         |
| ---- | ---- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E0   | ✅   | `f116898`                       | CI na każdej gałęzi, wdrożenie Pages z `main`                                                                                                                                                                                                                                 |
| E1   | ✅   | `0dcf91a`                       | decyzja: tekst jako krzywe (`docs/decyzja-pdf.md`)                                                                                                                                                                                                                            |
| E2   | ✅   | `283e6d8`, `6aac0dc`            | po przeglądzie: pomiar wypełnianych dzieci, procenty, kolory, przedrostek id w SVG                                                                                                                                                                                            |
| E3   | ✅   | `e93d618`, `d362a12`, `167c5c6` | pakiet, parametry szablonu, warianty układu wg rozmiaru, obwódka liter; galeria `docs/obrazy/e3-galeria-mausritter.png`                                                                                                                                                       |
| E4   | ✅   | `43b257a`, `1ae47ed`            | 3 arkusze zgodne z referencją ±0,3 mm; PNG w `docs/obrazy/e4-arkusz-*.png`                                                                                                                                                                                                    |
| E4a  | ✅   | `0291dc2`, `d72ab3e`, przegląd  | sekcja 6; PNG w `docs/obrazy/e4a-*.png`                                                                                                                                                                                                                                       |
| E5   | ✅   | `502eb11`, przegląd             | strona `#/arkusze`: podgląd (dopasuj / 1:1), „Pobierz PDF” (arkusz / wszystkie), PDF↔SVG całych arkuszy; zrzut `docs/obrazy/e5-strona-arkusze.png`                                                                                                                            |
| E6   | ✅   | `fa91274`                       | `src/dane/`: Dexie (projekty + zasoby jako Blob), schemat z wersją i migracjami (zod, bez gubienia nieznanych pól), spójność odwołań, wgrywanie czcionek, `.kartyrpg` i `.kartyrpg-szablon` (ZIP, fflate), ostrzeżenie o licencji czcionek, pakiet → projekt; test round-trip |
| E7   | 🟡   |                                 | E7a–E7c ✅; dalej E7d–E7e (sekcja 7)                                                                                                                                                                                                                                          |
| E8   | ⬜   |                                 | test geometrii linii już w CI (E4); zostaje lokalny test nakładania z oryginalnymi czcionkami                                                                                                                                                                                 |
| E9   | ⬜   |                                 |                                                                                                                                                                                                                                                                               |

## 6. Zadania po E4 – poprawki szablonów z E3 (etap E4a)

Commit i push po każdym większym kroku.

1. **Większe ilustracje (broń 1×1, lekka zbroja 2×1).**
   - Obszar obrazu zajmuje całą przestrzeń od wiersza kółek do dolnej krawędzi karty, omijając tylko ramkę wartości.
   - Nazwa klasy broni leży **na** obrazie, z białą obwódką – jak w referencji (obraz nie kończy się nad klasą).
   - Lekka zbroja 2×1: duża ilustracja na całą wysokość pod paskiem tytułu (znaczniki i ramka wartości nałożone na nią w rogach).
   - Aktualizacja wzorców SVG, galerii i arkuszy; ponowna nakładka na referencję.
2. **Ustawienia obrazu dla każdej karty osobno**, zapisywane w danych karty:
   - skala, przesunięcie X/Y w mm, obrót (stopnie), tryb dopasowania (dopasuj / wypełnij / rozciągnij);
   - silnik: przekształcenie obrazu wewnątrz pola z przycięciem do ramki pola – identycznie w SVG i PDF (test porównania PDF↔SVG z obrotem i przesunięciem);
   - zapis w modelu danych karty (E6 – eksport/import razem z kartą);
   - **E7 (interfejs):** edycja myszą w podglądzie karty – przeciąganie przesuwa, kółko skaluje – oraz pola liczbowe (skala, X, Y, obrót, dopasowanie) i przycisk „Resetuj”.

Zrobione w E4a także: nożyczki na linii prowadzącej, większy tytuł pionowy, odstęp 2 mm pod opisami grup stanów (decyzje 14–16). Po przeglądzie: przycięcie „wypełnij” do wolnego obszaru, ostrzeżenia `brak-miejsca-na-obraz` i `nieznane-pole-do-omijania`, normalizacja ustawień obrazu (NaN, nieskończoność, skala ≤ 0), wielokrotne przybliżanie rozmiaru tytułu, linia prowadząca nie przecina nagłówków grup.

Po E5 (przegląd): zasoby po nieudanym wczytaniu nie zostają w pamięci (przycisk „Spróbuj ponownie”), błąd układu nie wywraca aplikacji (granica błędu wokół strony ładowanej leniwie), stały region `role="status"`, komunikaty błędów przez i18n, stan „brak arkuszy”.

## 7. Etap E7 – podział

Każdy krok: commit + push na gałęzi etapu; po E7e przegląd, PR i scalenie do `main`.

| Krok | Zakres                                                                                                                                                                                                                                                                                                | Stan |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| E7a  | Projekty: lista z IndexedDB, „Nowy projekt z pakietu”, import `.kartyrpg` (kolizja id → „Zastąp / Zapisz jako kopię”), eksport, usuwanie z potwierdzeniem; strona projektu (talie, ostrzeżenia), arkusze i PDF z danych projektu; obrazy w podglądzie jako `blob:` zwalniane przy zamknięciu projektu | ✅   |
| E7b  | Tabela danych talii: wiersz = karta, kolumny = pola i parametry szablonu + „Ilość”, rozmiar w slotach; dodawanie, usuwanie, kopiowanie kart; zapis do bazy (sam dokument)                                                                                                                             | ✅   |
| E7c  | Podgląd karty obok tabeli; edycja obrazu karty myszą (przeciąganie, kółko) i polami (skala, X, Y, obrót, dopasowanie, „Resetuj”); wybór/wgrywanie obrazu do biblioteki                                                                                                                                | ✅   |
| E7d  | Biblioteka czcionek: wgrywanie (rodzina/wariant z pliku, poprawa), przypisanie ról (tytuł, treść), wybór szablonu i rozmiaru karty                                                                                                                                                                    | ⬜   |
| E7e  | Arkusz: ręczna korekta (przypinanie kart), ustawienia (tryb cz-b z konwersją obrazów), teksty ostrzeżeń przez i18n, „Pobierz wszystkie” w workerze, LRU układu tekstu                                                                                                                                 | ⬜   |

### Po E6 – do E7

Po przeglądzie E6 poprawione: sprawdzanie treści zasobów przy imporcie (czcionka przez fontkit, sygnatura PNG/JPG), pełne schematy pól stylu, obrazu, arkusza (nieznany wariant czcionki itp. odrzucany), polskie komunikaty zod z najkonkretniejszą gałęzią unii, osobne migracje projektu i pliku szablonu, walidacja przy zapisie do bazy i kontrola Blobów w transakcji, odczyt w jednej transakcji, usuwanie osieroconych Blobów, `istnieje()` i `jakoKopia()`, twarde reguły spójności (powtórzone id węzłów, grup, kart w grupach; przypięte karty) oddzielone od ostrzeżeń (`ostrzezeniaProjektu`: rola bez czcionek, brakujący obraz szablonu lub karty, powtórzona para rodzina+wariant), `rejestrZProjektu` nie przerywa przy uszkodzonej czcionce, wariant czcionki z OS/2 (grubość ≥ 600, bit kursywy) i rodzina typograficzna (rekord 16), unikalne id zasobów (`-2`, `-3`), import szablonu nie zmienia wyglądu istniejących kart (role i czcionki projektu wygrywają, konflikty jako ostrzeżenia, kolizja id zasobu → nowe id z przepisaniem odwołań), limity ZIP (wpis, suma, liczba wpisów, tylko oczekiwane nazwy), kontrola zgodności schematu z typami modelu w czasie kompilacji.

Dla E7 (interfejs):

- Import `.kartyrpg`: gdy `BazaProjektow.istnieje(id)` – zapytać „zastąp / zapisz jako kopię” (`jakoKopia`). Nigdy nie nadpisywać bez pytania.
- Pokazywać `ostrzezeniaProjektu` i ostrzeżenia z `rejestrZProjektu` / `dodajSzablon` / `eksportujSzablon`; komunikaty `BladDanych` wprost.
- Wgrywanie czcionek: podgląd rodziny/wariantu z `wgrajCzcionke` (z `zajete` = id w projekcie), możliwość poprawy.
- `zapisz(projekt)` bez zasobów do częstej edycji kart; z zasobami tylko przy zmianie biblioteki. Przy dużych bibliotekach dodać `dodajZasob` / `usunZasob` zamiast przepisywania wszystkich Blobów.
- Pakiet Mausritter → projekt przez `projektZPakietu` („Nowy projekt z pakietu”). Google Fonts – M4.

### Odłożone (backlog)

- Brak czcionki: czcionka zapasowa z ostrzeżeniem zamiast przerwania renderu; komunikaty błędów silnika przez i18n (E7). (Unikalne id czcionek – zrobione w E6: id czcionki w silniku = id zasobu.)
- Limit pamięci podręcznej układu tekstu (LRU) przy długiej edycji (E7).
- Łamanie wierszy przy `odstepLiter` minimalnie zbyt ostrożne.
- Tryb czarno-biały dla obrazów rastrowych – konwersja przy wczytywaniu zasobów (E7).
- Pas nagłówków grup liczony z szacunkowej szerokości grupy – przy podziale grupy na strony nagłówek może się nie zmieścić (jest ostrzeżenie).
- Paczka aplikacji ~800 KB (fontkit + pdf-lib) – PDF ładowany na żądanie (E7).
- Limit długości tytułu liczony z siatki regularnej (linia nr k = k slotów). Przy grupach z odstępami lub pustym pierwszym rzędzie pozycja linii nożyczek może być inna – liczyć z tych samych odcinków co nożyczki (pakiet Mausritter tego nie używa).
- Nowe komunikaty ostrzeżeń (`tytul-nie-miesci-sie`, `brak-miejsca-na-obraz`, `nieznane-pole-do-omijania`) – teksty w i18n razem z pozostałymi ostrzeżeniami (E7).
- Ponowna nakładka E4a na referencję z oryginalnymi czcionkami – w lokalnym teście E8.
- Ostrzeżenia arkusza w UI pokazywane jako surowe kody (`kartaId: komunikat`) – teksty i18n w E7.
- Obrazy w podglądzie jako `data:` (kopia base64 w pamięci i w każdym SVG strony) – przy dużych obrazach z biblioteki (E6/E7) przejść na `blob:` z zarządzaniem czasem życia (revoke).
- Budowa wszystkich arkuszy przy „Pobierz wszystkie” w wątku głównym – przy dużych taliach przenieść do workera (E7).
