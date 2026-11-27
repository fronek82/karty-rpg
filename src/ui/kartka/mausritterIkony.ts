import type { TypKarty } from '../../pakiety/typy';
import { nazwaRozmiaru } from '../nazwyPakietu';

/**
 * Sześć różnych ścieżek SVG (viewBox 0 0 24 24) dla typów kart Mausrittera
 * – zgodnie z makietą docs/makiety-ui2/Mausritter.dc.html i sekcją 13.3 planu UI2.
 */
export const IKONY_MAUSRITTER: Readonly<Record<string, string>> = {
  bron: 'M14.5 17.5 3 6V3h3l11.5 11.5 M13 19l6-6 M16 16l4 4 M19 21l2-2',
  zbroja: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  ekwipunek: 'M6 8h12l-1 13H7z M9 8V6a3 3 0 0 1 6 0v2',
  zaklecie: 'M12 3l2.6 5.6 6.1.6-4.6 4.1 1.4 6-5.5-3.2-5.5 3.2 1.4-6L3.3 9.2l6.1-.6z',
  stan: 'M12 5v14 M5 12h14',
  pusta: 'M5 5h14v14H5z',
};

const DOMYSLNA_IKONA = 'M5 5h14v14H5z';

export function ikonaTypuMausritter(typId: string): string {
  return IKONY_MAUSRITTER[typId] ?? DOMYSLNA_IKONA;
}

/** Zwięzły opis dostępnych rozmiarów typu karty (np. „1×2 ciężka · 2×1 lekka”). */
export function opisRozmiarowTypu(typ: TypKarty): string {
  return typ.rozmiary
    .map((r) => {
      const nazwa = nazwaRozmiaru(r);
      return `${r.kolumny}×${r.rzedy}${nazwa ? ` ${nazwa}` : ''}`;
    })
    .join(' · ');
}
