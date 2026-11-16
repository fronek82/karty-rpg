import { t } from '../../i18n';
import { gry } from '../../pakiety/gry';

/** „Inna gra” – zapowiedź kolejnych gier z rejestru (w budowie). */
export function InneGry() {
  const planowane = gry.filter((g) => !g.pakiet);
  return (
    <section className="inne-gry">
      <nav aria-label={t('projekt.nawigacja')} className="okruszki">
        <a href="#/">{t('nawigacja.start')}</a> › {t('start.stworzInna')}
      </nav>
      <h1>{t('start.wBudowie')}</h1>
      <p>{t('start.wBudowieOpis')}</p>
      <ul className="planowane-gry">
        {planowane.map((g) => (
          <li key={g.id}>
            <strong>{g.nazwa}</strong> <span className="znacznik">{g.planowana}</span>
            <br />
            <span className="podpis">{g.opis}</span>
          </li>
        ))}
      </ul>
      <p>
        <a href="#/">{t('nawigacja.wrocNaStart')}</a>
      </p>
    </section>
  );
}
