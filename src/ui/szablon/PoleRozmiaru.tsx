import { t } from '../../i18n';
import { PoleLiczby } from '../kartka/PoleLiczby';
import type { Rozmiar } from '../../model/szablon';

type Tryb = 'auto' | 'wypelnij' | 'mm' | 'procent';

const trybRozmiaru = (r: Rozmiar | undefined): Tryb =>
  r === undefined || r === 'auto'
    ? 'auto'
    : 'mm' in r
      ? 'mm'
      : 'procent' in r
        ? 'procent'
        : 'wypelnij';

const liczbaRozmiaru = (r: Rozmiar | undefined): number =>
  r === undefined || r === 'auto' ? 0 : 'mm' in r ? r.mm : 'procent' in r ? r.procent : r.wypelnij;

/**
 * Szerokość albo wysokość elementu: wg treści (auto), wypełnij resztę (z wagą), stała w mm
 * albo procent miejsca w rodzicu. `undefined` = domyślne zachowanie układu (rozciągnij/auto).
 */
export function PoleRozmiaru({
  id,
  etykieta,
  wartosc,
  zmien,
  domyslneMm,
}: {
  id: string;
  etykieta: string;
  wartosc: Rozmiar | undefined;
  zmien: (r: Rozmiar | undefined) => void;
  /** Wartość startowa przy przełączeniu na mm (np. obecny rozmiar elementu). */
  domyslneMm: number;
}) {
  const tryb = trybRozmiaru(wartosc);
  const liczba = liczbaRozmiaru(wartosc);
  const ustawTryb = (x: Tryb) =>
    zmien(
      x === 'auto'
        ? undefined
        : x === 'mm'
          ? { mm: Math.round(domyslneMm * 10) / 10 }
          : x === 'procent'
            ? { procent: 50 }
            : { wypelnij: 1 },
    );
  return (
    <div className="pole-panelu pole-rozmiaru">
      <span id={`${id}-etykieta`}>{etykieta}</span>
      <div className="przelacznik-segmentowy" role="group" aria-labelledby={`${id}-etykieta`}>
        {(['auto', 'wypelnij', 'mm', 'procent'] as const).map((x) => (
          <button key={x} type="button" aria-pressed={tryb === x} onClick={() => ustawTryb(x)}>
            {t(`rozmiar.tryb.${x}`)}
          </button>
        ))}
      </div>
      {tryb !== 'auto' && (
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
