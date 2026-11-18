# Makiety interfejsu

Makiety przebudowy interfejsu (jasny i ciemny motyw, 1440×900) oraz trzy próbki czcionki tytułu.
Wyniki trafiają do `docs/obrazy/makieta-ui-*.png` (13 plików).

## Odtworzenie

```
npm ci && npx playwright install chromium   # raz
node docs/makiety-ui/generuj.mjs            # HTML + PNG z zapisanych podglądów
node docs/makiety-ui/generuj.mjs --podglady # najpierw ponownie renderuje podglądy silnikiem
```

Skrypt zapisuje strony HTML do `docs/makiety-ui/html/` (można je otworzyć w przeglądarce)
i robi zrzuty Chromium (viewport 1440×900, skala 1).

## Pliki

- `tokeny.css` – paleta i zmienne CSS (`data-theme="light|dark"`), jedno źródło kolorów.
- `makiety.css` – style wspólne makiet; `@font-face` czcionek tytułu z `fonty/`.
- `generuj.mjs` – składa strony i robi zrzuty.
- `renderuj-podglady.test.ts` + `vitest.config.ts` – renderowanie podglądów silnikiem.
- `podglady/` – SVG z silnika i `info.json` (położenie siatki slotów).
- `fonty/` – Cinzel Decorative, Uncial Antiqua, Metamorphous (OFL, patrz `fonty/LICENCJE.md`).

## Skąd pochodzą podglądy

Podglądy kartek i kart nie są rysowane ręcznie. `renderuj-podglady.test.ts` wywołuje
`zbudujArkusz` (arkusze: pusta kartka, Broń i pancerze, Wyposażenie, Stany, strona edytora)
oraz `renderujKarte` (karty z przykładowych szablonów) i zamienia wynik przez `scenaDoSvg`.
To ten sam kod, który daje podgląd i PDF w aplikacji. Czcionki i pakiet Mausritter są z `src/`
i `public/czcionki/`. Uruchomienie: `npx vitest run --config docs/makiety-ui/vitest.config.ts`.

Uproszczenia:

- Siatka slotów, zaznaczenie karty i otwarte menu typów to nakładka HTML/SVG na wyniku silnika.
- Szablony czaru, bloku statystyk i potwora to szablony z `src/silnik/__testy__/przyklady.ts`
  (te same, które są w `docs/przyklady/`). Karta ozdobna to `szablonOzdobny` bez własnego
  elementu `wl:Gwiazdka` (wartość w kształcie rombu). Karta swobodna to wzorzec F z
  `testy/swobodnyUI.ts` z dopisanymi kluczami pól, ilustracją zastępczą i stylem tekstów.
- „Pusta karta” w makiecie 3 i miniatury projektów „Zaklęcia maga” to złożenie z kart silnika w HTML.
