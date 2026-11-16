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

## Materiały, których nie publikujemy

- Arkusze referencyjne Mausrittera (polskie wydanie, sklep Stinger-Prest) służą wyłącznie do
  pomiaru układu. Ich grafiki i teksty **nie są** używane w aplikacji ani w pakietach.
- Czcionki Herb i Minion Pro (oryginalne czcionki Mausrittera) są komercyjne. Trzymamy je tylko
  lokalnie w `zasoby-prywatne/` na potrzeby testu nakładania. W aplikacji domyślnie używamy
  zamienników na licencji OFL: EB Garamond i Grenze Gotisch.
