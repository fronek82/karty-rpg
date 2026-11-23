# Etap N5 — wzory tła kart

## Zakres

1. **Model** (`src/model/szablon.ts`): `WzorTla` (`rodzaj`: `pionowe` | `poziome` | `kratka` |
   `romby` | `ukosne` | `kropki`; `grubosc`, `odstep` w mm, `kolor`, `krycie`, `obrot`,
   `przesuniecie`, `podTekstura`) jako `wzorTla` w `Szablon` i `Rewers`. Kolor pod wzorem to
   dotychczasowe `tlo`. Schemat 29 (migracja 28→29 bez zmian danych), zod w `schemat.ts`.
2. **Silnik** (`src/silnik/wzorTla.ts`): wzór jako jedna ścieżka wektorowa na scenie (linie –
   obrys, kropki – wypełnione koła), w grupie przyciętej do karty (rogi) albo do obszaru ze spadem
   (tryb drukarni), z kryciem grupy. `renderujKarte` rysuje go nad teksturą tła albo pod nią.
3. **UI**: sekcja „Tło karty” (`src/ui/szablon/SekcjaTlaKarty.tsx`) w panelu karty Edytora szablonu
   i Edytora rewersu: „Brak / Kolor / Obraz / Wzór”, parametry wzoru, tekstura z wzorem i kolejność.
   Postrzępiona krawędź karty ma własną sekcję. Opcje tekstury rewersu (tryb, krycie, zabarwienie,
   wgrywanie) – w sekcji „Tło karty”.
4. Eksport/import: `wzorTla` w plikach szablonu i projektu, także przy zamianie awers ↔ rewers.
5. Instrukcja: sekcja „Tło karty: kolor, obraz i wzór” (`pl-tlo-karty` / `en-tlo-karty`).

Zrzut: `docs/obrazy/n5-wzory-tla.png`.

## Decyzje

- Kolor tła wzoru = `tlo` karty (bez osobnego pola); „Przezroczystość” dotyczy samego wzoru.
- Początek wzoru to lewy górny róg karty netto (+ przesunięcie), obrót wokół niego – karta ze
  spadem i bez niego ma linie w tych samych miejscach.
- Tryb tła wynika z danych: wzór → „Wzór”, tekstura → „Obraz”, kolor → „Kolor”, nic → „Brak”.
  „Brak” usuwa kolor, teksturę i wzór; „Kolor” usuwa teksturę i wzór; „Obraz” usuwa wzór
  i wybiera pierwszy obraz projektu; „Wzór” zachowuje teksturę (łączenie) i ustawia białe tło,
  gdy go nie było. Kolor z danych (awers) widoczny w każdym trybie.
- Domyślnie wzór nad teksturą (nieprzezroczysta tekstura zakryłaby wzór); „Wzór pod teksturą”
  odwraca kolejność.
- Gęste kropki: najwyżej `MAX_KROPEK` (20 000) – przy gęstszym ustawieniu odstęp jest powiększany
  (rozmiar PDF). Odstęp ≥ 0,5 mm, grubość 0,05–50 mm (schemat).
- „Tło do krawędzi slotu” (druk domowy) nadal rozciąga tylko kolor – bez wzoru i tekstury, jak dotąd.
- „Brak” nie usuwa reguły „Kolor z danych” (awers) – reguła działa niezależnie od trybu tła, jak
  przed N5. Przełączenie trybu bez zmiany danych nie tworzy wpisu „Cofnij”.
