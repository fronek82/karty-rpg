# Etap N9 — pusty stan karty i wzory tła z biblioteki SVG

## Zakres

1. **Pusty stan karty** (`src/ui/szablon/EdytorDrzewa.tsx`): komunikat „Karta jest pusta…” zniknął
   z panelu „Karta”. Gdy korzeń nie ma dzieci: na podglądzie wyszarzony napis „Pusta karta – kliknij
   ＋ Dodaj” i duży przycisk „＋”, w drzewie „Brak elementów” i „＋ Dodaj”. Oba otwierają to samo
   menu co „＋ Dodaj ▾” (`MenuDodaj` z innym wyglądem przycisku). Warstwa HTML nad SVG – nie trafia
   do sceny, więc ani do PDF, PNG, ani miniatur. Działa też w Edytorze rewersu (wspólny edytor).
2. **Model** (`WzorTla`, schemat 30, migracja 29→30 bez zmian danych): `rodzaj: 'svg'` z `element`
   (id elementu ozdobnego biblioteki użytkownika – tylko odwołanie), `rozmiar` (dłuższy bok kafelka,
   mm), `odstepX` / `odstepY` (mm, domyślnie 0), `uklad` (`siatka` | `cegielka` | `pion`, także dla
   kropek).
3. **Scena** (`src/silnik/scena.ts`): nowy element `wzor` (obszar, okres kafelka, macierz układu
   wzoru, rysunek okresu). SVG: `<pattern patternUnits="userSpaceOnUse" patternTransform=…>`,
   PDF: `rozwinWzor` – kopie wektorowe (rysunek jako symbol = jeden XObject). Silnik
   (`elementyWzoruSvg` w `src/silnik/wzorTla.ts`): cegiełka/pion – kafelek podwójnej
   wysokości/szerokości z drugą kopią przesuniętą o pół kafelka.
4. **Biblioteka** (bez nowego magazynu): grafiki wzorów to elementy ozdobne biblioteki użytkownika
   (`biblioteka`, rodzaj `ozdobnik`). Dołożone: `koloryElementu` / `czyJednokolorowy`
   (`src/ozdobniki/narozniki.ts`, liczone przy użyciu z konturów), `symbolZElementu(e, jednolity)`,
   wzór tła w `odwolania` (`src/dane/biblioteka.ts`) – dzięki temu eksport/import szablonu zabiera
   grafikę, deduplikacja przepisuje id, a „Używany w projektach” widzi tło; `liczbaTelZElementem`
   i pole `tla` w `projektyUzywajace` – ostrzeżenie z liczbą kart przy usuwaniu.
5. **UI** (`SekcjaTlaKarty.tsx`): grupy „Wbudowane” (miniatury z silnika) i „Z biblioteki”
   (przewijana siatka, kafelek „＋ SVG” – import `paczkaOzdobnikaZPliku` +
   `zapiszOzdobnikWBibliotece`), parametry wspólne, kolor wzoru wyszarzony dla wielokolorowych,
   ostrzeżenie o brakującej grafice.

## Decyzje

- Oczyszczanie SVG, viewBox z obwiedni i limity robi już importer biblioteki (`svgImport.ts`):
  surowy SVG nigdy nie trafia na stronę, tylko własne kontury M/L/C/Z – bez wewnętrznych id, więc
  prefiksy id nie są potrzebne poza istniejącym `przedrostekId` sceny (ma go też `<pattern>`).
- Jednokolorowość liczona z konturów przy użyciu (nie z ustawienia `kolorowanie` elementu, które
  użytkownik może zmienić): `currentColor` to jeden kolor, `none` się nie liczy. Wielokolorowy
  rysunek w trybie „oryginał” – `currentColor` rysowany czarnym.
- „Rozmiar kafelka” to dłuższy bok rysunku (proporcje zachowane). Najwyżej `MAX_KAFELKOW` (20 000)
  kafelków na karcie – przy gęstszym ustawieniu kafelki są proporcjonalnie powiększane (rozmiar PDF),
  jak kropki we wzorach wbudowanych.
- Wzory liniowe nie mają układu (cegiełka linii nic nie zmienia) – przełącznik tylko dla kropek
  i grafik. Linie/kropki zachowują „Grubość” i „Odstęp”; grafiki mają rozmiar kafelka i odstępy X/Y.
- PDF nie używa wzorów kafelkowych PDF (pdf-lib ich nie wspiera) – kopie wektorowe w grupie
  przyciętej do obszaru dają ten sam obraz co SVG `<pattern>`; rysunek zapisany raz (XObject).
- Ostrzeżenie przy usuwaniu liczy szablony i rewersy z grafiką jako wzorem tła w projektach
  (jak istniejące sprawdzanie użycia – bez wpisów „tylko szablony”).
- Na podglądzie pusty stan leży nad obszarami pól (inaczej przycisk zasłaniałby obszar korzenia).
