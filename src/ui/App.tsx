import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react';
import { t } from '../i18n';
import { useJezyk } from '../i18n/react';
import { GranicaBledu } from './GranicaBledu';
import { useTrasa } from './useTrasa';
import { NaglowekAplikacji } from './NaglowekAplikacji';
import './tokeny.css';
import './App.css';
import './edytory.css';

// Strony ładowane leniwie: silnik (fontkit) i pakiet dopiero przy kartce; PDF – przy pobraniu.
const Start = lazy(() => import('./start/Start').then((m) => ({ default: m.Start })));
const WyborGry = lazy(() => import('./start/WyborGry').then((m) => ({ default: m.WyborGry })));
const WlasneKarty = lazy(() =>
  import('./start/WlasneKarty').then((m) => ({ default: m.WlasneKarty })),
);
const WybierzStroneSzablonu = lazy(() =>
  import('./start/WybierzStroneSzablonu').then((m) => ({ default: m.WybierzStroneSzablonu })),
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
  const tresc = useRef<HTMLElement>(null);
  const poprzedniaTrasa = useRef(trasa);
  useEffect(() => {
    if (poprzedniaTrasa.current === trasa) return;
    poprzedniaTrasa.current = trasa;
    const obszar = tresc.current;
    if (!obszar) return;
    const poczatkowyFokus = document.activeElement;
    const przeniesFokus = () => {
      // Suspense może ukryć poprzedni widok, nadal trzymając jego nagłówek w DOM.
      const naglowek = Array.from(obszar.querySelectorAll<HTMLElement>('h1, [role=alert]')).find(
        (el) => el.getClientRects().length > 0,
      );
      if (!naglowek) return false;
      if (document.activeElement === poczatkowyFokus || document.activeElement === document.body) {
        naglowek.setAttribute('tabindex', '-1');
        naglowek.focus({ preventScroll: true });
        return document.activeElement === naglowek;
      }
      return true;
    };
    if (przeniesFokus()) return;
    // Leniwa trasa lub projekt może jeszcze czekać na dane.
    const obserwator = new MutationObserver(() => {
      if (przeniesFokus()) obserwator.disconnect();
    });
    obserwator.observe(obszar, {
      childList: true,
      subtree: true,
      attributeFilter: ['style', 'hidden'],
    });
    return () => obserwator.disconnect();
  }, [trasa]);

  const pominPasek = (
    <a
      className="pomin-pasek"
      href="#tresc-aplikacji"
      onClick={(e) => {
        e.preventDefault();
        const cel = tresc.current?.querySelector('h1') ?? tresc.current;
        if (cel) {
          cel.setAttribute('tabindex', '-1');
          cel.focus();
        }
      }}
    >
      {t('instrukcja.doTresci')}
    </a>
  );
  const dopasowanie = /^\/projekt\/([^/]+)(?:\/(.*))?$/.exec(trasa);
  const projekt = dopasowanie?.[1];
  const podtrasa = dopasowanie?.[2] ?? '';
  const gra = /^\/gra\/([^/]+)$/.exec(trasa)?.[1];
  // Dawne trasy (lista projektów, arkusze pakietu) – teraz wszystko jest na starcie.
  const dawna = trasa === '/projekty' || trasa === '/arkusze';
  useEffect(() => {
    if (dawna) window.location.replace('#/');
  }, [dawna]);

  // Ekrany z lewym menu (start, gra, własne karty, kreator, AI) mają szeroką treść z jedną linią menu.
  // `/wlasne/ai` – dawny ekran „Układ ze zdjęcia” (teraz w edytorze szablonu).
  const wlasne = trasa === '/wlasne' || trasa === '/gry/inne' || trasa === '/wlasne/ai';
  const szerokaTresc =
    trasa === '/' ||
    dawna ||
    !!gra ||
    wlasne ||
    trasa === '/wlasne/nowy' ||
    trasa === '/wlasne/nowy/awers';

  if (projekt) {
    // Edytor kartki zajmuje cały ekran (własny pasek górny).
    return (
      <div className="aplikacja">
        {pominPasek}
        <main ref={tresc} id="tresc-aplikacji" tabIndex={-1}>
          <Leniwa>
            <EdytorStrona key={projekt} id={decodeURIComponent(projekt)} podtrasa={podtrasa} />
          </Leniwa>
        </main>
      </div>
    );
  }

  return (
    <div className="aplikacja">
      {pominPasek}
      <NaglowekAplikacji />
      <main
        ref={tresc}
        id="tresc-aplikacji"
        tabIndex={-1}
        className={szerokaTresc ? 'tresc tresc-start' : 'tresc'}
      >
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
            <WybierzStroneSzablonu />
          </Leniwa>
        ) : trasa === '/wlasne/nowy/awers' ? (
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
