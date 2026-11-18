import { t } from '../../i18n';
import {
  rozlozRowno,
  WYROWNANIA,
  wyrownaj,
  type Cel,
  type Wyrownanie,
  type ZmianaPola,
} from './swobodnyMysz';

const IKONY: Record<Wyrownanie, string> = {
  lewo: '⇤',
  'srodek-poziomo': '↔',
  prawo: '⇥',
  gora: '⤒',
  'srodek-pionowo': '↕',
  dol: '⤓',
};

/**
 * Wyrównanie (6 kierunków) i rozłożenie równo zaznaczonych elementów jednego kontenera swobodnego.
 * Liczy się z prostokątów z układu (`cele`); wynik to zmiany `pozycja`, nakładane jednym krokiem „Cofnij”.
 */
export function PanelWyrownania({
  cele,
  zastosuj,
}: {
  cele: readonly Cel[];
  zastosuj: (zmiany: Map<string, ZmianaPola>) => void;
}) {
  return (
    <div className="pole-panelu wyrownanie" role="group" aria-label={t('wyrownaj.tytul')}>
      <span>{t('wyrownaj.tytul')}</span>
      <p className="podpis">{t('wyrownaj.opis')}</p>
      <div className="wiersz-przyciskow">
        {WYROWNANIA.map((jak) => (
          <button
            key={jak}
            type="button"
            className="maly"
            aria-label={t(`wyrownaj.${jak}`)}
            title={t(`wyrownaj.${jak}`)}
            onClick={() => zastosuj(wyrownaj(cele, jak))}
          >
            <span aria-hidden="true">{IKONY[jak]}</span>
          </button>
        ))}
      </div>
      <div className="wiersz-przyciskow">
        <button
          type="button"
          className="maly"
          disabled={cele.length < 3}
          onClick={() => zastosuj(rozlozRowno(cele, 'poziomo'))}
        >
          {t('wyrownaj.rozlozPoziomo')}
        </button>
        <button
          type="button"
          className="maly"
          disabled={cele.length < 3}
          onClick={() => zastosuj(rozlozRowno(cele, 'pionowo'))}
        >
          {t('wyrownaj.rozlozPionowo')}
        </button>
      </div>
      {cele.length < 3 && <p className="podpis">{t('wyrownaj.rozlozOpis')}</p>}
    </div>
  );
}
