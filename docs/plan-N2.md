# Etap N2 — porządki w kodzie

Bez zmian w działaniu aplikacji (wyjątki – sekcja „Decyzje”). Podział `EdytorKartki.tsx` – osobny
etap.

## Zakres

1. **Jeden edytor drzewa dla awersu i rewersu.** `src/ui/szablon/EdytorDrzewa.tsx`: pasek górny,
   drzewo i menu „+ Dodaj” (`MenuDodaj`), skróty klawiszowe (`useKlawiszeEdytora`), gest myszy
   i przeciąganie (`useGestSwobodny`), podgląd (`usePodglad`), miniatura na liście projektów
   (`useMiniatura`), panel zaznaczenia, pasek przyciągania i podkładu. `EdytorSzablonu`
   i `EdytorRewersu` to cienkie nakładki: przekazują teksty, rysunek podglądu (`rysuj`,
   `kluczRysunku`), tryb `bezDanych` (rewers: bez kluczy i przykładów), rodzaje w menu „+ Dodaj”
   (`RODZAJE` / `RODZAJE_REWERSU` w `PozycjeMenuDodaj.tsx`), podkład (tylko awers) i panel całej
   karty (`panelKarty`). Zmiana zachowania edytora – w `EdytorDrzewa.tsx`.
2. **Wspólne moduły** (warstwa `model`, dostępne dla wszystkich):
   - `src/model/szablon.ts`: `wezlyDrzewa`, `polaDrzewa`, `korzenieSzablonu`, `wszystkieWezly`
     (zamiast kopii w `dane/szablon.ts`, `archiwum.ts`, `schemat.ts`, `biblioteka.ts`, `edycja.ts`,
     `silnik/karta.ts`, `ui/kartka/PanelKart.tsx`);
   - `src/model/geometria.ts`: `Prostokat`, `przecinajaSie` (z `druk/arkusz.ts` i `druk/maxrects.ts`),
     `zaokraglij` (zamiast lokalnych `Math.round(v * 10^n) / 10^n`);
   - `src/model/nazwy.ts`: `bezZnakowDiakrytycznych` (id zasobów, klucze pól, nazwy plików)
     i `normalizujNazwe` (nagłówki importowanych tabel).
   - Konflikty nazw: `ui/baza.ts` → `ui/bazaUI.ts`, `ui/obrazy.ts` → `ui/obrazyUI.ts`;
     `nowyProjektZPrzykladu` w UI (tworzy i zapisuje w bazie) → `zapiszProjektZPrzykladu`.
3. **Martwy kod usunięty:** `czyDrukarnia`, `mmNaPt`, `rozszerzenieZasobu`, `maOzdobySeparatora`,
   `PoleAi`, `_zgodnosc`; razem z testami: `ustawWariantCzcionki`, `zmienNazweRodziny`, `opisGry`
   (i nieużywane pole `Gra.opis` z kluczami `gra.*.opis`), `pxNaMm`.
4. **Źródło pozycji list bez wartości specjalnych.** `<option>` ma zwykłe id (klucz wpisu),
   a pochodzenie niesie atrybut `data-zrodlo` (`globalny`, `inny-projekt`; brak – projekt).
   `src/ui/zrodloOpcji.tsx`: `wybranaOpcja`, `atrybutyZrodla`, `OpcjeRewersowGlobalnych`
   (grupa rewersów z przeglądarki, wcześniej powielona w trzech panelach).

## Decyzje

- N2-1: Kontrola zgodności schematu z modelem (`_zgodnosc`) zastąpiona typowaniem wyniku walidacji
  w `przygotujProjekt` (`const projekt: Projekt = sprawdz(...)` bez rzutowania). Projekt zawiera
  szablony i rewersy, więc rozjazd ich schematów też jest błędem kompilacji.
- N2-2: `przecinajaSie` ma wariant z `druk/arkusz.ts` (prostokąt zerowy nie przecina niczego).
  W `maxrects.ts` wolne prostokąty i karty mają zawsze rozmiar > 1e-6, więc wynik się nie zmienia.
- N2-3: `normalizujNazwe` zostaje z `\p{Diacritic}` (jak dotąd przy nagłówkach), a
  `bezZnakowDiakrytycznych` – z zakresem U+0300–U+036F (jak dotąd przy id) – identyczne wyniki
  jak przed zmianą.
- N2-4: Edytor rewersu pokazuje teraz, jak edytor awersu, podpowiedź „uchwyty niedostępne”
  przy zaznaczeniu w obróconym kontenerze – jedyna widoczna różnica po połączeniu edytorów.
- N2-5: Wartości `__rozne__` i `__brak__` w listach rewersu karty zostają – to stany listy
  („różne przypisania”, „bez rewersu”), nie źródła pozycji.
