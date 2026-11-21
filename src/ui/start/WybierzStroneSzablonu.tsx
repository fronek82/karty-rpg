import { useEffect, useRef, useState } from 'react';
import { t } from '../../i18n';
import { nowyProjektZRewersem } from '../baza';

/**
 * Pośredni ekran „Nowy szablon od zera”: po lewej dwa przyciski kroku 3 – „Awers” (otwiera
 * kreator przodu karty) i „Rewers” (od razu tworzy projekt z rewersem i otwiera edytor rewersu).
 */
export function WybierzStroneSzablonu() {
  const przyciskRewersu = useRef<HTMLButtonElement>(null);
  const przywrocFokus = useRef(false);
  const zamontowany = useRef(true);
  const wToku = useRef(false);
  const [trwa, ustawTrwa] = useState(false);
  const [blad, ustawBlad] = useState<string>();

  useEffect(() => {
    zamontowany.current = true;
    return () => {
      zamontowany.current = false;
    };
  }, []);

  useEffect(() => {
    if (!trwa && przywrocFokus.current) {
      przywrocFokus.current = false;
      przyciskRewersu.current?.focus();
    }
  }, [trwa]);

  const utworzRewers = async () => {
    if (wToku.current) return;
    wToku.current = true;
    ustawTrwa(true);
    ustawBlad(undefined);
    try {
      const { id, rewersId } = await nowyProjektZRewersem();
      if (!zamontowany.current) return;
      window.location.hash = `#/projekt/${encodeURIComponent(id)}/rewers/${encodeURIComponent(rewersId)}`;
    } catch (e) {
      if (!zamontowany.current) return;
      przywrocFokus.current = true;
      ustawBlad(e instanceof Error ? e.message : String(e));
      wToku.current = false;
      ustawTrwa(false);
    }
  };

  return (
    <section className="wybor-gry">
      <nav aria-label={t('projekt.nawigacja')} className="okruszki">
        <a href="#/">{t('nawigacja.start')}</a> › <a href="#/wlasne">{t('start.stworzWlasne')}</a> ›{' '}
        <span aria-current="page">{t('wlasne.nowyNazwa')}</span>
      </nav>
      <div className="wybor-kolumny">
        <nav className="start-menu" aria-labelledby="wybor-strony-menu">
          <p id="wybor-strony-menu" className="etykieta-sekcji">
            {t('wlasne.stronaMenu')}
          </p>
          <a
            href="#/wlasne/nowy/awers"
            className="pasek-menu pasek-wlasne-3"
            aria-disabled={trwa || undefined}
            onClick={(e) => {
              if (trwa) e.preventDefault();
            }}
          >
            <b>{t('wlasne.awersNazwa')}</b>
            <span>{t('wlasne.awersOpis')}</span>
          </a>
          <button
            ref={przyciskRewersu}
            type="button"
            className="pasek-menu pasek-wlasne-3"
            disabled={trwa}
            onClick={() => void utworzRewers()}
          >
            <b>{t('wlasne.rewersNazwa')}</b>
            <span>{t('wlasne.rewersOpis')}</span>
          </button>
        </nav>

        <div className="grupa-podgladow">
          <h1>{t('wlasne.stronaTytul')}</h1>
          <p className="podpis">{t('wlasne.stronaOpis')}</p>
          <p role="status" aria-live="polite" className="status">
            {trwa ? t('start.tworze') : ''}
          </p>
          {blad && (
            <p role="alert" className="uwaga">
              {blad}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
