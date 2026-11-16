import { t } from '../../i18n';
import type { Arkusz, NaglowekGrupy } from '../../model/arkusz';

/** Panel nagłówka grupy: tekst, opis, szerokość w kolumnach, odstęp przed grupą, usunięcie. */
export function PanelNaglowka({
  arkusz,
  naglowek,
  maksKolumn,
  zmien,
  usun,
  zamknij,
  blad,
}: {
  arkusz: Arkusz;
  naglowek: NaglowekGrupy;
  maksKolumn: number;
  zmien: (z: Partial<Omit<NaglowekGrupy, 'id' | 'strona'>>, klucz?: string) => void;
  usun: () => void;
  zamknij: () => void;
  blad?: string;
}) {
  const odstep = arkusz.ustawienia.grupy?.odstep ?? 0;
  const szerokosci = Array.from(
    { length: Math.min(4, maksKolumn - naglowek.kolumna) },
    (_, i) => i + 1,
  );
  return (
    <aside className="panel-edytora" aria-label={t('kartka.panelNaglowka')}>
      <div className="naglowek-panelu">
        <h2>{t('kartka.naglowekGrupy')}</h2>
        <button
          type="button"
          className="zamknij"
          aria-label={t('kartka.odznacz')}
          onClick={zamknij}
        >
          ✕
        </button>
      </div>
      <p className="podpis">
        {t('kartka.nadKolumnami', {
          od: naglowek.kolumna + 1,
          do: naglowek.kolumna + naglowek.kolumny,
          strona: naglowek.strona + 1,
        })}
      </p>
      <div className="pole-panelu">
        <label htmlFor="naglowek-tekst">{t('kartka.tekstNaglowka')}</label>
        <input
          id="naglowek-tekst"
          type="text"
          value={naglowek.naglowek}
          onChange={(e) => zmien({ naglowek: e.target.value }, 'tekst')}
        />
      </div>
      <div className="pole-panelu">
        <label htmlFor="naglowek-opis">{t('kartka.opisNaglowka')}</label>
        <textarea
          id="naglowek-opis"
          rows={3}
          value={naglowek.opis ?? ''}
          onChange={(e) => zmien({ opis: e.target.value }, 'opis')}
        />
      </div>
      <div className="pole-panelu">
        <span id="naglowek-szerokosc">{t('kartka.szerokosc')}</span>
        <div className="przelacznik-segmentowy" role="group" aria-labelledby="naglowek-szerokosc">
          {szerokosci.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={naglowek.kolumny === n}
              onClick={() => zmien({ kolumny: n })}
            >
              {t('kartka.kolumn', { liczba: n })}
            </button>
          ))}
        </div>
      </div>
      {odstep > 0 && naglowek.kolumna > 0 && (
        <div className="pole-panelu">
          <span id="naglowek-odstep">{t('kartka.odstepPrzed')}</span>
          <div className="przelacznik-segmentowy" role="group" aria-labelledby="naglowek-odstep">
            <button
              type="button"
              aria-pressed={!naglowek.odstepPrzed}
              onClick={() => zmien({ odstepPrzed: 0 })}
            >
              {t('kartka.bezOdstepu')}
            </button>
            <button
              type="button"
              aria-pressed={!!naglowek.odstepPrzed}
              onClick={() => zmien({ odstepPrzed: odstep })}
            >
              {t('kartka.odstepMm', { mm: odstep.toFixed(1).replace('.', ',') })}
            </button>
          </div>
        </div>
      )}
      {blad && (
        <p role="alert" className="blad-pola">
          {blad}
        </p>
      )}
      <div className="akcje-panelu">
        <button type="button" className="niebezpieczny" onClick={usun}>
          {t('kartka.usunNaglowek')}
        </button>
      </div>
      <p className="podpis">{t('kartka.naglowekPodpowiedz')}</p>
    </aside>
  );
}
