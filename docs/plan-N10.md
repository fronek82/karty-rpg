# Etap N10 – przód i tył karty

Cel: jeden edytor dla obu stron karty, kreator tyłu, „Rozmiar jak w szablonie”, kontrola
zgodności rozmiarów przodu i tyłu oraz nazwy „Przód” / „Tył” w interfejsie.

## Zakres

1. **Wspólny edytor** – `src/ui/szablon/EdytorKarty.tsx` zastępuje `EdytorSzablonu` i
   `EdytorRewersu`. Różnice stron są w konfiguracji `STRONY` (`przod` / `tyl`): wyszukanie
   i zmiana karty w projekcie, duplikat, eksport/import pliku, stały obraz, rysunek podglądu,
   teksty, adres powrotu. Panel „nic nie zaznaczono” to jeden `PanelKarty.tsx` (rozmiar,
   orientacja, rogi, tło, postrzępienie, zestawy stylów, ramka, grupy stylów, kontener karty);
   dodatki tyłu (wgrywanie obrazu tła, tryb, krycie, zabarwienie) – `TeksturaTylu.tsx`.
   Wspólna część drzewa i podglądu – jak dotąd `EdytorDrzewa.tsx`.
2. **Model** – schemat 31: `Rewers.promienRogow` i `Rewers.postrzepienie` (opcjonalne, bez
   zmian danych). `rewersJakoSzablon` / `szablonDoRewersu` przenoszą oba pola.
3. **Kreator tyłu** – `#/wlasne/nowy/rewers`: ten sam krok 1 co przód (`Kreator` z `strona`),
   własne układy (`UKLADY_TYLU`, `nowyTyl` w `dane/rewers.ts`): pusta karta, grafika/logo na
   środku, wzór na całą kartę, ramka z ornamentem.
4. **„Rozmiar jak w szablonie”** – lista z `BazaProjektow.wymiarySzablonow()` (przody w mm
   i tyły bez identycznych kopii), pola zablokowane do „Odblokuj”; w kreatorze przodu
   „Przypisz ten tył do szablonu” (kopia tyłu w projekcie przodu, `szablon.rewersId`).
5. **Zgodność rozmiarów** – `src/dane/zgodnosc.ts` (porównanie, powiązania, dopasowanie
   zawartości, elementy poza kartą), `src/ui/zgodnoscTylu.tsx` (okno przy przypisaniu i przed
   PDF), `src/ui/szablon/ZmianaRozmiaru.tsx` (okno przy zmianie rozmiaru, wybór dopasowania).
6. **Nazewnictwo** – teksty `pl.ts`, instrukcja i tagi galerii; klucze, kod i pliki bez zmian.

## Decyzje

- Tył bez `promienRogow` (projekty sprzed schematu 31) dopasowuje rogi do przodu: w kontroli
  zgodności rogi nie są wtedy porównywane, a w edytorze pole pokazuje 0. Na arkuszu rogi tyłu
  zawsze wyznacza przód (jak dotąd), więc stare projekty drukują się bez zmian.
- „Powiązane” szablony liczone w obrębie projektu: przypisanie szablonu (`rewersId`) oraz karty
  z rozstrzygniętym tyłem (także przez talię). Pusty przód projektu samego tyłu się nie liczy.
  Tyły skopiowane do innych projektów są niezależnymi kopiami – ich zmiana niczego nie psuje.
- Przypisanie z kreatora przodu ustawia tył na szablonie (nie na talii) – to jest „przód
  z przypisanym tyłem”; karty dziedziczą go przez szablon.
- Pola rozmiaru i rogów w panelu karty zatwierdzają się po wyjściu z pola albo Enter
  (`PoleLiczby poWyjsciu`), żeby okno pytania nie pojawiało się przy każdej cyfrze.
- Dopasowanie zawartości: wybór zapamiętany w przeglądarce
  (`KLUCZ_DOPASOWANIA_ZAWARTOSCI`), domyślnie „Przeskaluj”; skalowanie obejmuje położenie
  w kontenerach swobodnych i rozmiary w mm (osobno w poziomie i w pionie; przy obrocie
  90° / 270° osie zamienione). Rozmiary w % i „wypełnij” dopasowują się same.
- Skalowanie stosuje ten sam współczynnik karty na każdym poziomie drzewa: zagnieżdżony
  kontener swobodny w mm skaluje się razem z położeniami swoich dzieci (spójnie). Kontener
  „auto” może po skalowaniu dzieci zmienić rozmiar – przyjęte jako wystarczające.
- Tył zapisany w bibliotece przeglądarki aktualizuje się po każdym zapisie w edytorze; kopie
  dołączone wcześniej do innych projektów zostają bez zmian (nie są „powiązane”).
- Kopia w nowym rozmiarze powstaje w tym samym projekcie, nazwa „<nazwa> (<szer>×<wys>)”
  (zajęta – kolejny numer), bez przypisań, i od razu otwiera się w edytorze.
- Kontrola przy przypisaniu: przody talii bez własnego tyłu (pusta talia – szablony projektu
  bez przypisania) albo przody wybranych kart; tył z innego projektu jest sprawdzany przed
  dołączeniem (`dolaczRewersGlobalnyDoProjektu(…, sprawdz)`).
- Druk dwustronny: komunikat w sekcji „Druk dwustronny” i pytanie przed „Pobierz PDF”.
- „Edytor kart” w edytorze tyłu jest teraz przyciskiem jak w edytorze przodu (był odnośnikiem).
- EN: „Unlock” zastąpione „Make editable” (zakazany zwrot w regułach instrukcji).

## Usunięty dubel

Dwa edytory miały razem 933 linie, z czego ok. 250 to powielone fragmenty: panel karty
(rozmiar, tło, ramka z odsunięciem i promieniem, kontener karty) oraz otoczka edytora
(duplikat, link do kopii, eksport/import pliku, stały obraz, teksty). Po zmianie jest jedna
implementacja każdego z nich; tył dostał przy okazji rogi, orientację, postrzępienie, zestawy
stylów i grupy stylów.
