# Etap N11 – kolory projektu

Cel: kolor użyty na jednej stronie karty (albo w innym szablonie projektu) można wybrać
na drugiej jednym kliknięciem, bez przepisywania kodu koloru. Wybrane kolory można też
zapisać w projekcie na stałe.

## Zakres

1. **Model** – schemat 33: opcjonalne `Projekt.paleta: Kolor[]`, czyli kolory zapisane przez
   użytkownika w kolejności dodania. Migracja 32→33 nie zmienia danych. Paleta jest częścią
   projektu, więc trafia do eksportu `.kartyrpg` i do kopii zapasowych.
2. **Kolory użyte** – `src/dane/koloryProjektu.ts`:
   - `koloryUzyte(projekt)` przegląda przody (`szablony`) i tyły (`rewersy`) i zbiera
     wszystkie wartości `#rgb` / `#rrggbb`. Wynik jest w małych literach, w postaci
     6-cyfrowej, od najczęściej używanego, najwyżej `LIMIT_KOLOROW_UZYTYCH`.
   - Pomijane są teksty przykładowe i parametry (`przyklad`, `parametry`), bo to treść kart,
     a nie kolory.
   - Funkcje `dodajDoPalety` i `usunZPalety` zmieniają paletę projektu.
3. **UI** – kontekst `KoloryProjektu` (`src/ui/szablon/koloryProjektu.tsx`):
   - Kontekst podaje Edytor karty, czyli przód i tył (`EdytorKarty.tsx`).
   - Przy każdym `PoleKoloru` i przy kolorze zabarwienia tekstury tyłu jest przycisk z ikoną
     palety. Rozwija pod polem panel „Kolory projektu” z dwiema grupami:
     - „Zapisane” – każdą próbkę można usunąć,
     - „Użyte w projekcie”.
   - Kliknięcie próbki ustawia kolor pola. Przycisk „Zapisz ten kolor” dodaje bieżący kolor
     pola do zapisanych.
   - Bez kontekstu, np. w kreatorze nowego szablonu, przycisku nie ma.
4. **i18n** – teksty w `pl.ts` i `en.ts`.
5. **Testy**:
   - Vitest: zbieranie kolorów, paleta i migracja.
   - Playwright: kolor z przodu wybrany na tyle, zapisanie i usunięcie koloru.

## Decyzje

- Paleta jest zapisana w projekcie, a nie w przeglądarce. Przód i tył karty są w tym samym
  projekcie, a paleta przechodzi razem z plikiem projektu na inny komputer.
- Kolory użyte są liczone na bieżąco z dokumentu, nie zapisywane. Usunięcie koloru z karty
  usuwa go więc z listy.
- Panel rozwija się pod polem, a nie w wyskakującym okienku: nie trzeba niczego
  pozycjonować, a panel nie zasłania innych pól.
- Zapisanie i usunięcie koloru to zwykła zmiana projektu, więc działa dla niej „Cofnij”.
  W edytorze karty zapis jest ręczny, jak każda inna zmiana.
- „Użyte w projekcie” bierze wartości tylko z pól kolorów modelu (klucze `kolor…`, `…Kolor`,
  `tlo…`, `domyslny` w „Kolorze z danych”). Napisy w rodzaju „#123” w tekstach i nazwach nie są
  kolorami. Lista jest liczona dopiero po otwarciu panelu.
- Paleta ma najwyżej `MAKS_KOLOROW_PALETY` (64) kolory. Gdy jest pełna, nowy kolor wypiera
  najstarszy; przy takiej liczbie to praktycznie się nie zdarza.
- Import pliku szablonu albo tyłu do innego projektu nie dokłada kolorów do palety tego
  projektu. Kolory szablonu i tak pojawią się w „Użytych w projekcie”.
- Ikona przycisku to emoji 🎨: nie wymaga nowego zasobu, a przycisk ma opis dostępny
  („Kolory projektu: <pole>”).
