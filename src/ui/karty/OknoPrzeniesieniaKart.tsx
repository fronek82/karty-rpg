import { useMemo, useState } from 'react';
import { dopasujPolaSzablonow } from '../../dane/aktualizacjaSzablonu';
import { t } from '../../i18n';
import type { Szablon } from '../../model/szablon';
import { OknoModalne } from '../OknoModalne';

export interface OknoPrzeniesieniaKartProps {
  /** Liczba zaznaczonych kart do przeniesienia. */
  liczbaKart: number;
  /** Unikalne szablony źródłowe zaznaczonych kart. */
  szablonyZrodlowe: readonly Szablon[];
  /** Dostępne docelowe szablony w projekcie. */
  dostepneSzablony: readonly Szablon[];
  onZatwierdz: (docelowySzablonId: string) => void;
  onAnuluj: () => void;
}

/**
 * Okno „Przenieś na szablon…” (Plan S, S5, sekcja 5.5, D-S7):
 * pokazuje listę pól przeniesionych, pominiętych i nowych przed przeniesieniem zaznaczonych kart.
 */
export function OknoPrzeniesieniaKart({
  liczbaKart,
  szablonyZrodlowe,
  dostepneSzablony,
  onZatwierdz,
  onAnuluj,
}: OknoPrzeniesieniaKartProps) {
  const [wybranyId, ustawWybranyId] = useState(dostepneSzablony[0]?.id ?? '');
  const docelowy = useMemo(
    () => dostepneSzablony.find((s) => s.id === wybranyId) ?? dostepneSzablony[0],
    [dostepneSzablony, wybranyId],
  );

  const dopasowania = useMemo(() => {
    if (!docelowy) return [];
    return szablonyZrodlowe
      .filter((sz) => sz.id !== docelowy.id)
      .map((sz) => ({
        szablon: sz,
        dopasowanie: dopasujPolaSzablonow(sz, docelowy),
      }));
  }, [szablonyZrodlowe, docelowy]);

  return (
    <OknoModalne tytul={t('karty.przenies.tytul', { n: liczbaKart })} zamknij={onAnuluj}>
      <div className="karty-ui2-modal-tresc">
        {dostepneSzablony.length === 0 ? (
          <p className="podpis">{t('karty.przenies.brakInnych')}</p>
        ) : (
          <>
            <label className="karty-ui2-pole">
              <span>{t('karty.przenies.wybierzCel')}</span>
              <select
                data-testid="przenies-wybor-szablonu"
                value={docelowy?.id ?? ''}
                onChange={(e) => ustawWybranyId(e.target.value)}
              >
                {dostepneSzablony.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nazwa}
                  </option>
                ))}
              </select>
            </label>

            {dopasowania.map(({ szablon, dopasowanie }) => (
              <div key={szablon.id} className="karty-ui2-dopasowanie">
                {dopasowania.length > 1 && <strong>{szablon.nazwa}</strong>}
                {dopasowanie.przeniesione.length > 0 && (
                  <div>
                    <strong>{t('karty.aktualizacja.polaPrzeniesione')}:</strong>{' '}
                    {dopasowanie.przeniesione.map((p) => p.nazwa).join(', ')}
                  </div>
                )}
                {dopasowanie.pominiete.length > 0 && (
                  <div className="ostrzezenie">
                    <strong>{t('karty.aktualizacja.polaPominiete')}:</strong>{' '}
                    {dopasowanie.pominiete.map((p) => p.nazwa).join(', ')}
                  </div>
                )}
                {dopasowanie.nowe.length > 0 && (
                  <div>
                    <strong>{t('karty.aktualizacja.polaNowe')}:</strong>{' '}
                    {dopasowanie.nowe.map((p) => p.nazwa).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        <div className="karty-ui2-modal-akcje">
          <button type="button" className="karty-ui2-przycisk" onClick={onAnuluj}>
            {t('nowyProjekt.anuluj')}
          </button>
          {docelowy && (
            <button
              type="button"
              className="karty-ui2-przycisk glowny"
              data-testid="przenies-zatwierdz"
              onClick={() => onZatwierdz(docelowy.id)}
            >
              {t('karty.przenies.zatwierdz', { n: liczbaKart })}
            </button>
          )}
        </div>
      </div>
    </OknoModalne>
  );
}
