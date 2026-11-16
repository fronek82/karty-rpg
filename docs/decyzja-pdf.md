# E1 – prototyp PDF i czcionek: wyniki i rekomendacja

Data: 2026-11-16. Etap E1 planu M1 (`docs/plan-M1.md`).

## Pytanie

Jak zamieniać tekst karty na PDF tak, żeby:

- obsłużyć polskie znaki,
- obsłużyć czcionki TTF **i** OTF/CFF (oryginały Mausrittera, Herb i Minion Pro, to OTF/CFF),
- uzyskać PDF wyglądający **dokładnie** jak podgląd SVG (SPEC, sekcja 1: „to, co widać, jest tym, co się drukuje”)?

## Test

Ten sam wiersz `Zażółć gęślą jaźń ŻÓŁW Ś k6/k8 — fi fl ffi` w czcionkach EB Garamond (TTF, regular
i italic), Grenze Gotisch Bold (TTF) oraz Source Serif 4 (OTF/CFF, OFL – zastępczo zamiast
Miniona). PDF otwierany przez Poppler (`pdftoppm`, `pdffonts`).

| Wariant                                                                                                        | TTF, polskie znaki                                            | OTF/CFF                                   | Ligatury (fi, fl, ffi)       | Uwagi                                                           |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------- | ---------------------------- | --------------------------------------------------------------- |
| **A.** pdf-lib + @pdf-lib/fontkit, tekst z podzbiorem czcionki                                                 | ❌ EB Garamond: znikają litery z akcentami i większość tekstu | ❌ czcionka uszkodzona, nie wyświetla się | –                            | błąd podzbioru w nieutrzymywanym forku fontkit (2021)           |
| **B.** pdf-lib + @pdf-lib/fontkit, tekst, pełna czcionka                                                       | ✅                                                            | ✅ (ostrzeżenie Poppler o typie czcionki) | ❌ złe odstępy po ligaturach | pełne pliki czcionek w PDF (~0,4 MB każda)                      |
| **C.** jsPDF 3                                                                                                 | ✅                                                            | ❌ krzaki                                 | brak ligatur                 | tylko TTF; dokłada 14 nieużywanych czcionek standardowych       |
| **D.** **Tekst jako krzywe**: fontkit 2 kształtuje tekst i daje kontury glifów, pdf-lib rysuje je jako ścieżki | ✅                                                            | ✅                                        | ✅                           | czcionka nie jest potrzebna w PDF; ten sam kontur trafia do SVG |

Obrazy: [A](obrazy/e1-pdflib-podzbior.png), [B](obrazy/e1-pdflib-pelna.png),
[C](obrazy/e1-jspdf.png), [D](obrazy/e1-krzywe.png). Znak ★ nie istnieje w żadnej z tych
czcionek, więc ikony i tak rysujemy jako własne ścieżki SVG (zgodnie z planem).

## Rekomendacja: wariant D – tekst jako krzywe

1. **Silnik** kształtuje tekst biblioteką **fontkit 2** (utrzymywana; pełne OpenType: ligatury,
   kerning, glify złożone; czyta TTF, OTF, WOFF i WOFF2). Wynikiem są glify z pozycjami w mm.
2. **SVG** (podgląd): każdy użyty glif raz w `<defs>` jako `<path>`, w tekście `<use>` z pozycją.
   Podgląd nie zależy od czcionek przeglądarki – jest identyczny z PDF.
3. **PDF**: te same kontury rysowane przez pdf-lib; każdy glif zapisany raz (obiekt XObject)
   i wielokrotnie wstawiany, żeby PDF był mały.

Zalety:

- jedno źródło kształtu tekstu dla podglądu, PDF i testów wizualnych – zero rozjazdów,
- działa z każdą czcionką, którą wgra użytkownik, także OTF/CFF i WOFF2 (bez konwersji,
  o której mówi SPEC, sekcja 8),
- brak błędów osadzania czcionek w różnych przeglądarkach PDF i drukarkach.

Koszty:

- **tekstu w PDF nie da się zaznaczyć ani wyszukać** (dla kart do wycięcia to zwykle bez znaczenia),
- na ekranie przy bardzo małym powiększeniu tekst bywa minimalnie mniej ostry (brak hintingu);
  w druku różnicy nie ma,
- formalnie odstępstwo od SPEC, sekcja 8 („czcionki osadzane w PDF”): w PDF są kształty liter,
  a nie pliki czcionek. Z punktu widzenia licencji to zwykle korzystniejsze (nie rozpowszechniamy
  pliku czcionki).

Możliwe rozszerzenie później (M4, tryb „Drukarnia”): niewidoczna warstwa tekstu w PDF, żeby dało się
go wyszukać – bez wpływu na wygląd.

## Wpływ na stos

- `fontkit` 2.x zastępuje `opentype.js` z planu (pomiar i kształtowanie tekstu).
- `pdf-lib` zostaje (rysowanie). `@pdf-lib/fontkit` nie będzie potrzebny w wariancie D.
- jsPDF i svg2pdf.js odpadają.

## Status

**Przyjęte** przez użytkownika 2026-11-16; SPEC (sekcje 1 i 8) zaktualizowany. Wymaganie
dodatkowe: każdy glif zapisany w PDF raz (XObject) i używany ponownie oraz test rozmiaru pliku
dla arkusza z dużą ilością tekstu. Test porównania PDF↔SVG powstaje w E2 razem ze sceną.
