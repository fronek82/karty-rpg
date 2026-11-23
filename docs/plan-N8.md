# Plan N8 – jedna biblioteka zasobów użytkownika

Cel: jedna biblioteka w przeglądarce, wspólna dla wszystkich projektów, obejmująca ozdobniki
(z ikonami SVG i ramkami 9-slice), obrazy i czcionki. Znika biblioteka projektu
(`Projekt.biblioteka`, zasoby obrazów i czcionek w projekcie) i przycisk „Użyj”.

Zasady dla każdego rodzaju:

- źródłem prawdy jest biblioteka w bazie; projekt, szablon i rewers trzymają tylko odwołania po id
  (obrazy – id zasobu, ozdobniki – id elementu, czcionki – rodzina i wariant);
- każde dodanie (edytor, dane kart, biblioteka, import) liczy skrót treści – ten sam plik to jeden
  wpis w bibliotece;
- eksport projektu/szablonu/rewersu dołącza kopie użytych zasobów (format plików bez zmian), import
  dodaje je do biblioteki z deduplikacją (id, potem skrót) i przemapowaniem odwołań;
- w wyborach edytora dwie grupy: „Systemowe” i „Moja biblioteka”.

## Pod-etapy

### N8a – baza, migracja, render

1. Dexie w wersji 5: tabela `biblioteka` (`id, rodzaj, hash`) z metadanymi (opis obrazu/czcionki
   albo `ElementOzdobny`) i osobna `bajtyBiblioteki` (lista nie ładuje bajtów), `meta` (znacznik
   migracji), `kopiaMigracji` (kopia zapasowa wpisów projektów na czas migracji).
2. Migracja danych po otwarciu bazy (`db.on('ready')`, nie w `upgrade()`): kopia zapasowa →
   wpisy biblioteki globalnej (ozdobnik/obraz/czcionka) → zasoby i ozdobniki każdego projektu
   (z deduplikacją i przepisaniem odwołań) → sprzątanie i znacznik. Idempotentna: źródłem jest
   kopia zapasowa, bajty projektów są usuwane dopiero na końcu, dodawanie deduplikuje po skrócie.
3. Projekt w bazie trzyma tylko czcionki wbudowane (pakiet). `wczytaj` składa widok: zasoby
   projektu + wszystkie obrazy i czcionki biblioteki + ozdobniki biblioteki jako
   `biblioteka.ozdobniki`. Dzięki temu silnik, PDF, miniatury i dotychczasowe UI działają bez
   zmian, a wszystko z biblioteki jest od razu dostępne w każdym projekcie.
4. `zapisz` synchronizuje: nowe zasoby i elementy trafiają do biblioteki (deduplikacja – przy
   trafieniu w istniejący wpis odwołania są przepisywane, a mapa wraca do `useProjekt`), zmienione
   elementy są aktualizowane; dokument w bazie jest „odchudzony”.
5. Zgodność: `bibliotekaGlobalna/odczytajZBiblioteki/zapiszWBibliotece/usunZBiblioteki` dla
   rodzajów ozdobnik/obraz/czcionka działają na nowej tabeli (do czasu nowego UI w N8c).
6. Silnik: brakujący obraz, ikona lub kształt → szary prostokąt z przerywanym obrysem
   i przekątnymi; brakująca ramka, motyw, narożnik → przerywana linia. Brakująca czcionka →
   zapasowa (jak dotąd) z ostrzeżeniem.

### N8b – eksport i import

Eksport bierze z widoku tylko użyte zasoby (projekt: `projektDoEksportu` – już w N8a; szablon
i rewers – jak dotąd). Import projektu, szablonu, rewersu i paczki ozdobnika kończy się zapisem
(`BazaProjektow.zapisz` z bajtami albo `zapiszWBibliotece`), który dodaje dołączone kopie do
biblioteki z deduplikacją (id i treść, potem skrót) i przemapowaniem odwołań – bez osobnej ścieżki
importu. Testy: `src/dane/importBiblioteki.test.ts` (czysta baza, podwójny import, kolizja id
elementu o innej treści, szablon dodany dwa razy).

### N8c – UI biblioteki i wyborów

Strona Biblioteki z zakładkami Ozdobniki / Obrazy / Czcionki (pełne zarządzanie, ostrzeżenie
o projektach przy usuwaniu), hooki `useBiblioteka(rodzaj)`, grupy „Systemowe” / „Moja biblioteka”
we wszystkich wyborach, linki z edytora z `?powrot=`, usunięcie „Użyj”, `BibliotekaGlobalna.tsx`
dla tych rodzajów i widoku biblioteki projektu; teksty, instrukcja, SPEC.

## Decyzje

- Migracja danych nie w `upgrade()` (skróty `crypto.subtle` i rozpakowanie zamykają transakcję
  Dexie), tylko w `db.on('ready')` – inne operacje na bazie czekają na jej koniec.
- `WERSJA_SCHEMATU` bez zmian (29): kształt projektu się nie zmienia – w bazie po prostu nie ma
  w nim zasobów obrazów/czcionek ani `biblioteka`; pliki eksportu mają je jak dotąd.
- Czcionki identyfikuje rodzina i wariant (tak odwołuje się do nich szablon). Przy dodaniu czcionki
  o innym pliku, ale tej samej rodzinie i wariancie, zostaje wpis już obecny w bibliotece.
- Obraz ramki 9-slice z PNG jest zwykłym wpisem obrazu, oznaczonym `wewnetrzny` (ukryty na liście
  obrazów); usunięcie ramki usuwa też jej obraz.
- Bez limitu liczby wpisów (technicznie 5000); ostrzeżenie o miejscu przez
  `navigator.storage.estimate` w N8c.
- Widok projektu w N8a wczytuje bajty wszystkich obrazów i czcionek biblioteki (pamięć podręczna
  w obrębie bazy). Leniwe wczytywanie obrazów – w N8c, gdy wybory przejdą na hooki biblioteki.
- Zapis z projektu nigdy nie usuwa niczego z biblioteki (np. sprzątanie obrazów usuniętego
  projektu) – usuwa się tylko na stronie biblioteki.
- Eksport projektu bierze z widoku tylko użyte zasoby (`projektDoEksportu`) już w N8a – inaczej
  każdy plik `.kartyrpg` niósłby całą bibliotekę.
- Zapis zwykły (bez zmiany zasobów) przenosi do biblioteki tylko to, czego dokument używa:
  obraz lub ozdobnik usunięty na stronie biblioteki w innej karcie nie wraca i nie blokuje zapisu.
  Zapis po zmianie zasobów (wgranie pliku) przenosi wszystko, także jeszcze nieużyte.
- „Cofnij” po usunięciu z biblioteki przywraca ten sam wpis (id, opis, bajty) z kosza sesji.
- Migracja usuwa ze starych tabel tylko to, co przeniosła: wpis globalny, którego nie da się
  odczytać, zostaje (czytany jak dotąd), projekt, którego nie da się przenieść, zachowuje
  własne zasoby; dokument nie jest podmieniany, jeśli zmienił się od zrobienia kopii.
- Zastępczy rysunek: obraz (pole, tekstura), ikona – prostokąt z przekątnymi; motyw i ramka
  9-slice – linia przerywana. Brakujący własny kształt wartości rysuje się jak dotąd zwykłym
  prostokątem, nieznany narożnik nie rysuje się (kostki motywu zostają).
- N8c: strona Biblioteki to jedyne miejsce zarządzania (dawna trasa `#/projekt/<id>/biblioteka`
  przekierowuje na Biblioteki → Ozdobniki z `?powrot=`). Linki z edytora przechodzą przez straż
  wyjścia: przy niezapisanych zmianach (zapis ręczny) okno „Zapisz i wyjdź / Wyjdź bez zapisu /
  Zostań”, bo edytor jest odmontowywany.
- N8c: wybory ozdobników biorą elementy z widoku projektu i z biblioteki na żywo (`liveQuery`) –
  ozdobnik dodany w innej karcie jest od razu w wyborze i w podglądzie. Wybory obrazów i czcionek
  korzystają z widoku projektu (to już cała biblioteka); czcionki w `<optgroup>` „Systemowe”
  (wbudowane) / „Moja biblioteka”, obrazy bez obrazów ramek 9-slice.
- N8c: w Edytorze kart (zapis ręczny) wgrany plik trafia do biblioteki od razu, nie przy zapisie.
- N8c: podglądy na stronie Biblioteki (bez projektu) używają czcionek biblioteki i czcionki
  domyślnej aplikacji (EB Garamond z `public/czcionki`).
- N8c: dodatkowo naprawione angielskie „Gotowe” („Ready-made” → „Done”).
- Czcionki: ten sam plik pod inną rodziną lub wariantem to osobny wpis (poprawka po CI N8a).
