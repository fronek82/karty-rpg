# Etap N12 – przełącznik odmian

Cel: w jednym miejscu karty można przygotować kilka gotowych odmian elementu (np. wiersz
„ludzik + Podejrzany” i wiersz „lupa + Wskazówka”). Na karcie widać tylko jedną z nich – tę,
której wartość wpisano w jednej kolumnie danych (CSV / XLSX / panel karty), np. `1`, `2`, `3`.
Tył karty wybiera odmianę tak samo, z tej samej kolumny przodu.

## Zakres

1. **Model** – schemat 34:
   - `Kontener.przelacznik?: { klucz?: string; domyslna?: string }` – kontener (wiersz,
     kolumna, warstwy, swobodny) staje się przełącznikiem: z dzieci pokazuje jedno.
     `klucz` – kolumna danych karty (na tyle zwykle brak: wartość z przodu po nazwie),
     `domyslna` – wartość, gdy karta nie ma wartości.
   - `WezelBazowy.odmiana?: string` – wartość dziecka przełącznika. Pusta = numer pozycji
     (1, 2, 3…).
   - Migracja 33→34 bez zmian danych.
2. **Silnik** – `wybranaOdmiana` (`src/model/szablon.ts`): wartość z danych → dziecko o tej
   wartości (bez wielkości liter i spacji na brzegach) → odmiana domyślna → pierwsze dziecko.
   `renderujKarte` ukrywa pozostałe dzieci (jak pola „ukryj i zwiń” – nie zajmują miejsca).
   Nieznana wartość daje ostrzeżenie `nieznana-odmiana` i odmianę domyślną.
3. **Tył** – przełącznik tyłu o tej samej nazwie co przełącznik przodu bierze wartość z danych
   karty (jak pola o tej samej nazwie).
4. **Dane** – kolumna przełącznika w `kolumnySzablonu` (z listą odmian `opcje`), w kluczach
   szablonu, w kopii elementu (nowy klucz); import CSV/XLSX i szablon CSV bez zmian (zwykła
   kolumna tekstowa).
5. **UI**:
   - panel kontenera, sekcja „Odmiany z danych”: włączenie przełącznika (dzieci bez wartości
     dostają kolejne numery), kolumna danych, wartości odmian (z nazwą dziecka), odmiana
     domyślna;
   - podgląd w edytorze pokazuje odmianę, w której leży zaznaczony element;
   - panel karty (Edytor kart): lista wyboru odmiany zamiast pola tekstowego;
   - „Kolor z danych” może korzystać z kolumny przełącznika.
6. **i18n**, **testy** (Vitest: wybór odmiany, scena, tył, kolumny, kopia, migracja;
   Playwright: włączenie przełącznika i podgląd).

## Decyzje

- Przełącznik to ustawienie istniejącego kontenera, a nie nowy typ węzła: odmiany układają
  się zgodnie z typem kontenera (np. w kolumnie – jedna pod drugą, ale widoczna zawsze jedna),
  a cały kod operujący na typach kontenerów (menu, konwersje, układ) zostaje bez zmian.
- Dziecko bez wpisanej wartości odpowiada numerowi swojej pozycji – „1, 2, 3” działa od razu.
  Przy włączaniu przełącznika numery są wpisywane jawnie, żeby zmiana kolejności dzieci nie
  zmieniała kart.
- Nieznana wartość nie chowa wszystkiego: karta pokazuje odmianę domyślną i ostrzeżenie,
  żeby literówka w CSV była widoczna, a karta nie była pusta.
- W podglądzie edytora zaznaczenie elementu w odmianie pokazuje tę odmianę – bez osobnego
  przełącznika podglądu.
- Element wstawiany do przełącznika (nowy, kopia, przeniesiony) zachowuje swoją wartość odmiany,
  jeśli jest wolna, a inaczej dostaje pierwszy wolny numer – żadna odmiana nie zostaje zasłonięta
  przez powtórzoną wartość. Wyjęty z przełącznika traci wartość odmiany.
- Zamiana przełącznika na kontener swobodny bierze położenia z bieżącego podglądu, w którym widać
  jedną odmianę – pozostałe trafiają w lewy górny róg (jak pola „ukryj i zwiń”) i trzeba je ustawić
  ręcznie po zaznaczeniu (podgląd pokazuje wtedy zaznaczoną odmianę).
- Ten sam klucz przełącznika w wariantach układu przodu: lista odmian w panelu karty łączy
  wartości ze wszystkich wariantów.
