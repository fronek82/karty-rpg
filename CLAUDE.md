# Karty RPG – zasady pracy

Aplikacja przeglądarkowa (Vite + TypeScript + React 19) do projektowania i drukowania kart RPG
i planszowych. Bez backendu: dane w IndexedDB, eksport/import do plików ZIP, hosting na GitHub
Pages (`/karty-rpg/`, routing przez `location.hash`).

## Aktualny etap

- Ukończone: M1–M5, M2b, M2c, przebudowa UI (UI-1…UI-9), poprawki UX i „UI etap 1–4” (PR #71–#77),
  rewersy globalne, Google Fonts, kolory przycisków, awers/rewers wszystkich kart (PR #78–#86),
  porządek projektów P1–P3 (PR #87–#89, `docs/plan-porzadek-projektow.md`), poprawki danych N1
  (`docs/plan-N1.md`), porządki w kodzie N2 (`docs/plan-N2.md`), edytor i UI N3 (`docs/plan-N3.md`:
  eksport/import szablonu w edytorze, przeciąganie na gładziku, paski, zapis ręczny w edytorze szablonu),
  blok „wartość w kształcie” N4 (`docs/plan-N4.md`: proporcje kształtu, etykieta obok, nowe kształty),
  strona startowa i listy N6 (`docs/plan-N6.md`: Moje szablony na „Stwórz własne karty”, bez
  biblioteki globalnej szablonów, usuwanie z paskiem „Cofnij”, szukanie/sortowanie, „Duplikuj”),
  układ ze zdjęcia w edytorze i menu „Biblioteki” N7 (`docs/plan-N7.md`), wzory tła kart N5
  (`docs/plan-N5.md`: sekcja „Tło karty”, `wzorTla`, `src/silnik/wzorTla.ts`).
- Ukończone N8 (PR #98–#100, `docs/plan-N8.md`): jedna biblioteka zasobów użytkownika – obrazy,
  czcionki (poza wbudowanymi) i ozdobniki w tabeli `biblioteka` (`src/dane/bibliotekaUzytkownika.ts`,
  migracja `src/dane/migracjaBiblioteki.ts`); `BazaProjektow.wczytaj` składa widok projektu
  z biblioteką, `zapisz` przenosi nowe zasoby do biblioteki (deduplikacja po skrócie); zarządzanie
  tylko na stronie Biblioteki, w wyborach grupy „Systemowe” / „Moja biblioteka”.
- Ukończone N9 (`docs/plan-N9.md`): pusty stan karty na podglądzie i w drzewie (zamiast komunikatu
  w panelu „Karta”), wzory tła z biblioteki SVG (`wzorTla.rodzaj: 'svg'` – odwołanie do elementu
  ozdobnego, układy siatka/cegiełka/pion, element sceny `wzor`: SVG `<pattern>`, PDF – kopie wektorowe).
- Ukończone N10 (`docs/plan-N10.md`): jeden edytor przodu i tyłu (`ui/szablon/EdytorKarty.tsx`
  z konfiguracją `STRONY`, `PanelKarty.tsx`), kreator tyłu z gotowymi układami, „Rozmiar jak
  w szablonie”, kontrola zgodności rozmiarów przodu i tyłu (`dane/zgodnosc.ts`), w UI „Przód”
  i „Tył” zamiast „Awers” i „Rewers” (w kodzie, kluczach i plikach nazwy bez zmian).
- Ukończone N11 (`docs/plan-N11.md`): „Kolory projektu” przy polach koloru – kolory użyte
  w przodach i tyłach projektu oraz zapisane w `Projekt.paleta` (`src/dane/koloryProjektu.ts`,
  kontekst `ui/szablon/koloryProjektu.tsx`).
- Ukończone N12 (`docs/plan-N12.md`): przełącznik odmian – `Kontener.przelacznik` (kolumna danych,
  odmiana domyślna) i `odmiana` dziecka; na karcie widać jedno dziecko wybrane wartością z danych
  (`wybranaOdmiana` w `model/szablon.ts`, `ukryteOdmianyPrzelacznikow` w `silnik/karta.ts`), tył
  dopasowuje przełącznik po nazwie, panel `ui/szablon/PanelOdmian.tsx`.
- Ukończone **UI2 – wygląd „drukarnia riso” i przepływ Szablony → Karty → Druk** (PR #122–#130,
  `docs/plan-UI2.md`, zrzuty w `docs/obrazy/ui2/`): tokeny i lokalne czcionki OFL (`Archivo Black`,
  `Archivo`, `IBM Plex Mono`), wspólne komponenty (`src/ui/ui2/`), strona główna riso z miniaturami
  i 2 przyciskami tworzenia (`+ NOWE KARTY`, `Mausritter A4`), okno „Nowy projekt” (3 ścieżki,
  orientacja, niezależne Przód/Tył, swobodny domyślny), edytor szablonu z lewym paskiem elementów
  (drag-and-drop), zakładkami szablonów, przesuwaną/zwijaną Strukturą, linijkami w mm i liniami
  pomocniczymi (schemat v35), ekran „Krok 2: Karty” (`src/ui/karty/EkranKart.tsx`), sekcja „Linie
  cięcia” w druku (`SekcjaLiniiCiecia.tsx`) oraz lewy pasek i licznik kafelków w Mausritterze
  (`siatkaMausritter.ts`).
- Ukończone **R10 – poprawki edytora szablonu po przeglądzie** (`docs/plan-UI2.md` sekcja 11):
  wspólny górny pasek (`NaglowekProjektu.tsx`) z jednym elementem stanu zapisu (`● Zapisz` /
  `✓ zapisano`) i przyciskiem `Przejdź do kart →`, menu `Szablon ▾` na pasku zakładek, dymki
  paska stanu (Przyciąganie, Podkład, Linie, `? Skróty` — D15), 4-ikonowy prawy pasek
  (Właściwości, Karta, Style, Biblioteka), 5 ikon + menu `⋯` w nagłówku Struktury oraz przypięte
  do krawędzi obszaru roboczego linijki (`LinijkiKarty.tsx`, D16).
- Następny etap: **S – biblioteka szablonów osobno od projektów** (`docs/plan-S.md`, etapy S1…S6):
  szablony i tyły w osobnej bibliotece, projekty składają z nich karty (kroki Karty → Druk).
- Kolejne etapy ustala właściciel – plan i decyzje zapisuj w `docs/plan-<nazwa>.md`.
- Schemat projektu: `WERSJA_SCHEMATU = 35` (`src/model/projekt.ts`), baza Dexie w wersji 5.

## Gdzie co jest

- Specyfikacja: `SPEC.md`. Plany (ukończone): `docs/plan-M1.md`…`plan-M5.md`, `plan-M2b.md`,
  `plan-M2c.md`, `plan-UI.md`, `plan-edytor-kartki.md`, `plan-porzadek-projektow.md`.
- Decyzje podjęte bez konsultacji: sekcja „Decyzje” planu bieżącego etapu; nowe dopisuj tam.
- Przykłady szablonów: `docs/przyklady/`; zrzuty ekranu: `docs/obrazy/`; instrukcja: `instrukcja/`.
- Agenci: `.claude/agents/` (np. `recenzent` – przegląd, tylko odczyt). `AGENTS.md` – te same
  zasady dla innych narzędzi (Codex itp.).

## Architektura

Warstwy (importy tylko „w dół”; `ui` może używać wszystkiego, odwrotnie nie):

```
model  →  ozdobniki / silnik  →  druk  →  dane  →  ui
```

- `src/model/` – typy dokumentu (projekt, szablon, arkusz/kartka), jednostki (mm), przechodzenie
  drzewa węzłów (`wszystkieWezly`, `wezlyDrzewa`…), geometria i zaokrąglanie (`geometria.ts`),
  przekształcenia nazw (`nazwy.ts`).
- `src/silnik/` – układ szablonu (`uklad.ts`), tekst i łamanie (`tekst.ts`, fontkit), czcionki,
  budowa **sceny** karty (`karta.ts`) i SVG; figury wartości (`ksztaltyWartosci.ts`). Scena (lista elementów w mm) to jedno źródło dla
  podglądu SVG i PDF.
- `src/ozdobniki/` – ramki, narożniki, separatory, motywy, ramki 9-slice, import SVG.
- `src/druk/` – rozmieszczanie kart na arkuszu (`arkusz.ts`, `rozmieszczanie.ts`, `maxrects.ts`),
  druk dwustronny, tryb drukarni, PDF (`pdf.ts`, `budowaPdf.ts`, `pdf.worker.ts` – w wątku).
- `src/dane/` – operacje na dokumencie (`szablon.ts`, `kartka.ts`, `rewers.ts`, `edycja.ts`),
  schemat zod i migracje (`schemat.ts`), IndexedDB/Dexie (`baza.ts`), archiwa ZIP
  (`archiwum.ts`: `.kartyrpg`, `.kartyrpg-szablon` – awers lub rewers, `.kartyrpg-ozdobnik`), import CSV/XLSX,
  Google Fonts, AI-układ, galeria online.
- `src/pakiety/` – pakiety gier (obecnie Mausritter, zgodnie z SPEC M1); `src/przyklady/` –
  neutralne przykłady szablonów.
- `src/i18n/` – słowniki `pl.ts` i `en.ts` (te same klucze – pilnuje test), `t()`, hook Reacta.
- `src/wspolne/` – kod bez Reacta wspólny z instrukcją (klucze localStorage, kolory przycisków).
- `src/instrukcja/` – skrypt statycznej strony instrukcji (osobne wejście Vite, bez Reacta).
- `src/ui/` – React:
  - `App.tsx`, `useTrasa.ts` (routing hash), `useProjekt.ts` (stan projektu, historia, zapis;
    `autozapis: false` w Edytorze kart), `PasekKomunikatu.tsx` (wspólny pasek „… — Cofnij” na dole
    ekranu), `bazaUI.ts` (fasada nad `dane/baza.ts` z leniwymi
    importami), `obrazyUI.ts` (przygotowanie obrazów w przeglądarce), `zrodloOpcji.tsx` (źródło
    pozycji list wyboru).
  - `start/` – ekran startowy, Moje projekty / Moje szablony (`ListaProjektow.tsx`, logika
    w `mojeSzablony.ts`), kreatory,
    import, galeria online.
  - `szablon/` – Edytor karty, jeden dla przodu i tyłu (`EdytorKarty.tsx`, różnice stron
    w `STRONY`; panel całej karty `PanelKarty.tsx`): drzewo, panele właściwości, tryb swobodny
    (mysz); `EdytorDrzewa.tsx` – drzewo i podgląd, okno „Układ ze zdjęcia”
    (`OknoUkladuZeZdjecia.tsx`), okno zmiany rozmiaru (`ZmianaRozmiaru.tsx`), kreator obu stron
    (`Kreator.tsx`).
  - `biblioteki/` – ekran „Biblioteki” (`#/biblioteki/<zakładka>?powrot=…`: jedna biblioteka
    użytkownika – obrazy, czcionki, ozdobniki; wspólny `StronaBiblioteki.tsx`, szczegóły ozdobnika
    `EdytorOzdobnika.tsx`, import SVG `ImportSvg.tsx`). Hooki `useBiblioteka.ts` (`liveQuery`).
  - `rewers/` – podgląd i lista rewersów projektu. `kartka/` – Edytor kart (dane kart, układ kartki, druk, pobieranie).
  - `biblioteka/` – edytor ramki 9-slice i podglądy elementów (`podgladElementu.ts`).
  - Style: `tokeny.css` (zmienne motywów), `App.css`, `edytory.css`, `pasek.css`.
- `testy/` – Playwright (`*.spec.ts`, wzorce `*-snapshots/`, pomocniki `*UI.ts`, `pomoc.ts`).
- `narzedzia/`, `scripts/` – generatory galerii, obrazów testowych, katalogu Google Fonts.

## Sposób pracy

- Każdy etap zaczynaj od aktualnego `main`; po etapie: PR, scalenie do `main`, sprawdzenie
  wdrożenia na Pages (krok CI „Sprawdzenie strony po wdrożeniu”).
- Commit i push po każdym kroku; komunikaty commitów po polsku.
- Po wypchnięciu zmian zawsze otwieraj PR bez pytania (także przy drobnych poprawkach).
- Przed PR: przegląd agentem `recenzent` i poprawki zgłoszonych błędów; pełne testy robi CI.
- Bez gotowców pod konkretne gry – edytor daje tylko ogólne klocki.

## Oszczędzanie limitu

1. Lokalnie uruchamiaj tylko testy dotyczące zmienionych plików
   (`npx vitest run <ścieżki>`, `npx playwright test testy/<plik>.spec.ts --trace off`).
   Pełny zestaw zostaw CI.
2. Wypchnij gałąź, otwórz PR, sprawdź wynik CI raz – bez czekania w pętli.
3. Zrzuty i galerie PNG tylko przy etapach; przy drobnych poprawkach pomijaj.
4. Z logów testów czytaj tylko błędy i ich bezpośredni kontekst.

## Testy (wyjście skrócone: Vitest „dot”, Playwright „line”)

- `npm run typecheck`, `npm run lint`, `npm run format:check`
- `npm test` (Vitest: `src/**/*.test.{ts,tsx}`, środowisko node, jsdom tam, gdzie test go ustawia).
- `npm run e2e` (Playwright, Chromium; sam buduje i uruchamia `vite preview` na porcie 4173).
  `EKSPORT_PRZEGLADARKI=1 npm run e2e` dodaje scenariusze eksportu w Firefox i WebKit, jak w CI.
- Wzorce zrzutów `*-chromium-linux.png` – tylko Linux (jak CI); aktualizuj tylko przy świadomej
  zmianie wyglądu i wymień je w PR.
- Pliki przykładów: `AKTUALIZUJ_PRZYKLADY=1 npx vitest run src/dane/przyklady.test.ts`.
- CI (`.github/workflows/`): formatowanie → lint → typy → Vitest → Playwright; na `main` budowa
  i wdrożenie na Pages.

## Zasady kodu

- Wymiary w modelu w mm; jedno źródło sceny dla podglądu SVG i PDF.
- Teksty UI przez i18n (`src/i18n/pl.ts` i `en.ts`); schemat i migracje w `src/dane/schemat.ts`
  (zmiana modelu = nowa wersja schematu + migracja + test).
- Nazwy identyfikatorów po polsku (bez znaków diakrytycznych), komentarze po polsku.
- Klucze localStorage w jednym miejscu (`src/wspolne/ustawienia.ts`), rozszerzenia plików jako
  stałe w `src/dane/archiwum.ts`.
- Nowe zależności i zasoby – wpis w `LICENCJE.md`.

## Komunikacja

- Podsumowania etapów po polsku: co sprawdzić krok po kroku, zrzuty nowych widoków.
- Zasoby prywatne (`zasoby-prywatne/`, w `.gitignore`) nigdy nie trafiają do repozytorium.
