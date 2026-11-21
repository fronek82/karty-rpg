import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { eksportujProjekt, eksportujRewers, ROZSZERZENIE_PROJEKTU } from '../../dane/archiwum';
import {
  kluczMiniaturyRewersu,
  type PodsumowanieProjektu,
  type WpisRewersuZProjektu,
} from '../../dane/baza';
import { usunRewers } from '../../dane/rewers';
import { BladDanych } from '../../dane/schemat';
import { formatujDate, t } from '../../i18n';
import { baza } from '../baza';
import { nazwaPliku, zapiszPlik } from '../pliki';
import { poOstatnimZapisie } from '../useProjekt';

const komunikat = (e: unknown) =>
  e instanceof BladDanych
    ? e.message
    : t('projekty.bladNieoczekiwany', { szczegoly: String(e instanceof Error ? e.message : e) });

type PozycjaListy =
  | {
      klucz: string;
      rodzaj: 'projekt';
      typStrony: 'awers' | 'rewers';
      nazwa: string;
      zmieniono: string;
      href: string;
      projekt: PodsumowanieProjektu;
      rewersPodglad?: { projektId: string; rewersId: string };
    }
  | {
      klucz: string;
      rodzaj: 'rewers';
      typStrony: 'rewers';
      nazwa: string;
      zmieniono: string;
      href: string;
      rewers: WpisRewersuZProjektu;
      rewersPodglad: { projektId: string; rewersId: string };
    };

/**
 * „Moje projekty”: kafelki projektów (awersów) i rewersów z miniaturą karty/pierwszej strony,
 * oznaczeniem strony (Awers / Rewers), eksportem i usuwaniem.
 */
export function ListaProjektow({ odswiezenie = 0 }: { odswiezenie?: number }) {
  const [lista, ustawListe] = useState<PodsumowanieProjektu[]>();
  const [rewersy, ustawRewersy] = useState<WpisRewersuZProjektu[]>([]);
  const [miniatury, ustawMiniatury] = useState<Map<string, string>>(new Map());
  const [blad, ustawBlad] = useState<string>();
  const [status, ustawStatus] = useState('');
  const [trwa, ustawTrwa] = useState(false);
  const [doUsuniecia, ustawDoUsuniecia] = useState<PozycjaListy>();

  // Numer odczytu: wynik starszego, wolniejszego odczytu nie nadpisuje nowszego.
  const odczyt = useRef(0);
  const naglowek = useRef<HTMLHeadingElement>(null);
  const otwierajacy = useRef<HTMLButtonElement>(null);
  const wyrenderowaneRewersy = useRef<Set<string>>(new Set());
  const anulujUsuniecie = () => {
    ustawDoUsuniecia(undefined);
    otwierajacy.current?.focus();
  };

  const odswiez = useCallback(() => {
    const numer = ++odczyt.current;
    // Zapis zamkniętego właśnie projektu jest asynchroniczny – lista czeka na niego.
    poOstatnimZapisie()
      .then(() => Promise.all([baza().lista(), baza().rewersyZProjektow(), baza().miniatury()]))
      .then(
        ([l, r, m]) => {
          if (numer !== odczyt.current) return;
          ustawListe(l);
          ustawRewersy(r);
          ustawMiniatury(m);
        },
        (e: unknown) => ustawBlad(komunikat(e)),
      );
  }, []);
  useEffect(odswiez, [odswiez, odswiezenie]);

  const pozycje = useMemo<PozycjaListy[] | undefined>(() => {
    if (lista === undefined) return undefined;
    const wynik: PozycjaListy[] = [];
    const reprezentowaneRewersy = new Set<string>();
    for (const p of lista) {
      const typStrony = p.typStrony ?? 'awers';
      const rewersId = typStrony === 'rewers' ? p.rewersId : undefined;
      if (rewersId) reprezentowaneRewersy.add(kluczMiniaturyRewersu(p.id, rewersId));
      wynik.push({
        klucz: `projekt:${p.id}`,
        rodzaj: 'projekt',
        typStrony,
        nazwa: p.nazwa,
        zmieniono: p.zmieniono,
        href: rewersId
          ? `#/projekt/${encodeURIComponent(p.id)}/rewers/${encodeURIComponent(rewersId)}`
          : `#/projekt/${encodeURIComponent(p.id)}`,
        projekt: p,
        ...(rewersId ? { rewersPodglad: { projektId: p.id, rewersId } } : {}),
      });
    }
    for (const r of rewersy) {
      const klucz = kluczMiniaturyRewersu(r.projektId, r.rewersId);
      if (reprezentowaneRewersy.has(klucz)) continue;
      wynik.push({
        klucz,
        rodzaj: 'rewers',
        typStrony: 'rewers',
        nazwa: r.nazwa,
        zmieniono: r.zmieniono ?? '',
        href: `#/projekt/${encodeURIComponent(r.projektId)}/rewers/${encodeURIComponent(r.rewersId)}`,
        rewers: r,
        rewersPodglad: { projektId: r.projektId, rewersId: r.rewersId },
      });
    }
    return wynik.sort((a, b) => b.zmieniono.localeCompare(a.zmieniono));
  }, [lista, rewersy]);

  const miniaturyUrl = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const [k, svg] of miniatury) {
      mapa.set(k, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    }
    return mapa;
  }, [miniatury]);

  // Dla rewersów bez zapisanej jeszcze miniatury (np. starszych) generujemy podgląd karty na żądanie.
  useEffect(() => {
    if (!pozycje) return;
    const brakujace = pozycje.flatMap((poz) => {
      if (!poz.rewersPodglad) return [];
      const klucz = kluczMiniaturyRewersu(poz.rewersPodglad.projektId, poz.rewersPodglad.rewersId);
      if (miniatury.has(klucz) || wyrenderowaneRewersy.current.has(klucz)) return [];
      if (poz.rodzaj === 'projekt' && miniatury.has(poz.projekt.id)) return [];
      return [{ klucz, ...poz.rewersPodglad }];
    });
    if (brakujace.length === 0) return;

    let aktywny = true;

    void import('../miniaturaRewersu').then(async ({ zapiszMiniatureRewersu }) => {
      const nowe = new Map<string, string>();
      const projektyCache = new Map<
        string,
        Awaited<ReturnType<ReturnType<typeof baza>['wczytaj']>>
      >();
      for (const b of brakujace) {
        if (!aktywny) return;
        try {
          let wczytany = projektyCache.get(b.projektId);
          if (!wczytany) {
            wczytany = await baza().wczytaj(b.projektId);
            projektyCache.set(b.projektId, wczytany);
          }
          if (!aktywny) return;
          const svg = await zapiszMiniatureRewersu(wczytany.projekt, wczytany.zasoby, b.rewersId);
          if (svg) nowe.set(b.klucz, svg);
          wyrenderowaneRewersy.current.add(b.klucz);
        } catch {
          wyrenderowaneRewersy.current.add(b.klucz);
        }
      }
      if (aktywny && nowe.size > 0) {
        ustawMiniatury((pop) => {
          const nast = new Map(pop);
          for (const [k, v] of nowe) nast.set(k, v);
          return nast;
        });
      }
    });

    return () => {
      aktywny = false;
    };
  }, [pozycje, miniatury]);

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

  const eksportuj = (poz: PozycjaListy) =>
    wykonaj(async () => {
      if (poz.rodzaj === 'projekt') {
        const { projekt, zasoby } = await baza().wczytaj(poz.projekt.id);
        zapiszPlik(
          eksportujProjekt(projekt, zasoby),
          'application/zip',
          nazwaPliku(projekt.nazwa, ROZSZERZENIE_PROJEKTU),
        );
        return t('projekty.wyeksportowano', { nazwa: poz.nazwa });
      }
      const { projekt, zasoby } = await baza().wczytaj(poz.rewers.projektId);
      zapiszPlik(
        eksportujRewers(projekt, zasoby, poz.rewers.rewersId),
        'application/zip',
        nazwaPliku(poz.rewers.nazwa, '.kartyrpg-rewers'),
      );
      return t('projekty.wyeksportowanoRewers', { nazwa: poz.rewers.nazwa });
    });

  const usun = (poz: PozycjaListy) =>
    wykonaj(async () => {
      ustawDoUsuniecia(undefined);
      naglowek.current?.focus();
      if (poz.rodzaj === 'projekt') {
        await baza().usun(poz.projekt.id);
        return t('projekty.usunieto', { nazwa: poz.nazwa });
      }
      const { projekt, zasoby } = await baza().wczytaj(poz.rewers.projektId);
      const poUsunieciu = usunRewers(projekt, poz.rewers.rewersId);
      await baza().zapisz(poUsunieciu, zasoby);
      await baza()
        .usunMiniature(kluczMiniaturyRewersu(poz.rewers.projektId, poz.rewers.rewersId))
        .catch(() => undefined);
      return t('projekty.usunietoRewers', { nazwa: poz.rewers.nazwa });
    });

  const miniaturaPozycji = (poz: PozycjaListy): string | undefined => {
    if (poz.rewersPodglad) {
      const zRewersu = miniaturyUrl.get(
        kluczMiniaturyRewersu(poz.rewersPodglad.projektId, poz.rewersPodglad.rewersId),
      );
      if (zRewersu) return zRewersu;
    }
    return poz.rodzaj === 'projekt' ? miniaturyUrl.get(poz.projekt.id) : undefined;
  };

  return (
    <section className="lista-projektow" aria-labelledby="moje-projekty">
      <div className="naglowek-sekcji">
        <h2 id="moje-projekty" ref={naglowek} tabIndex={-1}>
          {t('start.mojeProjekty')}
        </h2>
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
          onKeyDown={(e) => e.key === 'Escape' && anulujUsuniecie()}
        >
          <p id="usun-tytul">
            {doUsuniecia.rodzaj === 'projekt'
              ? t('projekty.potwierdzUsuniecie', { nazwa: doUsuniecia.nazwa })
              : t('projekty.potwierdzUsuniecieRewersu', {
                  nazwa: doUsuniecia.rewers.nazwa,
                  projekt: doUsuniecia.rewers.projektNazwa ?? '',
                })}
          </p>
          <button type="button" onClick={() => void usun(doUsuniecia)}>
            {t('projekty.usun')}
          </button>{' '}
          <button type="button" autoFocus onClick={anulujUsuniecie}>
            {t('projekty.anuluj')}
          </button>
        </div>
      )}
      {pozycje === undefined ? (
        <p>{t('projekty.wczytywanie')}</p>
      ) : pozycje.length === 0 ? (
        <p className="podpis">
          {t('projekty.brak')} {t('start.pustaPodpowiedz')}
        </p>
      ) : (
        <ul className="kafelki-projektow">
          {pozycje.map((poz) => {
            const urlMiniatury = miniaturaPozycji(poz);
            const czyRewers = poz.typStrony === 'rewers';
            return (
              <li key={poz.klucz} className="kafelek-projektu">
                <a
                  href={poz.href}
                  className={czyRewers ? 'miniatura miniatura-rewersu' : 'miniatura'}
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  {urlMiniatury ? (
                    // Jako obrazek: identyfikatory glifów w SVG różnych miniatur się nie mieszają.
                    <img alt="" src={urlMiniatury} />
                  ) : (
                    <span className="bez-miniatury">🂠</span>
                  )}
                </a>
                <div className="opis-projektu">
                  <div className="naglowek-kafelka-projektu">
                    <a href={poz.href} className="nazwa">
                      {poz.nazwa}
                    </a>
                    <span className={`etykieta-strony etykieta-strony-${poz.typStrony}`}>
                      {czyRewers ? t('projekty.stronaRewers') : t('projekty.stronaAwers')}
                    </span>
                  </div>
                  <span className="podpis">
                    {poz.rodzaj === 'projekt' ? (
                      czyRewers ? (
                        t('projekty.zmieniono', { data: formatujDate(poz.zmieniono) })
                      ) : (
                        <>
                          {t('start.podsumowanie', {
                            strony: poz.projekt.liczbaStron,
                            karty: poz.projekt.liczbaKart,
                          })}{' '}
                          · {t('projekty.zmieniono', { data: formatujDate(poz.zmieniono) })}
                        </>
                      )
                    ) : (
                      <>
                        {t('projekty.rewersZProjektu', { projekt: poz.rewers.projektNazwa ?? '' })}{' '}
                        · {t('projekty.zmieniono', { data: formatujDate(poz.zmieniono) })}
                      </>
                    )}
                  </span>
                  <span className="akcje">
                    <a className="przycisk glowny" href={poz.href}>
                      {t('start.otworz')}
                    </a>
                    <button type="button" disabled={trwa} onClick={() => void eksportuj(poz)}>
                      {t('projekty.eksportuj')}
                    </button>
                    <button
                      type="button"
                      disabled={trwa}
                      aria-label={
                        poz.rodzaj === 'projekt'
                          ? t('start.usunProjekt', { nazwa: poz.nazwa })
                          : t('projekty.usunRewersEtykieta', { nazwa: poz.nazwa })
                      }
                      onClick={(e) => {
                        otwierajacy.current = e.currentTarget;
                        ustawDoUsuniecia(poz);
                      }}
                    >
                      {t('projekty.usun')}
                    </button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
