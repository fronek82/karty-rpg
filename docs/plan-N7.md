# Etap N7 — układ ze zdjęcia w edytorze i Biblioteki

## Zakres

1. **Układ ze zdjęcia (AI) w Edytorze szablonu i rewersu** (`src/ui/szablon/OknoUkladuZeZdjecia.tsx`,
   wspólne `EdytorDrzewa.tsx`): przycisk „Układ ze zdjęcia” w górnym pasku otwiera okno (klucz API,
   zdjęcie, „Rozpoznaj układ”, podgląd). Pola trafiają na aktualnie edytowaną stronę (awers albo
   rewers) w jej rozmiarze. Gdy strona ma elementy – „Zastąp elementy” / „Dodaj obok”, na pustej
   „Wstaw układ”. Logika: `wstawUkladAi` w `src/dane/aiUklad.ts`. Usunięte: ekran `#/wlasne/ai`
   (`KreatorAiStrona.tsx`) i kafelek na „Stwórz własne karty”.
2. **Menu „Biblioteki”** (`#/biblioteki/obrazy|czcionki|ozdobniki`): link w pasku górnym obok
   „Ustawień” (także w edytorach – przez straż niezapisanych zmian). Jeden komponent strony
   `StronaBiblioteki` (zakładki, „Dodaj…”, wyszukiwarka, wyśrodkowana siatka podglądów, usuwanie
   bez potwierdzenia z paskiem „Cofnij” – `PasekKomunikatu` z N6); podstrony w `Biblioteki.tsx`:
   - Obrazy – miniatury; Czcionki – próbka tekstu każdym krojem (`FontFace`), pliki i „Katalog
     Google Fonts”; Ozdobniki – miniatury ozdobników i ramek, dodawanie z SVG, PNG (ramka 9-slice)
     i `.kartyrpg-ozdobnik` (`plikiOzdobnikow.ts`, `spakujOzdobnik` w `archiwum.ts`), „Eksportuj”.
   - „Ustawienia” mają tylko konfigurację (motyw, język, kolory przycisków) i link do instrukcji;
     okna „Wgrywanie czcionek / obrazów” (`OknaZasobow.tsx`) usunięte.
3. Instrukcja: sekcje „Układ ze zdjęcia i galeria szablonów”, „Biblioteki: obrazy, czcionki
   i ozdobniki” (nowe id `pl-biblioteki` / `en-biblioteki`), „Język i motyw”, katalog czcionek.

Zrzut: `docs/obrazy/n7-biblioteki.png`.

## Decyzje

- „Zastąp” i „Dodaj obok” nie zmieniają rozmiaru, tła, ramki ani rogów strony – AI dostarcza tylko
  pola. „Zastąp” czyści też przykładowe dane szablonu; „Dodaj obok” dokłada pola na koniec
  korzenia (zawsze kontener swobodny) z nowymi id i kluczami (bez kolizji z danymi kart).
- Rewers: pola stałe (tekst z przykładu AI), bez kluczy; tabele są pomijane (bez danych nic by nie
  pokazały). Podkład ze zdjęcia – tylko awers (rewers nie ma podkładu).
- Podgląd w oknie AI rysuje silnik edytora (czcionki projektu), jak po „Zastąp”.
- Stary adres `#/wlasne/ai` pokazuje ekran „Stwórz własne karty”.
- Biblioteki są globalne (przeglądarka), bez kontekstu projektu. Znika „Dodaj do projektu” z okien
  zasobów: czcionki z biblioteki i tak są na listach czcionek w edytorach (synchronizacja przy
  użyciu), obrazy trafiają do nowych projektów. Dług (do decyzji właściciela): brak drogi „obraz
  z biblioteki → istniejący projekt”.
- Ozdobnik do projektu nadal przez bibliotekę ozdobników projektu („Globalna biblioteka ozdobników”
  → „Użyj”); jej przycisk „Usuń” (z `confirm`) przeniesiony do „Bibliotek”, w panelu jest link
  „Zarządzaj w Bibliotekach”. Strona ozdobników projektu (edycja rodzaju, ramki 9-slice) zostaje.
- SVG dodany wprost do „Bibliotek” dostaje rodzaj rozpoznany przy imporcie i kolor jednolity; PNG –
  ramkę 9-slice z wcięciami po trzecim. Zmiana rodzaju / wcięć – po „Użyj” w projekcie.
- „Cofnij” zapisuje wpis z tym samym id i bajtami; nowe usunięcie zastępuje poprzedni pasek,
  zmiana zakładki go zamyka. Jedna operacja na bazie naraz (jak w N6).
- Wyszukiwarka – ta sama normalizacja co w N6 (`doSzukania`); lista posortowana po nazwie.
