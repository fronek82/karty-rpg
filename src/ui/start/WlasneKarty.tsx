import { t } from '../../i18n';

/** „Stwórz własne karty” – miejsce na edytor kart od zera (na razie zapowiedź). */
export function WlasneKarty() {
  return (
    <section className="wlasne-karty">
      <nav aria-label={t('projekt.nawigacja')} className="okruszki">
        <a href="#/">{t('nawigacja.start')}</a> › {t('start.stworzWlasne')}
      </nav>
      <h1>{t('start.wlasneWBudowie')}</h1>
      <p>{t('start.wlasneWBudowieOpis')}</p>
      <p>
        <a href="#/">{t('nawigacja.wrocNaStart')}</a>
      </p>
    </section>
  );
}
