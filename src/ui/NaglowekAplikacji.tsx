import { t } from '../i18n';
import { useMotyw } from './motyw';

/** Adres instrukcji względem strony aplikacji (strona powstanie w etapie UI-6). */
export const ADRES_INSTRUKCJI = 'instrukcja/';

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
 * Grupa narzędzi na końcu paska górnego: Instrukcja, język PL | EN, motyw jasny | ciemny.
 * Język jest na razie atrapą z jednym aktywnym PL (działanie – etap UI-2).
 */
export function NarzedziaPaska() {
  const { motyw, ustaw } = useMotyw();
  return (
    <div className="narzedzia-paska" role="group" aria-label={t('pasek.narzedzia')}>
      <a
        className="przycisk-kontur"
        href={ADRES_INSTRUKCJI}
        target="_blank"
        rel="noopener"
        title={t('pasek.instrukcjaOpis')}
      >
        {t('pasek.instrukcja')}
        <span className="tylko-czytnik">{t('pasek.noweOkno')}</span>
      </a>
      <div className="seg" role="group" aria-label={t('jezyk.grupa')}>
        <button type="button" aria-pressed="true" title={t('jezyk.plOpis')}>
          {t('jezyk.pl')}
        </button>
        <button type="button" aria-pressed="false" disabled title={t('jezyk.enOpis')}>
          {t('jezyk.en')}
        </button>
      </div>
      <div className="seg" role="group" aria-label={t('motyw.grupa')}>
        <button
          type="button"
          aria-label={t('motyw.jasny')}
          title={t('motyw.jasny')}
          aria-pressed={motyw === 'light'}
          onClick={() => ustaw('light')}
        >
          <IkonaSlonca />
        </button>
        <button
          type="button"
          aria-label={t('motyw.ciemny')}
          title={t('motyw.ciemny')}
          aria-pressed={motyw === 'dark'}
          onClick={() => ustaw('dark')}
        >
          <IkonaKsiezyca />
        </button>
      </div>
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
