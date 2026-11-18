import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { t } from '../i18n';
import { useJezyk } from '../i18n/react';
import { GranicaBledu } from './GranicaBledu';
import { useTrasa } from './useTrasa';
import { NaglowekAplikacji } from './NaglowekAplikacji';
import './tokeny.css';
import './App.css';

// Strony ładowane leniwie: silnik (fontkit) i pakiet dopiero przy kartce; PDF – przy pobraniu.
const Start = lazy(() => import('./start/Start').then((m) => ({ default: m.Start })));
const WyborGry = lazy(() => import('./start/WyborGry').then((m) => ({ default: m.WyborGry })));
const WlasneKarty = lazy(() =>
  import('./start/WlasneKarty').then((m) => ({ default: m.WlasneKarty })),
);
const KreatorStrona = lazy(() =>
  import('./start/KreatorStrona').then((m) => ({ default: m.KreatorStrona })),
);
const EdytorStrona = lazy(() =>
  import('./EdytorStrona').then((m) => ({ default: m.EdytorStrona })),
);

const ADRES_REPOZYTORIUM = 'https://github.com/fronek82/karty-rpg';
const ADRES_LICENCJI = `${ADRES_REPOZYTORIUM}/blob/main/LICENCJE.md`;

const wersja = import.meta.env.VITE_WERSJA ?? '0.1.0';

/** Strona ładowana leniwie, z granicą błędu. */
function Leniwa({ children }: { children: ReactNode }) {
  return (
    <GranicaBledu>
      <Suspense fallback={<p>{t('aplikacja.wczytywanieStrony')}</p>}>{children}</Suspense>
    </GranicaBledu>
  );
}

export function App() {
  // Zmiana języka przerysowuje całe drzewo (teksty czytane przy renderze) bez utraty stanu.
  useJezyk();
  const trasa = useTrasa();
  const dopasowanie = /^\/projekt\/([^/]+)(?:\/(.*))?$/.exec(trasa);
  const projekt = dopasowanie?.[1];
  const podtrasa = dopasowanie?.[2] ?? '';
  const gra = /^\/gra\/([^/]+)$/.exec(trasa)?.[1];
  // Dawne trasy (lista projektów, arkusze pakietu) – teraz wszystko jest na starcie.
  const dawna = trasa === '/projekty' || trasa === '/arkusze';
  useEffect(() => {
    if (dawna) window.location.replace('#/');
  }, [dawna]);

  // Ekrany startowe (start, gra, własne karty) mają szeroką treść; kreator jest wąski.
  const wlasne = trasa === '/wlasne' || trasa === '/gry/inne';
  const szerokaTresc = trasa === '/' || dawna || !!gra || wlasne;

  if (projekt) {
    // Edytor kartki zajmuje cały ekran (własny pasek górny).
    return (
      <div className="aplikacja">
        <Leniwa>
          <EdytorStrona key={projekt} id={decodeURIComponent(projekt)} podtrasa={podtrasa} />
        </Leniwa>
      </div>
    );
  }

  return (
    <div className="aplikacja">
      <NaglowekAplikacji />
      <main className={szerokaTresc ? 'tresc tresc-start' : 'tresc'}>
        {trasa === '/' || dawna ? (
          <Leniwa>
            <Start />
          </Leniwa>
        ) : gra ? (
          <Leniwa>
            <WyborGry id={decodeURIComponent(gra)} />
          </Leniwa>
        ) : trasa === '/wlasne/nowy' ? (
          <Leniwa>
            <KreatorStrona />
          </Leniwa>
        ) : wlasne ? (
          <Leniwa>
            <WlasneKarty />
          </Leniwa>
        ) : (
          <section>
            <h1>{t('nawigacja.nieZnaleziono')}</h1>
            <a href="#/">{t('nawigacja.wrocNaStart')}</a>
          </section>
        )}
      </main>
      <footer className="stopka">
        <span>
          {t('aplikacja.nazwa')} · {t('start.wersja', { wersja })}
        </span>
        <span>{t('start.stopkaPrzegladarka')}</span>
        <span className="rozpychacz" />
        <a href={ADRES_LICENCJI} target="_blank" rel="noopener">
          {t('start.licencje')}
        </a>
        <a href={ADRES_REPOZYTORIUM} target="_blank" rel="noopener">
          {t('start.kodZrodlowy')}
        </a>
      </footer>
    </div>
  );
}
