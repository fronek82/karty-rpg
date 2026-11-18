# Galeria interfejsu

Zrzuty przedstawiają okno 1440 × 900 w Chromium z przykładowymi danymi aplikacji.

| Widok                 | PL · jasny                           | PL · ciemny                         | EN · jasny                           | EN · ciemny                         |
| --------------------- | ------------------------------------ | ----------------------------------- | ------------------------------------ | ----------------------------------- |
| Start                 | [PNG](pl/light/start.png)            | [PNG](pl/dark/start.png)            | [PNG](en/light/start.png)            | [PNG](en/dark/start.png)            |
| Mausritter            | [PNG](pl/light/mausritter.png)       | [PNG](pl/dark/mausritter.png)       | [PNG](en/light/mausritter.png)       | [PNG](en/dark/mausritter.png)       |
| Własne karty          | [PNG](pl/light/wlasne.png)           | [PNG](pl/dark/wlasne.png)           | [PNG](en/light/wlasne.png)           | [PNG](en/dark/wlasne.png)           |
| Kreator szablonu      | [PNG](pl/light/kreator.png)          | [PNG](pl/dark/kreator.png)          | [PNG](en/light/kreator.png)          | [PNG](en/dark/kreator.png)          |
| Edytor szablonu       | [PNG](pl/light/edytor-szablonu.png)  | [PNG](pl/dark/edytor-szablonu.png)  | [PNG](en/light/edytor-szablonu.png)  | [PNG](en/dark/edytor-szablonu.png)  |
| Edytor kartki         | [PNG](pl/light/karta-zaznaczona.png) | [PNG](pl/dark/karta-zaznaczona.png) | [PNG](en/light/karta-zaznaczona.png) | [PNG](en/dark/karta-zaznaczona.png) |
| Menu typów kart       | [PNG](pl/light/edytor-kartki.png)    | [PNG](pl/dark/edytor-kartki.png)    | [PNG](en/light/edytor-kartki.png)    | [PNG](en/dark/edytor-kartki.png)    |
| Ustawienia kartki     | [PNG](pl/light/ustawienia.png)       | [PNG](pl/dark/ustawienia.png)       | [PNG](en/light/ustawienia.png)       | [PNG](en/dark/ustawienia.png)       |
| Biblioteka ozdobników | [PNG](pl/light/biblioteka.png)       | [PNG](pl/dark/biblioteka.png)       | [PNG](en/light/biblioteka.png)       | [PNG](en/dark/biblioteka.png)       |
| Instrukcja            | [PNG](pl/light/instrukcja.png)       | [PNG](pl/dark/instrukcja.png)       | [PNG](en/light/instrukcja.png)       | [PNG](en/dark/instrukcja.png)       |

Z katalogu głównego repozytorium uruchom generator po zainstalowaniu Chromium dla Playwright.

```sh
ZRZUTY_UI=1 npm run e2e -- testy/zrzuty-instrukcji.spec.ts --workers=2
```
