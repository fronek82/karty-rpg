# Karty RPG – zasady pracy

Aplikacja przeglądarkowa (Vite + TypeScript + React) do projektowania i drukowania kart RPG.

## Gdzie co jest

- Specyfikacja: `SPEC.md`. Plany: `docs/plan-M2.md` (M2 ukończony), `docs/plan-M2b.md` (M2b ukończony 18.11.2026), `docs/plan-UI.md` (przebudowa interfejsu – UI-1…UI-9 ukończone 18.11.2026), `docs/plan-M3.md` (M3 ukończony 19.11.2026), `docs/plan-M4.md` (M4 ukończony 20.11.2026). M4-1 (model rewersów, przypisania i paczki) ukończony 19.11.2026. M4-2 (edytor i podgląd rewersu), M4-3 (tekst rewersu po łuku i efekty warstw), M4-4 (druk dwustronny i wydruk próbny), M4-5 (tryb drukarni, spad, znaczniki i DPI), M4-6 (katalog Google Fonts i zapis wariantów) oraz M4-7 (domknięcie, README, galeria przykładów i odbiór) ukończone 20.11.2026. Ręczny odbiór M2c ukończony 20.11.2026 (`docs/plan-M2c.md`). Ręczne sprawdzenia fizycznego wydruku M4 są zebrane w `docs/plan-M4.md#ręczne-sprawdzenia-m4`. Następny kamień milowy do zaplanowania: M5 (wg `SPEC.md`).
- Decyzje podjęte bez konsultacji: sekcja 9 planu (B1…); nowe dopisuj tam.
- Przykłady szablonów: `docs/przyklady/`; zrzuty ekranu: `docs/obrazy/`.
- Agenci: `.claude/agents/` (np. `recenzent` – przegląd, tylko odczyt).

## Sposób pracy

- Każdy etap zaczynaj od aktualnego `main`; po etapie: PR, scalenie do `main`, sprawdzenie
  wdrożenia na Pages (krok CI „Sprawdzenie strony po wdrożeniu”).
- Commit i push po każdym kroku; komunikaty commitów po polsku.
- Przed PR: pełne testy i przegląd agentem `recenzent`, poprawki zgłoszonych błędów.
- Bez gotowców pod konkretne gry – edytor daje tylko ogólne klocki.

## Testy (wyjście skrócone: Vitest „dot”, Playwright „line”)

- `npm run typecheck`, `npm run lint`, `npm run format:check`
- `npm test` (Vitest), `npm run e2e` (Playwright, Chromium). `EKSPORT_PRZEGLADARKI=1 npm run e2e` dodaje scenariusze eksportu w Firefox i WebKit, tak jak w CI.
- Wzorce zrzutów `*-chromium-linux.png` – tylko Linux (jak CI).
- Pliki przykładów: `AKTUALIZUJ_PRZYKLADY=1 npx vitest run src/dane/przyklady.test.ts`.

## Zasady kodu

- Wymiary w modelu w mm; jedno źródło sceny dla podglądu SVG i PDF.
- Teksty UI przez i18n (`src/i18n/pl.ts`); schemat i migracje w `src/dane/schemat.ts`.
- Nowe zależności i zasoby – wpis w `LICENCJE.md`.

## Komunikacja

- Podsumowania etapów po polsku: co sprawdzić krok po kroku, zrzuty nowych widoków.
- Zasoby prywatne (`zasoby-prywatne/`, w `.gitignore`) nigdy nie trafiają do repozytorium.
