import { lazy, Suspense, type ReactNode } from 'react';
import { t } from '../i18n';
import { GranicaBledu } from './GranicaBledu';
import { useTrasa } from './useTrasa';
import './App.css';

// Silnik (fontkit) i pakiet ładowane dopiero na stronie arkuszy; PDF (pdf-lib) – przy pobraniu.
const Arkusze = lazy(() => import('./Arkusze').then((m) => ({ default: m.Arkusze })));
const Projekty = lazy(() => import('./Projekty').then((m) => ({ default: m.Projekty })));
const ProjektStrona = lazy(() =>
  import('./ProjektStrona').then((m) => ({ default: m.ProjektStrona })),
);

/** Strona ładowana leniwie, z granicą błędu. */
function Leniwa({ children }: { children: ReactNode }) {
  return (
    <GranicaBledu>
      <Suspense fallback={<p>{t('aplikacja.wczytywanieStrony')}</p>}>{children}</Suspense>
    </GranicaBledu>
  );
}

const wersja = import.meta.env.VITE_WERSJA ?? '0.1.0';

export function App() {
  const trasa = useTrasa();
  const dopasowanie = /^\/projekt\/([^/]+)(?:\/([^/]+))?$/.exec(trasa);
  const trasaProjektu = dopasowanie?.[1]
    ? { id: decodeURIComponent(dopasowanie[1]), podstrona: dopasowanie[2] }
    : undefined;

  return (
    <div className="aplikacja">
      <header className="naglowek">
        <a href="#/" className="logo">
          {t('aplikacja.nazwa')}
        </a>
        <nav>
          <a href="#/projekty">{t('nawigacja.projekty')}</a>
          <a href="#/arkusze">{t('nawigacja.arkusze')}</a>
        </nav>
      </header>
      <main className="tresc">
        {trasa === '/' ? (
          <section>
            <h1>{t('aplikacja.nazwa')}</h1>
            <p>{t('aplikacja.opis')}</p>
            <p className="uwaga">{t('start.wkrotce')}</p>
            <p>
              <a href="#/projekty">{t('start.projekty')}</a>
            </p>
            <p>
              <a href="#/arkusze">{t('start.arkusze')}</a>
            </p>
          </section>
        ) : trasa === '/arkusze' ? (
          <Leniwa>
            <Arkusze />
          </Leniwa>
        ) : trasa === '/projekty' ? (
          <Leniwa>
            <Projekty />
          </Leniwa>
        ) : trasaProjektu ? (
          <Leniwa>
            <ProjektStrona key={trasaProjektu.id} {...trasaProjektu} />
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
