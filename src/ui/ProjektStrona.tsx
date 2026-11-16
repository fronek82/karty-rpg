import { useState } from 'react';
import { t } from '../i18n';
import { WidokArkuszy } from './Arkusze';
import { PanelKarty } from './talia/PanelKarty';
import { TabelaTalii } from './talia/TabelaTalii';
import { tekstZapisu, useProjekt, type ProjektWEdycji } from './useProjekt';

/**
 * Strona projektu: przegląd talii i arkuszy, ostrzeżenia; podstrony `talia/<id>` (tabela danych)
 * i `arkusze`.
 */
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
  return <Projekt edycja={stan} podstrona={podstrona} />;
}

function Projekt({ edycja, podstrona }: { edycja: ProjektWEdycji; podstrona?: string }) {
  const { projekt } = edycja;
  const adres = `#/projekt/${encodeURIComponent(projekt.id)}`;
  const [rodzaj, ...reszta] = podstrona?.split('/') ?? [];
  const taliaId = rodzaj === 'talia' ? decodeURIComponent(reszta.join('/')) : undefined;
  const talia = taliaId !== undefined ? projekt.talie.find((x) => x.id === taliaId) : undefined;
  const tytulPodstrony =
    rodzaj === 'arkusze' ? t('arkusze.tytul') : talia ? talia.nazwa : undefined;

  return (
    <>
      <div className="pasek-projektu">
        <nav aria-label={t('projekt.nawigacja')} className="okruszki">
          <a href="#/projekty">{t('nawigacja.projekty')}</a> ›{' '}
          {podstrona ? <a href={adres}>{projekt.nazwa}</a> : <span>{projekt.nazwa}</span>}
          {tytulPodstrony && <> › {tytulPodstrony}</>}
        </nav>
        <p
          role="status"
          aria-live="polite"
          className={`status-zapisu ${edycja.zapis.stan === 'blad' ? 'blad' : ''}`}
        >
          {tekstZapisu(edycja.zapis)}
        </p>
      </div>
      {edycja.ostrzezenia.length > 0 && (
        <details className="uwaga">
          <summary>{t('projekt.ostrzezenia', { liczba: edycja.ostrzezenia.length })}</summary>
          <ul>
            {edycja.ostrzezenia.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </details>
      )}
      {rodzaj === 'arkusze' ? (
        <WidokArkuszy zrodlo={projekt} zasoby={edycja.zasoby.zasoby} />
      ) : talia ? (
        <StronaTalii edycja={edycja} taliaId={talia.id} />
      ) : podstrona === undefined ? (
        <Przeglad edycja={edycja} adres={adres} />
      ) : (
        <p>{t('nawigacja.nieZnaleziono')}</p>
      )}
    </>
  );
}

function StronaTalii({ edycja, taliaId }: { edycja: ProjektWEdycji; taliaId: string }) {
  const talia = edycja.projekt.talie.find((x) => x.id === taliaId)!;
  const [wybrana, ustawWybrana] = useState<string | undefined>(talia.karty[0]?.id);
  const karta = talia.karty.find((k) => k.id === wybrana);
  return (
    <div className="strona-talii">
      <TabelaTalii edycja={edycja} talia={talia} wybrana={karta?.id} wybierz={ustawWybrana} />
      {karta ? (
        <PanelKarty key={karta.id} edycja={edycja} talia={talia} karta={karta} />
      ) : (
        <aside className="panel-karty">
          <p>{t('karta.wybierzKarte')}</p>
        </aside>
      )}
    </div>
  );
}

function Przeglad({ edycja, adres }: { edycja: ProjektWEdycji; adres: string }) {
  const { projekt } = edycja;
  return (
    <section>
      <h1>{projekt.nazwa}</h1>
      <h2>{t('projekt.talie')}</h2>
      <ul>
        {projekt.talie.map((talia) => (
          <li key={talia.id}>
            <a href={`${adres}/talia/${encodeURIComponent(talia.id)}`}>{talia.nazwa}</a> –{' '}
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
  );
}
