# Karty RPG

Aplikacja przeglądarkowa do projektowania i drukowania kart do gier RPG i planszowych.
Specyfikacja: [`SPEC.md`](SPEC.md), bieżący plan: [`docs/plan-M1.md`](docs/plan-M1.md).

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

| Polecenie              | Działanie                                |
| ---------------------- | ---------------------------------------- |
| `npm run dev`          | serwer deweloperski                      |
| `npm run build`        | sprawdzenie typów i budowanie do `dist/` |
| `npm test`             | testy jednostkowe (Vitest)               |
| `npm run e2e`          | testy end-to-end i wizualne (Playwright) |
| `npm run lint`         | ESLint                                   |
| `npm run format:check` | sprawdzenie formatowania (Prettier)      |

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
Każdy dodany zasób zewnętrzny wpisz do [`LICENCJE.md`](LICENCJE.md).

## Licencja

Kod aplikacji jest udostępniony na licencji [MIT](LICENSE). Licencja nie obejmuje zasobów
w pakietach szablonów (czcionek, grafik, wzorów) – każdy z nich ma własne warunki opisane
w [`LICENCJE.md`](LICENCJE.md) i w pliku `LICENCJE.md` danego pakietu.
