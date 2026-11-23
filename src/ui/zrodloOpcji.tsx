import type { ChangeEvent } from 'react';
import { t } from '../i18n';
import type { ZapisanyRewersGlobalny } from './rewersyGlobalne';

/**
 * Skąd pochodzi pozycja listy wyboru: z bieżącego projektu, z biblioteki rewersów przeglądarki
 * albo z innego projektu zapisanego w przeglądarce. Wartość `<option>` to zwykłe id (klucz
 * wpisu), a źródło niesie atrybut `data-zrodlo` – pozycje bez niego należą do projektu.
 */
export type ZrodloOpcji = 'projekt' | 'globalny' | 'inny-projekt';

/** Atrybuty `<option>` pozycji spoza bieżącego projektu. */
export const atrybutyZrodla = (zrodlo: Exclude<ZrodloOpcji, 'projekt'>) => ({
  'data-zrodlo': zrodlo,
});

/** Id i źródło pozycji wybranej na liście. */
export function wybranaOpcja(e: ChangeEvent<HTMLSelectElement>): {
  id: string;
  zrodlo: ZrodloOpcji;
} {
  const zrodlo = e.target.selectedOptions[0]?.dataset.zrodlo as ZrodloOpcji | undefined;
  return { id: e.target.value, zrodlo: zrodlo ?? 'projekt' };
}

/** Grupa „rewersy z przeglądarki” na liście wyboru rewersu (pusta lista – nic). */
export function OpcjeRewersowGlobalnych({ lista }: { lista: readonly ZapisanyRewersGlobalny[] }) {
  if (lista.length === 0) return null;
  return (
    <optgroup label={t('rewersy.globalneGrupa')}>
      {lista.map((w) => (
        <option key={w.klucz} value={w.klucz} {...atrybutyZrodla('globalny')}>
          {w.nazwa}
        </option>
      ))}
    </optgroup>
  );
}
