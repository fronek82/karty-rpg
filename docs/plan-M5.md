# Plan M5 – AI, udostępnianie i wygoda pracy

**Status.** Plan przygotowany 20.11.2026. M5-1, M5-2 i M5-3 ukończono 20.11.2026. Najbliższy etap to M5-4. Punktem wyjścia jest ukończony [M4](plan-M4.md). Zakres wynika ze [specyfikacji AI, udostępniania i PDF](../SPEC.md#11-udostępnianie) oraz potrzeb zgłoszonych podczas pracy z kartami.

## 1. Cel i kryterium ukończenia

- Wklejanie tekstu skopiowanego z pliku PDF do pól tekstowych karty i szablonu automatycznie usuwa sztuczne złamania wiersza i łączy wyrazy podzielone dywizem, zachowując puste linie (akapity) oraz listy numerowane i punktowane.
- Użytkownik może wygenerować punkt wyjścia dla układu szablonu ze zdjęcia lub skanu karty przez Claude API (z własnym kluczem przechowywanym wyłącznie lokalnie), otrzymując wyłącznie strukturę i proporcje pól bez kopiowania grafik.
- Ekran własnych kart udostępnia kuratorowaną, neutralną galerię szablonów i rewersów online (z podglądem, wyszukiwaniem i atrybucją licencyjną), a pobrane paczki działają lokalnie bez sieci.
- Eksportowany PDF opcjonalnie zawiera niewidoczną warstwę tekstową (wyszukiwanie i kopiowanie z polskimi znakami) przy zachowaniu pełnej zgodności pikseli PDF↔SVG.
- Dwujęzyczna instrukcja (`instrukcja/index.html`) obejmuje pełny zakres funkcji M2c–M5, a testy regresyjne potwierdzają zgodność dotychczasowych projektów i paczek w PL i EN oraz w obu motywach.

## 2. Stan przed M5

| Potrzeba                          | Stan | Uwagi                                                                                                                                             |
| --------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wklejanie tekstu z PDF            | ✗    | Pola `<textarea>` przyjmują surowe złamania wierszy (`\n`) i dzielenia wyrazów (`-\n`) z kolumn PDF bez czyszczenia.                              |
| Układ karty ze zdjęcia przez AI   | ◐    | Istnieje ręczny podkład ze wzoru w tle (M2b-9) i tryb swobodny; brak integracji z Claude API i konwersji odpowiedzi JSON na bezpieczny `Szablon`. |
| Galeria szablonów i udostępnianie | ◐    | Działa lokalna biblioteka globalna i paczki `.kartyrpg-szablon` / `.kartyrpg-ozdobnik` (M2c, M4); brak katalogu online i importu z adresu URL.    |
| Wyszukiwanie tekstu w PDF         | ✗    | Glify renderowane są wyłącznie jako krzywe wektorowe (100% wierność wyglądu, brak zaznaczania/wyszukiwania tekstu).                               |
| Instrukcja użytkownika (PL i EN)  | ◐    | `instrukcja/index.html` kończy się na zakresie M2b; brakuje opisów biblioteki globalnej, importu CSV/XLSX, rewersów, druku dwustronnego i M4–M5.  |

## 3. Projekt rozwiązania

- **Czyszczenie tekstu wklejanego z PDF.** Czysta funkcja `wyczyscTekstZPdf` (bez zależności od DOM) normalizuje końce linii, usuwa miękkie łączniki (`\u00AD`), łączy wyrazy podzielone dywizem na końcu wiersza (`wyraz-\ndalej` → `wyrazdalej`), zamienia pojedyncze złamania wiersza w środku akapitu na spacje i porządkuje wielokrotne/twarde spacje. Zachowuje puste linie (`\n\n`) jako podział akapitów oraz nowe wiersze rozpoczynające punkty list (`1. `, `2) `, `- `, `• `, `* `). Podpinamy ją automatycznie w `onPaste` wielowierszowych pól tekstowych (`PanelKart`, `PanelWezla`), z możliwością cofnięcia (`Ctrl+Z`).
- **Rozpoznawanie układu ze zdjęcia przez AI.** Moduł w `src/dane/` wysyła obraz w zmniejszonej rozdzielczości roboczej do Claude API z lokalnym kluczem użytkownika (`localStorage`, bez zapisywania w projektach ani paczkach). Prompt wymusza zwrot wyłącznie ustrukturyzowanego JSON-a z układem (wymiary/proporcje karty, pola tekstowe, wartości, obrazy, tabele, przybliżone style i kolory ramki/tła) – bez kopiowania treści objętych prawem autorskim ani grafik. Odpowiedź waliduje schemat `zod`, a konwerter buduje poprawny `Szablon` gotowy do dopracowania w edytorze (opcjonalnie z wgranym zdjęciem jako podkładem). Wywołanie wspiera `AbortController` i limit czasu; testy używają wyłącznie zapisanych odpowiedzi.
- **Galeria szablonów online.** Statyczny manifest JSON i neutralne paczki `.kartyrpg-szablon` serwowane razem z aplikacją (GitHub Pages, bez własnego backendu), z wpisami licencyjnymi w `LICENCJE.md`. Interfejs na ekranie „Stwórz własne karty” umożliwia wyszukiwanie, filtrowanie po formacie/kategorii i dodanie lokalnej kopii jednym kliknięciem. Dodatkowo wspierany jest import paczki z bezpośredniego linku URL (po pełnej walidacji schematu przed zapisem).
- **Niewidoczna warstwa tekstowa w PDF.** W `src/druk/pdf.ts` dodajemy opcjonalną warstwę tekstu w trybie niewidocznym PDF (`3 Tr`) dopasowaną do pozycji wierszy sceny, dzięki czemu przeglądarki PDF potrafią wyszukiwać i kopiować tekst (w tym polskie znaki) bez jakiejkolwiek zmiany w pikselach rysowanych z konturów glifów.
- **Instrukcja PL/EN.** Rozszerzamy `instrukcja/index.html` o rozdziały M2c–M5 (pilnując testu zgodności nazw przycisków `src/instrukcja/tresc.test.ts`) i odświeżamy zrzuty ekranu.

## 4. Etapy

Każdy etap zaczyna się od aktualnego `main` i ma osobny PR. Zmiana schematu obejmuje migrację w `src/dane/schemat.ts`, test istniejących danych i zapis po ponownym otwarciu. Lokalnie uruchamiamy testy zakresu zmiany, a pełny zestaw wykonuje CI. Po scaleniu sprawdzamy wdrożenie.

| Etap | Status       | Wielkość | Zakres z testami                                                                                                                                                                     | Agenci                           |
| ---- | ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| M5-1 | ✓ 20.11.2026 | S        | Automatyczne czyszczenie tekstu wklejanego z PDF (`wyczyscTekstZPdf` + `onPaste` w polach tekstowych kart i szablonów). Zachowanie akapitów i list. Testy jednostkowe i E2E (PL/EN). | dane-import, edytor-ui, tester   |
| M5-2 | ✓ 20.11.2026 | L        | Rozpoznawanie układu karty ze zdjęcia przez Claude API (lokalny klucz, walidacja `zod`, konwersja na `Szablon`, podgląd przed zapisem, obsługa błędów i anulowania). Testy offline.  | dane-import, edytor-ui, tester   |
| M5-3 | ✗            | M        | Kuratorowana galeria neutralnych szablonów i rewersów online (manifest + paczki `.kartyrpg-szablon`, filtr, szukanie, licencje, import z URL). Testy z zapisanych odpowiedzi i E2E.  | dane-import, edytor-ui, tester   |
| M5-4 | ✗            | M        | Opcjonalna niewidoczna warstwa tekstowa w PDF (`3 Tr`) do wyszukiwania i kopiowania polskich znaków bez wpływu na wygląd. Testy `pdfjs-dist` (`getTextContent`) i parytetu PDF↔SVG.  | druk-pdf, silnik-layoutu, tester |
| M5-5 | ✗            | M        | Aktualizacja statycznej instrukcji (`instrukcja/index.html`, PL i EN) o funkcje M2c–M5 oraz odświeżenie zrzutów. Testy `tresc.test.ts` i `instrukcja.spec.ts`.                       | edytor-ui, tester                |
| M5-6 | ✗            | S        | Domknięcie M5, `README.md`, galeria neutralnych przykładów `docs/obrazy/m5-6/`, kontrola regresji M1–M4 oraz lista ręcznego odbioru.                                                 | edytor-ui, tester, recenzent     |

### Ręczne sprawdzenia M5

- [ ] **1. Wklejanie tekstu z PDF:** skopiować wielowierszowy opis z kolumny dowolnego PDF (z dzieleniem wyrazów dywizem, dwoma akapitami i listą numerowaną) i wkleić `Ctrl+V` / `Cmd+V` do pola karty — sprawdzić, że sztuczne złamania wierszy zniknęły, wyrazy z dywizem się skleiły, a akapity i lista pozostały czytelne; sprawdzić cofnięcie `Ctrl+Z`.
- [ ] **2. Układ ze zdjęcia AI:** wpisać własny klucz API (sprawdzić, że nie trafia do eksportu `.kartyrpg`), wgrać zdjęcie neutralnej karty, zweryfikować wygenerowaną strukturę pól i możliwość edycji w edytorze szablonu oraz usunięcie klucza z przeglądarki.
- [ ] **3. Galeria szablonów online:** na ekranie „Stwórz własne karty” przefiltrować i pobrać szablon z galerii, przełączyć przeglądarkę w tryb Offline i potwierdzić dalszą pracę bez sieci.
- [ ] **4. Wyszukiwanie w PDF:** otworzyć wygenerowany PDF w przeglądarce / podglądzie PDF, użyć `Ctrl+F` / `Cmd+F` na słowie z polskimi znakami i porównać wygląd ze stroną bez warstwy tekstowej.
- [ ] **5. Instrukcja i odbiór PL/EN + oba motywy:** przejrzeć `instrukcja/` w PL i EN w jasnym i ciemnym motywie oraz potwierdzić spójność nazw przycisków z aplikacją.

## 5. Zakres pierwszej wersji

Pierwsza wersja M5 koncentruje się na funkcjach działających bez własnego serwera (czysta aplikacja statyczna na GitHub Pages): lokalne czyszczenie schowka z PDF, bezpośrednie wywołanie API AI z kluczem użytkownika, statyczna galeria paczek szablonów, niewidoczna warstwa tekstowa w PDF oraz aktualna instrukcja PL/EN.

## 6. Później

Obsługa wielu dostawców AI poza Claude API, współdzielone konta użytkowników i publikowanie szablonów przez formularz społecznościowy (wymagające backendu i moderacji) pozostają poza zakresem M5.

## 7. Decyzje

| #   | Sprawa           | Decyzja                                                                                                                              |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Bezpieczeństwo   | Klucz API użytkownika żyje wyłącznie w `localStorage` przeglądarki i nigdy nie trafia do pliku projektu, szablonu ani repozytorium.  |
| R2  | Prawa autorskie  | AI zwraca wyłącznie strukturę i geometrię układu pól (bez kopiowania grafik i treści); galeria zawiera wyłącznie neutralne szablony. |
| R3  | Wklejanie z PDF  | Czyszczenie działa automatycznie przy wklejaniu (`Ctrl+V`/`Cmd+V`), łącząc wiersze w akapicie przy zachowaniu pustych linii i list.  |
| R4  | Zgodność PDF/SVG | Niewidoczna warstwa tekstowa w PDF nie może zmieniać pikseli renderowania (wspólna scena konturów glifów pozostaje źródłem wyglądu). |
| R5  | Praca bez sieci  | Pobrane z galerii szablony oraz projekty po zapisaniu działają w 100% offline; wszystkie testy M5 działają bez żywych zapytań w CI.  |

## 8. Ryzyka

- **Polityka CORS / nagłówki przeglądarki dla API AI:** bezpośrednie wywołanie Claude API z przeglądarki wymaga właściwego nagłówka (`anthropic-dangerous-direct-browser-access`) i czytelnego komunikatu w razie blokady sieciowej lub błędu klucza.
- **Fałszywe łączenie wyrazów przy wklejaniu z PDF:** prawdziwe wyrazy ze złożonym łącznikiem (np. `biało-czerwony` lub `20-30`) na końcu wiersza nie mogą tracić łącznika bez potrzeby, a celowe listy i wiersze z formatowaniem Markdown muszą pozostać nienaruszone.
- **Kodowanie polskich znaków w warstwie tekstowej PDF:** standardowe fonty Type1 w PDF nie obsługują pełnego UTF-8; niewidoczna warstwa musi używać osadzonego fontu z tabelą `ToUnicode` (np. z osadzonej czcionki projektu lub subsetu) tak, aby `Ctrl+F` i kopiowanie zwracały poprawne polskie znaki.

## 9. Decyzje podjęte bez konsultacji

| #    | Etap | Sprawa                    | Decyzja                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---- | ---- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B272 | Plan | Kolejność i zakres M5     | Ułożono M5 w 6 etapów (M5-1…M5-6), zaczynając od szybkiego usprawnienia codziennej pracy (M5-1: automatyczne czyszczenie tekstu wklejanego z PDF zgodnie z wyborem właściciela), przed większymi etapami AI (M5-2), galerii online (M5-3), warstwy tekstowej PDF (M5-4) oraz aktualizacją instrukcji PL/EN (M5-5).                                                                                                                                                                                                                                                                                                                              |
| B273 | M5-1 | Czyszczenie schowka z PDF | Czysty moduł `src/wspolne/wklejaniePdf.ts` (`wyczyscTekstZPdf`, `wstawWklejonyTekst`) oraz adapter `src/ui/wklejaniePdfUI.ts` podpięte pod `onPaste` w `PanelKart` i `PanelWezla` (tekst stały i przykładowy). Wklejenie oczyszczonego tekstu zapisuje się jako osobny krok historii (bez grupowania z poprzednim wpisywaniem), a pojedyncze wiersze bez złamań zachowują celowe spacje brzegowe.                                                                                                                                                                                                                                               |
| B274 | M5-2 | Układ ze zdjęcia przez AI | Moduł `src/dane/aiUklad.ts` wysyła zmniejszone zdjęcie (max 1568 px, ≤ 5 MB) do `api.anthropic.com/v1/messages` z nagłówkiem `anthropic-dangerous-direct-browser-access: true` i lokalnym kluczem z `localStorage` (`karty-rpg:claude-api-klucz`). Model zwraca wyłącznie strukturę JSON ze współrzędnymi procentowymi `0–100` (walidacja `zod`), przeliczanymi na `Szablon` swobodny w mm z neutralnymi wartościami przykładowymi i opcjonalnym podkładem zdjęcia (`szablon.podklad`). Ekran `#/wlasne/ai` (`KreatorAiStrona.tsx`) pokazuje podgląd SVG z silnika przed otwarciem edytora szablonu.                                            |
| B275 | M5-3 | Galeria szablonów online  | Statyczna galeria w `public/galeria/` (`manifest.json` + 5 neutralnych paczek `.kartyrpg-szablon`, w tym 3 z ozdobnym rewersem, generowane deterministycznie przez `narzedzia/generuj-galerie.mjs` bez zewnętrznych zasobów, licencja MIT). Moduł `src/dane/galeriaOnline.ts` waliduje manifest (`zod`), adresy URL (wyłącznie `http:`/`https:`), limit rozmiaru (`LIMITY_ARCHIWUM.suma`) i pełny schemat `importujSzablon` przed zapisem. Komponent `GaleriaOnline.tsx` w `WlasneKarty` udostępnia wyszukiwanie, filtry, podgląd awersu i rewersu z silnika, użycie jednym kliknięciem, zapis do biblioteki globalnej oraz import z linku URL. |
