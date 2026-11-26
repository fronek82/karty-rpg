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
import { BladDanych } from '../../dane/schemat';
import { formatujDate, t, tn } from '../../i18n';
import { baza, nowyProjektZAwersuZProjektu, nowyProjektZRewersuZProjektu } from '../bazaUI';
import { usePasekKomunikatu } from '../PasekKomunikatu';
import { nazwaPliku, zapiszPlik } from '../pliki';
import { poOstatnimZapisie } from '../useProjekt';
import {
  adresMiniatury,
  brakujacaDlaPozycji,
  dorysujMiniatury,
  duplikujPozycje,
  filtrujISortuj,
  nazwaCelu,
  pozycjeSzablonow,
  SORTOWANIA,
  usunZCofaniem,
  type BrakujacaMiniatura,
  type CelUsuniecia,
  type PozycjaSzablonu,
  type Sortowanie,
} from './mojeSzablony';

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

function zapiszZakladke(z: Zakladka) {
  try {
    sessionStorage.setItem(KLUCZ_ZAKLADKI, z);
  } catch {
    // Tryb prywatny – pomijamy zapis w sessionStorage.
  }
}

/** Otwiera ekran startowy na zakładce „Moje szablony” (np. „Pokaż wszystkie”). */
export function pokazMojeSzablony() {
  zapiszZakladke('szablony');
  window.location.hash = '#/';
}

const komunikat = (e: unknown) =>
  e instanceof BladDanych
    ? e.message
    : t('projekty.bladNieoczekiwany', { szczegoly: String(e instanceof Error ? e.message : e) });

const przejdzDoProjektu = (id: string) => {
  window.location.hash = `#/projekt/${encodeURIComponent(id)}`;
};

/**
 * Środkowa kolumna ekranu startowego z dwiema zakładkami:
 * - „Moje projekty”: gotowe talie/arkusze kart (podgląd Awers + Rewers obok siebie, jeśli oba są);
 * - „Moje szablony”: pojedyncze wzory awersów i rewersów z filtrem i plakietką strony.
 * Obie mają wyszukiwarkę po nazwie, sortowanie i tryb zaznaczania wielu elementów. Usuwanie jest
 * natychmiastowe – pasek na dole ekranu pozwala je cofnąć.
 */
export function ListaProjektow({ odswiezenie = 0 }: { odswiezenie?: number }) {
  const [zakladka, ustawZakladkeStan] = useState<Zakladka>(odczytajZakladke);
  const [filtr, ustawFiltr] = useState<FiltrSzablonow>('wszystkie');
  const [fraza, ustawFraze] = useState('');
  const [sortowanie, ustawSortowanie] = useState<Sortowanie>('zmiana-nowe');
  const [zaznaczanie, ustawZaznaczanie] = useState(false);
  const [zaznaczone, ustawZaznaczone] = useState<ReadonlySet<string>>(new Set());
  const [lista, ustawListe] = useState<PodsumowanieProjektu[]>();
  const [awersy, ustawAwersy] = useState<WpisAwersuZProjektu[]>([]);
  const [rewersy, ustawRewersy] = useState<WpisRewersuZProjektu[]>([]);
  const [miniatury, ustawMiniatury] = useState<Map<string, string>>(new Map());
  const [blad, ustawBlad] = useState<string>();
  const [status, ustawStatus] = useState('');
  const [trwa, ustawTrwa] = useState(false);
  const { pasek, pokaz, ukryj } = usePasekKomunikatu();
  // Jedna operacja na bazie naraz (także „Cofnij” z paska – nie może wejść w trwające usuwanie).
  const wToku = useRef(false);

  const odczyt = useRef(0);
  const naglowek = useRef<HTMLHeadingElement>(null);
  const wyrenderowaneKarty = useRef<Set<string>>(new Set());

  const zakonczZaznaczanie = () => {
    ustawZaznaczanie(false);
    ustawZaznaczone(new Set());
  };

  const ustawZakladke = (z: Zakladka) => {
    ustawZakladkeStan(z);
    ustawFraze('');
    zakonczZaznaczanie();
    zapiszZakladke(z);
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

  const pozycje = useMemo(() => pozycjeSzablonow(awersy, rewersy), [awersy, rewersy]);

  const widoczneSzablony = useMemo(
    () =>
      filtrujISortuj(
        filtr === 'wszystkie' ? pozycje : pozycje.filter((p) => p.rodzaj === filtr),
        fraza,
        sortowanie,
      ),
    [pozycje, filtr, fraza, sortowanie],
  );

  const widoczneProjekty = useMemo(
    () => (lista ? filtrujISortuj(lista, fraza, sortowanie) : undefined),
    [lista, fraza, sortowanie],
  );

  /** Elementy bieżącej zakładki (po filtrze) z kluczem zaznaczenia. */
  const celeWidoczne = useMemo<{ klucz: string; cel: CelUsuniecia }[]>(
    () =>
      zakladka === 'projekty'
        ? (widoczneProjekty ?? []).map((p) => ({
            klucz: p.id,
            cel: { rodzaj: 'projekt', projekt: p },
          }))
        : widoczneSzablony.map((poz) => ({
            klucz: poz.klucz,
            cel: { rodzaj: 'szablon', pozycja: poz },
          })),
    [zakladka, widoczneProjekty, widoczneSzablony],
  );
  const zaznaczoneWidoczne = celeWidoczne.filter((c) => zaznaczone.has(c.klucz));
  const wszystkieZaznaczone =
    celeWidoczne.length > 0 && zaznaczoneWidoczne.length === celeWidoczne.length;

  const miniaturyUrl = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const [k, svg] of miniatury) mapa.set(k, adresMiniatury(svg));
    return mapa;
  }, [miniatury]);

  // Generowanie brakujących miniatur kart (awersów i rewersów) na żądanie.
  useEffect(() => {
    const brakujace: BrakujacaMiniatura[] = [];
    const dodajJesliBrak = (b: BrakujacaMiniatura) => {
      if (
        !miniatury.has(b.klucz) &&
        !wyrenderowaneKarty.current.has(b.klucz) &&
        !brakujace.some((x) => x.klucz === b.klucz)
      ) {
        brakujace.push(b);
      }
    };

    if (zakladka === 'projekty' && widoczneProjekty) {
      for (const p of widoczneProjekty) {
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
      for (const poz of widoczneSzablony) dodajJesliBrak(brakujacaDlaPozycji(poz));
    }
    if (brakujace.length === 0) return;

    let aktywny = true;
    void dorysujMiniatury(
      brakujace,
      () => aktywny,
      (k) => wyrenderowaneKarty.current.add(k),
    ).then((nowe) => {
      if (!aktywny || nowe.size === 0) return;
      ustawMiniatury((pop) => new Map([...pop, ...nowe]));
    });
    return () => {
      aktywny = false;
    };
  }, [zakladka, widoczneProjekty, widoczneSzablony, miniatury]);

  const wykonaj = async (zadanie: () => Promise<string | void>) => {
    if (wToku.current) return;
    wToku.current = true;
    ustawTrwa(true);
    ustawBlad(undefined);
    try {
      const wynik = await zadanie();
      if (wynik) ustawStatus(wynik);
      odswiez();
    } catch (e) {
      ustawBlad(komunikat(e));
    } finally {
      wToku.current = false;
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
          nazwaPliku(poz.rewers.nazwa, ROZSZERZENIE_SZABLONU),
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

  const duplikuj = (poz: PozycjaSzablonu) =>
    wykonaj(async () => {
      // Nowa zmiana w bazie – „Cofnij” z migawki sprzed niej by ją nadpisał.
      ukryj();
      return t('projekty.zduplikowano', { nazwa: await duplikujPozycje(poz) });
    });

  const zamontowany = useRef(true);
  useEffect(() => {
    zamontowany.current = true;
    return () => {
      zamontowany.current = false;
    };
  }, []);

  const uzyjWProjekcie = async (poz: PozycjaSzablonu) => {
    if (wToku.current) return;
    wToku.current = true;
    ukryj();
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

  /** Usuwa od razu (bez pytania); pasek „Cofnij” przywraca wszystkie usunięte elementy naraz. */
  const usun = (cele: CelUsuniecia[]) => {
    if (cele.length === 0) return;
    // Przycisk „Usuń” zaraz zniknie – fokus na nagłówek listy.
    naglowek.current?.focus();
    void wykonaj(async () => {
      const { przywroc, usuniete, pominiete } = await usunZCofaniem(cele);
      ustawStatus('');
      zakonczZaznaczanie();
      if (pominiete.length)
        ustawBlad(t('lista.pominietoUzywane', { nazwy: pominiete.map(nazwaCelu).join(', ') }));
      if (!usuniete.length) return;
      const jeden = usuniete.length === 1 ? nazwaCelu(usuniete[0]!) : undefined;
      pokaz({
        tekst: jeden
          ? t('pasek.usunieto', { nazwa: jeden })
          : tn('pasek.usunietoWiele', usuniete.length),
        akcja: {
          etykieta: t('pasek.cofnij'),
          wykonaj: () => {
            naglowek.current?.focus();
            void wykonaj(async () => {
              await przywroc();
              // Miniatury z migawki wracają z bazy; brakujące można dorysować ponownie.
              wyrenderowaneKarty.current.clear();
              return jeden
                ? t('pasek.przywrocono', { nazwa: jeden })
                : tn('pasek.przywroconoWiele', usuniete.length);
            });
          },
        },
      });
    });
  };

  const przelaczZaznaczenie = (klucz: string) =>
    ustawZaznaczone((z) => {
      const nowe = new Set(z);
      if (!nowe.delete(klucz)) nowe.add(klucz);
      return nowe;
    });

  const klasaKafelka = (klucz: string) =>
    zaznaczanie && zaznaczone.has(klucz)
      ? 'riso-kafelek kafelek-projektu zaznaczony'
      : 'riso-kafelek kafelek-projektu';

  const brakWynikow = fraza.trim() !== '' && (
    <p className="podpis">{t('lista.brakWynikow', { fraza: fraza.trim() })}</p>
  );

  const liczbaGlowna = String(
    zakladka === 'projekty' ? (widoczneProjekty?.length ?? 0) : widoczneSzablony.length,
  ).padStart(2, '0');

  const etykietaFormatu = (p: PodsumowanieProjektu): string => {
    if (p.pakiet === 'mausritter') return t('ui2.mausritterEtykieta');
    if (p.typStrony === 'rewers') return t('start.formatRewers');
    if (p.wymiary) {
      const { szer, wys } = p.wymiary;
      const a = Math.min(szer, wys);
      const b = Math.max(szer, wys);
      if (a === 63 && b === 88) return 'POKER';
      if (a === 44 && b === 67) return 'MINI EURO';
      if (a === 41 && b === 63) return 'MINI US';
      if (a === 70 && b === 120) return 'TAROT';
    }
    return t('start.formatWlasny');
  };

  return (
    <section className="lista-projektow" aria-labelledby="moje-projekty">
      <div className="riso-pasek-listy">
        <div className="riso-zakladki" role="tablist" aria-label={t('start.zakladkiListy')}>
          <h1 id="moje-projekty" ref={naglowek} tabIndex={-1} className="riso-h1">
            {zakladka === 'projekty' ? t('start.mojeProjekty') : t('start.mojeSzablony')}{' '}
            <span className="riso-licznik">{liczbaGlowna}</span>
          </h1>
          <button
            type="button"
            role="tab"
            aria-selected={zakladka === 'projekty'}
            className="riso-link-zakladka"
            onClick={() => ustawZakladke('projekty')}
          >
            {t('start.mojeProjekty')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={zakladka === 'szablony'}
            className="riso-link-zakladka"
            onClick={() => ustawZakladke('szablony')}
          >
            {t('start.szablonyLink', { n: pozycje.length })}
          </button>
        </div>

        <div className="riso-narzedzia-prawa">
          <label className="riso-szukaj">
            <span className="riso-szukaj-etykieta">{t('start.szukajEtykieta')}</span>
            <input
              type="search"
              value={fraza}
              onChange={(e) => ustawFraze(e.target.value)}
              aria-label={
                zakladka === 'projekty' ? t('lista.szukajProjektow') : t('lista.szukajSzablonow')
              }
            />
          </label>
          <label className="riso-sortuj">
            <span>{t('lista.sortuj')}</span>
            <select
              value={sortowanie}
              onChange={(e) => ustawSortowanie(e.target.value as Sortowanie)}
            >
              {SORTOWANIA.map((s) => (
                <option key={s} value={s}>
                  {t(`lista.sort.${s}`)}
                </option>
              ))}
            </select>
          </label>
          {!zaznaczanie && (
            <button
              type="button"
              className="riso-przycisk-maly"
              disabled={trwa || celeWidoczne.length === 0}
              onClick={() => ustawZaznaczanie(true)}
            >
              {t('lista.zaznacz')}
            </button>
          )}
        </div>
      </div>

      {(trwa || status) && (
        <p role="status" aria-live="polite" className="status">
          {trwa ? t('projekty.trwa') : status}
        </p>
      )}

      {zaznaczanie && (
        <div className="pasek-zaznaczenia" role="group" aria-label={t('lista.zaznaczanie')}>
          <label>
            <input
              type="checkbox"
              checked={wszystkieZaznaczone}
              ref={(el) => {
                if (el) el.indeterminate = zaznaczoneWidoczne.length > 0 && !wszystkieZaznaczone;
              }}
              onChange={() =>
                ustawZaznaczone(
                  wszystkieZaznaczone ? new Set() : new Set(celeWidoczne.map((c) => c.klucz)),
                )
              }
            />
            {t('lista.zaznaczWszystkie')}
          </label>
          <span>{t('lista.zaznaczono', { n: zaznaczoneWidoczne.length })}</span>
          <button
            type="button"
            className="niebezpieczny"
            disabled={trwa || zaznaczoneWidoczne.length === 0}
            onClick={() => usun(zaznaczoneWidoczne.map((c) => c.cel))}
          >
            {t('lista.usunZaznaczone')}
          </button>
          <button type="button" onClick={zakonczZaznaczanie}>
            {t('projekty.anuluj')}
          </button>
        </div>
      )}

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

      {widoczneProjekty === undefined ? (
        <p>{t('projekty.wczytywanie')}</p>
      ) : zakladka === 'projekty' ? (
        widoczneProjekty.length === 0 ? (
          brakWynikow || (
            <p className="podpis">
              {t('projekty.brak')} {t('start.pustaPodpowiedz')}
            </p>
          )
        ) : (
          <ul className="riso-siatka kafelki-projektow">
            {widoczneProjekty.map((p) => {
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
              const urlOkladki = urlAwersu ?? urlRewersu;
              const href = `#/projekt/${encodeURIComponent(p.id)}`;
              return (
                <li key={p.id} className={klasaKafelka(p.id)}>
                  {zaznaczanie && (
                    <label className="riso-wybor-kafelka">
                      <input
                        type="checkbox"
                        checked={zaznaczone.has(p.id)}
                        onChange={() => przelaczZaznaczenie(p.id)}
                        aria-label={t('lista.zaznaczEtykieta', { nazwa: p.nazwa })}
                      />
                    </label>
                  )}
                  <a
                    href={href}
                    className="riso-podglad miniatura"
                    aria-hidden="true"
                    tabIndex={-1}
                  >
                    <span className="riso-rog riso-rog-lg" />
                    <span className="riso-rog riso-rog-pg" />
                    <span className="riso-rog riso-rog-ld" />
                    <span className="riso-rog riso-rog-pd" />
                    <div className="riso-karta-okladka">
                      <div className="riso-karta-cien" />
                      {urlOkladki ? (
                        <img alt="" src={urlOkladki} />
                      ) : (
                        <div className="riso-karta-zastepcza">✦</div>
                      )}
                    </div>
                  </a>

                  <div className="riso-kafelek-meta-gora">
                    <span className="riso-kafelek-format-grupa">
                      <span>{etykietaFormatu(p)}</span>
                      {p.wymiary && (
                        <span className="riso-wymiar-badge">
                          {p.wymiary.szer}×{p.wymiary.wys}
                        </span>
                      )}
                    </span>
                    <span>{formatujDate(p.zmieniono)}</span>
                  </div>

                  <h3 className="riso-kafelek-tytul naglowek-kafelka-projektu">
                    <a href={href} className="nazwa">
                      {p.nazwa}
                    </a>
                  </h3>

                  <div className="riso-kafelek-liczniki">
                    {t('start.podsumowanie', { strony: p.liczbaStron, karty: p.liczbaKart })}
                  </div>

                  <div className="riso-kafelek-akcje">
                    <div className="riso-kafelek-glowne">
                      <a className="riso-btn-otworz" href={href}>
                        {t('start.otworz')}
                      </a>
                      <a className="riso-btn-drukuj" href={href}>
                        {t('start.drukuj')}
                      </a>
                    </div>
                    <div className="riso-kafelek-drugie">
                      <button
                        type="button"
                        className="riso-link-akcja"
                        disabled={trwa}
                        onClick={() => void eksportujProjektKafelka(p)}
                      >
                        {t('projekty.eksportuj')}
                      </button>
                      <button
                        type="button"
                        className="riso-link-akcja"
                        disabled={trwa}
                        aria-label={t('start.usunProjekt', { nazwa: p.nazwa })}
                        onClick={() => usun([{ rodzaj: 'projekt', projekt: p }])}
                      >
                        {t('projekty.usun')}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : widoczneSzablony.length === 0 ? (
        brakWynikow || <p className="podpis">{t('projekty.brakSzablonow')}</p>
      ) : (
        <ul className="riso-siatka kafelki-projektow">
          {widoczneSzablony.map((poz) => {
            const urlMiniatury = miniaturyUrl.get(poz.klucz);
            const czyRewers = poz.rodzaj === 'rewers';
            return (
              <li key={poz.klucz} className={klasaKafelka(poz.klucz)}>
                {zaznaczanie && (
                  <label className="riso-wybor-kafelka">
                    <input
                      type="checkbox"
                      checked={zaznaczone.has(poz.klucz)}
                      onChange={() => przelaczZaznaczenie(poz.klucz)}
                      aria-label={t('lista.zaznaczEtykieta', { nazwa: poz.nazwa })}
                    />
                  </label>
                )}
                <a
                  href={poz.href}
                  className="riso-podglad miniatura"
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  <span className="riso-rog riso-rog-lg" />
                  <span className="riso-rog riso-rog-pg" />
                  <span className="riso-rog riso-rog-ld" />
                  <span className="riso-rog riso-rog-pd" />
                  <div className="riso-karta-okladka">
                    <div className="riso-karta-cien" />
                    {urlMiniatury ? (
                      <img alt="" src={urlMiniatury} />
                    ) : (
                      <div className="riso-karta-zastepcza">◆</div>
                    )}
                  </div>
                </a>

                <div className="riso-kafelek-meta-gora">
                  <span className="riso-wymiar-badge">
                    {czyRewers ? t('projekty.stronaRewers') : t('projekty.stronaAwers')}
                  </span>
                  <span>{poz.zmieniono ? formatujDate(poz.zmieniono) : ''}</span>
                </div>

                <h3 className="riso-kafelek-tytul naglowek-kafelka-projektu">
                  <a href={poz.href} className="nazwa">
                    {poz.nazwa}
                  </a>
                </h3>

                <div className="riso-kafelek-akcje">
                  <div className="riso-kafelek-glowne">
                    <a className="riso-btn-otworz" href={poz.href}>
                      {t('start.otworz')}
                    </a>
                    <button
                      type="button"
                      className="riso-btn-drukuj"
                      disabled={trwa}
                      onClick={() => void uzyjWProjekcie(poz)}
                    >
                      {t('projekty.uzyjWProjekcie')}
                    </button>
                  </div>
                  <div className="riso-kafelek-drugie">
                    <button
                      type="button"
                      className="riso-link-akcja"
                      disabled={trwa}
                      aria-label={t('projekty.duplikujEtykieta', { nazwa: poz.nazwa })}
                      onClick={() => void duplikuj(poz)}
                    >
                      {t('projekty.duplikuj')}
                    </button>
                    <button
                      type="button"
                      className="riso-link-akcja"
                      disabled={trwa}
                      onClick={() => void eksportujSzablonKafelka(poz)}
                    >
                      {t('projekty.eksportuj')}
                    </button>
                    <button
                      type="button"
                      className="riso-link-akcja"
                      disabled={trwa}
                      aria-label={
                        czyRewers
                          ? t('projekty.usunRewersEtykieta', { nazwa: poz.nazwa })
                          : t('start.usunProjekt', { nazwa: poz.nazwa })
                      }
                      onClick={() => usun([{ rodzaj: 'szablon', pozycja: poz }])}
                    >
                      {t('projekty.usun')}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {pasek}
    </section>
  );
}
