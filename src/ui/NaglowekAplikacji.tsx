import { JEZYKI, t, ustawJezyk, type Jezyk } from '../i18n';
import { useJezyk } from '../i18n/react';
import { useMotyw } from './motyw';

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
 * Grupa narzędzi na końcu paska górnego: Instrukcja, język PL | EN, motyw jasny | ciemny.
 * Język przełącza się od razu (bez przeładowania) i jest zapamiętany w localStorage.
 */
export function NarzedziaPaska() {
  const { motyw, ustaw } = useMotyw();
  const aktywny = useJezyk();
  return (
    <div className="narzedzia-paska" role="group" aria-label={t('pasek.narzedzia')}>
      <a
        className="przycisk-kontur"
        href={adresInstrukcji(aktywny)}
        target="_blank"
        rel="noopener"
        title={t('pasek.instrukcjaOpis')}
      >
        {t('pasek.instrukcja')}
        <span className="tylko-czytnik">{t('pasek.noweOkno')}</span>
      </a>
      <div className="seg" role="group" aria-label={t('jezyk.grupa')}>
        {/* Nazwy języków są w obu słownikach takie same (każdy język nazwany po swojemu); `lang` na przycisku ustawia wymowę czytnika. */}
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
