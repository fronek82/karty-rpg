# Licencje zasobów zewnętrznych

Kod aplikacji jest na licencji MIT (plik `LICENSE`). Ten plik dotyczy wyłącznie zasobów
zewnętrznych i nie są one objęte licencją MIT.

Każdy zasób zewnętrzny dodany do repozytorium (czcionka, grafika, wzór karty) musi mieć tu wpis:
źródło, autor, licencja i – jeśli licencja tego wymaga – treść atrybucji pokazywanej w aplikacji.
Pakiety szablonów mają dodatkowo własny plik `LICENCJE.md` w swoim katalogu.

| Zasób                                                                                         | Ścieżka                                     | Źródło       | Autor                                                            | Licencja                                                 |
| --------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------ | ---------------------------------------------------------------- | -------------------------------------------------------- |
| EB Garamond (Regular, Bold, Italic, Bold Italic)                                              | `public/czcionki/EBGaramond-*.ttf`          | Google Fonts | The EB Garamond Project Authors (Georg Duffner, Octavio Pardo)   | SIL OFL 1.1 – `public/czcionki/OFL-EBGaramond.txt`       |
| Grenze Gotisch (Regular, Bold)                                                                | `public/czcionki/GrenzeGotisch-*.ttf`       | Google Fonts | The Grenze Gotisch Project Authors (Omnibus-Type)                | SIL OFL 1.1 – `public/czcionki/OFL-GrenzeGotisch.txt`    |
| Cinzel Decorative (Bold) – czcionka tytułu ekranu startowego                                  | `public/czcionki/CinzelDecorative-Bold.ttf` | Google Fonts | Natanael Gama (Copyright © 2012, Reserved Font Name „Cinzel”)    | SIL OFL 1.1 – `public/czcionki/OFL-CinzelDecorative.txt` |
| Cinzel Decorative Bold (kopia), Uncial Antiqua, Metamorphous (tylko makiety, nie w aplikacji) | `docs/makiety-ui/fonty/*.ttf`               | Google Fonts | Natanael Gama; Brian J. Bonislawsky (Astigmatic); Sorkin Type Co | SIL OFL 1.1 – `docs/makiety-ui/fonty/LICENCJE.md`        |

### Katalog Google Fonts (pobierane na żądanie użytkownika, nie dołączane do repozytorium)

Katalog w `src/dane/googleFonts.ts` udostępnia wybrane rodziny z repozytorium [`google/fonts`](https://github.com/google/fonts) (wyłącznie statyczne pliki TTF z potwierdzonym zestawem `latin-ext` i licencją SIL OFL 1.1). Pliki są pobierane dopiero po wyborze użytkownika i zapisywane lokalnie w projekcie.

| Rodzina           | Katalog w `google/fonts` | Autor                                   | Licencja    |
| ----------------- | ------------------------ | --------------------------------------- | ----------- |
| Almendra          | `ofl/almendra`           | Ana Sanfelippo                          | SIL OFL 1.1 |
| Almendra Display  | `ofl/almendradisplay`    | Ana Sanfelippo                          | SIL OFL 1.1 |
| MedievalSharp     | `ofl/medievalsharp`      | Wojciech Kalinowski                     | SIL OFL 1.1 |
| Metamorphous      | `ofl/metamorphous`       | Sorkin Type Co (James Grieshaber)       | SIL OFL 1.1 |
| Pirata One        | `ofl/pirataone`          | Rodrigo Fuenzalida, Nicolas Massi       | SIL OFL 1.1 |
| Germania One      | `ofl/germaniaone`        | John Vargas Beltrán                     | SIL OFL 1.1 |
| Yatra One         | `ofl/yatraone`           | Catherine Leigh Schmidt                 | SIL OFL 1.1 |
| Rye               | `ofl/rye`                | Nicole Fally                            | SIL OFL 1.1 |
| Sancreek          | `ofl/sancreek`           | Vernon Adams                            | SIL OFL 1.1 |
| New Rocker        | `ofl/newrocker`          | Impallari Type                          | SIL OFL 1.1 |
| Metal Mania       | `ofl/metalmania`         | Open Window                             | SIL OFL 1.1 |
| Creepster         | `ofl/creepster`          | Sideshow                                | SIL OFL 1.1 |
| Abril Fatface     | `ofl/abrilfatface`       | TypeTogether                            | SIL OFL 1.1 |
| Yeseva One        | `ofl/yesevaone`          | Jovanny Lemonad                         | SIL OFL 1.1 |
| Righteous         | `ofl/righteous`          | Astigmatic                              | SIL OFL 1.1 |
| Audiowide         | `ofl/audiowide`          | Astigmatic                              | SIL OFL 1.1 |
| Silkscreen        | `ofl/silkscreen`         | Jason Kottke                            | SIL OFL 1.1 |
| Press Start 2P    | `ofl/pressstart2p`       | CodeMan38                               | SIL OFL 1.1 |
| Marcellus         | `ofl/marcellus`          | Astigmatic                              | SIL OFL 1.1 |
| Marcellus SC      | `ofl/marcellussc`        | Astigmatic                              | SIL OFL 1.1 |
| Alegreya SC       | `ofl/alegreyasc`         | Juan Pablo del Peral, HT Fonts          | SIL OFL 1.1 |
| Cormorant SC      | `ofl/cormorantsc`        | Christian Thalmann                      | SIL OFL 1.1 |
| Caudex            | `ofl/caudex`             | Nidud                                   | SIL OFL 1.1 |
| Cardo             | `ofl/cardo`              | David Perry                             | SIL OFL 1.1 |
| Old Standard TT   | `ofl/oldstandardtt`      | Alexey Kryukov                          | SIL OFL 1.1 |
| Crimson Text      | `ofl/crimsontext`        | Sebastian Kosch                         | SIL OFL 1.1 |
| Spectral          | `ofl/spectral`           | Production Type                         | SIL OFL 1.1 |
| Gentium Book Plus | `ofl/gentiumbookplus`    | SIL International                       | SIL OFL 1.1 |
| Gentium Plus      | `ofl/gentiumplus`        | SIL International                       | SIL OFL 1.1 |
| PT Serif          | `ofl/ptserif`            | ParaType                                | SIL OFL 1.1 |
| IBM Plex Serif    | `ofl/ibmplexserif`       | Mike Abbink, Bold Monday                | SIL OFL 1.1 |
| Fira Sans         | `ofl/firasans`           | Carrois Apostrophe                      | SIL OFL 1.1 |
| Lato              | `ofl/lato`               | Łukasz Dziedzic                         | SIL OFL 1.1 |
| Alegreya Sans     | `ofl/alegreyasans`       | Juan Pablo del Peral, HT Fonts          | SIL OFL 1.1 |
| Philosopher       | `ofl/philosopher`        | Jovanny Lemonad                         | SIL OFL 1.1 |
| Barlow            | `ofl/barlow`             | Jeremy Tribby                           | SIL OFL 1.1 |
| Barlow Condensed  | `ofl/barlowcondensed`    | Jeremy Tribby                           | SIL OFL 1.1 |
| PT Sans           | `ofl/ptsans`             | ParaType                                | SIL OFL 1.1 |
| Eagle Lake        | `ofl/eaglelake`          | Astigmatic                              | SIL OFL 1.1 |
| Fondamento        | `ofl/fondamento`         | Astigmatic                              | SIL OFL 1.1 |
| Quintessential    | `ofl/quintessential`     | Astigmatic                              | SIL OFL 1.1 |
| Berkshire Swash   | `ofl/berkshireswash`     | Astigmatic                              | SIL OFL 1.1 |
| Patrick Hand      | `ofl/patrickhand`        | Patrick Wagesreiter                     | SIL OFL 1.1 |
| Kalam             | `ofl/kalam`              | Indian Type Foundry                     | SIL OFL 1.1 |
| Amatic SC         | `ofl/amaticsc`           | Vernon Adams, Ben Nathan, Thomas Jockin | SIL OFL 1.1 |
| Courgette         | `ofl/courgette`          | Karolina Lach                           | SIL OFL 1.1 |
| Great Vibes       | `ofl/greatvibes`         | Robert Leuschke                         | SIL OFL 1.1 |
| Marck Script      | `ofl/marckscript`        | Denis Masharov                          | SIL OFL 1.1 |
| IBM Plex Mono     | `ofl/ibmplexmono`        | Mike Abbink, Bold Monday                | SIL OFL 1.1 |
| Space Mono        | `ofl/spacemono`          | Colophon Foundry                        | SIL OFL 1.1 |
| Courier Prime     | `ofl/courierprime`       | Alan Dague-Greene                       | SIL OFL 1.1 |
| VT323             | `ofl/vt323`              | Peter Hull                              | SIL OFL 1.1 |

Pakiety szablonów: `src/pakiety/mausritter/LICENCJE.md`.

Własne rysunki projektu (licencja jak kod, MIT), generowane skryptami z `narzedzia/`:

| Zasób                                                                                                      | Ścieżka                                                    | Skrypt                                                                                                             |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Obrazek zastępczy pakietu                                                                                  | `src/pakiety/mausritter/obrazy/zastepczy.png`              | `narzedzia/obraz-zastepczy.py`                                                                                     |
| Obrazek testowy (litera „F”)                                                                               | `testy/zasoby/litera-f.png`                                | `narzedzia/obraz-testowy.py`                                                                                       |
| Narożniki ozdobne (6 wbudowanych: kątownik, liść, okucie, gwiazda, węzeł, zawijas)                         | `src/ozdobniki/katalog.ts` (ścieżki wektorowe w kodzie)    | rysowane ręcznie jako kontury, bez zasobów zewnętrznych                                                            |
| Motywy powtarzalne (6 wbudowanych: pnącze, przeplot, łuski, runy, łańcuch, gwiazdki, z kostkami narożnymi) | `src/ozdobniki/motywy.ts` (ścieżki wektorowe w kodzie)     | rysowane ręcznie jako kontury (runy to ogólne znaki runopodobne, bez wzorów z pisma ani z gier), licencja projektu |
| Zakończenia (5: grot, zawijas, liść, kropka, kolec) i środki (4: romb, gwiazda, liść, kropka) separatorów  | `src/ozdobniki/separatory.ts` (ścieżki wektorowe w kodzie) | rysowane ręcznie jako kontury, ogólne, bez zasobów zewnętrznych, licencja projektu                                 |
| Rysunek testowy SVG (gwiazdka z otworem) do testów importu własnego SVG                                    | `testy/zasoby/gwiazdka.svg`                                | narysowany ręcznie na potrzeby testów, bez zasobów zewnętrznych, licencja projektu (MIT)                           |
| Obrazek testowy PNG ramki 9-slice (120×120 px) do testów ramek z obrazu                                    | `testy/zasoby/ramka-testowa.png`                           | `narzedzia/ramka-testowa.mjs` – generowany deterministycznie, własny rysunek projektu, licencja projektu (MIT)     |
| Obrazek testowy PNG podkładu ze wzoru (252×352 px) do testów podkładu i trybu swobodnego                   | `testy/zasoby/podklad-testowy.png`                         | `narzedzia/podklad-testowy.mjs` – generowany deterministycznie, własny rysunek projektu, licencja projektu (MIT)   |
| Galeria neutralnych szablonów i rewersów online (5 paczek `.kartyrpg-szablon` + `manifest.json`)           | `public/galeria/*`                                         | `narzedzia/generuj-galerie.mjs` – generowane deterministycznie, wyłącznie wbudowane ozdobniki i EB Garamond, MIT   |

## Zależności w aplikacji (środowisko uruchomieniowe)

| Biblioteka          | Użycie                                                                                                  | Źródło                                                | Licencja   |
| ------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------- |
| `svgpath`           | import własnych SVG (M2b-6): łuki `A` → krzywe Béziera, skróty H/V/S/T, ścieżki względne, transformacje | <https://github.com/fontello/svgpath>                 | MIT        |
| `xlsx` (SheetJS CE) | Odczyt lokalnego pliku XLSX                                                                             | <https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz> | Apache-2.0 |

Pozostałe zależności z `package.json` (React, Dexie, pdf-lib, fontkit, fflate, zod) – licencje wg pakietów.

## Narzędzia testowe (nie trafiają do aplikacji)

| Narzędzie                 | Użycie                                                        | Licencja   |
| ------------------------- | ------------------------------------------------------------- | ---------- |
| pdf.js (`pdfjs-dist`)     | rasteryzacja PDF w testach (PDF↔SVG, nakładka na referencję)  | Apache-2.0 |
| Playwright, Vitest i inne | testy i budowanie (zależności deweloperskie z `package.json`) | wg pakietu |

## Materiały, których nie publikujemy

- Arkusze referencyjne Mausrittera (polskie wydanie, sklep Stinger-Prest) służą wyłącznie do
  pomiaru układu. Ich grafiki i teksty **nie są** używane w aplikacji ani w pakietach.
- Czcionki Herb i Minion Pro (oryginalne czcionki Mausrittera) są komercyjne. Trzymamy je tylko
  lokalnie w `zasoby-prywatne/` na potrzeby testu nakładania. W aplikacji domyślnie używamy
  zamienników na licencji OFL: EB Garamond i Grenze Gotisch.
