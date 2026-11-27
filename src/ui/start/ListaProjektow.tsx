import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  eksportujProjekt,
  ROZSZERZENIE_PROJEKTU,
  ROZSZERZENIE_SZABLONU,
} from '../../dane/archiwum';
import {
  kluczMiniaturyRewersu,
  kluczMiniaturySzablonu,
  type PodsumowanieProjektu,
} from '../../dane/baza';
import type { WpisSzablonu } from '../../dane/bibliotekaSzablonow';
import { BladDanych } from '../../dane/schemat';
import { formatujDate, t, tn } from '../../i18n';
import { baza } from '../bazaUI';
import { kluczMiniaturyBiblioteki, zapiszMiniatureWpisuSzablonu } from '../miniaturaRewersu';
import { usePasekKomunikatu } from '../PasekKomunikatu';
import { nazwaPliku, zapiszPlik } from '../pliki';
import { poOstatnimZapisie } from '../useProjekt';
import {
  adresMiniatury,
  dorysujMiniatury,
  filtrujISortuj,
  nazwaCelu,
  SORTOWANIA,
  usunZCofaniem,
  type BrakujacaMiniatura,
  type CelUsuniecia,
  type Sortowanie,
} from './mojeSzablony';

export type ZakladkaStart = 'projekty' | 'szablony';
type FiltrSzablonow = 'wszystkie' | 'awers' | 'rewers';

const KLUCZ_ZAKLADKI = 'karty.zakladkaStart';

export function odczytajZakladkeStart(): ZakladkaStart {
  try {
    return sessionStorage.getItem(KLUCZ_ZAKLADKI) === 'szablony' ? 'szablony' : 'projekty';
  } catch {
    return 'projekty';
  }
}

export function zapiszZakladkeStart(z: ZakladkaStart) {
  try {
    sessionStorage.setItem(KLUCZ_ZAKLADKI, z);
  } catch {
    // Tryb prywatny – pomijamy zapis w sessionStorage.
  }
}

/** Otwiera ekran startowy na zakładce „Moje szablony” (np. „Pokaż wszystkie”). */
export function pokazMojeSzablony() {
  zapiszZakladkeStart('szablony');
  window.location.hash = '#/';
}

const komunikat = (e: unknown) =>
  e instanceof BladDanych
    ? e.message
    : t('projekty.bladNieoczekiwany', { szczegoly: String(e instanceof Error ? e.message : e) });

function wymiaryWpisuSzablonu(w: WpisSzablonu): string {
  const r = w.szablon?.rozmiar ?? w.rewers?.rozmiar;
  if (!r) return '';
  if (r.tryb === 'sloty') {
    return `${Math.round(r.slot.szerokosc * r.kolumny)}×${Math.round(r.slot.wysokosc * r.rzedy)}`;
  }
  return `${Math.round(r.szerokosc)}×${Math.round(r.wysokosc)}`;
}

/**
 * Środkowa kolumna ekranu startowego (Plan S, S3, sekcja 5.1) z dwiema równorzędnymi zakładkami:
 * - „Moje projekty”: talie/arkusze kart (podgląd Przód + Tył obok siebie, jeśli oba są);
 * - „Moje szablony”: niezależna tabela `szablony` (przody z przypiętymi tyłami i samodzielne tyły),
 *   wymiary, liczba kopii w projektach, Edytuj, Duplikuj, Eksport, Usuń z „Cofnij”.
 */
export function ListaProjektow({
  odswiezenie = 0,
  zakladka: zakladkaZewn,
  onZmienZakladke,
}: {
  odswiezenie?: number;
  zakladka?: ZakladkaStart;
  onZmienZakladke?: (z: ZakladkaStart) => void;
}) {
  const [zakladkaWewn, ustawZakladkeWewn] = useState<ZakladkaStart>(odczytajZakladkeStart);
  const zakladka = zakladkaZewn ?? zakladkaWewn;

  const [filtr, ustawFiltr] = useState<FiltrSzablonow>('wszystkie');
  const [fraza, ustawFraze] = useState('');
  const [sortowanie, ustawSortowanie] = useState<Sortowanie>('zmiana-nowe');
  const [zaznaczanie, ustawZaznaczanie] = useState(false);
  const [zaznaczone, ustawZaznaczone] = useState<ReadonlySet<string>>(new Set());
  const [lista, ustawListe] = useState<PodsumowanieProjektu[]>();
  const [szablonyBib, ustawSzablonyBib] = useState<WpisSzablonu[]>([]);
  const [kopieWProjektach, ustawKopieWProjektach] = useState<Map<string, number>>(new Map());
  const [miniatury, ustawMiniatury] = useState<Map<string, string>>(new Map());
  const [blad, ustawBlad] = useState<string>();
  const [status, ustawStatus] = useState('');
  const [trwa, ustawTrwa] = useState(false);
  const { pasek, pokaz, ukryj } = usePasekKomunikatu();
  const wToku = useRef(false);

  const odczyt = useRef(0);
  const naglowek = useRef<HTMLHeadingElement>(null);
  const wyrenderowaneKarty = useRef<Set<string>>(new Set());

  const zakonczZaznaczanie = () => {
    ustawZaznaczanie(false);
    ustawZaznaczone(new Set());
  };

  const ustawZakladke = (z: ZakladkaStart) => {
    if (onZmienZakladke) onZmienZakladke(z);
    else {
      ustawZakladkeWewn(z);
      zapiszZakladkeStart(z);
    }
    ustawFraze('');
    zakonczZaznaczanie();
  };

  const odswiez = useCallback(() => {
    const numer = ++odczyt.current;
    poOstatnimZapisie()
      .then(() =>
        Promise.all([
          baza().lista(),
          baza().szablonyBiblioteki(),
          baza().liczbaKopiiSzablonow(),
          baza().miniatury(),
        ]),
      )
      .then(([l, sz, liczniki, m]) => {
        if (numer !== odczyt.current) return;
        ustawListe(l);
        ustawSzablonyBib(sz);
        ustawKopieWProjektach(liczniki);
        ustawMiniatury(m);
      })
      .catch((e: unknown) => {
        if (numer === odczyt.current) ustawBlad(komunikat(e));
      });
  }, []);
  useEffect(odswiez, [odswiez, odswiezenie]);

  const widoczneSzablony = useMemo(
    () =>
      filtrujISortuj(
        filtr === 'wszystkie' ? szablonyBib : szablonyBib.filter((s) => s.rodzaj === filtr),
        fraza,
        sortowanie,
      ),
    [szablonyBib, filtr, fraza, sortowanie],
  );

  const widoczneProjekty = useMemo(
    () => (lista ? filtrujISortuj(lista, fraza, sortowanie) : undefined),
    [lista, fraza, sortowanie],
  );

  const kluczeWidoczne = useMemo<string[]>(
    () =>
      zakladka === 'projekty'
        ? (widoczneProjekty ?? []).map((p) => p.id)
        : widoczneSzablony.map((s) => s.id),
    [zakladka, widoczneProjekty, widoczneSzablony],
  );
  const zaznaczoneWidoczne = kluczeWidoczne.filter((k) => zaznaczone.has(k));
  const wszystkieZaznaczone =
    kluczeWidoczne.length > 0 && zaznaczoneWidoczne.length === kluczeWidoczne.length;

  const miniaturyUrl = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const [k, svg] of miniatury) mapa.set(k, adresMiniatury(svg));
    return mapa;
  }, [miniatury]);

  // Generowanie brakujących miniatur projektów.
  useEffect(() => {
    if (zakladka !== 'projekty' || !widoczneProjekty) return;
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
  }, [zakladka, widoczneProjekty, miniatury]);

  // Generowanie brakujących miniatur dla „Moich szablonów” (przody i przypięte tyły).
  useEffect(() => {
    if (zakladka !== 'szablony' || widoczneSzablony.length === 0) return;
    const poId = new Map(szablonyBib.map((w) => [w.id, w] as const));
    const doNarysowania: WpisSzablonu[] = [];
    const dodaj = (w: WpisSzablonu | undefined) => {
      if (!w) return;
      const klucz = kluczMiniaturyBiblioteki(w.id);
      if (
        !miniatury.has(klucz) &&
        !wyrenderowaneKarty.current.has(klucz) &&
        !doNarysowania.some((x) => x.id === w.id)
      ) {
        doNarysowania.push(w);
      }
    };
    for (const w of widoczneSzablony) {
      dodaj(w);
      if (w.domyslnyRewersId) dodaj(poId.get(w.domyslnyRewersId));
    }
    if (doNarysowania.length === 0) return;

    let aktywny = true;
    void (async () => {
      const nowe = new Map<string, string>();
      for (const w of doNarysowania) {
        if (!aktywny) break;
        const klucz = kluczMiniaturyBiblioteki(w.id);
        wyrenderowaneKarty.current.add(klucz);
        try {
          const svg = await zapiszMiniatureWpisuSzablonu(w);
          if (svg) nowe.set(klucz, svg);
        } catch {
          // Zostaje placeholder na kafelku.
        }
      }
      if (aktywny && nowe.size > 0) {
        ustawMiniatury((pop) => new Map([...pop, ...nowe]));
      }
    })();
    return () => {
      aktywny = false;
    };
  }, [zakladka, widoczneSzablony, szablonyBib, miniatury]);

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

  const eksportujSzablonKafelka = (w: WpisSzablonu) =>
    wykonaj(async () => {
      const { bajty } = await baza().eksportujSzablonZBiblioteki(w.id);
      zapiszPlik(bajty, 'application/zip', nazwaPliku(w.nazwa, ROZSZERZENIE_SZABLONU));
      return w.rodzaj === 'rewers'
        ? t('projekty.wyeksportowanoRewers', { nazwa: w.nazwa })
        : t('projekty.wyeksportowano', { nazwa: w.nazwa });
    });

  const duplikujSzablon = (w: WpisSzablonu) =>
    wykonaj(async () => {
      ukryj();
      const nowy =
        w.rodzaj === 'awers' && w.szablon
          ? await baza().dodajSzablonDoBiblioteki(w.szablon, w.role, {
              ...(w.domyslnyRewersId ? { domyslnyRewersId: w.domyslnyRewersId } : {}),
              bezDeduplikacji: true,
            })
          : w.rewers
            ? await baza().dodajRewersDoBiblioteki(w.rewers, w.role, { bezDeduplikacji: true })
            : undefined;
      if (!nowy) return;
      const wpis = await baza().szablonBiblioteki(nowy.id);
      if (wpis) await zapiszMiniatureWpisuSzablonu(wpis).catch(() => undefined);
      return t('projekty.zduplikowano', { nazwa: wpis?.nazwa ?? w.nazwa });
    });

  /** Usuwa projekty (z „Cofnij”). */
  const usunProjekty = (cele: CelUsuniecia[]) => {
    if (cele.length === 0) return;
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

  /** Usuwa szablony z „Moich szablonów” (kopie w projektach pozostają nietknięte) z paskiem „Cofnij”. */
  const usunSzablony = (wpisy: WpisSzablonu[]) => {
    if (wpisy.length === 0) return;
    naglowek.current?.focus();
    void wykonaj(async () => {
      const usuniete: WpisSzablonu[] = [];
      for (const w of wpisy) {
        const u = await baza().usunSzablonZBiblioteki(w.id);
        if (u) usuniete.push(u);
      }
      ustawStatus('');
      zakonczZaznaczanie();
      if (usuniete.length === 0) return;
      const jeden = usuniete.length === 1 ? usuniete[0]! : undefined;
      const kopie = jeden ? (kopieWProjektach.get(jeden.id) ?? 0) : 0;
      pokaz({
        tekst: jeden
          ? kopie > 0
            ? tn('szablony.usunietoZKopiami', kopie, { nazwa: jeden.nazwa })
            : t('szablony.usunieto', { nazwa: jeden.nazwa })
          : tn('pasek.usunietoWiele', usuniete.length),
        akcja: {
          etykieta: t('pasek.cofnij'),
          wykonaj: () => {
            naglowek.current?.focus();
            void wykonaj(async () => {
              for (const u of usuniete) await baza().przywrocSzablonWBibliotece(u);
              wyrenderowaneKarty.current.clear();
              return jeden
                ? t('pasek.przywrocono', { nazwa: jeden.nazwa })
                : tn('pasek.przywroconoWiele', usuniete.length);
            });
          },
        },
      });
    });
  };

  const usunZaznaczone = () => {
    if (zakladka === 'projekty' && widoczneProjekty) {
      const cele: CelUsuniecia[] = widoczneProjekty
        .filter((p) => zaznaczone.has(p.id))
        .map((p) => ({ rodzaj: 'projekt', projekt: p }));
      usunProjekty(cele);
    } else if (zakladka === 'szablony') {
      usunSzablony(widoczneSzablony.filter((w) => zaznaczone.has(w.id)));
    }
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
        <div className="riso-zakladki">
          <h1 id="moje-projekty" ref={naglowek} tabIndex={-1} className="riso-h1">
            {zakladka === 'projekty' ? t('start.mojeProjekty') : t('start.mojeSzablony')}{' '}
            <span className="riso-licznik">{liczbaGlowna}</span>
          </h1>
          <div role="tablist" aria-label={t('start.zakladkiListy')} className="riso-zakladki">
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
              {t('start.szablonyLink', { n: szablonyBib.length })}
            </button>
          </div>
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
              aria-label={t('lista.sortuj')}
            >
              {SORTOWANIA.map((s) => (
                <option key={s} value={s}>
                  {t(`lista.sort.${s}`)}
                </option>
              ))}
            </select>
          </label>
          {kluczeWidoczne.length > 0 && (
            <button
              type="button"
              className="riso-przycisk-maly"
              onClick={() => (zaznaczanie ? zakonczZaznaczanie() : ustawZaznaczanie(true))}
            >
              {zaznaczanie ? t('biblioteka.gotowe') : t('lista.zaznacz')}
            </button>
          )}
        </div>
      </div>

      {zakladka === 'szablony' && szablonyBib.length > 0 && (
        <div className="riso-pasek-filtrow" role="group" aria-label={t('projekty.filtrWszystkie')}>
          {(
            [
              ['wszystkie', 'projekty.filtrWszystkie'],
              ['awers', 'projekty.filtrAwersy'],
              ['rewers', 'projekty.filtrRewersy'],
            ] as const
          ).map(([f, klucz]) => (
            <button
              key={f}
              type="button"
              className="riso-przycisk-maly"
              aria-pressed={filtr === f}
              onClick={() => ustawFiltr(f)}
            >
              {t(klucz)}
            </button>
          ))}
        </div>
      )}

      {zaznaczanie && kluczeWidoczne.length > 0 && (
        <div className="riso-pasek-zaznaczenia">
          <label className="wybor-wszystkich">
            <input
              type="checkbox"
              checked={wszystkieZaznaczone}
              onChange={() =>
                ustawZaznaczone(wszystkieZaznaczone ? new Set() : new Set(kluczeWidoczne))
              }
            />{' '}
            {t('lista.zaznaczWszystkie')}
          </label>
          <span>{t('lista.zaznaczono', { n: zaznaczoneWidoczne.length })}</span>
          {zaznaczoneWidoczne.length > 0 && (
            <button
              type="button"
              className="riso-przycisk-maly"
              disabled={trwa}
              onClick={usunZaznaczone}
            >
              {t('lista.usunZaznaczone')}
            </button>
          )}
        </div>
      )}

      {blad && (
        <p className="blad" role="alert">
          {blad}
        </p>
      )}
      {status && (
        <p className="status" role="status">
          {status}
        </p>
      )}

      {zakladka === 'projekty' ? (
        !widoczneProjekty ? (
          <p className="podpis">{t('aplikacja.wczytywanieStrony')}</p>
        ) : widoczneProjekty.length === 0 ? (
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
                    <div
                      className={`riso-karta-okladka${urlAwersu && urlRewersu ? ' riso-karta-para' : ''}`}
                    >
                      {urlAwersu || urlRewersu ? (
                        <>
                          {urlAwersu && <img alt="" src={urlAwersu} />}
                          {urlRewersu && <img alt="" src={urlRewersu} />}
                        </>
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
                        onClick={() => usunProjekty([{ rodzaj: 'projekt', projekt: p }])}
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
          {widoczneSzablony.map((w) => {
            const urlGlowny = miniaturyUrl.get(kluczMiniaturyBiblioteki(w.id));
            const urlTylu =
              w.rodzaj === 'awers' && w.domyslnyRewersId
                ? miniaturyUrl.get(kluczMiniaturyBiblioteki(w.domyslnyRewersId))
                : undefined;
            const czyRewers = w.rodzaj === 'rewers';
            const href = `#/szablon/${encodeURIComponent(w.id)}`;
            const wymiary = wymiaryWpisuSzablonu(w);
            const liczbaKopii = kopieWProjektach.get(w.id) ?? 0;
            return (
              <li key={w.id} className={klasaKafelka(w.id)} data-testid="kafelek-szablonu">
                {zaznaczanie && (
                  <label className="riso-wybor-kafelka">
                    <input
                      type="checkbox"
                      checked={zaznaczone.has(w.id)}
                      onChange={() => przelaczZaznaczenie(w.id)}
                      aria-label={t('lista.zaznaczEtykieta', { nazwa: w.nazwa })}
                    />
                  </label>
                )}
                <a href={href} className="riso-podglad miniatura" aria-hidden="true" tabIndex={-1}>
                  <div
                    className={`riso-karta-okladka${urlGlowny && urlTylu ? ' riso-karta-para' : ''}`}
                  >
                    {urlGlowny || urlTylu ? (
                      <>
                        {urlGlowny && <img alt="" src={urlGlowny} />}
                        {urlTylu && <img alt="" src={urlTylu} />}
                      </>
                    ) : (
                      <div className="riso-karta-zastepcza">◆</div>
                    )}
                  </div>
                </a>

                <div className="riso-kafelek-meta-gora">
                  <span className="riso-kafelek-format-grupa">
                    <span className="riso-wymiar-badge">
                      {czyRewers ? t('projekty.stronaRewers') : t('projekty.stronaAwers')}
                    </span>
                    {wymiary && <span className="riso-wymiar-badge">{wymiary}</span>}
                  </span>
                  <span>{formatujDate(w.zmieniono)}</span>
                </div>

                <h3 className="riso-kafelek-tytul naglowek-kafelka-projektu">
                  <a href={href} className="nazwa">
                    {w.nazwa}
                  </a>
                </h3>

                <div className="riso-kafelek-liczniki">
                  {liczbaKopii > 0
                    ? tn('szablony.kopieWProjektach', liczbaKopii)
                    : t('szablony.nieuzywany')}
                </div>

                <div className="riso-kafelek-akcje">
                  <div className="riso-kafelek-glowne">
                    <a className="riso-btn-otworz" href={href}>
                      {t('szablony.kafelekEdytuj')}
                    </a>
                    <button
                      type="button"
                      className="riso-btn-drukuj"
                      disabled={trwa}
                      aria-label={t('projekty.duplikujEtykieta', { nazwa: w.nazwa })}
                      onClick={() => void duplikujSzablon(w)}
                    >
                      {t('szablony.kafelekDuplikuj')}
                    </button>
                  </div>
                  <div className="riso-kafelek-drugie">
                    <button
                      type="button"
                      className="riso-link-akcja"
                      disabled={trwa}
                      onClick={() => void eksportujSzablonKafelka(w)}
                    >
                      {t('szablony.eksport')}
                    </button>
                    <button
                      type="button"
                      className="riso-link-akcja"
                      disabled={trwa}
                      aria-label={
                        czyRewers
                          ? t('projekty.usunRewersEtykieta', { nazwa: w.nazwa })
                          : t('szablony.usunEtykieta', { nazwa: w.nazwa })
                      }
                      onClick={() => usunSzablony([w])}
                    >
                      {t('szablony.usun')}
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
