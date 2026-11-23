import { useEffect, useState, type MouseEvent } from 'react';
import { t } from '../i18n';
import { OknoModalne } from './OknoModalne';
import { tekstZapisu, type ProjektWEdycji } from './useProjekt';

/**
 * Zapis ręczny w edytorach projektu (Edytor kart, Edytor szablonu i rewersu): przycisk „Zapisz”
 * ze stanem zapisu, skrót Ctrl+S / Cmd+S i okno „Niezapisane zmiany” przy wyjściu z projektu.
 */

/** Ctrl+S / Cmd+S zapisuje projekt (zamiast zapisu strony przez przeglądarkę). */
export function useSkrotZapisu(zapiszTeraz: () => Promise<void>) {
  useEffect(() => {
    const naZapis = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void zapiszTeraz().catch(() => undefined);
      }
    };
    window.addEventListener('keydown', naZapis);
    return () => window.removeEventListener('keydown', naZapis);
  }, [zapiszTeraz]);
}

/** Przycisk „Zapisz” (wyróżniony, gdy są niezapisane zmiany) i komunikat stanu zapisu. */
export function PrzyciskZapisu({ edycja }: { edycja: ProjektWEdycji }) {
  return (
    <>
      <button
        type="button"
        className={edycja.niezapisane ? 'glowny przycisk-zapisz' : 'przycisk-zapisz'}
        disabled={!edycja.niezapisane || edycja.zapis.stan === 'zapisywanie'}
        title={t('projekt.zapiszPodpowiedz')}
        onClick={() => void edycja.zapiszTeraz().catch(() => undefined)}
      >
        {t('projekt.zapisz')}
      </button>
      <span
        role="status"
        aria-live="polite"
        className={`status-zapisu ${edycja.zapis.stan === 'blad' ? 'blad' : ''}`}
      >
        {tekstZapisu(edycja.zapis)}
      </span>
    </>
  );
}

/**
 * Straż wyjścia: link poza bieżący projekt przy niezapisanych zmianach otwiera okno z wyborem
 * „Zapisz i wyjdź” / „Wyjdź bez zapisywania” / „Zostań”. Przejścia w obrębie projektu (Edytor kart,
 * szablonu, rewersu) zachowują niezapisane zmiany w pamięci.
 */
export function useStrazWyjscia(edycja: ProjektWEdycji) {
  const [cel, ustawCel] = useState<string>();
  const wProjekcie = `#/projekt/${encodeURIComponent(edycja.projekt.id)}`;
  const sprawdzWyjscie = (e: MouseEvent, adres: string) => {
    if (!edycja.niezapisane) return;
    if (adres === wProjekcie || adres.startsWith(`${wProjekcie}/`)) return;
    e.preventDefault();
    ustawCel(adres);
  };
  const okno = cel && (
    <OknoModalne tytul={t('projekt.wyjscieTytul')} zamknij={() => ustawCel(undefined)}>
      <p>{t('projekt.wyjscieOpis')}</p>
      <div className="okno-wyjscia-akcje">
        <button
          type="button"
          className="glowny"
          onClick={() => {
            void edycja
              .zapiszTeraz()
              .then(() => {
                ustawCel(undefined);
                window.location.hash = cel;
              })
              .catch(() => ustawCel(undefined));
          }}
        >
          {t('projekt.zapiszIWyjdz')}
        </button>
        <button
          type="button"
          className="niebezpieczny"
          onClick={() => {
            ustawCel(undefined);
            window.location.hash = cel;
          }}
        >
          {t('projekt.wyjdzBezZapisu')}
        </button>
        <button type="button" autoFocus onClick={() => ustawCel(undefined)}>
          {t('projekt.zostan')}
        </button>
      </div>
    </OknoModalne>
  );
  return { sprawdzWyjscie, okno };
}
