import { t } from '../i18n';
import { useTrasa } from './useTrasa';
import './App.css';

const wersja = import.meta.env.VITE_WERSJA ?? '0.1.0';

export function App() {
  const trasa = useTrasa();

  return (
    <div className="aplikacja">
      <header className="naglowek">
        <a href="#/" className="logo">
          {t('aplikacja.nazwa')}
        </a>
      </header>
      <main className="tresc">
        {trasa === '/' ? (
          <section>
            <h1>{t('aplikacja.nazwa')}</h1>
            <p>{t('aplikacja.opis')}</p>
            <p className="uwaga">{t('start.wkrotce')}</p>
          </section>
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
