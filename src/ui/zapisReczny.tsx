import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { t } from '../i18n';
import { OknoModalne } from './OknoModalne';
import { tekstZapisu, type ProjektWEdycji } from './useProjekt';
import { ustawStrazTrasy } from './useTrasa';

/**
 * Zapis ręczny w edytorach projektu (Edytor kart, Edytor szablonu i rewersu): przycisk „Zapisz”
 * ze stanem zapisu, skrót Ctrl+S / Cmd+S i okno „Niezapisane zmiany” przy wyjściu z projektu
 * (linkiem w aplikacji albo przyciskiem „Wstecz” / „Dalej” przeglądarki).
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

/** Czy adres (`#/…`) prowadzi do projektu `wProjekcie` (`#/projekt/<id>`) albo jego podstrony. */
const wProjekcieAdres = (adres: string, wProjekcie: string) =>
  adres === wProjekcie || adres.startsWith(`${wProjekcie}/`);

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
    if (wProjekcieAdres(adres, wProjekcie)) return;
    e.preventDefault();
    ustawCel(adres);
  };

  // „Wstecz” / „Dalej” przeglądarki (albo gest gładzika) zmienia sam adres – bez kliknięcia linku.
  // Straż trasy działa przed zmianą widoku: przy niezapisanych zmianach przywraca bieżący adres
  // (`pushState` nie wywołuje kolejnego `hashchange`) i pokazuje to samo okno co przy linku.
  const { niezapisane } = edycja;
  /**
   * Adres przejścia zatwierdzonego w oknie – przepuszczany raz. Zerowany przy każdej zmianie adresu,
   * więc nie przepuści później innego przejścia (np. gdy zatwierdzone nie wywołało `hashchange`).
   */
  const zatwierdzony = useRef<string>(undefined);
  useEffect(
    () =>
      ustawStrazTrasy((e) => {
        const nowy = new URL(e.newURL).hash || '#/';
        const przepusc = zatwierdzony.current === nowy;
        zatwierdzony.current = undefined;
        if (przepusc || !niezapisane) return false;
        if (wProjekcieAdres(nowy, wProjekcie)) return false;
        // Wpis, do którego prowadził „Wstecz”, zostaje w historii – adres edytora wraca jako nowy
        // wpis, więc kolejne „Wstecz” znów zapyta o zapis.
        window.history.pushState(null, '', e.oldURL);
        ustawCel(nowy);
        return true;
      }),
    [niezapisane, wProjekcie],
  );
  const przejdz = (adres: string) => {
    ustawCel(undefined);
    // Ten sam zapis co w `e.newURL` (kodowanie znaków przez przeglądarkę).
    zatwierdzony.current = new URL(adres, window.location.href).hash;
    window.location.hash = adres;
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
              .then(() => przejdz(cel))
              .catch(() => ustawCel(undefined));
          }}
        >
          {t('projekt.zapiszIWyjdz')}
        </button>
        <button type="button" className="niebezpieczny" onClick={() => przejdz(cel)}>
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
