import { ustawUstawieniaArkusza } from '../../dane/edycja';
import { formatujLiczbe, t } from '../../i18n';
import {
  czyJasnyKolor,
  GRUBOSCI_LINII_CIECIA,
  KOLORY_LINII_CIECIA,
  LINIE_CIECIA_DOMYSLNE,
  type Arkusz,
  type LinieCiecia,
} from '../../model/arkusz';
import type { Projekt } from '../../model/projekt';
import { PoleLiczby } from './PoleLiczby';
import './drukUi2.css';

/**
 * Sekcja „Linie cięcia” w panelu ustawień druku (UI2 R7, plan sekcja 5.6):
 * włącznik, grubość (0,1/0,2/0,3/0,5 mm), próbki koloru + własny kolor,
 * kreska i przerwa w mm (0 = ciągła) oraz podgląd linii na żywo (ciemne tło przy jasnym kolorze).
 */
export function SekcjaLiniiCiecia({
  arkusz,
  zmien,
}: {
  arkusz: Arkusz;
  zmien: (f: (p: Projekt) => Projekt, opcje?: { klucz?: string }) => void;
}) {
  const A = arkusz.id;
  const u = arkusz.ustawienia;
  const linie = u.linie;
  const wlaczone = linie.grubosc > 0;
  const trybDrukarni = !!u.drukarnia?.wlaczony;
  const jasny = czyJasnyKolor(linie.kolor);

  const aktualizuj = (czesc: Partial<LinieCiecia>, klucz?: string) => {
    zmien(
      (p) => ustawUstawieniaArkusza(p, A, { linie: { ...linie, ...czesc } }),
      klucz ? { klucz: `linie:${A}:${klucz}` } : undefined,
    );
  };

  return (
    <details open className="sekcja-panelu druk-ui2-linie" data-testid="sekcja-linii-ciecia">
      <summary>{t('druk.linieCiecia.tytul')}</summary>
      <div className="druk-ui2-linie-cialo">
        {trybDrukarni ? (
          <p className="podpis" data-testid="linie-tryb-drukarni">
            {t('druk.linieCiecia.trybDrukarni')}
          </p>
        ) : (
          <>
            <label className="pole-wyboru">
              <input
                type="checkbox"
                data-testid="linie-wlacz"
                checked={wlaczone}
                onChange={(e) =>
                  aktualizuj(
                    { grubosc: e.target.checked ? LINIE_CIECIA_DOMYSLNE.grubosc : 0 },
                    'wlacz',
                  )
                }
              />{' '}
              {t('druk.linieCiecia.wlacz')}
            </label>

            {wlaczone && (
              <>
                <div className="pole-panelu">
                  <span>{t('druk.linieCiecia.grubosc')}</span>
                  <div
                    className="druk-ui2-grubosci"
                    role="group"
                    aria-label={t('druk.linieCiecia.grubosc')}
                  >
                    {GRUBOSCI_LINII_CIECIA.map((g) => (
                      <button
                        key={g}
                        type="button"
                        className="druk-ui2-grubosc-btn"
                        data-testid={`linia-grubosc-${g}`}
                        aria-pressed={Math.abs(linie.grubosc - g) < 0.01}
                        onClick={() => aktualizuj({ grubosc: g }, 'grubosc')}
                      >
                        {formatujLiczbe(g, 1)} mm
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pole-panelu">
                  <span>{t('druk.linieCiecia.kolor')}</span>
                  <div className="druk-ui2-kolory">
                    {KOLORY_LINII_CIECIA.map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="druk-ui2-probka"
                        data-testid={`linia-probka-${k.slice(1)}`}
                        aria-label={`${t('druk.linieCiecia.kolor')} ${k}`}
                        aria-pressed={linie.kolor.toLowerCase() === k.toLowerCase()}
                        style={{ backgroundColor: k }}
                        onClick={() => aktualizuj({ kolor: k }, 'kolor')}
                      />
                    ))}
                    <input
                      type="color"
                      className="druk-ui2-kolor-input"
                      data-testid="linia-kolor"
                      aria-label={t('druk.linieCiecia.kolorWlasny')}
                      value={
                        /^#[0-9a-f]{6}$/i.test(linie.kolor)
                          ? linie.kolor
                          : LINIE_CIECIA_DOMYSLNE.kolor
                      }
                      onChange={(e) => aktualizuj({ kolor: e.target.value }, 'kolor')}
                    />
                  </div>
                </div>

                <div className="pole-panelu dwa-pola">
                  <PoleLiczby
                    id="linia-kreska"
                    etykieta={t('druk.linieCiecia.kreska')}
                    wartosc={linie.kreska}
                    min={0.5}
                    max={10}
                    krok={0.5}
                    zmien={(v) => aktualizuj({ kreska: v }, 'kreska')}
                  />
                  <PoleLiczby
                    id="linia-przerwa"
                    etykieta={t('druk.linieCiecia.przerwa')}
                    wartosc={linie.przerwa}
                    min={0}
                    max={10}
                    krok={0.5}
                    zmien={(v) => aktualizuj({ przerwa: v }, 'przerwa')}
                  />
                </div>
                <p className="podpis">{t('druk.linieCiecia.przerwaOpis')}</p>

                <div
                  className={`druk-ui2-podglad-linii${jasny ? ' ciemne' : ''}`}
                  data-testid="podglad-linii-ciecia"
                  data-ciemne={jasny ? '1' : '0'}
                  aria-label={t('druk.linieCiecia.podglad')}
                >
                  <svg viewBox="0 0 180 20" width="100%" height="20" aria-hidden="true">
                    <line
                      x1="8"
                      y1="10"
                      x2="172"
                      y2="10"
                      stroke={linie.kolor}
                      strokeWidth={Math.max(1, linie.grubosc * 4)}
                      strokeDasharray={
                        linie.przerwa > 0 && linie.kreska > 0
                          ? `${linie.kreska * 4} ${linie.przerwa * 4}`
                          : undefined
                      }
                    />
                  </svg>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </details>
  );
}
