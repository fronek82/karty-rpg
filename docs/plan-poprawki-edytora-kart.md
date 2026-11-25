# Poprawki Edytora kart: przybliżenie kartek i linie cięcia na tyłach

## Zakres

1. **Przybliżenie kartek** – w Edytorze kart (także w widoku „Drukuj karty”) nad panelem po prawej
   są przyciski „−”, „100%” (powrót do szerokości kolumny), „+”; Ctrl + kółko myszy nad kartkami
   przybliża w miejscu kursora. Stopnie: 50–400% (`src/ui/kartka/powiekszenie.ts`), wybór
   zapamiętany w localStorage (`KLUCZ_POWIEKSZENIA_KARTKI`).
2. **Linie cięcia na tyłach** – strony tyłów (podgląd pary i PDF dwustronny) mają lustrzane
   odbicie linii cięcia przodu (`WynikArkusza.odcinkiCiecia`, `zbudujStronyRewersow`).

## Decyzje

- Powiększenie zmienia szerokość kartki w CSS (`--powiekszenie`); geometria edytora liczy się
  z `getBoundingClientRect`, więc przeciąganie i zaznaczanie działają bez zmian. Powyżej 100%
  kolumna kartek przewija się w poziomie.
- Przyciski są nad panelem, a nie nad kartkami: nie zasłaniają ani nie przesuwają kartek
  (wzorce zrzutów zależą od ich położenia).
- Na tyłach rysujemy te same odcinki co z przodu (już przycięte do papieru), odbite względem osi
  odwracania – bez nożyczek. W trybie drukarni bez zmian (tam są znaczniki cięcia). Strona tyłu
  bez żadnej karty z tyłem zostaje pusta.
- Ctrl + kółko: przesunięcia sumowane do progu 50 px na stopień (szczypanie na gładziku nie
  przeskakuje do skrajnego stopnia); w trakcie przeciągania karty powiększenie się nie zmienia.
  Punkt pod kursorem zostaje w miejscu (kotwica liczona względem kartki, wymiary mierzone po zmianie).
- Linie na tyłach są odbiciem odcinków już przyciętych do granic przodu (z jego kalibracją); przy
  różnych korektach X/Y przodu i tyłu przycięcie na tyle jest przybliżone – skutek kosmetyczny.
