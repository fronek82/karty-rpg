import { useCallback, useEffect, useRef, useState } from 'react';
import {
  eksportujProjekt,
  importujProjekt,
  jakoKopia,
  ROZSZERZENIE_PROJEKTU,
} from '../../dane/archiwum';
import type { PodsumowanieProjektu } from '../../dane/baza';
import { BladDanych } from '../../dane/schemat';
import { formatujDate, t } from '../../i18n';
import type { DaneZasobow, Projekt } from '../../model/projekt';
import { baza } from '../baza';
import { nazwaPliku, zapiszPlik } from '../pliki';
import { poOstatnimZapisie } from '../useProjekt';

const komunikat = (e: unknown) =>
  e instanceof BladDanych
    ? e.message
    : t('projekty.bladNieoczekiwany', { szczegoly: String(e instanceof Error ? e.message : e) });

/** „Moje projekty”: kafelki z miniaturą pierwszej strony; import, eksport, usuwanie. */
export function ListaProjektow() {
  const [lista, ustawListe] = useState<PodsumowanieProjektu[]>();
  const [miniatury, ustawMiniatury] = useState<Map<string, string>>(new Map());
  const [blad, ustawBlad] = useState<string>();
  const [status, ustawStatus] = useState('');
  const [trwa, ustawTrwa] = useState(false);
  const [kolizja, ustawKolizje] = useState<{ projekt: Projekt; zasoby: DaneZasobow }>();
  const [doUsuniecia, ustawDoUsuniecia] = useState<PodsumowanieProjektu>();
  const plik = useRef<HTMLInputElement>(null);

  const odswiez = useCallback(() => {
    // Zapis zamkniętego właśnie projektu jest asynchroniczny – lista czeka na niego.
    poOstatnimZapisie()
      .then(() => Promise.all([baza().lista(), baza().miniatury()]))
      .then(
        ([l, m]) => {
          ustawListe(l);
          ustawMiniatury(m);
        },
        (e: unknown) => ustawBlad(komunikat(e)),
      );
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
      // Zastąpiony projekt – stara miniatura nieaktualna (nowa powstanie przy otwarciu).
      await baza().usunMiniature(projekt.id);
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
    <section className="lista-projektow" aria-labelledby="moje-projekty">
      <div className="naglowek-sekcji">
        <h2 id="moje-projekty">{t('start.mojeProjekty')}</h2>
        <button type="button" disabled={trwa} onClick={() => plik.current?.click()}>
          ⤒ {t('projekty.importuj')}
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
        <p className="podpis">{t('projekty.brak')}</p>
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
