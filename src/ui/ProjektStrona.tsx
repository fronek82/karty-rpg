import { t } from '../i18n';
import { WidokArkuszy } from './Arkusze';
import { useProjekt } from './useProjekt';

/** Strona projektu: przegląd talii i arkuszy, ostrzeżenia; podstrona `arkusze`. */
export function ProjektStrona({ id, podstrona }: { id: string; podstrona?: string }) {
  const stan = useProjekt(id);
  if (stan.stan === 'wczytywanie') return <p>{t('projekty.wczytywanie')}</p>;
  if (stan.stan === 'blad')
    return (
      <section>
        <h1>{t('projekt.bladTytul')}</h1>
        <p role="alert" className="uwaga">
          {stan.komunikat}
        </p>
        <a href="#/projekty">{t('projekt.wrocDoListy')}</a>
      </section>
    );
  const { projekt } = stan;
  const adres = `#/projekt/${encodeURIComponent(projekt.id)}`;
  return (
    <>
      <nav aria-label={t('projekt.nawigacja')} className="okruszki">
        <a href="#/projekty">{t('nawigacja.projekty')}</a> ›{' '}
        {podstrona ? <a href={adres}>{projekt.nazwa}</a> : <span>{projekt.nazwa}</span>}
        {podstrona === 'arkusze' && <> › {t('arkusze.tytul')}</>}
      </nav>
      {stan.ostrzezenia.length > 0 && (
        <details className="uwaga">
          <summary>{t('projekt.ostrzezenia', { liczba: stan.ostrzezenia.length })}</summary>
          <ul>
            {stan.ostrzezenia.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </details>
      )}
      {podstrona === 'arkusze' ? (
        <WidokArkuszy zrodlo={projekt} zasoby={stan.zasoby.zasoby} />
      ) : podstrona === undefined ? (
        <section>
          <h1>{projekt.nazwa}</h1>
          <h2>{t('projekt.talie')}</h2>
          <ul>
            {projekt.talie.map((talia) => (
              <li key={talia.id}>
                {talia.nazwa} –{' '}
                {t('projekt.liczbaKart', {
                  karty: talia.karty.length,
                  sztuki: talia.karty.reduce((s, k) => s + k.ilosc, 0),
                })}
              </li>
            ))}
          </ul>
          <h2>{t('arkusze.tytul')}</h2>
          <p>
            <a href={`${adres}/arkusze`}>
              {t('projekt.doArkuszy', { liczba: projekt.arkusze.length })}
            </a>
          </p>
        </section>
      ) : (
        <p>{t('nawigacja.nieZnaleziono')}</p>
      )}
    </>
  );
}
