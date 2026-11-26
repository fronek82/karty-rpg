# Plan UI2 – nowy wygląd „drukarnia riso” i nowy przepływ pracy

Etap po N12. Zmienia **warstwę interfejsu**: wygląd całej aplikacji, układ ekranów i drogę od
pustego projektu do wydruku. **Silnik układu, scena, PDF i format plików zostają bez zmian**, o ile
plan wprost nie mówi inaczej. Jeśli któryś krok wymaga zmiany modelu, obowiązuje zasada z `CLAUDE.md`
(nowa wersja schematu, migracja, test).

**Status:** wygląd i przepływ zaakceptowane przez właściciela 26.11.2026 na makietach w Claude Design.
Realizacja etapami R1…R9 (sekcja 7), każdy etap osobnym PR.

## 1. Makiety

Źródła makiet leżą w `docs/makiety-ui2/` (pliki `.dc.html` z Claude Design: zwykły HTML ze stylami
w atrybutach i krótką logiką w klasie `Component`). Nie da się ich uruchomić poza Claude Design
(brak `support.js`), ale **są wiążącym wzorem**: kolory, odstępy, teksty, kolejność elementów
i zachowanie (logika w `renderVals()`) czytaj wprost z plików.

| Plik                  | Ekran                                          | Etap  |
| --------------------- | ---------------------------------------------- | ----- |
| `Riso.dc.html`        | Strona główna – motyw jasny (obowiązujący)     | R2    |
| `RisoDark.dc.html`    | Strona główna – motyw ciemny                   | R1    |
| `NowyProjekt.dc.html` | Okno „Nowy projekt”                            | R3    |
| `Edytor.dc.html`      | Krok 1: edytor szablonu (z linijkami, liniami) | R4–R5 |
| `Karty.dc.html`       | Krok 2: karty projektu                         | R6    |
| `Druk.dc.html`        | Krok 3: druk                                   | R7    |
| `Mausritter.dc.html`  | Projekt Mausrittera: karty na arkuszach        | R8    |

Uwaga: przykładowe dane w makietach (zaklęcia, „Mag – sekret”, „Arkusz Avery 3×3”) są tylko
ilustracją. W aplikacji nie wolno dodawać gotowców pod konkretne gry (zasada z `CLAUDE.md`).

## 2. Cel i kryterium ukończenia

Po przebudowie:

- cała aplikacja ma jeden spójny wygląd „drukarnia riso”: papierowe tło, czarne linie 1,5–3 px,
  stonowane kolory risografu, w dwóch motywach (jasny, ciemny);
- strona główna ma tylko dwa przyciski tworzenia: **„+ Nowe karty”** i **„Mausritter A4”**;
- każdy zwykły projekt prowadzi przez trzy kroki widoczne w nagłówku: **1 Szablony → 2 Karty → 3 Druk**
  (projekt Mausrittera: **1 Karty na arkuszach → 2 Druk**);
- edytor szablonu działa jak program graficzny (Photoshop) i jest przystępny dla nowicjusza:
  wąskie paski ikon z dymkami, panele zwijane, linijki w mm, linie pomocnicze, przeciąganie elementów
  na kartę;
- wszystkie teksty w PL i EN (`src/i18n/pl.ts`, `en.ts`).

**Kryterium ukończenia:** dotychczasowe i nowe testy (sekcja 7) zielone w CI; zrzuty nowych ekranów
w obu motywach w `docs/obrazy/ui2/`; wzorce Playwright zmienione tylko świadomie i wymienione w PR.

Poza zakresem: nowe funkcje silnika i PDF, nowe gry, praca na telefonie (od ok. 1100 px szerokości).

## 3. Wygląd

### 3.1 Tokeny (do `src/ui/tokeny.css`, zastępują obecną paletę)

| Token                | Jasny     | Ciemny    | Zastosowanie                                                  |
| -------------------- | --------- | --------- | ------------------------------------------------------------- |
| `--tlo`              | `#F3F0E8` | `#17171A` | tło aplikacji i paneli                                        |
| `--tlo-pasek`        | `#EDE9E0` | `#1E1E22` | wąskie paski boczne, paski narzędzi, pasek stanu              |
| `--tlo-robocze`      | `#DCD8CE` | `#2A2A2F` | obszar roboczy pod kartą/arkuszem (z siatką kropek `#C3BEB2`) |
| `--powierzchnia`     | `#FFFFFF` | `#202024` | pola, kafelki, karty list                                     |
| `--tekst`            | `#111111` | `#E9E4D8` | tekst i główne linie                                          |
| `--tekst-2`          | `#5A5852` | `#A9A498` | opisy, podpowiedzi                                            |
| `--linia-2`          | `#C9C4B8` | `#3A3A40` | linie wewnątrz paneli                                         |
| `--akcent`           | `#E8B4A8` | `#B8675A` | główne wyróżnienie (łososiowy), zaznaczony kafelek opcji      |
| `--riso-roz`         | `#D98C8C` | `#B8675A` | druk riso: róż                                                |
| `--riso-niebieski`   | `#5D7FA3` | `#3F6A93` | druk riso: niebieski, cień zaznaczonej opcji                  |
| `--riso-ochra`       | `#E3C77A` | `#B8973F` | druk riso: ochra                                              |
| `--riso-szalwia`     | `#9DB59A` | `#5F8A5C` | druk riso: szałwia (etykieta MAUSRITTER)                      |
| `--zaznaczenie`      | `#3F6A93` | `#8FB0D1` | obrys zaznaczenia, pasy na linijkach, przeciąganie            |
| `--linia-pomocnicza` | `#1A9BB5` | `#4FC3DB` | linie pomocnicze w edytorze                                   |

- Efekt riso: dwa przesunięte prostokąty z `mix-blend-mode: multiply` (jasny) / `screen` (ciemny).
- Przyciski: prostokątne, bez zaokrągleń, obramowanie 1,5–2 px `--tekst`. Główny przycisk:
  tło `--tekst`, napis `--tlo`. Zaznaczona opcja: tło `--akcent` + cień `5px 5px 0 --riso-niebieski`.
- Ciemny motyw: ten sam układ, odwrócone tło/tekst, przyciemnione kolory riso (tabela).
- Kolory jaskrawe są zakazane (właściciel odrzucił pierwszą, „kłującą w oczy” wersję).

### 3.2 Czcionki

- Nagłówki i nazwy: **Archivo Black**; tekst interfejsu: **Archivo** (400/500/700);
  etykiety techniczne, wymiary, liczniki: **IBM Plex Mono** (400/600). Wszystkie OFL – dopisać
  do `LICENCJE.md`, pliki lokalnie (bez zależności od Google Fonts w czasie działania).
- Obecna czcionka tytułu (Cinzel Decorative) przestaje być używana w interfejsie.

### 3.3 Zasady układu (obowiązują na każdym ekranie)

- **Wyrównanie linii:** poziome linie sąsiednich kolumn muszą leżeć na tej samej wysokości.
  Nagłówek lewego paska, pasek nad obszarem roboczym i nagłówek prawego panelu mają tę samą wysokość
  liczoną **razem z linią** (`box-sizing: border-box`). Dolny przycisk „Zwiń” lewego paska i dolny
  pasek stanu mają tę samą wysokość (44 px). Właściciel sprawdza to na zrzutach – to nie kosmetyka.
- Cele kliknięcia ≥ 40 px (przyciski paska ≥ 36 px).
- Wszystkie ikony to jeden zestaw rysowany kreską (SVG, `stroke` 1,8–2), bez emoji.
  Cofnij/Ponów mają te same ikony na każdym ekranie.

## 4. Wspólne komponenty (etap R1)

### 4.1 Nagłówek projektu (`NaglowekProjektu`)

Jeden komponent na wszystkich ekranach projektu (edytor, karty, druk, Mausritter):

- z lewej: `← Projekty`, nazwa projektu, (Mausritter: etykieta „MAUSRITTER”), **ścieżka kroków**:
  aktywny krok ma czarne tło i numer na `--akcent`, pozostałe są linkami;
- z prawej: Cofnij, Ponów, separator, Ustawienia (ikona zębatki), „✓ zapisano” (stan zapisu
  z `useProjekt`), główny przycisk kroku: „Przejdź do kart →” / „Do druku →” / „⤓ Pobierz PDF”;
- **bez przycisku „Biblioteka”** – biblioteka jest w prawym pasku edytora i w polach obrazu,
  a zarządzanie nią na stronie głównej (decyzja D8).

### 4.2 Wąski pasek boczny (`PasekBoczny`)

Używany po lewej stronie edytora, kart, druku i Mausrittera (oraz w wersji „prawej” w edytorze):

- dwa stany: **zwinięty** (60 px, same ikony) i **rozwinięty** (220–230 px, ikony + nazwy +
  nagłówki grup + krótka wskazówka na dole); przełącznik `»` / `« Zwiń` na samym dole;
  stan zapamiętany w `localStorage` (klucz w `src/wspolne/ustawienia.ts`), osobno dla każdego ekranu;
- **dymek** w stanie zwiniętym: po najechaniu (lub fokusie klawiatury) **po 0,5 s** pojawia się
  czarny dymek z nazwą i krótką podpowiedzią po prawej stronie ikony (po lewej dla paska prawego);
  dymek to zwykły element w DOM (nie `title`, nie pseudo-element z `attr()` – to dawało pusty
  czarny prostokąt); znika od razu po zjechaniu;
- na górze nagłówek o wysokości paska narzędzi obok (3.3), w stanie rozwiniętym z tytułem
  (np. „DODAJ ELEMENT”), w zwiniętym pusty – ikony zaczynają się **pod** linią paska.

### 4.3 Panel z sekcjami

Prawe panele: nagłówek (wysokość jak pasek obok), sekcje zwijane (`<details>`-podobne)
z nagłówkiem pogrubionym i strzałką ▾/▸; rzadziej używane sekcje domyślnie zwinięte.

## 5. Ekrany

### 5.1 Strona główna (R2, `src/ui/start/`)

Wzór: `Riso.dc.html`.

- Nagłówek: logo riso + „KARTY RPG” (Archivo Black 44 px) + „KREATOR KART RPG · v…”;
  przyciski: Biblioteka, Ustawienia, Kopia i import.
- Lewa kolumna: duży przycisk **„+ NOWE KARTY”** (tło `--akcent`, cień niebieski), sekcja
  „GOTOWE UKŁADY” z jednym przyciskiem **„Mausritter A4”**, na dole „Postaw kawę twórcy”
  (Buy Me a Coffee, `fronek82`). **Nie ma** przycisków „Szablon: przód/tył” (D1).
- Środek: „Moje projekty 03”, linki „Szablony (n)” i „Arkusze do druku”, szukaj.
  Siatka kafelków projektów: podgląd na „arkuszu” ze znacznikami cięcia w rogach, etykieta
  wymiarów **pod podglądem** (nie na nim), format + data, nazwa (Archivo Black 20 px,
  **zawsze 2 linie** – `min-height` + ucięcie wielokropkiem), liczba kart i arkuszy, przyciski
  „Otwórz” / „Drukuj” przyklejone do dołu kafelka (kafelki w rzędzie równe – D2).
- Podgląd projektu = **miniatura prawdziwej karty** (domyślnie pierwszej; opcja „Ustaw jako
  okładkę” w edytorze kart), pod nią przesunięty kolorowy prostokąt riso. Pusty projekt –
  zastępczy prostokąt z symbolem (D3).
- Zakładka „Szablony” = przegląd szablonów ze wszystkich projektów + eksport/import pliku;
  bez tworzenia od zera.

### 5.2 Okno „Nowy projekt” (R3)

Wzór: `NowyProjekt.dc.html`. Okno modalne nad przyciemnioną stroną główną.

1. **Nazwa projektu.**
2. **Jak zacząć:** `Pusta karta` (domyślnie) / `Z szablonu` / `Import pliku`.
   „Z szablonu” jest wyszarzone z dopiskiem „Brak szablonów – pierwszy powstanie w projekcie”,
   gdy nie ma żadnych szablonów.
3. Dalsza część zależy od wyboru:
   - **Pusta karta:** krok 3 „Rozmiar karty” – kafelki Poker 63×88, Mini euro 44×67,
     Mini US 41×63, Tarot 70×120, Kwadrat 70×70, Własny (pola mm); przełącznik
     **Pionowo | Poziomo** zamienia wymiary i obraca zarysy (D4); krok 4 „Strony karty” –
     **Przód (awers)** i **Tył (rewers)** zaznaczane niezależnie, co najmniej jedna strona
     (można zrobić sam tył – D5).
   - **Z szablonu:** kafelki szablonów z miniaturą przodu (i tyłu, jeśli jest), projektem źródłowym,
     rozmiarem; szablon jest **kopiowany** do nowego projektu.
   - **Import pliku:** strefa „Przeciągnij tu plik .json / Wybierz z dysku…”, po wczytaniu podgląd
     (nazwa, rozmiar, przód+tył, liczba pól); przycisk główny nieaktywny do czasu wyboru pliku.
4. Dół: dopisek, co się otworzy (np. „Otworzy się edytor przodu. Tył dodasz później.”,
   „Otworzy się edytor z zakładkami Przód i Tył.”, „Kopia szablonu – otworzy się lista kart
   do wypełnienia.”), przyciski **Anuluj** i **Utwórz projekt** (jedna etykieta – D6).
5. Po utworzeniu: pusta karta → edytor szablonu (krok 1) w **układzie swobodnym**;
   z szablonu / z pliku → karty (krok 2).

### 5.3 Krok 1: edytor szablonu (R4, `src/ui/szablon/`)

Wzór: `Edytor.dc.html`. Układ od lewej:

- **Lewy pasek „Dodaj element”** (4.2), domyślnie zwinięty. Wszystkie 15 typów z dawnego menu
  „+ Dodaj” (`PozycjeMenuDodaj.tsx`), wypisane osobno, w grupach:
  - **Układ:** **Swobodny (pierwszy, oznaczony „DOMYŚLNY”)**, Wiersz, Kolumna, Warstwy;
  - **Treść:** Tekst, Etykieta + wartość, Wartość w kształcie, Pole do wpisania, Znaczniki, Tabela;
  - **Grafika:** Obraz, Ikona;
  - **Ozdoby:** Separator, Separator z zakończeniami, Separator z motywem.
    Element można **przeciągnąć na kartę** (ląduje w miejscu upuszczenia – układ swobodny)
    albo **kliknąć** (dodaje w zaznaczonym kontenerze / na środku). Podczas przeciągania karta
    ma przerywaną obwódkę `--zaznaczenie` i podpowiedź „Upuść na karcie, żeby dodać: …”.
    Rewers: lista typów jak `RODZAJE_REWERSU`.
- **Środek:**
  - pasek zakładek szablonów projektu (jak dokumenty w Photoshopie): każda zakładka = szablon
    (mały znacznik koloru ramki, nazwa, rozmiar), przycisk **„＋ Nowy szablon”** (nowy rodzaj
    karty w tym projekcie), po prawej przełącznik **Przód | Tył**;
  - obszar roboczy z kartą, **linijki w mm** (5.4), pasek stanu: wymiary, układ, przyciąganie,
    liczba linii pomocniczych, powiększenie (−, %, +, Dopasuj).
- **Prawy panel** (300 px) + **prawy pasek ikon** (52 px, dymki po lewej):
  Właściwości elementu, Karta (rozmiar i rogi, ramka, tło, tekstura i krawędź, układ karty),
  Style (zestawy, grupy, kopiuj/wklej styl), **Biblioteka** (przełącznik Moja/Systemowe,
  „＋ Wgraj obraz”, „＋ Wgraj czcionkę”, siatka miniatur do przeciągania na kartę,
  „Otwórz całą bibliotekę ↗”), Przyciąganie (do pól, siatka, podkład ze wzoru).
  Strzałka na dole paska chowa panel.
- **Struktura** (drzewo, dawne `DrzewoSzablonu`) pod panelem właściwości, jak warstwy
  w Photoshopie: nagłówek „▾ Struktura” zwija ją do paska, **granica z panelem jest przesuwana**
  myszą (120–600 px, zapamiętane), w nagłówku ↑ ↓ ⧉ ✕.
- Menu „Szablon ▾” w nagłówku: import, eksport, duplikuj, układ ze zdjęcia, podkład.
- Domyślny układ nowej karty: swobodny (D7).

### 5.4 Linijki i linie pomocnicze (R5)

- Linijki u góry i z lewej, **w mm, zero w lewym górnym rogu karty**, wystają ok. 10 mm poza kartę;
  kreski co 1 mm (krótkie), 5 mm (średnie), 10 mm (długie, ciemne, z numerem cm).
  W rogu oznaczenie jednostki. Skalują się i przesuwają z powiększeniem i przewijaniem.
- Zaznaczony (i przeciągany) element jest pokazany na obu linijkach pasem `--zaznaczenie`
  (od–do w mm), zgodnie z panelem „Położenie i rozmiar”.
- **Linie pomocnicze:** przeciągnięcie z górnej linijki tworzy linię poziomą, z lewej – pionową;
  w czasie przeciągania etykieta z pozycją w mm; krok 0,5 mm; istniejącą linię się przesuwa;
  upuszczenie na linijce ją usuwa; „Usuń linie” w pasku stanu. Elementy przyciągają się do linii
  pomocniczych (jak do krawędzi pól). Linie zapisują się w szablonie i **nie drukują się**.
  Skrót pokaż/ukryj: `Ctrl+;`. Zapis w szablonie = zmiana modelu → nowa wersja schematu + migracja.

### 5.5 Krok 2: karty (R6, nowy widok nad danymi kart)

Wzór: `Karty.dc.html`. **Ten ekran służy tylko do wypełniania kart**; układanie na arkuszach
przechodzi do kroku 3 (D9).

- Lewy pasek „Dodaj karty”: miniatury szablonów projektu (przeciągnij na listę albo kliknij →
  nowa karta na końcu), „＋ Nowy szablon”, grupa „Dane”: Import z CSV / Excela, Eksport do CSV.
- Pasek nad kartami: **Podgląd | Tabela**, **Strona: Przód | Tył | Obie**, szukaj, filtr szablonu.
  - Podgląd: siatka miniatur kart (prawdziwy render), zaznaczona z obrysem `--zaznaczenie`,
    znaczek „×N” przy kopiach; „Obie” pokazuje parę przód + tył; na końcu pole
    „Przeciągnij tu szablon”.
  - Tabela: wiersz = karta, kolumny = pola szablonu + Kopie + Tył (znacznik koloru); edycja jak
    w arkuszu kalkulacyjnym (Tab, wklejanie kolumny z Excela).
- Prawy panel „Karta”: w nagłówku **⧉ Duplikuj** i **✕ Usuń**; podgląd przodu i małego tyłu;
  „Szablon: … · Edytuj wygląd ↗”; pola wygenerowane z szablonu; obraz (Z biblioteki… / ＋ Wgraj);
  **Kopii do druku** (− / +); **Tył karty** (wybór, każda karta może mieć inny tył).
- Pasek stanu: liczba kart, liczba do druku z kopiami, przybliżona liczba arkuszy.
- Zaznaczanie wielu kart (Shift/Ctrl) – wspólne pola jak w obecnym `PanelKart.tsx`.

### 5.6 Krok 3: druk (R7, dawne ustawienia kartki)

Wzór: `Druk.dc.html`. Wszystkie dotychczasowe opcje druku zostają – zmienia się tylko układ.

- Lewy pasek „Karty w druku”: lista kart z liczbą kopii i polem wyboru (odznaczona = pominięta
  w tym druku); liczba kopii zmienia się w kroku 2.
- Środek: podgląd stron w skali ze slotami, liniami cięcia i marginesem bezpieczeństwa (różowa
  przerywana linia); **Pokaż: Przody | Tyły | Przód + tył** (tył lustrzanie, wyłączone bez druku
  dwustronnego); numery stron na dole; podsumowanie „N kart · M na stronę · K strony (+ tyły)”.
- Prawy panel „Ustawienia druku”, sekcje (otwarte: Papier, Układ, Linie cięcia, Pobierz):
  - **Papier:** kafelki A4, Letter, A5, Zdjęcie 10×15, 13×18, 15×21, Własny; orientacja;
    kolor / czarno-biało; margines bezpieczeństwa;
  - **Układ kart na arkuszu:** jeden rozmiar / mieszane (pasy, MaxRects, obracanie, grupowanie,
    odstęp, kolejność); automatyczny / własny (marginesy, kolumny, rzędy, odstępy, przesunięcie);
    wynik „k × r = n na stronę”; **Moje układy** (lista, Użyj, Zapisz jako mój układ);
  - **Linie cięcia:** włącz; **grubość** (0,1/0,2/0,3/0,5 mm); **kolor** (próbki + własny);
    **kreska** i **przerwa** w mm (przerwa 0 = ciągła); podgląd linii (ciemne tło przy jasnym
    kolorze); informacja, że w trybie drukarni są znaczniki zamiast linii;
  - **Druk dwustronny:** włącz, krawędź odwracania, korekta tyłu X/Y, wydruk próbny;
  - **Karta w slocie:** położenie, luz, linie wokół karty/slotu, tło do krawędzi slotu;
  - **Tryb drukarni:** spad, znaczniki cięcia, wymiary netto/brutto;
  - **Tytuł arkusza:** treść, położenie;
  - **Kalibracja drukarki:** wydruk testowy 100 %, przesunięcie X/Y;
  - **Pobierz:** PDF (główny), strony JPG/PNG, karty osobno ZIP, warstwa tekstowa PDF.
- Zmiany na podglądzie widać od razu (papier, orientacja, linie, odznaczenie kart).

### 5.7 Mausritter (R8, `src/pakiety/mausritter/`, edytor kartki)

Wzór: `Mausritter.dc.html`. Bez szablonów, bez tyłów, bez importu CSV (decyzje z listopada).

- Kliknięcie „Mausritter A4” tworzy projekt i pokazuje okno **„Od czego zaczynamy?”**:
  **Pusty arkusz A4** (siatka 7 × 10 kafelków) albo gotowe arkusze: Broń i pancerze,
  Wyposażenie, Stany, Wszystkie trzy (`gotoweUkladyMausrittera`); pod spodem nota o grze.
- Nagłówek: etykieta MAUSRITTER, kroki **1 Karty na arkuszach → 2 Druk** (druk = ekran z 5.6).
- Lewy pasek „Dodaj kartę”: Broń, Zbroja, Ekwipunek, Zaklęcie, Stan, Pusta karta, przy każdym
  dostępne rozmiary (`typyKartMausrittera`); przeciągnięcie na **konkretny wolny kafelek**
  albo kliknięcie (pierwsze wolne miejsce).
- Środek: zakładki arkuszy + „＋ Arkusz”, licznik „zajęte / 70 kafelków”, arkusz A4 z pionowym
  tytułem i siatką; karty wielokafelkowe zajmują 1×2, 2×1, 2×2; przeciąganie karty na inne wolne
  miejsce.
- Prawy panel: rozmiar w kafelkach (rozmiary, które się nie zmieszczą – wyszarzone), wariant
  (Przedmiot/Sakiewka), nazwa, obrażenia/obrona/pojemność, opis/usunięcie, kropki użycia, obraz,
  Duplikuj/Usuń. Bez zaznaczenia: tytuł arkusza.

## 6. Mapowanie na kod (punkt wyjścia)

| Obszar          | Obecnie                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tokeny, motywy  | `src/ui/tokeny.css`, `App.css`, `edytory.css`, `pasek.css`, `motyw.ts`                                                                                   |
| Nagłówek        | `NaglowekAplikacji.tsx`, `pasek-gorny` w edytorach                                                                                                       |
| Start           | `src/ui/start/` (`Start.tsx`, `ListaProjektow.tsx`, kreatory)                                                                                            |
| Nowy projekt    | `src/dane/nowyProjekt.ts`, `ui/szablon/Kreator.tsx`                                                                                                      |
| Edytor szablonu | `EdytorKarty.tsx`, `EdytorDrzewa.tsx`, `DrzewoSzablonu.tsx`, `Panel*.tsx`, `PozycjeMenuDodaj.tsx`, `swobodnyMysz.ts`, `upuszczanie.ts`                   |
| Karty i druk    | `src/ui/kartka/` (`EdytorKartki.tsx`, `PanelKart.tsx`, `PanelUstawien.tsx`, `PanelUkladu.tsx`, `MenuPobierz.tsx`, `ImportDanych.tsx`, `MenuRewersu.tsx`) |
| Biblioteka      | `src/ui/biblioteki/`, `useBiblioteka.ts`                                                                                                                 |
| Mausritter      | `src/pakiety/mausritter/` (`kartka.ts`, `arkusze.ts`)                                                                                                    |

Podział `kartka/` na krok 2 (Karty) i krok 3 (Druk) to największa zmiana. Najpierw sprawdź, czy
da się go zrobić **bez zmiany modelu** (talie = dane kart, arkusze = druk). Decyzję i powód zapisz
w sekcji 9.

## 7. Etapy

Każdy etap: gałąź od aktualnego `main`, commit po każdym kroku, PR, przegląd według
`.claude/agents/recenzent.md`, scalenie przez właściciela.

| Etap | Zakres                                                                                                                                          | Testy                                                                                                                                                     |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | Tokeny i czcionki (jasny + ciemny), `NaglowekProjektu`, `PasekBoczny` (zwijanie, dymek 0,5 s, zapamiętanie), panel z sekcjami, wyrównanie linii | Vitest: tokeny obu motywów kompletne; Playwright: dymek pojawia się po opóźnieniu i ma tekst; wysokości pasków równe (porównanie `getBoundingClientRect`) |
| R2   | Strona główna (5.1), miniatury prawdziwych kart, równe kafelki                                                                                  | Playwright: długa nazwa nie psuje wyrównania przycisków; tylko 2 przyciski tworzenia                                                                      |
| R3   | Okno „Nowy projekt” (5.2) z orientacją i stronami                                                                                               | Vitest: zamiana wymiarów, walidacja „co najmniej jedna strona”; Playwright: trzy ścieżki startu                                                           |
| R4   | Edytor szablonu (5.3): paski, zakładki szablonów, panele, Struktura przesuwana, przeciąganie elementów                                          | Playwright: przeciągnięcie elementu na kartę dodaje go w miejscu upuszczenia; swobodny domyślny                                                           |
| R5   | Linijki i linie pomocnicze (5.4) + schemat                                                                                                      | Vitest: przeliczenie px↔mm, krok 0,5 mm, migracja; Playwright: dodanie, przesunięcie, usunięcie linii                                                     |
| R6   | Krok 2 – Karty (5.5)                                                                                                                            | Playwright: podgląd/tabela, przód/tył/obie, kopie, tył karty                                                                                              |
| R7   | Krok 3 – Druk (5.6) ze wszystkimi opcjami                                                                                                       | Dotychczasowe testy druku i PDF bez zmian wyniku; Playwright: linie cięcia (grubość, kolor, kreska)                                                       |
| R8   | Mausritter (5.7)                                                                                                                                | Vitest: mieszczenie kart w siatce; Playwright: okno startu, przeciągnięcie na kafelek                                                                     |
| R9   | Instrukcja PL/EN, zrzuty `docs/obrazy/ui2/` w obu motywach, porządki, `CLAUDE.md`                                                               | Galeria jak w UI-9                                                                                                                                        |

## 8. Zasady pracy dla agenta (także Antigravity / Gemini)

- Przeczytaj najpierw `CLAUDE.md` (architektura, zasady kodu, i18n, nazwy po polsku) i ten plan.
- Makiety z `docs/makiety-ui2/` są wzorem – nie wymyślaj własnego wyglądu ani nowych kolorów.
- Nie ruszaj silnika, sceny i PDF bez potrzeby z planu. Wzorce PNG kart i arkuszy nie mogą się
  zmienić w R1–R6.
- **Oszczędzanie limitu:** lokalnie uruchamiaj tylko testy zmienionych plików
  (`npx vitest run <ścieżki>`, `npx playwright test testy/<plik>.spec.ts --trace off`), pełny
  zestaw zostaw CI; wypchnij gałąź, otwórz PR, sprawdź CI raz – bez czekania w pętli; zrzuty
  i galerie tylko na koniec etapu; z logów czytaj tylko błędy.
- Każdy nowy tekst: klucz w `pl.ts` i `en.ts`.
- Po każdym etapie: podsumowanie po polsku – co sprawdzić krok po kroku, zrzuty nowych widoków.

## 9. Decyzje

- **D1** Strona główna: tylko „+ Nowe karty” i „Mausritter A4”; tworzenie szablonów przodu/tyłu
  wyłącznie wewnątrz projektu.
- **D2** Kafelki projektów w rzędzie równe: tytuł na 2 linie, przyciski przyklejone do dołu.
- **D3** Podgląd projektu = miniatura prawdziwej karty (pierwszej lub wybranej okładki).
- **D4** Orientacja karty wybierana już w oknie „Nowy projekt” (Pionowo/Poziomo).
- **D5** Przód i tył zaznaczane niezależnie; dozwolony projekt z samym tyłem.
- **D6** Jeden przycisk „Utwórz projekt”; co się otworzy, mówi dopisek obok.
- **D7** Układ swobodny jest pierwszy w menu i domyślny dla nowych kart.
- **D8** Brak przycisku „Biblioteka” w nagłówkach ekranów projektu; zarządzanie biblioteką ze strony
  głównej, użycie w edytorze (prawy pasek) i w polach obrazu.
- **D9** Krok „Karty” tylko do wypełniania danych; układ na arkuszach i wszystkie opcje druku
  w kroku „Druk”.
- **D10** Motyw: „drukarnia riso”, stonowane kolory; ciemny motyw ze screen-blend.
- **D11** Dymki pasków bocznych po 0,5 s, tylko w stanie zwiniętym.
- **D12** Linijki w mm z zerem w rogu karty i linie pomocnicze jak w Photoshopie, niedrukowane.
- **D13 (R1)** Dla zachowania spójności i kontrastu dotychczasowych ekranów w trakcie migracji R1–R8
  dotychczasowe nazwy tokenów w `tokeny.css` zostały zmapowane na nową paletę „drukarnia riso”.
  Do niezależnej weryfikacji komponentów R1 w Playwright (dymek 0,5 s, wyrównanie wysokości pasków)
  dodano wewnętrzną trasę `#/ui2-podglad` (do usunięcia w R9).

Nowe decyzje podjęte w trakcie realizacji dopisuj tutaj z numerem etapu.
