import { t } from '../../i18n';
import type { RodzajNowego } from '../../dane/szablon';

/** Rodzaje elementów w menu „+ Dodaj” edytora szablonu (kolejność jak w menu). */
export const RODZAJE: RodzajNowego[] = [
  'wiersz',
  'kolumna',
  'warstwy',
  'swobodny',
  'tekst',
  'etykieta-wartosc',
  'wartosc',
  'obraz',
  'znaczniki',
  'wpis',
  'ikona',
  'separator',
  'separator-zakonczenia',
  'separator-motyw',
  'tabela',
];

/**
 * Pozycje menu „+ Dodaj”: same napisy, bez ikon (jak menu typów kart, UI-4 B152 i UI-7);
 * ikony typów zostają tylko w drzewie szablonu.
 */
export function PozycjeMenuDodaj({ dodaj }: { dodaj: (r: RodzajNowego) => void }) {
  return (
    <>
      {RODZAJE.map((r) => (
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
