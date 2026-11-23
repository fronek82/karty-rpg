import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent as MouseEventReact,
} from 'react';
import { JEZYKI, t, ustawJezyk, type Jezyk } from '../i18n';
import { useJezyk } from '../i18n/react';
import { useMotyw } from './motyw';
import { useTrasa } from './useTrasa';

const OknoKolorow = lazy(() => import('./OknoKolorow').then((m) => ({ default: m.OknoKolorow })));

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

/** Adres ekranu „Biblioteki” (obrazy, czcionki i ozdobniki w przeglądarce). */
export const ADRES_BIBLIOTEK = '#/biblioteki';

/**
 * Narzędzia na końcu paska górnego: link „Biblioteki” i rozwijane menu „⚙ Ustawienia ▾”
 * (tylko konfiguracja: motyw jasny/ciemny, język PL/EN, kolory przycisków) z linkiem do instrukcji.
 * `sprawdzWyjscie` – straż niezapisanych zmian w edytorach z zapisem ręcznym.
 */
export function NarzedziaPaska({
  sprawdzWyjscie,
}: {
  sprawdzWyjscie?: (e: MouseEventReact, adres: string) => void;
} = {}) {
  const { motyw, ustaw } = useMotyw();
  const aktywny = useJezyk();
  const trasa = useTrasa();
  const [otwarte, ustawOtwarte] = useState(false);
  const [okno, ustawOkno] = useState<'kolory'>();
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
      <a
        className="przycisk-kontur przycisk-biblioteki"
        href={ADRES_BIBLIOTEK}
        aria-current={trasa.startsWith('/biblioteki') ? 'page' : undefined}
        onClick={(e) => sprawdzWyjscie?.(e, ADRES_BIBLIOTEK)}
      >
        {t('biblioteki.tytul')}
      </a>
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
                ustawOkno('kolory');
              }}
            >
              {t('pasek.koloryPrzyciskow')}
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
          <OknoKolorow zamknij={zamknijOkno} />
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
