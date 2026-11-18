import { useCallback, useEffect, useRef, useState } from 'react';
import { eksportujProjekt, ROZSZERZENIE_PROJEKTU } from '../../dane/archiwum';
import type { PodsumowanieProjektu } from '../../dane/baza';
import { BladDanych } from '../../dane/schemat';
import { formatujDate, t } from '../../i18n';
import { baza } from '../baza';
import { nazwaPliku, zapiszPlik } from '../pliki';
import { poOstatnimZapisie } from '../useProjekt';

const komunikat = (e: unknown) =>
  e instanceof BladDanych
    ? e.message
    : t('projekty.bladNieoczekiwany', { szczegoly: String(e instanceof Error ? e.message : e) });

/**
 * „Moje projekty”: kafelki z miniaturą pierwszej strony; eksport i usuwanie (import jest w
 * `PanelImportu`). Zmiana `odswiezenie` wczytuje listę ponownie.
 */
export function ListaProjektow({ odswiezenie = 0 }: { odswiezenie?: number }) {
  const [lista, ustawListe] = useState<PodsumowanieProjektu[]>();
  const [miniatury, ustawMiniatury] = useState<Map<string, string>>(new Map());
  const [blad, ustawBlad] = useState<string>();
  const [status, ustawStatus] = useState('');
  const [trwa, ustawTrwa] = useState(false);
  const [doUsuniecia, ustawDoUsuniecia] = useState<PodsumowanieProjektu>();

  // Numer odczytu: wynik starszego, wolniejszego odczytu nie nadpisuje nowszego.
  const odczyt = useRef(0);

  const odswiez = useCallback(() => {
    const numer = ++odczyt.current;
    // Zapis zamkniętego właśnie projektu jest asynchroniczny – lista czeka na niego.
    poOstatnimZapisie()
      .then(() => Promise.all([baza().lista(), baza().miniatury()]))
      .then(
        ([l, m]) => {
          if (numer !== odczyt.current) return;
          ustawListe(l);
          ustawMiniatury(m);
        },
        (e: unknown) => ustawBlad(komunikat(e)),
      );
  }, []);
  useEffect(odswiez, [odswiez, odswiezenie]);

  const wykonaj = async (zadanie: () => Promise<string | void>) => {
    ustawTrwa(true);
    ustawBlad(undefined);
    try {
      const wynik = await zadanie();
      if (wynik) ustawStatus(wynik);
      odswiez();
    } catch (e) {
      ustawBlad(komunikat(e));
    } finally {
      ustawTrwa(false);
    }
  };

  const eksportuj = (p: PodsumowanieProjektu) =>
    wykonaj(async () => {
      const { projekt, zasoby } = await baza().wczytaj(p.id);
      zapiszPlik(
        eksportujProjekt(projekt, zasoby),
        'application/zip',
        nazwaPliku(projekt.nazwa, ROZSZERZENIE_PROJEKTU),
      );
      return t('projekty.wyeksportowano', { nazwa: projekt.nazwa });
    });

  return (
    <section className="lista-projektow" aria-labelledby="moje-projekty">
      <div className="naglowek-sekcji">
        <h2 id="moje-projekty">{t('start.mojeProjekty')}</h2>
        <p role="status" aria-live="polite" className="status">
          {trwa ? t('projekty.trwa') : status}
        </p>
      </div>
      {blad && (
        <p role="alert" className="uwaga">
          {blad}
        </p>
      )}
      {doUsuniecia && (
        <div
          role="alertdialog"
          aria-labelledby="usun-tytul"
          className="uwaga"
          onKeyDown={(e) => e.key === 'Escape' && ustawDoUsuniecia(undefined)}
        >
          <p id="usun-tytul">{t('projekty.potwierdzUsuniecie', { nazwa: doUsuniecia.nazwa })}</p>
          <button
            type="button"
            onClick={() =>
              void wykonaj(async () => {
                ustawDoUsuniecia(undefined);
                await baza().usun(doUsuniecia.id);
                return t('projekty.usunieto', { nazwa: doUsuniecia.nazwa });
              })
            }
          >
            {t('projekty.usun')}
          </button>{' '}
          <button type="button" autoFocus onClick={() => ustawDoUsuniecia(undefined)}>
            {t('projekty.anuluj')}
          </button>
        </div>
      )}
      {lista === undefined ? (
        <p>{t('projekty.wczytywanie')}</p>
      ) : lista.length === 0 ? (
        <p className="podpis">
          {t('projekty.brak')} {t('start.pustaPodpowiedz')}
        </p>
      ) : (
        <ul className="kafelki-projektow">
          {lista.map((p) => (
            <li key={p.id} className="kafelek-projektu">
              <a
                href={`#/projekt/${encodeURIComponent(p.id)}`}
                className="miniatura"
                aria-hidden="true"
                tabIndex={-1}
              >
                {miniatury.get(p.id) ? (
                  // Jako obrazek: identyfikatory glifów w SVG różnych miniatur się nie mieszają.
                  <img
                    alt=""
                    src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(miniatury.get(p.id)!)}`}
                  />
                ) : (
                  <span className="bez-miniatury">🂠</span>
                )}
              </a>
              <div className="opis-projektu">
                <a href={`#/projekt/${encodeURIComponent(p.id)}`} className="nazwa">
                  {p.nazwa}
                </a>
                <span className="podpis">
                  {t('start.podsumowanie', { strony: p.liczbaStron, karty: p.liczbaKart })} ·{' '}
                  {t('projekty.zmieniono', { data: formatujDate(p.zmieniono) })}
                </span>
                <span className="akcje">
                  <a className="przycisk glowny" href={`#/projekt/${encodeURIComponent(p.id)}`}>
                    {t('start.otworz')}
                  </a>
                  <button type="button" disabled={trwa} onClick={() => void eksportuj(p)}>
                    {t('projekty.eksportuj')}
                  </button>
                  <button
                    type="button"
                    disabled={trwa}
                    aria-label={t('start.usunProjekt', { nazwa: p.nazwa })}
                    onClick={() => ustawDoUsuniecia(p)}
                  >
                    {t('projekty.usun')}
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
