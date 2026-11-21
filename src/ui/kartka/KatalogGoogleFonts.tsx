import { useEffect, useId, useRef, useState } from 'react';
import { unikalneId } from '../../dane/czcionki';
import { dodajZasoby } from '../../dane/edycja';
import {
  KATALOG_GOOGLE_FONTS,
  adresyPodgladuGoogleFonts,
  czyRodzinaDodana,
  pobierzDowolnaRodzineGoogle,
  pobierzRodzineGoogle,
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

const komunikat = (e: unknown) =>
  e instanceof BladDanych ? e.message : String(e instanceof Error ? e.message : e);

/**
 * Kuratorowany katalog Google Fonts + pobieranie dowolnego kroju po nazwie.
 * Po rozwinięciu ładuje lekkie podzbiory CSS2 (`&text=...`) wyłącznie do podglądu próbki,
 * a pełne warianty TTF pobiera dopiero po kliknięciu użytkownika i zapisuje zarówno globalnie
 * w przeglądarce (dla wszystkich projektów), jak i w aktywnym projekcie (`zrodlo: 'google'`).
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
  const [filtr, ustawFiltr] = useState<FiltrKategorii>('wszystkie');
  const [szukaj, ustawSzukaj] = useState('');
  const [wlasnaNazwa, ustawWlasnaNazwe] = useState('');
  const [podgladWlasnej, ustawPodgladWlasnej] = useState('');
  const [pobieranaId, ustawPobieranaId] = useState<string>();
  const [globalneRodziny, ustawGlobalneRodziny] = useState<Set<string>>(new Set());
  const kontrolerRef = useRef<AbortController | null>(null);
  const idKategorii = useId();
  const idWlasnej = useId();

  useEffect(
    () => () => {
      kontrolerRef.current?.abort();
      kontrolerRef.current = null;
    },
    [],
  );

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

  // Leniwie dołącza arkusze CSS2 z parametrem `text=` dopiero po rozwinięciu katalogu (bez duplikatów).
  useEffect(() => {
    if (!otwarty || typeof document === 'undefined') return;
    const rodzinyDoPodgladu = [
      ...KATALOG_GOOGLE_FONTS.map((p) => p.rodzina),
      ...(aktywnyPodgladWlasnej ? [aktywnyPodgladWlasnej] : []),
    ];
    const adresy = adresyPodgladuGoogleFonts(rodzinyDoPodgladu, probka, 20);
    const oczekiwane = new Set(adresy);
    const istniejace = new Set<string>();
    for (const el of document.head.querySelectorAll('link[data-google-fonts-podglad]')) {
      const klucz = el.getAttribute('data-google-fonts-podglad');
      if (!klucz || !oczekiwane.has(klucz)) {
        el.remove();
      } else {
        istniejace.add(klucz);
      }
    }
    for (const href of adresy) {
      if (istniejace.has(href)) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.setAttribute('data-google-fonts-podglad', href);
      document.head.appendChild(link);
    }
  }, [otwarty, probka, aktywnyPodgladWlasnej]);

  const fraza = szukaj.trim().toLowerCase();
  const widoczne = KATALOG_GOOGLE_FONTS.filter((p) => {
    if (filtr !== 'wszystkie' && p.kategoria !== filtr) return false;
    if (!fraza) return true;
    return p.rodzina.toLowerCase().includes(fraza) || p.autor.toLowerCase().includes(fraza);
  });

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
      await zapiszPobrane(pozycja.rodzina, wgrane, kontroler.signal);
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
          onChange={(e) => ustawSzukaj(e.target.value)}
        />
      </div>
      <div className="pole-panelu katalog-google-kategorie">
        <label htmlFor={idKategorii}>{t('googleFonts.kategorie')}</label>
        <select
          id={idKategorii}
          value={filtr}
          onChange={(e) => ustawFiltr(e.target.value as FiltrKategorii)}
        >
          {KATEGORIE.map((k) => (
            <option key={k} value={k}>
              {t(`googleFonts.kategoria.${k}`)}
            </option>
          ))}
        </select>
      </div>
      <p className="podpis katalog-google-liczba">
        {t('googleFonts.liczba', {
          widoczne: widoczne.length,
          wszystkie: KATALOG_GOOGLE_FONTS.length,
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
        <ul className="lista-google-fonts">
          {widoczne.map((p) => {
            const dodana = edycja
              ? czyRodzinaDodana(p, edycja.projekt.zasoby)
              : globalneRodziny.has(p.rodzina.toLowerCase());
            const trwa = pobieranaId === p.id;
            const listaWariantow = p.warianty.map((w) => t(`wariant.${w.wariant}`)).join(', ');
            return (
              <li key={p.id} className="pozycja-google-font">
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
                    {t('googleFonts.meta', {
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
