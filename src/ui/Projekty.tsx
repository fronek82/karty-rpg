import { useCallback, useEffect, useRef, useState } from 'react';
import {
  eksportujProjekt,
  importujProjekt,
  jakoKopia,
  ROZSZERZENIE_PROJEKTU,
} from '../dane/archiwum';
import type { PodsumowanieProjektu } from '../dane/baza';
import { BladDanych } from '../dane/schemat';
import { jezyk, t } from '../i18n';
import type { DaneZasobow, Projekt } from '../model/projekt';
import { pakietMausritter } from '../pakiety/mausritter';
import { baza, nowyProjektZPakietu } from './baza';
import { poOstatnimZapisie } from './useProjekt';
import { nazwaPliku, zapiszPlik } from './pliki';

const komunikat = (e: unknown) =>
  e instanceof BladDanych
    ? e.message
    : t('projekty.bladNieoczekiwany', { szczegoly: String(e instanceof Error ? e.message : e) });

const formatDaty = new Intl.DateTimeFormat(jezyk(), { dateStyle: 'medium', timeStyle: 'short' });

/** Lista projektów zapisanych w przeglądarce: nowy z pakietu, import, eksport, usuwanie. */
export function Projekty() {
  const [lista, ustawListe] = useState<PodsumowanieProjektu[]>();
  const [blad, ustawBlad] = useState<string>();
  const [status, ustawStatus] = useState('');
  const [trwa, ustawTrwa] = useState(false);
  const [kolizja, ustawKolizje] = useState<{ projekt: Projekt; zasoby: DaneZasobow }>();
  const [doUsuniecia, ustawDoUsuniecia] = useState<PodsumowanieProjektu>();
  const plik = useRef<HTMLInputElement>(null);

  const odswiez = useCallback(() => {
    // Zapis zamkniętego właśnie projektu jest asynchroniczny – lista czeka na niego.
    poOstatnimZapisie()
      .then(() => baza().lista())
      .then(ustawListe, (e: unknown) => ustawBlad(komunikat(e)));
  }, []);
  useEffect(odswiez, [odswiez]);

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

  const zapiszImport = (projekt: Projekt, zasoby: DaneZasobow) =>
    wykonaj(async () => {
      ustawKolizje(undefined);
      await baza().zapisz(projekt, zasoby);
      return t('projekty.zaimportowano', { nazwa: projekt.nazwa });
    });

  const importuj = (f: File) =>
    wykonaj(async () => {
      const wynik = importujProjekt(new Uint8Array(await f.arrayBuffer()));
      if (await baza().istnieje(wynik.projekt.id)) {
        ustawKolizje(wynik);
        return;
      }
      await baza().zapisz(wynik.projekt, wynik.zasoby);
      return t('projekty.zaimportowano', { nazwa: wynik.projekt.nazwa });
    });

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
    <section className="projekty">
      <h1>{t('projekty.tytul')}</h1>
      <p>{t('projekty.opis')}</p>
      <div className="pasek-narzedzi">
        <button
          type="button"
          disabled={trwa}
          onClick={() =>
            void wykonaj(async () => {
              const id = await nowyProjektZPakietu(pakietMausritter);
              window.location.hash = `#/projekt/${encodeURIComponent(id)}`;
            })
          }
        >
          {t('projekty.nowyZPakietu', { pakiet: pakietMausritter.nazwa })}
        </button>
        <button type="button" disabled={trwa} onClick={() => plik.current?.click()}>
          {t('projekty.importuj')}
        </button>
        <input
          ref={plik}
          type="file"
          accept={`${ROZSZERZENIE_PROJEKTU},application/zip`}
          hidden
          data-testid="plik-projektu"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void importuj(f);
          }}
        />
        <p role="status" aria-live="polite" className="status">
          {trwa ? t('projekty.trwa') : status}
        </p>
      </div>
      {blad && (
        <p role="alert" className="uwaga">
          {blad}
        </p>
      )}
      {kolizja && (
        <div
          role="alertdialog"
          aria-labelledby="kolizja-tytul"
          className="uwaga"
          onKeyDown={(e) => e.key === 'Escape' && ustawKolizje(undefined)}
        >
          <p id="kolizja-tytul">{t('projekty.kolizja', { nazwa: kolizja.projekt.nazwa })}</p>
          <button
            type="button"
            autoFocus
            onClick={() => void zapiszImport(kolizja.projekt, kolizja.zasoby)}
          >
            {t('projekty.zastap')}
          </button>{' '}
          <button
            type="button"
            onClick={() =>
              void zapiszImport(
                jakoKopia(
                  kolizja.projekt,
                  t('projekty.nazwaKopii', { nazwa: kolizja.projekt.nazwa }),
                ),
                kolizja.zasoby,
              )
            }
          >
            {t('projekty.jakoKopia')}
          </button>{' '}
          <button type="button" onClick={() => ustawKolizje(undefined)}>
            {t('projekty.anuluj')}
          </button>
        </div>
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
        <p>{t('projekty.brak')}</p>
      ) : (
        <ul className="lista-projektow">
          {lista.map((p) => (
            <li key={p.id}>
              <a href={`#/projekt/${encodeURIComponent(p.id)}`}>{p.nazwa}</a>
              <span className="podpis">
                {t('projekty.zmieniono', { data: formatDaty.format(new Date(p.zmieniono)) })}
              </span>
              <span className="akcje">
                <button type="button" disabled={trwa} onClick={() => void eksportuj(p)}>
                  {t('projekty.eksportuj')}
                </button>
                <button type="button" disabled={trwa} onClick={() => ustawDoUsuniecia(p)}>
                  {t('projekty.usun')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
