# Etap N1 — poprawki danych

## Zakres

1. **Szablony i rewersy o tej samej nazwie nie znikają z list.** Listy („Moje szablony”, awersy
   i rewersy z innych projektów w Edytorze kart) rozróżniają elementy po id; pomijane są tylko
   identyczne kopie – ten sam klucz treści (`kluczTresciSzablonu` w `src/model/szablon.ts`).
   Domyślna nazwa nowego rewersu pochodzi z i18n i jest unikalna („Rewers”, „Rewers 2”…).
2. **Usunięcie projektu nie usuwa szablonów ani rewersów** (`BazaProjektow.usunProjekt`): karty,
   rozmieszczenie i miniatura projektu znikają, a wpis zostaje jako „tylko szablony” – ukryty
   w „Moich projektach”, widoczny w „Moich szablonach”.
3. **Mausritter:** bez rewersów (wybór rewersu talii i karty, lista rewersów projektu) i bez importu
   CSV/XLSX (także eksportu wzoru CSV). Flagi `bezRewersow` / `bezImportuTabeli` w rejestrze gier
   (`src/pakiety/gry.ts`); inne projekty bez zmian.
4. **Wspólny plik szablonu** (`ROZSZERZENIE_SZABLONU` = `.kartyrpg-szablon`, `szablon.json`):
   awers (z opcjonalnym rewersem) albo sam rewers. `importujSzablon` wczytuje każdy plik jako awers,
   `importujRewers` – jako rewers. Dawne `.kartyrpg-rewers` (`rewers.json`) nadal się importują.
   Przyciski w edytorze – etap N3.

## Decyzje

- N1-1: Klucz treści obejmuje wszystko poza id, przypisaniem rewersu i podkładem; nazwa bez wielkości
  liter i skrajnych spacji; kolejność pól bez znaczenia (zod ją zmienia przy walidacji). Kopie
  z przemianowanym zasobem (kolizja id przy dołączaniu) liczą się jako różne – lepiej pokazać
  o jedną pozycję za dużo niż ukryć inny szablon.
- N1-2: Wpis „tylko szablony” to pole rekordu bazy (`tylkoSzablony`), nie modelu projektu – bez
  zmiany schematu i eksportu. Zapis takiego projektu z kartami przywraca go do „Moich projektów”;
  usunięcie ostatniego szablonu/rewersu usuwa wpis (`usunPustySchowek`).
- N1-3: Projekt gry (pakiet inny niż `wlasne`) zachowuje przy usuwaniu tylko rewersy – jego szablony
  awersów nie są pokazywane w „Moich szablonach”.
- N1-4: Plik awersu wczytany jako rewers: rozmiar w slotach → mm (slot × kolumny/rzędy), korzeń
  inny niż swobodny trafia do swobodnego opakowania na całą kartę, grupy stylów są rozwijane;
  parametry, warianty, kolor tła z danych i postrzępienie są pomijane. Dołączony do awersu rewers
  jest wtedy pomijany. Plik rewersu wczytany jako awers traci tryb/krycie/zabarwienie tekstury tła
  (szablon ich nie ma).
- N1-5: Rewersy w bibliotece globalnej zapisane w starym formacie są czytane bez migracji – odczyt
  rozpoznaje plik po wpisach archiwum, nie po rozszerzeniu.
- N1-6: Usunięcie projektu przycina obrazy nieużywane przez szablony, rewersy, podkłady i ozdobniki
  (np. ilustracje kart); czcionki zostają. Gdy walidacja odrzuci przycięty projekt, zostają wszystkie.
- N1-7: Import `.kartyrpg` o id usuniętego projektu („tylko szablony”) dostaje nowe id – bez pytania
  o kolizję z niewidocznym projektem i bez nadpisania zachowanych szablonów.
- N1-8: Mausritter (`bezRewersow`): poza wyborem rewersów ukryta jest warstwa rewersów na kartce
  i sekcja druku dwustronnego, a kartki nie budują stron rewersów (nawet przy starych przypisaniach).
  Rewersy z dawnych projektów Mausrittera zostają w „Moich szablonach” – to dane użytkownika.
- N1-9: Przy wczytaniu pliku „na krzyż” (awers z rewersem jako rewers i odwrotnie) do projektu trafiają
  wszystkie zasoby paczki, także te używane tylko przez pominiętą stronę – jak dotąd przy imporcie
  szablonu z rewersem. Do ewentualnego przycięcia w N3 (przyciski importu).
- N1-10: Klucz treści wpisu biblioteki globalnej liczony jest z JSON-a paczki bez walidacji; rewersy
  w bibliotece zapisuje bieżąca wersja aplikacji, więc pola są zgodne z modelem. Gdyby klucze się
  rozjechały, skutkiem jest dodatkowa pozycja na liście, nie ukrycie innego rewersu.
- N1-11: Nowy rewers z listy rewersów projektu nazywa się „Nowy rewers” (`rewersy.nowy`), a nowy
  projekt rewersu z ekranu startowego – „Rewers” (`wlasne.rewersNazwa`); oba z kolejnym numerem,
  gdy nazwa jest zajęta.
- N1-12: Usuwanie szablonu awersu z „Moich szablonów” w projekcie, którego karty go używają, działa
  jak przed N1 (poza zakresem etapu).
