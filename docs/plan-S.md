# Plan S – biblioteka szablonów osobno od projektów

Decyzja właściciela z 27.11.2026: **szablony projektuje się osobno, a w projektach składa się
z nich karty**. Projekt nie zmienia szablonów. Dotychczasowy model, w którym każdy projekt miał
własną listę szablonów (`Projekt.szablony`, `Projekt.rewersy`), zostaje zastąpiony jedną
biblioteką szablonów (przody i tyły).

Plan zmienia model danych, bazę, przepływ UI z planu UI2 i format plików. Realizacja etapami
S1…S6, każdy etap osobnym PR. Zasady pracy i oszczędzania limitu jak w `docs/plan-UI2.md`
(sekcja 8) i w `CLAUDE.md`.

## 1. Pojęcia

- **Szablon** (przód) i **tył** (rewers) to obiekty biblioteki użytkownika, niezależne od projektów.
  Mają własne id, nazwę, datę zmiany i miniaturę.
- **Projekt** to talia lub talie kart i ustawienia druku. Każda karta wskazuje szablon przodu
  z biblioteki (i opcjonalnie tył z biblioteki) oraz trzyma **tylko dane karty** (wartości pól,
  kopie, obraz).
- **Projekt nie edytuje szablonów.** Z projektu można otworzyć edytor szablonu („Edytuj szablon ↗”),
  ale edytuje się wtedy szablon w bibliotece.
- Pakiety gier (Mausritter) zostają bez zmian: ich typy kart są wbudowane i nie trafiają do biblioteki.

## 2. Powiązanie projektu z szablonem (D-S1)

Karty projektu **odwołują się** do szablonu z biblioteki: zmiana szablonu zmienia wygląd jego kart
we wszystkich projektach. Zabezpieczenia:

- edytor szablonu pokazuje pasek „Używany w N projektach (M kart) – zmiany zmienią ich wygląd”
  z listą projektów;
- w menu „Szablon ▾”: **„Zapisz jako nowy szablon”**, czyli wariant bez wpływu na istniejące karty;
- usunięcie szablonu używanego przez karty jest zablokowane. Komunikat podaje projekty, a obok jest
  przycisk „Pokaż projekty”.

Jeśli właściciel woli kopię w projekcie (zmiany w bibliotece nie ruszają starych projektów),
zmienia się tylko ta sekcja i etap S2. Reszta planu zostaje.

## 3. Model i baza (S1)

- Nowa tabela Dexie (wersja 6): `szablony: 'id, rodzaj, zmieniono, hash'` (`rodzaj`: `awers` | `rewers`),
  rekord = pełny dokument szablonu albo tyłu (jak dziś w `Projekt.szablony` / `Projekt.rewersy`)
  - `nazwa`, `zmieniono`, `hash` (skrót treści bez `id`, `nazwa`, dat).
- `Projekt`: usunąć `szablony` i `rewersy` (zostają tylko w projektach pakietów, np. Mausritter).
  Karty dalej mają `szablonId` i `rewersId`, ale wskazują rekordy biblioteki.
- `WERSJA_SCHEMATU = 36`, migracja w `src/dane/schemat.ts` + migracja bazy po otwarciu
  (jak `migrujDoBiblioteki` w N8):
  - **wszystkie** szablony i tyły ze wszystkich projektów trafiają do biblioteki (decyzja właściciela);
  - identyczne kopie (ten sam `hash`) łączone w jeden rekord; odwołania w kartach przepisane na id
    połączonego rekordu;
  - powtórzone nazwy różnych szablonów dostają sufiks „(2)”, „(3)”…;
  - kopia bezpieczeństwa przed migracją (`kopiaMigracji`) jak w N8;
  - test migracji na projektach z duplikatami (np. 2× „Warlock”, 2× „Wyprawa za mur”).
- `BazaProjektow.wczytaj` składa widok projektu z szablonami z biblioteki (jak z zasobami w N8),
  więc silnik, scena, druk i PDF działają bez zmian.

## 4. Pliki (S1)

- `.kartyrpg` (projekt): dalej zawiera kopie użytych szablonów i tyłów, żeby plik był samodzielny.
  Przy imporcie szablon o tym samym `hash` łączy się z istniejącym, a inny trafia do biblioteki jako
  nowy (z sufiksem, jeśli nazwa już jest).
- `.kartyrpg-szablon`: import i eksport pojedynczego szablonu działa na bibliotece.

## 5. Interfejs

### 5.1 Strona główna (S3)

- Zakładki równorzędne: **Moje projekty** | **Moje szablony**.
- Lewa kolumna: **„+ NOWE KARTY”** (nowy projekt), **„+ NOWY SZABLON”**, **„Mausritter A4”**,
  wsparcie. To zmienia D1 z planu UI2.
- Kafelek szablonu: przód i tył obok siebie (jak miniatury projektów, D17), nazwa, wymiary,
  „w N projektach” lub „nieużywany”, przyciski **Edytuj**, **Duplikuj**, menu: Eksport, Usuń.

### 5.2 Okno „Nowy szablon” (S3)

To dawna ścieżka „Pusta karta” z okna „Nowy projekt”: nazwa, rozmiar (presety + własny),
**Pionowo | Poziomo**, strony **Przód / Tył** (co najmniej jedna), import pliku `.kartyrpg-szablon`.
Przycisk **„Utwórz szablon”** otwiera edytor szablonu.

### 5.3 Okno „Nowy projekt” (S3)

Nazwa, **wybór szablonów z biblioteki** (kafelki z miniaturami, wielokrotny wybór, szukaj; można też
nie wybrać żadnego i dodać później) albo **import pliku projektu**. Przycisk **„Utwórz projekt”**
otwiera krok Karty. Gdy biblioteka jest pusta, okno podpowiada najpierw „+ Nowy szablon”.

### 5.4 Edytor szablonu (S4)

- Trasa `#/szablon/<id>` (bez projektu). Nagłówek: **„← Szablony”**, nazwa szablonu, bez mapy kroków,
  ↶ ↷, ⚙, stan zapisu. Przy wejściu z projektu: „← Wróć do projektu …”.
- Pasek nad kartą: **bez zakładek wielu szablonów** i bez „＋ Nowy szablon`. Zostają tylko
  przełącznik **Przód | Tył** (tył przypięty do szablonu albo „brak tyłu”) i menu **„Szablon ▾”**:
  Duplikuj, Zapisz jako nowy szablon, Eksport, Import (zastąp), Układ ze zdjęcia, Zmień rozmiar, Usuń.
- Pasek „Używany w N projektach…” (sekcja 2).
- Reszta edytora (paski, panele, Struktura, linijki, pasek stanu) bez zmian (R4, R5, R10).

### 5.5 Projekt (S5)

- Kroki w nagłówku: **1 Karty → 2 Druk**, czyli bez kroku „Szablony”.
- Lewy pasek kroku Karty: **„Szablony z biblioteki”**. Na górze szablony użyte w projekcie, pod nimi
  pozostałe, z szukaniem. Szablon przeciąga się na listę albo klika, żeby dodać kartę.
  Na dole „＋ Nowy szablon” (otwiera okno 5.2, po zapisie wraca do projektu).
- Panel karty: „Szablon: X · Edytuj szablon ↗” otwiera edytor szablonu z powrotem do projektu.
  „Tył karty”: wybór z tyłów biblioteki albo „brak”.
- Druk bez zmian.

### 5.6 Mausritter

Bez zmian. Typy kart są wbudowane, kroki: Karty na arkuszach → Druk.

## 6. Etapy

| Etap | Zakres                                                                                      | Testy                                                                      |
| ---- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| S1   | Model, tabela `szablony` (Dexie 6), schemat 36, migracja z łączeniem duplikatów, pliki      | Vitest: migracja (duplikaty, sufiksy nazw, odwołania kart), import/eksport |
| S2   | Powiązanie i zabezpieczenia: liczenie użyć, blokada usuwania, „Zapisz jako nowy szablon”    | Vitest: licznik użyć, blokada usuwania używanego                           |
| S3   | Strona główna (Moje szablony), okna „Nowy szablon” i „Nowy projekt”                         | Playwright: utworzenie szablonu, projekt z wybranych szablonów             |
| S4   | Edytor szablonu poza projektem (`#/szablon/<id>`), pasek użyć, menu                         | Playwright: edycja szablonu zmienia kartę w projekcie; powrót do projektu  |
| S5   | Projekt: kroki Karty → Druk, lewy pasek „Szablony z biblioteki”, edycja szablonu z projektu | Playwright: dodanie karty z biblioteki, zmiana tyłu karty                  |
| S6   | Instrukcja PL/EN, zrzuty, porządki (usunięcie martwego kodu zakładek szablonów projektu)    | Galeria zrzutów                                                            |

Wzorce PNG kart i arkuszy nie mogą się zmienić. Wygląd kart po migracji jest identyczny.

## 7. Decyzje

- **D-S1** Karty odwołują się do szablonu z biblioteki. Zmiany szablonu zmieniają karty we wszystkich
  projektach, a zabezpieczeniem jest pasek użyć i „Zapisz jako nowy szablon” (sekcja 2).
- **D-S2** Przy migracji wszystkie szablony i tyły trafiają do biblioteki. Identyczne są łączone,
  a powtórzone nazwy dostają sufiksy.
- **D-S3** Tyły są w bibliotece tak samo jak przody.
- **D-S4** Projekt ma kroki Karty → Druk. Krok „Szablony” znika z projektu (zmienia UI2 5.3 i mapę
  kroków z 4.1).
- **D-S5** Pakiety gier (Mausritter) nie korzystają z biblioteki szablonów.
