import { t } from '../../i18n';
import type { RodzajNowego } from '../../dane/szablon';

/** Rodzaje elementów w menu „+ Dodaj” edytora szablonu awersu (Swobodny pierwszy – decyzja D7). */
export const RODZAJE: RodzajNowego[] = [
  'swobodny',
  'wiersz',
  'kolumna',
  'warstwy',
  'tekst',
  'etykieta-wartosc',
  'wartosc',
  'wpis',
  'znaczniki',
  'tabela',
  'obraz',
  'ikona',
  'separator',
  'separator-zakonczenia',
  'separator-motyw',
];

/** Rodzaje w menu „+ Dodaj” edytora rewersu: bez pól z danymi kart (rewers jest statyczny). */
export const RODZAJE_REWERSU: RodzajNowego[] = [
  'swobodny',
  'wiersz',
  'kolumna',
  'warstwy',
  'tekst',
  'wartosc',
  'obraz',
  'ikona',
  'separator',
  'separator-zakonczenia',
  'separator-motyw',
];

/** Ścieżki SVG ikon kreskowych (viewBox 0 0 24 24) dla paska „Dodaj element” (wg Edytor.dc.html). */
export const IKONY_RODZAJOW: Record<RodzajNowego, string> = {
  swobodny: 'M4 4h7v7H4z M13 13h7v7h-7z M15 4h5v5 M4 15v5h5',
  wiersz: 'M3 8h18v8H3z M9 8v8 M15 8v8',
  kolumna: 'M8 3h8v18H8z M8 9h8 M8 15h8',
  warstwy: 'M12 3 3 8l9 5 9-5z M3 13l9 5 9-5',
  tekst: 'M5 6V4h14v2 M12 4v16 M9 20h6',
  'etykieta-wartosc': 'M3 9h6 M3 15h6 M12 6h9v12h-9z',
  wartosc: 'M12 3l8 5v8l-8 5-8-5V8z M10 12h4',
  wpis: 'M3 7h18v10H3z M7 10v4',
  znaczniki: 'M4 5h4v4H4z M4 15h4v4H4z M11 7h9 M11 17h9',
  tabela: 'M3 5h18v14H3z M3 10h18 M3 15h18 M10 5v14',
  obraz: 'M3 5h18v14H3z M3 16l5-5 4 4 3-3 6 6',
  ikona: 'M12 3l2.6 5.6 6.1.6-4.6 4.1 1.4 6-5.5-3.2-5.5 3.2 1.4-6L3.3 9.2l6.1-.6z',
  separator: 'M3 12h18',
  'separator-zakonczenia': 'M8 12h8 M2 12l3-3 3 3-3 3z M16 12l3-3 3 3-3 3z',
  'separator-motyw': 'M3 12h6 M15 12h6 M12 8l3 4-3 4-3-4z',
};

/** Grupy elementów w lewym pasku „Dodaj element” (sekcja 5.3 planu UI2). */
export const GRUPY_ELEMENTOW: readonly {
  id: 'uklad' | 'tresc' | 'grafika' | 'ozdoby';
  rodzaje: readonly RodzajNowego[];
}[] = [
  { id: 'uklad', rodzaje: ['swobodny', 'wiersz', 'kolumna', 'warstwy'] },
  { id: 'tresc', rodzaje: ['tekst', 'etykieta-wartosc', 'wartosc', 'wpis', 'znaczniki', 'tabela'] },
  { id: 'grafika', rodzaje: ['obraz', 'ikona'] },
  { id: 'ozdoby', rodzaje: ['separator', 'separator-zakonczenia', 'separator-motyw'] },
];

/**
 * Pozycje menu „+ Dodaj”: same napisy, bez ikon (jak menu typów kart, UI-4 B152 i UI-7);
 * ikony typów zostają tylko w drzewie szablonu i w lewym pasku UI2.
 */
export function PozycjeMenuDodaj({
  dodaj,
  rodzaje = RODZAJE,
}: {
  dodaj: (r: RodzajNowego) => void;
  rodzaje?: readonly RodzajNowego[];
}) {
  return (
    <>
      {rodzaje.map((r) => (
        <button
          key={r}
          type="button"
          role="menuitem"
          className="menu-pozycja"
          onClick={() => dodaj(r)}
        >
          <span>{t(`wezel.${r}`)}</span>
        </button>
      ))}
    </>
  );
}
