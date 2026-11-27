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
  Siatka kafelków projektów: podgląd na tle strony (`--tlo`), bez białego arkusza, ramki i znaczników
  cięcia (D17), etykieta formatu i wymiarów **pod podglądem** (nie na nim), format + data, nazwa
  (Archivo Black 20 px, **zawsze 2 linie** – `min-height` + ucięcie wielokropkiem), liczba kart
  i arkuszy, przyciski „Otwórz” / „Drukuj” przyklejone do dołu kafelka (kafelki w rzędzie równe – D2).
- Podgląd projektu = **miniatury prawdziwej karty: przód i tył obok siebie** (przód z lewej,
  odstęp ok. 14 px, ta sama skala, wysokość ok. 60 % obszaru o wysokości 220 px, wyśrodkowane;
  projekt bez tyłu – sam przód, projekt z samym tyłem – sam tył), każda karta z małym przesuniętym
  cieniem riso (`box-shadow 4px 4px 0`, bez `mix-blend`). Pusty projekt – zastępczy prostokąt
  z symbolem (D3, D17).
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
- **D14 (R6)** Rozdzielenie ekranu „Krok 2: Karty” (`EkranKart.tsx`, trasa `#/projekt/<id>/karty`)
  od „Krok 3: Druk” (`#/projekt/<id>/drukuj`) nie wymagało zmian w modelu projektu – `projekt.talie`
  (dane kart, kopie, przypisania tyłów) i `projekt.arkusze` (układ druku) były już rozdzielone.
  Dotychczasowa trasa `#/projekt/<id>` i `#/projekt/<id>/kartka/<aid>` pozostaje dla projektów
  arkuszowych i zgodności wstecznej.
- **D17** Miniatura projektu to przód i tył karty na tle strony, bez arkusza i znaczników cięcia.

Nowe decyzje podjęte w trakcie realizacji dopisuj tutaj z numerem etapu.

## 10. Stan po nocy

### Etapy scalone do `main`

- **PR #121** (`plan-ui2-riso`) – plan UI2 (był już scalony przed rozpoczęciem pracy).
- **R1 – PR #122 (`ui2-r1`, scalony `9acf040`)**: tokeny „drukarnia riso” (light + dark), lokalne czcionki OFL (`Archivo Black`, `Archivo`, `IBM Plex Mono`) + `LICENCJE.md`, wspólne komponenty `src/ui/ui2/` (`NaglowekProjektu`, `PasekBoczny` z dymkiem 0,5 s i zapamiętywaniem w `localStorage`, `PanelSekcji`, `Ikony`).
- **R2 – PR #123 (`ui2-r2`, scalony `3af614e`)**: strona główna riso, równe kafelki projektów z prawdziwymi miniaturami kart, znacznikami cięcia i wymiarami, tylko 2 przyciski tworzenia (`+ NOWE KARTY`, `Mausritter A4`).
- **R3 – PR #124 (`ui2-r3`, scalony `b237295`)**: okno „Nowy projekt” z 3 ścieżkami startu (Pusta karta z orientacją Pionowo/Poziomo i niezależnym Przód/Tył, Z szablonu, Import pliku), układ swobodny domyślny (D7).
- **R4 – PR #125 (`ui2-r4`, scalony `b87b44b`)**: edytor szablonu UI2 – lewy pasek elementów (15 typów w 4 grupach, `Swobodny` pierwszy z odznaką `DOMYŚLNY`), przeciąganie elementu na kartę w miejscu upuszczenia, zakładki szablonów + `＋ Nowy szablon`, przełącznik `Przód | Tył`, pasek stanu z zoomem, zwijana i przesuwana `Struktura` (120–600 px, zapamiętana w `localStorage`) i skrajny prawy pasek ikon 52 px.
- **R5 – PR #126 (`ui2-r5`, scalony `5b1ce45`)**: linijki w mm (zero w rogu karty, wystawanie 10 mm), pas zaznaczonego elementu na obu linijkach, linie pomocnicze (dodawanie z linijek co 0,5 mm, przesuwanie, usuwanie przez upuszczenie na linijce lub „Usuń linie”, skrót `Ctrl+;`), przyciąganie elementów swobodnych do linii pomocniczych, schemat `WERSJA_SCHEMATU = 35` z migracją `34 → 35` (linie nigdy nie drukują się ani nie trafiają do sceny SVG/PDF).
- **R6 – PR #127 (`ui2-r6`, scalony `27ebb22`)**: ekran „Krok 2: Karty” (`src/ui/karty/EkranKart.tsx`, trasa `#/projekt/<id>/karty`, decyzja D14 bez zmian modelu) – lewy pasek „Dodaj karty” (klik/drag szablonu, eksport CSV), widok `Podgląd | Tabela`, `Przód | Tył | Obie`, szukanie i filtr, prawy panel karty (duplikuj/usuń, pola, kopie `− / +`, wybór tyłu na kartę).
- **R7 – PR #128 (`ui2-r7`, scalony `335bac9`)**: ekran „Krok 3: Druk” – nowa sekcja „Linie cięcia” (`SekcjaLiniiCiecia.tsx`: włącznik, grubość 0,1/0,2/0,3/0,5 mm, próbki kolorów + własny, kreska i przerwa z 0 = ciągła, podgląd SVG z ciemnym tłem dla jasnych kolorów, komunikat o trybie drukarni) oraz nawigacja kroków UI2 w nagłówku `EdytorKartki`.
- **R8 – PR #129 (`ui2-r8`, scalony `0a8c631`)**: Mausritter – czysta logika siatki kafelków (`siatkaMausritter.ts` + testy Vitest), lewy pasek „Dodaj kartę” (6 typów, przeciąganie na konkretny wolny kafelek + kliknięcie w pierwsze wolne miejsce), licznik `zajęte / 70 kafelków`, zachowane dokładne wymiary wzorców PNG (`1036×733 px`).
- **R9 – bieżący PR (`ui2-r9`)**: usunięcie tymczasowej trasy `#/ui2-podglad` (testy R1 przeniesione na prawdziwy edytor), zrzuty UI2 w obu motywach w `docs/obrazy/ui2/`, aktualizacja `CLAUDE.md` oraz ta sekcja „Stan po nocy”.

### Co zostało (opcjonalne / na później)

- Rozbudowanie statycznej instrukcji (`instrukcja/index.html`) o nowe zrzuty z `docs/obrazy/ui2/` oraz opis przepływu `1 Szablony → 2 Karty → 3 Druk` i linii pomocniczych.
- Ewentualne dopracowanie wizualne szczegółów po obejrzeniu zrzutów w `docs/obrazy/ui2/` rano.

### Lista rzeczy do ręcznego sprawdzenia rano (krok po kroku)

1. **Strona główna (jasny i ciemny motyw)**:
   - Otwórz aplikację, przełącz motyw jasny/ciemny i język PL/EN.
   - Sprawdź, że w lewej kolumnie są tylko 2 przyciski tworzenia: `+ NOWE KARTY` i `Mausritter A4` (+ wsparcie).
   - Sprawdź, że kafelki projektów mają równe wysokości i przyciski `Otwórz` / `Drukuj` wyrównane do dołu.
2. **Okno „Nowy projekt”**:
   - Kliknij `+ NOWE KARTY`.
   - Przełącz `Pionowo` ↔ `Poziomo` i sprawdź, że wymiary formatów zamieniają się (np. `63×88` → `88×63`).
   - Zaznacz `Tył (rewers)` razem z `Przód (awers)` (lub sam `Tył`), zwróć uwagę na dynamiczny dopisek przy przycisku `Utwórz projekt`, i utwórz projekt.
3. **Edytor szablonu + linijki i linie pomocnicze**:
   - Najedź na ikonę w zwiniętym lewym pasku „Dodaj element” — po ok. 0,5 s pojawi się dymek z opisem. Rozwiń pasek (`»`) i sprawdź, że `Swobodny` jest pierwszy z odznaką `DOMYŚLNY`.
   - Przeciągnij element `Tekst` z lewego paska bezpośrednio na kartę — powinien wylądować w miejscu upuszczenia, a na obu linijkach pojawi się pas `--zaznaczenie`.
   - Przeciągnij z górnej i lewej linijki na kartę, żeby dodać linie pomocnicze (widać etykietę mm co 0,5 mm). Przesuń element `Tekst` w pobliże linii — przyciągnie się. Sprawdź `Ctrl+;` (ukryj/pokaż) i usuwanie linii (upuszczenie na linijce lub „Usuń linie”).
   - Zwiń/rozwiń `Strukturę` u dołu prawej kolumny i przeciągnij belkę rozdzielającą nad nią (wysokość zapamiętuje się po odświeżeniu). Kliknij `＋ Nowy szablon` i przełącz `Przód | Tył`.
4. **Krok 2: Karty**:
   - Zapisz szablon i kliknij `2 Karty` w górnym pasku.
   - Dodaj 2–3 karty klikając lub przeciągając szablon z lewego paska.
   - Zmień liczbę kopii przyciskami `− / +` (odznaka `×N`), zmień `Tył karty` na pojedynczej karcie, przełącz `Przód | Tył | Obie` oraz `Podgląd | Tabela` (edytuj komórkę w tabeli i wróć do podglądu).
5. **Krok 3: Druk i linie cięcia**:
   - Kliknij `Do druku →`.
   - W prawym panelu rozwiń/sprawdź `Linie cięcia`: zmień grubość na `0,5 mm`, kliknij jasną próbkę `#cccccc` (podgląd przełącza tło na ciemne) i czerwoną `#c83e3b`, ustaw `Przerwa = 0` (linia ciągła) i sprawdź podgląd arkusza oraz pobranie PDF.
6. **Mausritter**:
   - Wróć na start, kliknij `Mausritter A4` → `Pusta kartka A4`.
   - Sprawdź etykietę `MAUSRITTER`, kroki `1 Karty na arkuszach → 2 Druk` i licznik `0 / 70 kafelków` pod arkuszem.
   - Przeciągnij `Broń` z lewego paska na dowolny wolny kafelek siatki i kliknij `Stan` (trafi na kolejne wolne miejsce); sprawdź, że licznik kafelków się aktualizuje.
7. **Zrzuty poglądowe**:
   - Obejrzyj wygenerowane zrzuty obu motywów w katalogu `docs/obrazy/ui2/`.

## 11. R10 – poprawki edytora szablonu po przeglądzie (27.11.2026)

Przegląd zrzutu edytora po nocy (`#/projekt/<id>/szablon/szablon`) pokazał, że nagłówek, dolna belka,
prawy panel i Struktura nie odpowiadają makiecie, a linijki nachodzą na siebie i na inne elementy.
Makieta `docs/makiety-ui2/Edytor.dc.html` została zaktualizowana i jest wzorem dla tego etapu.

### 11.1 Górny pasek edytora

Ma wyglądać dokładnie tak (4.1):
`← Projekty` · nazwa projektu · **1 Szablony → 2 Karty → 3 Druk** ··· ↶ ↷ · ⚙ · stan zapisu ·
**Przejdź do kart →**

- **Usunąć z paska:** „Karty” (logo/start), „Nowy projekt”, „Powrót” (to samo co `← Projekty`),
  „Edytor kart” (to krok 2), „Biblioteka” i „Biblioteki” (D8), osobne „Zapisz” + „Niezapisane zmiany”.
- **Stan zapisu jako jeden element:** gdy są niezapisane zmiany – przycisk `● Zapisz`
  (kropka `--riso-roz`, `Ctrl+S`); po zapisie – szary napis `✓ zapisano`.
- **„Układ ze zdjęcia”, „Eksport”, „Import”, „Duplikuj”** przenieść do menu **„Szablon ▾”** na pasku
  zakładek szablonów (obok „＋ Nowy szablon”): Duplikuj szablon, Eksport do pliku, Import z pliku…,
  Układ ze zdjęcia (AI)…, Zmień rozmiar karty….
- „Ustawienia” jako sama ikona zębatki (z dymkiem), bez strzałki menu.

### 11.2 Dolna belka (pasek stanu)

Duże ramki „Przyciąganie” i „Podkład ze wzoru” pod kartą oraz długi tekst pomocy **usunąć z obszaru
roboczego**. Obszar roboczy jest tylko dla karty i linijek.

Pasek stanu (44 px, IBM Plex Mono 11 px, kolor `--tekst-2`, separatory `·`) z delikatnymi,
klikalnymi napisami:

`63 × 88 mm · Swobodny · Przyciąganie: 0,5 mm ▾ · Podkład: brak ▾ · Linie: 2 ▾ · ? Skróty`
··· `− 180% + Dopasuj`

- Kliknięcie napisu otwiera **dymek nad belką** (biały, ramka 1,5 px, cień `4px 4px 0
--riso-niebieski`), zamykany kliknięciem obok lub `Esc`:
  - **Przyciąganie:** siatka w mm (0 = wyłączona), „Do krawędzi i środków innych pól i karty”,
    „Do linii pomocniczych”, podpowiedź o `Alt`;
  - **Podkład:** opis, „Wybierz obraz…”, przezroczystość, „Usuń”; po wczytaniu napis pokazuje nazwę
    pliku zamiast „brak”;
  - **Linie:** pokaż/ukryj (`Ctrl+;`), „Usuń wszystkie linie”, podpowiedź o przeciąganiu z linijki;
  - **? Skróty:** tabela skrótów (klik, Shift+klik, przeciąganie, uchwyty, strzałki 0,5/5 mm, Alt,
    Ctrl+Z/Y, Ctrl+S, Ctrl+;) – zastępuje dawny tekst pomocy; otwiera się też klawiszem `?`.
- Ikona „Przyciąganie” znika z prawego paska (jedno miejsce na tę funkcję).

### 11.3 Prawy panel i prawy pasek ikon

- Prawy pasek ikon (52 px): **Właściwości elementu, Karta, Style, Biblioteka** – cztery wyraźne ikony
  20 px w przyciskach 40 × 40, aktywna z czarnym tłem, dymki po lewej (4.2).
- Nagłówek panelu na wysokości paska zakładek (3.3): tytuł zakładki + podtytuł z typem i nazwą
  zaznaczonego elementu (np. „Właściwości · Tekst · nazwa”).
- Sekcje jak w makiecie: pogrubiony nagłówek i strzałka ▾/▸, **bez kolorowych pasków z lewej**,
  linie między sekcjami `--linia-2`. Pola: etykieta 11 px nad polem, pole z ramką 1–1,5 px.
- „Kopiuj styl / Wklej styl” i „Grupy stylów” należą do zakładki **Style**, nie do Właściwości.

### 11.4 Struktura

- Nagłówek: „▾ Struktura” (zwija) i **same ikony** z dymkami: ↑ Wyżej, ↓ Niżej, ⧉ Duplikuj, ✕ Usuń,
  **⋯ Więcej** (menu: Do kontenera powyżej, Wyjmij z kontenera, Opakuj w wiersz / kolumnę / warstwy).
- **Usunąć** z dołu Struktury przycisk „+ Dodaj” (dodawanie jest w lewym pasku i przez przeciąganie)
  oraz rzędy przycisków tekstowych.
- Wiersz drzewa: 26 px, znak typu w IBM Plex Mono + nazwa, wcięcie 14 px na poziom; zaznaczony
  wiersz – tło `--zaznaczenie`, biały tekst.

### 11.5 Linijki – nie mogą na siebie nachodzić

Obecnie linijki są częścią opakowania karty liczonego w procentach: lewa linijka wychodzi poza obszar
roboczy i zachodzi na elementy pod kartą, a cyfry nakładają się na kreski.

- Linijki są **przypięte do krawędzi obszaru roboczego** (jak w Photoshopie): górna pod paskiem
  zakładek na całą szerokość obszaru, lewa przy lewym pasku na całą wysokość obszaru, róg 22 × 22 px.
  Zero zawsze w lewym górnym rogu karty; linijki przesuwają się i skalują z przewijaniem
  i powiększeniem, ale **nigdy nie wychodzą poza obszar roboczy** i nie przykrywają innych elementów
  (`overflow: hidden` na linijce, linijka nie jest dzieckiem przewijanej sceny).
- Linijka ma 22 px: kreski przy krawędzi od strony karty (mm 4 px, 5 mm 8 px, cm 13 px),
  **cyfry w pozostałym pasie** (9 px, IBM Plex Mono), obok długiej kreski: na górnej z prawej strony
  kreski, na lewej pod kreską. Cyfra nie może przecinać kresek ani innej cyfry. Przy małym
  powiększeniu, gdy odstęp między cm < 18 px, pokazuj co drugą cyfrę.
- Pas zaznaczenia i linie pomocnicze liczone z tej samej skali co linijka (jedna funkcja mm ↔ px).

### 11.6 Testy R10

- Playwright: w nagłówku edytora nie ma przycisków „Powrót”, „Edytor kart”, „Biblioteka”,
  „Biblioteki”, „Nowy projekt”; menu „Szablon ▾” zawiera 5 pozycji.
- Playwright: pod kartą nie ma ramek przyciągania i podkładu; kliknięcie „Przyciąganie” w pasku stanu
  otwiera dymek, `Esc` go zamyka.
- Playwright: prostokąty (`getBoundingClientRect`) linijek nie przecinają paska stanu, lewego paska
  ani prawego panelu; prostokąty cyfr na każdej linijce nie przecinają się nawzajem – przy 100 %,
  przy „Dopasuj” i przy największym powiększeniu.
- Playwright: Struktura ma w nagłówku 5 przycisków ikon i nie ma przycisku „+ Dodaj”.
- Zrzuty edytora w obu motywach do `docs/obrazy/ui2/` po etapie.

### 11.7 Decyzje

- **D15** Przyciąganie, podkład, linie pomocnicze i pomoc są w pasku stanu jako dymki, nie w obszarze
  roboczym ani w prawym pasku.
- **D16** Linijki przypięte do krawędzi obszaru roboczego, nie do opakowania karty.

## 12. Zmiana po UI2

Od 27.11.2026 obowiązuje `docs/plan-S.md`: szablony są w osobnej bibliotece, projekt ma kroki
Karty → Druk. Zmienia to sekcje 4.1 (mapa kroków), 5.1 (przyciski tworzenia), 5.2 i 5.3 tego planu.

## 13. R11 – Mausritter w stylu UI2 (27.11.2026)

Przegląd ekranów Mausrittera po R8 pokazał, że ekran startowy, nagłówek, lewy pasek i prawy panel
mają jeszcze stary wygląd i stary układ przycisków. Wzór: `docs/makiety-ui2/Mausritter.dc.html`
(siatka na makiecie jest pionowa 7 × 10 tylko poglądowo, bo obowiązuje rzeczywisty układ aplikacji:
A4 poziomo, 10 × 7 kafelków po 25,75 mm). Etap robić **po zakończeniu planu S**, bo S5 zmienia
wspólny nagłówek i kroki.

### 13.1 Start

- Usunąć osobną stronę „Start › Karty do Mausrittera” z kafelkami „Pusta kartka” / „Zacznij od
  gotowego układu”.
- Kliknięcie „Mausritter A4” na stronie głównej tworzy projekt i otwiera ekran arkusza z oknem
  **„Od czego zaczynamy?”** (jak w makiecie): duży kafelek **„Pusty arkusz A4”** (opis: siatka
  10 × 7 kafelków) oraz „Gotowe arkusze”: Broń i pancerze, Wyposażenie, Stany, Wszystkie trzy.
  Pod spodem nota o grze (Isaac Williams, Losing Games). `Esc` i „×” zamykają okno z pustym arkuszem.

### 13.2 Nagłówek

Wspólny `NaglowekProjektu` (4.1): `← Projekty` · edytowalna nazwa · etykieta **MAUSRITTER** ·
**1 Karty na arkuszach → 2 Druk** · ↶ ↷ (te same ikony co w edytorze) · ⚙ · stan zapisu
(`● Zapisz` / `✓ zapisano`) · **Do druku →**.
Usunąć: „Karty” (logo), osobne „Zapisz” + „Niezapisane zmiany”/„Zapisano”, „← Powrót”,
„Drukuj karty ▶”, „Biblioteki”, „Ustawienia ▾”.

### 13.3 Lewy pasek „Dodaj kartę”

- Wspólny `PasekBoczny` (4.2) z nagłówkiem wyrównanym do paska nad arkuszem (3.3).
- **Sześć różnych ikon**, zamiast sześciu jednakowych ikon dokumentu: Broń (miecz), Zbroja
  (tarcza), Ekwipunek (torba), Zaklęcie (gwiazda), Stan (krzyżyk/plus), Pusta karta (prostokąt).
  Ikony takie jak w makiecie.
- Zwinięty: dymek po 0,5 s z nazwą i rozmiarami (np. „Zbroja · 1×2 ciężka · 2×1 lekka”).
  Rozwinięty: nazwa + rozmiary + podpowiedź „Przeciągnij na wolny kafelek albo kliknij”.

### 13.4 Środek

- Nad arkuszem **pasek zakładek arkuszy** zamiast tekstu „Strona 1 z 1”: „Arkusz 1”, „Arkusz 2”…,
  „＋ Arkusz” oraz licznik „N / 70 kafelków zajętych” po prawej.
- Obszar roboczy jak w edytorze (`--tlo-robocze` + siatka kropek), arkusz biały z cieniem.
- **Pasek stanu 44 px** na dole jak w edytorze: `A4 poziomo · 10 × 7 · ? Skróty` oraz
  `− 100% + Dopasuj`. Powiększenie przenieść z prawej góry na pasek stanu. Tekst „Ctrl + kółko
  myszy – przybliżanie” i skróty klawiszowe przenieść do dymka „? Skróty”.
- Usunąć czarny pływający pasek nad zaznaczoną kartą („Duplikuj / Rozmiar / Usuń”). Te akcje są
  w nagłówku prawego panelu.
- Pusta karta na arkuszu (bez nazwy) pokazuje szarą nazwę typu (np. „Przedmiot”, „Broń”), żeby
  dało się odróżnić puste karty.

### 13.5 Prawy panel

- Nagłówek na wysokości paska zakładek arkuszy (3.3): nazwa typu karty + przyciski **⧉ Duplikuj**,
  **✕ Usuń**. Bez osobnego „×”.
- Karta zaznaczona – sekcje jak w makiecie (bez kolorowych pasków z lewej, ramki 1,5 px):
  **Rozmiar w kafelkach** (przyciski z zarysem, niemieszczące się wyszarzone), Wariant (jeśli jest),
  Nazwa, pola typu (obrażenia / obrona / pojemność / usunięcie), **Kropki użycia** (− N +),
  **Obraz**: „Z biblioteki…” / „＋ Wgraj”, a skala, obrót, X, Y, dopasowanie i „Resetuj” w zwijanej
  podsekcji „Położenie obrazu ▸”.
- Nic nie zaznaczone: nagłówek „Arkusz”, pole **Tytuł arkusza** i jedna linijka podpowiedzi
  („Kliknij kartę, żeby ją edytować, albo przeciągnij nową z lewej”). Długi tekst pomocy przenieść
  do „? Skróty”.
- Pole „Przód dla wszystkich kart – wybierz szablon przodu” w projekcie Mausrittera usunąć (pakiet nie
  ma szablonów przodu). Jeśli spełnia inną rolę, przenieść je do sekcji „Arkusz” z jasną etykietą
  i opisać decyzję w 13.7.

### 13.6 Testy

- Playwright: „Mausritter A4” otwiera ekran arkusza z oknem „Od czego zaczynamy?”; „Pusty arkusz A4”
  zamyka okno; nie ma trasy ze starą stroną startową.
- Playwright: nagłówek nie zawiera „Powrót”, „Drukuj karty”, „Biblioteki”; jest „Do druku →”.
- Playwright: 6 przycisków lewego paska ma różne ikony (różne `d` ścieżek SVG).
- Playwright: zaznaczona karta nie pokazuje pływającego paska; w nagłówku panelu są Duplikuj i Usuń.
- Wzorce PNG arkuszy i PDF Mausrittera bez zmian.

### 13.7 Decyzje

- **D19** Mausritter korzysta z tych samych komponentów UI2 co reszta (nagłówek, pasek boczny, pasek
  stanu, panel z sekcjami). Start to okno na ekranie arkusza, a nie osobna strona.
