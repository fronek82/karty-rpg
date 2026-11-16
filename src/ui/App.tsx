import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { t } from '../i18n';
import { GranicaBledu } from './GranicaBledu';
import { useTrasa } from './useTrasa';
import './App.css';

// Strony ładowane leniwie: silnik (fontkit) i pakiet dopiero przy kartce; PDF – przy pobraniu.
const Start = lazy(() => import('./start/Start').then((m) => ({ default: m.Start })));
const WyborGry = lazy(() => import('./start/WyborGry').then((m) => ({ default: m.WyborGry })));
const InneGry = lazy(() => import('./start/InneGry').then((m) => ({ default: m.InneGry })));
const EdytorStrona = lazy(() =>
  import('./EdytorStrona').then((m) => ({ default: m.EdytorStrona })),
);

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
  const trasa = useTrasa();
  const projekt = /^\/projekt\/([^/]+)/.exec(trasa)?.[1];
  const gra = /^\/gra\/([^/]+)$/.exec(trasa)?.[1];
  // Dawne trasy (lista projektów, arkusze pakietu) – teraz wszystko jest na starcie.
  const dawna = trasa === '/projekty' || trasa === '/arkusze';
  useEffect(() => {
    if (dawna) window.location.replace('#/');
  }, [dawna]);

  if (projekt) {
    // Edytor kartki zajmuje cały ekran (własny pasek górny).
    return (
      <div className="aplikacja">
        <Leniwa>
          <EdytorStrona key={projekt} id={decodeURIComponent(projekt)} />
        </Leniwa>
      </div>
    );
  }

  return (
    <div className="aplikacja">
      <header className="naglowek">
        <a href="#/" className="logo">
          {t('aplikacja.nazwa')}
        </a>
      </header>
      <main className="tresc">
        {trasa === '/' || dawna ? (
          <Leniwa>
            <Start />
          </Leniwa>
        ) : gra ? (
          <Leniwa>
            <WyborGry id={decodeURIComponent(gra)} />
          </Leniwa>
        ) : trasa === '/gry/inne' ? (
          <Leniwa>
            <InneGry />
          </Leniwa>
        ) : (
          <section>
            <h1>{t('nawigacja.nieZnaleziono')}</h1>
            <a href="#/">{t('nawigacja.wrocNaStart')}</a>
          </section>
        )}
      </main>
      <footer className="stopka">{t('start.wersja', { wersja })}</footer>
    </div>
  );
}
