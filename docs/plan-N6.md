# Etap N6 — strona startowa i zarządzanie listami

## Zakres

1. **„Stwórz własne karty”** (`src/ui/start/WlasneKarty.tsx`): bez kafelka „Nowy szablon od zera”
   (jest na stronie głównej: „Nowy szablon” → Awers / Rewers). Kolejność od góry: „Moje szablony”
   (8 ostatnio zmienionych, `LIMIT_OSTATNICH`; „Pokaż wszystkie” otwiera zakładkę „Moje szablony”
   na starcie) → „Przykładowe szablony” → „Galeria szablonów online”.
2. **Bez globalnej biblioteki szablonów** – jedynym źródłem są „Moje szablony”. Usunięte: sekcja
   „Globalna biblioteka szablonów” (ekran własnych kart i „Szablony projektu”), przycisk „Zapisz
   w bibliotece globalnej” przy szablonie projektu, „Do biblioteki” w galerii online, teksty i opis
   w instrukcji. `BibliotekaGlobalna` obsługuje już tylko ozdobniki.
3. **Usuwanie bez potwierdzenia** z paskiem „Usunięto: <nazwa> — Cofnij” (`src/ui/PasekKomunikatu.tsx`:
   `PasekKomunikatu` + `usePasekKomunikatu`, wspólny dla aplikacji). Pasek na dole, wyśrodkowany,
   znika po 8 s (`CZAS_PASKA`), stoi, gdy kursor jest nad nim albo fokus w środku. „Cofnij” przywraca
   migawkę projektów z bazy (`BazaProjektow.migawka` / `przywroc`: dokument, bajty zasobów,
   miniatury projektu, szablonów i rewersów). Tryb zaznaczania („Zaznacz…”, pola wyboru, „Zaznacz
   wszystkie”, „Usuń zaznaczone”) – jeden pasek „Usunięto N elementów — Cofnij”.
4. **Wyszukiwarka po nazwie i sortowanie** (data zmiany ↑/↓, nazwa A–Z/Z–A) w „Moich projektach”
   i „Moich szablonach” (`filtrujISortuj` w `src/ui/start/mojeSzablony.ts`).
5. **„Duplikuj”** przy szablonie/rewersie w „Moich szablonach”: kopia „<nazwa> (kopia)” w tym samym
   projekcie, obok oryginału (`duplikujSzablonWProjekcie` / `duplikujRewersWProjekcie`).

Zrzut: `docs/obrazy/n6-wlasne-karty.png`.

## Decyzje

- Szablonu awersu, którego używają karty projektu, nie da się usunąć z „Moich szablonów” (dotąd
  kończyło się błędem spójności – N1-12). Element jest pomijany z komunikatem „Nie usunięto: … –
  usuń najpierw projekt”; przy usuwaniu zbiorczym pozostałe elementy są usuwane normalnie.
- „Cofnij” odtwarza wpisy projektów w bazie dokładnie w stanie sprzed usunięcia (także stan „tylko
  szablony”); jeśli usuwanie zbiorcze przerwie błąd, migawka jest przywracana od razu.
- Nowe usunięcie zastępuje poprzedni pasek (poprzedniego „Cofnij” już nie ma). Przejście na inny
  ekran zamyka pasek – usunięcie zostaje.
- Kliknięcie kafelka w „Moich szablonach” na ekranie własnych kart działa jak „Użyj w projekcie”
  (nowy projekt z kopią; oryginał bez zmian), tak jak kafelki przykładów.
- Szukanie ignoruje wielkość liter i znaki diakrytyczne; sortowanie po nazwie – `Intl.Collator`
  z liczbami naturalnie („Broń 2” przed „Broń 10”). Fraza i zaznaczenie zerują się przy zmianie
  zakładki.
- Trasa `#/wlasne/nowy` (wybór Awers / Rewers) zostaje – prowadzą do niej okruszki kreatora.

## W kodzie zostaje (nie UI)

- Tabela `bibliotekaGlobalna` w IndexedDB i `zapiszWBibliotece` / `odczytajZBiblioteki` /
  `usunZBiblioteki` – używane przez ozdobniki (`BibliotekaOzdobnikow`), globalne czcionki i obrazy
  (`zasobyGlobalne.ts`) i rewersy (`rewersyGlobalne.ts`). Rodzaj wpisu `'szablon'` jest w typie
  `WpisBibliotekiGlobalnej` dla zgodności – wpisy zapisane wcześniej zostają w bazie, ale nic ich nie
  czyta ani nie zapisuje.
