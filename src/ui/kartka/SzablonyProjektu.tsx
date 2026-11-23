import { useRef, useState } from 'react';
import {
  ACCEPT_PLIKU_SZABLONU,
  eksportujSzablon,
  importujSzablon,
  ROZSZERZENIE_SZABLONU,
} from '../../dane/archiwum';
import { duplikujSzablonWProjekcie } from '../../dane/szablon';
import { BladDanych } from '../../dane/schemat';
import {
  czyProjektWlasny,
  dodajSzablonZKartka,
  kartkaDlaSzablonu as znajdzKartkeSzablonu,
  opisRozmiaruSzablonu,
} from '../../dane/wlasneKarty';
import { t } from '../../i18n';
import { baza } from '../bazaUI';
import { BibliotekaGlobalna } from '../biblioteka/BibliotekaGlobalna';
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
  const wlasnyProjekt = czyProjektWlasny(projekt);
  const szablony = wlasnyProjekt
    ? projekt.szablony
    : projekt.szablony.filter((s) => projekt.arkusze.some((a) => a.wlasnySzablonId === s.id));

  const importuj = async (odczytaj: () => Promise<Uint8Array>) => {
    ustawBlad(undefined);
    ustawStatus('');
    try {
      const paczka = importujSzablon(await odczytaj());
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
      return true;
    } catch (e) {
      ustawBlad(t('szablony.bladImportu', { szczegoly: komunikat(e) }));
      return false;
    }
  };

  const zapiszGlobalnie = async (id: string, nazwa: string) => {
    ustawBlad(undefined);
    ustawStatus('');
    try {
      const { bajty, ostrzezenia } = eksportujSzablon(projekt, edycja.dane, id);
      await baza().zapiszWBibliotece('szablon', nazwa, bajty);
      ustawStatus([t('globalna.zapisano', { nazwa }), ...ostrzezenia].join(' '));
    } catch (e) {
      ustawBlad(komunikat(e));
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
      {szablony.length === 0 && <p className="podpis">{t('szablony.brak')}</p>}
      <ul className="lista-szablonow">
        {szablony.map((s) => (
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
                aria-label={t('szablony.duplikujEtykieta', { nazwa: s.nazwa })}
                onClick={() =>
                  edycja.zmien((p) => {
                    const kopia = duplikujSzablonWProjekcie(p, s.id, (n) =>
                      n === 1 ? t('szablon.kopia') : t('szablon.kopiaNumer', { n }),
                    );
                    return wlasnyProjekt
                      ? kopia.projekt
                      : znajdzKartkeSzablonu(kopia.projekt, kopia.id).projekt;
                  })
                }
              >
                {t('szablony.duplikuj')}
              </button>
              <button
                type="button"
                aria-label={t('szablony.eksportujEtykieta', { nazwa: s.nazwa })}
                onClick={() => eksportuj(s.id, s.nazwa)}
              >
                {t('szablony.eksportuj')}
              </button>
              <button
                type="button"
                aria-label={t('globalna.zapiszEtykieta', { nazwa: s.nazwa })}
                onClick={() => void zapiszGlobalnie(s.id, s.nazwa)}
              >
                {t('globalna.zapisz')}
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
      {wlasnyProjekt && (
        <a className="przycisk" href={`#/projekt/${encodeURIComponent(projekt.id)}/nowy-szablon`}>
          {t('szablony.nowy')}
        </a>
      )}{' '}
      <button type="button" onClick={() => plik.current?.click()}>
        {t('szablony.importuj')}
      </button>{' '}
      <a className="przycisk" href={`#/projekt/${encodeURIComponent(projekt.id)}/biblioteka`}>
        {t('biblioteka.tytul')}
      </a>
      <input
        ref={plik}
        type="file"
        accept={ACCEPT_PLIKU_SZABLONU}
        hidden
        data-testid="plik-szablonu"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void importuj(async () => new Uint8Array(await f.arrayBuffer()));
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
      <BibliotekaGlobalna rodzaj="szablon" dodaj={(bajty) => importuj(async () => bajty)} />
    </fieldset>
  );
}
