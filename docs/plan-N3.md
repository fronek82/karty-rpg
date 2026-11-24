# Etap N3 — edytor i UI

## Zakres

1. **Eksport i import pliku szablonu w edytorze** (wspólnym dla awersu i rewersu, `EdytorDrzewa`):
   przyciski „⤓ Eksport” / „⤒ Import” (nazwy dostępne: „Eksportuj szablon” / „Importuj szablon”) na
   pasku. Format z N1 (`.kartyrpg-szablon`, `szablon.json`); eksport z Edytora szablonu zawiera
   przypisany rewers, z Edytora rewersu – sam rewers. Import przyjmuje każdy plik szablonu (awers,
   awers z rewersem, sam rewers, dawny `.kartyrpg-rewers`): w Edytorze szablonu powstaje nowy awers
   (`importujSzablon` + `dodajSzablonZKartka`), w Edytorze rewersu – nowy rewers (`importujRewers` +
   `dodajRewersZPaczki`). Pod paskiem pojawia się link do dodanego szablonu.
2. **Przeciąganie w układzie swobodnym na gładziku Maca** – element nie wraca do pozycji wyjściowej
   (`useGestSwobodny.ts`, przyczyna niżej).
3. **Paski przycisków** Edytora szablonu/rewersu i Edytora kart: grupy (`.grupa-paska`): nazwa
   i zapis | historia ↶ ↷ | plik i narzędzia (tylko Edytor szablonu) | nawigacja (Powrót + akcja
   główna) | Ustawienia. Wysokość, promień i odstępy z tokenów `--pasek-*` w `tokeny.css`; pole
   nazwy ma wysokość przycisków; ↶ ↷ jako przyciski ikonowe z podpowiedzią w obu edytorach.
   Zrzuty: `docs/obrazy/n3-edytor-szablonu-{przed,po}.png`, `docs/obrazy/n3-edytor-kart-{przed,po}.png`.
4. **Zapis ręczny w Edytorze szablonu i rewersu** jak w Edytorze kart: przycisk „Zapisz”,
   Ctrl+S / Cmd+S, okno „Niezapisane zmiany” przy wyjściu z projektu. Wspólny kod:
   `src/ui/zapisReczny.tsx` (`PrzyciskZapisu`, `useSkrotZapisu`, `useStrazWyjscia`).

## Przyczyna błędu z pkt 2

`useGestSwobodny` traktował każde zakończenie gestu inne niż `pointerup` jak anulowanie (powrót do
pozycji wyjściowej, bez zapisu):

- `pointercancel` – na gładziku Maca przeglądarka przerywa gest m.in. przy Force Click (podgląd
  słownika w Safari), geście systemowym albo gdy ruszy natywne przeciąganie/zaznaczanie;
- `lostpointercapture` – w Safari potrafi przyjść przed `pointerup`;
- `pointermove` z `buttons === 0` dla myszy – Safari na gładziku (stuknij-i-przeciągnij, przeciąganie
  trzema palcami) podaje 0 w trakcie przeciągania.

Do tego `pointerdown` nie blokował domyślnej akcji, więc zaznaczanie tekstu SVG i natywne
przeciąganie obrazów kończyły się zdarzeniem `pointercancel`. `setPointerCapture` i
`touch-action: none` były ustawione; próg kliknięcia (3 px) i render ze starym stanem (zmiany
tymczasowe i zapis w jednej partii Reacta, zaległa klatka liczona przed zapisem) nie były przyczyną.

Poprawka: przerwanie gestu przez przeglądarkę kończy go z zapisem ostatnio pokazanego położenia
(współrzędne zdarzenia przerwania są pomijane), `buttons` nie przerywa ruchu, zgubione `pointerup`
domyka nowy `pointerdown` tego samego wskaźnika, `pointerdown` rozpoczynający gest wywołuje
`preventDefault()`, karta blokuje Force Click (`webkitmouseforcewillbegin`) i ma `user-select: none`.
Cofnięcie gestu – tylko Escape. Testy: `useGestSwobodny.test.tsx` (zdarzenia),
`testy/swobodny-mysz.spec.ts` (przerwanie w przeglądarce; na starym kodzie test nie przechodzi).

## Decyzje

- N3-1: Import w edytorze dodaje szablon/rewers jako **nowy** (bez nadpisywania edytowanego)
  i pokazuje link do niego – jak „Duplikuj”. Nadpisanie bieżącego szablonu byłoby nieodwracalne
  dla zasobów i przypisań rewersu.
- N3-2: Plik awersu wczytany jako rewers wnosi tylko zasoby, czcionki, role i ozdobniki użyte przez
  powstały rewers (przycięcie z N1-9, `przytnijDoStrony` w `archiwum.ts`). Plik rewersu wczytany
  jako awers nie ma czego przycinać.
- N3-3: Zapis ręczny obejmuje Edytor kart, szablonu i rewersu (ta sama instancja `useProjekt`, więc
  przejścia między nimi zachowują niezapisane zmiany w pamięci). Biblioteka ozdobników projektu
  i kreator nowego szablonu zostają przy autozapisie. Okno przy wyjściu pojawia się dla
  linków poza projekt (logo, „Powrót” do listy) i – od poprawki po N11 – dla „Wstecz” / „Dalej”
  przeglądarki: straż trasy (`ustawStrazTrasy` w `ui/useTrasa.ts`) działa przed zmianą widoku,
  przywraca adres edytora jako nowy wpis historii (`pushState`) i pokazuje to samo okno. Wpis
  „Dalej” (strona, do której prowadził „Wstecz”) przepada, ale okno pamięta cel przejścia. Straż jest
  jedna (ostatnio ustawiona) – jednocześnie działa tylko jeden edytor projektu.
- N3-4: Edytor rewersu zapisuje rewers w bibliotece globalnej po zapisie projektu; przy wyjściu
  z edytora – tylko gdy nie ma niezapisanych zmian.
- N3-5: Przy 1440 px pasek Edytora szablonu mieści się w jednym rzędzie (także przy „Niezapisane
  zmiany”) dzięki krótkim etykietom: „⤓ Eksport”, „⤒ Import”, „⧉ Duplikuj”, „Biblioteka”. Pełne
  nazwy („Eksportuj szablon”, „Importuj szablon”, „Duplikuj szablon”, „Biblioteka ozdobników”) są
  nazwą dostępną i podpowiedzią (widoczny tekst zawiera się w nazwie – WCAG 2.5.3). Pole nazwy
  w Edytorze szablonu ma 8 rem (pełna nazwa w podpowiedzi).
- N3-6: Przerwanie przeciągania przez przeglądarkę (`pointercancel`, utrata przechwytu) zapisuje
  ostatnie położenie zamiast je cofać – dotyczy też uchwytów rozmiaru.
- N3-7: Safari i Chrome na macOS z gładzikiem nie były dostępne w środowisku pracy (Linux,
  Chromium). Poprawka opiera się na obsłudze zdarzeń z testami (jsdom i Chromium z zasymulowanym
  przerwaniem); do sprawdzenia ręcznie na Macu.
- N3-8: Zrzuty instrukcji (`public/instrukcja-zrzuty/`) nie zostały odświeżone – pasek wygląda
  nieco inaczej niż na zrzucie „Edytor szablonu”; do odświeżenia przy najbliższym etapie ze zrzutami.
- N3-9: Straż wyjścia (jak w Edytorze kart przed N3) obsługuje kliknięcia linków paska; przycisk
  „Wstecz” przeglądarki i ręczna zmiana adresu poza projekt nie pytają o zapis (zamknięcie karty –
  ostrzeżenie przeglądarki). Do rozważenia w kolejnym etapie (blokada w `useTrasa`).
- N3-10: Przejście z Edytora szablonu/rewersu do biblioteki ozdobników projektu (autozapis) zapisuje
  niezapisane zmiany – biblioteka nie ma przycisku „Zapisz”, a jej zmiany muszą trafić do bazy.
  Rewers zapisany w ten sposób trafi do biblioteki globalnej przy następnym zapisie w jego edytorze.
- N3-11: Zgubione `pointerup` (nowy `pointerdown` tego samego wskaźnika w trakcie gestu) zapisuje
  poprzedni gest, a nowy nie startuje – następny klik działa już na zapisanym szablonie.
