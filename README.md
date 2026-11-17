# Karty RPG

Aplikacja przeglądarkowa do projektowania i drukowania kart do gier RPG i planszowych.
Specyfikacja: [`SPEC.md`](SPEC.md), bieżący plan: [`docs/plan-M1.md`](docs/plan-M1.md).

**Aplikacja online:** <https://fronek82.github.io/karty-rpg/>. Działa w całości w przeglądarce;
projekty zostają na Twoim komputerze (IndexedDB).

## Jak zacząć (Mausritter)

1. Na starcie wybierz **„Stwórz karty do Mausrittera”**, potem **„Pusta kartka”** albo
   **„Zacznij od gotowego układu”** (Broń i pancerze / Wyposażenie / Stany / Wszystkie trzy).
2. Na kartce A4 **kliknij pusty slot** i wybierz typ karty (broń, zbroja, ekwipunek, zaklęcie,
   stan, pusta karta). Karta pojawia się w domyślnym rozmiarze dla typu.
3. **Kliknij kartę** – w panelu z prawej edytujesz jej pola, rozmiar i ilustrację (także zdjęcia
   z telefonu). Shift + klik albo prostokąt zaznaczają kilka kart – wspólne pola zmieniasz naraz.
4. Karty **przeciągasz myszą** (także na kolejną stronę); „Duplikuj ×N”, Delete, Ctrl+D,
   Ctrl+Z, strzałki. Na arkuszu stanów dodasz **nagłówek grupy** nad kolumnami.
5. **Ustawienia**: tytuł kartki, czarno-biały, papier, czcionki (także własne).
6. **Pobierz PDF** i drukuj w **skali 100%** (bez „dopasuj do strony”). **Eksportuj** zapisuje
   projekt do pliku `.kartyrpg` (kopia zapasowa, przeniesienie na inny komputer – import na starcie).

## Własne karty (od zera)

1. Na starcie **„Stwórz własne karty”** → **„＋ Nowy szablon od zera”**: nazwa, format karty
   (Poker, Bridge, Mini Euro, Mini American, Tarot, kwadrat albo własny w mm), orientacja, rogi,
   kolor i neutralny układ startowy.
2. **Edytor szablonu**: z lewej drzewo wierszy, kolumn i pól (**＋ Dodaj**, ↑/↓, do kontenera,
   opakuj, duplikuj, usuń; klawiatura), w środku podgląd karty (klik zaznacza element), z prawej
   **właściwości**: typ, nazwa, treść z danych karty albo stała, etykieta, szerokość i wysokość,
   styl tekstu, tło, ramka, odstępy, kształt wartości, tabela (kolumny, wiersze, nagłówki, linie).
   Shift + klik – kilka elementów naraz; Kopiuj / Wklej styl.
3. **„Rób karty ►”** – kartka dla rozmiaru szablonu; klik w slot dodaje kartę, panel pokazuje pola
   z nazwami z szablonu. **„Edytuj szablon”** wraca do edytora.
4. Papier: A4, Letter, A5, zdjęcia 10×15 / 13×18 / 15×21 cm (strefa bezpieczeństwa 3 mm) albo
   własny. Szablon eksportuje się do pliku `.kartyrpg-szablon` i importuje w innym projekcie.

Przykładowe szablony do wypróbowania (do testów, nie gotowe pakiety gier):
[`docs/przyklady/`](docs/przyklady/).

## Uruchomienie

Wymagany Node.js 22 lub nowszy.

```bash
npm install
```

```bash
npm run dev
```

Aplikacja działa pod adresem `http://localhost:5173/karty-rpg/`.

## Polecenia

| Polecenie               | Działanie                                            |
| ----------------------- | ---------------------------------------------------- |
| `npm run dev`           | serwer deweloperski                                  |
| `npm run build`         | sprawdzenie typów i budowanie do `dist/`             |
| `npm test`              | testy jednostkowe (Vitest)                           |
| `npm run e2e`           | testy end-to-end i wizualne (Playwright)             |
| `npm run test:nakladka` | nakładka arkuszy na oryginał (lokalnie, raport HTML) |
| `npm run lint`          | ESLint                                               |
| `npm run format:check`  | sprawdzenie formatowania (Prettier)                  |

## Struktura

```
src/model    typy danych (wymiary w mm)
src/silnik   układ karty i renderowanie SVG
src/druk     arkusze, linie cięcia, PDF
src/dane     IndexedDB, eksport/import
src/ui       interfejs React
src/i18n     teksty interfejsu
testy/       testy Playwright
docs/        plany i notatki
```

Pliki robocze, które nie mają trafić do repozytorium, trzymaj w `zasoby-prywatne/`.

## Test nakładania na oryginalne arkusze (lokalnie)

Oryginalne arkusze nie są w repozytorium (licencja). Żeby porównać nasze arkusze z oryginałem:

1. Skopiuj PDF do `zasoby-prywatne/referencje/Mausritter_kartyekwipunku.pdf`.
2. Opcjonalnie utwórz `zasoby-prywatne/referencje/nakladka.json`, np.:

   ```json
   {
     "plik": "Mausritter_kartyekwipunku.pdf",
     "strony": {
       "mausritter-arkusz-bron": 1,
       "mausritter-arkusz-wyposazenie": 2,
       "mausritter-arkusz-stany": 3
     },
     "czcionki": [
       {
         "rodzina": "Minion Pro",
         "wariant": "normalny",
         "plik": "../czcionki/MinionPro-Regular.otf"
       }
     ],
     "role": { "tresc": "Minion Pro" }
   }
   ```

3. `npm run test:nakladka` – raport HTML (`npx playwright show-report`) ma dla każdego arkusza
   obraz nakładki (nasze linie niebieskie, oryginał czerwony, zgodne czarne) i JSON
   z dopasowaniem: skala i przesunięcie w każdej osi oraz odchyłka każdej linii cięcia.
   Test przechodzi, gdy po dopasowaniu żadna linia nie odstaje o 0,3 mm lub więcej.

Bez plików test oryginału jest pomijany; w CI działa autotest na referencji syntetycznej.
Każdy dodany zasób zewnętrzny wpisz do [`LICENCJE.md`](LICENCJE.md).

## Licencja

Kod aplikacji jest udostępniony na licencji [MIT](LICENSE). Licencja nie obejmuje zasobów
w pakietach szablonów (czcionek, grafik, wzorów) – każdy z nich ma własne warunki opisane
w [`LICENCJE.md`](LICENCJE.md) i w pliku `LICENCJE.md` danego pakietu.
