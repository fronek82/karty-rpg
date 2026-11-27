# Plan S – „Moje szablony” osobno od projektów

Decyzja właściciela z 27.11.2026: **szablony projektuje się osobno, a w projektach składa się
z nich karty**. Projekt nie zmienia szablonów. Dotychczasowy model, w którym każdy projekt miał
własną listę szablonów (`Projekt.szablony`, `Projekt.rewersy`), zostaje zastąpiony jedną
biblioteką szablonów (przody i tyły).

Plan zmienia model danych, bazę, przepływ UI z planu UI2 i format plików. Realizacja etapami
S1…S6, każdy etap osobnym PR. Zasady pracy i oszczędzania limitu jak w `docs/plan-UI2.md`
(sekcja 8) i w `CLAUDE.md`.

## 0. Nazewnictwo w interfejsie

W interfejsie miejsce na szablony nazywa się zawsze **„Moje szablony”**. Słowo „biblioteka” jest
zarezerwowane dla obrazów, czcionek i ozdobników (N8). W kodzie i w tym planie „biblioteka szablonów”
oznacza tabelę `szablony`. Teksty dla użytkownika nie używają słowa „biblioteka” dla szablonów,
np. „Edytuj w Moich szablonach ↗”, „Z Moich szablonów”.

## 1. Pojęcia

- **Szablon** (przód) i **tył** (rewers) projektuje się w **bibliotece szablonów** użytkownika,
  niezależnej od projektów. Każdy ma własne id, nazwę, datę zmiany i miniaturę.
- **Projekt** to talia lub talie kart i ustawienia druku. Dodanie szablonu do projektu robi jego
  **kopię w projekcie**. Karty korzystają z tej kopii i trzymają tylko dane karty (wartości pól,
  kopie, obraz).
- **Projekt nie edytuje szablonów.** W projekcie nie ma edytora szablonu ani zakładek szablonów.
  Wygląd zmienia się w bibliotece, a projekt może potem przyjąć nową wersję (sekcja 2).
- Pakiety gier (Mausritter) zostają bez zmian: ich typy kart są wbudowane i nie trafiają do biblioteki.

## 2. Powiązanie projektu z szablonem (D-S1)

**Kopia w projekcie.** Zmiana szablonu w bibliotece **nie zmienia** istniejących projektów,
więc raz złożona i wydrukowana talia zawsze wygląda tak samo.

- Kopia w projekcie pamięta, skąd pochodzi: `zrodlo: { id, hash }` (id szablonu w bibliotece i skrót
  wersji, z której zrobiono kopię).
- Gdy szablon w bibliotece ma inny `hash` niż kopia w projekcie, w kroku Karty przy tym szablonie
  pojawia się znaczek **„Jest nowsza wersja szablonu”** i przycisk **„Aktualizuj karty (N)”**.
  Aktualizacja podmienia kopię i zostawia dane kart; pola dopasowuje po nazwie, jak dziś przy zmianie
  szablonu. Przed aktualizacją pokazuje się podgląd „przed / po” jednej karty i jest pasek „Cofnij”.
- Usunięcie szablonu z biblioteki nie psuje projektów, bo mają swoje kopie. Ostrzeżenie mówi tylko,
  w ilu projektach jest kopia.
- „Edytuj szablon ↗” z projektu otwiera **szablon w bibliotece**. Po zapisie i powrocie do projektu
  widać przy nim „Jest nowsza wersja szablonu”, więc to użytkownik decyduje, czy przenieść zmiany.

## 3. Model i baza (S1)

- Nowa tabela Dexie (wersja 6): `szablony: 'id, rodzaj, zmieniono, hash'` (`rodzaj`: `awers` | `rewers`),
  rekord = pełny dokument szablonu albo tyłu + `nazwa`, `zmieniono`, `hash` (skrót treści bez `id`,
  `nazwa`, dat).
- `Projekt.szablony` i `Projekt.rewersy` **zostają** jako kopie w projekcie. Każda kopia dostaje
  opcjonalne `zrodlo?: { id: string; hash: string }`. Silnik, scena, druk i PDF działają bez zmian.
- `WERSJA_SCHEMATU = 36`, migracja w `src/dane/schemat.ts` + migracja bazy po otwarciu
  (jak `migrujDoBiblioteki` w N8):
  - **wszystkie** szablony i tyły ze wszystkich projektów trafiają do biblioteki (decyzja właściciela);
    identyczne (ten sam `hash`) łączone w jeden rekord; powtórzone nazwy różnych szablonów dostają
    sufiks „(2)”, „(3)”…;
  - kopie w projektach dostają `zrodlo` wskazujące rekord biblioteki;
  - z projektów usuwane są kopie szablonów **nieużywane przez żadną kartę** (zostały w bibliotece),
    np. nadmiarowe „Warlock” / „Wyprawa za mur”;
  - kopia bezpieczeństwa przed migracją (`kopiaMigracji`) jak w N8;
  - test migracji na projektach z duplikatami i nieużywanymi szablonami.

## 4. Pliki (S1)

- `.kartyrpg` (projekt): bez zmian, zawiera kopie szablonów projektu. Przy imporcie szablony
  z pliku trafiają też do biblioteki (łączenie po `hash`, sufiks przy zajętej nazwie), a kopie
  w projekcie dostają `zrodlo`.
- `.kartyrpg-szablon`: import i eksport pojedynczego szablonu działa na bibliotece.

## 5. Interfejs

### 5.1 Strona główna (S3)

- Zakładki równorzędne: **Moje projekty** | **Moje szablony**.
- Lewa kolumna: **„+ NOWE KARTY”** (nowy projekt), **„+ NOWY SZABLON”**, **„Mausritter A4”**,
  wsparcie. To zmienia D1 z planu UI2.
- Kafelek szablonu: przód i tył obok siebie (jak miniatury projektów, D17), nazwa, wymiary,
  „kopie w N projektach” lub „nieużywany”, przyciski **Edytuj**, **Duplikuj**, menu: Eksport, Usuń.

### 5.2 Okno „Nowy szablon” (S3)

To dawna ścieżka „Pusta karta” z okna „Nowy projekt”: nazwa, rozmiar (presety + własny),
**Pionowo | Poziomo**, strony **Przód / Tył** (co najmniej jedna), import pliku `.kartyrpg-szablon`.
Przycisk **„Utwórz szablon”** otwiera edytor szablonu.

### 5.3 Okno „Nowy projekt” (S3)

Nazwa, **wybór z „Moich szablonów”** (kafelki z miniaturami, wielokrotny wybór, szukaj; można też
nie wybrać żadnego i dodać później) albo **import pliku projektu**. Przycisk **„Utwórz projekt”**
otwiera krok Karty. Gdy biblioteka jest pusta, okno podpowiada najpierw „+ Nowy szablon”.

### 5.4 Edytor szablonu (S4)

- Trasa `#/szablon/<id>` (bez projektu). Nagłówek: **„← Szablony”**, nazwa szablonu, bez mapy kroków,
  ↶ ↷, ⚙, stan zapisu. Przy wejściu z projektu: „← Wróć do projektu …”.
- Pasek nad kartą: **bez zakładek wielu szablonów** i bez „＋ Nowy szablon`. Zostają tylko
  przełącznik **Przód | Tył** (tył przypięty do szablonu albo „brak tyłu”) i menu **„Szablon ▾”**:
  Duplikuj, Eksport, Import (zastąp), Układ ze zdjęcia, Zmień rozmiar, Usuń.
- Dopisek pod nazwą: „Kopie w N projektach – zmiany nie zmienią ich, dopóki ich nie zaktualizujesz”.
- Reszta edytora (paski, panele, Struktura, linijki, pasek stanu) bez zmian (R4, R5, R10).

### 5.5 Projekt (S5)

- Kroki w nagłówku: **1 Karty → 2 Druk**, czyli bez kroku „Szablony”.
- Lewy pasek kroku Karty, dwie grupy:
  - **„W projekcie”**: kopie szablonów, z których są karty. Przeciągnięcie albo kliknięcie dodaje kartę.
    Przy kopii, dla której biblioteka ma nowszą wersję, jest znaczek i „Aktualizuj karty (N)” (sekcja 2).
  - **„Z Moich szablonów”**: pozostałe szablony z szukaniem. Przeciągnięcie albo kliknięcie robi kopię
    w projekcie i dodaje kartę.
  - Na dole „＋ Nowy szablon” otwiera okno 5.2, a po zapisie wraca do projektu.
- Panel karty: „Szablon: X · Edytuj w Moich szablonach ↗”. „Tył karty”: wybór z tyłów projektu
  i z „Moich szablonów” (wybór stamtąd robi kopię) albo „brak”.
- **„Przenieś na szablon…”** (zaznaczone karty → inny szablon projektu, np. nowy „Zaklęcie z obrazkiem”):
  dane kart przechodzą po nazwach pól, a pola bez odpowiednika zostają puste. Przed zmianą jest lista
  pól przeniesionych i pominiętych, po zmianie pasek „Cofnij”. Szablony się przy tym nie zmieniają.
- Druk bez zmian.

### 5.6 Mausritter

Bez zmian. Typy kart są wbudowane, kroki: Karty na arkuszach → Druk.

## 6. Etapy

| Etap | Zakres                                                                                              | Testy                                                                                         |
| ---- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| S1   | Model, tabela `szablony` (Dexie 6), schemat 36, migracja z łączeniem duplikatów, pliki              | Vitest: migracja (duplikaty, sufiksy nazw, odwołania kart), import/eksport                    |
| S2   | Kopie i aktualizacja: `zrodlo`, wykrywanie nowszej wersji, „Aktualizuj karty (N)” z „Cofnij”        | Vitest: wykrycie zmiany `hash`, aktualizacja zachowuje dane kart                              |
| S3   | Strona główna (Moje szablony), okna „Nowy szablon” i „Nowy projekt”                                 | Playwright: utworzenie szablonu, projekt z wybranych szablonów                                |
| S4   | Edytor szablonu poza projektem (`#/szablon/<id>`), menu, dopisek o kopiach                          | Playwright: edycja w bibliotece nie zmienia karty w projekcie, dopóki nie „Aktualizuj”        |
| S5   | Projekt: kroki Karty → Druk, lewy pasek „W projekcie” / „Z Moich szablonów”, „Przenieś na szablon…” | Playwright: dodanie karty z Moich szablonów, zmiana tyłu karty, przeniesienie kart z „Cofnij” |
| S6   | Instrukcja PL/EN, zrzuty, porządki (usunięcie martwego kodu zakładek szablonów projektu)            | Galeria zrzutów                                                                               |

Wzorce PNG kart i arkuszy nie mogą się zmienić. Wygląd kart po migracji jest identyczny.

## 7. Decyzje

- **D-S1** Projekt ma kopie szablonów z biblioteki. Zmiana w bibliotece nie rusza projektów, dopóki
  użytkownik nie kliknie „Aktualizuj karty” (sekcja 2).
- **D-S2** Przy migracji wszystkie szablony i tyły trafiają do biblioteki. Identyczne są łączone,
  a powtórzone nazwy dostają sufiksy. Nieużywane kopie są usuwane z projektów.
- **D-S3** Tyły są w bibliotece tak samo jak przody.
- **D-S4** Projekt ma kroki Karty → Druk. Krok „Szablony” znika z projektu (zmienia UI2 5.3 i mapę
  kroków z 4.1).
- **D-S6** Nazwa w interfejsie: „Moje szablony”, napis „Jest nowsza wersja szablonu”; słowo „biblioteka” tylko dla obrazów, czcionek i ozdobników.
- **D-S7** „Przenieś na szablon…” przenosi dane zaznaczonych kart na inny szablon po nazwach pól.
- **D-S5** Pakiety gier (Mausritter) nie korzystają z biblioteki szablonów.
- **D-S8** Wpis w tabeli `szablony` (`WpisSzablonu`) przechowuje także podzbiór ról czcionek używanych przez szablon/tył (`role`) oraz opcjonalny `domyslnyRewersId` (dla przodu); samodzielne projekty rewersowe (`czyProjektRewersowy`) i dawne schowki `tylkoSzablony` są usuwane z `projekty` po przeniesieniu ich szablonów i tyłów w migracji S1.
- **D-S9** Bezpośrednie trasy `#/projekt/<id>/szablon/<sid>` i `#/projekt/<id>/rewers/<rid>` w `EdytorStrona.tsx` pozostają bez linków w UI projektu (krok „Szablony” i zakładki wielu szablonów zostały usunięte), aby nie zrywać starszych testów jednostkowych edytora opartych na `szablonUI.ts`; użytkownik edytuje szablony wyłącznie przez „Moje szablony” (`#/szablon/<id>`).

## 8. Stan

### Scalone etapy

- **S1** (PR #135) — model `ZrodloSzablonu`, schemat v36, tabela `szablony` (Dexie v6), migracja z kopią bezpieczeństwa `kopiaMigracji`, łączenie duplikatów po `hash`, sufiksy `(2)`/`(3)`, usuwanie nieużywanych szablonów z projektów, pliki `.kartyrpg` i `.kartyrpg-szablon`, testy Vitest.
- **S2** (PR #137) — `src/dane/aktualizacjaSzablonu.ts`, wykrywanie nowszej wersji po `hash`, baner „Jest nowsza wersja szablonu” i „Aktualizuj karty (N)” z podglądem Przed/Po (`OknoAktualizacjiSzablonu.tsx`) oraz paskiem „Cofnij”, testy Vitest.
- **S3** (PR #138) — strona główna „Moje szablony” z miniaturami Przód+Tył i licznikiem kopii w projektach, okna „Nowy szablon” (`OknoNowySzablon.tsx`) i „Nowy projekt” (`OknoNowyProjekt.tsx`), przycisk `+ NOWY SZABLON`, test Playwright `testy/plan-s-s3.spec.ts`.
- **S4** (PR #139) — samodzielny edytor szablonu poza projektem `#/szablon/<id>` (`EdytorSzablonuStrona.tsx`), powrót „← Szablony” / „← Wróć do projektu …”, dopisek o kopiach w projektach, przełącznik Przód | Tył (oraz „+ Dodaj tył”), menu „Szablon ▾” z „Importuj (zastąp)…” i „Usuń szablon” (z potwierdzeniem), test Playwright `testy/plan-s-s4.spec.ts`.
- **S5** (PR #140) — kroki projektu **1 Karty → 2 Druk**, lewy pasek „W projekcie” / „Z Moich szablonów” z wyszukiwarką i „＋ Nowy szablon”, link „Edytuj w Moich szablonach ↗”, wybór tyłu karty także z „Moich szablonów”, okno „Przenieś na szablon…” (`OknoPrzeniesieniaKart.tsx`) z listą pól i „Cofnij”, test Playwright `testy/plan-s-s5.spec.ts`.
- **S6** (bieżący PR) — zaktualizowana instrukcja PL/EN (`instrukcja/index.html`), usunięcie martwego kodu zakładek wielu szablonów projektu (`EdytorDrzewa.tsx`, `EdytorKarty.tsx`, `edytorUi2.css`), aktualizacja `CLAUDE.md` i sekcji „Stan” w `docs/plan-S.md`.
- **Zrzuty / wzorce PNG**: w środowisku VM brak lokalnego Chromium, dlatego galeria zrzutów instrukcji nie była regenerowana w S6; wzorce PNG kart, arkuszy i przykładów pozostały w 100% bez zmian przez cały Plan S (S1–S6).

### Otwarte PR

- Brak otwartych/zablokowanych PR z poprzednich etapów (S1–S5 scalone przy zielonym CI; S6 w bieżącym PR).

### Jak sprawdzić całość krok po kroku

1. **Strona główna i „Moje szablony” (S3)**: otwórz ekran startowy, kliknij **+ NOWY SZABLON**, utwórz przód z przypiętym tyłem (np. „Zaklęcie”), a następnie drugi szablon (np. „Broń”) oraz osobny tył (np. „Rewers gildii”). Sprawdź zakładkę **Moje szablony** — widać miniatury, wymiary, liczbę kopii w projektach, **Edytuj**, **Duplikuj**, **Eksport** i **Usuń** z paskiem **Cofnij**.
2. **Edytor szablonu poza projektem (S4)**: otwórz „Zaklęcie” przyciskiem **Edytuj** (`#/szablon/<id>`). Sprawdź nagłówek **← Szablony** bez mapy kroków, brak zakładek wielu szablonów, przełącznik **Przód | Tył** (a w szablonie bez tyłu przycisk **+ Dodaj tył**) oraz menu **Szablon ▾** (Duplikuj, Eksport, Importuj (zastąp)…, Układ ze zdjęcia, Zmień rozmiar, Usuń szablon). Dodaj pole tekstowe i zapisz (**Ctrl+S**).
3. **Nowy projekt i kroki Karty → Druk (S3, S5)**: na Starcie kliknij **+ NOWE KARTY**, wybierz „Zaklęcie” i utwórz projekt. W nagłówku projektu widać wyłącznie **1 Karty → 2 Druk** (bez kroku „Szablony”). Dodaj kartę z grupy **W projekcie**, wpisz dane i zapisz projekt.
4. **Niezależność kopii i „Aktualizuj karty” (S2, S4)**: w prawym panelu karty kliknij **Edytuj w Moich szablonach ↗** — nagłówek edytora pokazuje **← Wróć do projektu …** oraz dopisek „Kopia w 1 projekcie – zmiany nie zmienią jej, dopóki jej nie zaktualizujesz”. Dodaj kolejne pole i zapisz. Kliknij **← Wróć do projektu …**: karta zachowała stary wygląd, a nad listą widać **Jest nowsza wersja szablonu** i **Aktualizuj karty (1)**. Kliknij, obejrzyj podgląd **Przed / Po** i listę pól, zatwierdź — dane karty zostały zachowane, a na dole działa **Cofnij**.
5. **Dodawanie z „Moich szablonów”, zmiana tyłu i „Przenieś na szablon…” (S5)**: w lewym pasku znajdź „Broń” w grupie **Z Moich szablonów** (przetestuj wyszukiwarkę) i kliknij — szablon trafi do grupy **W projekcie** i doda kartę. Zmień **Tył karty** na „Rewers gildii” z grupy **Z Moich szablonów**. Kliknij **Przenieś na szablon…**, sprawdź listę pól przeniesionych/pominiętych/nowych, zatwierdź i przetestuj **Cofnij**.
6. **Druk i instrukcja (S5, S6)**: przejdź do kroku **2 Druk** i sprawdź podgląd arkusza. Otwórz instrukcję (⚙ → **Instrukcja ↗**) w PL i EN i sprawdź zaktualizowaną sekcję „Moje projekty i Moje szablony”.
