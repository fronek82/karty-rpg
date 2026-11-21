# Przykłady odbioru M5

Zrzuty ekranu z odbioru kamienia milowego **M5** pokazują kuratorowaną galerię neutralnych szablonów i rewersów online (`#/wlasne`) z rozwiniętym podglądem na żywo z silnika (awers + rewers) oraz formularzem importu z adresu URL — po polsku i po angielsku, w jasnym i ciemnym motywie:

- **Wklejanie tekstu z PDF (M5-1):** automatyczne usuwanie sztucznych złamań wiersza i sklejanie wyrazów podzielonych dywizem przy zachowaniu akapitów i list numerowanych.
- **Układ ze zdjęcia AI (M5-2):** rozpoznawanie struktury pól przez Claude API z lokalnym kluczem użytkownika i podglądem SVG przed otwarciem edytora.
- **Galeria szablonów online i import URL (M5-3):** 5 neutralnych paczek `.kartyrpg-szablon` na licencji MIT (w tym 3 z ozdobnym rewersem), podgląd awersu i rewersu, zapis do lokalnej biblioteki oraz praca bez sieci.
- **Niewidoczna warstwa tekstowa w PDF (M5-4):** opcjonalny przełącznik w Ustawieniach dodający warstwę tekstu `3 Tr` z pełną obsługą polskich znaków (`Ctrl+F` i kopiowanie) przy 0 pikseli różnicy w wyglądzie.
- **Instrukcja PL/EN (M5-5):** zaktualizowana statyczna strona `instrukcja/` o pełny zakres funkcji M2c–M5 wraz ze świeżymi zrzutami ekranu.

| Interfejs | Motyw jasny                     | Motyw ciemny                   |
| --------- | ------------------------------- | ------------------------------ |
| Polski    | [Galeria M5 (PL)](pl-light.png) | [Galeria M5 (PL)](pl-dark.png) |
| English   | [M5 Gallery (EN)](en-light.png) | [M5 Gallery (EN)](en-dark.png) |

Test Playwright (`testy/odbior-m5.spec.ts`) sprawdza w każdej z 4 konfiguracji (PL/EN × jasny/ciemny, przy zablokowanej sieci zewnętrznej): podgląd awersu i rewersu w galerii, użycie szablonu, czyszczenie tekstu wklejanego z PDF, eksport PDF z niewidoczną warstwą tekstową odczytywaną przez `pdfjs-dist` oraz rozpoznawanie układu AI z zapisanej odpowiedzi.
[Plan M5](../../plan-M5.md#ręczne-sprawdzenia-m5) zawiera listę ręcznego odbioru użytkownika.
