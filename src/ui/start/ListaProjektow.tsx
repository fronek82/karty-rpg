import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  eksportujProjekt,
  eksportujRewers,
  eksportujSzablon,
  ROZSZERZENIE_PROJEKTU,
  ROZSZERZENIE_SZABLONU,
} from '../../dane/archiwum';
import {
  kluczMiniaturyRewersu,
  kluczMiniaturySzablonu,
  type PodsumowanieProjektu,
  type WpisAwersuZProjektu,
  type WpisRewersuZProjektu,
} from '../../dane/baza';
import { usunRewers } from '../../dane/rewers';
import { BladDanych } from '../../dane/schemat';
import { formatujDate, t } from '../../i18n';
import { baza, nowyProjektZAwersuZProjektu, nowyProjektZRewersuZProjektu } from '../baza';
import { nazwaPliku, zapiszPlik } from '../pliki';
import { poOstatnimZapisie } from '../useProjekt';

type Zakladka = 'projekty' | 'szablony';
type FiltrSzablonow = 'wszystkie' | 'awers' | 'rewers';

const KLUCZ_ZAKLADKI = 'karty.zakladkaStart';

function odczytajZakladke(): Zakladka {
  try {
    return sessionStorage.getItem(KLUCZ_ZAKLADKI) === 'szablony' ? 'szablony' : 'projekty';
  } catch {
    return 'projekty';
  }
}

const komunikat = (e: unknown) =>
  e instanceof BladDanych
    ? e.message
    : t('projekty.bladNieoczekiwany', { szczegoly: String(e instanceof Error ? e.message : e) });

const przejdzDoProjektu = (id: string) => {
  window.location.hash = `#/projekt/${encodeURIComponent(id)}`;
};

type PozycjaSzablonu =
  | {
      klucz: string;
      rodzaj: 'awers';
      nazwa: string;
      zmieniono: string;
      href: string;
      awers: WpisAwersuZProjektu;
      szablonPodglad: { projektId: string; szablonId: string };
    }
  | {
      klucz: string;
      rodzaj: 'rewers';
      nazwa: string;
      zmieniono: string;
      href: string;
      rewers: WpisRewersuZProjektu;
      rewersPodglad: { projektId: string; rewersId: string };
    };

type DoUsuniecia =
  | { rodzaj: 'projekt'; projekt: PodsumowanieProjektu }
  | { rodzaj: 'szablon'; pozycja: PozycjaSzablonu };

/**
 * Środkowa kolumna ekranu startowego z dwiema zakładkami:
 * - „Moje projekty”: gotowe talie/arkusze kart (podgląd Awers + Rewers obok siebie, jeśli oba są);
 * - „Moje szablony”: pojedyncze wzory awersów i rewersów z filtrem i plakietką strony.
 */
export function ListaProjektow({ odswiezenie = 0 }: { odswiezenie?: number }) {
  const [zakladka, ustawZakladkeStan] = useState<Zakladka>(odczytajZakladke);
  const [filtr, ustawFiltr] = useState<FiltrSzablonow>('wszystkie');
  const [lista, ustawListe] = useState<PodsumowanieProjektu[]>();
  const [awersy, ustawAwersy] = useState<WpisAwersuZProjektu[]>([]);
  const [rewersy, ustawRewersy] = useState<WpisRewersuZProjektu[]>([]);
  const [miniatury, ustawMiniatury] = useState<Map<string, string>>(new Map());
  const [blad, ustawBlad] = useState<string>();
  const [status, ustawStatus] = useState('');
  const [trwa, ustawTrwa] = useState(false);
  const [doUsuniecia, ustawDoUsuniecia] = useState<DoUsuniecia>();

  const odczyt = useRef(0);
  const naglowek = useRef<HTMLHeadingElement>(null);
  const otwierajacy = useRef<HTMLButtonElement>(null);
  const wyrenderowaneKarty = useRef<Set<string>>(new Set());

  const ustawZakladke = (z: Zakladka) => {
    ustawZakladkeStan(z);
    try {
      sessionStorage.setItem(KLUCZ_ZAKLADKI, z);
    } catch {
      // Tryb prywatny – pomijamy zapis w sessionStorage.
    }
  };

  const anulujUsuniecie = () => {
    ustawDoUsuniecia(undefined);
    otwierajacy.current?.focus();
  };

  const odswiez = useCallback(() => {
    const numer = ++odczyt.current;
    poOstatnimZapisie()
      .then(() =>
        Promise.all([
          baza().lista(),
          baza().szablonyAwersowZProjektow(),
          baza().rewersyZProjektow(),
          baza().miniatury(),
        ]),
      )
      .then(
        ([l, a, r, m]) => {
          if (numer !== odczyt.current) return;
          ustawListe(l);
          ustawAwersy(a);
          ustawRewersy(r);
          ustawMiniatury(m);
        },
        (e: unknown) => ustawBlad(komunikat(e)),
      );
  }, []);
  useEffect(odswiez, [odswiez, odswiezenie]);

  const pozycjeSzablonow = useMemo<PozycjaSzablonu[]>(() => {
    const wynik: PozycjaSzablonu[] = [];
    for (const a of awersy) {
      wynik.push({
        klucz: kluczMiniaturySzablonu(a.projektId, a.szablonId),
        rodzaj: 'awers',
        nazwa: a.szablonNazwa,
        zmieniono: a.zmieniono ?? '',
        href: `#/projekt/${encodeURIComponent(a.projektId)}/szablon/${encodeURIComponent(a.szablonId)}`,
        awers: a,
        szablonPodglad: { projektId: a.projektId, szablonId: a.szablonId },
      });
    }
    const widzianeRewersy = new Set<string>();
    for (const r of rewersy) {
      const norm = r.nazwa.trim().toLowerCase();
      if (widzianeRewersy.has(norm)) continue;
      widzianeRewersy.add(norm);
      wynik.push({
        klucz: kluczMiniaturyRewersu(r.projektId, r.rewersId),
        rodzaj: 'rewers',
        nazwa: r.nazwa,
        zmieniono: r.zmieniono ?? '',
        href: `#/projekt/${encodeURIComponent(r.projektId)}/rewers/${encodeURIComponent(r.rewersId)}`,
        rewers: r,
        rewersPodglad: { projektId: r.projektId, rewersId: r.rewersId },
      });
    }
    return wynik.sort((a, b) => b.zmieniono.localeCompare(a.zmieniono));
  }, [awersy, rewersy]);

  const widoczneSzablony = useMemo(
    () =>
      filtr === 'wszystkie' ? pozycjeSzablonow : pozycjeSzablonow.filter((p) => p.rodzaj === filtr),
    [pozycjeSzablonow, filtr],
  );

  const miniaturyUrl = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const [k, svg] of miniatury) {
      mapa.set(k, `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    }
    return mapa;
  }, [miniatury]);

  // Generowanie brakujących miniatur kart (awersów i rewersów) na żądanie.
  useEffect(() => {
    type Brakujaca =
      | { rodzaj: 'rewers'; klucz: string; projektId: string; rewersId: string }
      | { rodzaj: 'szablon'; klucz: string; projektId: string; szablonId: string };
    const brakujace: Brakujaca[] = [];
    const dodajJesliBrak = (b: Brakujaca) => {
      if (
        !miniatury.has(b.klucz) &&
        !wyrenderowaneKarty.current.has(b.klucz) &&
        !brakujace.some((x) => x.klucz === b.klucz)
      ) {
        brakujace.push(b);
      }
    };

    if (zakladka === 'projekty' && lista) {
      for (const p of lista) {
        if (p.aktywnySzablonId && (!p.pakiet || p.pakiet === 'wlasne')) {
          dodajJesliBrak({
            rodzaj: 'szablon',
            klucz: kluczMiniaturySzablonu(p.id, p.aktywnySzablonId),
            projektId: p.id,
            szablonId: p.aktywnySzablonId,
          });
        }
        if (p.aktywnyRewersId) {
          dodajJesliBrak({
            rodzaj: 'rewers',
            klucz: kluczMiniaturyRewersu(p.id, p.aktywnyRewersId),
            projektId: p.id,
            rewersId: p.aktywnyRewersId,
          });
        }
      }
    } else if (zakladka === 'szablony') {
      for (const poz of widoczneSzablony) {
        if (poz.rodzaj === 'rewers') {
          dodajJesliBrak({
            rodzaj: 'rewers',
            klucz: poz.klucz,
            ...poz.rewersPodglad,
          });
        } else {
          dodajJesliBrak({
            rodzaj: 'szablon',
            klucz: poz.klucz,
            ...poz.szablonPodglad,
          });
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
  }, [zakladka, lista, widoczneSzablony, miniatury]);

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

  const eksportujProjektKafelka = (p: PodsumowanieProjektu) =>
    wykonaj(async () => {
      const { projekt, zasoby } = await baza().wczytaj(p.id);
      zapiszPlik(
        eksportujProjekt(projekt, zasoby),
        'application/zip',
        nazwaPliku(projekt.nazwa, ROZSZERZENIE_PROJEKTU),
      );
      return t('projekty.wyeksportowano', { nazwa: p.nazwa });
    });

  const eksportujSzablonKafelka = (poz: PozycjaSzablonu) =>
    wykonaj(async () => {
      if (poz.rodzaj === 'rewers') {
        const { projekt, zasoby } = await baza().wczytaj(poz.rewers.projektId);
        zapiszPlik(
          eksportujRewers(projekt, zasoby, poz.rewers.rewersId),
          'application/zip',
          nazwaPliku(poz.rewers.nazwa, '.kartyrpg-rewers'),
        );
        return t('projekty.wyeksportowanoRewers', { nazwa: poz.rewers.nazwa });
      }
      const { projekt, zasoby } = await baza().wczytaj(poz.awers.projektId);
      const wynik = eksportujSzablon(projekt, zasoby, poz.awers.szablonId);
      zapiszPlik(
        wynik.bajty,
        'application/zip',
        nazwaPliku(poz.awers.szablonNazwa, ROZSZERZENIE_SZABLONU),
      );
      return t('projekty.wyeksportowano', { nazwa: poz.awers.szablonNazwa });
    });

  const zamontowany = useRef(true);
  const wToku = useRef(false);
  useEffect(() => {
    zamontowany.current = true;
    return () => {
      zamontowany.current = false;
    };
  }, []);

  const uzyjWProjekcie = async (poz: PozycjaSzablonu) => {
    if (wToku.current) return;
    wToku.current = true;
    ustawTrwa(true);
    ustawBlad(undefined);
    try {
      const id =
        poz.rodzaj === 'rewers'
          ? await nowyProjektZRewersuZProjektu(poz.rewers.projektId, poz.rewers.rewersId)
          : await nowyProjektZAwersuZProjektu(poz.awers.projektId, poz.awers.szablonId);
      if (!zamontowany.current) return;
      przejdzDoProjektu(id);
    } catch (e) {
      if (!zamontowany.current) return;
      ustawBlad(komunikat(e));
      wToku.current = false;
      ustawTrwa(false);
    }
  };

  const usun = (cel: DoUsuniecia) =>
    wykonaj(async () => {
      ustawDoUsuniecia(undefined);
      naglowek.current?.focus();
      if (cel.rodzaj === 'projekt') {
        await baza().usun(cel.projekt.id);
        return t('projekty.usunieto', { nazwa: cel.projekt.nazwa });
      }
      const poz = cel.pozycja;
      if (poz.rodzaj === 'rewers') {
        if (poz.rewers.projektRewersowy) {
          await baza().usun(poz.rewers.projektId);
        } else {
          const { projekt, zasoby } = await baza().wczytaj(poz.rewers.projektId);
          const poUsunieciu = usunRewers(projekt, poz.rewers.rewersId);
          await baza().zapisz(poUsunieciu, zasoby);
          await baza()
            .usunMiniature(kluczMiniaturyRewersu(poz.rewers.projektId, poz.rewers.rewersId))
            .catch(() => undefined);
        }
        return t('projekty.usunietoRewers', { nazwa: poz.rewers.nazwa });
      }
      const { projekt, zasoby } = await baza().wczytaj(poz.awers.projektId);
      const maKarty = projekt.talie.some((tl) => tl.karty.length > 0);
      const samodzielnySzablon =
        projekt.szablony.length <= 1 && (projekt.rewersy?.length ?? 0) === 0 && !maKarty;
      if (samodzielnySzablon) {
        await baza().usun(poz.awers.projektId);
      } else {
        const reszta = projekt.szablony.filter((s) => s.id !== poz.awers.szablonId);
        await baza().zapisz(
          { ...projekt, zmieniono: new Date().toISOString(), szablony: reszta },
          zasoby,
        );
        await baza()
          .usunMiniature(kluczMiniaturySzablonu(poz.awers.projektId, poz.awers.szablonId))
          .catch(() => undefined);
      }
      return t('projekty.usunieto', { nazwa: poz.awers.szablonNazwa });
    });

  return (
    <section className="lista-projektow" aria-labelledby="moje-projekty">
      <div className="zakladki-listy" role="tablist" aria-label={t('start.zakladkiListy')}>
        <button
          type="button"
          role="tab"
          aria-selected={zakladka === 'projekty'}
          className={zakladka === 'projekty' ? 'zakladka aktywna' : 'zakladka'}
          onClick={() => ustawZakladke('projekty')}
        >
          {t('start.mojeProjekty')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={zakladka === 'szablony'}
          className={zakladka === 'szablony' ? 'zakladka aktywna' : 'zakladka'}
          onClick={() => ustawZakladke('szablony')}
        >
          {t('start.mojeSzablony')}
        </button>
      </div>
      <div className="naglowek-sekcji">
        <h2 id="moje-projekty" ref={naglowek} tabIndex={-1}>
          {zakladka === 'projekty' ? t('start.mojeProjekty') : t('start.mojeSzablony')}
        </h2>
        <p role="status" aria-live="polite" className="status">
          {trwa ? t('projekty.trwa') : status}
        </p>
      </div>
      {zakladka === 'szablony' && (
        <div className="filtr-szablonow" role="group" aria-label={t('start.mojeSzablony')}>
          {(['wszystkie', 'awers', 'rewers'] as const).map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filtr === f}
              className={filtr === f ? 'aktywny' : undefined}
              onClick={() => ustawFiltr(f)}
            >
              {f === 'wszystkie'
                ? t('projekty.filtrWszystkie')
                : f === 'awers'
                  ? t('projekty.filtrAwersy')
                  : t('projekty.filtrRewersy')}
            </button>
          ))}
        </div>
      )}
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
              ? t('projekty.potwierdzUsuniecie', { nazwa: doUsuniecia.projekt.nazwa })
              : doUsuniecia.pozycja.rodzaj === 'rewers' &&
                  !doUsuniecia.pozycja.rewers.projektRewersowy
                ? t('projekty.potwierdzUsuniecieRewersu', {
                    nazwa: doUsuniecia.pozycja.rewers.nazwa,
                    projekt: doUsuniecia.pozycja.rewers.projektNazwa ?? '',
                  })
                : t('projekty.potwierdzUsuniecie', { nazwa: doUsuniecia.pozycja.nazwa })}
          </p>
          <button type="button" onClick={() => void usun(doUsuniecia)}>
            {t('projekty.usun')}
          </button>{' '}
          <button type="button" autoFocus onClick={anulujUsuniecie}>
            {t('projekty.anuluj')}
          </button>
        </div>
      )}
      {lista === undefined ? (
        <p>{t('projekty.wczytywanie')}</p>
      ) : zakladka === 'projekty' ? (
        lista.length === 0 ? (
          <p className="podpis">
            {t('projekty.brak')} {t('start.pustaPodpowiedz')}
          </p>
        ) : (
          <ul className="kafelki-projektow">
            {lista.map((p) => {
              const czyWlasny = !p.pakiet || p.pakiet === 'wlasne';
              const czyRewersowy = p.typStrony === 'rewers';
              const urlAwersu = czyRewersowy
                ? undefined
                : czyWlasny && p.aktywnySzablonId
                  ? (miniaturyUrl.get(kluczMiniaturySzablonu(p.id, p.aktywnySzablonId)) ??
                    miniaturyUrl.get(p.id))
                  : miniaturyUrl.get(p.id);
              const urlRewersu = p.aktywnyRewersId
                ? (miniaturyUrl.get(kluczMiniaturyRewersu(p.id, p.aktywnyRewersId)) ??
                  (czyRewersowy ? miniaturyUrl.get(p.id) : undefined))
                : undefined;
              const para = Boolean(urlAwersu && urlRewersu);
              const pojedynczaKarta = Boolean(
                !para && ((czyWlasny && p.aktywnySzablonId && urlAwersu) || urlRewersu),
              );
              const href = `#/projekt/${encodeURIComponent(p.id)}`;
              return (
                <li key={p.id} className="kafelek-projektu">
                  <a
                    href={href}
                    className={
                      para
                        ? 'miniatura miniatura-para'
                        : pojedynczaKarta
                          ? 'miniatura miniatura-rewersu'
                          : 'miniatura'
                    }
                    aria-hidden="true"
                    tabIndex={-1}
                  >
                    {para ? (
                      <>
                        <img alt="" src={urlAwersu} />
                        <img alt="" src={urlRewersu} />
                      </>
                    ) : urlAwersu || urlRewersu ? (
                      <img alt="" src={urlAwersu ?? urlRewersu} />
                    ) : (
                      <span className="bez-miniatury">🂠</span>
                    )}
                  </a>
                  <div className="opis-projektu">
                    <div className="naglowek-kafelka-projektu">
                      <a href={href} className="nazwa">
                        {p.nazwa}
                      </a>
                    </div>
                    <span className="podpis">
                      {t('start.podsumowanie', {
                        strony: p.liczbaStron,
                        karty: p.liczbaKart,
                      })}{' '}
                      · {t('projekty.zmieniono', { data: formatujDate(p.zmieniono) })}
                    </span>
                    <span className="akcje">
                      <a className="przycisk glowny" href={href}>
                        {t('start.otworz')}
                      </a>
                      <button
                        type="button"
                        disabled={trwa}
                        onClick={() => void eksportujProjektKafelka(p)}
                      >
                        {t('projekty.eksportuj')}
                      </button>
                      <button
                        type="button"
                        disabled={trwa}
                        aria-label={t('start.usunProjekt', { nazwa: p.nazwa })}
                        onClick={(e) => {
                          otwierajacy.current = e.currentTarget;
                          ustawDoUsuniecia({ rodzaj: 'projekt', projekt: p });
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
        )
      ) : widoczneSzablony.length === 0 ? (
        <p className="podpis">{t('projekty.brakSzablonow')}</p>
      ) : (
        <ul className="kafelki-projektow">
          {widoczneSzablony.map((poz) => {
            const urlMiniatury = miniaturyUrl.get(poz.klucz);
            const czyRewers = poz.rodzaj === 'rewers';
            return (
              <li key={poz.klucz} className="kafelek-projektu">
                <a
                  href={poz.href}
                  className="miniatura miniatura-rewersu"
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  {urlMiniatury ? (
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
                    <span className={`znacznik-strony-karty znacznik-strony-karty-${poz.rodzaj}`}>
                      {czyRewers ? t('projekty.stronaRewers') : t('projekty.stronaAwers')}
                    </span>
                  </div>
                  <span className="podpis">
                    {poz.zmieniono
                      ? t('projekty.zmieniono', { data: formatujDate(poz.zmieniono) })
                      : ''}
                  </span>
                  <span className="akcje">
                    <a className="przycisk glowny" href={poz.href}>
                      {t('start.otworz')}
                    </a>
                    <button type="button" disabled={trwa} onClick={() => void uzyjWProjekcie(poz)}>
                      {t('projekty.uzyjWProjekcie')}
                    </button>
                    <button
                      type="button"
                      disabled={trwa}
                      onClick={() => void eksportujSzablonKafelka(poz)}
                    >
                      {t('projekty.eksportuj')}
                    </button>
                    <button
                      type="button"
                      disabled={trwa}
                      aria-label={
                        czyRewers
                          ? t('projekty.usunRewersEtykieta', { nazwa: poz.nazwa })
                          : t('start.usunProjekt', { nazwa: poz.nazwa })
                      }
                      onClick={(e) => {
                        otwierajacy.current = e.currentTarget;
                        ustawDoUsuniecia({ rodzaj: 'szablon', pozycja: poz });
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
