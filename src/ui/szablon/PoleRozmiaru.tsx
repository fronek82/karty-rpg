import { t } from '../../i18n';
import { PoleLiczby } from '../kartka/PoleLiczby';
import type { Rozmiar } from '../../model/szablon';
import { zaokraglij } from '../../model/geometria';

type Tryb = 'domyslnie' | 'auto' | 'wypelnij' | 'mm' | 'procent';

const trybRozmiaru = (r: Rozmiar | undefined): Tryb =>
  r === undefined
    ? 'domyslnie'
    : r === 'auto'
      ? 'auto'
      : 'mm' in r
        ? 'mm'
        : 'procent' in r
          ? 'procent'
          : 'wypelnij';

const liczbaRozmiaru = (r: Rozmiar | undefined): number =>
  r === undefined || r === 'auto' ? 0 : 'mm' in r ? r.mm : 'procent' in r ? r.procent : r.wypelnij;

/**
 * Szerokość albo wysokość elementu: domyślnie (w poprzek rodzica – rozciągnij, wzdłuż – wg
 * treści), wg treści, wypełnij resztę (z wagą), stała w mm albo procent miejsca w rodzicu.
 */
export function PoleRozmiaru({
  id,
  etykieta,
  wartosc,
  zmien,
  domyslneMm,
  bezWypelnij = false,
}: {
  id: string;
  etykieta: string;
  wartosc: Rozmiar | undefined;
  zmien: (r: Rozmiar | undefined) => void;
  /** Wartość startowa przy przełączeniu na mm (np. obecny rozmiar elementu). */
  domyslneMm: number;
  /** Dziecko kontenera swobodnego: „wypełnij” nie ma tam sensu (działa jak „wg treści”), więc je ukrywamy. */
  bezWypelnij?: boolean;
}) {
  const tryb = trybRozmiaru(wartosc);
  const liczba = liczbaRozmiaru(wartosc);
  const ustawTryb = (x: Tryb) =>
    zmien(
      x === 'domyslnie'
        ? undefined
        : x === 'auto'
          ? 'auto'
          : x === 'mm'
            ? { mm: zaokraglij(domyslneMm, 1) }
            : x === 'procent'
              ? { procent: 50 }
              : { wypelnij: 1 },
    );
  return (
    <div className="pole-panelu pole-rozmiaru">
      <label htmlFor={`${id}-tryb`}>{etykieta}</label>
      <select id={`${id}-tryb`} value={tryb} onChange={(e) => ustawTryb(e.target.value as Tryb)}>
        {(['domyslnie', 'auto', 'wypelnij', 'mm', 'procent'] as const)
          .filter((x) => x !== 'wypelnij' || !bezWypelnij || tryb === 'wypelnij')
          .map((x) => (
            <option key={x} value={x}>
              {t(`rozmiar.tryb.${x}`)}
            </option>
          ))}
      </select>
      {tryb !== 'auto' && tryb !== 'domyslnie' && (
        <PoleLiczby
          key={tryb}
          id={`${id}-liczba`}
          etykieta={t(`rozmiar.liczba.${tryb}`)}
          wartosc={liczba}
          min={tryb === 'wypelnij' ? 0.1 : 0}
          max={tryb === 'procent' ? 100 : 1000}
          krok={tryb === 'procent' ? 5 : 0.5}
          zmien={(v) =>
            zmien(tryb === 'mm' ? { mm: v } : tryb === 'procent' ? { procent: v } : { wypelnij: v })
          }
        />
      )}
    </div>
  );
}
