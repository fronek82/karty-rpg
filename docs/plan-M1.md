# Plan M1 – Mausritter na A4

Kamień milowy M1 ze `SPEC.md` (sekcja 12). Dokument opisuje ustalenia, pomiary referencji, architekturę i etapy pracy.

## 1. Decyzje

| #   | Temat          | Decyzja                                                                                                                                                                                                                                              |
| --- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Źródła         | Arkusze referencyjne to komercyjny PDF (sklep Stinger-Prest). **Nie używamy jego grafik ani tekstów.** Odtwarzamy tylko układ (szablony), żeby użytkownik tworzył własne karty. Przykładowe dane w pakiecie są nasze i ogólne, bez ilustracji z PDF. |
| 2   | Czcionki       | Domyślnie **EB Garamond** (zamiast Minion Pro) i **Grenze Gotisch** (zamiast Herb), obie na licencji OFL. Oryginały użytkownik wgrywa do `zasoby-prywatne/` i używa ich tylko w lokalnym teście nakładania.                                          |
| 3   | Repozytorium   | Publiczne, wdrożenie na GitHub Pages.                                                                                                                                                                                                                |
| 4   | Test zgodności | Porównanie z referencją na **zapisanym układzie ręcznym** (odtworzonym co do slotu). Rozmieszczanie automatyczne testujemy osobno (poprawność, brak nakładania, oszczędność papieru) i nie musi dać identycznego układu.                             |
| 5   | PDF            | Krótki prototyp (E1), wstępny wybór **pdf-lib + @pdf-lib/fontkit**. PDF powstaje z tej samej sceny, z której powstaje SVG.                                                                                                                           |
| 6   | Edycja w M1    | Tabela danych, wybór szablonu i rozmiaru karty, przypisanie czcionek do ról (tytuł, treść). Edycja stylu i układu dopiero w M2.                                                                                                                      |
| 7   | Slot           | Domyślnie **25,75 mm** (73 pt). Użytkownik sprawdzi wydrukiem na karcie postaci.                                                                                                                                                                     |
| 8   | Arkusz         | Tytuł poziomy i pionowy (obrócony o 90°), nagłówki grup z opisem nad kolumnami.                                                                                                                                                                      |

## 2. Pomiary referencji (`Mausritter_kartyekwipunku.pdf`)

- Strona 306 × 228 mm ze spadem, TrimBox = **A4 poziomo** (297 × 210 mm) przesunięte 9 mm od góry strony. Wszystkie pozycje niżej podano w układzie A4 (od lewego górnego rogu obszaru po przycięciu).
- Slot 25,75 × 25,75 mm, linie cięcia przerywane, wspólne dla sąsiednich kart.
- Pasek tytułu karty: ok. 6,7 mm, pod nim ciągła linia.
- **Arkusz 1 (broń i pancerze):** siatka 10 × 7 slotów, x 26,6–284,1 mm, y 12,8–193,1 mm; pionowy tytuł z lewej (czytany od dołu), nożyczki na linii cięcia.
- **Arkusz 2 (wyposażenie):** ta sama siatka; pionowy tytuł zakończony nożyczkami.
- **Arkusz 3 (stany):** 6 rzędów, grupy po 1–3 kolumny z odstępem ok. 2,9 mm; nad grupą nagłówek i opis; tytuł poziomy u góry; nożyczki pod siatką.
- Rozmiary kart: 1×1, 1×2 (ciężka broń, ciężka zbroja, broń dystansowa ciężka), 2×1 (lekka zbroja, puste karty).
- Dokładne liczby do testu geometrycznego zostaną zapisane w `testy/referencje/geometria.json` (skrypt w `narzedzia/`).

### Budowa szablonów (tylko układ)

| Szablon     | Elementy                                                                                                                         |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Broń        | tytuł + linia; 3 znaczniki użycia (lewy górny róg); wartość w kwadratowej ramce (prawy górny róg); obraz; klasa (lewy dolny róg) |
| Zbroja      | jak broń, ramka wartości z zaokrąglonymi rogami (np. „-1 obr”); warianty 1×2 i 2×1                                               |
| Przedmiot   | tytuł + linia; znaczniki użycia (konfigurowalne N × M, np. 2 × 3); obraz                                                         |
| Sakiewka    | jak przedmiot + pole do wpisania z sufiksem (np. „/ 250p”)                                                                       |
| Zaklęcie    | ★ w miejscu tytułu; znaczniki; obraz pod znacznikami                                                                             |
| Stan        | tytuł (większy, bez linii); opis kursywą; na dole „Usunięcie:” (pogrubione) + wartość                                            |
| Pusta karta | pasek tytułu + znaczniki; „gdy puste: pokaż pustą ramkę”                                                                         |

## 3. Architektura

```
src/
  model/      typy: szablon, talia, karta, arkusz, projekt; walidacja (zod); wymiary w mm
  silnik/     układ (wiersze/kolumny), pomiar tekstu (opentype.js), pola M1 → scena → SVG
  druk/       model arkusza, rozmieszczanie, linie cięcia, tytuły i grupy → SVG arkusza → PDF
  dane/       Dexie (IndexedDB), biblioteka zasobów, eksport/import .kartyrpg (ZIP, fflate)
  ui/         React: projekty, talie, tabela danych, podgląd karty i arkusza, ustawienia druku
  i18n/       klucze tekstów + pl.json
public/czcionki/      EB Garamond, Grenze Gotisch (OFL) + licencje
pakiety/mausritter/   szablony JSON, przykładowe dane (własne), LICENCJE.md
narzedzia/            skrypty pomocnicze (pomiar referencji)
testy/                testy e2e i wizualne Playwright
docs/                 plany i notatki
```

Zasady:

- Silnik i druk to czysty TypeScript bez DOM i React – deterministyczny wynik, testowalny w Vitest.
- **Scena** (lista elementów: prostokąt, linia, ścieżka, okrąg, tekst z pozycjami glifów, obraz) to wspólne źródło; serializator SVG i serializator PDF ją tylko przepisują.
- Wymiary w mm; konwersja na px/pt wyłącznie w serializatorach i UI.

## 4. Etapy

| Etap                     | Agent              | Zakres                                                                                                                                                               | Gotowe, gdy                                                                  |
| ------------------------ | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **E0** Szkielet          | główny             | Vite + TS + React, ESLint, Prettier, Vitest, Playwright, i18n, `LICENCJE.md`, GitHub Actions (testy + Pages), routing hash                                           | `npm run build`, `lint`, `test`, `e2e` przechodzą; strona startowa po polsku |
| **E1** Prototyp PDF      | druk-pdf           | pdf-lib + fontkit: jedna karta ze sceny, czcionki OTF/TTF z podzbiorem; porównanie z jsPDF + svg2pdf                                                                 | notatka z decyzją w `docs/`, test porównania PDF↔SVG                         |
| **E2** Model i silnik    | silnik-layoutu     | typy, układ (mm/%/auto/wypełnij, padding, gap, wyrównania, warstwy), tryb slotów, pomiar i łamanie tekstu, pola M1, „gdy puste: pokaż pustą ramkę”, serializator SVG | testy jednostkowe + snapshoty SVG                                            |
| **E3** Pakiet Mausritter | silnik-layoutu     | 7 szablonów (warianty rozmiarów), przykładowe talie z własnymi danymi, `LICENCJE.md`                                                                                 | każdy szablon renderuje się; snapshoty                                       |
| **E4** Arkusz            | druk-pdf           | papier, marginesy, tytuł poziomy/pionowy, grupy z nagłówkiem i opisem, rozmieszczanie automatyczne + przypięte pozycje, wspólne linie cięcia, nożyczki, tryb cz-b    | testy rozmieszczania i linii cięcia                                          |
| **E5** PDF               | druk-pdf           | scena arkusza → PDF A4 z osadzonymi czcionkami                                                                                                                       | PDF otwiera się, test zgodności z SVG                                        |
| **E6** Dane              | dane-import        | Dexie, schemat z wersją, zasoby jako Blob, wgrywanie czcionek, eksport/import `.kartyrpg`                                                                            | test „round-trip”                                                            |
| **E7** UI                | edytor-ui          | projekty, talie, tabela z „Ilość”, wybór szablonu/rozmiaru, czcionki do ról, podgląd karty i arkusza, ręczna korekta, „Pobierz PDF”                                  | testy e2e przepływu                                                          |
| **E8** Testy wizualne    | tester             | test geometryczny względem `geometria.json` (CI); lokalny test nakładania z oryginalnymi czcionkami i referencją z `zasoby-prywatne/` (pomijany, gdy brak plików)    | raport z nakładką różnic                                                     |
| **E9** Wdrożenie         | główny + recenzent | GitHub Pages, przegląd, wydruk testowy                                                                                                                               | strona działa, użytkownik potwierdza wydruk                                  |

Kolejność: E0 → E1 → (E2 ∥ E6) → E3 → E4 → E5 → E7 → E8 → E9. Recenzent przegląda kod po E2–E7. Po każdym etapie commit i krótkie podsumowanie.
