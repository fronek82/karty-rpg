# Przykładowe szablony (do testów)

Trzy pliki szablonów zbudowane z ogólnych klocków edytora – **przykłady testowe, nie gotowe
pakiety gier**. Służą do ręcznego sprawdzania aplikacji i są wzorcem dla testów automatycznych
(`src/silnik/__testy__/przyklady.ts`, `src/dane/przyklady.test.ts`). Treści są własne i neutralne.

| Plik                                                                 | Co pokazuje                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [`czar.kartyrpg-szablon`](czar.kartyrpg-szablon)                     | kolorowa karta 63×88, białe panele, siatka 2×2 „etykieta nad wartością”, opis, stopka |
| [`blok-statystyk.kartyrpg-szablon`](blok-statystyk.kartyrpg-szablon) | karta pozioma 88×63, tytuł kapitalikami, tabela, separator, akapity wyjustowane       |
| [`wrog.kartyrpg-szablon`](wrog.kartyrpg-szablon)                     | zagnieżdżony nagłówek, wartości w rombach z etykietą, pola zwijane, gdy puste         |

Bezpośrednie pobieranie (z dowolnego urządzenia):

- https://raw.githubusercontent.com/fronek82/karty-rpg/main/docs/przyklady/czar.kartyrpg-szablon
- https://raw.githubusercontent.com/fronek82/karty-rpg/main/docs/przyklady/blok-statystyk.kartyrpg-szablon
- https://raw.githubusercontent.com/fronek82/karty-rpg/main/docs/przyklady/wrog.kartyrpg-szablon

Użycie: „Stwórz własne karty” → „Importuj szablon…” (albo w projekcie: Ustawienia → Szablony
projektu → Importuj szablon…). Pliki odświeża:
`AKTUALIZUJ_PRZYKLADY=1 npx vitest run src/dane/przyklady.test.ts`.
