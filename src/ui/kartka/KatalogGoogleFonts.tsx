import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { unikalneId } from '../../dane/czcionki';
import { dodajZasoby } from '../../dane/edycja';
import {
  KATALOG_GOOGLE_FONTS,
  adresyPodgladuGoogleFonts,
  czyRodzinaDodana,
  maPolskieZnaki,
  pobierzDowolnaRodzineGoogle,
  pobierzRodzineGoogle,
  wczytajPelnyKatalogGoogleFonts,
  zapasowaRodzinaKategorii,
  type KategoriaGoogleFonts,
  type PozycjaKataloguGoogle,
} from '../../dane/googleFonts';
import { BladDanych, MAKS_DLUGOSC_ID_ZASOBU } from '../../dane/schemat';
import { t, tn } from '../../i18n';
import type { WgranaCzcionka } from '../../dane/czcionki';
import {
  dolaczRodzineGlobalnaDoProjektu,
  listaRodzinCzcionekGlobalnych,
  zapiszCzcionkiGlobalnie,
} from '../zasobyGlobalne';
import type { ProjektWEdycji } from '../useProjekt';

type FiltrKategorii = 'wszystkie' | KategoriaGoogleFonts;

const KATEGORIE: readonly FiltrKategorii[] = [
  'wszystkie',
  'ozdobna',
  'szeryfowa',
  'bezszeryfowa',
  'pisana',
  'maszynowa',
];

const PORCJA_LISTY = 150;
const WSTEPNY_PODGLAD = 20;

const komunikat = (e: unknown) =>
  e instanceof BladDanych ? e.message : String(e instanceof Error ? e.message : e);

/**
 * Pełny katalog Google Fonts (~1800 rodzin łacińskich, w tym ~1500 z polskimi znakami)
 * ładowany leniwie po rozwinięciu + pobieranie dowolnego kroju po nazwie.
 * Podgląd CSS2 (`&text=...`) dołącza wyłącznie dla krojów widocznych na ekranie,
 * a pliki TTF pobiera dopiero po kliknięciu użytkownika i zapisuje lokalnie w przeglądarce.
 */
export function KatalogGoogleFonts({
  edycja,
  onStatus,
  onBlad,
  onPobranoGlobalnie,
}: {
  edycja?: ProjektWEdycji;
  onStatus: (tekst: string) => void;
  onBlad: (tekst: string | undefined) => void;
  onPobranoGlobalnie?: () => void;
}) {
  const [otwarty, ustawOtwarty] = useState(false);
  const [katalog, ustawKatalog] = useState<readonly PozycjaKataloguGoogle[]>(KATALOG_GOOGLE_FONTS);
  const [filtr, ustawFiltr] = useState<FiltrKategorii>('wszystkie');
  const [tylkoPolskie, ustawTylkoPolskie] = useState(true);
  const [szukaj, ustawSzukaj] = useState('');
  const [limit, ustawLimit] = useState(PORCJA_LISTY);
  const [wlasnaNazwa, ustawWlasnaNazwe] = useState('');
  const [podgladWlasnej, ustawPodgladWlasnej] = useState('');
  const [pobieranaId, ustawPobieranaId] = useState<string>();
  const [globalneRodziny, ustawGlobalneRodziny] = useState<Set<string>>(new Set());
  const [podgladane, ustawPodgladane] = useState<Set<string>>(new Set());
  const kontrolerRef = useRef<AbortController | null>(null);
  const listaRef = useRef<HTMLUListElement | null>(null);
  const zaladowanePodgladyRef = useRef<{ probka: string; rodziny: Set<string> }>({
    probka: '',
    rodziny: new Set(),
  });
  const idKategorii = useId();
  const idWlasnej = useId();
  const idPolskie = useId();

  useEffect(
    () => () => {
      kontrolerRef.current?.abort();
      kontrolerRef.current = null;
    },
    [],
  );

  // Leniwe wczytanie pełnego indeksu Google Fonts (~1800 rodzin) po otwarciu katalogu.
  useEffect(() => {
    if (!otwarty) return;
    let aktywny = true;
    void wczytajPelnyKatalogGoogleFonts()
      .then((pelny) => {
        if (aktywny && pelny.length > 0) ustawKatalog(pelny);
      })
      .catch(() => undefined);
    return () => {
      aktywny = false;
    };
  }, [otwarty]);

  // Odświeżenie listy rodzin zapisanych globalnie przy otwarciu katalogu.
  useEffect(() => {
    if (!otwarty) return;
    let aktywny = true;
    void listaRodzinCzcionekGlobalnych().then((grupy) => {
      if (aktywny) ustawGlobalneRodziny(new Set(grupy.map((g) => g.rodzina.toLowerCase())));
    });
    return () => {
      aktywny = false;
    };
  }, [otwarty, edycja?.projekt.zasoby]);

  // Debounce podglądu dowolnej wpisanej nazwy z Google Fonts.
  const czystaWlasna = wlasnaNazwa.trim().replace(/\s+/g, ' ');
  useEffect(() => {
    if (!czystaWlasna) return;
    const timer = setTimeout(() => ustawPodgladWlasnej(czystaWlasna), 350);
    return () => clearTimeout(timer);
  }, [czystaWlasna]);
  const aktywnyPodgladWlasnej = czystaWlasna ? podgladWlasnej : '';

  const probka = t('googleFonts.probka');

  const fraza = szukaj.trim().toLowerCase();
  const widoczne = useMemo(
    () =>
      katalog.filter((p) => {
        if (tylkoPolskie && !p.polskieZnaki) return false;
        if (filtr !== 'wszystkie' && p.kategoria !== filtr) return false;
        if (!fraza) return true;
        return p.rodzina.toLowerCase().includes(fraza) || p.autor.toLowerCase().includes(fraza);
      }),
    [katalog, tylkoPolskie, filtr, fraza],
  );

  const wyswietlane = useMemo(() => widoczne.slice(0, limit), [widoczne, limit]);

  // Obserwuje wyłącznie widoczne wiersze listy, żeby nie pobierać CSS2 dla ~1800 krojów naraz.
  useEffect(() => {
    if (!otwarty || typeof IntersectionObserver === 'undefined') return;
    const lista = listaRef.current;
    if (!lista) return;
    const obs = new IntersectionObserver(
      (wpisy) => {
        const nowe: string[] = [];
        for (const wpis of wpisy) {
          if (!wpis.isIntersecting) continue;
          const rodzina = (wpis.target as HTMLElement).dataset.rodzina;
          if (rodzina) nowe.push(rodzina);
          obs.unobserve(wpis.target);
        }
        if (nowe.length === 0) return;
        ustawPodgladane((pop) => {
          let zmieniono = false;
          const nast = new Set(pop);
          for (const r of nowe) {
            if (!nast.has(r)) {
              nast.add(r);
              zmieniono = true;
            }
          }
          return zmieniono ? nast : pop;
        });
      },
      { root: lista, rootMargin: '250px 0px' },
    );
    for (const el of lista.querySelectorAll<HTMLElement>('[data-rodzina]')) {
      obs.observe(el);
    }
    return () => obs.disconnect();
  }, [otwarty, wyswietlane]);

  // Leniwie dołącza arkusze CSS2 (`&text=...`) wyłącznie dla nowo widocznych krojów (bez duplikatów).
  useEffect(() => {
    if (!otwarty || typeof document === 'undefined') return;
    if (zaladowanePodgladyRef.current.probka !== probka) {
      for (const el of document.head.querySelectorAll('link[data-google-fonts-podglad]')) {
        el.remove();
      }
      zaladowanePodgladyRef.current = { probka, rodziny: new Set() };
    }
    const timer = setTimeout(() => {
      const juzZaladowane = zaladowanePodgladyRef.current.rodziny;
      const nowe: string[] = [];
      const dodaj = (r: string) => {
        if (!juzZaladowane.has(r)) {
          juzZaladowane.add(r);
          nowe.push(r);
        }
      };
      for (const p of wyswietlane.slice(0, WSTEPNY_PODGLAD)) dodaj(p.rodzina);
      for (const r of podgladane) dodaj(r);
      if (aktywnyPodgladWlasnej) dodaj(aktywnyPodgladWlasnej);
      if (nowe.length === 0) return;

      for (const href of adresyPodgladuGoogleFonts(nowe, probka, 20)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.setAttribute('data-google-fonts-podglad', href);
        document.head.appendChild(link);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [otwarty, probka, wyswietlane, podgladane, aktywnyPodgladWlasnej]);

  const zapiszPobrane = async (
    rodzina: string,
    wgrane: WgranaCzcionka[],
    sygnal: AbortSignal,
    brakPolskichZnakow = false,
  ) => {
    if (wgrane.length === 0 || sygnal.aborted) return;
    await zapiszCzcionkiGlobalnie(wgrane).catch(() => undefined);
    ustawGlobalneRodziny((pop) => new Set([...pop, rodzina.toLowerCase()]));
    onPobranoGlobalnie?.();
    if (edycja) {
      let dodanych = 0;
      await edycja.zmienZZasobami((p, d) => {
        const obecneWarianty = new Set(
          p.zasoby.flatMap((z) =>
            z.rodzaj === 'czcionka' && z.rodzina === rodzina ? [z.wariant] : [],
          ),
        );
        const zajete = new Set([...p.zasoby.map((z) => z.id), ...d.keys()]);
        const nowe = wgrane
          .filter((w) => !obecneWarianty.has(w.opis.wariant))
          .map((w) => {
            const id = unikalneId(w.opis.id, zajete, MAKS_DLUGOSC_ID_ZASOBU);
            zajete.add(id);
            return { opis: { ...w.opis, id }, dane: w.dane };
          });
        dodanych = nowe.length;
        return dodanych > 0 ? dodajZasoby(p, d, nowe) : { projekt: p, dane: d };
      });
      if (!sygnal.aborted && dodanych > 0) {
        const tekst = tn('googleFonts.pobrano', dodanych, { rodzina });
        onStatus(brakPolskichZnakow ? `${tekst} ${t('googleFonts.brakPolskichUwaga')}` : tekst);
      }
    } else if (!sygnal.aborted) {
      const tekst = tn('googleFonts.pobranoGlobalnie', wgrane.length, { rodzina });
      onStatus(brakPolskichZnakow ? `${tekst} ${t('googleFonts.brakPolskichUwaga')}` : tekst);
    }
  };

  const pobierz = async (pozycja: PozycjaKataloguGoogle) => {
    if (kontrolerRef.current) return;
    const kontroler = new AbortController();
    kontrolerRef.current = kontroler;
    ustawPobieranaId(pozycja.id);
    onStatus('');
    onBlad(undefined);
    try {
      // Jeśli krój jest już zapisany globalnie, kopiujemy go do projektu lokalnie bez pobierania z sieci.
      if (edycja && globalneRodziny.has(pozycja.rodzina.toLowerCase())) {
        const dolaczono = await dolaczRodzineGlobalnaDoProjektu(pozycja.rodzina, edycja);
        if (dolaczono && !kontroler.signal.aborted) {
          onStatus(
            tn('googleFonts.pobrano', pozycja.warianty.length, { rodzina: pozycja.rodzina }),
          );
          return;
        }
      }
      const wgrane = await pobierzRodzineGoogle(pozycja, {
        zasoby: edycja?.projekt.zasoby ?? [],
        signal: kontroler.signal,
      });
      const brakPolskich = wgrane.some((w) => !maPolskieZnaki(w.czcionka));
      await zapiszPobrane(pozycja.rodzina, wgrane, kontroler.signal, brakPolskich);
    } catch (e) {
      if (!kontroler.signal.aborted) onBlad(komunikat(e));
    } finally {
      if (kontrolerRef.current === kontroler) {
        kontrolerRef.current = null;
        if (!kontroler.signal.aborted) ustawPobieranaId(undefined);
      }
    }
  };

  const pobierzWlasna = async (nazwaDocelowa?: string) => {
    if (kontrolerRef.current) return;
    const nazwa = (nazwaDocelowa ?? wlasnaNazwa).trim();
    if (!nazwa) return;
    const kontroler = new AbortController();
    kontrolerRef.current = kontroler;
    ustawPobieranaId('__wlasna__');
    onStatus('');
    onBlad(undefined);
    try {
      const { rodzina, wgrane, brakPolskichZnakow } = await pobierzDowolnaRodzineGoogle(nazwa, {
        zasoby: edycja?.projekt.zasoby ?? [],
        signal: kontroler.signal,
      });
      await zapiszPobrane(rodzina, wgrane, kontroler.signal, brakPolskichZnakow);
      if (!kontroler.signal.aborted && !nazwaDocelowa) ustawWlasnaNazwe('');
    } catch (e) {
      if (!kontroler.signal.aborted) onBlad(komunikat(e));
    } finally {
      if (kontrolerRef.current === kontroler) {
        kontrolerRef.current = null;
        if (!kontroler.signal.aborted) ustawPobieranaId(undefined);
      }
    }
  };

  const pozostalo = widoczne.length - wyswietlane.length;

  return (
    <details className="katalog-google-fonts" onToggle={(e) => ustawOtwarty(e.currentTarget.open)}>
      <summary>{t('googleFonts.otworz')}</summary>
      <p className="podpis">{t('googleFonts.opis')}</p>
      <div className="pole-panelu">
        <input
          type="search"
          aria-label={t('googleFonts.szukaj')}
          placeholder={t('googleFonts.szukaj')}
          value={szukaj}
          onChange={(e) => {
            ustawSzukaj(e.target.value);
            ustawLimit(PORCJA_LISTY);
          }}
        />
      </div>
      <div className="pole-panelu katalog-google-kategorie">
        <label htmlFor={idKategorii}>{t('googleFonts.kategorie')}</label>
        <select
          id={idKategorii}
          value={filtr}
          onChange={(e) => {
            ustawFiltr(e.target.value as FiltrKategorii);
            ustawLimit(PORCJA_LISTY);
          }}
        >
          {KATEGORIE.map((k) => (
            <option key={k} value={k}>
              {t(`googleFonts.kategoria.${k}`)}
            </option>
          ))}
        </select>
      </div>
      <label className="pole-wyboru katalog-google-polskie" htmlFor={idPolskie}>
        <input
          id={idPolskie}
          type="checkbox"
          checked={tylkoPolskie}
          onChange={(e) => {
            ustawTylkoPolskie(e.target.checked);
            ustawLimit(PORCJA_LISTY);
          }}
        />
        <span>{t('googleFonts.tylkoPolskie')}</span>
      </label>
      <p className="podpis katalog-google-liczba">
        {t('googleFonts.liczba', {
          widoczne: widoczne.length,
          wszystkie: katalog.length,
        })}
      </p>
      {widoczne.length === 0 ? (
        <div className="katalog-google-brak">
          <p className="podpis">{t('googleFonts.brakWynikow')}</p>
          {szukaj.trim() && (
            <button
              type="button"
              disabled={pobieranaId !== undefined}
              onClick={() => void pobierzWlasna(szukaj.trim())}
            >
              {pobieranaId === '__wlasna__'
                ? t('googleFonts.pobieram')
                : t('googleFonts.pobierzPoNazwiePrzycisk', { nazwa: szukaj.trim() })}
            </button>
          )}
        </div>
      ) : (
        <>
          <ul className="lista-google-fonts" ref={listaRef}>
            {wyswietlane.map((p) => {
              const dodana = edycja
                ? czyRodzinaDodana(p, edycja.projekt.zasoby)
                : globalneRodziny.has(p.rodzina.toLowerCase());
              const trwa = pobieranaId === p.id;
              const listaWariantow = p.warianty.map((w) => t(`wariant.${w.wariant}`)).join(', ');
              return (
                <li key={p.id} className="pozycja-google-font" data-rodzina={p.rodzina}>
                  <div className="pozycja-google-info">
                    <strong>{p.rodzina}</strong>
                    <span
                      className="podglad-google-font"
                      style={{
                        fontFamily: `"${p.rodzina}", ${zapasowaRodzinaKategorii(p.kategoria)}`,
                      }}
                    >
                      {probka}
                    </span>
                    <span className="podpis">
                      {t(p.polskieZnaki ? 'googleFonts.meta' : 'googleFonts.metaBezPl', {
                        kategoria: t(`googleFonts.kategoria.${p.kategoria}`),
                        warianty: listaWariantow,
                        licencja: p.licencja,
                        autor: p.autor,
                      })}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={dodana || pobieranaId !== undefined}
                    aria-label={
                      dodana
                        ? t('googleFonts.dodanoEtykieta', { rodzina: p.rodzina })
                        : t('googleFonts.pobierzEtykieta', { rodzina: p.rodzina })
                    }
                    onClick={() => void pobierz(p)}
                  >
                    {dodana
                      ? t('googleFonts.dodano')
                      : trwa
                        ? t('googleFonts.pobieram')
                        : t('googleFonts.pobierz')}
                  </button>
                </li>
              );
            })}
          </ul>
          {pozostalo > 0 && (
            <button
              type="button"
              className="katalog-google-wiecej"
              onClick={() => ustawLimit((l) => l + PORCJA_LISTY)}
            >
              {t('googleFonts.pokazWiecej', { pozostalo })}
            </button>
          )}
        </>
      )}
      <div className="katalog-google-dowolny">
        <label htmlFor={idWlasnej}>{t('googleFonts.dowolnaEtykieta')}</label>
        <p className="podpis">{t('googleFonts.dowolnaOpis')}</p>
        <div className="wiersz-przyciskow">
          <input
            id={idWlasnej}
            type="text"
            placeholder={t('googleFonts.dowolnaPlaceholder')}
            value={wlasnaNazwa}
            onChange={(e) => ustawWlasnaNazwe(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && wlasnaNazwa.trim() && pobieranaId === undefined) {
                e.preventDefault();
                void pobierzWlasna();
              }
            }}
          />
          <button
            type="button"
            disabled={!wlasnaNazwa.trim() || pobieranaId !== undefined}
            onClick={() => void pobierzWlasna()}
          >
            {pobieranaId === '__wlasna__' ? t('googleFonts.pobieram') : t('googleFonts.pobierz')}
          </button>
        </div>
        {aktywnyPodgladWlasnej && (
          <span
            className="podglad-google-font"
            style={{ fontFamily: `"${aktywnyPodgladWlasnej}", serif` }}
          >
            {probka}
          </span>
        )}
      </div>
    </details>
  );
}
