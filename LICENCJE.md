# Licencje zasobów zewnętrznych

Kod aplikacji jest na licencji MIT (plik `LICENSE`). Ten plik dotyczy wyłącznie zasobów
zewnętrznych i nie są one objęte licencją MIT.

Każdy zasób zewnętrzny dodany do repozytorium (czcionka, grafika, wzór karty) musi mieć tu wpis:
źródło, autor, licencja i – jeśli licencja tego wymaga – treść atrybucji pokazywanej w aplikacji.
Pakiety szablonów mają dodatkowo własny plik `LICENCJE.md` w swoim katalogu.

| Zasób                                            | Ścieżka                               | Źródło       | Autor                                                          | Licencja                                              |
| ------------------------------------------------ | ------------------------------------- | ------------ | -------------------------------------------------------------- | ----------------------------------------------------- |
| EB Garamond (Regular, Bold, Italic, Bold Italic) | `public/czcionki/EBGaramond-*.ttf`    | Google Fonts | The EB Garamond Project Authors (Georg Duffner, Octavio Pardo) | SIL OFL 1.1 – `public/czcionki/OFL-EBGaramond.txt`    |
| Grenze Gotisch (Regular, Bold)                   | `public/czcionki/GrenzeGotisch-*.ttf` | Google Fonts | The Grenze Gotisch Project Authors (Omnibus-Type)              | SIL OFL 1.1 – `public/czcionki/OFL-GrenzeGotisch.txt` |

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

## Zależności w aplikacji (środowisko uruchomieniowe)

| Biblioteka | Użycie                                                                                                  | Źródło                                | Licencja |
| ---------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------- |
| `svgpath`  | import własnych SVG (M2b-6): łuki `A` → krzywe Béziera, skróty H/V/S/T, ścieżki względne, transformacje | <https://github.com/fontello/svgpath> | MIT      |

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
