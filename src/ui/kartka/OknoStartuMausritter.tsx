import { useEffect, useId, useRef } from 'react';
import { t } from '../../i18n';
import { wymiaryKarty } from '../../model/szablon';
import type { GotowyUklad, Pakiet } from '../../pakiety/typy';
import { atrybucjaPakietu, nazwaUkladu } from '../nazwyPakietu';

/** Zlicza kafelki zajmowane przez karty w pojedynczym gotowym układzie pakietu. */
function kafelkiUkladu(pakiet: Pakiet, uklad: GotowyUklad): number {
  const arkusze = pakiet.arkusze.filter((a) => uklad.arkusze.includes(a.id));
  const szablony = new Map(pakiet.szablony.map((s) => [s.id, s] as const));
  let suma = 0;
  for (const a of arkusze) {
    const talia = pakiet.talie.find((tl) => tl.id === a.taliaId);
    const slot = a.ustawienia.slot;
    for (const k of talia?.karty ?? []) {
      const sz = szablony.get(k.szablonId);
      const wym = sz ? wymiaryKarty(sz, k) : undefined;
      const kolumny =
        k.rozmiar?.kolumny ??
        (wym && slot ? Math.max(1, Math.round(wym.szer / slot.szerokosc)) : 1);
      const rzedy =
        k.rozmiar?.rzedy ?? (wym && slot ? Math.max(1, Math.round(wym.wys / slot.wysokosc)) : 1);
      suma += kolumny * rzedy * k.ilosc;
    }
  }
  return suma;
}

export interface OknoStartuMausritterProps {
  pakiet: Pakiet;
  kolumny?: number;
  rzedy?: number;
  onPusty: () => void;
  onWybierzUklad: (ukladId: string) => void;
}

/**
 * Okno „Od czego zaczynamy?” nakładane na obszar roboczy arkusza Mausrittera (sekcja 13.1 planu UI2).
 * `Esc`, przycisk „×” i „Pusty arkusz A4” zamykają okno i zostawiają pusty arkusz 10 × 7.
 */
export function OknoStartuMausritter({
  pakiet,
  kolumny = 10,
  rzedy = 7,
  onPusty,
  onWybierzUklad,
}: OknoStartuMausritterProps) {
  const idTytulu = useId();
  const przyciskPustyRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    przyciskPustyRef.current?.focus();
    const klawisz = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onPusty();
      }
    };
    window.addEventListener('keydown', klawisz, true);
    return () => window.removeEventListener('keydown', klawisz, true);
  }, [onPusty]);

  return (
    <div className="mausritter-ui2-start-tlo" data-testid="okno-startu-mausritter">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTytulu}
        className="mausritter-ui2-start-okno"
      >
        <div className="mausritter-ui2-start-naglowek">
          <h2 id={idTytulu}>{t('mausritter.odCzegoZaczynamy')}</h2>
          <button
            type="button"
            className="mausritter-ui2-start-zamknij"
            aria-label={t('kartka.zamknijKomunikat')}
            onClick={onPusty}
          >
            ×
          </button>
        </div>

        <button
          ref={przyciskPustyRef}
          type="button"
          className="mausritter-ui2-start-pusty"
          data-testid="start-pusty-arkusz"
          onClick={onPusty}
        >
          <span className="mausritter-ui2-start-pusty-tytul">
            {t('mausritter.pustyArkuszTytul')}
          </span>
          <span className="mausritter-ui2-start-pusty-opis">
            {t('mausritter.pustyArkuszOpis', { kolumny, rzedy })}
          </span>
        </button>

        <span className="mausritter-ui2-start-sekcja">{t('mausritter.gotoweArkusze')}</span>
        <div className="mausritter-ui2-start-siatka">
          {pakiet.gotoweUklady.map((u) => {
            const opis =
              u.arkusze.length > 1
                ? t('mausritter.wszystkieArkuszeOpis', { liczba: u.arkusze.length })
                : t('mausritter.gotowyArkuszOpis', { kafelki: kafelkiUkladu(pakiet, u) });
            return (
              <button
                key={u.id}
                type="button"
                className="mausritter-ui2-start-uklad"
                data-uklad={u.id}
                onClick={() => onWybierzUklad(u.id)}
              >
                <span className="mausritter-ui2-start-uklad-nazwa">{nazwaUkladu(u)}</span>
                <span className="mausritter-ui2-start-uklad-opis">{opis}</span>
              </button>
            );
          })}
        </div>

        <p className="mausritter-ui2-start-nota">{atrybucjaPakietu(pakiet)}</p>
      </div>
    </div>
  );
}
