import { Component, type ReactNode } from 'react';
import { t } from '../i18n';

/**
 * Błąd w części strony (np. nieudane wczytanie kodu po nowym wdrożeniu) pokazuje komunikat
 * zamiast pustego ekranu; nagłówek i stopka aplikacji zostają.
 */
export class GranicaBledu extends Component<{ children: ReactNode }, { blad?: string }> {
  override state: { blad?: string } = {};

  static getDerivedStateFromError(e: unknown) {
    return { blad: e instanceof Error ? e.message : String(e) };
  }

  override render() {
    if (this.state.blad === undefined) return this.props.children;
    return (
      <div role="alert" className="uwaga">
        <p>{t('aplikacja.blad')}</p>
        <details>
          <summary>{t('arkusze.szczegoly')}</summary>
          <code>{this.state.blad}</code>
        </details>
        <button type="button" onClick={() => window.location.reload()}>
          {t('aplikacja.przeladuj')}
        </button>
      </div>
    );
  }
}
