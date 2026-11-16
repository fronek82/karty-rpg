# Karty RPG

Aplikacja przeglądarkowa do projektowania i drukowania kart do gier RPG i planszowych.
Specyfikacja: [`SPEC.md`](SPEC.md), bieżący plan: [`docs/plan-M1.md`](docs/plan-M1.md).

**Aplikacja online:** <https://fronek82.github.io/karty-rpg/>. Działa w całości w przeglądarce;
projekty zostają na Twoim komputerze (IndexedDB).

## Jak zacząć (Mausritter)

1. **Projekty → „Nowy projekt z pakietu”** – powstaje projekt z trzema taliami i arkuszami.
2. **Talia** – w tabeli edytujesz nazwy, wartości, ilość sztuk i rozmiar karty w slotach.
   Obok widać podgląd zaznaczonej karty; obraz przesuwasz myszą, kółko zmienia skalę.
   „Wgraj obraz…” dodaje własną ilustrację (PNG/JPG, także zdjęcia z telefonu).
3. **Czcionki i role** – możesz wgrać własne czcionki (np. oryginalne do tytułów) i przypisać
   je do ról „Tytuł” i „Treść”.
4. **Arkusze do druku** – podgląd, ręczna korekta układu, ustawienia (tytuł, papier,
   czarno-biały) i „Pobierz PDF”. **Drukuj w skali 100%** (bez „dopasuj do strony”).
5. **Eksportuj** projekt do pliku `.kartyrpg`, żeby mieć kopię zapasową albo przenieść go
   na inny komputer (Projekty → Importuj).

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
