# Plan porządkowania projektów i szablonów (P1–P3)

Plan porządkujący pracę z projektami i szablonami na ekranie startowym oraz zapis w Edytorze kart.
Nie zmienia silnika układu, PDF ani `WERSJA_SCHEMATU` w `src/model/projekt.ts`.

**Status:**

- **P1 (zakładki „Moje projekty” / „Moje szablony”, podgląd Awers+Rewers, deduplikacja szablonów):** ukończony (PR #87).
- **P2 (ręczny przycisk „Zapisz” w Edytorze kart zamiast autozapisu):** ukończony (PR #88).
- **P3 (podział lewego menu startowego na „Nowy projekt” / „Nowy szablon” i akcja „Użyj w projekcie”):** ukończony na gałęzi `etap-p3-porzadek-startu-i-szablonow`.

---

## 1. Problem i cel

Dotychczas:

- szablony (pojedyncze wzory awersu/rewersu) i projekty (gotowe talie kart do druku) były na jednej liście „Moje projekty”;
- wielokrotne wybieranie tego samego awersu z innego projektu tworzyło kolejne kopie w `projekt.szablony` (duplikaty w listach wyboru, np. wielokrotne „Warlock” / „Wyprawa za mur”);
- automatyczny zapis w Edytorze kart utrwalał każdą próbę i eksperyment od razu na liście projektów.

**Cel:**

1. Jasny podział na ekranie startowym: **Moje projekty** (gotowe talie do druku) vs **Moje szablony** (klocki: awersy i rewersy).
2. Czyste listy wyboru szablonów bez duplikatów.
3. Świadomy, ręczny zapis w Edytorze kart (przycisk **Zapisz** obok nazwy projektu + `Ctrl+S` / `Cmd+S` + ostrzeżenie przy wyjściu).

---

## 2. Etapy realizacji

### Etap P1 — Zakładki „Moje projekty” i „Moje szablony”, podgląd Awers + Rewers, deduplikacja szablonów

**Zakres:**

1. **Dwie zakładki nad środkową kolumną ekranu startowego (`src/ui/start/ListaProjektow.tsx`):**
   - `Moje projekty` (tab domyślny) i `Moje szablony` (wybór zapamiętywany w `sessionStorage`).
   - **Moje projekty:** projekty z kartami (w tym pakiety gier i własne talie) — kliknięcie otwiera **Edytor kart** (`#/projekt/:id`).
     - Podgląd kafelka pokazuje **parę Awers + Rewers obok siebie**, gdy projekt ma przypisany rewers (z talii, szablonu lub karty) i niepusty awers; jeśli projekt ma tylko awers albo tylko rewers — pokazuje jedną stronę.
     - Kafelek pokazuje nazwę projektu, liczbę stron/kart, datę zmiany oraz przyciski `Otwórz`, `Eksportuj`, `Usuń`.
   - **Moje szablony:** szablony awersów i rewersów z projektów w przeglądarce + filtr `Wszystkie` / `Awersy` / `Rewersy`.
     - Podgląd dokładnie jak dotychczas: pojedyncza karta + wyraźna plakietka **Awers** lub **Rewers**.
     - Kliknięcie otwiera odpowiedni edytor (`Edytor szablonu` lub `Edytor rewersu`).
2. **Podsumowanie projektu z informacją o aktywnym awersie i rewersie (`src/dane/baza.ts`):**
   - Rozszerzenie `PodsumowanieProjektu` o opcjonalne `aktywnyRewersId` (np. `talia.rewersId` lub pierwszy rozstrzygnięty rewers karty/szablonu) oraz `maKarty` / `czySzablon`, aby `ListaProjektow` mogła czysto rozdzielić projekty od szablonów i wyrenderować podgląd `Awers + Rewers`.
   - Uwaga o zgodności wstecznej z testami Playwright: w testach e2e projekty bez kart utworzone z kreatora własnych kart nadal muszą być łatwo otwieralne — projekt z `liczbaKart > 0` (lub pakiet gry) trafia do **Moje projekty**, a każdy szablon awersu/rewersu jest widoczny w **Moje szablony** (jeśli `Moje projekty` jest puste, a są szablony — wyraźna podpowiedź z przejściem do zakładki lub pokazanie pustego stanu).
3. **Deduplikacja szablonów awersów (`src/dane/baza.ts`, `src/ui/awersyZProjektow.ts`, `src/ui/kartka/PanelRewersuIAwersu.tsx`, `src/ui/kartka/EdytorKartki.tsx`):**
   - W `szablonyAwersowZProjektow` i `useAwersyZProjektow`: deduplikacja po znormalizowanej nazwie szablonu i pomijanie szablonów o nazwie już obecnej w bieżącym projekcie (analogicznie do `listaRewersowGlobalnych` w `src/ui/rewersyGlobalne.ts`).
   - W `PanelRewersuIAwersu` i `EdytorKartki`: jeśli w bieżącym projekcie istnieje już szablon o tej samej znormalizowanej nazwie, używamy istniejącego zamiast dodawać duplikat; w `<select>` bieżącego projektu deduplikujemy wyświetlane powtórzenia po `id` (i preferujemy niepowielanie nazw przy imporcie).

**Pliki do zmiany w P1:**

- `src/dane/baza.ts` (`PodsumowanieProjektu`, `lista`, `szablonyAwersowZProjektow`)
- `src/ui/awersyZProjektow.ts` (deduplikacja względem bieżącego projektu)
- `src/ui/start/ListaProjektow.tsx` (zakładki `Moje projekty` / `Moje szablony`, filtr w szablonach, podgląd `Awers + Rewers`)
- `src/ui/App.css` (style zakładek `.zakladki-listy`, filtra i podwójnego podglądu `.miniatura-para`, wyłącznie tokeny z `tokeny.css`)
- `src/ui/kartka/PanelRewersuIAwersu.tsx` i `src/ui/kartka/EdytorKartki.tsx` (ponowne użycie istniejącego szablonu zamiast tworzenia duplikatów)
- `src/i18n/pl.ts`, `src/i18n/en.ts`
- Testy jednostkowe (`src/dane/baza.test.ts` / `src/ui/baza.test.ts`) i weryfikacja istniejących testów Playwright.

---

### Etap P2 — Ręczny przycisk „Zapisz” obok nazwy projektu w Edytorze kart

**Zakres:**

1. **Tryb ręcznego zapisu w `useProjekt` (`src/ui/useProjekt.ts`):**
   - Dodać opcję np. `autozapis?: boolean` (domyślnie `true` dla Edytora szablonu i Edytora rewersu, `false` dla Edytora kart, albo przełączalne przez `EdytorKartki`).
   - Udostępnić w `ProjektWEdycji`:
     - `niezapisane: boolean` (czy bieżący stan różni się od ostatnio zapisanego w IndexedDB),
     - `zapiszTeraz(): Promise<void>` (natychmiastowy zapis projektu + zasobów + miniatury do IndexedDB i wyczyszczenie flagi `niezapisane`).
   - Dla nowych projektów otwartych w Edytorze kart: dopóki użytkownik nie kliknie `Zapisz`, nie tworzymy pustego śmieciowego wpisu w `Moich projektach` (albo wyraźnie oznaczamy stan `Niezapisany`).
2. **Przycisk „Zapisz” w pasku górnym Edytora kart (`src/ui/kartka/EdytorKartki.tsx`):**
   - Obok pola nazwy projektu (zamiast samego tekstu `Zapisano`): przycisk **`Zapisz`** (aktywny i wyróżniony, gdy `niezapisane === true`; po zapisie `Zapisano ✓` / nieaktywny).
   - Skrót klawiszowy `Ctrl+S` / `Cmd+S` (z `preventDefault()`) wywołuje `zapiszTeraz()`.
   - Opcjonalnie obok przycisk **`Zapisz jako kopię`** (tworzy nowy `projekt.id` i zapisuje wariant).
3. **Ochrona przed utratą zmian:**
   - Listener `beforeunload` w Edytorze kart, gdy `niezapisane === true`.
   - Kliknięcie `← Powrót` lub logo `Karty` przy `niezapisane === true` wyświetla okno potwierdzenia („Masz niezapisane zmiany: Zapisz i wyjdź / Wyjdź bez zapisywania / Zostań”).
4. **Aktualizacja testów:**
   - Przejrzeć testy Playwright wywołujące `zapisano(page)` w Edytorze kart (`testy/kartkaUI.ts`, `testy/dwustronny.spec.ts`, `testy/rewersy.spec.ts` itd.) — tam, gdzie test oczekuje utrwalenia po przeładowaniu, kliknąć `Zapisz` (lub dodać krok do helpera `zapisano`).

**Pliki do zmiany w P2:**

- `src/ui/useProjekt.ts`, `src/ui/useProjekt.test.tsx`
- `src/ui/kartka/EdytorKartki.tsx`
- `src/i18n/pl.ts`, `src/i18n/en.ts`
- Testy Playwright korzystające z zapisu w Edytorze kart.

---

### Etap P3 — Porządek w lewym menu startowym i akcja „Użyj w projekcie”

**Zakres:**

1. W `src/ui/start/Start.tsx`: wyraźny podział lewej kolumny na **Nowy projekt** (karty do druku / Mausritter) i **Nowy szablon** (Awers / Rewers), spójny z dwiema zakładkami pośrodku.
2. Na kafelku w zakładce **Moje szablony** (`ListaProjektow.tsx`): przycisk `Użyj w projekcie`, który otwiera nowy projekt w Edytorze kart z tym szablonem jako awersem (lub rewersem) bez modyfikowania oryginalnego szablonu.

---

## 3. Decyzje i zasady (sekcja 9)

- **P-1 (brak migracji schematu):** `WERSJA_SCHEMATU` zostaje bez zmian; podział na zakładki i deduplikacja działają na istniejących danych w IndexedDB, więc żaden istniejący projekt użytkownika nie zostanie utracony.
- **P-2 (deduplikacja po nazwie):** listy szablonów awersów i rewersów deduplikują wpisy po `nazwa.trim().toLowerCase()` (najnowszy wygrywa) i pomijają nazwy już obecne w bieżącym projekcie — eliminuje to powielanie kopii przy wyborze między projektami.
- **Wskazówki dla P2 (ręczny zapis):** przy `autozapis: false` funkcja `poOstatnimZapisie()` z `src/ui/useProjekt.ts` nadal zwraca rozwiązaną obietnicę (gdy brak trwającego zapisu), a odświeżenie `F5` dla niezapisanego projektu jest chronione przez `beforeunload`.
- **Zgodność ze środowiskiem i CI:**
  - Kolory wyłącznie przez tokeny w `src/ui/tokeny.css` (sprawdza `src/ui/literalyKolorow.test.ts`).
  - Wszystkie teksty UI przez `src/i18n/pl.ts` i `src/i18n/en.ts` (parytet i brak polskich znaków w `en.ts` sprawdza `src/i18n/i18n.test.ts`).
  - Po każdym etapie: `prettier --check`, niezależny przegląd według `.claude/agents/recenzent.md`, PR i weryfikacja CI.
