import { useState } from 'react';
import {
  duplikujRewersWProjekcie,
  nowyRewers,
  przypisaniaRewersu,
  usunRewers,
} from '../../dane/rewers';
import { formatujLiczbe, t } from '../../i18n';
import {
  dolaczRewersGlobalnyDoProjektu,
  useRewersyGlobalne,
  type ZapisanyRewersGlobalny,
} from '../rewersyGlobalne';
import type { ProjektWEdycji } from '../useProjekt';

/**
 * Sekcja „Rewersy” w opcjach druku i arkusza: tworzenie, otwieranie edytora, duplikowanie,
 * usuwanie oraz dodawanie rewersów zaprojektowanych w innych projektach (biblioteka globalna).
 */
export function RewersyProjektu({ edycja }: { edycja: ProjektWEdycji }) {
  const { projekt, zmien } = edycja;
  const rewersy = projekt.rewersy ?? [];
  const { rewersyGlobalne, usunGlobalny } = useRewersyGlobalne(projekt);
  const [doUsuniecia, ustawDoUsuniecia] = useState<string | undefined>();
  const [komunikat, ustawKomunikat] = useState('');
  const [trwa, ustawTrwa] = useState(false);
  const idProjektu = encodeURIComponent(projekt.id);

  const utworz = () => {
    let noweId = '';
    zmien((p) => {
      const w = nowyRewers(p, {
        nazwa: t('rewersy.nowy'),
        nazwaKorzenia: t('rewers.tytulEdytora'),
      });
      noweId = w.id;
      return w.projekt;
    });
    if (noweId) {
      window.location.hash = `#/projekt/${idProjektu}/rewers/${encodeURIComponent(noweId)}`;
    }
  };

  const dodajGlobalny = async (wpis: ZapisanyRewersGlobalny) => {
    ustawTrwa(true);
    ustawKomunikat('');
    try {
      await dolaczRewersGlobalnyDoProjektu(wpis, edycja);
      ustawKomunikat(t('rewersy.dodanoZGlobalnych', { nazwa: wpis.nazwa }));
    } catch (e) {
      ustawKomunikat(e instanceof Error ? e.message : String(e));
    } finally {
      ustawTrwa(false);
    }
  };

  return (
    <fieldset className="sekcja-szablonow">
      <legend>{t('rewersy.tytul')}</legend>
      {rewersy.length === 0 && <p className="podpis">{t('rewersy.brak')}</p>}
      <ul className="lista-szablonow">
        {rewersy.map((r) => {
          const przyp = przypisaniaRewersu(projekt, r.id);
          const potwierdz = doUsuniecia === r.id;
          return (
            <li key={r.id}>
              <span>
                <strong>{r.nazwa}</strong>{' '}
                <span className="podpis">
                  {formatujLiczbe(r.rozmiar.szerokosc)}×{formatujLiczbe(r.rozmiar.wysokosc)} mm
                </span>
              </span>
              <span className="akcje-szablonu">
                <a
                  className="przycisk"
                  href={`#/projekt/${idProjektu}/rewers/${encodeURIComponent(r.id)}`}
                  aria-label={t('rewersy.edytujEtykieta', { nazwa: r.nazwa })}
                >
                  {t('rewersy.edytuj')}
                </a>
                <button
                  type="button"
                  aria-label={t('rewersy.duplikujEtykieta', { nazwa: r.nazwa })}
                  onClick={() =>
                    zmien(
                      (p) =>
                        duplikujRewersWProjekcie(p, r.id, (n) =>
                          n === 1 ? t('szablon.kopia') : t('szablon.kopiaNumer', { n }),
                        ).projekt,
                    )
                  }
                >
                  {t('szablony.duplikuj')}
                </button>
                <button
                  type="button"
                  className="niebezpieczny"
                  aria-label={t('rewersy.usunEtykieta', { nazwa: r.nazwa })}
                  onClick={() => ustawDoUsuniecia(r.id)}
                >
                  {t('rewersy.usun')}
                </button>
              </span>
              {potwierdz && (
                <div className="potwierdzenie-usuniecia" role="alertdialog" aria-label={r.nazwa}>
                  <p className="podpis">
                    {przyp.razem > 0
                      ? t('rewersy.potwierdzUsuniecie', { nazwa: r.nazwa, liczba: przyp.razem })
                      : t('rewersy.potwierdzUsuniecieBrak', { nazwa: r.nazwa })}
                  </p>
                  <div className="wiersz-przyciskow">
                    <button
                      type="button"
                      className="niebezpieczny maly"
                      onClick={() => {
                        zmien((p) => usunRewers(p, r.id));
                        ustawDoUsuniecia(undefined);
                      }}
                    >
                      {t('rewersy.potwierdzTak')}
                    </button>
                    <button
                      type="button"
                      className="maly"
                      onClick={() => ustawDoUsuniecia(undefined)}
                    >
                      {t('rewersy.anuluj')}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" onClick={utworz}>
        {t('rewersy.nowy')}
      </button>
      {komunikat && (
        <p role="status" className="podpis">
          {komunikat}
        </p>
      )}
      {rewersyGlobalne.length > 0 && (
        <div className="sekcja-rewersow-globalnych">
          <p className="podpis">{t('rewersy.globalneTytul')}</p>
          <ul className="lista-szablonow">
            {rewersyGlobalne.map((w) => (
              <li key={w.klucz}>
                <span>
                  <strong>{w.nazwa}</strong>
                </span>
                <span className="akcje-szablonu">
                  <button type="button" disabled={trwa} onClick={() => void dodajGlobalny(w)}>
                    {t('rewersy.dodajDoProjektu')}
                  </button>
                  {w.zrodlo === 'biblioteka' && (
                    <button
                      type="button"
                      className="niebezpieczny"
                      disabled={trwa}
                      aria-label={t('rewersy.usunGlobalnyEtykieta', { nazwa: w.nazwa })}
                      onClick={() => void usunGlobalny(w).catch(() => undefined)}
                    >
                      {t('rewersy.usun')}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </fieldset>
  );
}
