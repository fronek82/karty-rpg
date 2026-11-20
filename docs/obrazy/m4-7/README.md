# Przykłady odbioru M4

Neutralny arkusz **Atlas kartograficzny** / **Cartographic Atlas** łączy wszystkie możliwości kamienia milowego M4 w jednym projekcie:

- **Rewersy warstwowe**: rewers kompasu (granatowe tło z teksturą o kryciu i zabarwieniu, podwójna ramka, dwa napisy po łuku z polskimi znakami, obrócona gwiazda z kryciem) oraz rewers pieczęci (terakotowe tło, napis po łuku, obrócony liść).
- **Przypisania i dziedziczenie**: karta z nakładem 2× dziedziczy domyślny rewers kompasu z talii, druga karta nadpisuje rewers na pieczęć, a trzecia karta ma jawne ustawienie „Bez rewersu” (puste pole lustrzane na tyle).
- **Druk dwustronny i tryb drukarni**: para stron przód / lustrzany tył dla długiej krawędzi odwracania, spad 3 mm (tło sięga brutto, treść i ramka zostają w netto), znaczniki cięcia na arkuszu A4 oraz baner ostrzeżenia projektu dla testowej tekstury o rozdzielczości poniżej 300 dpi.
- **Katalog Google Fonts offline**: lokalnie zapisane warianty kroju (`zrodlo: 'google'`) z polskimi znakami działające bez sieci.

| Interfejs | Motyw jasny                          | Motyw ciemny                        |
| --------- | ------------------------------------ | ----------------------------------- |
| Polski    | [Atlas kartograficzny](pl-light.png) | [Atlas kartograficzny](pl-dark.png) |
| English   | [Cartographic Atlas](en-light.png)   | [Cartographic Atlas](en-dark.png)   |

Test Playwright (`testy/odbior-m4.spec.ts`) odtwarza arkusz z zapisanej paczki projektu przy zablokowanym dostępie do sieci zewnętrznej oraz weryfikuje lustrzane położenie rewersu, ostrzeżenie DPI i dwustronny PDF A4 (2 strony) w każdej konfiguracji.
[Plan M4](../../plan-M4.md#ręczne-sprawdzenia-m4) zawiera pełną listę fizycznego odbioru na drukarce.
