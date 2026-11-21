import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { eksportujProjekt, eksportujRewers, ROZSZERZENIE_PROJEKTU } from '../../dane/archiwum';
import {
  kluczMiniaturyRewersu,
  kluczMiniaturySzablonu,
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
      szablonPodglad?: { projektId: string; szablonId: string };
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
 * „Moje projekty”: kafelki szablonów (awersów) i rewersów z miniaturą pojedynczej karty
 * (lub strony dla pakietów gier), oznaczeniem strony (Awers / Rewers), eksportem i usuwaniem.
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
  const wyrenderowaneKarty = useRef<Set<string>>(new Set());
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
      const szablonId = typStrony === 'awers' ? p.szablonId : undefined;
      if (rewersId) reprezentowaneRewersy.add(kluczMiniaturyRewersu(p.id, rewersId));
      wynik.push({
        klucz: `projekt:${p.id}`,
        rodzaj: 'projekt',
        typStrony,
        nazwa: p.nazwa,
        zmieniono: p.zmieniono,
        href: rewersId
          ? `#/projekt/${encodeURIComponent(p.id)}/rewers/${encodeURIComponent(rewersId)}`
          : szablonId
            ? `#/projekt/${encodeURIComponent(p.id)}/szablon/${encodeURIComponent(szablonId)}`
            : `#/projekt/${encodeURIComponent(p.id)}`,
        projekt: p,
        ...(rewersId ? { rewersPodglad: { projektId: p.id, rewersId } } : {}),
        ...(szablonId ? { szablonPodglad: { projektId: p.id, szablonId } } : {}),
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

  // Dla szablonów awersów i rewersów bez zapisanej jeszcze miniatury karty generujemy podgląd na żądanie.
  useEffect(() => {
    if (!pozycje) return;
    type Brakujaca =
      | { rodzaj: 'rewers'; klucz: string; projektId: string; rewersId: string }
      | { rodzaj: 'szablon'; klucz: string; projektId: string; szablonId: string };
    const brakujace: Brakujaca[] = [];
    for (const poz of pozycje) {
      if (poz.rewersPodglad) {
        const klucz = kluczMiniaturyRewersu(
          poz.rewersPodglad.projektId,
          poz.rewersPodglad.rewersId,
        );
        if (
          !miniatury.has(klucz) &&
          !wyrenderowaneKarty.current.has(klucz) &&
          !(poz.rodzaj === 'projekt' && miniatury.has(poz.projekt.id))
        ) {
          brakujace.push({ rodzaj: 'rewers', klucz, ...poz.rewersPodglad });
        }
      } else if (poz.rodzaj === 'projekt' && poz.szablonPodglad) {
        const klucz = kluczMiniaturySzablonu(
          poz.szablonPodglad.projektId,
          poz.szablonPodglad.szablonId,
        );
        if (!miniatury.has(klucz) && !wyrenderowaneKarty.current.has(klucz)) {
          brakujace.push({ rodzaj: 'szablon', klucz, ...poz.szablonPodglad });
        }
      }
    }
    if (brakujace.length === 0) return;

    let aktywny = true;

    void import('../miniaturaRewersu').then(
      async ({ zapiszMiniatureRewersu, zapiszMiniatureSzablonu }) => {
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
            const svg =
              b.rodzaj === 'rewers'
                ? await zapiszMiniatureRewersu(wczytany.projekt, wczytany.zasoby, b.rewersId)
                : await zapiszMiniatureSzablonu(wczytany.projekt, wczytany.zasoby, b.szablonId);
            if (svg) nowe.set(b.klucz, svg);
            wyrenderowaneKarty.current.add(b.klucz);
          } catch {
            wyrenderowaneKarty.current.add(b.klucz);
          }
        }
        if (aktywny && nowe.size > 0) {
          ustawMiniatury((pop) => {
            const nast = new Map(pop);
            for (const [k, v] of nowe) nast.set(k, v);
            return nast;
          });
        }
      },
    );

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
    if (poz.rodzaj === 'projekt' && poz.szablonPodglad) {
      const zSzablonu = miniaturyUrl.get(
        kluczMiniaturySzablonu(poz.szablonPodglad.projektId, poz.szablonPodglad.szablonId),
      );
      if (zSzablonu) return zSzablonu;
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
            const podgladPojedynczejKarty =
              czyRewers || (poz.rodzaj === 'projekt' && !!poz.szablonPodglad);
            return (
              <li key={poz.klucz} className="kafelek-projektu">
                <a
                  href={poz.href}
                  className={podgladPojedynczejKarty ? 'miniatura miniatura-rewersu' : 'miniatura'}
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
                    <span
                      className={`znacznik-strony-karty znacznik-strony-karty-${poz.typStrony}`}
                    >
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
