import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';
import { JEZYKI, t, ustawJezyk, type Jezyk } from '../i18n';
import { useJezyk } from '../i18n/react';
import { useMotyw } from './motyw';

// Okna zasobów ładowane leniwie, żeby start strony nie ciągnął fontkita ani katalogu Google Fonts.
const OknoCzcionek = lazy(() => import('./OknaZasobow').then((m) => ({ default: m.OknoCzcionek })));
const OknoObrazow = lazy(() => import('./OknaZasobow').then((m) => ({ default: m.OknoObrazow })));

/**
 * Adres strony instrukcji względem strony aplikacji (druga strona wejściowa Vite, `instrukcja/index.html`;
 * względny adres działa pod ścieżką bazową Pages, w dev i w podglądzie).
 */
export const ADRES_INSTRUKCJI = 'instrukcja/';

/** Adres instrukcji w języku aplikacji (`?lang=` ma pierwszeństwo przed zapamiętanym wyborem). */
export const adresInstrukcji = (jezyk: Jezyk): string => `${ADRES_INSTRUKCJI}?lang=${jezyk}`;

function IkonaSlonca() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function IkonaKsiezyca() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z" />
    </svg>
  );
}

/**
 * Rozwijane menu „⚙ Ustawienia ▾” na końcu paska górnego: motyw jasny/ciemny, język PL/EN,
 * wgrywanie czcionek, wgrywanie obrazów oraz link do instrukcji.
 */
export function NarzedziaPaska() {
  const { motyw, ustaw } = useMotyw();
  const aktywny = useJezyk();
  const [otwarte, ustawOtwarte] = useState(false);
  const [okno, ustawOkno] = useState<'czcionki' | 'obrazy'>();
  const opakowanie = useRef<HTMLDivElement>(null);
  const przycisk = useRef<HTMLButtonElement>(null);
  const idPanelu = useId();

  useEffect(() => {
    if (!otwarte) return;
    const klikPoza = (e: MouseEvent) => {
      if (opakowanie.current && !opakowanie.current.contains(e.target as Node)) {
        ustawOtwarte(false);
      }
    };
    const klawisz = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        ustawOtwarte(false);
        przycisk.current?.focus();
      }
    };
    document.addEventListener('mousedown', klikPoza);
    window.addEventListener('keydown', klawisz, true);
    return () => {
      document.removeEventListener('mousedown', klikPoza);
      window.removeEventListener('keydown', klawisz, true);
    };
  }, [otwarte]);

  const zamknijOkno = useCallback(() => {
    ustawOkno(undefined);
    przycisk.current?.focus();
  }, []);

  return (
    <div className="narzedzia-paska" role="group" aria-label={t('pasek.narzedzia')}>
      <div
        className="menu-ustawien"
        ref={opakowanie}
        onBlur={(e) => {
          if (
            otwarte &&
            e.relatedTarget &&
            opakowanie.current &&
            !opakowanie.current.contains(e.relatedTarget as Node)
          ) {
            ustawOtwarte(false);
          }
        }}
      >
        <button
          ref={przycisk}
          type="button"
          className="przycisk-kontur przycisk-menu-ustawien"
          aria-haspopup="true"
          aria-expanded={otwarte}
          aria-controls={otwarte ? idPanelu : undefined}
          onClick={() => ustawOtwarte((v) => !v)}
        >
          <span aria-hidden="true">⚙</span>
          <span>{t('pasek.ustawienia')}</span>
          <span aria-hidden="true">▾</span>
        </button>
        {otwarte && (
          <div id={idPanelu} className="menu-ustawien-panel">
            <div className="menu-ustawien-wiersz">
              <span className="menu-ustawien-etykieta">{t('motyw.grupa')}</span>
              <div className="menu-ustawien-seg" role="group" aria-label={t('motyw.grupa')}>
                <button
                  type="button"
                  aria-label={t('motyw.jasny')}
                  title={t('motyw.jasny')}
                  aria-pressed={motyw === 'light'}
                  onClick={() => ustaw('light')}
                >
                  <IkonaSlonca />
                  <span>{t('motyw.jasnyKrotki')}</span>
                </button>
                <button
                  type="button"
                  aria-label={t('motyw.ciemny')}
                  title={t('motyw.ciemny')}
                  aria-pressed={motyw === 'dark'}
                  onClick={() => ustaw('dark')}
                >
                  <IkonaKsiezyca />
                  <span>{t('motyw.ciemnyKrotki')}</span>
                </button>
              </div>
            </div>
            <div className="menu-ustawien-wiersz">
              <span className="menu-ustawien-etykieta">{t('jezyk.grupa')}</span>
              <div className="menu-ustawien-seg" role="group" aria-label={t('jezyk.grupa')}>
                {JEZYKI.map((j) => (
                  <button
                    key={j}
                    type="button"
                    lang={j}
                    aria-pressed={aktywny === j}
                    title={t(`jezyk.${j}Opis`)}
                    onClick={() => ustawJezyk(j)}
                  >
                    {t(`jezyk.${j}`)}
                  </button>
                ))}
              </div>
            </div>
            <hr className="menu-ustawien-podzial" />
            <button
              type="button"
              className="menu-ustawien-pozycja"
              onClick={() => {
                ustawOtwarte(false);
                ustawOkno('czcionki');
              }}
            >
              {t('pasek.wgrajCzcionki')}
            </button>
            <button
              type="button"
              className="menu-ustawien-pozycja"
              onClick={() => {
                ustawOtwarte(false);
                ustawOkno('obrazy');
              }}
            >
              {t('pasek.wgrajObrazy')}
            </button>
            <hr className="menu-ustawien-podzial" />
            <a
              className="menu-ustawien-pozycja"
              href={adresInstrukcji(aktywny)}
              target="_blank"
              rel="noopener"
              title={t('pasek.instrukcjaOpis')}
              onClick={() => ustawOtwarte(false)}
            >
              {t('pasek.instrukcja')}
              <span className="tylko-czytnik">{t('pasek.noweOkno')}</span>
            </a>
          </div>
        )}
      </div>
      {okno && (
        <Suspense fallback={null}>
          {okno === 'czcionki' ? (
            <OknoCzcionek zamknij={zamknijOkno} />
          ) : (
            <OknoObrazow zamknij={zamknijOkno} />
          )}
        </Suspense>
      )}
    </div>
  );
}

/** Pasek górny ekranów startowych: nazwa aplikacji po lewej, narzędzia po prawej. */
export function NaglowekAplikacji() {
  return (
    <header className="naglowek">
      <a href="#/" className="logo">
        {t('aplikacja.nazwa')}
      </a>
      <span className="odstep" />
      <NarzedziaPaska />
    </header>
  );
}
