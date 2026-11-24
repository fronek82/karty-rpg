import { t } from '../../i18n';

/**
 * Pośredni ekran „Nowy szablon od zera”: po lewej dwa odnośniki – przód i tył karty; oba
 * otwierają kreator (krok 1: nazwa, format, orientacja, rogi, kolor, układ startowy).
 */
export function WybierzStroneSzablonu() {
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
          <a href="#/wlasne/nowy/awers" className="pasek-menu pasek-awers">
            <b>{t('wlasne.awersNazwa')}</b>
            <span>{t('wlasne.awersOpis')}</span>
          </a>
          <a href="#/wlasne/nowy/rewers" className="pasek-menu pasek-rewers">
            <b>{t('wlasne.rewersNazwa')}</b>
            <span>{t('wlasne.rewersOpis')}</span>
          </a>
        </nav>

        <div className="grupa-podgladow">
          <h1>{t('wlasne.stronaTytul')}</h1>
          <p className="podpis">{t('wlasne.stronaOpis')}</p>
          <div className="opisy-stron-karty">
            <section className="opis-strony-karty" aria-labelledby="opis-awers-tytul">
              <h2 id="opis-awers-tytul">{t('wlasne.awersNazwa')}</h2>
              <p>{t('wlasne.awersSzczegoly')}</p>
              <ul>
                <li>{t('wlasne.awersPunkt1')}</li>
                <li>{t('wlasne.awersPunkt2')}</li>
                <li>{t('wlasne.awersPunkt3')}</li>
              </ul>
            </section>
            <section className="opis-strony-karty" aria-labelledby="opis-rewers-tytul">
              <h2 id="opis-rewers-tytul">{t('wlasne.rewersNazwa')}</h2>
              <p>{t('wlasne.rewersSzczegoly')}</p>
              <ul>
                <li>{t('wlasne.rewersPunkt1')}</li>
                <li>{t('wlasne.rewersPunkt2')}</li>
                <li>{t('wlasne.rewersPunkt3')}</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
}
