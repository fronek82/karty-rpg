import { useRef, useState } from 'react';
import { eksportujSzablon, importujSzablon, ROZSZERZENIE_SZABLONU } from '../../dane/archiwum';
import { BladDanych } from '../../dane/schemat';
import { dodajSzablonZKartka, opisRozmiaruSzablonu } from '../../dane/wlasneKarty';
import { t } from '../../i18n';
import { nazwaPliku, zapiszPlik } from '../pliki';
import type { ProjektWEdycji } from '../useProjekt';

const komunikat = (e: unknown) =>
  e instanceof BladDanych ? e.message : String(e instanceof Error ? e.message : e);

/**
 * Szablony projektu własnych kart: eksport pojedynczego szablonu do pliku, import z pliku
 * (szablon innego rozmiaru dostaje własną kartkę) i nowa kartka dla wybranego szablonu.
 */
export function SzablonyProjektu({
  edycja,
  kartkaDlaSzablonu,
}: {
  edycja: ProjektWEdycji;
  kartkaDlaSzablonu: (szablonId: string) => void;
}) {
  const { projekt } = edycja;
  const plik = useRef<HTMLInputElement>(null);
  const [status, ustawStatus] = useState('');
  const [blad, ustawBlad] = useState<string>();

  const importuj = async (f: File) => {
    ustawBlad(undefined);
    ustawStatus('');
    try {
      const paczka = importujSzablon(new Uint8Array(await f.arrayBuffer()));
      let ostrzezenia: string[] = [];
      let nazwa = '';
      let nowaKartka = false;
      await edycja.zmienZZasobami((p, d) => {
        const w = dodajSzablonZKartka(p, d, paczka);
        ostrzezenia = w.ostrzezenia;
        nowaKartka = w.nowaKartka;
        nazwa = w.projekt.szablony.find((s) => s.id === w.szablonId)?.nazwa ?? '';
        return { projekt: w.projekt, dane: w.zasoby };
      });
      ustawStatus(
        [
          t('szablony.zaimportowano', { nazwa }),
          ...(nowaKartka ? [t('szablony.dodanoKartke')] : []),
          ...ostrzezenia,
        ].join(' '),
      );
    } catch (e) {
      ustawBlad(t('szablony.bladImportu', { szczegoly: komunikat(e) }));
    }
  };

  const eksportuj = (id: string, nazwa: string) => {
    ustawBlad(undefined);
    try {
      const { bajty, ostrzezenia } = eksportujSzablon(projekt, edycja.dane, id);
      zapiszPlik(bajty, 'application/zip', nazwaPliku(nazwa, ROZSZERZENIE_SZABLONU));
      ustawStatus(ostrzezenia.join(' '));
    } catch (e) {
      ustawBlad(komunikat(e));
    }
  };

  return (
    <fieldset className="sekcja-szablonow">
      <legend>{t('szablony.tytul')}</legend>
      {projekt.szablony.length === 0 && <p className="podpis">{t('szablony.brak')}</p>}
      <ul className="lista-szablonow">
        {projekt.szablony.map((s) => (
          <li key={s.id}>
            <span>
              <strong>{s.nazwa}</strong> <span className="podpis">{opisRozmiaruSzablonu(s)}</span>
            </span>
            <span className="akcje-szablonu">
              <a
                className="przycisk"
                href={`#/projekt/${encodeURIComponent(projekt.id)}/szablon/${encodeURIComponent(s.id)}`}
                aria-label={t('szablony.edytujEtykieta', { nazwa: s.nazwa })}
              >
                {t('szablony.edytuj')}
              </a>
              <button
                type="button"
                aria-label={t('szablony.eksportujEtykieta', { nazwa: s.nazwa })}
                onClick={() => eksportuj(s.id, s.nazwa)}
              >
                {t('szablony.eksportuj')}
              </button>
              <button
                type="button"
                aria-label={t('szablony.kartkaEtykieta', { nazwa: s.nazwa })}
                onClick={() => kartkaDlaSzablonu(s.id)}
              >
                {t('szablony.kartka')}
              </button>
            </span>
          </li>
        ))}
      </ul>
      <a className="przycisk" href={`#/projekt/${encodeURIComponent(projekt.id)}/nowy-szablon`}>
        {t('szablony.nowy')}
      </a>{' '}
      <button type="button" onClick={() => plik.current?.click()}>
        {t('szablony.importuj')}
      </button>
      <input
        ref={plik}
        type="file"
        accept={`${ROZSZERZENIE_SZABLONU},.zip`}
        hidden
        data-testid="plik-szablonu"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void importuj(f);
        }}
      />
      <p role="status" aria-live="polite" className="podpis">
        {status}
      </p>
      {blad && (
        <p role="alert" className="blad-pola">
          {blad}
        </p>
      )}
    </fieldset>
  );
}
