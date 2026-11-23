# Etap N4 — blok „wartość w kształcie”

## Zakres

1. **Etykieta nie zmienia proporcji kształtu.** Etykieta ma osobne miejsce: nad, pod albo obok
   kształtu (`etykieta.pozycja`: `nad` | `pod` | `lewo` | `prawo`). Kształt wpisuje się w pozostałe
   miejsce z zachowaniem proporcji, jest wyśrodkowany; przy zmianie rozmiaru pola skaluje się
   proporcjonalnie (`wpiszProporcje` w `src/silnik/ksztaltyWartosci.ts`).
2. **„Zachowaj proporcje”** (`PoleWartosc.zachowajProporcje`, domyślnie włączone – brak pola =
   `true`). Wyłączone: kształt rozciągnięty do pola, jak przed N4.
3. **Nowe kształty:** trójkąt, pięciokąt, ośmiokąt, gwiazda (`ramiona`, 3–12, domyślnie 5), serce,
   kropla (romb, sześciokąt i tarcza już były). Wartość w prostokącie treści wokół środka optycznego
   (trójkąt – środek ciężkości, gwiazda – środkowy wielokąt bez ramion, kropla – okrągła część).
4. **Schemat 28** z migracją 27→28.

Zrzut: `docs/obrazy/n4-ksztalty-wartosci.png` (wszystkie kształty bez etykiety, z etykietą nad,
pod i obok).

## Decyzje

- Naturalne proporcje (szer./wys.): romb 1, tarcza 0,85, sześciokąt i trójkąt 2/√3 (foremne),
  pięciokąt i ośmiokąt foremne, gwiazda wg ramion, serce 1,1, kropla 0,75, własny kształt – wg
  wymiarów rysunku SVG. Kwadrat i koło są zawsze równoboczne (bez opcji); prostokąt i ścięte rogi
  wypełniają pole (opcja ukryta).
- Prostokąt treści figur liczony raz (pamięć podręczna): największy prostokąt 1 : 1 w mm (krótkie
  wartości – „12”, „k6”) o środku w środku optycznym, sprawdzany próbkowaniem krawędzi w wielokącie
  (krzywe serca i kropli spłaszczone). Romb, sześciokąt, tarcza, koło – dotychczasowe wnętrza bez
  zmian.
- Obrys wielokątów przesuwany do środka prostopadle do boków (zewnętrzna krawędź linii = tło); serce
  i kropla – ramka zmniejszona o wcięcie (jak tarcza).
- Rozmiar wg treści: kształt powiększany w krótszym wymiarze do swoich proporcji; etykieta nad/pod
  dodaje wysokość, obok – szerokość (z odstępem). Etykieta obok ma szerokość wg tekstu (najwyżej
  szerokość pola), jest wyśrodkowana w pionie.
- Migracja 27→28 przechodzi całe dane (szablony, rewersy, plik szablonu) i węzłom `wartosc`
  z kształtem `romb`, `tarcza`, `szesciokat`, `wlasny` (dotąd rozciąganym) ustawia
  `zachowajProporcje: false` – zapisane projekty wyglądają jak przed zmianą. Pozostałe kształty
  wyglądały już tak samo (prostokąt wypełnia, koło/kwadrat równoboczne).
- Szablony w kodzie (przykłady, pakiet, testy) mają aktualną wersję schematu, więc dostają nowe
  zachowanie – przykład „karta wroga” ma teraz romby nierozciągnięte; zaktualizowane wzorce:
  `src/silnik/__snapshots__/m2-wrog.svg` i pliki `docs/przyklady/*.kartyrpg-szablon`.
- Zmiana typu wartość → tekst: etykieta obok staje się etykietą „przed”; tekst → wartość: „przed”
  staje się „nad”.
- Etykieta obok zajmuje najwyżej 60% szerokości pola (dłuższa jest zmniejszana do `minRozmiar`
  albo zgłasza przepełnienie) – kształt nie znika.
- Wcięcie obrysu wielokątów ograniczone do 40% najmniejszej odległości środka od boków (gruba lub
  podwójna linia na małej gwieździe nie wywraca konturu).
- Przegląd: uwaga, że koło i kwadrat zmieniają wygląd – nieaktualna; kod sprzed N4 już wpisywał je
  w kwadrat wyśrodkowany w polu.
